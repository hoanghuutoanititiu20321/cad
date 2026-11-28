import { mergeBoundingBoxes, roundCm, roundMm } from "@/lib/cad/math";
import type {
  GradedSizeEntry,
  GradingOverrides,
  NestedGradingResult,
  ParamValues,
  Point2D,
  PointGradingRow,
  SizeCode,
} from "@/lib/cad/types";
import { SIZE_DEFINITIONS } from "@/templates/circle-skirt/grading";
import { generateBaggyJeanGeometry } from "./geometry";
import { parseBaggyJeanParams } from "./schema";

/**
 * Standard Women's Trouser / Baggy Jean Grading Rules
 * Calibrated directly from Bang_Thong_So_Co_The_Va_Ma_No_Canh_Chuan.xlsx (Thong_So_Nu):
 * - Waist: +4.0 cm / size
 * - Hip: +4.0 cm / size
 * - Thigh (1" below crotch): +2.5 cm / size
 * - Knee (13" below crotch): +1.5 cm / size
 * - Hem Opening: +1.0 cm / size
 * - Front Rise: +1.0 cm / size | Back Rise: +1.2 cm / size
 * - Inseam: +1.5 cm / size
 */
export const BAGGY_JEAN_GRADE_RULES = {
  waistStepCm: 4.0,
  hipStepCm: 4.0,
  thighStepCm: 2.5,
  kneeStepCm: 1.5,
  hemStepCm: 1.0,
  frontRiseStepCm: 1.0,
  backRiseStepCm: 1.2,
  inseamStepCm: 1.5,
} as const;

const SIZE_INDEX: Record<SizeCode, number> = {
  S: 0,
  M: 1,
  L: 2,
  XL: 3,
};

export function generateBaggyJeanGrading(
  rawBaseParams: ParamValues,
  baseSize: SizeCode = "M",
  overrides?: GradingOverrides
): NestedGradingResult {
  const base = parseBaggyJeanParams(rawBaseParams);
  const baseIdx = SIZE_INDEX[baseSize];

  const waistStep = overrides?.waistStepCm ?? BAGGY_JEAN_GRADE_RULES.waistStepCm;
  const inseamStep =
    overrides?.skirtLengthStepCm !== undefined
      ? overrides.skirtLengthStepCm
      : BAGGY_JEAN_GRADE_RULES.inseamStepCm;

  // Fixed curved waistband radius from Base Size for symmetric Gerber AccuMark grading
  const baseWbLenMm = base.waist * 10 + 38.1;
  const fixedWaistbandRTopMm = roundMm(
    baseWbLenMm / (45 / (base.waistbandHeight * 10))
  );

  // Pre-compute XL bounding layout so all graded sizes share identical Back Origin X & Aux Y anchors
  const xlDelta = SIZE_INDEX.XL - baseIdx;
  const xlParams: ParamValues = {
    ...rawBaseParams,
    waist: roundCm(base.waist + xlDelta * waistStep, 2),
    hip: roundCm(base.hip + xlDelta * BAGGY_JEAN_GRADE_RULES.hipStepCm, 2),
    thigh: roundCm(base.thigh + xlDelta * BAGGY_JEAN_GRADE_RULES.thighStepCm, 2),
    knee: roundCm(base.knee + xlDelta * BAGGY_JEAN_GRADE_RULES.kneeStepCm, 2),
    hemOpening: roundCm(
      base.hemOpening + xlDelta * BAGGY_JEAN_GRADE_RULES.hemStepCm,
      2
    ),
    frontRise: roundCm(
      base.frontRise + xlDelta * BAGGY_JEAN_GRADE_RULES.frontRiseStepCm,
      2
    ),
    backRise: roundCm(
      base.backRise + xlDelta * BAGGY_JEAN_GRADE_RULES.backRiseStepCm,
      2
    ),
    inseam: roundCm(base.inseam + xlDelta * inseamStep, 2),
  };

  const xlProbe = generateBaggyJeanGeometry(xlParams, {
    fixedWaistbandRTopMm,
  });
  const xlFront = xlProbe.pieces[0];
  const xlBack = xlProbe.pieces[1];
  const sharedBackOriginX = roundMm(
    xlFront.bbox.maxX + Number(xlParams.thigh) * 10 * 0.34 + 130
  );
  const sharedAuxAnchorY = roundMm(
    Math.max(xlFront.bbox.maxY, xlBack.bbox.maxY) + 140
  );

  // Freeze grainline coordinates from Base Size so Gerber AccuMark keeps all S-M-L-XL blocks locked concentrically!
  const baseProbe = generateBaggyJeanGeometry(rawBaseParams, {
    backOriginX: sharedBackOriginX,
    auxAnchorY: sharedAuxAnchorY,
    fixedWaistbandRTopMm,
  });
  const fixedGrainlines: Record<string, { start: Point2D; end: Point2D }> = {};
  for (const pc of baseProbe.pieces) {
    fixedGrainlines[pc.id] = {
      start: pc.grainline.start,
      end: pc.grainline.end,
    };
  }

  const entries: GradedSizeEntry[] = SIZE_DEFINITIONS.map((def) => {
    const step = SIZE_INDEX[def.code] - baseIdx;
    const sizeWaist = roundCm(Math.max(54, base.waist + step * waistStep), 2);
    const sizeHip = roundCm(
      Math.max(76, base.hip + step * BAGGY_JEAN_GRADE_RULES.hipStepCm),
      2
    );
    const sizeThigh = roundCm(
      Math.max(44, base.thigh + step * BAGGY_JEAN_GRADE_RULES.thighStepCm),
      2
    );
    const sizeKnee = roundCm(
      Math.max(32, base.knee + step * BAGGY_JEAN_GRADE_RULES.kneeStepCm),
      2
    );
    const sizeHem = roundCm(
      Math.max(26, base.hemOpening + step * BAGGY_JEAN_GRADE_RULES.hemStepCm),
      2
    );
    const sizeFrontRise = roundCm(
      Math.max(17, base.frontRise + step * BAGGY_JEAN_GRADE_RULES.frontRiseStepCm),
      2
    );
    const sizeBackRise = roundCm(
      Math.max(26, base.backRise + step * BAGGY_JEAN_GRADE_RULES.backRiseStepCm),
      2
    );
    const sizeInseam = roundCm(Math.max(55, base.inseam + step * inseamStep), 2);

    const sizeParams: ParamValues = {
      ...rawBaseParams,
      waist: sizeWaist,
      hip: sizeHip,
      thigh: sizeThigh,
      knee: sizeKnee,
      hemOpening: sizeHem,
      frontRise: sizeFrontRise,
      backRise: sizeBackRise,
      inseam: sizeInseam,
    };

    const geometry = generateBaggyJeanGeometry(sizeParams, {
      backOriginX: sharedBackOriginX,
      auxAnchorY: sharedAuxAnchorY,
      fixedWaistbandRTopMm,
      fixedGrainlines,
    });

    const outseamCm = roundCm(sizeInseam + sizeFrontRise - 1.0, 1);

    return {
      size: def.code,
      isBase: def.code === baseSize,
      color: def.color,
      params: sizeParams,
      measurements: {
        waistCm: sizeWaist,
        effectiveWaistCm: sizeWaist,
        skirtLengthCm: outseamCm,
        rWaistCm: sizeHip,
        rWaistMm: roundMm(sizeHip * 10),
        rHemCm: sizeThigh,
        rHemMm: roundMm(sizeThigh * 10),
        deltaRWaistMm: roundMm((sizeHip - base.hip) * 10),
        deltaRHemMm: roundMm((sizeThigh - base.thigh) * 10),
        pieceArcWaistCm: sizeKnee,
        pieceArcHemCm: sizeHem,
        hipCm: sizeHip,
        thighCm: sizeThigh,
        kneeCm: sizeKnee,
        hemOpeningCm: sizeHem,
        inseamCm: sizeInseam,
        frontRiseCm: sizeFrontRise,
        backRiseCm: sizeBackRise,
        outseamCm,
      },
      geometry,
    };
  });

  // Build exact Key-Point Grading Table (X, Y, ΔX, ΔY in mm)
  const baseEntry = entries.find((e) => e.size === baseSize) ?? entries[1];
  const pointTable: PointGradingRow[] = [];

  for (const basePiece of baseEntry.geometry.pieces) {
    // Only main graded pieces (Front, Back, Yoke, Waistband) in coordinate table
    if (!["front-panel", "back-panel", "back-yoke", "waistband"].includes(basePiece.id)) {
      continue;
    }
    for (const kp of basePiece.keyPoints) {
      const bySize = {} as PointGradingRow["bySize"];
      for (const entry of entries) {
        const mp = entry.geometry.pieces.find((p) => p.id === basePiece.id);
        const mkp = mp?.keyPoints.find((k) => k.id === kp.id);
        const ptVal = mkp?.point ?? kp.point;
        bySize[entry.size] = {
          x: roundMm(ptVal.x),
          y: roundMm(ptVal.y),
          dx: roundMm(ptVal.x - kp.point.x),
          dy: roundMm(ptVal.y - kp.point.y),
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
