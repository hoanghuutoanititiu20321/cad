import type { ParamValues, TemplateSchema } from "@/lib/cad/types";

/**
 * Style HAZE026-028 — COLORBLOCK POLO SHIRT (AFW / School Uniform)
 * Calibrated directly from `HAZE026-028 POLO PRODUCTION SPEC.xlsx`,
 * `Số lượng HAZE026 - .xlsx` (Order EM06082026A/B/C = 355 pcs),
 * and Gerber `.PLT` cut markers (`HAZE026-W-FRT1`, `HAZE026-B-FRT2`, `HAZE026-C-FRT3`,
 * `HAZE026-S-FRT4`, `HAZE026-S-BK`, `HAZE026-S-SLV`, `HAZE026-SF-PL`, `HAZE026-KEO`).
 * Default values match Adult Base Size M.
 */
export interface ColorblockPoloParams {
  /** C: Chest Circ. (cm) — Adult M = 110 cm (S=105, M=110, L=115, XL=120) */
  chest: number;
  /** B: Center Back Length (cm) — Adult M = 71 cm (S=69, M=71, L=73, XL=75) */
  cbLength: number;
  /** H: Shoulder Width (cm) — Adult M = 49.5 cm (S=47, M=49.5, L=52, XL=54.5) */
  shoulder: number;
  /** M: 1/2 Armhole Circ. (cm) — Adult M = 27.0 cm (S=26, M=27, L=28, XL=29) */
  armholeHalf: number;
  /** E: Neck Width (cm) — Adult M = 20.5 cm (S=20, M=20.5, L=21, XL=21.5) */
  neckWidth: number;
  /** F: Front Neck Drop from HPS (cm) — Adult M = 7.5 cm (S=7.2, M=7.5, L=7.8, XL=8.1) */
  frontNeckDrop: number;
  /** G: Back Neck Drop from HPS (cm) — Constant 2.0 cm */
  backNeckDrop: number;
  /** J: Short Sleeve Length (cm) — Adult M = 24.0 cm (S=23, M=24, L=25, XL=26) */
  sleeveLength: number;
  /** L: 1/2 Sleeve Opening Circ. (cm) — Adult M = 20.0 cm (S=19, M=20, L=21, XL=22) */
  sleeveOpeningHalf: number;
  /** N: Placket Width (cm) — Constant 3.0 cm */
  placketWidth: number;
  /** O: Placket Length (cm) — 17.5 cm adult (3 buttons) / 15.0 cm youth (2 buttons) */
  placketLength: number;
  /** P: CB Collar Depth (cm) — 8.0 cm adult / 7.5 cm youth 10-16 / 7.0 cm youth 4-8 */
  collarDepth: number;
  /** Diagonal contrast band width for FRT-2 (Black) & FRT-3 (Silver) (cm) */
  stripeWidth: number;
  /** Standard polo overlock / coverstitch seam allowance (cm) */
  seamAllowance: number;
  /** Split Front into 4 diagonal colorblock pieces (W-FRT1 / B-FRT2 / C-FRT3 / S-FRT4) */
  diagonalColorblock: boolean;
}

export const HAZE026_META = {
  styleCode: "HAZE026-028",
  customer: "AFW (Đơn hàng EM06082026A/B/C — 355 SP)",
  mainFabric: "LA65V Dark Bottle (#1A3A32 — Khổ 161 cm)",
  contrast1: "LA65V White (#F8FAFC — Mảnh FRT-1 trên ngực, Khổ 161 cm)",
  contrast2: "LA65V Black (#18181B — Dải phối chéo FRT-2, Khổ 80.5 cm)",
  contrast3: "JC50 Silver 1102 (#CBD5E1 — Dải viền chéo FRT-3, Khổ 80.5 cm)",
  interfacing: "Keo ép nẹp trụ HAZE026-KEO (Khổ 98 cm)",
  buttonRule:
    "Size 4–16 (Youth): 2 nút trụ • Size XS–3XL (Adult): 3 nút trụ (theo ghi chú sơ đồ .PLT)",
  collarSpec: "Lá cổ dệt phẳng (Flat-Knit) Dark Bottle • Bản CB 8.0 cm / Đầu lá 7.5 cm",
} as const;

export const HAZE026_PRESETS: Record<
  "adultM" | "youth14" | "youth8" | "youth4",
  { label: string; sublabel: string; values: Partial<ColorblockPoloParams> }
> = {
  adultM: {
    label: "HAZE026 Adult M (3 nút)",
    sublabel: "Ngực 110 • Dài 71",
    values: {
      chest: 110,
      cbLength: 71,
      shoulder: 49.5,
      armholeHalf: 27,
      neckWidth: 20.5,
      frontNeckDrop: 7.5,
      backNeckDrop: 2.0,
      sleeveLength: 24,
      sleeveOpeningHalf: 20,
      placketWidth: 3.0,
      placketLength: 17.5,
      collarDepth: 8.0,
      stripeWidth: 5.5,
    },
  },
  youth14: {
    label: "HAZE026 Size 14 (2 nút)",
    sublabel: "Ngực 95 • Dài 64",
    values: {
      chest: 95,
      cbLength: 64,
      shoulder: 41.0,
      armholeHalf: 23,
      neckWidth: 19.0,
      frontNeckDrop: 6.6,
      backNeckDrop: 2.0,
      sleeveLength: 21,
      sleeveOpeningHalf: 17,
      placketWidth: 3.0,
      placketLength: 15.5,
      collarDepth: 7.5,
      stripeWidth: 5.0,
    },
  },
  youth8: {
    label: "HAZE026 Size 8 (2 nút)",
    sublabel: "Ngực 83 • Dài 52",
    values: {
      chest: 83,
      cbLength: 52,
      shoulder: 35.0,
      armholeHalf: 20,
      neckWidth: 17.5,
      frontNeckDrop: 5.7,
      backNeckDrop: 2.0,
      sleeveLength: 18,
      sleeveOpeningHalf: 14,
      placketWidth: 3.0,
      placketLength: 14.0,
      collarDepth: 7.0,
      stripeWidth: 4.5,
    },
  },
  youth4: {
    label: "HAZE026 Size 4 (2 nút)",
    sublabel: "Ngực 75 • Dài 44",
    values: {
      chest: 75,
      cbLength: 44,
      shoulder: 31.0,
      armholeHalf: 18,
      neckWidth: 16.5,
      frontNeckDrop: 5.1,
      backNeckDrop: 2.0,
      sleeveLength: 16,
      sleeveOpeningHalf: 12,
      placketWidth: 3.0,
      placketLength: 13.0,
      collarDepth: 7.0,
      stripeWidth: 4.0,
    },
  },
};

export const colorblockPoloSchema: TemplateSchema = {
  groups: [
    {
      id: "body",
      title: "Thông số thân áo HAZE026-028 (Body Specs)",
      description: "Chuẩn bảng thông số sản xuất Adult Base Size M (AFW Polo)",
    },
    {
      id: "neck-sleeve",
      title: "Cổ Polo, Nách & Tay ngắn (Collar & Short Sleeve)",
      description: "Lá cổ dệt 8.0 cm • Trụ rộng 3.0 cm (2 nút Youth / 3 nút Adult)",
    },
    {
      id: "colorblock",
      title: "Phối màu chéo 4 mảnh & Đường may (Colorblock Cut)",
      description: "Cắt tách đúng 4 mã vải: W-FRT1 / B-FRT2 / C-FRT3 / S-FRT4",
    },
  ],
  fields: [
    {
      key: "chest",
      type: "number",
      group: "body",
      label: "Vòng ngực / Vòng lai (C & D: Chest/Hem)",
      shortLabel: "Vòng ngực",
      description: "Chu vi ngực & lai thân áo Polo suông chuẩn",
      defaultValue: 110,
      min: 72,
      max: 138,
      step: 1,
      unit: "cm",
    },
    {
      key: "cbLength",
      type: "number",
      group: "body",
      label: "Dài áo từ giữa sau (B: Center Back Length)",
      shortLabel: "Dài giữa sau",
      description: "Chiều dài thân đo dọc sống lưng từ chân cổ sau đến lai",
      defaultValue: 71,
      min: 44,
      max: 84,
      step: 1,
      unit: "cm",
    },
    {
      key: "shoulder",
      type: "number",
      group: "body",
      label: "Ngang vai (H: Shoulder Width)",
      shortLabel: "Ngang vai",
      description: "Đo thẳng ngang từ đầu vai trái sang đầu vai phải",
      defaultValue: 49.5,
      min: 30,
      max: 62,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "armholeHalf",
      type: "number",
      group: "neck-sleeve",
      label: "1/2 Vòng nách (M: 1/2 Armhole Circ.)",
      shortLabel: "1/2 Nách",
      description: "Đo cong 1/2 vòng nách thân áo (khớp mang tay ngắn)",
      defaultValue: 27.0,
      min: 17,
      max: 33,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "neckWidth",
      type: "number",
      group: "neck-sleeve",
      label: "Rộng cổ chân vai (E: Neck Width)",
      shortLabel: "Rộng cổ",
      description: "Khoảng cách giữa hai đỉnh vai cạnh cổ (HPS – HPS)",
      defaultValue: 20.5,
      min: 15.5,
      max: 24,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "frontNeckDrop",
      type: "number",
      group: "neck-sleeve",
      label: "Hạ cổ trước từ HPS (F: Front Neck Drop)",
      shortLabel: "Hạ cổ trước",
      description: "Độ sâu cổ trước đo từ đỉnh vai cạnh cổ",
      defaultValue: 7.5,
      min: 4.8,
      max: 10.5,
      step: 0.3,
      unit: "cm",
    },
    {
      key: "backNeckDrop",
      type: "number",
      group: "neck-sleeve",
      label: "Hạ cổ sau từ HPS (G: Back Neck Drop)",
      shortLabel: "Hạ cổ sau",
      description: "Cố định 2.0 cm trên toàn bộ bảng size HAZE026",
      defaultValue: 2.0,
      min: 1.5,
      max: 3.5,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "sleeveLength",
      type: "number",
      group: "neck-sleeve",
      label: "Dài tay ngắn (J: Sleeve Length)",
      shortLabel: "Dài tay",
      description: "Đo từ đỉnh đầu vai xuống mép lai cửa tay",
      defaultValue: 24.0,
      min: 15,
      max: 32,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "sleeveOpeningHalf",
      type: "number",
      group: "neck-sleeve",
      label: "1/2 Cửa tay (L: 1/2 Sleeve Opening)",
      shortLabel: "1/2 Cửa tay",
      description: "Độ rộng nửa vòng cửa tay thành phẩm",
      defaultValue: 20.0,
      min: 11.5,
      max: 26,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "placketWidth",
      type: "number",
      group: "neck-sleeve",
      label: "Bản rộng trụ nút (N: Placket Width)",
      shortLabel: "Rộng trụ",
      description: "Chuẩn 3.0 cm toàn bộ size HAZE026",
      defaultValue: 3.0,
      min: 2.5,
      max: 4.0,
      step: 0.2,
      unit: "cm",
    },
    {
      key: "placketLength",
      type: "number",
      group: "neck-sleeve",
      label: "Chiều dài trụ nút (O: Placket Length)",
      shortLabel: "Dài trụ",
      description: "17.5 cm (3 nút Adult) • 13–15.5 cm (2 nút Youth)",
      defaultValue: 17.5,
      min: 12.0,
      max: 22.0,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "collarDepth",
      type: "number",
      group: "neck-sleeve",
      label: "Bản lá cổ giữa sau (P: CB Collar Depth)",
      shortLabel: "Bản lá cổ",
      description: "8.0 cm Adult (đầu lá 7.5 cm) • 7.0–7.5 cm Youth",
      defaultValue: 8.0,
      min: 6.5,
      max: 9.5,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "stripeWidth",
      type: "number",
      group: "colorblock",
      label: "Bề rộng mỗi dải sọc chéo Đen / Bạc",
      shortLabel: "Rộng sọc chéo",
      description: "Bề rộng vuông góc thành phẩm của mảnh B-FRT2 (Đen) & C-FRT3 (Bạc)",
      defaultValue: 5.5,
      min: 3.0,
      max: 8.5,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "seamAllowance",
      type: "number",
      group: "colorblock",
      label: "Chừa đường may ráp mảnh (Seam Allowance)",
      shortLabel: "Đường may",
      description: "Đường may vắt sổ 4 chỉ (1.0 cm) • Lai áo/lai tay tự động chừa 2.5 cm",
      defaultValue: 1.0,
      min: 0.6,
      max: 2.0,
      step: 0.1,
      unit: "cm",
    },
    {
      key: "diagonalColorblock",
      type: "toggle",
      group: "colorblock",
      label: "Cắt rã 4 mảnh phối chéo chuẩn HAZE026 (Trắng/Đen/Bạc/Xanh Đậm)",
      shortLabel: "Phối 4 mảnh",
      description:
        "Tách tự động FRT-1 (White), FRT-2 (Black), FRT-3 (Silver) & FRT-4 (Dark Bottle) kèm đường may và dấu bấm khớp",
      defaultValue: true,
      activeLabel: "8 mảnh phối màu",
      inactiveLabel: "5 mảnh trơn",
    },
  ],
};

export function parseColorblockPoloParams(raw: ParamValues): ColorblockPoloParams {
  return {
    chest: Math.min(138, Math.max(72, Number(raw.chest ?? 110))),
    cbLength: Math.min(84, Math.max(44, Number(raw.cbLength ?? 71))),
    shoulder: Math.min(62, Math.max(30, Number(raw.shoulder ?? 49.5))),
    armholeHalf: Math.min(33, Math.max(17, Number(raw.armholeHalf ?? 27.0))),
    neckWidth: Math.min(24, Math.max(15.5, Number(raw.neckWidth ?? 20.5))),
    frontNeckDrop: Math.min(10.5, Math.max(4.8, Number(raw.frontNeckDrop ?? 7.5))),
    backNeckDrop: Math.min(3.5, Math.max(1.5, Number(raw.backNeckDrop ?? 2.0))),
    sleeveLength: Math.min(32, Math.max(15, Number(raw.sleeveLength ?? 24.0))),
    sleeveOpeningHalf: Math.min(
      26,
      Math.max(11.5, Number(raw.sleeveOpeningHalf ?? 20.0))
    ),
    placketWidth: Math.min(4.0, Math.max(2.5, Number(raw.placketWidth ?? 3.0))),
    placketLength: Math.min(22.0, Math.max(12.0, Number(raw.placketLength ?? 17.5))),
    collarDepth: Math.min(9.5, Math.max(6.5, Number(raw.collarDepth ?? 8.0))),
    stripeWidth: Math.min(8.5, Math.max(3.0, Number(raw.stripeWidth ?? 5.5))),
    seamAllowance: Math.min(2.0, Math.max(0.6, Number(raw.seamAllowance ?? 1.0))),
    diagonalColorblock:
      raw.diagonalColorblock === undefined ? true : Boolean(raw.diagonalColorblock),
  };
}

export function getColorblockPoloDefaults(): ParamValues {
  const defaults: ParamValues = {};
  for (const field of colorblockPoloSchema.fields) {
    defaults[field.key] = field.defaultValue;
  }
  return defaults;
}
