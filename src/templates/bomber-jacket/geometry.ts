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
import { parseBomberJacketParams, type BomberJacketParams } from "./schema";

export interface BomberGeometryOptions {
  /** Shared X center for symmetrical Back Body */
  backCenterX?: number;
  /** Shared X center for Set-in Long Sleeve */
  sleeveCenterX?: number;
  /** Shared Y top anchor for Row 2 auxiliary pieces (Facing, Ribs, Pockets) */
  auxRow1Y?: number;
  /** Shared Y top anchor for Row 3 (Pocket Welt & Pocket Bag) */
  auxRow2Y?: number;
  /** Shared X anchors for Row 2/3 pieces so S-M-L-XL nest cleanly without horizontal drift */
  ribStartX?: number;
  cuffStartX?: number;
  fhpStartX?: number;
  bagStartX?: number;
  /** Frozen grainlines from Base Size so Gerber AccuMark keeps all S-M-L-XL blocks locked concentrically */
  fixedGrainlines?: Record<string, { start: Point2D; end: Point2D }>;
}

const BACK_NECK_DROP_MM = 10; // Constant 1.0 cm across all AU sizes per 89865 SPEC
const PRESS_STUD_OVERLAP_MM = 15; // 1.5 cm extension past CF for 11mm press stud placket

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

function deriveBomberDims(p: BomberJacketParams) {
  const sa = roundMm(p.seamAllowance * 10);
  const bodyHeightMm = roundMm(Math.max(240, (p.frontLength - p.ribHeight) * 10));
  const halfBackW = roundMm((p.chest * 10) / 4); // Chest/4 (292.5 mm on M)
  const frontW = roundMm(halfBackW + PRESS_STUD_OVERLAP_MM); // CF overlap + Chest/4
  const halfNeck = roundMm((p.neckWidth * 10) / 2);
  const halfShoulder = roundMm((p.shoulder * 10) / 2);
  const frontNeckDropMm = roundMm(p.frontNeckDrop * 10);
  const shoulderDropMm = roundMm(Math.max(18, Math.min(30, (halfShoulder - halfNeck) * 0.175)));

  // Armhole depth calibrated so Bezier curve matches E (armholeHalf) cleanly
  const armholeDepthMm = roundMm(
    Math.min(bodyHeightMm * 0.56, Math.max(shoulderDropMm + 115, p.armholeHalf * 10 * 0.875))
  );

  // Facing widths per 89865 SPEC & QC Report:
  // Adult (>=106 cm chest): 9.0 cm body / 5.0 cm at shoulder; Youth: 8.0 cm / 5.0 cm
  const facingBodyW = p.chest >= 106 ? 90 : 80;
  const facingShoulderW = 50;
  // Front Hem Self Fabric Square Panel (G): 8.0 cm adult / 7.0 cm youth (6.5 cm tiny)
  const frontSelfHemW = p.chest >= 106 ? 80 : p.chest >= 84 ? 70 : 65;

  // Pocket distance from Rib Seam (P): amended 03.04.2025 -> 7.5 cm adult M, 7.0 cm sz 14, 6.0 cm sz 8
  const pocketFromRibMm = p.chest >= 125 ? 80 : p.chest >= 108 ? 75 : p.chest >= 98 ? 70 : 60;
  const pocketOpeningMm = roundMm(p.pocketOpening * 10);
  const pocketBagW = p.chest >= 106 ? 160 : p.chest >= 90 ? 140 : 130;
  const ribHeightMm = roundMm(p.ribHeight * 10);
  const sleeveFabricLenMm = roundMm(Math.max(220, (p.sleeveLength - p.ribHeight) * 10));
  const sleeveCapH = roundMm(Math.max(82, p.armholeHalf * 10 * 0.435));
  const sleeveHalfBicep = roundMm(
    Math.max(
      p.sleeveOpeningHalf * 10 + 30,
      Math.sqrt(Math.max(10000, Math.pow(p.armholeHalf * 10 * 0.94, 2) - sleeveCapH * sleeveCapH))
    )
  );
  const sleeveHalfCuff = roundMm(p.sleeveOpeningHalf * 10);

  return {
    sa,
    bodyHeightMm,
    halfBackW,
    frontW,
    halfNeck,
    halfShoulder,
    frontNeckDropMm,
    shoulderDropMm,
    armholeDepthMm,
    facingBodyW,
    facingShoulderW,
    frontSelfHemW,
    pocketFromRibMm,
    pocketOpeningMm,
    pocketBagW,
    ribHeightMm,
    sleeveFabricLenMm,
    sleeveCapH,
    sleeveHalfBicep,
    sleeveHalfCuff,
  };
}

function makeRectPiece(cfg: {
  id: string;
  code: string;
  name: string;
  englishName: string;
  cutQuantity: number;
  cutNote: string;
  material: "self" | "lining" | "interfacing";
  fabricGroup: string;
  displayColor: string;
  originX: number;
  originY: number;
  widthMm: number;
  heightMm: number;
  sa: number;
  hasFoldLine?: boolean;
  hasTwoGoldStripes?: boolean;
  grainOrientation?: "horizontal" | "vertical";
  extraNotchRatiosTop?: number[];
  fixedGrain?: { start: Point2D; end: Point2D };
}): PatternPiece {
  const {
    originX: ox,
    originY: oy,
    widthMm: w,
    heightMm: h,
    sa,
    hasFoldLine = true,
    hasTwoGoldStripes = false,
    grainOrientation = "horizontal",
  } = cfg;

  const pTL = pt(ox, oy);
  const pTR = pt(ox + w, oy);
  const pBR = pt(ox + w, oy + h);
  const pBL = pt(ox, oy + h);

  const sewPath: VectorPath = {
    id: `${cfg.id}-sew`,
    kind: "sew",
    closed: true,
    segments: [
      { type: "M", to: pTL },
      { type: "L", to: pTR },
      { type: "L", to: pBR },
      { type: "L", to: pBL },
      { type: "Z" },
    ],
  };

  const cutPath: VectorPath = {
    id: `${cfg.id}-cut`,
    kind: "cut",
    closed: true,
    segments: [
      { type: "M", to: pt(ox - sa, oy - sa) },
      { type: "L", to: pt(ox + w + sa, oy - sa) },
      { type: "L", to: pt(ox + w + sa, oy + h + sa) },
      { type: "L", to: pt(ox - sa, oy + h + sa) },
      { type: "Z" },
    ],
  };

  const internalPaths: VectorPath[] = [];
  if (hasFoldLine) {
    internalPaths.push({
      id: `${cfg.id}-fold`,
      kind: "fold",
      closed: false,
      label: "Đường gấp đôi (Fold Line)",
      segments: [
        { type: "M", to: pt(ox, oy + h / 2) },
        { type: "L", to: pt(ox + w, oy + h / 2) },
      ],
    });
  }
  if (hasTwoGoldStripes) {
    // 2 Gold knit stripes symmetrically on upper & lower folded face
    const s1 = roundMm(h * 0.22);
    const s2 = roundMm(h * 0.34);
    internalPaths.push(
      {
        id: `${cfg.id}-stripe-1`,
        kind: "internal",
        closed: false,
        label: "Sọc Gold 1 (1×1 Rib Stripe)",
        segments: [
          { type: "M", to: pt(ox + 2, oy + s1) },
          { type: "L", to: pt(ox + w - 2, oy + s1) },
        ],
      },
      {
        id: `${cfg.id}-stripe-2`,
        kind: "internal",
        closed: false,
        label: "Sọc Gold 2 (1×1 Rib Stripe)",
        segments: [
          { type: "M", to: pt(ox + 2, oy + s2) },
          { type: "L", to: pt(ox + w - 2, oy + s2) },
        ],
      }
    );
  }

  const ratios = cfg.extraNotchRatiosTop ?? [0.5];
  const notches: Notch[] = ratios.map((r, idx) => ({
    id: `${cfg.id}-n-${idx}`,
    point: pt(ox + w * r, oy),
    cutPoint: pt(ox + w * r, oy - sa),
    angle: Math.PI / 2,
    depth: 5,
    style: "slit",
    label: r === 0.5 ? "Giữa (Center)" : "Định vị",
  }));

  const defaultGrain =
    grainOrientation === "vertical"
      ? {
          start: pt(ox + w / 2, oy + h * 0.2),
          end: pt(ox + w / 2, oy + h * 0.8),
        }
      : {
          start: pt(ox + w * 0.22, oy + h * 0.68),
          end: pt(ox + w * 0.78, oy + h * 0.68),
        };
  const gPts = cfg.fixedGrain ?? defaultGrain;

  const bbox = computePathsBoundingBox([cutPath]);
  return {
    id: cfg.id,
    code: cfg.code,
    name: cfg.name,
    englishName: cfg.englishName,
    cutQuantity: cfg.cutQuantity,
    cutNote: cfg.cutNote,
    material: cfg.material,
    fabricGroup: cfg.fabricGroup,
    displayColor: cfg.displayColor,
    sewPaths: [sewPath],
    cutPaths: [cutPath],
    internalPaths,
    notches,
    grainline: {
      start: gPts.start,
      end: gPts.end,
      label: grainOrientation === "vertical" ? "Canh dọc (Grain)" : "Canh co giãn (Rib)",
    },
    dimensions: [
      {
        id: `${cfg.id}-dim-w`,
        from: pTL,
        to: pTR,
        label: `${roundCm(w / 10, 1)} cm`,
        kind: "linear",
        offsetMm: -16,
      },
    ],
    labelAnchor: pt(ox + w / 2, oy + h / 2),
    keyPoints: [
      { id: `${cfg.id}-tl`, code: `${cfg.code}-TL`, label: "Góc trên trái", point: pTL },
      { id: `${cfg.id}-tr`, code: `${cfg.code}-TR`, label: "Góc trên phải", point: pTR },
      { id: `${cfg.id}-br`, code: `${cfg.code}-BR`, label: "Góc dưới phải", point: pBR },
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
 * PIECE 1: FRT-01 — THÂN TRƯỚC ÁO BOMBER (Front Body — Cut ×2)
 */
function buildFrontBody(
  p: BomberJacketParams,
  d: ReturnType<typeof deriveBomberDims>,
  options?: BomberGeometryOptions
): PatternPiece {
  const cfEdgeX = 0;
  const cfLineX = PRESS_STUD_OVERLAP_MM;
  const hspX = roundMm(cfLineX + d.halfNeck);
  const shTipX = roundMm(cfLineX + d.halfShoulder);
  const sideX = d.frontW;

  const pNeckCF = pt(cfEdgeX, d.frontNeckDropMm);
  const pHSP = pt(hspX, 0);
  const pShTip = pt(shTipX, d.shoulderDropMm);
  const pUnderarm = pt(sideX, d.armholeDepthMm);
  const pHemSS = pt(sideX, d.bodyHeightMm);
  const pHemCF = pt(cfEdgeX, d.bodyHeightMm);

  // Smooth Front Neckline Bezier
  const c1Neck = pt(roundMm(cfEdgeX + (hspX - cfEdgeX) * 0.56), d.frontNeckDropMm);
  const c2Neck = pt(hspX, roundMm(d.frontNeckDropMm * 0.52));

  // Smooth Front Armhole Bezier (slight hollow at mid-chest)
  const c1Ah = pt(roundMm(shTipX - 10), roundMm(d.shoulderDropMm + (d.armholeDepthMm - d.shoulderDropMm) * 0.56));
  const c2Ah = pt(roundMm(shTipX + (sideX - shTipX) * 0.42), d.armholeDepthMm);

  const sewPath: VectorPath = {
    id: "frt-sew",
    kind: "sew",
    closed: true,
    segments: [
      { type: "M", to: pNeckCF },
      { type: "C", cp1: c1Neck, cp2: c2Neck, to: pHSP },
      { type: "L", to: pShTip },
      { type: "C", cp1: c1Ah, cp2: c2Ah, to: pUnderarm },
      { type: "L", to: pHemSS },
      { type: "L", to: pHemCF },
      { type: "Z" },
    ],
  };

  const sa = d.sa;
  const cutPath: VectorPath = {
    id: "frt-cut",
    kind: "cut",
    closed: true,
    segments: [
      { type: "M", to: pt(pNeckCF.x - sa, pNeckCF.y - sa) },
      {
        type: "C",
        cp1: pt(c1Neck.x - sa * 0.5, c1Neck.y - sa),
        cp2: pt(c2Neck.x - sa, c2Neck.y - sa * 0.6),
        to: pt(pHSP.x - sa * 0.3, pHSP.y - sa),
      },
      { type: "L", to: pt(pShTip.x + sa * 0.8, pShTip.y - sa) },
      {
        type: "C",
        cp1: pt(c1Ah.x + sa, c1Ah.y - sa * 0.4),
        cp2: pt(c2Ah.x + sa * 0.5, c2Ah.y - sa),
        to: pt(pUnderarm.x + sa, pUnderarm.y - sa),
      },
      { type: "L", to: pt(pHemSS.x + sa, pHemSS.y + sa) },
      { type: "L", to: pt(pHemCF.x - sa, pHemCF.y + sa) },
      { type: "Z" },
    ],
  };

  // Internal construction lines per 89865 SPEC & QC Report:
  // 1. Center Front Press Stud Line (15 mm inside front edge) + 6 press studs
  // 2. Angled Welt Pocket Box: bottom outer corner = 3.0 cm from Side Seam, P (7.5 cm on M) above Rib Seam,
  //    length = pocketOpening (16 cm), welt width = 3.0 cm, tilted 72° from horizontal!
  const weltAngleRad = (72 * Math.PI) / 180;
  const pktBotX = roundMm(sideX - 30);
  const pktBotY = roundMm(d.bodyHeightMm - d.pocketFromRibMm);
  const pktTopX = roundMm(pktBotX - d.pocketOpeningMm * Math.cos(weltAngleRad));
  const pktTopY = roundMm(pktBotY - d.pocketOpeningMm * Math.sin(weltAngleRad));
  const weltNormalX = roundMm(-30 * Math.sin(weltAngleRad));
  const weltNormalY = roundMm(30 * Math.cos(weltAngleRad));

  // 3. Inside Facing stitch reference (5 cm along shoulder -> 9 cm along hem)
  const facShX = roundMm(hspX + d.facingShoulderW);
  const facShY = roundMm(
    (d.shoulderDropMm * d.facingShoulderW) / Math.max(1, shTipX - hspX)
  );

  // 4. LHS Chest School Embroidery Crosshair (8 cm from CF edge, 17.5 cm from HSP on M)
  const embX = roundMm(p.chest >= 106 ? 80 : 70);
  const embY = roundMm(d.bodyHeightMm * 0.26);

  const internalPaths: VectorPath[] = [
    {
      id: "frt-cf-line",
      kind: "internal",
      closed: false,
      label: "Đường tâm nút bấm 11mm (CF Press Studs)",
      segments: [
        { type: "M", to: pt(cfLineX, d.frontNeckDropMm + 5) },
        { type: "L", to: pt(cfLineX, d.bodyHeightMm) },
      ],
    },
    {
      id: "frt-welt-pocket",
      kind: "internal",
      closed: true,
      label: `Túi cơi xéo 3.0 × ${p.pocketOpening} cm`,
      segments: [
        { type: "M", to: pt(pktBotX, pktBotY) },
        { type: "L", to: pt(pktTopX, pktTopY) },
        { type: "L", to: pt(pktTopX + weltNormalX, pktTopY + weltNormalY) },
        { type: "L", to: pt(pktBotX + weltNormalX, pktBotY + weltNormalY) },
        { type: "Z" },
      ],
    },
    {
      id: "frt-facing-guide",
      kind: "internal",
      closed: false,
      label: `Đường đáp nẹp trong (${d.facingBodyW / 10} cm → vai 5 cm)`,
      segments: [
        { type: "M", to: pt(facShX, facShY) },
        {
          type: "C",
          cp1: pt(roundMm(d.facingBodyW + 14), roundMm(d.frontNeckDropMm + 55)),
          cp2: pt(d.facingBodyW, roundMm(d.armholeDepthMm + 15)),
          to: pt(d.facingBodyW, d.bodyHeightMm),
        },
      ],
    },
    {
      id: "frt-emb-cross-h",
      kind: "internal",
      closed: false,
      label: "Tâm thêu logo trường (LHS Chest)",
      segments: [
        { type: "M", to: pt(embX - 10, embY) },
        { type: "L", to: pt(embX + 10, embY) },
      ],
    },
    {
      id: "frt-emb-cross-v",
      kind: "internal",
      closed: false,
      segments: [
        { type: "M", to: pt(embX, embY - 10) },
        { type: "L", to: pt(embX, embY + 10) },
      ],
    },
  ];

  // 6 Press Stud tick marks along CF line
  const studTopY = d.frontNeckDropMm + 25;
  const studBotY = d.bodyHeightMm - 25;
  for (let s = 0; s < 6; s++) {
    const sy = roundMm(studTopY + ((studBotY - studTopY) * s) / 5);
    internalPaths.push({
      id: `frt-stud-${s}`,
      kind: "internal",
      closed: false,
      segments: [
        { type: "M", to: pt(cfLineX - 4, sy) },
        { type: "L", to: pt(cfLineX + 4, sy) },
      ],
    });
  }

  const notches: Notch[] = [
    {
      id: "frt-n-ah",
      point: pt(roundMm((shTipX + sideX) * 0.49), roundMm(d.armholeDepthMm * 0.72)),
      cutPoint: pt(roundMm((shTipX + sideX) * 0.49 + sa), roundMm(d.armholeDepthMm * 0.72)),
      angle: Math.PI,
      depth: 5,
      style: "slit",
      label: "Dấu bấm mang tay trước",
    },
    {
      id: "frt-n-hem-self",
      point: pt(d.frontSelfHemW, d.bodyHeightMm),
      cutPoint: pt(d.frontSelfHemW, d.bodyHeightMm + sa),
      angle: -Math.PI / 2,
      depth: 5,
      style: "slit",
      label: `Định vị đáp gấu (${d.frontSelfHemW / 10} cm)`,
    },
    {
      id: "frt-n-ss-mid",
      point: pt(sideX, roundMm((d.armholeDepthMm + d.bodyHeightMm) / 2)),
      cutPoint: pt(sideX + sa, roundMm((d.armholeDepthMm + d.bodyHeightMm) / 2)),
      angle: Math.PI,
      depth: 5,
      style: "slit",
      label: "Khớp sườn",
    },
  ];

  const defaultGrain = {
    start: pt(roundMm(sideX * 0.52), roundMm(d.armholeDepthMm - 20)),
    end: pt(roundMm(sideX * 0.52), roundMm(d.bodyHeightMm - 60)),
  };
  const gPts = options?.fixedGrainlines?.["front-body"] ?? defaultGrain;

  const bbox = computePathsBoundingBox([cutPath]);
  return {
    id: "front-body",
    code: "FRT-01",
    name: "Thân trước áo Bomber",
    englishName: "Front Body (with Welt & Press Studs)",
    cutQuantity: 2,
    cutNote: "Cắt ×2 đối xứng — Vải nỉ Fleece Maroon",
    material: "self",
    fabricGroup: "Polyester Fleece Maroon",
    displayColor: "#6D1D32",
    sewPaths: [sewPath],
    cutPaths: [cutPath],
    internalPaths,
    notches,
    grainline: { start: gPts.start, end: gPts.end, label: "Canh dọc (Grainline)" },
    dimensions: [
      {
        id: "frt-dim-len",
        from: pHSP,
        to: pt(hspX, d.bodyHeightMm),
        label: `Thân ${roundCm(d.bodyHeightMm / 10, 1)} cm (+Bo ${p.ribHeight})`,
        kind: "linear",
        offsetMm: -24,
      },
    ],
    labelAnchor: pt(roundMm(sideX * 0.45), roundMm(d.bodyHeightMm * 0.45)),
    keyPoints: [
      { id: "frt-hsp", code: "F-HSP", label: "Đỉnh vai cạnh cổ trước (HSP)", point: pHSP },
      { id: "frt-sh", code: "F-SH", label: "Đầu vai trước (Shoulder Tip)", point: pShTip },
      { id: "frt-ua", code: "F-UA", label: "Hạ nách trước (Underarm)", point: pUnderarm },
      { id: "frt-hem", code: "F-HEM", label: "Góc lai sườn (Hem Side)", point: pHemSS },
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
 * PIECE 2: BCK-01 — THÂN SAU NGUYÊN MẢNH (Full Symmetrical Back Body — Cut ×1)
 */
function buildBackBody(
  d: ReturnType<typeof deriveBomberDims>,
  centerX: number,
  options?: BomberGeometryOptions
): PatternPiece {
  const cx = roundMm(centerX);
  const sa = d.sa;
  const pHspL = pt(cx - d.halfNeck, 0);
  const pHspR = pt(cx + d.halfNeck, 0);
  const pShL = pt(cx - d.halfShoulder, d.shoulderDropMm);
  const pShR = pt(cx + d.halfShoulder, d.shoulderDropMm);
  const pUaL = pt(cx - d.halfBackW, d.armholeDepthMm);
  const pUaR = pt(cx + d.halfBackW, d.armholeDepthMm);
  const pHemL = pt(cx - d.halfBackW, d.bodyHeightMm);
  const pHemR = pt(cx + d.halfBackW, d.bodyHeightMm);

  // Back Neckline (1.0 cm constant drop per spec)
  const c1BN = pt(roundMm(cx - d.halfNeck * 0.48), BACK_NECK_DROP_MM);
  const c2BN = pt(roundMm(cx + d.halfNeck * 0.48), BACK_NECK_DROP_MM);

  // Back Armholes (slightly fuller curve than front)
  const c1AhR = pt(roundMm(cx + d.halfShoulder - 4), roundMm(d.shoulderDropMm + (d.armholeDepthMm - d.shoulderDropMm) * 0.55));
  const c2AhR = pt(roundMm(cx + d.halfShoulder + (d.halfBackW - d.halfShoulder) * 0.46), d.armholeDepthMm);
  const c1AhL = pt(roundMm(cx - d.halfShoulder - (d.halfBackW - d.halfShoulder) * 0.46), d.armholeDepthMm);
  const c2AhL = pt(roundMm(cx - d.halfShoulder + 4), roundMm(d.shoulderDropMm + (d.armholeDepthMm - d.shoulderDropMm) * 0.55));

  const sewPath: VectorPath = {
    id: "bck-sew",
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
    id: "bck-cut",
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
      { type: "L", to: pt(pHemR.x + sa, pHemR.y + sa) },
      { type: "L", to: pt(pHemL.x - sa, pHemL.y + sa) },
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

  const internalPaths: VectorPath[] = [
    {
      id: "bck-cb-fold",
      kind: "fold",
      closed: false,
      label: "Trục giữa sống lưng (Center Back)",
      segments: [
        { type: "M", to: pt(cx, BACK_NECK_DROP_MM) },
        { type: "L", to: pt(cx, d.bodyHeightMm) },
      ],
    },
  ];

  const notches: Notch[] = [
    {
      id: "bck-n-cb-top",
      point: pt(cx, BACK_NECK_DROP_MM),
      cutPoint: pt(cx, BACK_NECK_DROP_MM - sa),
      angle: Math.PI / 2,
      depth: 5,
      style: "slit",
      label: "Giữa cổ sau (CB Neck)",
    },
    {
      id: "bck-n-cb-hem",
      point: pt(cx, d.bodyHeightMm),
      cutPoint: pt(cx, d.bodyHeightMm + sa),
      angle: -Math.PI / 2,
      depth: 5,
      style: "slit",
      label: "Giữa lai sau (CB Hem)",
    },
  ];

  const defaultGrain = {
    start: pt(cx, roundMm(d.armholeDepthMm - 20)),
    end: pt(cx, roundMm(d.bodyHeightMm - 60)),
  };
  const gPts = options?.fixedGrainlines?.["back-body"] ?? defaultGrain;

  const bbox = computePathsBoundingBox([cutPath]);
  return {
    id: "back-body",
    code: "BCK-01",
    name: "Thân sau nguyên mảnh",
    englishName: "Back Body (Full Symmetrical)",
    cutQuantity: 1,
    cutNote: "Cắt ×1 (nguyên mảnh / gấp đôi CB) — Vải nỉ Fleece Maroon",
    material: "self",
    fabricGroup: "Polyester Fleece Maroon",
    displayColor: "#6D1D32",
    sewPaths: [sewPath],
    cutPaths: [cutPath],
    internalPaths,
    notches,
    grainline: { start: gPts.start, end: gPts.end, label: "Canh dọc (CB Grain)" },
    dimensions: [
      {
        id: "bck-dim-chest",
        from: pUaL,
        to: pUaR,
        label: `1/2 Ngực ${roundCm((d.halfBackW * 2) / 10, 1)} cm`,
        kind: "linear",
        offsetMm: -18,
      },
    ],
    labelAnchor: pt(cx, roundMm(d.bodyHeightMm * 0.48)),
    keyPoints: [
      { id: "bck-hspr", code: "B-HSP", label: "Đỉnh vai sau (Back HSP)", point: pHspR },
      { id: "bck-shr", code: "B-SH", label: "Đầu vai sau (Back Shoulder)", point: pShR },
      { id: "bck-uar", code: "B-UA", label: "Hạ nách sau (Back Underarm)", point: pUaR },
      { id: "bck-hemr", code: "B-HEM", label: "Góc lai sau (Back Hem)", point: pHemR },
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
 * PIECE 3: SLV-01 — TAY DÀI NỐI NÁCH (Set-in Long Sleeve — Cut ×2)
 */
function buildLongSleeve(
  p: BomberJacketParams,
  d: ReturnType<typeof deriveBomberDims>,
  centerX: number,
  options?: BomberGeometryOptions
): PatternPiece {
  const cx = roundMm(centerX);
  const sa = d.sa;
  const pCapTop = pt(cx, 0);
  const pUnderL = pt(cx - d.sleeveHalfBicep, d.sleeveCapH);
  const pUnderR = pt(cx + d.sleeveHalfBicep, d.sleeveCapH);
  const pCuffL = pt(cx - d.sleeveHalfCuff, d.sleeveFabricLenMm);
  const pCuffR = pt(cx + d.sleeveHalfCuff, d.sleeveFabricLenMm);

  // Smooth S-curve Sleeve Cap (Left = Front Cap slightly hollowed, Right = Back Cap fuller)
  const c1CapR = pt(roundMm(cx + d.sleeveHalfBicep * 0.42), 0);
  const c2CapR = pt(roundMm(cx + d.sleeveHalfBicep * 0.68), d.sleeveCapH);
  const c1CapL = pt(roundMm(cx - d.sleeveHalfBicep * 0.72), roundMm(d.sleeveCapH + 4));
  const c2CapL = pt(roundMm(cx - d.sleeveHalfBicep * 0.36), 0);

  const sewPath: VectorPath = {
    id: "slv-sew",
    kind: "sew",
    closed: true,
    segments: [
      { type: "M", to: pCapTop },
      { type: "C", cp1: c1CapR, cp2: c2CapR, to: pUnderR },
      { type: "L", to: pCuffR },
      { type: "L", to: pCuffL },
      { type: "L", to: pUnderL },
      { type: "C", cp1: c1CapL, cp2: c2CapL, to: pCapTop },
      { type: "Z" },
    ],
  };

  const cutPath: VectorPath = {
    id: "slv-cut",
    kind: "cut",
    closed: true,
    segments: [
      { type: "M", to: pt(pCapTop.x, pCapTop.y - sa) },
      {
        type: "C",
        cp1: pt(c1CapR.x + sa * 0.4, c1CapR.y - sa),
        cp2: pt(c2CapR.x + sa, c2CapR.y - sa * 0.6),
        to: pt(pUnderR.x + sa, pUnderR.y - sa * 0.4),
      },
      { type: "L", to: pt(pCuffR.x + sa, pCuffR.y + sa) },
      { type: "L", to: pt(pCuffL.x - sa, pCuffL.y + sa) },
      { type: "L", to: pt(pUnderL.x - sa, pUnderL.y - sa * 0.4) },
      {
        type: "C",
        cp1: pt(c1CapL.x - sa, c1CapL.y - sa * 0.6),
        cp2: pt(c2CapL.x - sa * 0.4, c2CapL.y - sa),
        to: pt(pCapTop.x, pCapTop.y - sa),
      },
      { type: "Z" },
    ],
  };

  const internalPaths: VectorPath[] = [
    {
      id: "slv-bicep-line",
      kind: "internal",
      closed: false,
      label: "Đường ngang bắp tay (Bicep Line)",
      segments: [
        { type: "M", to: pUnderL },
        { type: "L", to: pUnderR },
      ],
    },
  ];

  const notches: Notch[] = [
    {
      id: "slv-n-crown",
      point: pCapTop,
      cutPoint: pt(pCapTop.x, pCapTop.y - sa),
      angle: Math.PI / 2,
      depth: 5,
      style: "slit",
      label: "Đỉnh đầu tay (Shoulder Notch)",
    },
    {
      id: "slv-n-front",
      point: pt(roundMm(cx - d.sleeveHalfBicep * 0.56), roundMm(d.sleeveCapH * 0.52)),
      cutPoint: pt(roundMm(cx - d.sleeveHalfBicep * 0.56 - sa), roundMm(d.sleeveCapH * 0.52 - sa * 0.5)),
      angle: Math.PI * 0.25,
      depth: 5,
      style: "slit",
      label: "Mang trước (1 bấm)",
    },
    {
      id: "slv-n-back-1",
      point: pt(roundMm(cx + d.sleeveHalfBicep * 0.54), roundMm(d.sleeveCapH * 0.48)),
      cutPoint: pt(roundMm(cx + d.sleeveHalfBicep * 0.54 + sa), roundMm(d.sleeveCapH * 0.48 - sa * 0.5)),
      angle: Math.PI * 0.75,
      depth: 5,
      style: "slit",
      label: "Mang sau (2 bấm)",
    },
  ];

  const defaultGrain = {
    start: pt(cx, roundMm(d.sleeveCapH * 0.6)),
    end: pt(cx, roundMm(d.sleeveFabricLenMm - 55)),
  };
  const gPts = options?.fixedGrainlines?.["sleeve"] ?? defaultGrain;

  const bbox = computePathsBoundingBox([cutPath]);
  return {
    id: "sleeve",
    code: "SLV-01",
    name: "Tay dài nối nách",
    englishName: "Set-in Long Sleeve",
    cutQuantity: 2,
    cutNote: "Cắt ×2 đối xứng — Vải nỉ Fleece Maroon",
    material: "self",
    fabricGroup: "Polyester Fleece Maroon",
    displayColor: "#6D1D32",
    sewPaths: [sewPath],
    cutPaths: [cutPath],
    internalPaths,
    notches,
    grainline: { start: gPts.start, end: gPts.end, label: "Canh dọc tay (Grain)" },
    dimensions: [
      {
        id: "slv-dim-len",
        from: pCapTop,
        to: pt(cx, d.sleeveFabricLenMm),
        label: `Vải tay ${roundCm(d.sleeveFabricLenMm / 10, 1)} cm (+Bo ${p.ribHeight})`,
        kind: "linear",
        offsetMm: 22,
      },
    ],
    labelAnchor: pt(cx, roundMm(d.sleeveFabricLenMm * 0.52)),
    keyPoints: [
      { id: "slv-top", code: "S-CAP", label: "Đỉnh mang tay (Crown)", point: pCapTop },
      { id: "slv-ur", code: "S-BIC", label: "Bắp tay (Bicep)", point: pUnderR },
      { id: "slv-cr", code: "S-CUF", label: "Cửa tay (Sleeve Opening)", point: pCuffR },
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
 * PIECE 4: FAC-01 — ĐÁP NẸP TRONG THÂN TRƯỚC KÉO LÊN VAI (Front Inside Facing — Cut ×2)
 * Directly implements QC Report fix: "Facing need to be extend to shoulder seam (5.0 cm at shoulder, 9.0 cm body)"
 */
function buildFrontFacing(
  d: ReturnType<typeof deriveBomberDims>,
  originX: number,
  originY: number,
  options?: BomberGeometryOptions
): PatternPiece {
  const ox = roundMm(originX);
  const oy = roundMm(originY);
  const sa = d.sa;
  const hspRelX = roundMm(PRESS_STUD_OVERLAP_MM + d.halfNeck);
  const shSpan = Math.max(20, d.halfShoulder - d.halfNeck);
  const facShX = roundMm(ox + hspRelX + d.facingShoulderW);
  const facShY = roundMm(oy + (d.shoulderDropMm * d.facingShoulderW) / shSpan);

  const pNeckCF = pt(ox, oy + d.frontNeckDropMm);
  const pHSP = pt(ox + hspRelX, oy);
  const pFacSh = pt(facShX, facShY);
  const pFacHemIn = pt(ox + d.facingBodyW, oy + d.bodyHeightMm);
  const pFacHemCF = pt(ox, oy + d.bodyHeightMm);

  const c1Neck = pt(roundMm(ox + hspRelX * 0.56), oy + d.frontNeckDropMm);
  const c2Neck = pt(ox + hspRelX, roundMm(oy + d.frontNeckDropMm * 0.52));

  const c1In = pt(roundMm(ox + d.facingBodyW + 14), roundMm(oy + d.frontNeckDropMm + 55));
  const c2In = pt(ox + d.facingBodyW, roundMm(oy + d.armholeDepthMm + 15));

  const sewPath: VectorPath = {
    id: "fac-sew",
    kind: "sew",
    closed: true,
    segments: [
      { type: "M", to: pNeckCF },
      { type: "C", cp1: c1Neck, cp2: c2Neck, to: pHSP },
      { type: "L", to: pFacSh },
      { type: "C", cp1: c1In, cp2: c2In, to: pFacHemIn },
      { type: "L", to: pFacHemCF },
      { type: "Z" },
    ],
  };

  const cutPath: VectorPath = {
    id: "fac-cut",
    kind: "cut",
    closed: true,
    segments: [
      { type: "M", to: pt(pNeckCF.x - sa, pNeckCF.y - sa) },
      {
        type: "C",
        cp1: pt(c1Neck.x - sa * 0.4, c1Neck.y - sa),
        cp2: pt(c2Neck.x - sa, c2Neck.y - sa * 0.6),
        to: pt(pHSP.x - sa * 0.3, pHSP.y - sa),
      },
      { type: "L", to: pt(pFacSh.x + sa, pFacSh.y - sa) },
      {
        type: "C",
        cp1: pt(c1In.x + sa, c1In.y),
        cp2: pt(c2In.x + sa, c2In.y),
        to: pt(pFacHemIn.x + sa, pFacHemIn.y + sa),
      },
      { type: "L", to: pt(pFacHemCF.x - sa, pFacHemCF.y + sa) },
      { type: "Z" },
    ],
  };

  const defaultGrain = {
    start: pt(ox + d.facingBodyW * 0.45, oy + d.frontNeckDropMm + 60),
    end: pt(ox + d.facingBodyW * 0.45, oy + d.bodyHeightMm - 60),
  };
  const gPts = options?.fixedGrainlines?.["front-facing"] ?? defaultGrain;

  const bbox = computePathsBoundingBox([cutPath]);
  return {
    id: "front-facing",
    code: "FAC-01",
    name: "Đáp nẹp trong lên vai",
    englishName: "Front Inside Facing (to Shoulder Seam)",
    cutQuantity: 2,
    cutNote: `Cắt ×2 (+Keo ép nút bấm) — Rộng ${d.facingBodyW / 10} cm / vai 5.0 cm`,
    material: "self",
    fabricGroup: "Polyester Fleece Maroon",
    displayColor: "#881337",
    sewPaths: [sewPath],
    cutPaths: [cutPath],
    internalPaths: [],
    notches: [
      {
        id: "fac-n-sh",
        point: pHSP,
        cutPoint: pt(pHSP.x - sa * 0.3, pHSP.y - sa),
        angle: Math.PI / 2,
        depth: 5,
        style: "slit",
        label: "Khớp HSP vai",
      },
    ],
    grainline: { start: gPts.start, end: gPts.end, label: "Canh dọc nẹp" },
    dimensions: [
      {
        id: "fac-dim-w",
        from: pFacHemCF,
        to: pFacHemIn,
        label: `${roundCm(d.facingBodyW / 10, 1)} cm`,
        kind: "linear",
        offsetMm: 16,
      },
    ],
    labelAnchor: pt(ox + d.facingBodyW * 0.5, oy + d.bodyHeightMm * 0.58),
    keyPoints: [
      { id: "fac-hsp", code: "FC-HSP", label: "Đỉnh vai đáp nẹp", point: pHSP },
      { id: "fac-hem", code: "FC-HEM", label: "Lai đáp nẹp", point: pFacHemIn },
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
 * PIECE 10: PKB-01 — LÓT TÚI XÉO KÉO XUỐNG LAI & GÀI ĐÁP (Pocket Bag — Cut ×4)
 * Per PPS 03.04.2025: "Bottom of pocket is inserted into hem stitching & tucked under front facing"
 */
function buildPocketBag(
  d: ReturnType<typeof deriveBomberDims>,
  originX: number,
  originY: number,
  options?: BomberGeometryOptions
): PatternPiece {
  const ox = roundMm(originX);
  const oy = roundMm(originY);
  const sa = d.sa;
  const w = d.pocketBagW;
  const topDrop = roundMm(d.pocketOpeningMm * Math.sin((72 * Math.PI) / 180));
  const h = roundMm(topDrop + d.pocketFromRibMm + 25);

  const pTopL = pt(ox, oy + 26);
  const pTopR = pt(ox + w, oy);
  const pBotR = pt(ox + w, oy + h);
  const pBotL = pt(ox, oy + h);

  const sewPath: VectorPath = {
    id: "pkb-sew",
    kind: "sew",
    closed: true,
    segments: [
      { type: "M", to: pTopL },
      { type: "L", to: pTopR },
      { type: "L", to: pBotR },
      { type: "L", to: pBotL },
      { type: "Z" },
    ],
  };

  const cutPath: VectorPath = {
    id: "pkb-cut",
    kind: "cut",
    closed: true,
    segments: [
      { type: "M", to: pt(pTopL.x - sa, pTopL.y - sa) },
      { type: "L", to: pt(pTopR.x + sa, pTopR.y - sa) },
      { type: "L", to: pt(pBotR.x + sa, pBotR.y + sa) },
      { type: "L", to: pt(pBotL.x - sa, pBotL.y + sa) },
      { type: "Z" },
    ],
  };

  const defaultGrain = {
    start: pt(ox + w * 0.5, oy + 45),
    end: pt(ox + w * 0.5, oy + h - 35),
  };
  const gPts = options?.fixedGrainlines?.["pocket-bag"] ?? defaultGrain;

  const bbox = computePathsBoundingBox([cutPath]);
  return {
    id: "pocket-bag",
    code: "PKB-01",
    name: "Lót túi xéo kéo xuống lai",
    englishName: "Pocket Bag (Tucked into Hem & Facing)",
    cutQuantity: 4,
    cutNote: "Cắt ×4 (2 đôi) — Cạnh đáy kẹp đường may bo gấu, cạnh trong đính đáp nẹp",
    material: "lining",
    fabricGroup: "Pocket Jersey / Fleece",
    displayColor: "#94A3B8",
    sewPaths: [sewPath],
    cutPaths: [cutPath],
    internalPaths: [],
    notches: [
      {
        id: "pkb-n-hem",
        point: pt(ox + w * 0.5, oy + h),
        cutPoint: pt(ox + w * 0.5, oy + h + sa),
        angle: -Math.PI / 2,
        depth: 5,
        style: "slit",
        label: "Kẹp vào đường may bo gấu",
      },
    ],
    grainline: { start: gPts.start, end: gPts.end, label: "Canh dọc lót túi" },
    dimensions: [
      {
        id: "pkb-dim-w",
        from: pBotL,
        to: pBotR,
        label: `${roundCm(w / 10, 1)} cm`,
        kind: "linear",
        offsetMm: 16,
      },
    ],
    labelAnchor: pt(ox + w / 2, oy + h * 0.55),
    keyPoints: [
      { id: "pkb-tr", code: "PK-TR", label: "Đỉnh túi", point: pTopR },
      { id: "pkb-br", code: "PK-BR", label: "Đáy túi kẹp bo", point: pBotR },
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

export function generateBomberJacketGeometry(
  rawParams: ParamValues,
  options?: Record<string, unknown>
): PatternGeometryResult {
  const p = parseBomberJacketParams(rawParams);
  const opts = (options ?? {}) as BomberGeometryOptions;
  const d = deriveBomberDims(p);

  const backCenterX = opts.backCenterX ?? roundMm(d.frontW + d.halfBackW + 130);
  const sleeveCenterX =
    opts.sleeveCenterX ?? roundMm(backCenterX + d.halfBackW + d.sleeveHalfBicep + 130);
  const auxRow1Y = opts.auxRow1Y ?? roundMm(d.bodyHeightMm + 115);

  const frontPiece = buildFrontBody(p, d, opts);
  const backPiece = buildBackBody(d, backCenterX, opts);
  const sleevePiece = buildLongSleeve(p, d, sleeveCenterX, opts);

  const pieces: PatternPiece[] = [frontPiece, backPiece, sleevePiece];

  // Neck circumference approx for 1x1 rib collar (84% relaxed rib knit)
  const frontNeckCurve = Math.hypot(d.halfNeck + PRESS_STUD_OVERLAP_MM, d.frontNeckDropMm) * 1.15;
  const backNeckCurve = Math.hypot(d.halfNeck, BACK_NECK_DROP_MM) * 1.03;
  const neckCircMm = roundMm(2 * (frontNeckCurve + backNeckCurve));
  const collarRibLenMm = roundMm(neckCircMm * 0.84);
  const basqueRibLenMm = roundMm(
    Math.max(320, p.ribHemHalf * 10 * 2 - 2 * d.frontSelfHemW)
  );
  // Cuff relaxed width (S2 ≈ 10 cm half = 20 cm full on adult M, ~69% of S1)
  const cuffRibLenMm = roundMm(Math.max(125, p.sleeveOpeningHalf * 10 * 2 * 0.69));

  if (p.includeFullTrims) {
    const facingPiece = buildFrontFacing(d, 0, auxRow1Y, opts);
    const ribStartX = opts.ribStartX ?? roundMm(d.facingBodyW + d.halfNeck + 105);
    const cuffStartX = opts.cuffStartX ?? roundMm(ribStartX + collarRibLenMm + 85);
    const fhpStartX = opts.fhpStartX ?? roundMm(cuffStartX + cuffRibLenMm + 85);
    const bagStartX = opts.bagStartX ?? roundMm(ribStartX + d.pocketOpeningMm + 95);
    const ribUnfoldedH = roundMm(d.ribHeightMm * 2);

    const collarPiece = makeRectPiece({
      id: "rib-collar",
      code: "CLR-01",
      name: "Cổ bo gân 1×1 (2 sọc Gold)",
      englishName: "Wide 1×1 Rib Bomber Collar",
      cutQuantity: 1,
      cutNote: "Cắt ×1 (gập đôi 6.0 cm) — Bo 1×1 Maroon + 2 sọc Gold",
      material: "interfacing",
      fabricGroup: "1×1 Rib Maroon/Gold",
      displayColor: "#CA8A04",
      originX: ribStartX,
      originY: auxRow1Y,
      widthMm: collarRibLenMm,
      heightMm: ribUnfoldedH,
      sa: d.sa,
      hasFoldLine: true,
      hasTwoGoldStripes: true,
      extraNotchRatiosTop: [0.25, 0.5, 0.75],
      fixedGrain: opts.fixedGrainlines?.["rib-collar"],
    });

    const cuffPiece = makeRectPiece({
      id: "rib-cuff",
      code: "CUF-01",
      name: "Bo cửa tay 1×1 (2 sọc Gold)",
      englishName: "1×1 Rib Sleeve Cuff",
      cutQuantity: 2,
      cutNote: "Cắt ×2 (gập đôi 6.0 cm) — Bo 1×1 Maroon + 2 sọc Gold",
      material: "interfacing",
      fabricGroup: "1×1 Rib Maroon/Gold",
      displayColor: "#CA8A04",
      originX: cuffStartX,
      originY: auxRow1Y,
      widthMm: cuffRibLenMm,
      heightMm: ribUnfoldedH,
      sa: d.sa,
      hasFoldLine: true,
      hasTwoGoldStripes: true,
      fixedGrain: opts.fixedGrainlines?.["rib-cuff"],
    });

    const frontHemPanel = makeRectPiece({
      id: "front-hem-panel",
      code: "FHP-01",
      name: "Đáp gấu thân trước (Self Panel)",
      englishName: "Front Hem Self-Fabric Square Panel",
      cutQuantity: 2,
      cutNote: `Cắt ×2 (${d.frontSelfHemW / 10} × ${p.ribHeight} cm TP) — Vải chính Fleece Maroon`,
      material: "self",
      fabricGroup: "Polyester Fleece Maroon",
      displayColor: "#6D1D32",
      originX: fhpStartX,
      originY: auxRow1Y,
      widthMm: d.frontSelfHemW,
      heightMm: ribUnfoldedH,
      sa: d.sa,
      hasFoldLine: true,
      grainOrientation: "vertical",
      fixedGrain: opts.fixedGrainlines?.["front-hem-panel"],
    });

    const basqueY = roundMm(auxRow1Y + ribUnfoldedH + 75);
    const basquePiece = makeRectPiece({
      id: "rib-basque",
      code: "BSQ-01",
      name: "Bo gấu 1×1 (2 sọc Gold)",
      englishName: "1×1 Rib Hem Basque",
      cutQuantity: 1,
      cutNote: "Cắt ×1 (gập đôi 6.0 cm) — Trừ 2 mảnh đáp gấu vải chính",
      material: "interfacing",
      fabricGroup: "1×1 Rib Maroon/Gold",
      displayColor: "#CA8A04",
      originX: ribStartX,
      originY: basqueY,
      widthMm: basqueRibLenMm,
      heightMm: ribUnfoldedH,
      sa: d.sa,
      hasFoldLine: true,
      hasTwoGoldStripes: true,
      extraNotchRatiosTop: [0.25, 0.5, 0.75],
      fixedGrain: opts.fixedGrainlines?.["rib-basque"],
    });

    const row3Y = opts.auxRow2Y ?? roundMm(basqueY + ribUnfoldedH + 75);
    const weltPiece = makeRectPiece({
      id: "pocket-welt",
      code: "WLT-01",
      name: "Cơi túi xéo 3.0 cm",
      englishName: "Angled Pocket Welt (30mm Finished)",
      cutQuantity: 2,
      cutNote: `Cắt ×2 (${p.pocketOpening} × 3.0 cm TP, gập đôi) — Đánh bọ 2 đầu`,
      material: "self",
      fabricGroup: "Polyester Fleece Maroon",
      displayColor: "#6D1D32",
      originX: ribStartX,
      originY: row3Y,
      widthMm: d.pocketOpeningMm,
      heightMm: 60, // 3.0 cm finished × 2
      sa: d.sa,
      hasFoldLine: true,
      fixedGrain: opts.fixedGrainlines?.["pocket-welt"],
    });

    const pocketBagPiece = buildPocketBag(d, bagStartX, row3Y, opts);

    pieces.push(
      facingPiece,
      collarPiece,
      basquePiece,
      frontHemPanel,
      cuffPiece,
      weltPiece,
      pocketBagPiece
    );
  }

  const bbox = mergeBoundingBoxes(pieces.map((pc) => pc.bbox));
  const totalCutPieces = pieces.reduce((acc, pc) => acc + pc.cutQuantity, 0);
  const totalAreaMm2 = pieces.reduce(
    (acc, pc) => acc + pc.metrics.areaMm2 * pc.cutQuantity,
    0
  );

  const formulas: FormulaItem[] = [
    {
      id: "chest-quarter",
      symbol: "W_trước",
      label: "Rộng thân trước (+1.5 cm nẹp cúc bấm 11mm)",
      expression: "Chest / 4 + 1.5",
      substitution: `${p.chest} / 4 + 1.5`,
      valueCm: roundCm(d.frontW / 10, 2),
      valueMm: d.frontW,
    },
    {
      id: "body-len",
      symbol: "L_thân",
      label: "Dài thân vải nỉ Fleece (trừ bo gấu B1)",
      expression: "F - B1",
      substitution: `${p.frontLength} - ${p.ribHeight}`,
      valueCm: roundCm(d.bodyHeightMm / 10, 2),
      valueMm: d.bodyHeightMm,
    },
    {
      id: "sleeve-cap",
      symbol: "H_mang",
      label: "Chiều cao mang tay Bomber (0.435 × E)",
      expression: "E × 0.435",
      substitution: `${p.armholeHalf} × 0.435`,
      valueCm: roundCm(d.sleeveCapH / 10, 2),
      valueMm: d.sleeveCapH,
    },
    {
      id: "basque-len",
      symbol: "L_bo_gấu",
      label: "Dài bo gấu 1×1 (trừ 2 đáp vải chính G)",
      expression: "2×C - 2×G",
      substitution: `2×${p.ribHemHalf} - 2×${d.frontSelfHemW / 10}`,
      valueCm: roundCm(basqueRibLenMm / 10, 2),
      valueMm: basqueRibLenMm,
    },
    {
      id: "collar-len",
      symbol: "L_bo_cổ",
      label: "Dài bo cổ 1×1 (độ co rút chuẩn 84%)",
      expression: "NeckCirc × 0.84",
      substitution: `${roundCm(neckCircMm / 10, 1)} × 0.84`,
      valueCm: roundCm(collarRibLenMm / 10, 2),
      valueMm: collarRibLenMm,
    },
  ];

  const warnings: string[] = [];
  if (p.ribHemHalf * 2 >= p.chest) {
    warnings.push(
      "Rộng bo gấu 1×1 nên nhỏ hơn vòng ngực 15–22% để tạo độ ôm chuẩn dáng Bomber Jacket."
    );
  }
  if (p.frontLength - p.ribHeight < 30) {
    warnings.push("Chiều dài thân vải chính đang quá ngắn so với chiều cao bo gấu.");
  }

  return {
    pieces,
    formulas,
    warnings,
    bbox,
    summary: {
      totalCutPieces,
      estimatedFabricWidthCm: 150,
      estimatedFabricLengthCm: roundCm((totalAreaMm2 / 1_000_000 / 1.46) * 116, 1),
      totalAreaM2: roundCm(totalAreaMm2 / 1_000_000, 3),
      metadata: {
        styleCode: "89865",
        blockNo: "LU9335",
        chestCm: p.chest,
        frontLengthCm: p.frontLength,
      },
    },
  };
}
