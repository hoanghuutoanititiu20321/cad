import { mergeBoundingBoxes, roundCm, roundMm } from "@/lib/cad/math";
import type {
  GradedSizeEntry,
  GradingOverrides,
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
import { parseCircleSkirtParams, WAISTBAND_HEIGHT_CM } from "./schema";

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
  baseSize: SizeCode = "M",
  overrides?: GradingOverrides
): NestedGradingResult {
  const baseParsed = parseCircleSkirtParams(rawBaseParams);
  const baseIdx = SIZE_INDEX[baseSize];
  const baseRadii = computeCircleSkirtRadii(baseParsed);

  const waistStepCm =
    overrides?.waistStepCm ?? CIRCLE_SKIRT_GRADE_RULES.waistStepCm;
  const skirtLengthStepCm =
    overrides?.skirtLengthStepCm ?? CIRCLE_SKIRT_GRADE_RULES.skirtLengthStepCm;
  const pos1OffsetPerStepMm = overrides?.pos1WaistMidOffsetMm ?? 0;
  const pos2OffsetPerStepMm = overrides?.pos2HemMidOffsetMm ?? 0;

  // Compute Base Size curved waistband radius (kept IDENTICAL across S, M, L, XL
  // so left & right ends have identical curvature and grade symmetrically!)
  const defaultSweepRad = 40 / (WAISTBAND_HEIGHT_CM * 10); // 40 / 35
  const fixedWaistbandRTopMm = roundMm((baseParsed.waist * 10) / defaultSweepRad);

  // Pre-compute XL params first to determine a shared, collision-free Y anchor for the nested waistbands
  const xlStep = SIZE_INDEX.XL - baseIdx;
  const xlWaistCm = roundCm(
    Math.max(44, baseParsed.waist + xlStep * waistStepCm),
    2
  );
  const xlParams: ParamValues = {
    ...rawBaseParams,
    waist: xlWaistCm,
    skirtLength: roundCm(
      Math.max(20, baseParsed.skirtLength + xlStep * skirtLengthStepCm),
      2
    ),
  };
  const xlProbe = generateCircleSkirtGeometry(xlParams, {
    fixedWaistbandRTopMm,
  });
  const xlSkirtBbox = xlProbe.pieces[0].bbox;
  const xlSweepRad = (xlWaistCm * 10) / fixedWaistbandRTopMm;
  const xlCurvedRiseMm =
    baseParsed.waistbandType === "curved"
      ? roundMm(
          fixedWaistbandRTopMm * (1 - Math.cos(xlSweepRad / 2)) +
            baseParsed.seamAllowance * 10
        )
      : roundMm(baseParsed.seamAllowance * 10);
  const sharedWaistbandTopY = roundMm(xlSkirtBbox.maxY + 95 + xlCurvedRiseMm);

  // Compute Base Size grainlines once and freeze them across S, M, L, XL!
  // Gerber AccuMark aligns graded blocks by their Layer 7 Grainline:
  // freezing grainline coordinates keeps arc center (0,0) and waistband CF (x=0) locked,
  // guaranteeing ΔY(waist side) === ΔX(waist CF [1]) and symmetric waistband ends!
  const baseProbe = generateCircleSkirtGeometry(rawBaseParams, {
    waistbandTopY: sharedWaistbandTopY,
    fixedWaistbandRTopMm,
  });
  const fixedSkirtGrainline = {
    start: baseProbe.pieces[0].grainline.start,
    end: baseProbe.pieces[0].grainline.end,
  };
  const fixedWaistbandGrainline = {
    start: baseProbe.pieces[1].grainline.start,
    end: baseProbe.pieces[1].grainline.end,
  };

  // Build full geometry for S, M, L, XL sharing concentric skirt origin, identical grainline & curvature
  const entries: GradedSizeEntry[] = SIZE_DEFINITIONS.map((def) => {
    const stepDelta = SIZE_INDEX[def.code] - baseIdx;
    const sizeWaist = roundCm(
      Math.max(44, baseParsed.waist + stepDelta * waistStepCm),
      2
    );
    const sizeLength = roundCm(
      Math.max(20, baseParsed.skirtLength + stepDelta * skirtLengthStepCm),
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
      fixedWaistbandRTopMm,
      fixedSkirtGrainline,
      fixedWaistbandGrainline,
      pos1WaistMidDeltaMm: roundMm(stepDelta * pos1OffsetPerStepMm),
      pos2HemMidDeltaMm: roundMm(stepDelta * pos2OffsetPerStepMm),
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
        deltaRWaistMm: roundMm(
          radii.rWaistMm - baseRadii.rWaistMm + stepDelta * pos1OffsetPerStepMm
        ),
        deltaRHemMm: roundMm(
          radii.rHemMm - baseRadii.rHemMm + stepDelta * pos2OffsetPerStepMm
        ),
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
