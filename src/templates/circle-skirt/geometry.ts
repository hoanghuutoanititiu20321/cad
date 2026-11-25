import {
  computePathPerimeter,
  computePathsBoundingBox,
  createAnnularSectorSegments,
  createFullCircleSegments,
  createOffsetAnnularSectorSegments,
  degToRad,
  mergeBoundingBoxes,
  polarPoint,
  pt,
  roundCm,
  roundMm,
} from "@/lib/cad/math";
import type {
  DimensionCallout,
  FormulaItem,
  KeyPoint,
  Notch,
  ParamValues,
  PatternGeometryResult,
  PatternPiece,
  VectorPath,
} from "@/lib/cad/types";
import {
  parseCircleSkirtParams,
  WAISTBAND_HEIGHT_CM,
  type CircleSkirtParams,
} from "./schema";

export interface CircleSkirtRadii {
  effectiveWaistCm: number;
  effectiveWaistMm: number;
  rWaistCm: number;
  rWaistMm: number;
  rHemCm: number;
  rHemMm: number;
  pieceAngleDeg: number;
  pieceArcWaistCm: number;
  pieceArcHemCm: number;
}

/**
 * Core mandatory mathematical formulas for the Flared Circle Skirt:
 * - Effective waist = waist * gatherRatio
 * - R_waist = (waist * gatherRatio) / (2 * PI * (flareAngle / 360))
 * - R_hem = R_waist + skirtLength
 */
export function computeCircleSkirtRadii(
  params: CircleSkirtParams
): CircleSkirtRadii {
  const effectiveWaistCm = params.waist * params.gatherRatio;
  const effectiveWaistMm = roundMm(effectiveWaistCm * 10);

  const circleFraction = params.flareAngle / 360;
  const rWaistCm = effectiveWaistCm / (2 * Math.PI * circleFraction);
  const rHemCm = rWaistCm + params.skirtLength;

  const rWaistMm = roundMm(rWaistCm * 10);
  const rHemMm = roundMm(rHemCm * 10);

  const pieceAngleDeg = params.flareAngle / params.pieceMultiplier;
  const pieceArcWaistCm = effectiveWaistCm / params.pieceMultiplier;
  const pieceArcHemCm =
    2 * Math.PI * rHemCm * (pieceAngleDeg / 360);

  return {
    effectiveWaistCm: roundCm(effectiveWaistCm, 2),
    effectiveWaistMm,
    rWaistCm: roundCm(rWaistCm, 3),
    rWaistMm,
    rHemCm: roundCm(rHemCm, 3),
    rHemMm,
    pieceAngleDeg,
    pieceArcWaistCm: roundCm(pieceArcWaistCm, 2),
    pieceArcHemCm: roundCm(pieceArcHemCm, 2),
  };
}

export interface CircleSkirtGeometryOptions {
  /** Shared vertical top-center anchor for nested waistbands */
  waistbandTopY?: number;
  /** Fixed curved waistband inner radius (from Base Size) so all graded sizes share identical curvature and grade symmetrically at both ends */
  fixedWaistbandRTopMm?: number;
  /** Fixed grainline coordinates (from Base Size) so Gerber AccuMark aligns all graded blocks concentrically without shifting X */
  fixedSkirtGrainline?: { start: { x: number; y: number }; end: { x: number; y: number } };
  fixedWaistbandGrainline?: { start: { x: number; y: number }; end: { x: number; y: number } };
  /** Optional custom radial offset at Position [1] (CF Waist midpoint, mm) for this size */
  pos1WaistMidDeltaMm?: number;
  /** Optional custom radial offset at Position [2] (CF Hem midpoint, mm) for this size */
  pos2HemMidDeltaMm?: number;
}

/**
 * Build Piece 1: Tùng váy xòe (Flared Skirt Panel)
 * Centered symmetrically hanging downward (+Y axis = Center Front / Midline, angle = 90°).
 * Circle arc center sits at (0, 0) so all graded sizes S-M-L-XL nest concentrically.
 */
function buildSkirtPanelPiece(
  params: CircleSkirtParams,
  radii: CircleSkirtRadii,
  options?: CircleSkirtGeometryOptions
): { piece: PatternPiece; warnings: string[] } {
  const warnings: string[] = [];
  const center = pt(0, 0);
  const saMm = roundMm(params.seamAllowance * 10);
  const { rWaistMm, rHemMm, pieceAngleDeg } = radii;
  const isFullCirclePiece = pieceAngleDeg >= 359.99;

  const sewPaths: VectorPath[] = [];
  const cutPaths: VectorPath[] = [];
  const internalPaths: VectorPath[] = [];
  const notches: Notch[] = [];
  const keyPoints: KeyPoint[] = [];
  const dimensions: DimensionCallout[] = [];

  const midAngle = Math.PI / 2; // 90° (pointing down +Y)

  if (isFullCirclePiece) {
    // Full 360° circle single piece: concentric outer/inner rings + CB radial zipper slit at -90° (top)
    warnings.push(
      "Góc xòe 360° nguyên mảnh (×1): Rập tròn khép kín có đường xẻ khóa kéo phía sau (CB). Nên chọn '×2 Cắt đôi' nếu muốn chừa đường may đầy đủ hai bên sườn."
    );

    const rWaistCut = roundMm(Math.max(2, rWaistMm - saMm));
    const rHemCut = roundMm(rHemMm + saMm);

    sewPaths.push(
      {
        id: "skirt-sew-hem",
        kind: "sew",
        closed: true,
        label: "Đường may lai váy (Hem Sew Line)",
        segments: createFullCircleSegments(center, rHemMm, 1),
      },
      {
        id: "skirt-sew-waist",
        kind: "sew",
        closed: true,
        label: "Đường may vòng eo (Waist Sew Line)",
        segments: createFullCircleSegments(center, rWaistMm, 0),
      }
    );

    cutPaths.push(
      {
        id: "skirt-cut-hem",
        kind: "cut",
        closed: true,
        label: "Đường cắt lai váy (Hem Cut Line)",
        segments: createFullCircleSegments(center, rHemCut, 1),
      },
      {
        id: "skirt-cut-waist",
        kind: "cut",
        closed: true,
        label: "Đường cắt vòng eo (Waist Cut Line)",
        segments: createFullCircleSegments(center, rWaistCut, 0),
      }
    );

    // Radial CB zipper slit at -90° (top vertical)
    const slitAngle = -Math.PI / 2;
    const slitStart = polarPoint(center, rWaistCut, slitAngle);
    const slitEnd = polarPoint(center, rHemCut, slitAngle);
    internalPaths.push({
      id: "skirt-cb-slit",
      kind: "internal",
      closed: false,
      label: "Đường xẻ khóa kéo giữa sau (CB Zipper Slit)",
      segments: [
        { type: "M", to: slitStart },
        { type: "L", to: slitEnd },
      ],
    });

    // Notches at CF (bottom 90°), Left/Right sides (0°, 180°), and Zipper stop on CB slit
    const cardinalAngles: Array<{ a: number; label: string }> = [
      { a: Math.PI / 2, label: "Giữa trước — Eo (CF Waist)" },
      { a: 0, label: "Sườn phải (Right Side)" },
      { a: Math.PI, label: "Sườn trái (Left Side)" },
    ];
    cardinalAngles.forEach((item, idx) => {
      notches.push({
        id: `skirt-notch-w-${idx}`,
        point: polarPoint(center, rWaistMm, item.a),
        cutPoint: polarPoint(center, rWaistCut, item.a),
        angle: item.a, // pointing outward into fabric from inner waist ring
        depth: 5,
        style: "slit",
        label: item.label,
      });
    });

    // CF Hem notch
    notches.push({
      id: "skirt-notch-hem-cf",
      point: polarPoint(center, rHemMm, Math.PI / 2),
      cutPoint: polarPoint(center, rHemCut, Math.PI / 2),
      angle: -Math.PI / 2, // pointing inward toward center
      depth: 5,
      style: "slit",
      label: "Giữa trước — Lai (CF Hem)",
    });

    if (params.includeZipperNotch) {
      const zipDist = Math.min(180, roundMm(params.skirtLength * 10 * 0.75));
      const zipR = roundMm(rWaistMm + zipDist);
      const zipPt = polarPoint(center, zipR, slitAngle);
      notches.push({
        id: "skirt-notch-zipper",
        point: zipPt,
        cutPoint: zipPt,
        angle: 0,
        depth: 6,
        style: "T",
        label: `Điểm dừng khóa kéo (${roundCm(zipDist / 10, 1)} cm)`,
      });
    }

    // Key points for grading table
    keyPoints.push(
      {
        id: "kp-w-right",
        code: "P1",
        label: "Eo sườn phải (Waist Right)",
        point: polarPoint(center, rWaistMm, 0),
      },
      {
        id: "kp-w-cf",
        code: "P2",
        label: "Eo giữa trước (Waist CF)",
        point: polarPoint(center, rWaistMm, Math.PI / 2),
      },
      {
        id: "kp-w-left",
        code: "P3",
        label: "Eo sườn trái (Waist Left)",
        point: polarPoint(center, rWaistMm, Math.PI),
      },
      {
        id: "kp-h-left",
        code: "P4",
        label: "Lai sườn trái (Hem Left)",
        point: polarPoint(center, rHemMm, Math.PI),
      },
      {
        id: "kp-h-cf",
        code: "P5",
        label: "Lai giữa trước (Hem CF)",
        point: polarPoint(center, rHemMm, Math.PI / 2),
      },
      {
        id: "kp-h-right",
        code: "P6",
        label: "Lai sườn phải (Hem Right)",
        point: polarPoint(center, rHemMm, 0),
      }
    );

    // Radial dimension callouts
    dimensions.push(
      {
        id: "dim-r-waist",
        from: center,
        to: polarPoint(center, rWaistMm, degToRad(35)),
        label: `R_eo = ${roundCm(radii.rWaistCm, 2)} cm`,
        kind: "radial",
      },
      {
        id: "dim-r-hem",
        from: center,
        to: polarPoint(center, rHemMm, degToRad(145)),
        label: `R_lai = ${roundCm(radii.rHemCm, 2)} cm`,
        kind: "radial",
      }
    );
  } else {
    // Annular Sector (< 360°) centered symmetrically downward around angle = 90° (+Y)
    const halfSpan = degToRad(pieceAngleDeg / 2);
    const startAngle = midAngle - halfSpan; // Right side seam
    const endAngle = midAngle + halfSpan; // Left side seam

    sewPaths.push({
      id: "skirt-sew-main",
      kind: "sew",
      closed: true,
      label: "Đường may tùng váy (Skirt Sew Line)",
      segments: createAnnularSectorSegments({
        center,
        innerRadius: rWaistMm,
        outerRadius: rHemMm,
        startAngle,
        endAngle,
      }),
    });

    const offsetResult = createOffsetAnnularSectorSegments({
      center,
      innerRadius: rWaistMm,
      outerRadius: rHemMm,
      startAngle,
      endAngle,
      innerSa: saMm,
      outerSa: saMm,
      sideSa: saMm,
    });

    cutPaths.push({
      id: "skirt-cut-main",
      kind: "cut",
      closed: true,
      label: "Đường cắt tùng váy (Skirt Cut Line)",
      segments: offsetResult.segments,
    });

    // Center Front reference line (dashed internal line)
    internalPaths.push({
      id: "skirt-centerline",
      kind: "internal",
      closed: false,
      label: "Trục đối xứng giữa thân (Center Line)",
      segments: [
        { type: "M", to: polarPoint(center, rWaistMm, midAngle) },
        { type: "L", to: polarPoint(center, rHemMm, midAngle) },
      ],
    });

    // CF Waist & Hem Notches
    notches.push(
      {
        id: "skirt-notch-cf-waist",
        point: polarPoint(center, rWaistMm, midAngle),
        cutPoint: polarPoint(center, offsetResult.innerCutRadius, midAngle),
        angle: midAngle, // pointing downward into skirt body
        depth: 5,
        style: "slit",
        label: "Dấu bấm giữa eo (CF Waist)",
      },
      {
        id: "skirt-notch-cf-hem",
        point: polarPoint(center, rHemMm, midAngle),
        cutPoint: polarPoint(center, offsetResult.outerCutRadius, midAngle),
        angle: midAngle + Math.PI, // pointing upward into skirt body
        depth: 5,
        style: "slit",
        label: "Dấu bấm giữa lai (CF Hem)",
      }
    );

    // Quarter waist notches when sector is >= 120° (essential for aligning gathers/waistband)
    if (pieceAngleDeg >= 120) {
      const q1 = startAngle + halfSpan * 0.5;
      const q3 = endAngle - halfSpan * 0.5;
      notches.push(
        {
          id: "skirt-notch-q1-waist",
          point: polarPoint(center, rWaistMm, q1),
          cutPoint: polarPoint(center, offsetResult.innerCutRadius, q1),
          angle: q1,
          depth: 4.5,
          style: "slit",
          label: "Dấu bấm 1/4 eo (Quarter Waist R)",
        },
        {
          id: "skirt-notch-q3-waist",
          point: polarPoint(center, rWaistMm, q3),
          cutPoint: polarPoint(center, offsetResult.innerCutRadius, q3),
          angle: q3,
          depth: 4.5,
          style: "slit",
          label: "Dấu bấm 3/4 eo (Quarter Waist L)",
        }
      );
    }

    // Zipper stop notch (18 cm below waist on the left radial side seam / CB)
    if (params.includeZipperNotch) {
      const zipDist = Math.min(180, roundMm(params.skirtLength * 10 * 0.75));
      const zipR = roundMm(rWaistMm + zipDist);
      const sewZipPt = polarPoint(center, zipR, endAngle);
      // Outward normal to endAngle side seam is endAngle + PI/2; inward into fabric is endAngle - PI/2
      const outNormal = endAngle + Math.PI / 2;
      const cutZipPt = pt(
        sewZipPt.x + Math.cos(outNormal) * saMm,
        sewZipPt.y + Math.sin(outNormal) * saMm
      );
      notches.push({
        id: "skirt-notch-zipper",
        point: sewZipPt,
        cutPoint: cutZipPt,
        angle: endAngle - Math.PI / 2, // pointing inward into skirt panel
        depth: 6,
        style: "T",
        label: `Dấu dừng khóa kéo (${roundCm(zipDist / 10, 1)} cm)`,
      });
    }

    // Key points for Grading Coordinate Table
    keyPoints.push(
      {
        id: "kp-w-start",
        code: "P1",
        label: "Eo sườn phải (Waist Start)",
        point: polarPoint(center, rWaistMm, startAngle),
      },
      {
        id: "kp-w-mid",
        code: "P2",
        label: "Eo giữa thân (Waist CF)",
        point: polarPoint(center, rWaistMm, midAngle),
      },
      {
        id: "kp-w-end",
        code: "P3",
        label: "Eo sườn trái (Waist End)",
        point: polarPoint(center, rWaistMm, endAngle),
      },
      {
        id: "kp-h-end",
        code: "P4",
        label: "Lai sườn trái (Hem End)",
        point: polarPoint(center, rHemMm, endAngle),
      },
      {
        id: "kp-h-mid",
        code: "P5",
        label: "Lai giữa thân (Hem CF)",
        point: polarPoint(center, rHemMm, midAngle),
      },
      {
        id: "kp-h-start",
        code: "P6",
        label: "Lai sườn phải (Hem Start)",
        point: polarPoint(center, rHemMm, startAngle),
      }
    );

    // Radial callout lines
    dimensions.push(
      {
        id: "dim-r-waist",
        from: center,
        to: polarPoint(center, rWaistMm, startAngle),
        label: `R_eo = ${roundCm(radii.rWaistCm, 2)} cm`,
        kind: "radial",
      },
      {
        id: "dim-length",
        from: polarPoint(center, rWaistMm, startAngle),
        to: polarPoint(center, rHemMm, startAngle),
        label: `L = ${roundCm(params.skirtLength, 1)} cm`,
        kind: "linear",
        offsetMm: -28,
      }
    );
  }

  // Grainline placed cleanly along the center axis inside the lower panel body.
  // When grading S-M-L-XL, reuse Base Size grainline coordinates so Gerber AccuMark
  // aligns all graded sizes concentrically (ΔY at waist side === ΔX at waist CF [1]!).
  const grainStartR = roundMm(rWaistMm + params.skirtLength * 10 * 0.24);
  const grainEndR = roundMm(rWaistMm + params.skirtLength * 10 * 0.76);
  const grainline = {
    start: options?.fixedSkirtGrainline?.start ?? polarPoint(center, grainStartR, midAngle),
    end: options?.fixedSkirtGrainline?.end ?? polarPoint(center, grainEndR, midAngle),
    label: "Canh sợi dọc (Straight Grain)",
  };

  // Optional custom radial adjustment at Position [1] (CF Waist) & Position [2] (CF Hem)
  const dPos1 = roundMm(options?.pos1WaistMidDeltaMm ?? 0);
  const dPos2 = roundMm(options?.pos2HemMidDeltaMm ?? 0);
  if ((dPos1 !== 0 || dPos2 !== 0) && !isFullCirclePiece) {
    const kpW = keyPoints.find((k) => k.code === "P2");
    if (kpW && dPos1 !== 0) {
      kpW.point = pt(kpW.point.x, kpW.point.y + dPos1);
    }
    const kpH = keyPoints.find((k) => k.code === "P5");
    if (kpH && dPos2 !== 0) {
      kpH.point = pt(kpH.point.x, kpH.point.y + dPos2);
    }
    const nW = notches.find((n) => n.id === "skirt-notch-cf-waist");
    if (nW && dPos1 !== 0) {
      nW.point = pt(nW.point.x, nW.point.y + dPos1);
      if (nW.cutPoint) nW.cutPoint = pt(nW.cutPoint.x, nW.cutPoint.y + dPos1);
    }
    const nH = notches.find((n) => n.id === "skirt-notch-cf-hem");
    if (nH && dPos2 !== 0) {
      nH.point = pt(nH.point.x, nH.point.y + dPos2);
      if (nH.cutPoint) nH.cutPoint = pt(nH.cutPoint.x, nH.cutPoint.y + dPos2);
    }
  }

  // Label anchor offset slightly right of grainline so text stays crisp
  const labelR = roundMm(rWaistMm + params.skirtLength * 10 * 0.48);
  const labelAnchor = pt(
    isFullCirclePiece ? rWaistMm + params.skirtLength * 10 * 0.35 : 0,
    isFullCirclePiece ? 0 : labelR
  );

  const bbox = computePathsBoundingBox(cutPaths);
  const sewPerimeterMm = roundMm(
    sewPaths.reduce((acc, p) => acc + computePathPerimeter(p), 0)
  );
  const cutPerimeterMm = roundMm(
    cutPaths.reduce((acc, p) => acc + computePathPerimeter(p), 0)
  );

  // Exact area of annular sector (including seam allowance approximation)
  const rOutArea = rHemMm + saMm;
  const rInArea = Math.max(2, rWaistMm - saMm);
  const areaMm2 = roundMm(
    Math.PI * (rOutArea * rOutArea - rInArea * rInArea) * (pieceAngleDeg / 360)
  );

  const cutNote =
    params.pieceMultiplier === 1
      ? "Cắt ×1 (Cut 1 — Self)"
      : "Cắt ×2 (Cut 2 — Front & Back)";

  const piece: PatternPiece = {
    id: "skirt-panel",
    code: "SKT-01",
    name: "Tùng váy xòe",
    englishName: "Flared Skirt Panel",
    cutQuantity: params.pieceMultiplier,
    cutNote,
    material: "self",
    sewPaths,
    cutPaths,
    internalPaths,
    notches,
    grainline,
    dimensions,
    labelAnchor,
    keyPoints,
    bbox,
    metrics: {
      widthMm: bbox.width,
      heightMm: bbox.height,
      perimeterMm: cutPerimeterMm,
      sewPerimeterMm,
      areaMm2,
    },
  };

  return { piece, warnings };
}

/**
 * Build Piece 2: Bản lưng 3.5 cm (Waistband — Straight or Curved)
 * Finished waist length matches body `waist` (since gathered skirt waist eases into the waistband).
 * Anchored symmetrically around X = 0 with top-center sew edge at `anchorTopY`.
 */
function buildWaistbandPiece(
  params: CircleSkirtParams,
  anchorTopY: number,
  options?: CircleSkirtGeometryOptions
): PatternPiece {
  const waistMm = roundMm(params.waist * 10);
  const heightMm = roundMm(WAISTBAND_HEIGHT_CM * 10); // 35.00 mm
  const saMm = roundMm(params.seamAllowance * 10);

  const sewPaths: VectorPath[] = [];
  const cutPaths: VectorPath[] = [];
  const internalPaths: VectorPath[] = [];
  const notches: Notch[] = [];
  const keyPoints: KeyPoint[] = [];
  const dimensions: DimensionCallout[] = [];

  let grainline = {
    start: pt(-waistMm * 0.25, anchorTopY + heightMm / 2),
    end: pt(waistMm * 0.25, anchorTopY + heightMm / 2),
    label: "Canh sợi ngang (Crosswise Grain)",
  };
  let labelAnchor = pt(0, anchorTopY + heightMm / 2);
  let areaMm2 = 0;

  if (params.waistbandType === "straight") {
    const halfW = roundMm(waistMm / 2);
    const yTop = roundMm(anchorTopY);
    const yBot = roundMm(anchorTopY + heightMm);

    // Sew rectangle (6 explicit vertices including Top-Mid & Bot-Mid for symmetric AAMA grading)
    sewPaths.push({
      id: "wb-sew-straight",
      kind: "sew",
      closed: true,
      label: "Đường may bản lưng thẳng (Straight Waistband Sew)",
      segments: [
        { type: "M", to: pt(-halfW, yTop) },
        { type: "L", to: pt(0, yTop) },
        { type: "L", to: pt(halfW, yTop) },
        { type: "L", to: pt(halfW, yBot) },
        { type: "L", to: pt(0, yBot) },
        { type: "L", to: pt(-halfW, yBot) },
        { type: "Z" },
      ],
    });

    // Cut rectangle (+ seam allowance all around, matching 6-vertex topology 1:1 with sew path)
    cutPaths.push({
      id: "wb-cut-straight",
      kind: "cut",
      closed: true,
      label: "Đường cắt bản lưng thẳng (Straight Waistband Cut)",
      segments: [
        { type: "M", to: pt(-halfW - saMm, yTop - saMm) },
        { type: "L", to: pt(0, yTop - saMm) },
        { type: "L", to: pt(halfW + saMm, yTop - saMm) },
        { type: "L", to: pt(halfW + saMm, yBot + saMm) },
        { type: "L", to: pt(0, yBot + saMm) },
        { type: "L", to: pt(-halfW - saMm, yBot + saMm) },
        { type: "Z" },
      ],
    });

    // Center Front line
    internalPaths.push({
      id: "wb-cf-line",
      kind: "internal",
      closed: false,
      label: "Đường giữa trước (CF)",
      segments: [
        { type: "M", to: pt(0, yTop) },
        { type: "L", to: pt(0, yBot) },
      ],
    });

    // Notches: CF (0) + Left/Right Side seams (-waist/4, +waist/4) along bottom attachment edge
    const notchXPositions: Array<{ x: number; label: string }> = [
      { x: 0, label: "Giữa trước (CF)" },
      { x: -halfW / 2, label: "Sườn trái (Left Side)" },
      { x: halfW / 2, label: "Sườn phải (Right Side)" },
    ];
    notchXPositions.forEach((n, i) => {
      notches.push({
        id: `wb-notch-bot-${i}`,
        point: pt(n.x, yBot),
        cutPoint: pt(n.x, yBot + saMm),
        angle: -Math.PI / 2, // pointing up into waistband
        depth: 4.5,
        style: "slit",
        label: n.label,
      });
    });
    // Top CF notch
    notches.push({
      id: "wb-notch-top-cf",
      point: pt(0, yTop),
      cutPoint: pt(0, yTop - saMm),
      angle: Math.PI / 2, // pointing down into waistband
      depth: 4.5,
      style: "slit",
      label: "Giữa trước mép trên (Top CF)",
    });

    keyPoints.push(
      {
        id: "wb-kp-1",
        code: "W1",
        label: "Đầu lưng trái (WB Left)",
        point: pt(-halfW, yTop),
      },
      {
        id: "wb-kp-2",
        code: "W2",
        label: "Giữa lưng (WB CF)",
        point: pt(0, yTop),
      },
      {
        id: "wb-kp-3",
        code: "W3",
        label: "Đầu lưng phải (WB Right)",
        point: pt(halfW, yTop),
      }
    );

    dimensions.push(
      {
        id: "dim-wb-len",
        from: pt(-halfW, yBot),
        to: pt(halfW, yBot),
        label: `L_lưng = ${roundCm(params.waist, 1)} cm`,
        kind: "linear",
        offsetMm: 28,
      },
      {
        id: "dim-wb-h",
        from: pt(halfW, yTop),
        to: pt(halfW, yBot),
        label: `${WAISTBAND_HEIGHT_CM} cm`,
        kind: "linear",
        offsetMm: 26,
      }
    );

    grainline = {
      start:
        options?.fixedWaistbandGrainline?.start ??
        pt(-Math.min(120, halfW * 0.45), yTop + heightMm / 2),
      end:
        options?.fixedWaistbandGrainline?.end ??
        pt(Math.min(120, halfW * 0.45), yTop + heightMm / 2),
      label: "Canh sợi dọc lưng (Waistband Grain)",
    };
    labelAnchor = pt(0, yTop + heightMm / 2);
    areaMm2 = roundMm((waistMm + 2 * saMm) * (heightMm + 2 * saMm));
  } else {
    // Curved (Contoured) Waistband — exact truncated cone frustum!
    // In industrial garment grading (Gerber AccuMark), all graded sizes S-M-L-XL share
    // the EXACT same curvature radius (R_top from Base Size) and extend symmetrically
    // at BOTH ends (-20mm left, +20mm right per size) so left & right ends match 100%!
    const contourFlareMm = 40;
    const defaultSweepRad = contourFlareMm / heightMm; // 40 / 35 ≈ 1.14286 rad
    const rTop = roundMm(
      options?.fixedWaistbandRTopMm ?? waistMm / defaultSweepRad
    );
    const sweepAngleRad = waistMm / rTop;
    const rBot = roundMm(rTop + heightMm);

    // Place arc center above anchorTopY so the top-center of the curved waistband sits at (0, anchorTopY)
    const arcCenter = pt(0, roundMm(anchorTopY - rTop));
    const midAngle = Math.PI / 2;
    const startAngle = midAngle - sweepAngleRad / 2;
    const endAngle = midAngle + sweepAngleRad / 2;

    sewPaths.push({
      id: "wb-sew-curved",
      kind: "sew",
      closed: true,
      label: "Đường may bản lưng cong (Curved Waistband Sew)",
      segments: createAnnularSectorSegments({
        center: arcCenter,
        innerRadius: rTop,
        outerRadius: rBot,
        startAngle,
        endAngle,
      }),
    });

    const wbOffset = createOffsetAnnularSectorSegments({
      center: arcCenter,
      innerRadius: rTop,
      outerRadius: rBot,
      startAngle,
      endAngle,
      innerSa: saMm,
      outerSa: saMm,
      sideSa: saMm,
    });

    cutPaths.push({
      id: "wb-cut-curved",
      kind: "cut",
      closed: true,
      label: "Đường cắt bản lưng cong (Curved Waistband Cut)",
      segments: wbOffset.segments,
    });

    // Center Front line
    internalPaths.push({
      id: "wb-cf-line",
      kind: "internal",
      closed: false,
      label: "Đường giữa trước (CF)",
      segments: [
        { type: "M", to: polarPoint(arcCenter, rTop, midAngle) },
        { type: "L", to: polarPoint(arcCenter, rBot, midAngle) },
      ],
    });

    // Notches along bottom attachment arc (CF, Left Side, Right Side) + top CF
    const wbNotchAngles = [
      { a: midAngle, label: "Giữa trước (CF)" },
      { a: startAngle + sweepAngleRad * 0.25, label: "Sườn phải (Right Side)" },
      { a: startAngle + sweepAngleRad * 0.75, label: "Sườn trái (Left Side)" },
    ];
    wbNotchAngles.forEach((item, i) => {
      notches.push({
        id: `wb-notch-bot-${i}`,
        point: polarPoint(arcCenter, rBot, item.a),
        cutPoint: polarPoint(arcCenter, wbOffset.outerCutRadius, item.a),
        angle: item.a + Math.PI, // inward toward center
        depth: 4.5,
        style: "slit",
        label: item.label,
      });
    });
    notches.push({
      id: "wb-notch-top-cf",
      point: polarPoint(arcCenter, rTop, midAngle),
      cutPoint: polarPoint(arcCenter, wbOffset.innerCutRadius, midAngle),
      angle: midAngle, // inward away from center
      depth: 4.5,
      style: "slit",
      label: "Giữa trước mép trên (Top CF)",
    });

    keyPoints.push(
      {
        id: "wb-kp-1",
        code: "W1",
        label: "Đầu lưng phải (WB Start)",
        point: polarPoint(arcCenter, rTop, startAngle),
      },
      {
        id: "wb-kp-2",
        code: "W2",
        label: "Giữa lưng (WB CF)",
        point: polarPoint(arcCenter, rTop, midAngle),
      },
      {
        id: "wb-kp-3",
        code: "W3",
        label: "Đầu lưng trái (WB End)",
        point: polarPoint(arcCenter, rTop, endAngle),
      }
    );

    const midR = roundMm(rTop + heightMm / 2);
    const grainHalfLen = Math.min(110, roundMm(waistMm * 0.16));
    const grainY = roundMm(anchorTopY + heightMm / 2);
    grainline = {
      start: options?.fixedWaistbandGrainline?.start ?? pt(-grainHalfLen, grainY),
      end: options?.fixedWaistbandGrainline?.end ?? pt(grainHalfLen, grainY),
      label: "Canh sợi ngang (CF Perpendicular)",
    };
    labelAnchor = polarPoint(arcCenter, midR, midAngle);

    dimensions.push({
      id: "dim-wb-h",
      from: polarPoint(arcCenter, rTop, startAngle),
      to: polarPoint(arcCenter, rBot, startAngle),
      label: `${WAISTBAND_HEIGHT_CM} cm (Cong)`,
      kind: "linear",
      offsetMm: -22,
    });

    areaMm2 = roundMm(
      0.5 *
        sweepAngleRad *
        (wbOffset.outerCutRadius ** 2 - wbOffset.innerCutRadius ** 2)
    );
  }

  const bbox = computePathsBoundingBox(cutPaths);
  const sewPerimeterMm = roundMm(
    sewPaths.reduce((acc, p) => acc + computePathPerimeter(p), 0)
  );
  const cutPerimeterMm = roundMm(
    cutPaths.reduce((acc, p) => acc + computePathPerimeter(p), 0)
  );

  return {
    id: "waistband",
    code: "WB-01",
    name:
      params.waistbandType === "straight"
        ? "Bản lưng thẳng (3.5 cm)"
        : "Bản lưng cong (3.5 cm)",
    englishName:
      params.waistbandType === "straight"
        ? "Straight Waistband (3.5cm)"
        : "Curved Waistband (3.5cm)",
    cutQuantity: 2,
    cutNote: "Cắt ×2 (Cut 2 — Self + Facing/Interfacing)",
    material: "self",
    sewPaths,
    cutPaths,
    internalPaths,
    notches,
    grainline,
    dimensions,
    labelAnchor,
    keyPoints,
    bbox,
    metrics: {
      widthMm: bbox.width,
      heightMm: bbox.height,
      perimeterMm: cutPerimeterMm,
      sewPerimeterMm,
      areaMm2,
    },
  };
}

/**
 * Generate full 2D CAD geometry for the Flared Circle Skirt template (Skirt Panel + Waistband).
 */
export function generateCircleSkirtGeometry(
  rawParams: ParamValues,
  options?: CircleSkirtGeometryOptions
): PatternGeometryResult {
  const params = parseCircleSkirtParams(rawParams);
  const radii = computeCircleSkirtRadii(params);

  const { piece: skirtPiece, warnings } = buildSkirtPanelPiece(
    params,
    radii,
    options
  );

  // Position waistband neatly below skirt panel (accounting for upward tip rise of curved waistband)
  const rTopForRise =
    options?.fixedWaistbandRTopMm ??
    (params.waist * 10) / (40 / (WAISTBAND_HEIGHT_CM * 10));
  const sweepForRise = (params.waist * 10) / rTopForRise;
  const curvedRiseMm =
    params.waistbandType === "curved"
      ? roundMm(
          rTopForRise * (1 - Math.cos(sweepForRise / 2)) +
            params.seamAllowance * 10
        )
      : roundMm(params.seamAllowance * 10);

  const waistbandAnchorTopY =
    options?.waistbandTopY !== undefined
      ? options.waistbandTopY
      : roundMm(skirtPiece.bbox.maxY + 95 + curvedRiseMm);

  const waistbandPiece = buildWaistbandPiece(
    params,
    waistbandAnchorTopY,
    options
  );

  const pieces = [skirtPiece, waistbandPiece];
  const bbox = mergeBoundingBoxes(pieces.map((p) => p.bbox));

  const formulas: FormulaItem[] = [
    {
      id: "effective-waist",
      symbol: "C_eo",
      label: "Chu vi eo thực tế (Effective Waist)",
      expression: "waist × gatherRatio",
      substitution: `${params.waist} × ${params.gatherRatio}`,
      valueCm: roundCm(radii.effectiveWaistCm, 2),
      valueMm: radii.effectiveWaistMm,
    },
    {
      id: "r-waist",
      symbol: "R_waist",
      label: "Bán kính vòng eo (Waist Radius)",
      expression: "(waist × gatherRatio) / (2π × flareAngle / 360)",
      substitution: `${roundCm(radii.effectiveWaistCm, 2)} / (2π × ${params.flareAngle}/360)`,
      valueCm: roundCm(radii.rWaistCm, 2),
      valueMm: radii.rWaistMm,
    },
    {
      id: "r-hem",
      symbol: "R_hem",
      label: "Bán kính lai váy (Hem Radius)",
      expression: "R_waist + skirtLength",
      substitution: `${roundCm(radii.rWaistCm, 2)} + ${params.skirtLength}`,
      valueCm: roundCm(radii.rHemCm, 2),
      valueMm: radii.rHemMm,
    },
    {
      id: "piece-angle",
      symbol: "θ_mảnh",
      label: "Góc cung mỗi mảnh (Panel Sector Angle)",
      expression: "flareAngle / pieceMultiplier",
      substitution: `${params.flareAngle}° / ${params.pieceMultiplier}`,
      valueCm: radii.pieceAngleDeg,
      valueMm: radii.pieceAngleDeg,
      displayValue: `${radii.pieceAngleDeg}° (Cung lai: ${radii.pieceArcHemCm} cm)`,
    },
  ];

  // Practical garment production estimates
  const totalAreaM2 = roundCm(
    (skirtPiece.metrics.areaMm2 * skirtPiece.cutQuantity +
      waistbandPiece.metrics.areaMm2 * waistbandPiece.cutQuantity) /
      1_000_000,
    3
  );
  const estimatedFabricWidthCm = roundCm(
    Math.max(skirtPiece.bbox.width, waistbandPiece.bbox.width) / 10,
    1
  );
  const estimatedFabricLengthCm = roundCm(
    (skirtPiece.bbox.height * params.pieceMultiplier +
      waistbandPiece.bbox.height * 2 +
      60) /
      10,
    1
  );

  return {
    pieces,
    formulas,
    warnings,
    bbox,
    summary: {
      totalCutPieces: skirtPiece.cutQuantity + waistbandPiece.cutQuantity,
      estimatedFabricWidthCm,
      estimatedFabricLengthCm,
      totalAreaM2,
      metadata: {
        rWaistCm: roundCm(radii.rWaistCm, 2),
        rHemCm: roundCm(radii.rHemCm, 2),
        effectiveWaistCm: radii.effectiveWaistCm,
        pieceAngleDeg: radii.pieceAngleDeg,
      },
    },
  };
}
