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
import { generateBomberJacketGeometry } from "./geometry";
import { parseBomberJacketParams } from "./schema";

/**
 * Exact Style 89865 Australian Size Standards Adult Grading Increments (S - M - L - XL)
 * Directly extracted from `89865 - SPEC & Report.xls` (Sheet: SPEC):
 * - Chest Circ. (A) & Hem Circ. (B): +5.0 cm / size (112, 117, 122, 127)
 * - Rib Hem Width Half (C):          +2.5 cm / size (43.5, 46.0, 48.5, 51.0)
 * - Shoulder to Shoulder (D):        +2.0 cm / size (45.0, 47.0, 49.0, 51.0)
 * - Armhole Curve Half (E):          +1.0 cm / size (26.5, 27.5, 28.5, 29.5)
 * - Front Length from HSP (F):       +2.0 cm / size (71.0, 73.0, 75.0, 77.0)
 * - Neck Width (N):                  +0.5 cm / size (17.0, 17.5, 18.0, 18.5)
 * - Front Neck Drop (N1):            +0.5 cm / size (9.5, 10.0, 10.5, 11.0)
 * - Sleeve Length incl. Cuff (S):    +0.5 cm / size (64.0, 64.5, 65.0, 65.5)
 * - Sleeve Opening Flat Half (S1):   +0.5 cm / size (14.0, 14.5, 15.0, 15.5)
 */
export const BOMBER_89865_GRADE_RULES = {
  chestStepCm: 5.0,
  ribHemHalfStepCm: 2.5,
  shoulderStepCm: 2.0,
  armholeHalfStepCm: 1.0,
  lengthStepCm: 2.0,
  neckWidthStepCm: 0.5,
  frontNeckDropStepCm: 0.5,
  sleeveLengthStepCm: 0.5,
  sleeveOpeningHalfStepCm: 0.5,
} as const;

const SIZE_INDEX: Record<SizeCode, number> = {
  S: 0,
  M: 1,
  L: 2,
  XL: 3,
};

export function generateBomberJacketGrading(
  rawBaseParams: ParamValues,
  baseSize: SizeCode = "M",
  overrides?: GradingOverrides
): NestedGradingResult {
  const base = parseBomberJacketParams(rawBaseParams);
  const baseIdx = SIZE_INDEX[baseSize];

  const chestStep = overrides?.waistStepCm ?? BOMBER_89865_GRADE_RULES.chestStepCm;
  const lengthStep =
    overrides?.skirtLengthStepCm ?? BOMBER_89865_GRADE_RULES.lengthStepCm;

  // Pre-compute XL extents so all S-M-L-XL pieces share identical layout anchors without colliding
  const xlDelta = SIZE_INDEX.XL - baseIdx;
  const xlParams: ParamValues = {
    ...rawBaseParams,
    chest: roundCm(base.chest + xlDelta * chestStep, 2),
    ribHemHalf: roundCm(
      base.ribHemHalf + xlDelta * BOMBER_89865_GRADE_RULES.ribHemHalfStepCm,
      2
    ),
    shoulder: roundCm(
      base.shoulder + xlDelta * BOMBER_89865_GRADE_RULES.shoulderStepCm,
      2
    ),
    armholeHalf: roundCm(
      base.armholeHalf + xlDelta * BOMBER_89865_GRADE_RULES.armholeHalfStepCm,
      2
    ),
    frontLength: roundCm(base.frontLength + xlDelta * lengthStep, 2),
    neckWidth: roundCm(
      base.neckWidth + xlDelta * BOMBER_89865_GRADE_RULES.neckWidthStepCm,
      2
    ),
    frontNeckDrop: roundCm(
      base.frontNeckDrop +
        xlDelta * BOMBER_89865_GRADE_RULES.frontNeckDropStepCm,
      2
    ),
    sleeveLength: roundCm(
      base.sleeveLength + xlDelta * BOMBER_89865_GRADE_RULES.sleeveLengthStepCm,
      2
    ),
    sleeveOpeningHalf: roundCm(
      base.sleeveOpeningHalf +
        xlDelta * BOMBER_89865_GRADE_RULES.sleeveOpeningHalfStepCm,
      2
    ),
  };

  const xlProbe = generateBomberJacketGeometry(xlParams);
  const xlFront = xlProbe.pieces[0];
  const xlBack = xlProbe.pieces[1];
  const xlSleeve = xlProbe.pieces[2];

  const sharedBackCenterX = roundMm(xlFront.bbox.maxX + xlBack.bbox.width * 0.5 + 115);
  const sharedSleeveCenterX = roundMm(
    sharedBackCenterX + xlBack.bbox.width * 0.5 + xlSleeve.bbox.width * 0.5 + 115
  );
  const sharedAuxRow1Y = roundMm(
    Math.max(xlFront.bbox.maxY, xlBack.bbox.maxY, xlSleeve.bbox.maxY) + 120
  );
  const sharedAuxRow2Y = roundMm(
    sharedAuxRow1Y + base.ribHeight * 10 * 4 + 165
  );
  const xlFacing = xlProbe.pieces.find((pc) => pc.id === "front-facing");
  const xlCollar = xlProbe.pieces.find((pc) => pc.id === "rib-collar");
  const xlCuff = xlProbe.pieces.find((pc) => pc.id === "rib-cuff");
  const xlWelt = xlProbe.pieces.find((pc) => pc.id === "pocket-welt");
  const sharedRibStartX = roundMm((xlFacing?.bbox.maxX ?? 240) + 90);
  const sharedCuffStartX = roundMm(
    sharedRibStartX + (xlCollar?.bbox.width ?? 480) + 75
  );
  const sharedFhpStartX = roundMm(
    sharedCuffStartX + (xlCuff?.bbox.width ?? 240) + 75
  );
  const sharedBagStartX = roundMm(
    sharedRibStartX + (xlWelt?.bbox.width ?? 200) + 85
  );

  // Freeze Layer 7 Grainline coordinates from Base Size so Gerber AccuMark keeps all S-M-L-XL blocks locked!
  const baseProbe = generateBomberJacketGeometry(rawBaseParams, {
    backCenterX: sharedBackCenterX,
    sleeveCenterX: sharedSleeveCenterX,
    auxRow1Y: sharedAuxRow1Y,
    auxRow2Y: sharedAuxRow2Y,
    ribStartX: sharedRibStartX,
    cuffStartX: sharedCuffStartX,
    fhpStartX: sharedFhpStartX,
    bagStartX: sharedBagStartX,
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
    const sizeChest = roundCm(Math.max(70, base.chest + step * chestStep), 2);
    const sizeRibHemHalf = roundCm(
      Math.max(24, base.ribHemHalf + step * BOMBER_89865_GRADE_RULES.ribHemHalfStepCm),
      2
    );
    const sizeShoulder = roundCm(
      Math.max(28, base.shoulder + step * BOMBER_89865_GRADE_RULES.shoulderStepCm),
      2
    );
    const sizeArmholeHalf = roundCm(
      Math.max(
        16,
        base.armholeHalf + step * BOMBER_89865_GRADE_RULES.armholeHalfStepCm
      ),
      2
    );
    const sizeFrontLength = roundCm(
      Math.max(44, base.frontLength + step * lengthStep),
      2
    );
    const sizeNeckWidth = roundCm(
      Math.max(
        12,
        base.neckWidth + step * BOMBER_89865_GRADE_RULES.neckWidthStepCm
      ),
      2
    );
    const sizeFrontNeckDrop = roundCm(
      Math.max(
        5,
        base.frontNeckDrop +
          step * BOMBER_89865_GRADE_RULES.frontNeckDropStepCm
      ),
      2
    );
    const sizeSleeveLength = roundCm(
      Math.max(
        36,
        base.sleeveLength + step * BOMBER_89865_GRADE_RULES.sleeveLengthStepCm
      ),
      2
    );
    const sizeSleeveOpeningHalf = roundCm(
      Math.max(
        9.5,
        base.sleeveOpeningHalf +
          step * BOMBER_89865_GRADE_RULES.sleeveOpeningHalfStepCm
      ),
      2
    );

    const sizeParams: ParamValues = {
      ...rawBaseParams,
      chest: sizeChest,
      ribHemHalf: sizeRibHemHalf,
      shoulder: sizeShoulder,
      armholeHalf: sizeArmholeHalf,
      frontLength: sizeFrontLength,
      neckWidth: sizeNeckWidth,
      frontNeckDrop: sizeFrontNeckDrop,
      sleeveLength: sizeSleeveLength,
      sleeveOpeningHalf: sizeSleeveOpeningHalf,
    };

    const geometry = generateBomberJacketGeometry(sizeParams, {
      backCenterX: sharedBackCenterX,
      sleeveCenterX: sharedSleeveCenterX,
      auxRow1Y: sharedAuxRow1Y,
      auxRow2Y: sharedAuxRow2Y,
      ribStartX: sharedRibStartX,
      cuffStartX: sharedCuffStartX,
      fhpStartX: sharedFhpStartX,
      bagStartX: sharedBagStartX,
      fixedGrainlines,
    });

    return {
      size: def.code,
      isBase: def.code === baseSize,
      color: def.color,
      params: sizeParams,
      measurements: {
        waistCm: sizeChest, // kept populated for shared summary hooks
        effectiveWaistCm: sizeChest,
        skirtLengthCm: sizeFrontLength,
        rWaistCm: sizeShoulder,
        rWaistMm: roundMm(sizeShoulder * 10),
        rHemCm: sizeSleeveLength,
        rHemMm: roundMm(sizeSleeveLength * 10),
        deltaRWaistMm: roundMm((sizeChest - base.chest) * 10),
        deltaRHemMm: roundMm((sizeFrontLength - base.frontLength) * 10),
        pieceArcWaistCm: sizeArmholeHalf,
        pieceArcHemCm: sizeRibHemHalf,
        chestCm: sizeChest,
        hemCm: sizeChest,
        ribHemHalfCm: sizeRibHemHalf,
        shoulderCm: sizeShoulder,
        armholeHalfCm: sizeArmholeHalf,
        bodyLengthCm: sizeFrontLength,
        neckWidthCm: sizeNeckWidth,
        frontNeckDropCm: sizeFrontNeckDrop,
        backNeckDropCm: 1.0,
        sleeveLengthCm: sizeSleeveLength,
        sleeveOpeningHalfCm: sizeSleeveOpeningHalf,
      },
      geometry,
    };
  });

  const baseEntry = entries.find((e) => e.size === baseSize) ?? entries[1];
  const pointTable: PointGradingRow[] = [];

  for (const basePiece of baseEntry.geometry.pieces) {
    if (!["front-body", "back-body", "sleeve", "front-facing"].includes(basePiece.id)) {
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
