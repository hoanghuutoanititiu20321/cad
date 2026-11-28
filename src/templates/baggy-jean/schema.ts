import type { ParamValues, TemplateSchema } from "@/lib/cad/types";

/**
 * Style# WV1499LSB-TD — 9 1/2" LOW SUPER BAGGY JEAN (CELLO / Fabric SH3790)
 * Default values calibrated directly from WV1499LSB-TD PP FIT RECORD (Target Specs Size <3>)
 * and WV1499LSB-TD_PRODUCTION Tech Pack PDF (converted from inches to cm at 2.54 cm/in).
 */
export interface BaggyJeanParams {
  waist: number; // 31.0" = 78.7 cm
  hip: number; // 40.5" = 102.9 cm (3" above crotch)
  thigh: number; // 26.5" = 67.3 cm (1" below crotch)
  knee: number; // 25.0" = 63.5 cm (13" below crotch)
  hemOpening: number; // 25.0" = 63.5 cm
  inseam: number; // 32.0" = 81.3 cm
  frontRise: number; // 9.5" = 24.1 cm (incl. waistband)
  backRise: number; // 15.25" = 38.7 cm (incl. waistband)
  waistbandHeight: number; // 1 5/8" = 4.1 cm
  backYokeCenter: number; // 2.0" = 5.1 cm
  backYokeSide: number; // 3/4" = 1.9 cm
  waistbandType: "curved" | "straight";
  seamAllowance: number; // 1.2 cm (~1/2")
  hemAllowance: number; // 1.6 cm (5/8" clean finished hem)
  includeFivePockets: boolean;
  revisedGrainlines: boolean;
}

export const WV1499_TECHPACK_META = {
  styleCode: "WV1499LSB-TD",
  poNumber: "JC-0347",
  brand: "CELLO",
  styleName: '9 1/2" LOW SUPER BAGGY JEAN',
  fabric: "SH3790 (Denim 100% Cotton — M Stone + Tint + Dry Process + Grinding & Destroy)",
  zipper: '4 1/2" (11.4 cm) — Navy Tape',
  button: "27L Antique Copper (×1)",
  rivets: "14L Brass (×3)",
  thread: "Golden Glo W32761 (A&E) — Topstitch T105, Bartack T60, Overlock T40",
  beltLoops: '2 1/2"(L) × 5/8"(W) — 5 PCS (Side loop 1 1/4" from S.S. attached to yoke)',
  pocketLining: "White Cotton Twill",
} as const;

export const baggyJeanSchema: TemplateSchema = {
  groups: [
    {
      id: "measurements",
      title: "Thông số thân quần WV1499LSB-TD (Main Specs)",
      description: "Mặc định chuẩn Target Size <3> từ PP Fit Record (inch → cm)",
    },
    {
      id: "rise-waistband",
      title: "Đáy quần, Cạp cong & Đô sau (Rise, Band & Yoke)",
      description: 'Cạp trễ 9 1/2" • Cạp cong 1 5/8" • Đô sau 2" / 3/4"',
    },
    {
      id: "construction",
      title: "Chi tiết 5 túi & Đường may (5-Pocket Production)",
      description: "Chừa đường may, gập lai 5/8\" và quy cách canh sợi R&D",
    },
  ],
  fields: [
    {
      key: "waist",
      type: "number",
      group: "measurements",
      label: 'Vòng eo cạp quần (Waist @Top — 31.0")',
      shortLabel: "Vòng eo",
      description: "Thông số vòng eo thành phẩm đỉnh cạp (cạp trễ)",
      defaultValue: 78.7,
      min: 58,
      max: 118,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "hip",
      type: "number",
      group: "measurements",
      label: 'Vòng mông (Hip 3" above crotch — 40.5")',
      shortLabel: "Vòng mông",
      description: "Đo chu vi ngang mông cách ngã tư đáy lên 3 inch (7.6 cm)",
      defaultValue: 102.9,
      min: 80,
      max: 142,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "thigh",
      type: "number",
      group: "measurements",
      label: 'Vòng đùi (Thigh 1" below crotch — 26.5")',
      shortLabel: "Vòng đùi",
      description: "Chu vi đùi cách đáy xuống 1 inch (2.54 cm) — dáng Super Baggy",
      defaultValue: 67.3,
      min: 46,
      max: 92,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "knee",
      type: "number",
      group: "measurements",
      label: 'Vòng gối (Knee 13" below crotch — 25.0")',
      shortLabel: "Vòng gối",
      description: "Chu vi ống tại gối cách ngã tư đáy 13 inch (33 cm)",
      defaultValue: 63.5,
      min: 34,
      max: 84,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "hemOpening",
      type: "number",
      group: "measurements",
      label: 'Vòng ống lai (Bottom Opening — 25.0")',
      shortLabel: "Vòng ống",
      description: "Chu vi miệng ống gấu quần (Baggy ống rộng thẳng)",
      defaultValue: 63.5,
      min: 28,
      max: 84,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "inseam",
      type: "number",
      group: "measurements",
      label: 'Dài sườn trong (Inseam — 32.0")',
      shortLabel: "Dài trong",
      description: "Chiều dài từ ngã tư đáy xuống mép lai thành phẩm",
      defaultValue: 81.3,
      min: 58,
      max: 96,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "frontRise",
      type: "number",
      group: "rise-waistband",
      label: 'Hạ đáy trước gồm cạp (Front Rise — 9 1/2")',
      shortLabel: "Đáy trước",
      description: "Đo từ đỉnh cạp trước xuống ngã tư đáy",
      defaultValue: 24.1,
      min: 18,
      max: 36,
      step: 0.2,
      unit: "cm",
    },
    {
      key: "backRise",
      type: "number",
      group: "rise-waistband",
      label: 'Hạ đáy sau gồm cạp (Back Rise — 15 1/4")',
      shortLabel: "Đáy sau",
      description: "Đo từ đỉnh cạp sau xuống ngã tư đáy",
      defaultValue: 38.7,
      min: 28,
      max: 48,
      step: 0.2,
      unit: "cm",
    },
    {
      key: "waistbandHeight",
      type: "number",
      group: "rise-waistband",
      label: 'Bản rộng cạp lưng (Waistband — 1 5/8")',
      shortLabel: "Bản cạp",
      description: 'Cạp lưng cong 2 lá (Contour Band) rộng 1 5/8" (4.13 cm)',
      defaultValue: 4.1,
      min: 2.8,
      max: 6.5,
      step: 0.1,
      unit: "cm",
    },
    {
      key: "backYokeCenter",
      type: "number",
      group: "rise-waistband",
      label: 'Cao đô sau giữa lưng (Yoke @CB — 2.0")',
      shortLabel: "Đô giữa sau",
      description: "Chiều cao mảnh đô sau tại đường sống lưng (CB)",
      defaultValue: 5.1,
      min: 2.5,
      max: 8.5,
      step: 0.1,
      unit: "cm",
    },
    {
      key: "backYokeSide",
      type: "number",
      group: "rise-waistband",
      label: 'Cao đô sau cạnh sườn (Yoke @SS — 3/4")',
      shortLabel: "Đô sườn",
      description: "Chiều cao mảnh đô sau tại cạnh sườn ngoài",
      defaultValue: 1.9,
      min: 1.0,
      max: 4.5,
      step: 0.1,
      unit: "cm",
    },
    {
      key: "waistbandType",
      type: "select",
      group: "rise-waistband",
      label: "Kiểu cạp lưng (Waistband Type)",
      shortLabel: "Kiểu cạp",
      defaultValue: "curved",
      display: "segmented",
      options: [
        { value: "curved", label: "Cạp cong", sublabel: "Contour Band" },
        { value: "straight", label: "Cạp thẳng", sublabel: "Straight Band" },
      ],
    },
    {
      key: "seamAllowance",
      type: "number",
      group: "construction",
      label: "Chừa đường may thân (Seam Allowance)",
      shortLabel: "Đường may",
      description: "Độ rộng chừa đường may tiêu chuẩn may Jean (1.2 cm)",
      defaultValue: 1.2,
      min: 0.6,
      max: 2.0,
      step: 0.1,
      unit: "cm",
    },
    {
      key: "hemAllowance",
      type: "number",
      group: "construction",
      label: 'Chừa gập lai gấu (Hem Fold — 5/8")',
      shortLabel: "Gập lai",
      description: 'Cuốn lai sạch 5/8" (1.6 cm × 2 gập mép)',
      defaultValue: 1.6,
      min: 1.0,
      max: 3.5,
      step: 0.1,
      unit: "cm",
    },
    {
      key: "includeFivePockets",
      type: "toggle",
      group: "construction",
      label: "Đầy đủ bộ rập 5 túi (Back Pkt, Coin Pkt, Fly, Belt Loops)",
      shortLabel: "Bộ 5 túi",
      description: "Tự động dựng Túi sau, Túi đồng hồ, Mo-guết khóa kéo & Đỉa quần (×5)",
      defaultValue: true,
      activeLabel: "8 mảnh rập",
      inactiveLabel: "4 mảnh chính",
    },
    {
      key: "revisedGrainlines",
      type: "toggle",
      group: "construction",
      label: "Áp dụng *Change Grainlines (R&D Note — Đô sau & Đáp túi)",
      shortLabel: "Canh sợi R&D",
      description: "Xoay ngang canh sợi Đô sau (Back Yoke) theo ghi chú PP Fit Record",
      defaultValue: true,
      activeLabel: "Bật (R&D)",
      inactiveLabel: "Mặc định",
    },
  ],
};

export function parseBaggyJeanParams(raw: ParamValues): BaggyJeanParams {
  return {
    waist: Math.min(118, Math.max(58, Number(raw.waist ?? 78.7))),
    hip: Math.min(142, Math.max(80, Number(raw.hip ?? 102.9))),
    thigh: Math.min(92, Math.max(46, Number(raw.thigh ?? 67.3))),
    knee: Math.min(84, Math.max(34, Number(raw.knee ?? 63.5))),
    hemOpening: Math.min(84, Math.max(28, Number(raw.hemOpening ?? 63.5))),
    inseam: Math.min(96, Math.max(58, Number(raw.inseam ?? 81.3))),
    frontRise: Math.min(36, Math.max(18, Number(raw.frontRise ?? 24.1))),
    backRise: Math.min(48, Math.max(28, Number(raw.backRise ?? 38.7))),
    waistbandHeight: Math.min(6.5, Math.max(2.8, Number(raw.waistbandHeight ?? 4.1))),
    backYokeCenter: Math.min(8.5, Math.max(2.5, Number(raw.backYokeCenter ?? 5.1))),
    backYokeSide: Math.min(4.5, Math.max(1.0, Number(raw.backYokeSide ?? 1.9))),
    waistbandType: raw.waistbandType === "straight" ? "straight" : "curved",
    seamAllowance: Math.min(2.0, Math.max(0.6, Number(raw.seamAllowance ?? 1.2))),
    hemAllowance: Math.min(3.5, Math.max(1.0, Number(raw.hemAllowance ?? 1.6))),
    includeFivePockets:
      raw.includeFivePockets === undefined ? true : Boolean(raw.includeFivePockets),
    revisedGrainlines:
      raw.revisedGrainlines === undefined ? true : Boolean(raw.revisedGrainlines),
  };
}

export function getBaggyJeanDefaults(): ParamValues {
  const defaults: ParamValues = {};
  for (const field of baggyJeanSchema.fields) {
    defaults[field.key] = field.defaultValue;
  }
  return defaults;
}
