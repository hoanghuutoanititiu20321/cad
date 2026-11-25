import { mergeBoundingBoxes, roundCm, roundMm } from "@/lib/cad/math";
import type {
  GradedSizeEntry,
  NestedGradingResult,
  ParamValues,
  PointGradingRow,
  SizeCode,
  SizeDefinition,
} from "@/lib/cad/types";
import {
  computeCircleSkirtRadii,
  generateCircleSkirtGeometry,
} from "./geometry";
import { parseCircleSkirtParams } from "./schema";

/**
 * Standard grading increments per size step (S -> M -> L -> XL):
 * - Waist circumference: +4.0 cm per size
 * - Skirt length: +1.0 cm per size
 */
export const CIRCLE_SKIRT_GRADE_RULES = {
  waistStepCm: 4.0,
  skirtLengthStepCm: 1.0,
} as const;

export const SIZE_DEFINITIONS: SizeDefinition[] = [
  {
    code: "S",
    label: "Size S",
    color: "#059669", // Emerald 600
    bgClass: "bg-emerald-50",
    borderClass: "border-emerald-200",
    textClass: "text-emerald-700",
    stepFromM: -1,
  },
  {
    code: "M",
    label: "Size M",
    color: "#4F46E5", // Royal Indigo 600
    bgClass: "bg-indigo-50",
    borderClass: "border-indigo-200",
    textClass: "text-indigo-700",
    stepFromM: 0,
  },
  {
    code: "L",
    label: "Size L",
    color: "#D97706", // Amber 600
    bgClass: "bg-amber-50",
    borderClass: "border-amber-200",
    textClass: "text-amber-700",
    stepFromM: 1,
  },
  {
    code: "XL",
    label: "Size XL",
    color: "#E11D48", // Rose 600
    bgClass: "bg-rose-50",
    borderClass: "border-rose-200",
    textClass: "text-rose-700",
    stepFromM: 2,
  },
];

const SIZE_INDEX: Record<SizeCode, number> = {
  S: 0,
  M: 1,
  L: 2,
  XL: 3,
};

/**
 * Compute Nested Grading (S, M, L, XL) for the Flared Circle Skirt.
 * - Automatically recalculates R_waist and R_hem for each size (+4cm waist, +1cm skirt length per step).
 * - Aligns all skirt panels concentrically at arc center (0, 0) and aligns all waistbands
 *   at a shared top-center anchor Y below the XL skirt panel so nested layers never overlap.
 */
export function generateCircleSkirtGrading(
  rawBaseParams: ParamValues,
  baseSize: SizeCode = "M"
): NestedGradingResult {
  const baseParsed = parseCircleSkirtParams(rawBaseParams);
  const baseIdx = SIZE_INDEX[baseSize];
  const baseRadii = computeCircleSkirtRadii(baseParsed);

  // Pre-compute XL params first to determine a shared, collision-free Y anchor for the nested waistbands
  const xlStep = SIZE_INDEX.XL - baseIdx;
  const xlParams: ParamValues = {
    ...rawBaseParams,
    waist: roundCm(
      baseParsed.waist + xlStep * CIRCLE_SKIRT_GRADE_RULES.waistStepCm,
      2
    ),
    skirtLength: roundCm(
      baseParsed.skirtLength +
        xlStep * CIRCLE_SKIRT_GRADE_RULES.skirtLengthStepCm,
      2
    ),
  };
  const xlProbe = generateCircleSkirtGeometry(xlParams);
  const xlSkirtBbox = xlProbe.pieces[0].bbox;
  const xlWaistMm = Number(xlParams.waist) * 10;
  const sweepRad = 40 / 35;
  const xlCurvedRiseMm =
    baseParsed.waistbandType === "curved"
      ? roundMm((xlWaistMm / sweepRad) * (1 - Math.cos(sweepRad / 2)) + baseParsed.seamAllowance * 10)
      : roundMm(baseParsed.seamAllowance * 10);
  const sharedWaistbandTopY = roundMm(xlSkirtBbox.maxY + 95 + xlCurvedRiseMm);

  // Build full geometry for S, M, L, XL sharing concentric skirt origin & aligned waistband anchor
  const entries: GradedSizeEntry[] = SIZE_DEFINITIONS.map((def) => {
    const stepDelta = SIZE_INDEX[def.code] - baseIdx;
    const sizeWaist = roundCm(
      Math.max(
        44,
        baseParsed.waist + stepDelta * CIRCLE_SKIRT_GRADE_RULES.waistStepCm
      ),
      2
    );
    const sizeLength = roundCm(
      Math.max(
        20,
        baseParsed.skirtLength +
          stepDelta * CIRCLE_SKIRT_GRADE_RULES.skirtLengthStepCm
      ),
      2
    );

    const sizeParams: ParamValues = {
      ...rawBaseParams,
      waist: sizeWaist,
      skirtLength: sizeLength,
    };

    const parsedSize = parseCircleSkirtParams(sizeParams);
    const radii = computeCircleSkirtRadii(parsedSize);
    const geometry = generateCircleSkirtGeometry(sizeParams, {
      waistbandTopY: sharedWaistbandTopY,
    });

    return {
      size: def.code,
      isBase: def.code === baseSize,
      color: def.color,
      params: sizeParams,
      measurements: {
        waistCm: sizeWaist,
        effectiveWaistCm: radii.effectiveWaistCm,
        skirtLengthCm: sizeLength,
        rWaistCm: roundCm(radii.rWaistCm, 2),
        rWaistMm: radii.rWaistMm,
        rHemCm: roundCm(radii.rHemCm, 2),
        rHemMm: radii.rHemMm,
        deltaRWaistMm: roundMm(radii.rWaistMm - baseRadii.rWaistMm),
        deltaRHemMm: roundMm(radii.rHemMm - baseRadii.rHemMm),
        pieceArcWaistCm: radii.pieceArcWaistCm,
        pieceArcHemCm: radii.pieceArcHemCm,
      },
      geometry,
    };
  });

  // Build exact key-point grading coordinate table (X, Y, ΔX, ΔY in mm) relative to Base Size
  const baseEntry = entries.find((e) => e.size === baseSize) ?? entries[1];
  const pointTable: PointGradingRow[] = [];

  for (const basePiece of baseEntry.geometry.pieces) {
    for (const kp of basePiece.keyPoints) {
      const bySize = {} as PointGradingRow["bySize"];

      for (const entry of entries) {
        const matchPiece = entry.geometry.pieces.find(
          (p) => p.id === basePiece.id
        );
        const matchKp = matchPiece?.keyPoints.find((k) => k.id === kp.id);
        const p = matchKp?.point ?? kp.point;
        bySize[entry.size] = {
          x: roundMm(p.x),
          y: roundMm(p.y),
          dx: roundMm(p.x - kp.point.x),
          dy: roundMm(p.y - kp.point.y),
        };
      }

      pointTable.push({
        pieceId: basePiece.id,
        pieceName: basePiece.name,
        pointCode: kp.code,
        pointLabel: kp.label,
        bySize,
      });
    }
  }

  const combinedBbox = mergeBoundingBoxes(entries.map((e) => e.geometry.bbox));

  return {
    baseSize,
    sizes: SIZE_DEFINITIONS.map((d) => d.code),
    entries,
    pointTable,
    combinedBbox,
  };
}
