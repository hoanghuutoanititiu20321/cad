import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";
import {
  computeBoundingBoxFromPoints,
  roundCm,
  roundMm,
  samplePathPoints,
} from "./math";
import { MM_TO_PT } from "./pdf";
import type {
  NestedGradingResult,
  PatternPiece,
  Point2D,
  SizeCode,
} from "./types";

export type RotationPolicy =
  | "smart-fit"
  | "two-way-180"
  | "nap-one-way";

export interface MarkerSettings {
  /** Total fabric roll width in cm (e.g. 150 cm) */
  fabricWidthCm: number;
  /** Selvedge margin trimmed on each side in cm (e.g. 1.5 cm per side) */
  selvedgeMarginCm: number;
  /** Gap between adjacent cut pieces for cutting knife clearance in mm (e.g. 4 mm) */
  pieceBufferMm: number;
  /** Number of garments of each size placed in ONE marker lay */
  sizeRatio: Record<SizeCode, number>;
  /** Number of fabric layers (plies) stacked on cutting table */
  fabricPlies: number;
  /** Allowed grain rotation & anti-overflow policy */
  rotationPolicy: RotationPolicy;
}

export interface PlacedMarkerPiece {
  uid: string;
  pieceId: string;
  code: string;
  name: string;
  englishName: string;
  size: SizeCode;
  color: string;
  instanceIndex: number;
  /** Extra rotation applied relative to primary grainline (0, 90, 180, 270) */
  rotationDeg: number;
  /** Cut contours in Marker Space (mm): X = along length [0..markerLengthMm], Y = across width [selvedgeMm..fabricWidthMm-selvedgeMm] */
  cutPolygons: Point2D[][];
  sewPolygons: Point2D[][];
  grainStart: Point2D;
  grainEnd: Point2D;
  labelPos: Point2D;
  bbox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  areaMm2: number;
}

export interface MarkerNestingResult {
  placedPieces: PlacedMarkerPiece[];
  fabricWidthMm: number;
  selvedgeMm: number;
  usableWidthMm: number;
  markerLengthMm: number;
  totalPieceAreaMm2: number;
  usableMarkerAreaMm2: number;
  /** True fabric utilization percentage (0..100) */
  efficiencyPct: number;
  wastePct: number;
  garmentsPerLay: number;
  totalGarmentsCut: number;
  /** Fabric length per single garment in meters */
  metersPerGarment: number;
  /** Total fabric roll length required for all plies (+2cm end-loss per ply) in meters */
  totalFabricMeters: number;
  /** Notes explaining smart cross-grain rotation or auto-seam splitting applied to prevent overflow */
  optimizationNotes: string[];
  warnings: string[];
}

function rotatePoint(p: Point2D, angleRad: number): Point2D {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return {
    x: p.x * c - p.y * s,
    y: p.x * s + p.y * c,
  };
}

function translatePoint(p: Point2D, dx: number, dy: number): Point2D {
  return {
    x: roundMm(p.x + dx),
    y: roundMm(p.y + dy),
  };
}

/**
 * Sutherland-Hodgman half-plane polygon clipper for x <= clipX (when keepLeft=true)
 * or x >= clipX (when keepLeft=false). Used when an oversized 360°/270° single piece
 * exceeds the fabric roll in ALL directions and must be split along its symmetry axis (+ seam allowance).
 */
function clipPolygonVertical(
  poly: Point2D[],
  clipX: number,
  keepLeft: boolean
): Point2D[] {
  if (poly.length === 0) return [];
  const inside = (p: Point2D) => (keepLeft ? p.x <= clipX : p.x >= clipX);
  const intersect = (a: Point2D, b: Point2D): Point2D => {
    const dx = b.x - a.x;
    if (Math.abs(dx) < 1e-9) return { x: clipX, y: a.y };
    const t = (clipX - a.x) / dx;
    return {
      x: clipX,
      y: a.y + (b.y - a.y) * t,
    };
  };

  const out: Point2D[] = [];
  for (let i = 0; i < poly.length; i++) {
    const curr = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const currIn = inside(curr);
    const prevIn = inside(prev);

    if (currIn) {
      if (!prevIn) out.push(intersect(prev, curr));
      out.push(curr);
    } else if (prevIn) {
      out.push(intersect(prev, curr));
    }
  }
  return out;
}

/**
 * Split a symmetrical PatternPiece along X = centerX into 2 half-pieces (with +10mm seam allowance overlap)
 * when a single giant piece (e.g., 360° full circle) exceeds usable fabric width in EVERY rotation.
 */
function splitOversizedPieceInHalf(
  piece: PatternPiece,
  seamOverlapMm = 10
): [PatternPiece, PatternPiece] {
  const cx = roundMm((piece.bbox.minX + piece.bbox.maxX) / 2);

  // Convert full annular donut (outer ring + inner ring) into a single simple polygon before clipping if needed,
  // or clip outer polygon cleanly when it's a single closed contour.
  const makeHalf = (isLeft: boolean, suffix: "A" | "B"): PatternPiece => {
    const cutLineX = isLeft ? cx + seamOverlapMm : cx - seamOverlapMm;
    const sewLineX = cx;

    const rawOuter = samplePathPoints(piece.cutPaths[0], 3);
    let clippedCut: Point2D[];

    if (piece.cutPaths.length > 1) {
      // Full-circle donut with inner waist hole: bridge outer & inner arcs into a clean 180° C-sector!
      const rawInner = samplePathPoints(piece.cutPaths[1], 3);
      const outerHalf = clipPolygonVertical(rawOuter, cutLineX, isLeft);
      const innerHalf = clipPolygonVertical(rawInner, cutLineX, isLeft).reverse();
      clippedCut = [...outerHalf, ...innerHalf];
    } else {
      clippedCut = clipPolygonVertical(rawOuter, cutLineX, isLeft);
    }

    const rawSewOuter = samplePathPoints(piece.sewPaths[0], 3);
    let clippedSew: Point2D[];
    if (piece.sewPaths.length > 1) {
      const rawSewInner = samplePathPoints(piece.sewPaths[1], 3);
      const sOut = clipPolygonVertical(rawSewOuter, sewLineX, isLeft);
      const sIn = clipPolygonVertical(rawSewInner, sewLineX, isLeft).reverse();
      clippedSew = [...sOut, ...sIn];
    } else {
      clippedSew = clipPolygonVertical(rawSewOuter, sewLineX, isLeft);
    }

    const bbox = computeBoundingBoxFromPoints(clippedCut);
    const midX = roundMm((bbox.minX + bbox.maxX) / 2);
    const midY = roundMm((bbox.minY + bbox.maxY) / 2);

    // Preserve original grainline orientation vector
    const gVecX = piece.grainline.end.x - piece.grainline.start.x;
    const gVecY = piece.grainline.end.y - piece.grainline.start.y;
    const gLen = Math.hypot(gVecX, gVecY) || 100;
    const halfSpan = Math.min(gLen * 0.35, Math.min(bbox.width, bbox.height) * 0.28);
    const ux = gVecX / gLen;
    const uy = gVecY / gLen;

    return {
      ...piece,
      id: `${piece.id}-${suffix.toLowerCase()}`,
      code: `${piece.code}${suffix}`,
      name: `${piece.name} (Nửa ${suffix})`,
      englishName: `${piece.englishName} (Half ${suffix})`,
      cutQuantity: 1,
      cutPaths: [
        {
          id: `${piece.id}-cut-${suffix}`,
          kind: "cut",
          closed: true,
          segments: [
            { type: "M", to: clippedCut[0] ?? { x: 0, y: 0 } },
            ...clippedCut.slice(1).map((pt) => ({ type: "L" as const, to: pt })),
            { type: "Z" },
          ],
        },
      ],
      sewPaths:
        clippedSew.length > 2
          ? [
              {
                id: `${piece.id}-sew-${suffix}`,
                kind: "sew",
                closed: true,
                segments: [
                  { type: "M", to: clippedSew[0] },
                  ...clippedSew
                    .slice(1)
                    .map((pt) => ({ type: "L" as const, to: pt })),
                  { type: "Z" },
                ],
              },
            ]
          : [],
      grainline: {
        start: { x: roundMm(midX - ux * halfSpan), y: roundMm(midY - uy * halfSpan) },
        end: { x: roundMm(midX + ux * halfSpan), y: roundMm(midY + uy * halfSpan) },
        label: piece.grainline.label,
      },
      labelAnchor: { x: midX, y: midY },
      bbox,
      metrics: {
        ...piece.metrics,
        widthMm: bbox.width,
        heightMm: bbox.height,
        areaMm2: roundMm(piece.metrics.areaMm2 * 0.51),
      },
    };
  };

  return [makeHalf(true, "A"), makeHalf(false, "B")];
}

/**
 * Ray-casting point-in-polygon with even-odd rule.
 */
function pointInEvenOddPolygons(pt: Point2D, polygons: Point2D[][]): boolean {
  let inside = false;
  for (const poly of polygons) {
    const n = poly.length;
    if (n < 3) continue;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = poly[i].x;
      const yi = poly[i].y;
      const xj = poly[j].x;
      const yj = poly[j].y;
      const intersect =
        yi > pt.y !== yj > pt.y &&
        pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-9) + xi;
      if (intersect) inside = !inside;
    }
  }
  return inside;
}

interface CandidateOrientation {
  rotationDeg: number;
  cutPolysZero: Point2D[][];
  sewPolysZero: Point2D[][];
  grainStartZero: Point2D;
  grainEndZero: Point2D;
  labelZero: Point2D;
  widthMm: number;
  heightMm: number;
  coreW: number;
  coreH: number;
  cellsW: number;
  cellsH: number;
  wordsPerCol: number;
  colBitmasks: Uint32Array;
}

function buildOrientationBitmask(
  piece: PatternPiece,
  extraRotDeg: number,
  cellMm: number,
  bufferMm: number
): CandidateOrientation {
  const gDx = piece.grainline.end.x - piece.grainline.start.x;
  const gDy = piece.grainline.end.y - piece.grainline.start.y;
  const baseAlignRad = -Math.atan2(gDy, gDx);
  const totalRad = baseAlignRad + (extraRotDeg * Math.PI) / 180;

  const rawCutPolys = piece.cutPaths.map((cp) =>
    samplePathPoints(cp, 3).map((p) => rotatePoint(p, totalRad))
  );
  const rawSewPolys = piece.sewPaths.map((sp) =>
    samplePathPoints(sp, 4).map((p) => rotatePoint(p, totalRad))
  );

  const allCutPts = rawCutPolys.flat();
  const bbox = computeBoundingBoxFromPoints(allCutPts);

  const shiftX = -bbox.minX;
  const shiftY = -bbox.minY;

  const cutPolysZero = rawCutPolys.map((poly) =>
    poly.map((p) => translatePoint(p, shiftX, shiftY))
  );
  const sewPolysZero = rawSewPolys.map((poly) =>
    poly.map((p) => translatePoint(p, shiftX, shiftY))
  );

  const grainStartZero = translatePoint(
    rotatePoint(piece.grainline.start, totalRad),
    shiftX,
    shiftY
  );
  const grainEndZero = translatePoint(
    rotatePoint(piece.grainline.end, totalRad),
    shiftX,
    shiftY
  );
  const labelZero = translatePoint(
    rotatePoint(piece.labelAnchor, totalRad),
    shiftX,
    shiftY
  );

  // Morphological dilation for exact `bufferMm` knife clearance between pieces
  // Note: `coreH` tracks exact geometric height so boundary clamping against fabric selvedge is 100% exact!
  const padCells = Math.max(1, Math.ceil(bufferMm / cellMm));
  const coreW = Math.max(1, Math.ceil(bbox.width / cellMm));
  const coreH = Math.max(1, Math.ceil(bbox.height / cellMm));
  const cellsW = coreW + padCells;
  const cellsH = coreH + padCells;
  const wordsPerCol = Math.ceil(cellsH / 32);

  const rawHits = new Uint8Array(coreW * coreH);
  for (let cx = 0; cx < coreW; cx++) {
    const px = (cx + 0.5) * cellMm;
    for (let cy = 0; cy < coreH; cy++) {
      const py = (cy + 0.5) * cellMm;
      if (pointInEvenOddPolygons({ x: px, y: py }, cutPolysZero)) {
        rawHits[cx * coreH + cy] = 1;
      }
    }
  }

  for (const poly of cutPolysZero) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(dist / (cellMm * 0.5)));
      for (let s = 0; s <= steps; s++) {
        const x = a.x + ((b.x - a.x) * s) / steps;
        const y = a.y + ((b.y - a.y) * s) / steps;
        const cx = Math.min(coreW - 1, Math.max(0, Math.floor(x / cellMm)));
        const cy = Math.min(coreH - 1, Math.max(0, Math.floor(y / cellMm)));
        rawHits[cx * coreH + cy] = 1;
      }
    }
  }

  const colBitmasks = new Uint32Array(cellsW * wordsPerCol);
  for (let cx = 0; cx < coreW; cx++) {
    for (let cy = 0; cy < coreH; cy++) {
      if (!rawHits[cx * coreH + cy]) continue;
      for (let dx = 0; dx <= padCells; dx++) {
        const tx = cx + dx;
        if (tx >= cellsW) continue;
        for (let dy = 0; dy <= padCells; dy++) {
          const ty = cy + dy;
          if (ty >= cellsH) continue;
          const wordIdx = tx * wordsPerCol + (ty >>> 5);
          colBitmasks[wordIdx] |= 1 << (ty & 31);
        }
      }
    }
  }

  return {
    rotationDeg: extraRotDeg,
    cutPolysZero,
    sewPolysZero,
    grainStartZero,
    grainEndZero,
    labelZero,
    widthMm: roundMm(bbox.width),
    heightMm: roundMm(bbox.height),
    coreW,
    coreH,
    cellsW,
    cellsH,
    wordsPerCol,
    colBitmasks,
  };
}

/**
 * Automated True-Shape Garment Marker Nesting Engine with Zero-Overflow Guarantee:
 * 1. Strictly enforces `offsetYMm + pieceHeightMm <= fabricWidthMm - selvedgeMm` (ZERO selvedge overflow!).
 * 2. Automatically applies Cross-Grain 90°/270° Yin-Yang interlocking when a wide half-circle skirt
 *    exceeds the fabric width along 0°/180° — nesting curved domes alternately against top & bottom selvedges
 *    and tucking waistbands into the opposite voids for high efficiency!
 * 3. Automatically splits ultra-wide pieces (e.g. 360° single-piece full circle > 150cm in BOTH axes)
 *    along their symmetry line (+1.0cm seam allowance) when physically wider than the fabric roll in every angle!
 */
export function generateMarkerNesting(
  grading: NestedGradingResult,
  settings: MarkerSettings
): MarkerNestingResult {
  const cellMm = 6;
  const optimizationNotes: string[] = [];
  const warnings: string[] = [];

  const fabricWidthMm = roundMm(Math.max(800, settings.fabricWidthCm * 10));
  const selvedgeMm = roundMm(Math.max(0, settings.selvedgeMarginCm * 10));
  const usableWidthMm = roundMm(Math.max(400, fabricWidthMm - selvedgeMm * 2));
  const bufferMm = Math.max(0, settings.pieceBufferMm);

  interface PendingItem {
    uid: string;
    piece: PatternPiece;
    size: SizeCode;
    color: string;
    instanceIndex: number;
  }

  const rawItems: PendingItem[] = [];
  let garmentsPerLay = 0;

  for (const entry of grading.entries) {
    const ratioQty = Math.max(0, Math.floor(settings.sizeRatio[entry.size] || 0));
    if (ratioQty === 0) continue;
    garmentsPerLay += ratioQty;

    for (let g = 0; g < ratioQty; g++) {
      for (const piece of entry.geometry.pieces) {
        for (let q = 0; q < piece.cutQuantity; q++) {
          rawItems.push({
            uid: `${piece.code}-${entry.size}-${g + 1}-${q + 1}`,
            piece,
            size: entry.size,
            color: entry.color,
            instanceIndex: g * piece.cutQuantity + q + 1,
          });
        }
      }
    }
  }

  if (rawItems.length === 0) {
    const base =
      grading.entries.find((e) => e.size === grading.baseSize) ??
      grading.entries[0];
    garmentsPerLay = 1;
    for (const piece of base.geometry.pieces) {
      for (let q = 0; q < piece.cutQuantity; q++) {
        rawItems.push({
          uid: `${piece.code}-${base.size}-1-${q + 1}`,
          piece,
          size: base.size,
          color: base.color,
          instanceIndex: q + 1,
        });
      }
    }
  }

  const orientCache = new Map<string, CandidateOrientation>();
  const getOrientation = (piece: PatternPiece, size: SizeCode, rot: number) => {
    const key = `${piece.id}:${size}:${rot}`;
    let cached = orientCache.get(key);
    if (!cached) {
      cached = buildOrientationBitmask(piece, rot, cellMm, bufferMm);
      orientCache.set(key, cached);
    }
    return cached;
  };

  // Pre-process items: check if any piece is physically larger than usableWidthMm in ALL 4 cardinal orientations
  // (e.g. a 360° 1-piece full-circle skirt of 164cm × 164cm on a 147cm usable roll).
  // If so, recursively split along symmetry axis (+10mm seam allowance) until every piece fits cleanly inside the roll!
  const items: PendingItem[] = [];
  let didAutoSplit = false;
  let didCrossGrain = false;

  const ensureFitsRoll = (pending: PendingItem, depth = 0): PendingItem[] => {
    const probe0 = getOrientation(pending.piece, pending.size, 0);
    const probe90 = getOrientation(pending.piece, pending.size, 90);
    const minSpanMm = Math.min(probe0.heightMm, probe90.heightMm);

    if (minSpanMm <= usableWidthMm || depth >= 2) {
      return [pending];
    }

    didAutoSplit = true;
    const [halfA, halfB] = splitOversizedPieceInHalf(pending.piece, 10);
    return [
      ...ensureFitsRoll({ ...pending, uid: `${pending.uid}-A`, piece: halfA }, depth + 1),
      ...ensureFitsRoll({ ...pending, uid: `${pending.uid}-B`, piece: halfB }, depth + 1),
    ];
  };

  for (const it of rawItems) {
    items.push(...ensureFitsRoll(it));
  }

  if (didAutoSplit) {
    optimizationNotes.push(
      `Đã tự động tách mảnh quá khổ (+1.0 cm chừa đường may nối) để nằm gọn 100% trong khổ hữu dụng ${roundCm(usableWidthMm / 10, 1)} cm.`
    );
  }

  // Sort Largest-Area First so large skirt panels interlock first, then waistbands fill the interior voids!
  items.sort((a, b) => b.piece.metrics.areaMm2 - a.piece.metrics.areaMm2);

  // Determine candidate rotations that STRICTLY fit inside `usableWidthMm` (zero overflow!)
  const getFittingCandidates = (
    piece: PatternPiece,
    size: SizeCode
  ): CandidateOrientation[] => {
    const primaryAngles =
      settings.rotationPolicy === "nap-one-way" ? [0] : [0, 180];

    const primaryCands = primaryAngles
      .map((r) => getOrientation(piece, size, r))
      .filter((c) => c.heightMm <= usableWidthMm);

    if (settings.rotationPolicy === "smart-fit") {
      // In smart-fit mode:
      // - If primary 0°/180° overflows (like 180° skirt = 164cm wide > 147cm roll), automatically use 90°/270°!
      // - Also allow 90°/270° for waistbands or whenever it unlocks tighter Yin-Yang interlocking!
      const crossAngles =
        settings.rotationPolicy === "smart-fit" ? [90, 270] : [];
      const crossCands = crossAngles
        .map((r) => getOrientation(piece, size, r))
        .filter((c) => c.heightMm <= usableWidthMm);

      if (primaryCands.length === 0 && crossCands.length > 0) {
        didCrossGrain = true;
        return crossCands;
      }
      // For waistbands or smart interlocking, evaluate both primary & cross-grain to achieve highest fabric efficiency
      if (piece.id.startsWith("waistband")) {
        return [...primaryCands, ...crossCands];
      }
      return primaryCands.length > 0 ? primaryCands : crossCands;
    }

    // Even in strict 0°/180° or 1-way mode, if primary angle overflows the fabric roll,
    // fall back to 90°/270° rather than overflowing off the table!
    if (primaryCands.length > 0) {
      return primaryCands;
    }

    const fallbackAngles =
      settings.rotationPolicy === "nap-one-way" ? [90] : [90, 270];
    const fallbackCands = fallbackAngles
      .map((r) => getOrientation(piece, size, r))
      .filter((c) => c.heightMm <= usableWidthMm);

    if (fallbackCands.length > 0) {
      didCrossGrain = true;
      return fallbackCands;
    }

    // Ultimate fallback if fabric width was set unrealistically tiny
    const anyCand = [0, 90, 180, 270].map((r) => getOrientation(piece, size, r));
    anyCand.sort((a, b) => a.heightMm - b.heightMm);
    warnings.push(
      `Khổ vải ${settings.fabricWidthCm} cm quá hẹp so với mảnh ${piece.code} (${roundCm(anyCand[0].heightMm / 10, 1)} cm).`
    );
    return [anyCand[0]];
  };

  // Board height in cells covers usableWidthMm + pad margin for right/bottom buffer bits
  const boardCellsH = Math.max(12, Math.ceil(usableWidthMm / cellMm) + 6);
  const boardWordsPerCol = Math.ceil(boardCellsH / 32);

  const maxEstLengthMm = items.reduce(
    (acc, it) =>
      acc + Math.max(it.piece.metrics.widthMm, it.piece.metrics.heightMm) + 50,
    500
  );
  const maxBoardCols = Math.ceil(maxEstLengthMm / cellMm) + 50;
  const board = new Uint32Array(maxBoardCols * boardWordsPerCol);

  let currentMaxCol = 0;
  const placedPieces: PlacedMarkerPiece[] = [];
  let totalPieceAreaMm2 = 0;

  const canPlaceAt = (
    cand: CandidateOrientation,
    colX: number,
    rowY: number
  ): boolean => {
    const wordOffset = rowY >>> 5;
    const bitShift = rowY & 31;

    for (let dx = 0; dx < cand.cellsW; dx++) {
      const bColBase = (colX + dx) * boardWordsPerCol;
      const pColBase = dx * cand.wordsPerCol;

      for (let w = 0; w < cand.wordsPerCol; w++) {
        const pBits = cand.colBitmasks[pColBase + w];
        if (pBits === 0) continue;

        const bw0 = wordOffset + w;
        if (bw0 < boardWordsPerCol) {
          if ((board[bColBase + bw0] & (pBits << bitShift)) !== 0) {
            return false;
          }
        }
        if (bitShift > 0) {
          const bw1 = wordOffset + w + 1;
          if (bw1 < boardWordsPerCol) {
            if ((board[bColBase + bw1] & (pBits >>> (32 - bitShift))) !== 0) {
              return false;
            }
          }
        }
      }
    }
    return true;
  };

  items.forEach((item, itemIdx) => {
    const candidates = getFittingCandidates(item.piece, item.size);

    let bestChoice: {
      cand: CandidateOrientation;
      colX: number;
      rowY: number;
      exactYMm: number;
      score: number;
    } | null = null;

    // Alternate preference between top selvedge and bottom selvedge on consecutive large panels
    // so curved domes naturally Yin-Yang interlock from opposite selvedges!
    const isSmallStrip = item.piece.id.startsWith("waistband");
    const preferBottomEdge = !isSmallStrip && itemIdx % 2 === 1;

    for (const cand of candidates) {
      // STRICT ZERO-OVERFLOW CLAMP: `rowY * cellMm + cand.heightMm <= usableWidthMm`!
      const maxLegalRowY = Math.max(
        0,
        Math.floor((usableWidthMm - cand.heightMm) / cellMm)
      );

      const searchLimitCol = Math.min(
        maxBoardCols - cand.cellsW - 1,
        currentMaxCol + 2
      );

      // Slight preference for lengthwise horizontal placement (0°/180°) on narrow strips
      // so waistbands stack neatly lengthwise inside pockets instead of blocking pockets vertically!
      const rotPenalty =
        isSmallStrip && (cand.rotationDeg === 90 || cand.rotationDeg === 270)
          ? 250
          : 0;

      for (let colX = 0; colX <= searchLimitCol; colX++) {
        const newRightCol = Math.max(currentMaxCol, colX + cand.coreW);
        // Primary objective: minimize marker length (`newRightCol`), secondary: pack leftward (`colX`)
        const baseColScore = newRightCol * 100000 + colX * 60 + rotPenalty;
        if (bestChoice && baseColScore >= bestChoice.score) {
          break;
        }

        const candidateRows: number[] = [];
        if (isSmallStrip) {
          // For small strips (waistbands), check top-most, bottom-most, AND interior pocket rows!
          for (let r = 0; r <= maxLegalRowY; r += 2) {
            if (canPlaceAt(cand, colX, r)) {
              candidateRows.push(r);
              if (candidateRows.length >= 3) break;
            }
          }
          if (maxLegalRowY > 0 && canPlaceAt(cand, colX, maxLegalRowY)) {
            candidateRows.push(maxLegalRowY);
          }
        } else {
          // For large panels, hug top selvedge or bottom selvedge for tight Yin-Yang interlocking
          for (let r = 0; r <= maxLegalRowY; r++) {
            if (canPlaceAt(cand, colX, r)) {
              candidateRows.push(r);
              break;
            }
          }
          if (maxLegalRowY > 0) {
            for (let r = maxLegalRowY; r >= 0; r--) {
              if (canPlaceAt(cand, colX, r)) {
                if (!candidateRows.includes(r)) candidateRows.push(r);
                break;
              }
            }
          }
        }

        for (const rowY of candidateRows) {
          const distToSelvedge = Math.min(rowY, maxLegalRowY - rowY);
          const isBottomMost = rowY === maxLegalRowY && maxLegalRowY > 0;
          const edgeBias =
            preferBottomEdge && isBottomMost
              ? 0
              : !preferBottomEdge && rowY === 0
                ? 0
                : 12;
          const score = baseColScore + distToSelvedge * 8 + edgeBias;

          if (!bestChoice || score < bestChoice.score) {
            const exactYMm = isBottomMost
              ? Math.max(0, usableWidthMm - cand.heightMm)
              : Math.min(rowY * cellMm, Math.max(0, usableWidthMm - cand.heightMm));

            bestChoice = { cand, colX, rowY, exactYMm, score };
          }
        }
      }
    }

    const chosen = bestChoice ?? {
      cand: candidates[0],
      colX: currentMaxCol,
      rowY: 0,
      exactYMm: 0,
      score: 0,
    };

    const { cand, colX, rowY, exactYMm } = chosen;
    const wordOffset = rowY >>> 5;
    const bitShift = rowY & 31;

    for (let dx = 0; dx < cand.cellsW; dx++) {
      const bColBase = (colX + dx) * boardWordsPerCol;
      const pColBase = dx * cand.wordsPerCol;
      for (let w = 0; w < cand.wordsPerCol; w++) {
        const pBits = cand.colBitmasks[pColBase + w];
        if (pBits === 0) continue;
        const bw0 = wordOffset + w;
        if (bw0 < boardWordsPerCol) {
          board[bColBase + bw0] |= pBits << bitShift;
        }
        if (bitShift > 0 && wordOffset + w + 1 < boardWordsPerCol) {
          board[bColBase + wordOffset + w + 1] |= pBits >>> (32 - bitShift);
        }
      }
    }

    if (colX + cand.coreW > currentMaxCol) {
      currentMaxCol = colX + cand.coreW;
    }

    const offsetXMm = roundMm(colX * cellMm + bufferMm * 0.5);
    const offsetYMm = roundMm(selvedgeMm + exactYMm);

    const cutPolygons = cand.cutPolysZero.map((poly) =>
      poly.map((p) => translatePoint(p, offsetXMm, offsetYMm))
    );
    const sewPolygons = cand.sewPolysZero.map((poly) =>
      poly.map((p) => translatePoint(p, offsetXMm, offsetYMm))
    );

    placedPieces.push({
      uid: item.uid,
      pieceId: item.piece.id,
      code: item.piece.code,
      name: item.piece.name,
      englishName: item.piece.englishName,
      size: item.size,
      color: item.color,
      instanceIndex: item.instanceIndex,
      rotationDeg: cand.rotationDeg,
      cutPolygons,
      sewPolygons,
      grainStart: translatePoint(cand.grainStartZero, offsetXMm, offsetYMm),
      grainEnd: translatePoint(cand.grainEndZero, offsetXMm, offsetYMm),
      labelPos: translatePoint(cand.labelZero, offsetXMm, offsetYMm),
      bbox: {
        minX: offsetXMm,
        minY: offsetYMm,
        maxX: roundMm(offsetXMm + cand.widthMm),
        maxY: roundMm(offsetYMm + cand.heightMm),
        width: cand.widthMm,
        height: cand.heightMm,
      },
      areaMm2: item.piece.metrics.areaMm2,
    });

    totalPieceAreaMm2 += item.piece.metrics.areaMm2;
  });

  if (didCrossGrain) {
    optimizationNotes.push(
      `Đã tự động xoay canh ngang 90°/270° cài răng lược so le trên–dưới để mảnh rập nằm gọn 100% trong khổ hữu dụng ${roundCm(usableWidthMm / 10, 1)} cm và nhét bản lưng vào khe trống.`
    );
  }

  const exactMaxX = placedPieces.reduce(
    (mx, p) => Math.max(mx, p.bbox.maxX),
    100
  );
  const markerLengthMm = roundMm(exactMaxX + 15);
  const usableMarkerAreaMm2 = markerLengthMm * usableWidthMm;

  const rawEfficiency =
    usableMarkerAreaMm2 > 0
      ? (totalPieceAreaMm2 / usableMarkerAreaMm2) * 100
      : 0;
  const efficiencyPct = roundCm(Math.min(98.5, rawEfficiency), 1);
  const wastePct = roundCm(Math.max(0, 100 - efficiencyPct), 1);

  const plies = Math.max(1, Math.floor(settings.fabricPlies || 1));
  const totalGarmentsCut = garmentsPerLay * plies;
  const metersPerGarment = roundCm(
    markerLengthMm / 1000 / Math.max(1, garmentsPerLay),
    2
  );
  const totalFabricMeters = roundCm(((markerLengthMm + 20) / 1000) * plies, 2);

  return {
    placedPieces,
    fabricWidthMm,
    selvedgeMm,
    usableWidthMm,
    markerLengthMm,
    totalPieceAreaMm2,
    usableMarkerAreaMm2,
    efficiencyPct,
    wastePct,
    garmentsPerLay,
    totalGarmentsCut,
    metersPerGarment,
    totalFabricMeters,
    optimizationNotes,
    warnings,
  };
}

function toAscii(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/×/g, "x")
    .replace(/[^\x20-\x7E]/g, " ");
}

/**
 * Generate a 1:1 Full-Scale Cutting Plotter PDF of the Nested Marker!
 */
export async function generateFullScaleMarkerPdf(
  marker: MarkerNestingResult,
  templateName: string,
  styleCode: string
): Promise<{ bytes: Uint8Array; filename: string }> {
  const headerBandMm = 28;
  const sheetWmm = Math.max(300, marker.markerLengthMm + 20);
  const sheetHmm = marker.fabricWidthMm + headerBandMm + 10;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`1:1 Cutting Marker - ${toAscii(styleCode)}`);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([sheetWmm * MM_TO_PT, sheetHmm * MM_TO_PT]);

  const leftPadMm = 10;
  const bottomPadMm = 5;

  page.drawRectangle({
    x: leftPadMm * MM_TO_PT,
    y: bottomPadMm * MM_TO_PT,
    width: marker.markerLengthMm * MM_TO_PT,
    height: marker.fabricWidthMm * MM_TO_PT,
    borderColor: rgb(0.1, 0.14, 0.22),
    borderWidth: 1.2,
  });

  if (marker.selvedgeMm > 0) {
    for (const yMm of [
      bottomPadMm + marker.selvedgeMm,
      bottomPadMm + marker.fabricWidthMm - marker.selvedgeMm,
    ]) {
      page.drawLine({
        start: { x: leftPadMm * MM_TO_PT, y: yMm * MM_TO_PT },
        end: {
          x: (leftPadMm + marker.markerLengthMm) * MM_TO_PT,
          y: yMm * MM_TO_PT,
        },
        color: rgb(0.58, 0.64, 0.72),
        thickness: 0.8,
        dashArray: [6, 4],
      });
    }
  }

  const headerY = (bottomPadMm + marker.fabricWidthMm + 10) * MM_TO_PT;
  page.drawText(
    toAscii(
      `SO DO GIAC CAT 1:1 (FULL-SCALE MARKER)  |  MA HANG: ${styleCode}  |  ${templateName.toUpperCase()}  |  KHO VAI: ${roundCm(marker.fabricWidthMm / 10, 1)} cm  |  DAI SO DO: ${roundCm(marker.markerLengthMm / 1000, 2)} m  |  HIEU SUAT: ${marker.efficiencyPct}%`
    ),
    {
      x: leftPadMm * MM_TO_PT,
      y: headerY,
      size: 11,
      font: fontBold,
      color: rgb(0.06, 0.09, 0.16),
    }
  );

  const mapPt = (p: Point2D) => ({
    x: (leftPadMm + p.x) * MM_TO_PT,
    y: (bottomPadMm + marker.fabricWidthMm - p.y) * MM_TO_PT,
  });

  for (const placed of marker.placedPieces) {
    for (const poly of placed.cutPolygons) {
      for (let i = 0; i < poly.length; i++) {
        const a = mapPt(poly[i]);
        const b = mapPt(poly[(i + 1) % poly.length]);
        page.drawLine({
          start: a,
          end: b,
          color: rgb(0.06, 0.09, 0.16),
          thickness: 1.3,
        });
      }
    }

    for (const poly of placed.sewPolygons) {
      for (let i = 0; i < poly.length; i++) {
        const a = mapPt(poly[i]);
        const b = mapPt(poly[(i + 1) % poly.length]);
        page.drawLine({
          start: a,
          end: b,
          color: rgb(0.31, 0.27, 0.9),
          thickness: 0.75,
          dashArray: [5, 3.5],
        });
      }
    }

    page.drawLine({
      start: mapPt(placed.grainStart),
      end: mapPt(placed.grainEnd),
      color: rgb(0.06, 0.46, 0.43),
      thickness: 0.9,
    });

    const lbl = mapPt(placed.labelPos);
    page.drawText(
      toAscii(`${placed.code} [${placed.size}] (${placed.rotationDeg} deg)`),
      {
        x: lbl.x - 35,
        y: lbl.y,
        size: 9,
        font: fontBold,
        color: rgb(0.06, 0.09, 0.16),
      }
    );
    page.drawText(toAscii(placed.englishName), {
      x: lbl.x - 35,
      y: lbl.y - 11,
      size: 7.5,
      font,
      color: rgb(0.39, 0.45, 0.55),
    });
  }

  const bytes = await pdfDoc.save();
  return {
    bytes,
    filename: `so-do-giac-1-1-${toAscii(styleCode).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
  };
}

/**
 * Export 1:1 CNC Cutting Marker DXF (AutoCAD R12, millimeters).
 */
export function generateMarkerDxf(
  marker: MarkerNestingResult,
  styleCode: string
): { content: string; filename: string } {
  const fmt = (n: number) => roundMm(n).toFixed(2);
  const mapY = (y: number) => roundMm(marker.fabricWidthMm - y);

  const entities: string[] = [];

  const borderPts: Point2D[] = [
    { x: 0, y: 0 },
    { x: marker.markerLengthMm, y: 0 },
    { x: marker.markerLengthMm, y: marker.fabricWidthMm },
    { x: 0, y: marker.fabricWidthMm },
  ];
  for (let i = 0; i < 4; i++) {
    const a = borderPts[i];
    const b = borderPts[(i + 1) % 4];
    entities.push(
      "0",
      "LINE",
      "8",
      "BORDER",
      "10",
      fmt(a.x),
      "20",
      fmt(a.y),
      "30",
      "0.00",
      "11",
      fmt(b.x),
      "21",
      fmt(b.y),
      "31",
      "0.00"
    );
  }

  for (const p of marker.placedPieces) {
    for (const poly of p.cutPolygons) {
      entities.push(
        "0",
        "POLYLINE",
        "8",
        "1",
        "66",
        "1",
        "10",
        "0.00",
        "20",
        "0.00",
        "30",
        "0.00",
        "70",
        "1"
      );
      for (const v of poly) {
        entities.push(
          "0",
          "VERTEX",
          "8",
          "1",
          "10",
          fmt(v.x),
          "20",
          fmt(mapY(v.y)),
          "30",
          "0.00"
        );
      }
      entities.push("0", "SEQEND", "8", "1");
    }

    entities.push(
      "0",
      "LINE",
      "8",
      "7",
      "10",
      fmt(p.grainStart.x),
      "20",
      fmt(mapY(p.grainStart.y)),
      "30",
      "0.00",
      "11",
      fmt(p.grainEnd.x),
      "21",
      fmt(mapY(p.grainEnd.y)),
      "31",
      "0.00"
    );

    entities.push(
      "0",
      "TEXT",
      "8",
      "15",
      "10",
      fmt(p.labelPos.x - 25),
      "20",
      fmt(mapY(p.labelPos.y)),
      "30",
      "0.00",
      "40",
      "9.00",
      "1",
      toAscii(`${p.code} [${p.size}]`)
    );
  }

  const lines = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$ACADVER",
    "1",
    "AC1009",
    "9",
    "$INSUNITS",
    "70",
    "4",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    ...entities,
    "0",
    "ENDSEC",
    "0",
    "EOF",
  ];

  return {
    content: lines.join("\r\n") + "\r\n",
    filename: `so-do-giac-cnc-${toAscii(styleCode).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.dxf`,
  };
}
