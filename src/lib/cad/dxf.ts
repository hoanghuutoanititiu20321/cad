import {
  evalCubicBezier,
  polarPoint,
  roundMm,
} from "./math";
import type {
  NestedGradingResult,
  PatternPiece,
  Point2D,
  SizeCode,
  VectorPath,
} from "./types";

export type DxfUnit = "mm" | "cm";

export interface DxfExportOptions {
  /** Which sizes to include (1 size = single piece, multiple = AAMA graded nested blocks) */
  sizes: SizeCode[];
  /** Export unit (1:1 true scale in millimeters or centimeters) */
  unit?: DxfUnit;
  includeSeamLines: boolean;
  includeGrainlines: boolean;
  includeNotches: boolean;
  includeAnnotations: boolean;
  templateName: string;
  /** Legacy compatibility options */
  mode?: "nested" | "base";
  visibleSizes?: SizeCode[];
}

export interface DxfExportResult {
  content: string;
  filename: string;
  entityCount: number;
  byteSize: number;
  unit: DxfUnit;
  exportedSizes: SizeCode[];
}

/**
 * Official AAMA / ASTM D6673 Garment CAD DXF Layer Standard
 * Recognized natively by Gerber AccuMark PDS, Optitex PDS, CLO3D, and Lectra:
 * - Layer 1:  Outer Cut Boundary (1 closed POLYLINE per piece) + AAMA Piece/Size metadata TEXT
 * - Layer 2:  Turn / Grade Points (POINT entities for grading correspondence)
 * - Layer 4:  Notches (LINE slit notches)
 * - Layer 7:  Grainline (single straight LINE — CAD systems auto-render grain arrows)
 * - Layer 8:  Internal Reference Lines (centerline, zipper slit, fold line)
 * - Layer 11: Internal Cutouts (e.g. inner waist hole on 360° single-piece circle skirt)
 * - Layer 14: Sew / Seam Lines (internal stitched boundary)
 * - Layer 15: Piece Annotations / Display Text
 */
export const AAMA_DXF_LAYERS = {
  CUT: "1",
  GRADE_POINT: "2",
  NOTCH: "4",
  GRAINLINE: "7",
  INTERNAL: "8",
  CUTOUT: "11",
  SEW: "14",
  ANNOTATION: "15",
} as const;

const SIZE_ACI_COLORS: Record<SizeCode, number> = {
  S: 3, // Green
  M: 5, // Blue
  L: 30, // Orange
  XL: 1, // Red
};

/**
 * Fixed vertex count for arc discretization so every graded size (S, M, L, XL)
 * has the EXACT same number of POLYLINE vertices in identical order — required by
 * Gerber AccuMark & Optitex to merge size BLOCKs into a single nested Graded Piece!
 */
const FIXED_ARC_STEPS = 48;
const FIXED_FULL_CIRCLE_STEPS = 72;
const FIXED_BEZIER_STEPS = 24;

function toAsciiSafe(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/×/g, "x")
    .replace(/[^\x20-\x7E]/g, " ");
}

function roundUnit(val: number, unit: DxfUnit): number {
  const factor = unit === "cm" ? 1000 : 100; // 0.01 mm precision in both mm & cm
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

function fmt(val: number, unit: DxfUnit): string {
  return roundUnit(val, unit).toFixed(unit === "cm" ? 3 : 2);
}

function makeCoordinateMapper(
  offsetXMm: number,
  maxYMm: number,
  unit: DxfUnit
): (p: Point2D) => Point2D {
  const scale = unit === "cm" ? 0.1 : 1;
  return (p: Point2D): Point2D => ({
    x: roundUnit((p.x - offsetXMm) * scale, unit),
    y: roundUnit((maxYMm - p.y) * scale, unit),
  });
}

/**
 * Discretize a VectorPath into a deterministic, fixed-count vertex array AND
 * return the exact indices of structural Grade / Turn Points (corners + arc midpoints)
 * that sit with 0.00 mm tolerance directly on the emitted POLYLINE vertices!
 *
 * This guarantees Gerber AccuMark PDS & Optitex:
 * 1. Lock Grade Points (Layer 2) onto both corners AND center-waist [1] / center-hem [2] midpoints
 *    so arcs grade uniformly across S, M, L, XL without flattening or distortion.
 * 2. Preserve full S-M-L-XL grading rules on the Waistband (WB-01) even after "Swap Sew/Cut".
 */
function samplePathWithGradePoints(
  path: VectorPath,
  arcMidOffsets?: { outerDeltaMm?: number; innerDeltaMm?: number }
): {
  vertices: Point2D[];
  gradePointIndices: number[];
} {
  const pts: Point2D[] = [];
  const gradeIdxSet = new Set<number>();
  let cursor: Point2D = { x: 0, y: 0 };

  const hasFullCircle = path.segments.some(
    (s) => s.type === "A" && s.fullCircle
  );

  if (hasFullCircle) {
    const circleSeg = path.segments.find(
      (s) => s.type === "A" && s.fullCircle && s.center && s.radius !== undefined
    );
    if (
      circleSeg &&
      circleSeg.type === "A" &&
      circleSeg.center &&
      circleSeg.radius !== undefined
    ) {
      for (let i = 0; i < FIXED_FULL_CIRCLE_STEPS; i++) {
        const angle = (2 * Math.PI * i) / FIXED_FULL_CIRCLE_STEPS;
        pts.push(polarPoint(circleSeg.center, circleSeg.radius, angle));
      }
      // 4 cardinal grade points (0°, 90° CF, 180°, 270° CB)
      const q = FIXED_FULL_CIRCLE_STEPS / 4;
      return {
        vertices: pts,
        gradePointIndices: [0, q, q * 2, q * 3],
      };
    }
  }

  let arcIdx = 0;
  for (const seg of path.segments) {
    if (seg.type === "M") {
      cursor = seg.to;
      gradeIdxSet.add(pts.length);
      pts.push(cursor);
    } else if (seg.type === "L") {
      cursor = seg.to;
      gradeIdxSet.add(pts.length);
      pts.push(cursor);
    } else if (seg.type === "A") {
      if (
        seg.center &&
        seg.radius !== undefined &&
        seg.startAngle !== undefined &&
        seg.endAngle !== undefined
      ) {
        const diff = seg.endAngle - seg.startAngle;
        const midStep = Math.floor(FIXED_ARC_STEPS / 2); // Exact arc midpoint (e.g. CF Waist [1] & CF Hem [2])
        // First arc in annular sector is outer hem arc [2], second arc is inner waist arc [1]
        const midOffset =
          arcIdx === 0
            ? (arcMidOffsets?.outerDeltaMm ?? 0)
            : (arcMidOffsets?.innerDeltaMm ?? 0);
        arcIdx++;

        for (let i = 1; i <= FIXED_ARC_STEPS; i++) {
          const t = i / FIXED_ARC_STEPS;
          const a = seg.startAngle + diff * t;
          // Smooth sine bell curve: 0 at both side corners, exact midOffset at arc midpoint [1] / [2]
          const rAdjusted =
            midOffset !== 0
              ? seg.radius + midOffset * Math.sin(t * Math.PI)
              : seg.radius;
          if (i === midStep || i === FIXED_ARC_STEPS) {
            gradeIdxSet.add(pts.length);
          }
          pts.push(polarPoint(seg.center, rAdjusted, a));
        }
      } else {
        gradeIdxSet.add(pts.length);
        pts.push(seg.to);
      }
      cursor = seg.to;
    } else if (seg.type === "C") {
      const midStep = Math.floor(FIXED_BEZIER_STEPS / 2);
      for (let i = 1; i <= FIXED_BEZIER_STEPS; i++) {
        if (i === midStep || i === FIXED_BEZIER_STEPS) {
          gradeIdxSet.add(pts.length);
        }
        pts.push(
          evalCubicBezier(cursor, seg.cp1, seg.cp2, seg.to, i / FIXED_BEZIER_STEPS)
        );
      }
      cursor = seg.to;
    }
  }

  // For closed polylines, avoid duplicating the closing vertex (flag 70=1 closes it cleanly)
  if (path.closed && pts.length > 2) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (Math.hypot(last.x - first.x, last.y - first.y) < 0.05) {
      gradeIdxSet.delete(pts.length - 1);
      pts.pop();
    }
  }

  return {
    vertices: pts,
    gradePointIndices: Array.from(gradeIdxSet)
      .filter((idx) => idx >= 0 && idx < pts.length)
      .sort((a, b) => a - b),
  };
}

/* ==================== Low-Level R12 (AC1009) Entity Emitters ==================== */

function emitPolylineR12(
  layer: string,
  points: Point2D[],
  closed: boolean,
  unit: DxfUnit,
  color?: number,
  linetype?: string
): string[] {
  if (points.length < 2) return [];
  const out: string[] = [
    "0",
    "POLYLINE",
    "8",
    layer,
    ...(linetype ? ["6", linetype] : []),
    ...(color !== undefined ? ["62", String(color)] : []),
    "66",
    "1",
    "10",
    "0.00",
    "20",
    "0.00",
    "30",
    "0.00",
    "70",
    closed ? "1" : "0",
  ];

  for (const p of points) {
    out.push(
      "0",
      "VERTEX",
      "8",
      layer,
      "10",
      fmt(p.x, unit),
      "20",
      fmt(p.y, unit),
      "30",
      "0.00"
    );
  }

  out.push("0", "SEQEND", "8", layer);
  return out;
}

function emitLineR12(
  layer: string,
  a: Point2D,
  b: Point2D,
  unit: DxfUnit,
  color?: number,
  linetype?: string
): string[] {
  return [
    "0",
    "LINE",
    "8",
    layer,
    ...(linetype ? ["6", linetype] : []),
    ...(color !== undefined ? ["62", String(color)] : []),
    "10",
    fmt(a.x, unit),
    "20",
    fmt(a.y, unit),
    "30",
    "0.00",
    "11",
    fmt(b.x, unit),
    "21",
    fmt(b.y, unit),
    "31",
    "0.00",
  ];
}

function emitPointR12(
  layer: string,
  p: Point2D,
  unit: DxfUnit,
  color?: number
): string[] {
  return [
    "0",
    "POINT",
    "8",
    layer,
    ...(color !== undefined ? ["62", String(color)] : []),
    "10",
    fmt(p.x, unit),
    "20",
    fmt(p.y, unit),
    "30",
    "0.00",
  ];
}

function emitTextR12(
  layer: string,
  pos: Point2D,
  height: number,
  value: string,
  unit: DxfUnit,
  color?: number
): string[] {
  return [
    "0",
    "TEXT",
    "8",
    layer,
    ...(color !== undefined ? ["62", String(color)] : []),
    "10",
    fmt(pos.x, unit),
    "20",
    fmt(pos.y, unit),
    "30",
    "0.00",
    "40",
    fmt(height, unit),
    "1",
    toAsciiSafe(value),
  ];
}

function emitInsertR12(
  blockName: string,
  layer = AAMA_DXF_LAYERS.CUT
): string[] {
  return [
    "0",
    "INSERT",
    "8",
    layer,
    "2",
    blockName,
    "10",
    "0.00",
    "20",
    "0.00",
    "30",
    "0.00",
    "41",
    "1.0",
    "42",
    "1.0",
    "43",
    "1.0",
    "50",
    "0.0",
  ];
}

function buildPieceBlock(
  blockName: string,
  piece: PatternPiece,
  size: SizeCode,
  isMultiSize: boolean,
  unit: DxfUnit,
  options: DxfExportOptions,
  mapPt: (p: Point2D) => Point2D
): { lines: string[]; entityCount: number } {
  const out: string[] = [
    "0",
    "BLOCK",
    "8",
    "0",
    "2",
    blockName,
    "70",
    "0",
    "10",
    "0.00",
    "20",
    "0.00",
    "30",
    "0.00",
  ];

  let count = 0;
  const unitScale = unit === "cm" ? 0.1 : 1;
  const sizeColor = isMultiSize ? SIZE_ACI_COLORS[size] : 7;

  // 1. Cut Paths + Exact-Match Layer 2 Grade/Turn Points on Cut Boundary:
  //    - Primary outer perimeter -> Layer 1 (ONLY ONE closed POLYLINE on Layer 1!)
  //    - Secondary inner cutout (e.g. 360° waist hole) -> Layer 11 (Internal Cutout)
  //      so Gerber AccuMark NEVER splits the inner waist hole into a separate floating piece!
  //    - Every structural corner AND arc midpoint (CF Waist [1], CF Hem [2], WB Top/Bot Mid)
  //      receives an exact-coordinate Layer 2 Grade Point matching the POLYLINE vertex 1:1.
  // Detect any custom radial offset at Position [1] (CF Waist P2) & Position [2] (CF Hem P5)
  const skirtArcOffsets =
    piece.id === "skirt-panel"
      ? (() => {
          const kpW = piece.keyPoints.find((k) => k.code === "P2");
          const kpH = piece.keyPoints.find((k) => k.code === "P5");
          const sewSegs = piece.sewPaths[0]?.segments ?? [];
          const outerArc = sewSegs.find((s) => s.type === "A" && s.radius !== undefined);
          const innerArc = [...sewSegs]
            .reverse()
            .find((s) => s.type === "A" && s.radius !== undefined);
          const outerDeltaMm =
            kpH && outerArc && outerArc.type === "A" && outerArc.radius !== undefined
              ? roundMm(kpH.point.y - outerArc.radius)
              : 0;
          const innerDeltaMm =
            kpW && innerArc && innerArc.type === "A" && innerArc.radius !== undefined
              ? roundMm(kpW.point.y - innerArc.radius)
              : 0;
          return { outerDeltaMm, innerDeltaMm };
        })()
      : undefined;

  piece.cutPaths.forEach((cp, idx) => {
    const { vertices, gradePointIndices } = samplePathWithGradePoints(
      cp,
      idx === 0 ? skirtArcOffsets : undefined
    );
    const mappedVerts = vertices.map(mapPt);
    const layer = idx === 0 ? AAMA_DXF_LAYERS.CUT : AAMA_DXF_LAYERS.CUTOUT;
    out.push(
      ...emitPolylineR12(layer, mappedVerts, cp.closed, unit, sizeColor, "CONTINUOUS")
    );
    count++;

    for (const gIdx of gradePointIndices) {
      out.push(
        ...emitPointR12(
          AAMA_DXF_LAYERS.GRADE_POINT,
          mappedVerts[gIdx],
          unit,
          sizeColor
        )
      );
      count++;
    }
  });

  // 2. Seam / Sew Lines on Layer 14 + Exact-Match Layer 2 Grade Points on Sew Boundary
  //    so "Swap Sew/Cut" in Gerber AccuMark retains 100% of S-M-L-XL grading on both Skirt & Waistband!
  if (options.includeSeamLines) {
    for (const sp of piece.sewPaths) {
      const { vertices, gradePointIndices } = samplePathWithGradePoints(
        sp,
        skirtArcOffsets
      );
      const mappedVerts = vertices.map(mapPt);
      out.push(
        ...emitPolylineR12(
          AAMA_DXF_LAYERS.SEW,
          mappedVerts,
          sp.closed,
          unit,
          sizeColor,
          "DASHED"
        )
      );
      count++;

      for (const gIdx of gradePointIndices) {
        out.push(
          ...emitPointR12(
            AAMA_DXF_LAYERS.GRADE_POINT,
            mappedVerts[gIdx],
            unit,
            sizeColor
          )
        );
        count++;
      }
    }
  }

  // 3. Notches on Layer 4 (short slit LINE starting exactly on Cut boundary + optional Sew notch)
  //    Includes CF Waist [1] and CF Hem [2] notches to anchor arc midpoints against distortion!
  if (options.includeNotches) {
    for (const notch of piece.notches) {
      const origin = notch.cutPoint ?? notch.point;
      const tip: Point2D = {
        x: roundMm(origin.x + Math.cos(notch.angle) * notch.depth),
        y: roundMm(origin.y + Math.sin(notch.angle) * notch.depth),
      };
      out.push(
        ...emitLineR12(
          AAMA_DXF_LAYERS.NOTCH,
          mapPt(origin),
          mapPt(tip),
          unit,
          6,
          "CONTINUOUS"
        )
      );
      count++;
    }
  }

  // 4. Grainline on Layer 7 (EXACTLY ONE straight LINE per AAMA spec; Gerber auto-draws arrowheads)
  if (options.includeGrainlines) {
    out.push(
      ...emitLineR12(
        AAMA_DXF_LAYERS.GRAINLINE,
        mapPt(piece.grainline.start),
        mapPt(piece.grainline.end),
        unit,
        4,
        "CONTINUOUS"
      )
    );
    count++;
  }

  // 5. Internal Reference Lines on Layer 8 (Centerline, Zipper slit)
  for (const ip of piece.internalPaths) {
    const { vertices } = samplePathWithGradePoints(ip);
    const verts = vertices.map(mapPt);
    if (verts.length === 2) {
      out.push(
        ...emitLineR12(AAMA_DXF_LAYERS.INTERNAL, verts[0], verts[1], unit, 8, "DASHED")
      );
    } else {
      out.push(
        ...emitPolylineR12(AAMA_DXF_LAYERS.INTERNAL, verts, ip.closed, unit, 8, "DASHED")
      );
    }
    count++;
  }

  // 7. AAMA Required Metadata TEXT on Layer 1 (THIS is what tells Gerber AccuMark / Optitex / CLO3D
  //    to merge S, M, L, XL blocks with the same "Piece Name" into ONE Nested Graded Piece!)
  const labelAnchor = mapPt(piece.labelAnchor);
  const textH = roundUnit(8 * unitScale, unit);
  const lineStep = roundUnit(12 * unitScale, unit);

  out.push(
    ...emitTextR12(
      AAMA_DXF_LAYERS.CUT,
      { x: labelAnchor.x, y: labelAnchor.y + lineStep },
      textH,
      `Piece Name: ${piece.code}`,
      unit,
      7
    ),
    ...emitTextR12(
      AAMA_DXF_LAYERS.CUT,
      { x: labelAnchor.x, y: labelAnchor.y },
      textH,
      `Size: ${size}`,
      unit,
      7
    ),
    ...emitTextR12(
      AAMA_DXF_LAYERS.CUT,
      { x: labelAnchor.x, y: labelAnchor.y - lineStep },
      textH,
      `Quantity: ${piece.cutQuantity}`,
      unit,
      7
    )
  );
  count += 3;

  // 8. Human-readable Annotation on Layer 15
  if (options.includeAnnotations) {
    out.push(
      ...emitTextR12(
        AAMA_DXF_LAYERS.ANNOTATION,
        { x: labelAnchor.x, y: labelAnchor.y - lineStep * 2 },
        roundUnit(7 * unitScale, unit),
        `Annotation: ${piece.englishName} - CUT x${piece.cutQuantity}`,
        unit,
        7
      )
    );
    count++;
  }

  out.push("0", "ENDBLK", "8", "0");
  return { lines: out, entityCount: count };
}

/**
 * Generate an AAMA / ASTM D6673 compliant R12 (`AC1009`) DXF file.
 * Uses BLOCKS + INSERT + fixed-vertex-count POLYLINEs + `Piece Name:` / `Size:` metadata
 * so Gerber AccuMark PDS, Optitex, and CLO3D automatically group S-M-L-XL into nested
 * Graded Pieces (1 piece per garment part with all graded sizes nested inside).
 */
export function generatePatternDxf(
  grading: NestedGradingResult,
  options: DxfExportOptions
): DxfExportResult {
  const unit: DxfUnit = options.unit ?? "mm";

  let targetSizes: SizeCode[] = options.sizes;
  if (!targetSizes || targetSizes.length === 0) {
    targetSizes =
      options.mode === "base"
        ? [grading.baseSize]
        : options.visibleSizes && options.visibleSizes.length > 0
          ? options.visibleSizes
          : grading.sizes;
  }

  const entriesToExport = grading.entries.filter((e) =>
    targetSizes.includes(e.size)
  );
  const effectiveEntries =
    entriesToExport.length > 0
      ? entriesToExport
      : [grading.entries.find((e) => e.isBase) ?? grading.entries[0]];

  const exportedSizes = effectiveEntries.map((e) => e.size);
  const isMultiSize = effectiveEntries.length > 1;
  const exportedSizesLabel = exportedSizes.join("-");
  const sampleSize = exportedSizes.includes(grading.baseSize)
    ? grading.baseSize
    : exportedSizes[0];

  const bbox = grading.combinedBbox;
  const padMm = 25;
  const mapPt = makeCoordinateMapper(bbox.minX - padMm, bbox.maxY + padMm, unit);
  const unitScale = unit === "cm" ? 0.1 : 1;

  const extMaxX = roundUnit((bbox.width + padMm * 2) * unitScale, unit);
  const extMaxY = roundUnit((bbox.height + padMm * 2) * unitScale, unit);

  // Build BLOCKS section (grouped by piece across all requested sizes) + INSERTs in ENTITIES
  const blocksSection: string[] = [];
  const insertEntities: string[] = [];
  let entityCount = 0;

  // AAMA File-Level Style & Grading Header Text in Model Space (Layer 1)
  const headerTextH = roundUnit(10 * unitScale, unit);
  const headerStep = roundUnit(15 * unitScale, unit);
  const styleCode = toAsciiSafe(options.templateName)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  insertEntities.push(
    ...emitTextR12(
      AAMA_DXF_LAYERS.CUT,
      { x: 0, y: extMaxY + headerStep * 3 },
      headerTextH,
      `Style Name: ${styleCode || "PATTERNCAD"}`,
      unit,
      7
    ),
    ...emitTextR12(
      AAMA_DXF_LAYERS.CUT,
      { x: 0, y: extMaxY + headerStep * 2 },
      headerTextH,
      `Author: PatternCAD Pro`,
      unit,
      7
    ),
    ...emitTextR12(
      AAMA_DXF_LAYERS.CUT,
      { x: 0, y: extMaxY + headerStep },
      headerTextH,
      `Sample Size: ${sampleSize}`,
      unit,
      7
    ),
    ...emitTextR12(
      AAMA_DXF_LAYERS.CUT,
      { x: 0, y: extMaxY },
      headerTextH,
      `Grading Rule Table: AAMA`,
      unit,
      7
    )
  );
  entityCount += 4;

  // Iterate piece-by-piece so all sizes of SKT-01 are grouped cleanly, then all sizes of WB-01
  const pieceIds = effectiveEntries[0].geometry.pieces.map((p) => p.id);

  for (const pieceId of pieceIds) {
    for (const entry of effectiveEntries) {
      const piece = entry.geometry.pieces.find((p) => p.id === pieceId);
      if (!piece) continue;

      const cleanCode = piece.code.replace(/[^A-Za-z0-9]/g, "");
      const blockName = `${cleanCode}_${entry.size}`;

      const built = buildPieceBlock(
        blockName,
        piece,
        entry.size,
        isMultiSize,
        unit,
        options,
        mapPt
      );
      blocksSection.push(...built.lines);
      entityCount += built.entityCount;

      // INSERT all sizes of the same piece at the exact same origin (0, 0) so they nest concentrically!
      insertEntities.push(...emitInsertR12(blockName, AAMA_DXF_LAYERS.CUT));
      entityCount++;
    }
  }

  const layers = [
    { name: "0", color: 7, linetype: "CONTINUOUS" },
    { name: AAMA_DXF_LAYERS.CUT, color: 7, linetype: "CONTINUOUS" },
    { name: AAMA_DXF_LAYERS.GRADE_POINT, color: 2, linetype: "CONTINUOUS" },
    { name: AAMA_DXF_LAYERS.NOTCH, color: 6, linetype: "CONTINUOUS" },
    { name: AAMA_DXF_LAYERS.GRAINLINE, color: 4, linetype: "CONTINUOUS" },
    { name: AAMA_DXF_LAYERS.INTERNAL, color: 8, linetype: "DASHED" },
    { name: AAMA_DXF_LAYERS.CUTOUT, color: 1, linetype: "CONTINUOUS" },
    { name: AAMA_DXF_LAYERS.SEW, color: 5, linetype: "DASHED" },
    { name: AAMA_DXF_LAYERS.ANNOTATION, color: 7, linetype: "CONTINUOUS" },
  ];

  const layerTable: string[] = [
    "0",
    "TABLE",
    "2",
    "LAYER",
    "70",
    String(layers.length),
  ];
  for (const l of layers) {
    layerTable.push(
      "0",
      "LAYER",
      "2",
      l.name,
      "70",
      "0",
      "62",
      String(l.color),
      "6",
      l.linetype
    );
  }
  layerTable.push("0", "ENDTAB");

  const dashLen = unit === "cm" ? "0.8" : "8.0";
  const gapLen = unit === "cm" ? "-0.4" : "-4.0";
  const dashTotal = unit === "cm" ? "1.2" : "12.0";

  const dxfLines: string[] = [
    "999",
    `PatternCAD Pro - AAMA/ASTM D6673 Graded DXF (${toAsciiSafe(options.templateName)})`,
    "999",
    `Format: AutoCAD R12 (AC1009) | Units: ${unit} (1:1) | Sizes: ${exportedSizesLabel}`,
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
    unit === "cm" ? "5" : "4",
    "9",
    "$MEASUREMENT",
    "70",
    "1",
    "9",
    "$EXTMIN",
    "10",
    "0.00",
    "20",
    "0.00",
    "30",
    "0.00",
    "9",
    "$EXTMAX",
    "10",
    fmt(extMaxX, unit),
    "20",
    fmt(extMaxY + headerStep * 4, unit),
    "30",
    "0.00",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "TABLES",
    "0",
    "TABLE",
    "2",
    "LTYPE",
    "70",
    "2",
    "0",
    "LTYPE",
    "2",
    "CONTINUOUS",
    "70",
    "0",
    "3",
    "Solid line",
    "72",
    "65",
    "73",
    "0",
    "40",
    "0.0",
    "0",
    "LTYPE",
    "2",
    "DASHED",
    "70",
    "0",
    "3",
    "Dashed __ __ __",
    "72",
    "65",
    "73",
    "2",
    "40",
    dashTotal,
    "49",
    dashLen,
    "49",
    gapLen,
    "0",
    "ENDTAB",
    ...layerTable,
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "BLOCKS",
    ...blocksSection,
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    ...insertEntities,
    "0",
    "ENDSEC",
    "0",
    "EOF",
  ];

  const content = dxfLines.join("\r\n") + "\r\n";
  const slug = toAsciiSafe(options.templateName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const filename = `${slug || "pattern"}-${isMultiSize ? `aama-graded-${exportedSizesLabel}` : `aama-size-${exportedSizesLabel}`}-${unit}.dxf`;

  return {
    content,
    filename,
    entityCount,
    byteSize: new TextEncoder().encode(content).length,
    unit,
    exportedSizes,
  };
}
