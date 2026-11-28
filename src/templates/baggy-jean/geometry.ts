import {
  computePathPerimeter,
  computePathsBoundingBox,
  createAnnularSectorSegments,
  createOffsetAnnularSectorSegments,
  mergeBoundingBoxes,
  polarPoint,
  pt,
  roundCm,
  roundMm,
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
import { parseBaggyJeanParams, type BaggyJeanParams } from "./schema";

export interface BaggyJeanGeometryOptions {
  /** Shared X offset for Back Panel so nested sizes align cleanly */
  backOriginX?: number;
  /** Shared Y anchor for secondary pieces (Waistband, Yoke, Pockets) below legs */
  auxAnchorY?: number;
  /** Fixed curved waistband inner radius from Base Size for symmetric Gerber grading */
  fixedWaistbandRTopMm?: number;
  /** Frozen grainlines per piece ID (from Base Size) so Gerber AccuMark keeps all graded sizes locked */
  fixedGrainlines?: Record<string, { start: Point2D; end: Point2D }>;
}

/**
 * Compute exact outward polygon normal offset for simple polygonal contours (for patch pockets, yoke, belt loop).
 * Supports per-edge custom seam allowance (e.g. wider hem fold at pocket top edge).
 */
function offsetClosedPolygon(
  verts: Point2D[],
  edgeOffsets: number[]
): Point2D[] {
  const n = verts.length;
  // Determine signed area (in Y-down SVG coords: positive = clockwise, negative = CCW)
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
    // Outward normal
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

function approxPolygonAreaMm2(verts: Point2D[]): number {
  let area2 = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    area2 += a.x * b.y - b.x * a.y;
  }
  return roundMm(Math.abs(area2) / 2);
}

/**
 * PIECE 1: FRT-01 — THÂN TRƯỚC QUẦN JEAN SUPER BAGGY (Front Panel — Cut ×2)
 * Coordinate system:
 * - Center crease / Grainline along X = 0
 * - Crotch line at Y = 0 (waist sits at negative Y = -frontPanelRise, hem sits at +inseam)
 * - Right side (+X) = Center Front / Fly / Inseam
 * - Left side (-X) = Side Seam (Outseam)
 */
function buildFrontPanel(
  p: BaggyJeanParams,
  options?: BaggyJeanGeometryOptions
): PatternPiece {
  const sa = roundMm(p.seamAllowance * 10);
  const hemSa = roundMm(p.hemAllowance * 10 * 2); // Clean finished double-turn hem (5/8" x 2 = 31.75 mm)

  const panelRiseMm = roundMm(Math.max(100, (p.frontRise - p.waistbandHeight) * 10));
  const inseamMm = roundMm(p.inseam * 10);
  const hipY = -76.2; // 3" above crotch line per WV1499LSB-TD spec
  const thighY = 25.4; // 1" below crotch line per PP Fit Record
  const kneeY = 330.2; // 13" below crotch line per PP Fit Record

  // Front/Back distribution calibrated for authentic Super Baggy denim balance:
  // Front takes ~46% of waist/hip/knee/hem, ~44.5% of thigh (Back carries deeper seat hook)
  const frontWaistW = roundMm(p.waist * 10 * 0.242);
  const frontHipW = roundMm(p.hip * 10 * 0.24);
  const frontThighW = roundMm(p.thigh * 10 * 0.445);
  const frontKneeW = roundMm(p.knee * 10 * 0.465);
  const frontHemW = roundMm(p.hemOpening * 10 * 0.465);

  // Front crotch hook extension = ~18% of front thigh width
  const crotchHookMm = roundMm(Math.max(38, frontThighW * 0.175));
  const cfFlyX = roundMm(frontThighW * 0.5 - crotchHookMm);
  const waistSideX = roundMm(cfFlyX - frontWaistW);
  const hipSideX = roundMm(cfFlyX - frontHipW);

  const thighSideX = roundMm(-frontThighW * 0.5);
  const thighInseamX = roundMm(frontThighW * 0.5);
  const kneeSideX = roundMm(-frontKneeW * 0.5);
  const kneeInseamX = roundMm(frontKneeW * 0.5);
  const hemSideX = roundMm(-frontHemW * 0.5);
  const hemInseamX = roundMm(frontHemW * 0.5);

  // Slight anatomical center-front drop (10 mm) for low-rise contour comfort
  const yWaistCF = roundMm(-panelRiseMm + 10);
  const yWaistSS = roundMm(-panelRiseMm);
  const yCrotch = 0;

  // Key Finished Sew Vertices
  const pWaistSS = pt(waistSideX, yWaistSS);
  const pWaistCF = pt(cfFlyX, yWaistCF);
  const pFlyCurveStart = pt(cfFlyX, roundMm(hipY + 14));
  const pCrotchPt = pt(thighInseamX, yCrotch);
  const pThighIn = pt(thighInseamX, thighY);
  const pKneeIn = pt(kneeInseamX, kneeY);
  const pHemIn = pt(hemInseamX, inseamMm);
  const pHemMid = pt(0, inseamMm);
  const pHemSS = pt(hemSideX, inseamMm);
  const pKneeSS = pt(kneeSideX, kneeY);
  const pHipSS = pt(hipSideX, hipY);

  // Front crotch hook Bezier control points
  const c1Fly = pt(cfFlyX, roundMm(yCrotch - 6));
  const c2Fly = pt(roundMm(cfFlyX + crotchHookMm * 0.52), yCrotch);

  // Hip smooth Bezier control points (Side Seam from waist down to thigh)
  const c1Hip = pt(roundMm(hipSideX - 4), roundMm(yWaistSS + (hipY - yWaistSS) * 0.55));
  const c2Hip = pt(roundMm(Math.min(hipSideX, thighSideX)), roundMm(hipY + 42));

  const sewPath: VectorPath = {
    id: "frt-sew-main",
    kind: "sew",
    closed: true,
    label: "Đường may thân trước (Front Sew)",
    segments: [
      { type: "M", to: pWaistSS },
      { type: "L", to: pWaistCF },
      { type: "L", to: pFlyCurveStart },
      { type: "C", cp1: c1Fly, cp2: c2Fly, to: pCrotchPt },
      { type: "L", to: pKneeIn },
      { type: "L", to: pHemIn },
      { type: "L", to: pHemMid },
      { type: "L", to: pHemSS },
      { type: "L", to: pKneeSS },
      { type: "L", to: pt(thighSideX, thighY) },
      { type: "C", cp1: c2Hip, cp2: c1Hip, to: pWaistSS },
      { type: "Z" },
    ],
  };

  // Cut boundary (+ seam allowance around body, + clean finished hem fold at bottom)
  const cutPath: VectorPath = {
    id: "frt-cut-main",
    kind: "cut",
    closed: true,
    label: "Đường cắt thân trước (Front Cut)",
    segments: [
      { type: "M", to: pt(pWaistSS.x - sa, pWaistSS.y - sa) },
      { type: "L", to: pt(pWaistCF.x + sa, pWaistCF.y - sa) },
      { type: "L", to: pt(pFlyCurveStart.x + sa, pFlyCurveStart.y) },
      {
        type: "C",
        cp1: pt(c1Fly.x + sa, c1Fly.y - sa * 0.8),
        cp2: pt(c2Fly.x, c2Fly.y - sa),
        to: pt(pCrotchPt.x + sa, pCrotchPt.y - sa * 0.4),
      },
      { type: "L", to: pt(pKneeIn.x + sa, pKneeIn.y) },
      { type: "L", to: pt(pHemIn.x + sa, pHemIn.y + hemSa) },
      { type: "L", to: pt(pHemMid.x, pHemMid.y + hemSa) },
      { type: "L", to: pt(pHemSS.x - sa, pHemSS.y + hemSa) },
      { type: "L", to: pt(pKneeSS.x - sa, pKneeSS.y) },
      { type: "L", to: pt(thighSideX - sa, thighY) },
      {
        type: "C",
        cp1: pt(c2Hip.x - sa, c2Hip.y),
        cp2: pt(c1Hip.x - sa, c1Hip.y),
        to: pt(pWaistSS.x - sa, pWaistSS.y - sa),
      },
      { type: "Z" },
    ],
  };

  // Internal Construction Details from WV1499LSB-TD PDF Tech Pack:
  // 1. Front Scoop Pocket Opening: 4 1/4" (107.95mm) across top × 2 1/2" (63.5mm) down Side Seam
  const pktTopPt = pt(roundMm(pWaistSS.x + 107.95), roundMm(pWaistSS.y + 4));
  const pktSidePt = pt(roundMm(pWaistSS.x - 2), roundMm(pWaistSS.y + 63.5));
  // 2. J-Stitch Fly Line: 5" (127mm) length × 1 1/2" (38.1mm) width
  const jTop = pt(roundMm(pWaistCF.x - 38.1), pWaistCF.y);
  const jMid = pt(roundMm(pWaistCF.x - 38.1), roundMm(pWaistCF.y + 102));
  const jEnd = pt(pWaistCF.x, roundMm(pWaistCF.y + 127));
  // 3. Crease reference line & Knee horizontal reference line
  const internalPaths: VectorPath[] = [
    {
      id: "frt-pocket-scoop",
      kind: "internal",
      closed: false,
      label: 'Miệng túi trước (4 1/4" × 2 1/2")',
      segments: [
        { type: "M", to: pktTopPt },
        {
          type: "C",
          cp1: pt(roundMm(pktTopPt.x - 16), roundMm(pktTopPt.y + 42)),
          cp2: pt(roundMm(pktSidePt.x + 36), roundMm(pktSidePt.y + 2)),
          to: pktSidePt,
        },
      ],
    },
    {
      id: "frt-j-stitch",
      kind: "internal",
      closed: false,
      label: 'Đường diễu J-Stitch (5" × 1 1/2")',
      segments: [
        { type: "M", to: jTop },
        { type: "L", to: jMid },
        {
          type: "C",
          cp1: pt(jMid.x, roundMm(jEnd.y + 2)),
          cp2: pt(roundMm(jEnd.x - 12), jEnd.y),
          to: jEnd,
        },
      ],
    },
    {
      id: "frt-knee-line",
      kind: "internal",
      closed: false,
      label: 'Đường ngang gối (13" below crotch)',
      segments: [
        { type: "M", to: pKneeSS },
        { type: "L", to: pKneeIn },
      ],
    },
  ];

  // Notches: Zipper stop (4.5" = 114.3mm), Pocket scoop points, Hip, Knee Inseam & Side Seam
  const zipY = roundMm(pWaistCF.y + 114.3);
  const notches: Notch[] = [
    {
      id: "frt-notch-zipper",
      point: pt(cfFlyX, zipY),
      cutPoint: pt(cfFlyX + sa, zipY),
      angle: Math.PI, // inward left
      depth: 6,
      style: "T",
      label: 'Dấu dừng khóa kéo (4 1/2")',
    },
    {
      id: "frt-notch-pkt-top",
      point: pktTopPt,
      cutPoint: pt(pktTopPt.x, pWaistSS.y - sa),
      angle: Math.PI / 2,
      depth: 5,
      style: "slit",
      label: 'Dấu bấm miệng túi trên (4 1/4")',
    },
    {
      id: "frt-notch-knee-ss",
      point: pKneeSS,
      cutPoint: pt(pKneeSS.x - sa, pKneeSS.y),
      angle: 0,
      depth: 5,
      style: "slit",
      label: "Dấu bấm gối sườn ngoài",
    },
    {
      id: "frt-notch-knee-in",
      point: pKneeIn,
      cutPoint: pt(pKneeIn.x + sa, pKneeIn.y),
      angle: Math.PI,
      depth: 5,
      style: "slit",
      label: "Dấu bấm gối sườn trong",
    },
  ];

  const defaultGrain = {
    start: pt(0, roundMm(thighY + 90)),
    end: pt(0, roundMm(inseamMm - 140)),
  };
  const fixedG = options?.fixedGrainlines?.["front-panel"];

  const bbox = computePathsBoundingBox([cutPath]);
  const areaVerts = [
    pt(pWaistSS.x - sa, pWaistSS.y - sa),
    pt(pWaistCF.x + sa, pWaistCF.y - sa),
    pt(pCrotchPt.x + sa, pCrotchPt.y),
    pt(pHemIn.x + sa, pHemIn.y + hemSa),
    pt(pHemSS.x - sa, pHemSS.y + hemSa),
    pt(thighSideX - sa, thighY),
  ];

  return {
    id: "front-panel",
    code: "FRT-01",
    name: "Thân trước quần Jean",
    englishName: "Front Leg Panel",
    cutQuantity: 2,
    cutNote: "Cắt ×2 (Cut 2 — Self Pair)",
    material: "self",
    sewPaths: [sewPath],
    cutPaths: [cutPath],
    internalPaths,
    notches,
    grainline: {
      start: fixedG?.start ?? defaultGrain.start,
      end: fixedG?.end ?? defaultGrain.end,
      label: "Canh sợi dọc (Straight Grain)",
    },
    dimensions: [
      {
        id: "dim-frt-inseam",
        from: pThighIn,
        to: pHemIn,
        label: `Inseam = ${roundCm(p.inseam, 1)} cm`,
        kind: "linear",
        offsetMm: 28,
      },
      {
        id: "dim-frt-hem",
        from: pHemSS,
        to: pHemIn,
        label: `Ống trước = ${roundCm(frontHemW / 10, 1)} cm`,
        kind: "linear",
        offsetMm: 46,
      },
    ],
    labelAnchor: pt(0, roundMm(kneeY - 70)),
    keyPoints: [
      { id: "f-kp-1", code: "F1", label: "Eo sườn trước (Front Waist SS)", point: pWaistSS },
      { id: "f-kp-2", code: "F2", label: "Eo giữa trước (Front Waist CF)", point: pWaistCF },
      { id: "f-kp-3", code: "F3", label: "Đầu đáy trước (Front Crotch Pt)", point: pCrotchPt },
      { id: "f-kp-4", code: "F4", label: "Gối sườn trong (Front Knee In)", point: pKneeIn },
      { id: "f-kp-5", code: "F5", label: "Lai giữa ống (Front Hem Mid)", point: pHemMid },
      { id: "f-kp-6", code: "F6", label: "Mông sườn ngoài (Front Hip SS)", point: pHipSS },
    ],
    bbox,
    metrics: {
      widthMm: bbox.width,
      heightMm: bbox.height,
      perimeterMm: computePathPerimeter(cutPath),
      sewPerimeterMm: computePathPerimeter(sewPath),
      areaMm2: approxPolygonAreaMm2(areaVerts),
    },
  };
}

/**
 * PIECE 2: BCK-01 — THÂN SAU QUẦN JEAN (Back Panel below Yoke — Cut ×2)
 * Positioned cleanly to the right of Front Panel along crease X = originX.
 * Left side (-X relative to originX) = Center Back / Seat Hook / Inseam
 * Right side (+X relative to originX) = Side Seam (Outseam)
 */
function buildBackPanel(
  p: BaggyJeanParams,
  originX: number,
  options?: BaggyJeanGeometryOptions
): {
  piece: PatternPiece;
  yokeSeamCB: Point2D;
  yokeSeamSS: Point2D;
  topWaistCB: Point2D;
  topWaistSS: Point2D;
} {
  const sa = roundMm(p.seamAllowance * 10);
  const hemSa = roundMm(p.hemAllowance * 10 * 2);

  const fullBackRiseMm = roundMm(
    Math.max(180, (p.backRise - p.waistbandHeight) * 10)
  );
  const yokeCBMm = roundMm(p.backYokeCenter * 10);
  const yokeSSMm = roundMm(p.backYokeSide * 10);
  const inseamMm = roundMm(p.inseam * 10);

  const hipY = -76.2;
  const thighY = 25.4;
  const kneeY = 330.2;

  // Back carries ~55.5% of thigh (deep seat hook), ~53.5% of knee & hem opening
  const backWaistW = roundMm(p.waist * 10 * 0.258);
  const backHipW = roundMm(p.hip * 10 * 0.26);
  const backThighW = roundMm(p.thigh * 10 * 0.555);
  const backKneeW = roundMm(p.knee * 10 * 0.535);
  const backHemW = roundMm(p.hemOpening * 10 * 0.535);

  const backHookMm = roundMm(Math.max(76, backThighW * 0.255));
  const thighInseamX = roundMm(originX - backThighW * 0.5);
  const thighSideX = roundMm(originX + backThighW * 0.5);

  // Back seat slant tilts CB inward (~26mm) toward crease for anatomical seat angle
  const seatTiltMm = 26;
  const cbHipX = roundMm(thighInseamX + backHookMm);
  const cbTopWaistX = roundMm(cbHipX + seatTiltMm);
  const ssTopWaistX = roundMm(cbTopWaistX + backWaistW);
  const ssHipX = roundMm(cbHipX + backHipW);

  const kneeInseamX = roundMm(originX - backKneeW * 0.5);
  const kneeSideX = roundMm(originX + backKneeW * 0.5);
  const hemInseamX = roundMm(originX - backHemW * 0.5);
  const hemSideX = roundMm(originX + backHemW * 0.5);

  // Full Back Waist Top coordinates (before separating Back Yoke)
  const topWaistCB = pt(cbTopWaistX, roundMm(-fullBackRiseMm));
  const topWaistSS = pt(ssTopWaistX, roundMm(-fullBackRiseMm + 48));

  // Yoke Seam Line separating Back Yoke from Back Lower Panel
  const yokeSeamCB = pt(
    roundMm(cbTopWaistX - seatTiltMm * (yokeCBMm / fullBackRiseMm)),
    roundMm(topWaistCB.y + yokeCBMm)
  );
  const yokeSeamSS = pt(
    roundMm(ssTopWaistX + 4),
    roundMm(topWaistSS.y + yokeSSMm)
  );

  // Back Crotch Point drops ~8mm below horizontal crotch line for ease
  const pCrotchBack = pt(thighInseamX, 8);
  const pKneeIn = pt(kneeInseamX, kneeY);
  const pHemIn = pt(hemInseamX, inseamMm);
  const pHemMid = pt(originX, inseamMm);
  const pHemSS = pt(hemSideX, inseamMm);
  const pKneeSS = pt(kneeSideX, kneeY);
  const pThighSS = pt(thighSideX, thighY);
  const pHipSS = pt(ssHipX, hipY);

  // Deep smooth Back Crotch Curve Bezier
  const c1Seat = pt(roundMm(cbHipX - 10), roundMm(hipY + 78));
  const c2Seat = pt(roundMm(thighInseamX + backHookMm * 0.45), 10);

  // Back Side Seam hip curve
  const c1BackHip = pt(roundMm(ssHipX + 6), roundMm(hipY + 38));
  const c2BackHip = pt(roundMm(ssHipX + 4), roundMm(yokeSeamSS.y + (hipY - yokeSeamSS.y) * 0.55));

  const sewPath: VectorPath = {
    id: "bck-sew-main",
    kind: "sew",
    closed: true,
    label: "Đường may thân sau (Back Sew)",
    segments: [
      { type: "M", to: yokeSeamCB },
      { type: "L", to: yokeSeamSS },
      { type: "C", cp1: c2BackHip, cp2: c1BackHip, to: pThighSS },
      { type: "L", to: pKneeSS },
      { type: "L", to: pHemSS },
      { type: "L", to: pHemMid },
      { type: "L", to: pHemIn },
      { type: "L", to: pKneeIn },
      { type: "L", to: pCrotchBack },
      { type: "C", cp1: c2Seat, cp2: c1Seat, to: yokeSeamCB },
      { type: "Z" },
    ],
  };

  const cutPath: VectorPath = {
    id: "bck-cut-main",
    kind: "cut",
    closed: true,
    label: "Đường cắt thân sau (Back Cut)",
    segments: [
      { type: "M", to: pt(yokeSeamCB.x - sa, yokeSeamCB.y - sa) },
      { type: "L", to: pt(yokeSeamSS.x + sa, yokeSeamSS.y - sa) },
      {
        type: "C",
        cp1: pt(c2BackHip.x + sa, c2BackHip.y),
        cp2: pt(c1BackHip.x + sa, c1BackHip.y),
        to: pt(pThighSS.x + sa, pThighSS.y),
      },
      { type: "L", to: pt(pKneeSS.x + sa, pKneeSS.y) },
      { type: "L", to: pt(pHemSS.x + sa, pHemSS.y + hemSa) },
      { type: "L", to: pt(pHemMid.x, pHemMid.y + hemSa) },
      { type: "L", to: pt(pHemIn.x - sa, pHemIn.y + hemSa) },
      { type: "L", to: pt(pKneeIn.x - sa, pKneeIn.y) },
      { type: "L", to: pt(pCrotchBack.x - sa, pCrotchBack.y - sa * 0.4) },
      {
        type: "C",
        cp1: pt(c2Seat.x, c2Seat.y - sa),
        cp2: pt(c1Seat.x - sa, c1Seat.y),
        to: pt(yokeSeamCB.x - sa, yokeSeamCB.y - sa),
      },
      { type: "Z" },
    ],
  };

  // Back Patch Pocket Placement Outline from WV1499LSB-TD PP FIT RECORD:
  // 1 5/8" (41.3mm) from CB, 1 3/8" (34.9mm) below Yoke @CB, 1 5/8" (41.3mm) below Yoke @SS
  const bpTopW = 158.75; // 6 1/4"
  const bpBotW = 133.35; // 5 1/4"
  const bpSideL = 133.35; // 5 1/4"
  const bpPointL = 158.75; // 6 1/4"
  const bpTL = pt(roundMm(yokeSeamCB.x + 41.3), roundMm(yokeSeamCB.y + 34.9));
  const bpTR = pt(roundMm(bpTL.x + bpTopW), roundMm(yokeSeamSS.y + 41.3));
  const bpMidX = roundMm((bpTL.x + bpTR.x) / 2);
  const bpTopYMid = roundMm((bpTL.y + bpTR.y) / 2);
  const bpBR = pt(roundMm(bpMidX + bpBotW / 2), roundMm(bpTR.y + bpSideL));
  const bpBL = pt(roundMm(bpMidX - bpBotW / 2), roundMm(bpTL.y + bpSideL));
  const bpTip = pt(bpMidX, roundMm(bpTopYMid + bpPointL));

  const internalPaths: VectorPath[] = [
    {
      id: "bck-pkt-placement",
      kind: "internal",
      closed: true,
      label: 'Vị trí dán túi sau (1 5/8" fm CB • 1 3/8" fm Yoke)',
      segments: [
        { type: "M", to: bpTL },
        { type: "L", to: bpTR },
        { type: "L", to: bpBR },
        { type: "L", to: bpTip },
        { type: "L", to: bpBL },
        { type: "Z" },
      ],
    },
    {
      id: "bck-knee-line",
      kind: "internal",
      closed: false,
      label: 'Đường ngang gối (13" below crotch)',
      segments: [
        { type: "M", to: pKneeIn },
        { type: "L", to: pKneeSS },
      ],
    },
  ];

  const yokeMidPt = pt(
    roundMm((yokeSeamCB.x + yokeSeamSS.x) / 2),
    roundMm((yokeSeamCB.y + yokeSeamSS.y) / 2)
  );

  const notches: Notch[] = [
    {
      id: "bck-notch-yoke-mid",
      point: yokeMidPt,
      cutPoint: pt(yokeMidPt.x, yokeMidPt.y - sa),
      angle: Math.PI / 2,
      depth: 5,
      style: "slit",
      label: "Dấu bấm khớp đô sau (Back Yoke Match)",
    },
    {
      id: "bck-notch-knee-in",
      point: pKneeIn,
      cutPoint: pt(pKneeIn.x - sa, pKneeIn.y),
      angle: 0,
      depth: 5,
      style: "slit",
      label: "Dấu bấm gối sườn trong",
    },
    {
      id: "bck-notch-knee-ss",
      point: pKneeSS,
      cutPoint: pt(pKneeSS.x + sa, pKneeSS.y),
      angle: Math.PI,
      depth: 5,
      style: "slit",
      label: "Dấu bấm gối sườn ngoài",
    },
  ];

  const defaultGrain = {
    start: pt(originX, roundMm(thighY + 90)),
    end: pt(originX, roundMm(inseamMm - 140)),
  };
  const fixedG = options?.fixedGrainlines?.["back-panel"];

  const bbox = computePathsBoundingBox([cutPath]);
  const areaVerts = [
    pt(yokeSeamCB.x - sa, yokeSeamCB.y - sa),
    pt(yokeSeamSS.x + sa, yokeSeamSS.y - sa),
    pt(pThighSS.x + sa, pThighSS.y),
    pt(pHemSS.x + sa, pHemSS.y + hemSa),
    pt(pHemIn.x - sa, pHemIn.y + hemSa),
    pt(pCrotchBack.x - sa, pCrotchBack.y),
  ];

  const piece: PatternPiece = {
    id: "back-panel",
    code: "BCK-01",
    name: "Thân sau quần Jean",
    englishName: "Back Leg Panel",
    cutQuantity: 2,
    cutNote: "Cắt ×2 (Cut 2 — Self Pair)",
    material: "self",
    sewPaths: [sewPath],
    cutPaths: [cutPath],
    internalPaths,
    notches,
    grainline: {
      start: fixedG?.start ?? defaultGrain.start,
      end: fixedG?.end ?? defaultGrain.end,
      label: "Canh sợi dọc (Straight Grain)",
    },
    dimensions: [
      {
        id: "dim-bck-hem",
        from: pHemIn,
        to: pHemSS,
        label: `Ống sau = ${roundCm(backHemW / 10, 1)} cm`,
        kind: "linear",
        offsetMm: 46,
      },
    ],
    labelAnchor: pt(originX, roundMm(kneeY - 70)),
    keyPoints: [
      { id: "b-kp-1", code: "B1", label: "Đường đô giữa sau (Back Yoke CB)", point: yokeSeamCB },
      { id: "b-kp-2", code: "B2", label: "Đường đô sườn (Back Yoke SS)", point: yokeSeamSS },
      { id: "b-kp-3", code: "B3", label: "Mông sườn ngoài (Back Hip SS)", point: pHipSS },
      { id: "b-kp-4", code: "B4", label: "Lai giữa ống sau (Back Hem Mid)", point: pHemMid },
      { id: "b-kp-5", code: "B5", label: "Gối sườn trong (Back Knee In)", point: pKneeIn },
      { id: "b-kp-6", code: "B6", label: "Đầu đáy sau (Back Crotch Pt)", point: pCrotchBack },
    ],
    bbox,
    metrics: {
      widthMm: bbox.width,
      heightMm: bbox.height,
      perimeterMm: computePathPerimeter(cutPath),
      sewPerimeterMm: computePathPerimeter(sewPath),
      areaMm2: approxPolygonAreaMm2(areaVerts),
    },
  };

  return { piece, yokeSeamCB, yokeSeamSS, topWaistCB, topWaistSS };
}

/**
 * PIECE 3: YKE-01 — ĐÔ SAU (Back Yoke — Cut ×2)
 * Exact WV1499LSB-TD wedge: Center Back 2.0" (50.8mm) → Side Seam 3/4" (19.05mm).
 * Supports *Change Grainlines (R&D Note from PP Fit Record).
 */
function buildBackYokePiece(
  p: BaggyJeanParams,
  originX: number,
  topY: number,
  options?: BaggyJeanGeometryOptions
): PatternPiece {
  const sa = roundMm(p.seamAllowance * 10);
  const yokeW = roundMm(p.waist * 10 * 0.265);
  const hCB = roundMm(p.backYokeCenter * 10);
  const hSS = roundMm(p.backYokeSide * 10);

  // Horizontal yoke oriented cleanly: left = CB (tall 50.8mm), right = SS (narrow 19.05mm)
  const xL = roundMm(originX - yokeW / 2);
  const xR = roundMm(originX + yokeW / 2);
  const v0 = pt(xL, topY); // Top CB
  const v1 = pt(xR, roundMm(topY + 12)); // Top SS (slight contour slope)
  const v2 = pt(xR, roundMm(topY + 12 + hSS)); // Bot SS
  const v3 = pt(xL, roundMm(topY + hCB)); // Bot CB

  const sewVerts = [v0, v1, v2, v3];
  const cutVerts = offsetClosedPolygon(sewVerts, [sa, sa, sa, sa]);

  const sewPath: VectorPath = {
    id: "yke-sew",
    kind: "sew",
    closed: true,
    segments: [
      { type: "M", to: sewVerts[0] },
      { type: "L", to: sewVerts[1] },
      { type: "L", to: sewVerts[2] },
      { type: "L", to: sewVerts[3] },
      { type: "Z" },
    ],
  };

  const cutPath: VectorPath = {
    id: "yke-cut",
    kind: "cut",
    closed: true,
    segments: [
      { type: "M", to: cutVerts[0] },
      { type: "L", to: cutVerts[1] },
      { type: "L", to: cutVerts[2] },
      { type: "L", to: cutVerts[3] },
      { type: "Z" },
    ],
  };

  const midY = roundMm(topY + (hCB + hSS) / 3);
  const defaultGrain = p.revisedGrainlines
    ? {
        // *Change Grainlines R&D Note: cross-grain along yoke width
        start: pt(roundMm(originX - yokeW * 0.32), midY),
        end: pt(roundMm(originX + yokeW * 0.32), midY),
      }
    : {
        start: pt(originX, roundMm(topY + 6)),
        end: pt(originX, roundMm(topY + hCB - 6)),
      };
  const fixedG = options?.fixedGrainlines?.["back-yoke"];

  const botMid = pt(originX, roundMm((v2.y + v3.y) / 2));
  const bbox = computePathsBoundingBox([cutPath]);

  return {
    id: "back-yoke",
    code: "YKE-01",
    name: 'Đô sau (2" / 3/4")',
    englishName: "Back Yoke",
    cutQuantity: 2,
    cutNote: "Cắt ×2 (Cut 2 — Self Pair)",
    material: "self",
    sewPaths: [sewPath],
    cutPaths: [cutPath],
    internalPaths: [],
    notches: [
      {
        id: "yke-notch-mid",
        point: botMid,
        cutPoint: pt(botMid.x, botMid.y + sa),
        angle: -Math.PI / 2,
        depth: 5,
        style: "slit",
        label: "Dấu bấm khớp thân sau",
      },
    ],
    grainline: {
      start: fixedG?.start ?? defaultGrain.start,
      end: fixedG?.end ?? defaultGrain.end,
      label: p.revisedGrainlines
        ? "Canh sợi ngang (*Change Grainlines R&D)"
        : "Canh sợi dọc (Straight Grain)",
    },
    dimensions: [],
    labelAnchor: pt(originX, midY),
    keyPoints: [
      { id: "y-kp-1", code: "Y1", label: "Đô giữa sau trên (Yoke CB Top)", point: v0 },
      { id: "y-kp-2", code: "Y2", label: "Đô sườn trên (Yoke SS Top)", point: v1 },
      { id: "y-kp-3", code: "Y3", label: "Đô giữa sau dưới (Yoke CB Bot)", point: v3 },
    ],
    bbox,
    metrics: {
      widthMm: bbox.width,
      heightMm: bbox.height,
      perimeterMm: computePathPerimeter(cutPath),
      sewPerimeterMm: computePathPerimeter(sewPath),
      areaMm2: approxPolygonAreaMm2(cutVerts),
    },
  };
}

/**
 * PIECE 4: WBD-01 — CẠP LƯNG CONG 1 5/8" (Contour Waistband — Cut ×2)
 * Finished length = waist + 38.1mm (1.5" fly underlap extension), height = 41.3mm (1 5/8").
 */
function buildJeanWaistbandPiece(
  p: BaggyJeanParams,
  centerX: number,
  anchorTopY: number,
  options?: BaggyJeanGeometryOptions
): PatternPiece {
  const sa = roundMm(p.seamAllowance * 10);
  const flyExtMm = 38.1; // 1.5" button/fly underlap
  const totalLenMm = roundMm(p.waist * 10 + flyExtMm);
  const heightMm = roundMm(p.waistbandHeight * 10);

  const sewPaths: VectorPath[] = [];
  const cutPaths: VectorPath[] = [];
  const internalPaths: VectorPath[] = [];
  const notches: Notch[] = [];
  let grainline = {
    start: pt(centerX - 110, anchorTopY + heightMm / 2),
    end: pt(centerX + 110, anchorTopY + heightMm / 2),
    label: "Canh sợi ngang cạp (Waistband Grain)",
  };
  let labelAnchor = pt(centerX, anchorTopY + heightMm / 2);
  let areaMm2 = 0;
  let keyPoints: PatternPiece["keyPoints"] = [];

  if (p.waistbandType === "straight") {
    const halfW = roundMm(totalLenMm / 2);
    const yT = roundMm(anchorTopY);
    const yB = roundMm(anchorTopY + heightMm);

    sewPaths.push({
      id: "wbd-sew-straight",
      kind: "sew",
      closed: true,
      segments: [
        { type: "M", to: pt(centerX - halfW, yT) },
        { type: "L", to: pt(centerX, yT) },
        { type: "L", to: pt(centerX + halfW, yT) },
        { type: "L", to: pt(centerX + halfW, yB) },
        { type: "L", to: pt(centerX, yB) },
        { type: "L", to: pt(centerX - halfW, yB) },
        { type: "Z" },
      ],
    });

    cutPaths.push({
      id: "wbd-cut-straight",
      kind: "cut",
      closed: true,
      segments: [
        { type: "M", to: pt(centerX - halfW - sa, yT - sa) },
        { type: "L", to: pt(centerX, yT - sa) },
        { type: "L", to: pt(centerX + halfW + sa, yT - sa) },
        { type: "L", to: pt(centerX + halfW + sa, yB + sa) },
        { type: "L", to: pt(centerX, yB + sa) },
        { type: "L", to: pt(centerX - halfW - sa, yB + sa) },
        { type: "Z" },
      ],
    });

    notches.push(
      {
        id: "wbd-notch-cb",
        point: pt(centerX, yB),
        cutPoint: pt(centerX, yB + sa),
        angle: -Math.PI / 2,
        depth: 5,
        style: "slit",
        label: "Giữa sau (CB)",
      },
      {
        id: "wbd-notch-fly-ext",
        point: pt(centerX + halfW - flyExtMm, yB),
        cutPoint: pt(centerX + halfW - flyExtMm, yB + sa),
        angle: -Math.PI / 2,
        depth: 5,
        style: "T",
        label: 'Điểm cài nút 27L (CF Overlap 1.5")',
      }
    );

    keyPoints = [
      { id: "w-kp-1", code: "W1", label: "Đầu cạp trái (WB Left)", point: pt(centerX - halfW, yT) },
      { id: "w-kp-2", code: "W2", label: "Giữa cạp (WB CB)", point: pt(centerX, yT) },
      { id: "w-kp-3", code: "W3", label: "Đầu cạp phải (WB Right)", point: pt(centerX + halfW, yT) },
    ];
    areaMm2 = roundMm((totalLenMm + 2 * sa) * (heightMm + 2 * sa));
  } else {
    // Low-rise contour waistband (truncated cone frustum: 4.5 cm flare over 4.13 cm height)
    const defaultSweep = 45 / heightMm;
    const rTop = roundMm(
      options?.fixedWaistbandRTopMm ?? totalLenMm / defaultSweep
    );
    const sweepRad = totalLenMm / rTop;
    const rBot = roundMm(rTop + heightMm);
    const arcCenter = pt(centerX, roundMm(anchorTopY - rTop));
    const midAngle = Math.PI / 2;
    const startAngle = midAngle - sweepRad / 2;
    const endAngle = midAngle + sweepRad / 2;

    sewPaths.push({
      id: "wbd-sew-curved",
      kind: "sew",
      closed: true,
      segments: createAnnularSectorSegments({
        center: arcCenter,
        innerRadius: rTop,
        outerRadius: rBot,
        startAngle,
        endAngle,
      }),
    });

    const offsetRes = createOffsetAnnularSectorSegments({
      center: arcCenter,
      innerRadius: rTop,
      outerRadius: rBot,
      startAngle,
      endAngle,
      innerSa: sa,
      outerSa: sa,
      sideSa: sa,
    });

    cutPaths.push({
      id: "wbd-cut-curved",
      kind: "cut",
      closed: true,
      segments: offsetRes.segments,
    });

    internalPaths.push({
      id: "wbd-cb-line",
      kind: "internal",
      closed: false,
      segments: [
        { type: "M", to: polarPoint(arcCenter, rTop, midAngle) },
        { type: "L", to: polarPoint(arcCenter, rBot, midAngle) },
      ],
    });

    notches.push(
      {
        id: "wbd-notch-cb",
        point: polarPoint(arcCenter, rBot, midAngle),
        cutPoint: polarPoint(arcCenter, offsetRes.outerCutRadius, midAngle),
        angle: midAngle + Math.PI,
        depth: 5,
        style: "slit",
        label: "Giữa sau (CB)",
      },
      {
        id: "wbd-notch-ss-r",
        point: polarPoint(arcCenter, rBot, startAngle + sweepRad * 0.25),
        cutPoint: polarPoint(arcCenter, offsetRes.outerCutRadius, startAngle + sweepRad * 0.25),
        angle: startAngle + sweepRad * 0.25 + Math.PI,
        depth: 5,
        style: "slit",
        label: "Dấu bấm sườn phải",
      },
      {
        id: "wbd-notch-ss-l",
        point: polarPoint(arcCenter, rBot, startAngle + sweepRad * 0.75),
        cutPoint: polarPoint(arcCenter, offsetRes.outerCutRadius, startAngle + sweepRad * 0.75),
        angle: startAngle + sweepRad * 0.75 + Math.PI,
        depth: 5,
        style: "slit",
        label: "Dấu bấm sườn trái",
      }
    );

    keyPoints = [
      { id: "w-kp-1", code: "W1", label: "Đầu cạp phải (WB Start)", point: polarPoint(arcCenter, rTop, startAngle) },
      { id: "w-kp-2", code: "W2", label: "Giữa cạp (WB CB)", point: polarPoint(arcCenter, rTop, midAngle) },
      { id: "w-kp-3", code: "W3", label: "Đầu cạp trái (WB End)", point: polarPoint(arcCenter, rTop, endAngle) },
    ];

    labelAnchor = polarPoint(arcCenter, roundMm(rTop + heightMm / 2), midAngle);
    areaMm2 = roundMm(
      0.5 *
        sweepRad *
        (offsetRes.outerCutRadius ** 2 - offsetRes.innerCutRadius ** 2)
    );
  }

  const fixedG = options?.fixedGrainlines?.["waistband"];
  grainline = {
    start: fixedG?.start ?? pt(centerX - 110, roundMm(anchorTopY + heightMm / 2)),
    end: fixedG?.end ?? pt(centerX + 110, roundMm(anchorTopY + heightMm / 2)),
    label: "Canh sợi cạp (Contour Waistband Grain)",
  };

  const bbox = computePathsBoundingBox(cutPaths);

  return {
    id: "waistband",
    code: "WBD-01",
    name:
      p.waistbandType === "curved"
        ? `Cạp lưng cong (${roundCm(p.waistbandHeight, 1)} cm)`
        : `Cạp lưng thẳng (${roundCm(p.waistbandHeight, 1)} cm)`,
    englishName:
      p.waistbandType === "curved"
        ? 'Contour Waistband (1 5/8")'
        : 'Straight Waistband (1 5/8")',
    cutQuantity: 2,
    cutNote: "Cắt ×2 (Cut 2 — Outer + Inner Band)",
    material: "self",
    sewPaths,
    cutPaths,
    internalPaths,
    notches,
    grainline,
    dimensions: [],
    labelAnchor,
    keyPoints,
    bbox,
    metrics: {
      widthMm: bbox.width,
      heightMm: bbox.height,
      perimeterMm: roundMm(
        cutPaths.reduce((s, cp) => s + computePathPerimeter(cp), 0)
      ),
      sewPerimeterMm: roundMm(
        sewPaths.reduce((s, sp) => s + computePathPerimeter(sp), 0)
      ),
      areaMm2,
    },
  };
}

/**
 * Helper for standard 5-Pocket Denim Detail Pieces (Back Patch Pocket, Coin Pocket, Fly Shield, Belt Loop)
 */
function buildPentagonPocketPiece(cfg: {
  id: string;
  code: string;
  name: string;
  englishName: string;
  cutQuantity: number;
  cutNote: string;
  centerX: number;
  topY: number;
  topW: number;
  botW: number;
  sideL: number;
  pointL: number;
  sa: number;
  topTurnMm: number;
}): PatternPiece {
  const halfT = roundMm(cfg.topW / 2);
  const halfB = roundMm(cfg.botW / 2);
  const v0 = pt(cfg.centerX - halfT, cfg.topY);
  const v1 = pt(cfg.centerX + halfT, cfg.topY);
  const v2 = pt(cfg.centerX + halfB, roundMm(cfg.topY + cfg.sideL));
  const v3 = pt(cfg.centerX, roundMm(cfg.topY + cfg.pointL));
  const v4 = pt(cfg.centerX - halfB, roundMm(cfg.topY + cfg.sideL));

  const sewVerts = [v0, v1, v2, v3, v4];
  const cutVerts = offsetClosedPolygon(sewVerts, [
    cfg.topTurnMm,
    cfg.sa,
    cfg.sa,
    cfg.sa,
    cfg.sa,
  ]);

  const sewPath: VectorPath = {
    id: `${cfg.id}-sew`,
    kind: "sew",
    closed: true,
    segments: [
      { type: "M", to: sewVerts[0] },
      ...sewVerts.slice(1).map((p) => ({ type: "L" as const, to: p })),
      { type: "Z" },
    ],
  };

  const cutPath: VectorPath = {
    id: `${cfg.id}-cut`,
    kind: "cut",
    closed: true,
    segments: [
      { type: "M", to: cutVerts[0] },
      ...cutVerts.slice(1).map((p) => ({ type: "L" as const, to: p })),
      { type: "Z" },
    ],
  };

  const bbox = computePathsBoundingBox([cutPath]);
  return {
    id: cfg.id,
    code: cfg.code,
    name: cfg.name,
    englishName: cfg.englishName,
    cutQuantity: cfg.cutQuantity,
    cutNote: cfg.cutNote,
    material: "self",
    sewPaths: [sewPath],
    cutPaths: [cutPath],
    internalPaths: [
      {
        id: `${cfg.id}-fold`,
        kind: "fold",
        closed: false,
        segments: [
          { type: "M", to: v0 },
          { type: "L", to: v1 },
        ],
      },
    ],
    notches: [
      {
        id: `${cfg.id}-notch-l`,
        point: v0,
        cutPoint: pt(v0.x - cfg.sa, v0.y),
        angle: 0,
        depth: 4,
        style: "slit",
        label: "Đường gấp miệng túi",
      },
      {
        id: `${cfg.id}-notch-r`,
        point: v1,
        cutPoint: pt(v1.x + cfg.sa, v1.y),
        angle: Math.PI,
        depth: 4,
        style: "slit",
        label: "Đường gấp miệng túi",
      },
    ],
    grainline: {
      start: pt(cfg.centerX, roundMm(cfg.topY + 20)),
      end: pt(cfg.centerX, roundMm(cfg.topY + cfg.pointL - 22)),
      label: "Canh sợi dọc (Straight Grain)",
    },
    dimensions: [],
    labelAnchor: pt(cfg.centerX, roundMm(cfg.topY + cfg.sideL * 0.52)),
    keyPoints: [
      { id: `${cfg.id}-kp1`, code: `${cfg.code.slice(0, 1)}1`, label: "Góc trên trái", point: v0 },
      { id: `${cfg.id}-kp2`, code: `${cfg.code.slice(0, 1)}2`, label: "Đỉnh nhọn đáy túi", point: v3 },
    ],
    bbox,
    metrics: {
      widthMm: bbox.width,
      heightMm: bbox.height,
      perimeterMm: computePathPerimeter(cutPath),
      sewPerimeterMm: computePathPerimeter(sewPath),
      areaMm2: approxPolygonAreaMm2(cutVerts),
    },
  };
}

function buildFlyShieldPiece(
  centerX: number,
  topY: number,
  sa: number
): PatternPiece {
  // J-Stitch Fly Shield: 5" (127mm) L × 1 1/2" (38.1mm) W + 8mm ease
  const w = 46;
  const h = 132;
  const xL = roundMm(centerX - w / 2);
  const xR = roundMm(centerX + w / 2);
  const yB = roundMm(topY + h);

  const sewPath: VectorPath = {
    id: "fly-sew",
    kind: "sew",
    closed: true,
    segments: [
      { type: "M", to: pt(xL, topY) },
      { type: "L", to: pt(xR, topY) },
      { type: "L", to: pt(xR, yB) },
      {
        type: "C",
        cp1: pt(roundMm(xR - 22), yB),
        cp2: pt(xL, roundMm(yB - 14)),
        to: pt(xL, roundMm(yB - 34)),
      },
      { type: "Z" },
    ],
  };

  const cutPath: VectorPath = {
    id: "fly-cut",
    kind: "cut",
    closed: true,
    segments: [
      { type: "M", to: pt(xL - sa, topY - sa) },
      { type: "L", to: pt(xR + sa, topY - sa) },
      { type: "L", to: pt(xR + sa, yB + sa) },
      {
        type: "C",
        cp1: pt(roundMm(xR - 22), yB + sa),
        cp2: pt(xL - sa, roundMm(yB - 14)),
        to: pt(xL - sa, roundMm(yB - 34)),
      },
      { type: "Z" },
    ],
  };

  const bbox = computePathsBoundingBox([cutPath]);
  return {
    id: "fly-shield",
    code: "FLY-01",
    name: 'Mo-guết khóa kéo (5" × 1.5")',
    englishName: "J-Fly Shield & Facing",
    cutQuantity: 2,
    cutNote: "Cắt ×2 (Cut 2 — Fly Facing + Shield)",
    material: "self",
    sewPaths: [sewPath],
    cutPaths: [cutPath],
    internalPaths: [],
    notches: [],
    grainline: {
      start: pt(centerX, roundMm(topY + 18)),
      end: pt(centerX, roundMm(yB - 24)),
      label: "Canh sợi dọc (Straight Grain)",
    },
    dimensions: [],
    labelAnchor: pt(centerX, roundMm(topY + h / 2)),
    keyPoints: [
      { id: "fly-kp1", code: "J1", label: "Đỉnh đáp khóa", point: pt(xR, topY) },
      { id: "fly-kp2", code: "J2", label: "Đáy đáp khóa", point: pt(xR, yB) },
    ],
    bbox,
    metrics: {
      widthMm: bbox.width,
      heightMm: bbox.height,
      perimeterMm: computePathPerimeter(cutPath),
      sewPerimeterMm: computePathPerimeter(sewPath),
      areaMm2: roundMm((w + 2 * sa) * (h + 2 * sa) * 0.92),
    },
  };
}

function buildBeltLoopPiece(centerX: number, topY: number): PatternPiece {
  // <BELTLOOP>: 2 1/2"(L) × 5/8"(W) finished -> 63.5mm × 15.88mm (cut folded 3x width ≈ 42mm × 82mm)
  const cutW = 42;
  const cutH = 82;
  const xL = roundMm(centerX - cutW / 2);
  const xR = roundMm(centerX + cutW / 2);
  const yB = roundMm(topY + cutH);

  const cutPath: VectorPath = {
    id: "blp-cut",
    kind: "cut",
    closed: true,
    segments: [
      { type: "M", to: pt(xL, topY) },
      { type: "L", to: pt(xR, topY) },
      { type: "L", to: pt(xR, yB) },
      { type: "L", to: pt(xL, yB) },
      { type: "Z" },
    ],
  };

  const sewPath: VectorPath = {
    id: "blp-sew",
    kind: "sew",
    closed: true,
    segments: [
      { type: "M", to: pt(roundMm(centerX - 8), roundMm(topY + 9)) },
      { type: "L", to: pt(roundMm(centerX + 8), roundMm(topY + 9)) },
      { type: "L", to: pt(roundMm(centerX + 8), roundMm(yB - 9)) },
      { type: "L", to: pt(roundMm(centerX - 8), roundMm(yB - 9)) },
      { type: "Z" },
    ],
  };

  const bbox = computePathsBoundingBox([cutPath]);
  return {
    id: "belt-loop",
    code: "BLP-01",
    name: 'Đỉa quần (2 1/2" × 5/8")',
    englishName: "Belt Loop (5 PCS)",
    cutQuantity: 5,
    cutNote: "Cắt ×5 (Cut 5 — 2 Front, 2 Side, 1 CB)",
    material: "self",
    sewPaths: [sewPath],
    cutPaths: [cutPath],
    internalPaths: [],
    notches: [],
    grainline: {
      start: pt(centerX, roundMm(topY + 14)),
      end: pt(centerX, roundMm(yB - 14)),
      label: "Canh sợi dọc (Straight Grain)",
    },
    dimensions: [],
    labelAnchor: pt(centerX, roundMm(topY + cutH / 2)),
    keyPoints: [
      { id: "blp-kp1", code: "L1", label: "Đầu đỉa", point: pt(centerX, topY) },
    ],
    bbox,
    metrics: {
      widthMm: bbox.width,
      heightMm: bbox.height,
      perimeterMm: computePathPerimeter(cutPath),
      sewPerimeterMm: computePathPerimeter(sewPath),
      areaMm2: roundMm(cutW * cutH),
    },
  };
}

/**
 * Generate full 2D CAD Geometry for WV1499LSB-TD — 9 1/2" Low Super Baggy Jean.
 */
export function generateBaggyJeanGeometry(
  rawParams: ParamValues,
  options?: BaggyJeanGeometryOptions
): PatternGeometryResult {
  const p = parseBaggyJeanParams(rawParams);
  const sa = roundMm(p.seamAllowance * 10);

  const frontPiece = buildFrontPanel(p, options);

  // Place Back Panel neatly to the right of Front Panel without collision
  const backOriginX =
    options?.backOriginX ??
    roundMm(frontPiece.bbox.maxX + p.thigh * 10 * 0.34 + 130);
  const { piece: backPiece } = buildBackPanel(p, backOriginX, options);

  // Secondary pieces cleanly aligned below the two trouser legs
  const midLayoutX = roundMm((frontPiece.bbox.minX + backPiece.bbox.maxX) / 2);
  const auxBaseY =
    options?.auxAnchorY ??
    roundMm(Math.max(frontPiece.bbox.maxY, backPiece.bbox.maxY) + 140);

  // Account for upward curve rise of contoured waistband
  const wbTotalLenMm = p.waist * 10 + 38.1;
  const rTopEst =
    options?.fixedWaistbandRTopMm ?? wbTotalLenMm / (45 / (p.waistbandHeight * 10));
  const wbSweep = wbTotalLenMm / rTopEst;
  const wbRise =
    p.waistbandType === "curved"
      ? roundMm(rTopEst * (1 - Math.cos(wbSweep / 2)) + sa)
      : sa;

  const waistbandPiece = buildJeanWaistbandPiece(
    p,
    midLayoutX,
    roundMm(auxBaseY + wbRise),
    options
  );

  const row2Y = roundMm(waistbandPiece.bbox.maxY + 75);
  const backYokePiece = buildBackYokePiece(
    p,
    roundMm(frontPiece.bbox.minX + 140),
    row2Y,
    options
  );

  const pieces: PatternPiece[] = [
    frontPiece,
    backPiece,
    waistbandPiece,
    backYokePiece,
  ];

  if (p.includeFivePockets) {
    const backPocketPiece = buildPentagonPocketPiece({
      id: "back-pocket",
      code: "BPK-01",
      name: 'Túi sau ngũ giác (6 1/4" × 6 1/4")',
      englishName: "Back Patch Pocket",
      cutQuantity: 2,
      cutNote: "Cắt ×2 (Cut 2 — Back Left & Right)",
      centerX: roundMm(backYokePiece.bbox.maxX + 135),
      topY: row2Y,
      topW: 158.75, // 6 1/4"
      botW: 133.35, // 5 1/4"
      sideL: 133.35, // 5 1/4"
      pointL: 158.75, // 6 1/4"
      sa: 10,
      topTurnMm: 22, // 7/8" top double-turn hem
    });

    const coinPocketPiece = buildPentagonPocketPiece({
      id: "coin-pocket",
      code: "CPK-01",
      name: 'Túi đồng hồ (3" × 3")',
      englishName: "Coin Pocket",
      cutQuantity: 1,
      cutNote: "Cắt ×1 (Cut 1 — Right Front)",
      centerX: roundMm(backPocketPiece.bbox.maxX + 95),
      topY: row2Y,
      topW: 76.2, // 3"
      botW: 69.85, // 2 3/4"
      sideL: 66.68, // 2 5/8"
      pointL: 76.2, // 3"
      sa: 10,
      topTurnMm: 16,
    });

    const flyShieldPiece = buildFlyShieldPiece(
      roundMm(coinPocketPiece.bbox.maxX + 85),
      row2Y,
      sa
    );

    const beltLoopPiece = buildBeltLoopPiece(
      roundMm(flyShieldPiece.bbox.maxX + 75),
      row2Y
    );

    pieces.push(backPocketPiece, coinPocketPiece, flyShieldPiece, beltLoopPiece);
  }

  const bbox = mergeBoundingBoxes(pieces.map((pc) => pc.bbox));
  const outseamCm = roundCm(
    p.inseam + p.frontRise - 1.0, // Front outseam approximation incl. WB
    1
  );
  const totalRiseCurveCm = roundCm(p.frontRise + p.backRise, 1);

  const formulas: FormulaItem[] = [
    {
      id: "outseam-len",
      symbol: "Dài sườn",
      label: "Tổng dài sườn ngoài dự kiến (Outseam incl. WB)",
      expression: "inseam + frontRise - 1.0",
      substitution: `${p.inseam} + ${p.frontRise} - 1.0`,
      valueCm: outseamCm,
      valueMm: roundMm(outseamCm * 10),
    },
    {
      id: "total-crotch",
      symbol: "Vòng đáy",
      label: "Tổng vòng đáy trước + sau (Total Rise Curve)",
      expression: "frontRise + backRise",
      substitution: `${p.frontRise} + ${p.backRise}`,
      valueCm: totalRiseCurveCm,
      valueMm: roundMm(totalRiseCurveCm * 10),
    },
    {
      id: "thigh-split",
      symbol: "Đùi T/S",
      label: "Phân bổ đùi Trước / Sau (44.5% / 55.5%)",
      expression: "thigh × 0.445 | thigh × 0.555",
      substitution: `${roundCm(p.thigh * 0.445, 1)} cm / ${roundCm(p.thigh * 0.555, 1)} cm`,
      valueCm: roundCm(p.thigh, 1),
      valueMm: roundMm(p.thigh * 10),
      displayValue: `${roundCm(p.thigh * 0.445, 1)} / ${roundCm(p.thigh * 0.555, 1)} cm`,
    },
    {
      id: "hem-ratio",
      symbol: "Ống lai",
      label: 'Độ rộng ống Baggy (Opening — 25.0")',
      expression: "hemOpening (46.5% Front / 53.5% Back)",
      substitution: `${roundCm(p.hemOpening * 0.465, 1)} + ${roundCm(p.hemOpening * 0.535, 1)} cm`,
      valueCm: roundCm(p.hemOpening, 1),
      valueMm: roundMm(p.hemOpening * 10),
      displayValue: `${roundCm(p.hemOpening, 1)} cm (${roundCm(p.hemOpening / 2.54, 1)}")`,
    },
  ];

  const totalCutPieces = pieces.reduce((acc, pc) => acc + pc.cutQuantity, 0);
  const totalAreaM2 = roundCm(
    pieces.reduce((acc, pc) => acc + pc.metrics.areaMm2 * pc.cutQuantity, 0) /
      1_000_000,
    3
  );
  const estimatedFabricWidthCm = 150;
  const estimatedFabricLengthCm = roundCm((totalAreaM2 / 1.44) * 1.15 * 100, 1);

  return {
    pieces,
    formulas,
    warnings: [],
    bbox,
    summary: {
      totalCutPieces,
      estimatedFabricWidthCm,
      estimatedFabricLengthCm,
      totalAreaM2,
      metadata: {
        styleCode: "WV1499LSB-TD",
        outseamCm,
        totalRiseCurveCm,
        inseamCm: p.inseam,
      },
    },
  };
}
