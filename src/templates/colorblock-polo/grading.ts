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
import { generateColorblockPoloGeometry } from "./geometry";
import { parseColorblockPoloParams } from "./schema";

/**
 * Exact Style HAZE026-028 Adult Grading Increments (S - M - L - XL)
 * Directly extracted from `HAZE026-028 POLO PRODUCTION SPEC.xlsx` (Sheet: SPEC):
 * - Center Back Length (B):     +2.0 cm / size (69, 71, 73, 75)
 * - Chest & Hem Circ. (C & D):  +5.0 cm / size (105, 110, 115, 120)
 * - Neck Width (E):             +0.5 cm / size (20.0, 20.5, 21.0, 21.5)
 * - Front Neck Drop (F):        +0.3 cm / size (7.2, 7.5, 7.8, 8.1)
 * - Back Neck Drop (G):          0.0 cm (constant 2.0 cm)
 * - Shoulder Width (H):         +2.5 cm / size (47.0, 49.5, 52.0, 54.5)
 * - Sleeve Length (J):          +1.0 cm / size (23, 24, 25, 26)
 * - 1/2 Sleeve Opening (L):     +1.0 cm / size (19, 20, 21, 22)
 * - 1/2 Armhole Circ. (M):      +1.0 cm / size (26, 27, 28, 29)
 */
export const HAZE026_GRADE_RULES = {
  chestStepCm: 5.0,
  cbLengthStepCm: 2.0,
  shoulderStepCm: 2.5,
  armholeHalfStepCm: 1.0,
  neckWidthStepCm: 0.5,
  frontNeckDropStepCm: 0.3,
  sleeveLengthStepCm: 1.0,
  sleeveOpeningHalfStepCm: 1.0,
} as const;

const SIZE_INDEX: Record<SizeCode, number> = {
  S: 0,
  M: 1,
  L: 2,
  XL: 3,
};

export function generateColorblockPoloGrading(
  rawBaseParams: ParamValues,
  baseSize: SizeCode = "M",
  overrides?: GradingOverrides
): NestedGradingResult {
  const base = parseColorblockPoloParams(rawBaseParams);
  const baseIdx = SIZE_INDEX[baseSize];

  const chestStep = overrides?.waistStepCm ?? HAZE026_GRADE_RULES.chestStepCm;
  const lengthStep =
    overrides?.skirtLengthStepCm ?? HAZE026_GRADE_RULES.cbLengthStepCm;

  // Pre-compute XL bounding layout so all S-M-L-XL columns align concentrically without overlap
  const xlDelta = SIZE_INDEX.XL - baseIdx;
  const xlParams: ParamValues = {
    ...rawBaseParams,
    chest: roundCm(base.chest + xlDelta * chestStep, 2),
    cbLength: roundCm(base.cbLength + xlDelta * lengthStep, 2),
    shoulder: roundCm(
      base.shoulder + xlDelta * HAZE026_GRADE_RULES.shoulderStepCm,
      2
    ),
    armholeHalf: roundCm(
      base.armholeHalf + xlDelta * HAZE026_GRADE_RULES.armholeHalfStepCm,
      2
    ),
    neckWidth: roundCm(
      base.neckWidth + xlDelta * HAZE026_GRADE_RULES.neckWidthStepCm,
      2
    ),
    frontNeckDrop: roundCm(
      base.frontNeckDrop + xlDelta * HAZE026_GRADE_RULES.frontNeckDropStepCm,
      2
    ),
    sleeveLength: roundCm(
      base.sleeveLength + xlDelta * HAZE026_GRADE_RULES.sleeveLengthStepCm,
      2
    ),
    sleeveOpeningHalf: roundCm(
      base.sleeveOpeningHalf +
        xlDelta * HAZE026_GRADE_RULES.sleeveOpeningHalfStepCm,
      2
    ),
  };

  const xlProbe = generateColorblockPoloGeometry(xlParams);
  const xlFrontTop = xlProbe.pieces[0];
  const xlBack = xlProbe.pieces.find((pc) => pc.id === "back-body") ?? xlProbe.pieces[1];
  const xlSleeve =
    xlProbe.pieces.find((pc) => pc.id === "short-sleeve") ?? xlProbe.pieces[2];

  const sharedBackCenterX = roundMm(
    xlFrontTop.bbox.maxX + xlBack.bbox.width * 0.5 + 115
  );
  const sharedSleeveCenterX = roundMm(
    sharedBackCenterX + xlBack.bbox.width * 0.5 + xlSleeve.bbox.width * 0.5 + 125
  );
  const sharedAuxColStartY = roundMm(xlSleeve.bbox.maxY + 110);

  // Freeze Layer 7 Grainline coordinates from Base Size so Gerber AccuMark merges S-M-L-XL concentrically!
  const baseProbe = generateColorblockPoloGeometry(rawBaseParams, {
    backCenterX: sharedBackCenterX,
    sleeveCenterX: sharedSleeveCenterX,
    auxColStartY: sharedAuxColStartY,
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
    const sizeChest = roundCm(Math.max(68, base.chest + step * chestStep), 2);
    const sizeCbLength = roundCm(
      Math.max(40, base.cbLength + step * lengthStep),
      2
    );
    const sizeShoulder = roundCm(
      Math.max(28, base.shoulder + step * HAZE026_GRADE_RULES.shoulderStepCm),
      2
    );
    const sizeArmholeHalf = roundCm(
      Math.max(
        16,
        base.armholeHalf + step * HAZE026_GRADE_RULES.armholeHalfStepCm
      ),
      2
    );
    const sizeNeckWidth = roundCm(
      Math.max(14, base.neckWidth + step * HAZE026_GRADE_RULES.neckWidthStepCm),
      2
    );
    const sizeFrontNeckDrop = roundCm(
      Math.max(
        4.5,
        base.frontNeckDrop + step * HAZE026_GRADE_RULES.frontNeckDropStepCm
      ),
      2
    );
    const sizeSleeveLength = roundCm(
      Math.max(
        14,
        base.sleeveLength + step * HAZE026_GRADE_RULES.sleeveLengthStepCm
      ),
      2
    );
    const sizeSleeveOpeningHalf = roundCm(
      Math.max(
        11,
        base.sleeveOpeningHalf +
          step * HAZE026_GRADE_RULES.sleeveOpeningHalfStepCm
      ),
      2
    );

    const sizeParams: ParamValues = {
      ...rawBaseParams,
      chest: sizeChest,
      cbLength: sizeCbLength,
      shoulder: sizeShoulder,
      armholeHalf: sizeArmholeHalf,
      neckWidth: sizeNeckWidth,
      frontNeckDrop: sizeFrontNeckDrop,
      sleeveLength: sizeSleeveLength,
      sleeveOpeningHalf: sizeSleeveOpeningHalf,
    };

    const geometry = generateColorblockPoloGeometry(sizeParams, {
      backCenterX: sharedBackCenterX,
      sleeveCenterX: sharedSleeveCenterX,
      auxColStartY: sharedAuxColStartY,
      fixedGrainlines,
    });

    return {
      size: def.code,
      isBase: def.code === baseSize,
      color: def.color,
      params: sizeParams,
      measurements: {
        waistCm: sizeChest,
        effectiveWaistCm: sizeChest,
        skirtLengthCm: sizeCbLength,
        rWaistCm: sizeShoulder,
        rWaistMm: roundMm(sizeShoulder * 10),
        rHemCm: sizeSleeveLength,
        rHemMm: roundMm(sizeSleeveLength * 10),
        deltaRWaistMm: roundMm((sizeChest - base.chest) * 10),
        deltaRHemMm: roundMm((sizeCbLength - base.cbLength) * 10),
        pieceArcWaistCm: sizeArmholeHalf,
        pieceArcHemCm: sizeSleeveOpeningHalf,
        chestCm: sizeChest,
        hemCm: sizeChest,
        shoulderCm: sizeShoulder,
        armholeHalfCm: sizeArmholeHalf,
        bodyLengthCm: sizeCbLength,
        neckWidthCm: sizeNeckWidth,
        frontNeckDropCm: sizeFrontNeckDrop,
        backNeckDropCm: base.backNeckDrop,
        sleeveLengthCm: sizeSleeveLength,
        sleeveOpeningHalfCm: sizeSleeveOpeningHalf,
      },
      geometry,
    };
  });

  const baseEntry = entries.find((e) => e.size === baseSize) ?? entries[1];
  const pointTable: PointGradingRow[] = [];

  for (const basePiece of baseEntry.geometry.pieces) {
    if (
      ![
        "front-1-white",
        "front-4-bottle",
        "front-solid",
        "back-body",
        "short-sleeve",
      ].includes(basePiece.id)
    ) {
      continue;
    }
    for (const kp of basePiece.keyPoints) {
      const bySize = {} as PointGradingRow["bySize"];
      for (const entry of entries) {
        const mp = entry.geometry.pieces.find((pc) => pc.id === basePiece.id);
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

  return {
    baseSize,
    sizes: SIZE_DEFINITIONS.map((d) => d.code),
    entries,
    pointTable,
    combinedBbox: mergeBoundingBoxes(entries.map((e) => e.geometry.bbox)),
  };
}
