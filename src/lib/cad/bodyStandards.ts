/**
 * Standard Body & Mannequin Measurement Database (TCVN / Asian System)
 * Source: Bang_Thong_So_Co_The_Va_Ma_No_Canh_Chuan.xlsx
 * Units: centimeters (cm), body/mannequin base measurements (excluding garment ease).
 */

export type MannequinCategory = "women" | "men" | "kids";

export interface BodyMeasurementStandard {
  size: string;
  heightRangeCm: string;
  heightMidCm: number;
  weightRangeKg: string;
  shoulderCm: number;
  bustCm: number;
  waistCm: number;
  hipCm: number;
  crotchDepthCm: number;
  crotchCurveCm: number;
  /** Thigh circumference measured 1" (2.54 cm) below crotch */
  thighCm: number;
  kneeCm: number;
  hemOpeningCm: number;
  neckCm: number;
  backLengthCm: number;
}

export interface MannequinStandardGroup {
  id: MannequinCategory;
  name: string;
  englishName: string;
  defaultSize: string;
  notes: string[];
  sizes: BodyMeasurementStandard[];
}

export const WOMEN_BODY_STANDARDS: BodyMeasurementStandard[] = [
  {
    size: "XS",
    heightRangeCm: "150 – 155",
    heightMidCm: 153,
    weightRangeKg: "40 – 44",
    shoulderCm: 35,
    bustCm: 79,
    waistCm: 61,
    hipCm: 85,
    crotchDepthCm: 23.5,
    crotchCurveCm: 60.0,
    thighCm: 49.0,
    kneeCm: 34.0,
    hemOpeningCm: 28.0,
    neckCm: 34.5,
    backLengthCm: 37.5,
  },
  {
    size: "S",
    heightRangeCm: "155 – 160",
    heightMidCm: 158,
    weightRangeKg: "45 – 49",
    shoulderCm: 36,
    bustCm: 83,
    waistCm: 65,
    hipCm: 89,
    crotchDepthCm: 24.5,
    crotchCurveCm: 62.5,
    thighCm: 51.5,
    kneeCm: 35.5,
    hemOpeningCm: 29.0,
    neckCm: 35.0,
    backLengthCm: 38.0,
  },
  {
    size: "M",
    heightRangeCm: "158 – 163",
    heightMidCm: 161,
    weightRangeKg: "50 – 54",
    shoulderCm: 37,
    bustCm: 87,
    waistCm: 69,
    hipCm: 93,
    crotchDepthCm: 25.5,
    crotchCurveCm: 65.0,
    thighCm: 54.0,
    kneeCm: 37.0,
    hemOpeningCm: 30.0,
    neckCm: 35.5,
    backLengthCm: 38.5,
  },
  {
    size: "L",
    heightRangeCm: "160 – 165",
    heightMidCm: 163,
    weightRangeKg: "55 – 59",
    shoulderCm: 38,
    bustCm: 91,
    waistCm: 73,
    hipCm: 97,
    crotchDepthCm: 26.5,
    crotchCurveCm: 67.5,
    thighCm: 56.5,
    kneeCm: 38.5,
    hemOpeningCm: 31.0,
    neckCm: 36.5,
    backLengthCm: 39.2,
  },
  {
    size: "XL",
    heightRangeCm: "162 – 168",
    heightMidCm: 165,
    weightRangeKg: "60 – 65",
    shoulderCm: 39,
    bustCm: 95,
    waistCm: 77,
    hipCm: 101,
    crotchDepthCm: 27.5,
    crotchCurveCm: 70.0,
    thighCm: 59.0,
    kneeCm: 40.0,
    hemOpeningCm: 32.0,
    neckCm: 37.5,
    backLengthCm: 40.0,
  },
  {
    size: "XXL",
    heightRangeCm: "165 – 170",
    heightMidCm: 168,
    weightRangeKg: "66 – 72",
    shoulderCm: 40,
    bustCm: 99,
    waistCm: 81,
    hipCm: 105,
    crotchDepthCm: 28.5,
    crotchCurveCm: 72.5,
    thighCm: 61.5,
    kneeCm: 41.5,
    hemOpeningCm: 33.0,
    neckCm: 38.5,
    backLengthCm: 40.8,
  },
];

export const MEN_BODY_STANDARDS: BodyMeasurementStandard[] = [
  {
    size: "S",
    heightRangeCm: "160 – 165",
    heightMidCm: 163,
    weightRangeKg: "50 – 55",
    shoulderCm: 41.5,
    bustCm: 87,
    waistCm: 71,
    hipCm: 87,
    crotchDepthCm: 25.5,
    crotchCurveCm: 66.0,
    thighCm: 53.0,
    kneeCm: 38.0,
    hemOpeningCm: 33.0,
    neckCm: 38.0,
    backLengthCm: 42.5,
  },
  {
    size: "M",
    heightRangeCm: "165 – 170",
    heightMidCm: 168,
    weightRangeKg: "56 – 62",
    shoulderCm: 43.0,
    bustCm: 91,
    waistCm: 75,
    hipCm: 91,
    crotchDepthCm: 26.5,
    crotchCurveCm: 68.5,
    thighCm: 55.5,
    kneeCm: 39.5,
    hemOpeningCm: 34.5,
    neckCm: 39.0,
    backLengthCm: 43.5,
  },
  {
    size: "L",
    heightRangeCm: "170 – 175",
    heightMidCm: 173,
    weightRangeKg: "63 – 69",
    shoulderCm: 44.5,
    bustCm: 95,
    waistCm: 79,
    hipCm: 95,
    crotchDepthCm: 27.5,
    crotchCurveCm: 71.0,
    thighCm: 58.0,
    kneeCm: 41.0,
    hemOpeningCm: 36.0,
    neckCm: 40.0,
    backLengthCm: 44.5,
  },
  {
    size: "XL",
    heightRangeCm: "173 – 178",
    heightMidCm: 176,
    weightRangeKg: "70 – 76",
    shoulderCm: 46.0,
    bustCm: 99,
    waistCm: 83,
    hipCm: 99,
    crotchDepthCm: 28.5,
    crotchCurveCm: 73.5,
    thighCm: 60.5,
    kneeCm: 42.5,
    hemOpeningCm: 37.5,
    neckCm: 41.0,
    backLengthCm: 45.5,
  },
  {
    size: "XXL",
    heightRangeCm: "175 – 180",
    heightMidCm: 178,
    weightRangeKg: "77 – 83",
    shoulderCm: 47.5,
    bustCm: 103,
    waistCm: 87,
    hipCm: 103,
    crotchDepthCm: 29.5,
    crotchCurveCm: 76.0,
    thighCm: 63.0,
    kneeCm: 44.0,
    hemOpeningCm: 39.0,
    neckCm: 42.0,
    backLengthCm: 46.5,
  },
];

export const KIDS_BODY_STANDARDS: BodyMeasurementStandard[] = [
  {
    size: "2T",
    heightRangeCm: "86 – 92",
    heightMidCm: 89,
    weightRangeKg: "12 – 14",
    shoulderCm: 23.0,
    bustCm: 52,
    waistCm: 50,
    hipCm: 54,
    crotchDepthCm: 16.5,
    crotchCurveCm: 42.0,
    thighCm: 31.0,
    kneeCm: 24.0,
    hemOpeningCm: 21.0,
    neckCm: 25.0,
    backLengthCm: 22.5,
  },
  {
    size: "4T",
    heightRangeCm: "98 – 104",
    heightMidCm: 101,
    weightRangeKg: "15 – 17",
    shoulderCm: 25.0,
    bustCm: 56,
    waistCm: 52,
    hipCm: 58,
    crotchDepthCm: 18.0,
    crotchCurveCm: 45.5,
    thighCm: 33.5,
    kneeCm: 25.5,
    hemOpeningCm: 22.0,
    neckCm: 26.5,
    backLengthCm: 25.0,
  },
  {
    size: "6T",
    heightRangeCm: "110 – 116",
    heightMidCm: 113,
    weightRangeKg: "19 – 22",
    shoulderCm: 27.0,
    bustCm: 60,
    waistCm: 54,
    hipCm: 62,
    crotchDepthCm: 19.5,
    crotchCurveCm: 49.0,
    thighCm: 36.0,
    kneeCm: 27.0,
    hemOpeningCm: 23.5,
    neckCm: 28.0,
    backLengthCm: 27.5,
  },
  {
    size: "8T",
    heightRangeCm: "122 – 128",
    heightMidCm: 125,
    weightRangeKg: "24 – 28",
    shoulderCm: 29.5,
    bustCm: 64,
    waistCm: 57,
    hipCm: 67,
    crotchDepthCm: 21.0,
    crotchCurveCm: 52.5,
    thighCm: 39.0,
    kneeCm: 29.0,
    hemOpeningCm: 25.0,
    neckCm: 29.5,
    backLengthCm: 30.0,
  },
  {
    size: "10T",
    heightRangeCm: "134 – 140",
    heightMidCm: 137,
    weightRangeKg: "30 – 35",
    shoulderCm: 32.0,
    bustCm: 70,
    waistCm: 60,
    hipCm: 73,
    crotchDepthCm: 22.5,
    crotchCurveCm: 56.5,
    thighCm: 42.5,
    kneeCm: 31.0,
    hemOpeningCm: 26.5,
    neckCm: 31.5,
    backLengthCm: 33.0,
  },
  {
    size: "12T",
    heightRangeCm: "146 – 152",
    heightMidCm: 149,
    weightRangeKg: "37 – 43",
    shoulderCm: 34.5,
    bustCm: 76,
    waistCm: 63,
    hipCm: 80,
    crotchDepthCm: 24.0,
    crotchCurveCm: 60.5,
    thighCm: 46.5,
    kneeCm: 33.5,
    hemOpeningCm: 28.0,
    neckCm: 33.0,
    backLengthCm: 36.0,
  },
];

export const MANNEQUIN_STANDARD_GROUPS: Record<
  MannequinCategory,
  MannequinStandardGroup
> = {
  women: {
    id: "women",
    name: "Ma-nơ-canh Nữ (TCVN / Asian)",
    englishName: "Women Standard Dress Form",
    defaultSize: "M",
    notes: [
      "Bước nhảy chuẩn Nữ: Vai +1.0 | Ngực +4.0 | Eo +4.0 | Mông +4.0 | Đùi +2.5 | Gối +1.5 | Ống +1.0 cm",
      "Size M chuẩn: Cổ 35.5 cm | Hạ ngực 24.5 cm | Dài lưng (C7 - eo) 38.5 cm",
    ],
    sizes: WOMEN_BODY_STANDARDS,
  },
  men: {
    id: "men",
    name: "Ma-nơ-canh Nam (TCVN / Asian)",
    englishName: "Men Standard Dress Form",
    defaultSize: "M",
    notes: [
      "Bước nhảy chuẩn Nam: Vai +1.5 | Ngực +4.0 | Eo +4.0 | Mông +4.0 | Đùi +2.5 | Gối +1.5 | Ống +1.5 cm",
      "Size M/L chuẩn: Cổ 39.0 cm | Dài lưng 43.5 cm | Bắp tay 31.0 cm",
    ],
    sizes: MEN_BODY_STANDARDS,
  },
  kids: {
    id: "kids",
    name: "Ma-nơ-canh Trẻ Em (2T – 12T)",
    englishName: "Kids Standard Dress Form",
    defaultSize: "8T",
    notes: [
      "Nhảy cỡ chủ yếu theo chiều cao (+6 cm cho nhóm 2T–6T và +12 cm cho 6T–12T).",
      "Khi dựng rập quần trẻ em cộng thêm lượng cử động tối thiểu 4 – 8 cm.",
    ],
    sizes: KIDS_BODY_STANDARDS,
  },
};

export function getMannequinBodySpec(
  category: MannequinCategory,
  sizeCode: string
): BodyMeasurementStandard {
  const group = MANNEQUIN_STANDARD_GROUPS[category];
  return (
    group.sizes.find((s) => s.size === sizeCode) ??
    group.sizes.find((s) => s.size === group.defaultSize) ??
    group.sizes[0]
  );
}
