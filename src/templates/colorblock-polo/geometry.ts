import {
  computePathPerimeter,
  computePathsBoundingBox,
  mergeBoundingBoxes,
  pt,
  roundCm,
  roundMm,
  samplePathPoints,
} from "@/lib/cad/math";
import type {
  FormulaItem,
  Notch,
  ParamValues,
  PatternGeometryResult,
  PatternPiece,
  Point2D,
  VectorPath,
} from "@/lib/cad/types";
import {
  parseColorblockPoloParams,
  type ColorblockPoloParams,
} from "./schema";

export interface PoloGeometryOptions {
  /** Shared X center for Back Body */
  backCenterX?: number;
  /** Shared X center for Short Sleeve */
  sleeveCenterX?: number;
  /** Shared Y top anchor for Placket & Collar under Short Sleeve */
  auxColStartY?: number;
  /** Frozen grainlines from Base Size so Gerber AccuMark keeps all S-M-L-XL blocks locked concentrically */
  fixedGrainlines?: Record<string, { start: Point2D; end: Point2D }>;
}

const HEM_FOLD_MM = 25; // 2.5 cm coverstitch hem allowance on polo body & short sleeve
const PANEL_EXPLODE_GAP_MM = 56; // Visual separation between diagonal colorblock pieces on CAD sheet

function approxPathAreaMm2(path: VectorPath): number {
  const pts = samplePathPoints(path, 3);
  if (pts.length < 3) return 0;
  let area2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area2 += a.x * b.y - b.x * a.y;
  }
  return roundMm(Math.abs(area2) / 2);
}

/**
 * Exact analytical outward parallel offset for a closed polygon (supports per-edge custom allowance,
 * e.g. 10 mm on diagonal/side seams and 25 mm on bottom coverstitch hem!).
 */
function offsetClosedPolygon(verts: Point2D[], edgeOffsets: number[]): Point2D[] {
  const n = verts.length;
  let area2 = 0;
  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    area2 += a.x * b.y - b.x * a.y;
  }
  const sign = area2 >= 0 ? 1 : -1;

  const lines: Array<{ p: Point2D; d: Point2D }> = [];
  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (sign * dy) / len;
    const ny = (-sign * dx) / len;
    const off = edgeOffsets[i] ?? edgeOffsets[0] ?? 10;
    lines.push({
      p: { x: a.x + nx * off, y: a.y + ny * off },
      d: { x: dx, y: dy },
    });
  }

  const out: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const l1 = lines[(i + n - 1) % n];
    const l2 = lines[i];
    const det = l1.d.x * l2.d.y - l1.d.y * l2.d.x;
    if (Math.abs(det) < 1e-6) {
      out.push(pt(l2.p.x, l2.p.y));
    } else {
      const t =
        ((l2.p.x - l1.p.x) * l2.d.y - (l2.p.y - l1.p.y) * l2.d.x) / det;
      out.push(pt(l1.p.x + t * l1.d.x, l1.p.y + t * l1.d.y));
    }
  }
  return out;
}

function polygonToPath(id: string, kind: "sew" | "cut", verts: Point2D[]): VectorPath {
  return {
    id,
    kind,
    closed: true,
    segments: [
      { type: "M", to: verts[0] },
      ...verts.slice(1).map((v) => ({ type: "L" as const, to: v })),
      { type: "Z" },
    ],
  };
}

function derivePoloDims(p: ColorblockPoloParams) {
  const sa = roundMm(p.seamAllowance * 10);
  const backNeckDropMm = roundMm(p.backNeckDrop * 10);
  const frontNeckDropMm = roundMm(p.frontNeckDrop * 10);
  // Total body length measured vertically from HPS (Y=0) to Hem = CB Length + Back Neck Drop
  const bodyLenMm = roundMm(p.cbLength * 10 + backNeckDropMm);
  const halfChest = roundMm((p.chest * 10) / 4); // half of front panel width (full front = chest/2)
  const halfNeck = roundMm((p.neckWidth * 10) / 2);
  const halfShoulder = roundMm((p.shoulder * 10) / 2);
  const shoulderDropMm = roundMm(
    Math.max(16, Math.min(32, (halfShoulder - halfNeck) * 0.17))
  );
  const armholeDepthMm = roundMm(
    Math.min(bodyLenMm * 0.48, Math.max(shoulderDropMm + 115, p.armholeHalf * 10 * 0.855))
  );

  // Diagonal Colorblock Geometry (matches real HAZE026 photo: slopes down Left -> Right across chest)
  const stripeW = roundMm(p.stripeWidth * 10);
  const yLeft1 = roundMm(Math.max(armholeDepthMm + 16, bodyLenMm * 0.345));
  const maxYRight1 = roundMm(bodyLenMm - stripeW * 2.15 - 55);
  const targetYRight1 = roundMm(Math.max(yLeft1 + 52, bodyLenMm * 0.51));
  const yRight1 = roundMm(Math.min(maxYRight1, Math.max(yLeft1 + 28, targetYRight1)));

  const slope = (yRight1 - yLeft1) / Math.max(1, 2 * halfChest);
  const secAlpha = Math.sqrt(1 + slope * slope);
  const dyStripe = roundMm(stripeW * secAlpha);
  const diagAngleRad = Math.atan(slope);

  const yLeft2 = roundMm(yLeft1 + dyStripe);
  const yRight2 = roundMm(yRight1 + dyStripe);
  const yLeft3 = roundMm(yLeft2 + dyStripe);
  const yRight3 = roundMm(yRight2 + dyStripe);

  // Short Set-In Sleeve geometry
  const sleeveLenMm = roundMm(p.sleeveLength * 10);
  const sleeveCapH = roundMm(Math.min(sleeveLenMm * 0.55, Math.max(76, p.armholeHalf * 10 * 0.42)));
  const sleeveHalfOpen = roundMm(p.sleeveOpeningHalf * 10);
  const sleeveHalfBicep = roundMm(
    Math.max(
      sleeveHalfOpen + 14,
      Math.sqrt(Math.max(9000, Math.pow(p.armholeHalf * 10 * 0.92, 2) - sleeveCapH * sleeveCapH))
    )
  );

  const buttonCount = p.chest <= 99 ? 2 : 3; // Real .PLT note: "16 TRO XUONG 2NUT / XS--TRO LEN 3 NUT"
  const placketW = roundMm(p.placketWidth * 10);
  const placketL = roundMm(p.placketLength * 10);
  const collarDepthMm = roundMm(p.collarDepth * 10);
  const collarPointMm = roundMm(Math.max(58, collarDepthMm - 5));

  return {
    sa,
    backNeckDropMm,
    frontNeckDropMm,
    bodyLenMm,
    halfChest,
    halfNeck,
    halfShoulder,
    shoulderDropMm,
    armholeDepthMm,
    stripeW,
    yLeft1,
    yRight1,
    yLeft2,
    yRight2,
    yLeft3,
    yRight3,
    slope,
    secAlpha,
    dyStripe,
    diagAngleRad,
    sleeveLenMm,
    sleeveCapH,
    sleeveHalfOpen,
    sleeveHalfBicep,
    buttonCount,
    placketW,
    placketL,
    collarDepthMm,
    collarPointMm,
  };
}

/**
 * Build either the 4 Diagonal Colorblock Front Pieces (FRT-1 White, FRT-2 Black, FRT-3 Silver, FRT-4 Dark Bottle)
 * OR a single solid Front Piece when `diagonalColorblock === false`.
 */
function buildFrontPieces(
  p: ColorblockPoloParams,
  d: ReturnType<typeof derivePoloDims>,
  options?: PoloGeometryOptions
): PatternPiece[] {
  const sa = d.sa;
  const pHspL = pt(-d.halfNeck, 0);
  const pHspR = pt(d.halfNeck, 0);
  const pShL = pt(-d.halfShoulder, d.shoulderDropMm);
  const pShR = pt(d.halfShoulder, d.shoulderDropMm);
  const pUaL = pt(-d.halfChest, d.armholeDepthMm);
  const pUaR = pt(d.halfChest, d.armholeDepthMm);

  // Smooth symmetrical Front Neckline Bezier (drop = F from HPS)
  const c1FN = pt(roundMm(-d.halfNeck * 0.54), roundMm(d.frontNeckDropMm * 1.12));
  const c2FN = pt(roundMm(d.halfNeck * 0.54), roundMm(d.frontNeckDropMm * 1.12));

  // Smooth symmetrical Front Armholes
  const c1AhR = pt(roundMm(d.halfShoulder - 10), roundMm(d.shoulderDropMm + (d.armholeDepthMm - d.shoulderDropMm) * 0.56));
  const c2AhR = pt(roundMm(d.halfShoulder + (d.halfChest - d.halfShoulder) * 0.42), d.armholeDepthMm);
  const c1AhL = pt(roundMm(-d.halfShoulder - (d.halfChest - d.halfShoulder) * 0.42), d.armholeDepthMm);
  const c2AhL = pt(roundMm(-d.halfShoulder + 10), roundMm(d.shoulderDropMm + (d.armholeDepthMm - d.shoulderDropMm) * 0.56));

  // Placket box & button internal marks on upper chest
  const plkTopY = d.frontNeckDropMm;
  const plkBotY = roundMm(Math.min(d.yLeft1 + (d.yRight1 - d.yLeft1) * 0.5 - 12, plkTopY + d.placketL));
  const halfPlk = roundMm(d.placketW / 2);

  const buildPlacketInternals = (): VectorPath[] => {
    const list: VectorPath[] = [
      {
        id: "frt1-placket-box",
        kind: "internal",
        closed: true,
        label: `Trụ nút Polo ${p.placketWidth}×${p.placketLength} cm (${d.buttonCount} nút)`,
        segments: [
          { type: "M", to: pt(-halfPlk, plkTopY) },
          { type: "L", to: pt(halfPlk, plkTopY) },
          { type: "L", to: pt(halfPlk, plkBotY) },
          { type: "L", to: pt(-halfPlk, plkBotY) },
          { type: "Z" },
        ],
      },
      {
        id: "frt1-cf-axis",
        kind: "fold",
        closed: false,
        segments: [
          { type: "M", to: pt(0, plkTopY) },
          { type: "L", to: pt(0, plkBotY) },
        ],
      },
    ];
    for (let b = 0; b < d.buttonCount; b++) {
      const by = roundMm(plkTopY + 18 + ((plkBotY - plkTopY - 36) * b) / Math.max(1, d.buttonCount - 1));
      list.push({
        id: `frt1-btn-${b}`,
        kind: "internal",
        closed: false,
        segments: [
          { type: "M", to: pt(-4, by) },
          { type: "L", to: pt(4, by) },
        ],
      });
    }
    return list;
  };

  if (!p.diagonalColorblock) {
    // Solid single-piece front polo panel
    const pHemR = pt(d.halfChest, d.bodyLenMm);
    const pHemL = pt(-d.halfChest, d.bodyLenMm);

    const sewPath: VectorPath = {
      id: "frt-solid-sew",
      kind: "sew",
      closed: true,
      segments: [
        { type: "M", to: pHspL },
        { type: "C", cp1: c1FN, cp2: c2FN, to: pHspR },
        { type: "L", to: pShR },
        { type: "C", cp1: c1AhR, cp2: c2AhR, to: pUaR },
        { type: "L", to: pHemR },
        { type: "L", to: pHemL },
        { type: "L", to: pUaL },
        { type: "C", cp1: c1AhL, cp2: c2AhL, to: pShL },
        { type: "Z" },
      ],
    };
    const cutPath: VectorPath = {
      id: "frt-solid-cut",
      kind: "cut",
      closed: true,
      segments: [
        { type: "M", to: pt(pHspL.x, pHspL.y - sa) },
        {
          type: "C",
          cp1: pt(c1FN.x, c1FN.y - sa),
          cp2: pt(c2FN.x, c2FN.y - sa),
          to: pt(pHspR.x, pHspR.y - sa),
        },
        { type: "L", to: pt(pShR.x + sa * 0.8, pShR.y - sa) },
        {
          type: "C",
          cp1: pt(c1AhR.x + sa, c1AhR.y - sa * 0.3),
          cp2: pt(c2AhR.x + sa * 0.5, c2AhR.y - sa),
          to: pt(pUaR.x + sa, pUaR.y - sa),
        },
        { type: "L", to: pt(pHemR.x + sa, pHemR.y + HEM_FOLD_MM) },
        { type: "L", to: pt(pHemL.x - sa, pHemL.y + HEM_FOLD_MM) },
        { type: "L", to: pt(pUaL.x - sa, pUaL.y - sa) },
        {
          type: "C",
          cp1: pt(c1AhL.x - sa * 0.5, c1AhL.y - sa),
          cp2: pt(c2AhL.x - sa, c2AhL.y - sa * 0.3),
          to: pt(pShL.x - sa * 0.8, pShL.y - sa),
        },
        { type: "Z" },
      ],
    };

    const gPts = options?.fixedGrainlines?.["front-solid"] ?? {
      start: pt(0, roundMm(d.armholeDepthMm + 40)),
      end: pt(0, roundMm(d.bodyLenMm - 60)),
    };
    const bbox = computePathsBoundingBox([cutPath]);
    return [
      {
        id: "front-solid",
        code: "FRT-01",
        name: "Thân trước Polo nguyên mảnh",
        englishName: "Solid Front Body",
        cutQuantity: 1,
        cutNote: "Cắt ×1 — Vải chính LA65V Dark Bottle",
        material: "self",
        fabricGroup: "LA65V Dark Bottle",
        displayColor: "#1A3A32",
        sewPaths: [sewPath],
        cutPaths: [cutPath],
        internalPaths: buildPlacketInternals(),
        notches: [
          {
            id: "frts-n-hem",
            point: pt(0, d.bodyLenMm),
            cutPoint: pt(0, d.bodyLenMm + HEM_FOLD_MM),
            angle: -Math.PI / 2,
            depth: 5,
            style: "slit",
            label: "Giữa lai trước (CF Hem)",
          },
        ],
        grainline: { start: gPts.start, end: gPts.end, label: "Canh dọc (CF Grain)" },
        dimensions: [],
        labelAnchor: pt(0, roundMm(d.bodyLenMm * 0.55)),
        keyPoints: [
          { id: "frts-hsp", code: "F-HSP", label: "Đỉnh vai trước", point: pHspR },
          { id: "frts-sh", code: "F-SH", label: "Đầu vai trước", point: pShR },
          { id: "frts-hem", code: "F-HEM", label: "Góc lai trước", point: pHemR },
        ],
        bbox,
        metrics: {
          widthMm: bbox.width,
          heightMm: bbox.height,
          perimeterMm: computePathPerimeter(cutPath),
          sewPerimeterMm: computePathPerimeter(sewPath),
          areaMm2: approxPathAreaMm2(cutPath),
        },
      },
    ];
  }

  // ==================== 4 DIAGONAL COLORBLOCK FRONT PANELS ====================
  // 1. FRT-1: HAZE026-W-FRT1 (Upper Chest — LA65V White)
  const pDiagR1 = pt(d.halfChest, d.yRight1);
  const pDiagL1 = pt(-d.halfChest, d.yLeft1);
  const diagDySa = roundMm(sa * d.secAlpha);
  const pCutDiagR1 = pt(d.halfChest + sa, roundMm(d.yRight1 + d.slope * sa + diagDySa));
  const pCutDiagL1 = pt(-d.halfChest - sa, roundMm(d.yLeft1 - d.slope * sa + diagDySa));

  const frt1Sew: VectorPath = {
    id: "frt1-sew",
    kind: "sew",
    closed: true,
    segments: [
      { type: "M", to: pHspL },
      { type: "C", cp1: c1FN, cp2: c2FN, to: pHspR },
      { type: "L", to: pShR },
      { type: "C", cp1: c1AhR, cp2: c2AhR, to: pUaR },
      { type: "L", to: pDiagR1 },
      { type: "L", to: pDiagL1 },
      { type: "L", to: pUaL },
      { type: "C", cp1: c1AhL, cp2: c2AhL, to: pShL },
      { type: "Z" },
    ],
  };

  const frt1Cut: VectorPath = {
    id: "frt1-cut",
    kind: "cut",
    closed: true,
    segments: [
      { type: "M", to: pt(pHspL.x, pHspL.y - sa) },
      {
        type: "C",
        cp1: pt(c1FN.x, c1FN.y - sa),
        cp2: pt(c2FN.x, c2FN.y - sa),
        to: pt(pHspR.x, pHspR.y - sa),
      },
      { type: "L", to: pt(pShR.x + sa * 0.8, pShR.y - sa) },
      {
        type: "C",
        cp1: pt(c1AhR.x + sa, c1AhR.y - sa * 0.3),
        cp2: pt(c2AhR.x + sa * 0.5, c2AhR.y - sa),
        to: pt(pUaR.x + sa, pUaR.y - sa),
      },
      { type: "L", to: pCutDiagR1 },
      { type: "L", to: pCutDiagL1 },
      { type: "L", to: pt(pUaL.x - sa, pUaL.y - sa) },
      {
        type: "C",
        cp1: pt(c1AhL.x - sa * 0.5, c1AhL.y - sa),
        cp2: pt(c2AhL.x - sa, c2AhL.y - sa * 0.3),
        to: pt(pShL.x - sa * 0.8, pShL.y - sa),
      },
      { type: "Z" },
    ],
  };

  const diagNormalUpAngle = roundMm(-Math.PI / 2 + d.diagAngleRad);
  const diagNormalDownAngle = roundMm(Math.PI / 2 + d.diagAngleRad);
  const midY1 = roundMm((d.yLeft1 + d.yRight1) / 2);

  const frt1Notches: Notch[] = [-0.5, 0, 0.5].map((r, i) => {
    const nx = roundMm(r * d.halfChest);
    const ny = roundMm(midY1 + d.slope * nx);
    return {
      id: `frt1-dn-${i}`,
      point: pt(nx, ny),
      cutPoint: pt(nx - sa * Math.sin(d.diagAngleRad), ny + sa * Math.cos(d.diagAngleRad)),
      angle: diagNormalUpAngle,
      depth: 5,
      style: "slit",
      label: i === 1 ? "Khớp chéo giữa (W↔B)" : "Khớp chéo (W↔B)",
    };
  });

  const g1 = options?.fixedGrainlines?.["front-1-white"] ?? {
    start: pt(roundMm(d.halfChest * 0.45), roundMm(d.armholeDepthMm - 25)),
    end: pt(roundMm(d.halfChest * 0.45), roundMm(midY1 - 22)),
  };
  const frt1Bbox = computePathsBoundingBox([frt1Cut]);
  const frt1Piece: PatternPiece = {
    id: "front-1-white",
    code: "W-FRT1",
    name: "Thân trước trên — Phối Trắng",
    englishName: "HAZE026-W-FRT1 (Upper Front — White)",
    cutQuantity: 1,
    cutNote: "Cắt ×1 — Vải phối 1: LA65V White (Khổ 161 cm)",
    material: "self",
    fabricGroup: "LA65V White",
    displayColor: "#E2E8F0",
    sewPaths: [frt1Sew],
    cutPaths: [frt1Cut],
    internalPaths: buildPlacketInternals(),
    notches: frt1Notches,
    grainline: { start: g1.start, end: g1.end, label: "Canh dọc (W-FRT1)" },
    dimensions: [
      {
        id: "frt1-dim-w",
        from: pUaL,
        to: pUaR,
        label: `1/2 Ngực ${roundCm((d.halfChest * 2) / 10, 1)} cm`,
        kind: "linear",
        offsetMm: -16,
      },
    ],
    labelAnchor: pt(roundMm(d.halfChest * 0.42), roundMm(d.armholeDepthMm * 0.65)),
    keyPoints: [
      { id: "frt1-hsp", code: "W-HSP", label: "Đỉnh vai trước (HPS)", point: pHspR },
      { id: "frt1-sh", code: "W-SH", label: "Đầu vai trước (Shoulder)", point: pShR },
      { id: "frt1-dr", code: "W-DR", label: "Đầu đường chéo phải", point: pDiagR1 },
    ],
    bbox: frt1Bbox,
    metrics: {
      widthMm: frt1Bbox.width,
      heightMm: frt1Bbox.height,
      perimeterMm: computePathPerimeter(frt1Cut),
      sewPerimeterMm: computePathPerimeter(frt1Sew),
      areaMm2: approxPathAreaMm2(frt1Cut),
    },
  };

  // Helper for diagonal stripe parallelogram (FRT-2 Black & FRT-3 Silver)
  const buildDiagonalStripePiece = (cfg: {
    id: string;
    code: string;
    name: string;
    englishName: string;
    cutNote: string;
    fabricGroup: string;
    displayColor: string;
    yTopL: number;
    yTopR: number;
    yBotL: number;
    yBotR: number;
    shiftY: number;
  }): PatternPiece => {
    const sy = cfg.shiftY;
    const sewVerts: Point2D[] = [
      pt(-d.halfChest, cfg.yTopL + sy),
      pt(d.halfChest, cfg.yTopR + sy),
      pt(d.halfChest, cfg.yBotR + sy),
      pt(-d.halfChest, cfg.yBotL + sy),
    ];
    const cutVerts = offsetClosedPolygon(sewVerts, [sa, sa, sa, sa]);
    const sewPath = polygonToPath(`${cfg.id}-sew`, "sew", sewVerts);
    const cutPath = polygonToPath(`${cfg.id}-cut`, "cut", cutVerts);

    const midTopY = roundMm((cfg.yTopL + cfg.yTopR) / 2 + sy);
    const midBotY = roundMm((cfg.yBotL + cfg.yBotR) / 2 + sy);
    const notches: Notch[] = [
      {
        id: `${cfg.id}-nt`,
        point: pt(0, midTopY),
        cutPoint: pt(sa * Math.sin(d.diagAngleRad), midTopY - sa * Math.cos(d.diagAngleRad)),
        angle: diagNormalDownAngle,
        depth: 5,
        style: "slit",
        label: "Khớp chéo trên",
      },
      {
        id: `${cfg.id}-nb`,
        point: pt(0, midBotY),
        cutPoint: pt(-sa * Math.sin(d.diagAngleRad), midBotY + sa * Math.cos(d.diagAngleRad)),
        angle: diagNormalUpAngle,
        depth: 5,
        style: "slit",
        label: "Khớp chéo dưới",
      },
    ];

    const defaultGrain = {
      start: pt(-d.halfChest * 0.35, roundMm(midTopY + d.dyStripe * 0.2)),
      end: pt(-d.halfChest * 0.35, roundMm(midTopY + d.dyStripe * 0.85)),
    };
    const gPts = options?.fixedGrainlines?.[cfg.id] ?? defaultGrain;
    const bbox = computePathsBoundingBox([cutPath]);
    return {
      id: cfg.id,
      code: cfg.code,
      name: cfg.name,
      englishName: cfg.englishName,
      cutQuantity: 1,
      cutNote: cfg.cutNote,
      material: "self",
      fabricGroup: cfg.fabricGroup,
      displayColor: cfg.displayColor,
      sewPaths: [sewPath],
      cutPaths: [cutPath],
      internalPaths: [],
      notches,
      grainline: { start: gPts.start, end: gPts.end, label: `Canh dọc (${cfg.code})` },
      dimensions: [
        {
          id: `${cfg.id}-dim-h`,
          from: sewVerts[1],
          to: sewVerts[2],
          label: `Sọc ${p.stripeWidth} cm`,
          kind: "linear",
          offsetMm: 18,
        },
      ],
      labelAnchor: pt(0, roundMm((midTopY + midBotY) / 2)),
      keyPoints: [
        { id: `${cfg.id}-tl`, code: `${cfg.code}-L`, label: "Đầu trái dải chéo", point: sewVerts[0] },
        { id: `${cfg.id}-tr`, code: `${cfg.code}-R`, label: "Đầu phải dải chéo", point: sewVerts[1] },
      ],
      bbox,
      metrics: {
        widthMm: bbox.width,
        heightMm: bbox.height,
        perimeterMm: computePathPerimeter(cutPath),
        sewPerimeterMm: computePathPerimeter(sewPath),
        areaMm2: approxPathAreaMm2(cutPath),
      },
    };
  };

  // 2. FRT-2: HAZE026-B-FRT2 (Upper Diagonal Stripe — LA65V Black)
  const frt2Piece = buildDiagonalStripePiece({
    id: "front-2-black",
    code: "B-FRT2",
    name: "Dải phối chéo Đen",
    englishName: "HAZE026-B-FRT2 (Diagonal Band — Black)",
    cutNote: "Cắt ×1 — Vải phối 2: LA65V Black (Khổ 80.5 cm)",
    fabricGroup: "LA65V Black",
    displayColor: "#18181B",
    yTopL: d.yLeft1,
    yTopR: d.yRight1,
    yBotL: d.yLeft2,
    yBotR: d.yRight2,
    shiftY: PANEL_EXPLODE_GAP_MM,
  });

  // 3. FRT-3: HAZE026-C-FRT3 (Lower Diagonal Stripe — JC50 Silver 1102)
  const frt3Piece = buildDiagonalStripePiece({
    id: "front-3-silver",
    code: "C-FRT3",
    name: "Dải viền chéo Bạc",
    englishName: "HAZE026-C-FRT3 (Diagonal Trim — Silver 1102)",
    cutNote: "Cắt ×1 — Vải viền: JC50 Silver 1102 (Khổ 80.5 cm)",
    fabricGroup: "JC50 Silver 1102",
    displayColor: "#94A3B8",
    yTopL: d.yLeft2,
    yTopR: d.yRight2,
    yBotL: d.yLeft3,
    yBotR: d.yRight3,
    shiftY: PANEL_EXPLODE_GAP_MM * 2,
  });

  // 4. FRT-4: HAZE026-S-FRT4 (Lower Front Body — LA65V Dark Bottle)
  const sy4 = PANEL_EXPLODE_GAP_MM * 3;
  const frt4SewVerts: Point2D[] = [
    pt(-d.halfChest, d.yLeft3 + sy4),
    pt(d.halfChest, d.yRight3 + sy4),
    pt(d.halfChest, d.bodyLenMm + sy4),
    pt(-d.halfChest, d.bodyLenMm + sy4),
  ];
  // Top diagonal = sa, Right side = sa, Bottom hem = HEM_FOLD_MM (25 mm), Left side = sa
  const frt4CutVerts = offsetClosedPolygon(frt4SewVerts, [sa, sa, HEM_FOLD_MM, sa]);
  const frt4Sew = polygonToPath("frt4-sew", "sew", frt4SewVerts);
  const frt4Cut = polygonToPath("frt4-cut", "cut", frt4CutVerts);
  const midTopY4 = roundMm((d.yLeft3 + d.yRight3) / 2 + sy4);

  const g4 = options?.fixedGrainlines?.["front-4-bottle"] ?? {
    start: pt(0, roundMm(midTopY4 + 32)),
    end: pt(0, roundMm(d.bodyLenMm + sy4 - 38)),
  };
  const frt4Bbox = computePathsBoundingBox([frt4Cut]);
  const frt4Piece: PatternPiece = {
    id: "front-4-bottle",
    code: "S-FRT4",
    name: "Thân trước dưới — Xanh Đậm",
    englishName: "HAZE026-S-FRT4 (Lower Front — Dark Bottle)",
    cutQuantity: 1,
    cutNote: "Cắt ×1 — Vải chính: LA65V Dark Bottle (Khổ 161 cm, Lai 2.5 cm)",
    material: "self",
    fabricGroup: "LA65V Dark Bottle",
    displayColor: "#1A3A32",
    sewPaths: [frt4Sew],
    cutPaths: [frt4Cut],
    internalPaths: [
      {
        id: "frt4-hem-line",
        kind: "fold",
        closed: false,
        label: "Đường gập lai 2.5 cm (Coverstitch Hem)",
        segments: [
          { type: "M", to: frt4SewVerts[3] },
          { type: "L", to: frt4SewVerts[2] },
        ],
      },
    ],
    notches: [
      {
        id: "frt4-nt",
        point: pt(0, midTopY4),
        cutPoint: pt(sa * Math.sin(d.diagAngleRad), midTopY4 - sa * Math.cos(d.diagAngleRad)),
        angle: diagNormalDownAngle,
        depth: 5,
        style: "slit",
        label: "Khớp chéo giữa (C↔S)",
      },
      {
        id: "frt4-nh",
        point: pt(0, d.bodyLenMm + sy4),
        cutPoint: pt(0, d.bodyLenMm + sy4 + HEM_FOLD_MM),
        angle: -Math.PI / 2,
        depth: 5,
        style: "slit",
        label: "Giữa lai trước (CF Hem)",
      },
    ],
    grainline: { start: g4.start, end: g4.end, label: "Canh dọc (S-FRT4)" },
    dimensions: [
      {
        id: "frt4-dim-hem",
        from: frt4SewVerts[3],
        to: frt4SewVerts[2],
        label: `1/2 Lai ${roundCm((d.halfChest * 2) / 10, 1)} cm`,
        kind: "linear",
        offsetMm: 36,
      },
    ],
    labelAnchor: pt(0, roundMm((midTopY4 + d.bodyLenMm + sy4) / 2)),
    keyPoints: [
      { id: "frt4-tr", code: "S4-TR", label: "Đầu chéo thân dưới", point: frt4SewVerts[1] },
      { id: "frt4-br", code: "S4-HEM", label: "Góc lai thân dưới", point: frt4SewVerts[2] },
    ],
    bbox: frt4Bbox,
    metrics: {
      widthMm: frt4Bbox.width,
      heightMm: frt4Bbox.height,
      perimeterMm: computePathPerimeter(frt4Cut),
      sewPerimeterMm: computePathPerimeter(frt4Sew),
      areaMm2: approxPathAreaMm2(frt4Cut),
    },
  };

  return [frt1Piece, frt2Piece, frt3Piece, frt4Piece];
}

/**
 * PIECE 5: BCK-01 — THÂN SAU POLO (HAZE026-S-BK — Dark Bottle, Cut ×1)
 */
function buildBackBody(
  d: ReturnType<typeof derivePoloDims>,
  centerX: number,
  options?: PoloGeometryOptions
): PatternPiece {
  const cx = roundMm(centerX);
  const sa = d.sa;
  const pHspL = pt(cx - d.halfNeck, 0);
  const pHspR = pt(cx + d.halfNeck, 0);
  const pShL = pt(cx - d.halfShoulder, d.shoulderDropMm);
  const pShR = pt(cx + d.halfShoulder, d.shoulderDropMm);
  const pUaL = pt(cx - d.halfChest, d.armholeDepthMm);
  const pUaR = pt(cx + d.halfChest, d.armholeDepthMm);
  const pHemL = pt(cx - d.halfChest, d.bodyLenMm);
  const pHemR = pt(cx + d.halfChest, d.bodyLenMm);

  const c1BN = pt(roundMm(cx - d.halfNeck * 0.48), d.backNeckDropMm);
  const c2BN = pt(roundMm(cx + d.halfNeck * 0.48), d.backNeckDropMm);

  const c1AhR = pt(roundMm(cx + d.halfShoulder - 4), roundMm(d.shoulderDropMm + (d.armholeDepthMm - d.shoulderDropMm) * 0.55));
  const c2AhR = pt(roundMm(cx + d.halfShoulder + (d.halfChest - d.halfShoulder) * 0.46), d.armholeDepthMm);
  const c1AhL = pt(roundMm(cx - d.halfShoulder - (d.halfChest - d.halfShoulder) * 0.46), d.armholeDepthMm);
  const c2AhL = pt(roundMm(cx - d.halfShoulder + 4), roundMm(d.shoulderDropMm + (d.armholeDepthMm - d.shoulderDropMm) * 0.55));

  const sewPath: VectorPath = {
    id: "polo-bck-sew",
    kind: "sew",
    closed: true,
    segments: [
      { type: "M", to: pHspL },
      { type: "C", cp1: c1BN, cp2: c2BN, to: pHspR },
      { type: "L", to: pShR },
      { type: "C", cp1: c1AhR, cp2: c2AhR, to: pUaR },
      { type: "L", to: pHemR },
      { type: "L", to: pHemL },
      { type: "L", to: pUaL },
      { type: "C", cp1: c1AhL, cp2: c2AhL, to: pShL },
      { type: "Z" },
    ],
  };

  const cutPath: VectorPath = {
    id: "polo-bck-cut",
    kind: "cut",
    closed: true,
    segments: [
      { type: "M", to: pt(pHspL.x, pHspL.y - sa) },
      {
        type: "C",
        cp1: pt(c1BN.x, c1BN.y - sa),
        cp2: pt(c2BN.x, c2BN.y - sa),
        to: pt(pHspR.x, pHspR.y - sa),
      },
      { type: "L", to: pt(pShR.x + sa * 0.8, pShR.y - sa) },
      {
        type: "C",
        cp1: pt(c1AhR.x + sa, c1AhR.y - sa * 0.3),
        cp2: pt(c2AhR.x + sa * 0.5, c2AhR.y - sa),
        to: pt(pUaR.x + sa, pUaR.y - sa),
      },
      { type: "L", to: pt(pHemR.x + sa, pHemR.y + HEM_FOLD_MM) },
      { type: "L", to: pt(pHemL.x - sa, pHemL.y + HEM_FOLD_MM) },
      { type: "L", to: pt(pUaL.x - sa, pUaL.y - sa) },
      {
        type: "C",
        cp1: pt(c1AhL.x - sa * 0.5, c1AhL.y - sa),
        cp2: pt(c2AhL.x - sa, c2AhL.y - sa * 0.3),
        to: pt(pShL.x - sa * 0.8, pShL.y - sa),
      },
      { type: "Z" },
    ],
  };

  const gPts = options?.fixedGrainlines?.["back-body"] ?? {
    start: pt(cx, roundMm(d.armholeDepthMm - 15)),
    end: pt(cx, roundMm(d.bodyLenMm - 60)),
  };
  const bbox = computePathsBoundingBox([cutPath]);
  return {
    id: "back-body",
    code: "S-BK",
    name: "Thân sau nguyên mảnh",
    englishName: "HAZE026-S-BK (Back Body — Dark Bottle)",
    cutQuantity: 1,
    cutNote: "Cắt ×1 — Vải chính: LA65V Dark Bottle (Lai 2.5 cm)",
    material: "self",
    fabricGroup: "LA65V Dark Bottle",
    displayColor: "#1A3A32",
    sewPaths: [sewPath],
    cutPaths: [cutPath],
    internalPaths: [
      {
        id: "polo-bck-cb",
        kind: "fold",
        closed: false,
        label: "Trục giữa sống lưng (Center Back)",
        segments: [
          { type: "M", to: pt(cx, d.backNeckDropMm) },
          { type: "L", to: pt(cx, d.bodyLenMm) },
        ],
      },
    ],
    notches: [
      {
        id: "pbck-n-cb",
        point: pt(cx, d.backNeckDropMm),
        cutPoint: pt(cx, d.backNeckDropMm - sa),
        angle: Math.PI / 2,
        depth: 5,
        style: "slit",
        label: "Giữa cổ sau (CB Neck)",
      },
      {
        id: "pbck-n-hem",
        point: pt(cx, d.bodyLenMm),
        cutPoint: pt(cx, d.bodyLenMm + HEM_FOLD_MM),
        angle: -Math.PI / 2,
        depth: 5,
        style: "slit",
        label: "Giữa lai sau (CB Hem)",
      },
    ],
    grainline: { start: gPts.start, end: gPts.end, label: "Canh dọc (S-BK)" },
    dimensions: [
      {
        id: "pbck-dim-len",
        from: pt(cx, d.backNeckDropMm),
        to: pt(cx, d.bodyLenMm),
        label: `Dài CB ${roundCm((d.bodyLenMm - d.backNeckDropMm) / 10, 1)} cm`,
        kind: "linear",
        offsetMm: 24,
      },
    ],
    labelAnchor: pt(cx, roundMm(d.bodyLenMm * 0.48)),
    keyPoints: [
      { id: "pbck-hsp", code: "BK-HSP", label: "Đỉnh vai sau", point: pHspR },
      { id: "pbck-sh", code: "BK-SH", label: "Đầu vai sau", point: pShR },
      { id: "pbck-ua", code: "BK-UA", label: "Hạ nách sau", point: pUaR },
      { id: "pbck-hem", code: "BK-HEM", label: "Góc lai sau", point: pHemR },
    ],
    bbox,
    metrics: {
      widthMm: bbox.width,
      heightMm: bbox.height,
      perimeterMm: computePathPerimeter(cutPath),
      sewPerimeterMm: computePathPerimeter(sewPath),
      areaMm2: approxPathAreaMm2(cutPath),
    },
  };
}

/**
 * PIECE 6: SLV-01 — TAY NGẮN POLO (HAZE026-S-SLV — Dark Bottle, Cut ×2)
 */
function buildShortSleeve(
  p: ColorblockPoloParams,
  d: ReturnType<typeof derivePoloDims>,
  centerX: number,
  options?: PoloGeometryOptions
): PatternPiece {
  const cx = roundMm(centerX);
  const sa = d.sa;
  const pCapTop = pt(cx, 0);
  const pUnderL = pt(cx - d.sleeveHalfBicep, d.sleeveCapH);
  const pUnderR = pt(cx + d.sleeveHalfBicep, d.sleeveCapH);
  const pOpenL = pt(cx - d.sleeveHalfOpen, d.sleeveLenMm);
  const pOpenR = pt(cx + d.sleeveHalfOpen, d.sleeveLenMm);

  const c1CapR = pt(roundMm(cx + d.sleeveHalfBicep * 0.44), 0);
  const c2CapR = pt(roundMm(cx + d.sleeveHalfBicep * 0.68), d.sleeveCapH);
  const c1CapL = pt(roundMm(cx - d.sleeveHalfBicep * 0.72), roundMm(d.sleeveCapH + 3));
  const c2CapL = pt(roundMm(cx - d.sleeveHalfBicep * 0.38), 0);

  const sewPath: VectorPath = {
    id: "polo-slv-sew",
    kind: "sew",
    closed: true,
    segments: [
      { type: "M", to: pCapTop },
      { type: "C", cp1: c1CapR, cp2: c2CapR, to: pUnderR },
      { type: "L", to: pOpenR },
      { type: "L", to: pOpenL },
      { type: "L", to: pUnderL },
      { type: "C", cp1: c1CapL, cp2: c2CapL, to: pCapTop },
      { type: "Z" },
    ],
  };

  const cutPath: VectorPath = {
    id: "polo-slv-cut",
    kind: "cut",
    closed: true,
    segments: [
      { type: "M", to: pt(pCapTop.x, pCapTop.y - sa) },
      {
        type: "C",
        cp1: pt(c1CapR.x + sa * 0.4, c1CapR.y - sa),
        cp2: pt(c2CapR.x + sa, c2CapR.y - sa * 0.5),
        to: pt(pUnderR.x + sa, pUnderR.y - sa * 0.4),
      },
      { type: "L", to: pt(pOpenR.x + sa, pOpenR.y + HEM_FOLD_MM) },
      { type: "L", to: pt(pOpenL.x - sa, pOpenL.y + HEM_FOLD_MM) },
      { type: "L", to: pt(pUnderL.x - sa, pUnderL.y - sa * 0.4) },
      {
        type: "C",
        cp1: pt(c1CapL.x - sa, c1CapL.y - sa * 0.5),
        cp2: pt(c2CapL.x - sa * 0.4, c2CapL.y - sa),
        to: pt(pCapTop.x, pCapTop.y - sa),
      },
      { type: "Z" },
    ],
  };

  const gPts = options?.fixedGrainlines?.["short-sleeve"] ?? {
    start: pt(cx, roundMm(d.sleeveCapH * 0.55)),
    end: pt(cx, roundMm(d.sleeveLenMm - 25)),
  };
  const bbox = computePathsBoundingBox([cutPath]);
  return {
    id: "short-sleeve",
    code: "S-SLV",
    name: "Tay ngắn Polo",
    englishName: "HAZE026-S-SLV (Short Sleeve — Dark Bottle)",
    cutQuantity: 2,
    cutNote: "Cắt ×2 đối xứng — Vải chính LA65V Dark Bottle (Lai tay 2.5 cm)",
    material: "self",
    fabricGroup: "LA65V Dark Bottle",
    displayColor: "#1A3A32",
    sewPaths: [sewPath],
    cutPaths: [cutPath],
    internalPaths: [
      {
        id: "pslv-bicep",
        kind: "internal",
        closed: false,
        segments: [
          { type: "M", to: pUnderL },
          { type: "L", to: pUnderR },
        ],
      },
    ],
    notches: [
      {
        id: "pslv-crown",
        point: pCapTop,
        cutPoint: pt(pCapTop.x, pCapTop.y - sa),
        angle: Math.PI / 2,
        depth: 5,
        style: "slit",
        label: "Đỉnh đầu tay",
      },
      {
        id: "pslv-frt",
        point: pt(roundMm(cx - d.sleeveHalfBicep * 0.56), roundMm(d.sleeveCapH * 0.52)),
        cutPoint: pt(roundMm(cx - d.sleeveHalfBicep * 0.56 - sa), roundMm(d.sleeveCapH * 0.52 - sa * 0.5)),
        angle: Math.PI * 0.25,
        depth: 5,
        style: "slit",
        label: "Mang trước (1 bấm)",
      },
    ],
    grainline: { start: gPts.start, end: gPts.end, label: "Canh dọc tay" },
    dimensions: [
      {
        id: "pslv-dim-len",
        from: pCapTop,
        to: pt(cx, d.sleeveLenMm),
        label: `Dài tay ${p.sleeveLength} cm`,
        kind: "linear",
        offsetMm: 20,
      },
    ],
    labelAnchor: pt(cx, roundMm(d.sleeveLenMm * 0.58)),
    keyPoints: [
      { id: "pslv-top", code: "SL-CAP", label: "Đỉnh mang tay", point: pCapTop },
      { id: "pslv-open", code: "SL-OPN", label: "Cửa tay ngắn", point: pOpenR },
    ],
    bbox,
    metrics: {
      widthMm: bbox.width,
      heightMm: bbox.height,
      perimeterMm: computePathPerimeter(cutPath),
      sewPerimeterMm: computePathPerimeter(sewPath),
      areaMm2: approxPathAreaMm2(cutPath),
    },
  };
}

/**
 * PIECE 7: PLK-01 — NẸP TRỤ POLO (HAZE026-SF-PL — Cut ×2 + Keo HAZE026-KEO)
 */
function buildPlacket(
  p: ColorblockPoloParams,
  d: ReturnType<typeof derivePoloDims>,
  centerX: number,
  originY: number,
  options?: PoloGeometryOptions
): PatternPiece {
  const sa = d.sa;
  const w = roundMm(d.placketW * 2); // Unfolded width = 2 × 3.0 cm = 6.0 cm
  const h = roundMm(d.placketL + 25); // +2.5 cm bottom underlap tuck
  const ox = roundMm(centerX - w / 2);
  const oy = roundMm(originY);

  const sewVerts = [
    pt(ox, oy),
    pt(ox + w, oy),
    pt(ox + w, oy + h),
    pt(ox, oy + h),
  ];
  const cutVerts = offsetClosedPolygon(sewVerts, [sa, sa, sa, sa]);
  const sewPath = polygonToPath("plk-sew", "sew", sewVerts);
  const cutPath = polygonToPath("plk-cut", "cut", cutVerts);

  const gPts = options?.fixedGrainlines?.["placket"] ?? {
    start: pt(ox + w * 0.5, oy + 25),
    end: pt(ox + w * 0.5, oy + h - 25),
  };
  const bbox = computePathsBoundingBox([cutPath]);
  return {
    id: "placket",
    code: "SF-PL",
    name: `Nẹp trụ cổ (${d.buttonCount} nút + Keo)`,
    englishName: "HAZE026-SF-PL (Front Placket & Interfacing)",
    cutQuantity: 2,
    cutNote: `Cắt ×2 vải LA65V Dark Bottle + ×2 Keo HAZE026-KEO (${p.placketWidth}×${p.placketLength} cm)`,
    material: "self",
    fabricGroup: "LA65V Dark Bottle + Keo",
    displayColor: "#1A3A32",
    sewPaths: [sewPath],
    cutPaths: [cutPath],
    internalPaths: [
      {
        id: "plk-fold",
        kind: "fold",
        closed: false,
        label: "Đường gập đôi trụ nút",
        segments: [
          { type: "M", to: pt(ox + w / 2, oy) },
          { type: "L", to: pt(ox + w / 2, oy + h) },
        ],
      },
    ],
    notches: [
      {
        id: "plk-n-top",
        point: pt(ox + w / 2, oy),
        cutPoint: pt(ox + w / 2, oy - sa),
        angle: Math.PI / 2,
        depth: 5,
        style: "slit",
        label: "Gập đôi trụ",
      },
    ],
    grainline: { start: gPts.start, end: gPts.end, label: "Canh dọc trụ" },
    dimensions: [
      {
        id: "plk-dim-h",
        from: sewVerts[1],
        to: sewVerts[2],
        label: `${roundCm(h / 10, 1)} cm`,
        kind: "linear",
        offsetMm: 16,
      },
    ],
    labelAnchor: pt(ox + w / 2, oy + h / 2),
    keyPoints: [
      { id: "plk-tr", code: "PL-TR", label: "Đầu trên trụ", point: sewVerts[1] },
      { id: "plk-br", code: "PL-BR", label: "Chân trụ", point: sewVerts[2] },
    ],
    bbox,
    metrics: {
      widthMm: bbox.width,
      heightMm: bbox.height,
      perimeterMm: computePathPerimeter(cutPath),
      sewPerimeterMm: computePathPerimeter(sewPath),
      areaMm2: approxPathAreaMm2(cutPath),
    },
  };
}

/**
 * PIECE 8: CLR-01 — LÁ CỔ DỆT POLO (Flat-Knit Collar — Cut ×1)
 */
function buildPoloCollar(
  p: ColorblockPoloParams,
  d: ReturnType<typeof derivePoloDims>,
  centerX: number,
  originY: number,
  neckCircMm: number,
  options?: PoloGeometryOptions
): PatternPiece {
  const sa = d.sa;
  const collarLen = roundMm(neckCircMm * 0.94); // 94% relaxed flat-knit collar
  const halfL = roundMm(collarLen / 2);
  const cx = roundMm(centerX);
  const oy = roundMm(originY);
  const hCB = d.collarDepthMm;
  const hTip = d.collarPointMm;
  const tipFlare = 8; // Subtle classic polo collar point flare

  const sewVerts: Point2D[] = [
    pt(cx - halfL, oy),
    pt(cx + halfL, oy),
    pt(cx + halfL + tipFlare, oy + hTip),
    pt(cx, oy + hCB),
    pt(cx - halfL - tipFlare, oy + hTip),
  ];
  // Top neck attach edge gets `sa`; finished knit outer collar edges have 0 (or clean 4mm knit trim)
  const cutVerts = offsetClosedPolygon(sewVerts, [sa, 4, 4, 4, 4]);
  const sewPath = polygonToPath("pclr-sew", "sew", sewVerts);
  const cutPath = polygonToPath("pclr-cut", "cut", cutVerts);

  const gPts = options?.fixedGrainlines?.["polo-collar"] ?? {
    start: pt(cx - halfL * 0.55, oy + hCB * 0.5),
    end: pt(cx + halfL * 0.55, oy + hCB * 0.5),
  };
  const bbox = computePathsBoundingBox([cutPath]);
  return {
    id: "polo-collar",
    code: "CLR-01",
    name: `Lá cổ dệt Polo (${p.collarDepth} cm)`,
    englishName: "Flat-Knit Polo Collar (Dark Bottle)",
    cutQuantity: 1,
    cutNote: `Dệt bo lá cổ ×1 — Dài ${roundCm(collarLen / 10, 1)} cm • Bản CB ${p.collarDepth} cm / Đầu lá ${roundCm(hTip / 10, 1)} cm`,
    material: "interfacing",
    fabricGroup: "Flat-Knit Dark Bottle",
    displayColor: "#14532D",
    sewPaths: [sewPath],
    cutPaths: [cutPath],
    internalPaths: [],
    notches: [
      {
        id: "pclr-n-cb",
        point: pt(cx, oy),
        cutPoint: pt(cx, oy - sa),
        angle: Math.PI / 2,
        depth: 5,
        style: "slit",
        label: "Giữa cổ sau (CB Collar)",
      },
    ],
    grainline: { start: gPts.start, end: gPts.end, label: "Canh ngang bo cổ" },
    dimensions: [
      {
        id: "pclr-dim-len",
        from: sewVerts[0],
        to: sewVerts[1],
        label: `Cổ ${roundCm(collarLen / 10, 1)} cm`,
        kind: "linear",
        offsetMm: -16,
      },
    ],
    labelAnchor: pt(cx, oy + hCB * 0.52),
    keyPoints: [
      { id: "pclr-r", code: "CL-R", label: "Đầu cổ phải", point: sewVerts[1] },
      { id: "pclr-cb", code: "CL-CB", label: "Giữa lá cổ CB", point: sewVerts[3] },
    ],
    bbox,
    metrics: {
      widthMm: bbox.width,
      heightMm: bbox.height,
      perimeterMm: computePathPerimeter(cutPath),
      sewPerimeterMm: computePathPerimeter(sewPath),
      areaMm2: approxPathAreaMm2(cutPath),
    },
  };
}

export function generateColorblockPoloGeometry(
  rawParams: ParamValues,
  options?: Record<string, unknown>
): PatternGeometryResult {
  const p = parseColorblockPoloParams(rawParams);
  const opts = (options ?? {}) as PoloGeometryOptions;
  const d = derivePoloDims(p);

  const backCenterX = opts.backCenterX ?? roundMm(d.halfChest * 2 + 130);
  const sleeveCenterX =
    opts.sleeveCenterX ?? roundMm(backCenterX + d.halfChest + d.sleeveHalfBicep + 130);
  const auxColStartY = opts.auxColStartY ?? roundMm(d.sleeveLenMm + 115);

  const frontPieces = buildFrontPieces(p, d, opts);
  const backPiece = buildBackBody(d, backCenterX, opts);
  const sleevePiece = buildShortSleeve(p, d, sleeveCenterX, opts);

  const frontNeckCurve = Math.hypot(d.halfNeck, d.frontNeckDropMm) * 1.15;
  const backNeckCurve = Math.hypot(d.halfNeck, d.backNeckDropMm) * 1.04;
  const neckCircMm = roundMm(2 * (frontNeckCurve + backNeckCurve));

  const placketPiece = buildPlacket(p, d, sleeveCenterX, auxColStartY, opts);
  const collarPiece = buildPoloCollar(
    p,
    d,
    sleeveCenterX,
    roundMm(auxColStartY + d.placketL + 115),
    neckCircMm,
    opts
  );

  const pieces: PatternPiece[] = [
    ...frontPieces,
    backPiece,
    sleevePiece,
    placketPiece,
    collarPiece,
  ];

  const bbox = mergeBoundingBoxes(pieces.map((pc) => pc.bbox));
  const totalCutPieces = pieces.reduce((acc, pc) => acc + pc.cutQuantity, 0);
  const totalAreaMm2 = pieces.reduce(
    (acc, pc) => acc + pc.metrics.areaMm2 * pc.cutQuantity,
    0
  );

  const diagSeamLenMm = roundMm(Math.hypot(d.halfChest * 2, d.yRight1 - d.yLeft1));

  const formulas: FormulaItem[] = [
    {
      id: "polo-half-chest",
      symbol: "W_thân",
      label: "Bề rộng 1/2 thân áo thành phẩm (Chest / 2)",
      expression: "C / 2",
      substitution: `${p.chest} / 2`,
      valueCm: roundCm((d.halfChest * 2) / 10, 2),
      valueMm: roundMm(d.halfChest * 2),
    },
    {
      id: "polo-body-hps",
      symbol: "L_HPS",
      label: "Dài thân từ đỉnh vai HPS (B + G)",
      expression: "CB_Length + BackDrop",
      substitution: `${p.cbLength} + ${p.backNeckDrop}`,
      valueCm: roundCm(d.bodyLenMm / 10, 2),
      valueMm: d.bodyLenMm,
    },
    {
      id: "polo-diag-len",
      symbol: "L_chéo",
      label: "Chiều dài đường cắt phối chéo (W↔B↔C↔S)",
      expression: "√(W_thân² + ΔY²)",
      substitution: `√(${roundCm((d.halfChest * 2) / 10, 1)}² + ${roundCm((d.yRight1 - d.yLeft1) / 10, 1)}²)`,
      valueCm: roundCm(diagSeamLenMm / 10, 2),
      valueMm: diagSeamLenMm,
    },
    {
      id: "polo-collar-len",
      symbol: "L_cổ",
      label: "Chiều dài lá cổ dệt phẳng (94% vòng cổ)",
      expression: "NeckCirc × 0.94",
      substitution: `${roundCm(neckCircMm / 10, 1)} × 0.94`,
      valueCm: roundCm((neckCircMm * 0.94) / 10, 2),
      valueMm: roundMm(neckCircMm * 0.94),
    },
    {
      id: "polo-buttons",
      symbol: "Nút_trụ",
      label: "Quy cách nút trụ chuẩn sơ đồ .PLT HAZE026",
      expression: "Chest ≤ 99 → 2 nút | > 99 → 3 nút",
      substitution: `Ngực ${p.chest} cm`,
      valueCm: d.buttonCount,
      valueMm: d.buttonCount,
      displayValue: `${d.buttonCount} nút (${p.placketWidth}×${p.placketLength} cm)`,
    },
  ];

  const warnings: string[] = [];
  if (p.diagonalColorblock) {
    warnings.push(
      "Đơn hàng phối 4 mã màu vải riêng (LA65V Dark Bottle khổ 161 cm • LA65V White khổ 161 cm • LA65V Black & JC50 Silver khổ 80.5 cm). Tách bàn cắt theo từng mã màu khi giác sơ đồ sản xuất."
    );
  }

  return {
    pieces,
    formulas,
    warnings,
    bbox,
    summary: {
      totalCutPieces,
      estimatedFabricWidthCm: 161, // Actual HAZE026 marker fabric width from .PLT / Excel!
      estimatedFabricLengthCm: roundCm((totalAreaMm2 / 1_000_000 / 1.56) * 115, 1),
      totalAreaM2: roundCm(totalAreaMm2 / 1_000_000, 3),
      metadata: {
        styleCode: "HAZE026-028",
        chestCm: p.chest,
        cbLengthCm: p.cbLength,
        buttonCount: d.buttonCount,
      },
    },
  };
}
