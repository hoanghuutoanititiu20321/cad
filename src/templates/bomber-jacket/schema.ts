import type { ParamValues, TemplateSchema } from "@/lib/cad/types";

/**
 * Style 89865 — BOMBER FLEECE JACKET WITH ANGLED WELT POCKETS
 * Client: BEARE & LEY / Mernda Primary School (Based on block LU9335)
 * Standards: Australian Size Standards (Spec Amended 03.04.2025 — PPS Approved)
 * Default values calibrated directly to Adult Base Size M from `89865 - SPEC & Report.xls`.
 */
export interface BomberJacketParams {
  /** A: Chest Circ. at Underarm point (cm) — Adult M = 117 cm */
  chest: number;
  /** C: Rib Hem Width Relaxed Half Measure (cm) — Adult M = 46.0 cm (Full 92 cm) */
  ribHemHalf: number;
  /** D: Shoulder to Shoulder (cm) — Adult M = 47.0 cm */
  shoulder: number;
  /** F: Front Length from HSP incl. 6 cm rib hem (cm) — Adult M = 73.0 cm */
  frontLength: number;
  /** E: Armhole Curve Half Measure (cm) — Adult M = 27.5 cm */
  armholeHalf: number;
  /** N: Neck Width seam-to-seam (cm) — Adult M = 17.5 cm */
  neckWidth: number;
  /** N1: Front Neck Drop from HSP to top of placket (cm) — Adult M = 10.0 cm */
  frontNeckDrop: number;
  /** S: Sleeve Length from Shoulder incl. 6 cm cuff (cm) — Adult M = 64.5 cm */
  sleeveLength: number;
  /** S1: Sleeve Opening along seam flat half (cm) — Adult M = 14.5 cm */
  sleeveOpeningHalf: number;
  /** B1/N3/S3: Rib Height for Collar, Basque & Cuffs (cm) — Constant 6.0 cm */
  ribHeight: number;
  /** P1: Angled Welt Pocket Opening (cm) — Adult = 16.0 cm, Youth 8 = 14.0 cm */
  pocketOpening: number;
  /** Standard fleece / overlock seam allowance (cm) */
  seamAllowance: number;
  /** Include all 10 production pieces (Facing to shoulder, 1x1 Ribs, Self Hem Panels, Welt & Pocket Bags) */
  includeFullTrims: boolean;
}

export const BOMBER_89865_META = {
  styleCode: "89865",
  blockNo: "LU9335",
  brand: "BEARE & LEY",
  school: "Mernda Primary School",
  standards: "Australian Size Standards (PPS Approved 03.04.2025)",
  fabric: "Polyester Cotton Fleece — Maroon (#6D1D32)",
  ribKnit: "1×1 Rib Knit — Maroon & 2 Gold Stripes (#EAB308)",
  pressStuds: "11mm Press Studs — DTM (×6 Front Opening)",
  weltPocket:
    "Angled Welt Pocket 3.0 cm width • 3.0 cm from S.S. • 7.5 cm above Rib (M) • Pocket bag inserted into hem & tacked to front facing",
  facingRule:
    "Full Inside Front Facing (9.0 cm body / 5.0 cm at shoulder seam) extended up to shoulder seam per QC Report",
  embroidery: "LHS Chest Logo (8.0 cm from front edge, 17.5 cm from HSP on Size M)",
} as const;

export const BOMBER_89865_PRESETS: Record<
  "adultM" | "pps14" | "sample8" | "youth4",
  { label: string; sublabel: string; values: Partial<BomberJacketParams> }
> = {
  adultM: {
    label: "89865 Size M (Adult)",
    sublabel: "Ngực 117 • Dài 73",
    values: {
      chest: 117,
      ribHemHalf: 46.0,
      shoulder: 47.0,
      frontLength: 73.0,
      armholeHalf: 27.5,
      neckWidth: 17.5,
      frontNeckDrop: 10.0,
      sleeveLength: 64.5,
      sleeveOpeningHalf: 14.5,
      ribHeight: 6.0,
      pocketOpening: 16.0,
    },
  },
  pps14: {
    label: "89865 Size 14 (PPS)",
    sublabel: "Ngực 100 • Dài 64",
    values: {
      chest: 100,
      ribHemHalf: 38.0,
      shoulder: 41.0,
      frontLength: 64.0,
      armholeHalf: 25.0,
      neckWidth: 16.0,
      frontNeckDrop: 8.0,
      sleeveLength: 62.0,
      sleeveOpeningHalf: 13.5,
      ribHeight: 6.0,
      pocketOpening: 15.0,
    },
  },
  sample8: {
    label: "89865 Size 8 (1st)",
    sublabel: "Ngực 85 • Dài 54",
    values: {
      chest: 85,
      ribHemHalf: 32.0,
      shoulder: 35.0,
      frontLength: 54.0,
      armholeHalf: 21.5,
      neckWidth: 14.5,
      frontNeckDrop: 6.5,
      sleeveLength: 48.0,
      sleeveOpeningHalf: 12.0,
      ribHeight: 6.0,
      pocketOpening: 14.0,
    },
  },
  youth4: {
    label: "89865 Size 4 (Nhỏ)",
    sublabel: "Ngực 76 • Dài 48",
    values: {
      chest: 76,
      ribHemHalf: 28.0,
      shoulder: 31.0,
      frontLength: 48.0,
      armholeHalf: 18.0,
      neckWidth: 13.0,
      frontNeckDrop: 5.5,
      sleeveLength: 39.0,
      sleeveOpeningHalf: 10.5,
      ribHeight: 6.0,
      pocketOpening: 13.0,
    },
  },
};

export const bomberJacketSchema: TemplateSchema = {
  groups: [
    {
      id: "body",
      title: "Thông số thân áo 89865 (Body Specs — AU Std)",
      description: "Chuẩn bảng thông số 89865 Adult Base Size M (BEARE & LEY)",
    },
    {
      id: "neck-sleeve",
      title: "Cổ áo, Nách & Tay dài (Collar & Sleeve)",
      description: "Hạ cổ sau 1.0 cm • Cổ/Bo gấu/Bo tay 1×1 Rib cao 6.0 cm",
    },
    {
      id: "details",
      title: "Túi cơi xéo, Đáp nẹp & Đường may (Pockets & Trims)",
      description: "Túi cơi 3.0 cm cách sườn 3.0 cm • Nẹp đáp kéo lên vai 5.0 cm",
    },
  ],
  fields: [
    {
      key: "chest",
      type: "number",
      group: "body",
      label: "Vòng ngực ngang nách (A: Chest Circ.)",
      shortLabel: "Vòng ngực",
      description: "Chu vi ngực thành phẩm (cũng là vòng lai cách bo 3 cm)",
      defaultValue: 117,
      min: 74,
      max: 145,
      step: 1,
      unit: "cm",
    },
    {
      key: "shoulder",
      type: "number",
      group: "body",
      label: "Ngang vai (D: Shoulder to Shoulder)",
      shortLabel: "Ngang vai",
      description: "Đo thẳng từ đầu vai trái sang đầu vai phải",
      defaultValue: 47.0,
      min: 30,
      max: 58,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "frontLength",
      type: "number",
      group: "body",
      label: "Dài áo từ HSP gồm bo (F: Front Length)",
      shortLabel: "Dài áo",
      description: "Chiều dài từ đỉnh vai cạnh cổ (HSP) hết bo gấu 6.0 cm",
      defaultValue: 73.0,
      min: 46,
      max: 84,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "ribHemHalf",
      type: "number",
      group: "body",
      label: "1/2 Rộng bo gấu tự nhiên (C: Rib Hem 1/2)",
      shortLabel: "1/2 Bo gấu",
      description: "Đo nửa vòng bo gấu 1×1 ở trạng thái êm không kéo giãn",
      defaultValue: 46.0,
      min: 26,
      max: 60,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "armholeHalf",
      type: "number",
      group: "neck-sleeve",
      label: "1/2 Vòng nách cong (E: Armhole Curve)",
      shortLabel: "1/2 Nách",
      description: "Đo cong vòng nách thân trước (1/2 tổng vòng nách)",
      defaultValue: 27.5,
      min: 17,
      max: 34,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "neckWidth",
      type: "number",
      group: "neck-sleeve",
      label: "Rộng cổ chân vai (N: Neck Width)",
      shortLabel: "Rộng cổ",
      description: "Đo ngang giữa hai đỉnh vai cạnh cổ (HSP – HSP)",
      defaultValue: 17.5,
      min: 12.5,
      max: 22,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "frontNeckDrop",
      type: "number",
      group: "neck-sleeve",
      label: "Sâu cổ trước (N1: Front Neck Drop)",
      shortLabel: "Sâu cổ trước",
      description: "Hạ từ HSP xuống đầu nẹp nút bấm (cổ sau cố định 1.0 cm)",
      defaultValue: 10.0,
      min: 5.5,
      max: 13.0,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "sleeveLength",
      type: "number",
      group: "neck-sleeve",
      label: "Dài tay từ đầu vai gồm bo (S: Sleeve Length)",
      shortLabel: "Dài tay",
      description: "Bao gồm bo cổ tay 1×1 Rib cao 6.0 cm",
      defaultValue: 64.5,
      min: 38,
      max: 72,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "sleeveOpeningHalf",
      type: "number",
      group: "neck-sleeve",
      label: "1/2 Cửa tay thân vải (S1: Flat Sleeve Open)",
      shortLabel: "1/2 Cửa tay",
      description: "Độ rộng nửa cửa tay tại đường ráp bo cổ tay",
      defaultValue: 14.5,
      min: 10,
      max: 18,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "ribHeight",
      type: "number",
      group: "details",
      label: "Bản cao Bo cổ / Bo gấu / Bo tay (B1/N3/S3)",
      shortLabel: "Cao Bo 1×1",
      description: "Thành phẩm gấp đôi 6.0 cm (1×1 Rib Maroon + 2 sọc Gold)",
      defaultValue: 6.0,
      min: 4.0,
      max: 8.0,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "pocketOpening",
      type: "number",
      group: "details",
      label: "Miệng túi cơi xéo (P1: Welt Opening)",
      shortLabel: "Miệng túi",
      description: "Bản cơi 3.0 cm • Cách sườn 3.0 cm • Cách đường bo 7.5 cm",
      defaultValue: 16.0,
      min: 12.0,
      max: 19.0,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "seamAllowance",
      type: "number",
      group: "details",
      label: "Chừa đường may (Seam Allowance)",
      shortLabel: "Đường may",
      description: "Đường may vắt sổ 4 chỉ / 1 kim tiêu chuẩn vải nỉ Fleece",
      defaultValue: 1.0,
      min: 0.6,
      max: 2.0,
      step: 0.1,
      unit: "cm",
    },
    {
      key: "includeFullTrims",
      type: "toggle",
      group: "details",
      label: "Đầy đủ bộ 10 mảnh rập (Đáp vai, Bo 1×1, Cơi & Lót túi)",
      shortLabel: "Đủ 10 mảnh",
      description:
        "Bao gồm Đáp nẹp kéo lên vai (QC fix), Cổ/Bo gấu/Bo tay 1×1, Đáp gấu vuông, Cơi & Lót túi xuống lai",
      defaultValue: true,
      activeLabel: "10 mảnh rập",
      inactiveLabel: "3 mảnh chính",
    },
  ],
};

export function parseBomberJacketParams(raw: ParamValues): BomberJacketParams {
  return {
    chest: Math.min(145, Math.max(74, Number(raw.chest ?? 117))),
    ribHemHalf: Math.min(60, Math.max(26, Number(raw.ribHemHalf ?? 46.0))),
    shoulder: Math.min(58, Math.max(30, Number(raw.shoulder ?? 47.0))),
    frontLength: Math.min(84, Math.max(46, Number(raw.frontLength ?? 73.0))),
    armholeHalf: Math.min(34, Math.max(17, Number(raw.armholeHalf ?? 27.5))),
    neckWidth: Math.min(22, Math.max(12.5, Number(raw.neckWidth ?? 17.5))),
    frontNeckDrop: Math.min(13, Math.max(5.5, Number(raw.frontNeckDrop ?? 10.0))),
    sleeveLength: Math.min(72, Math.max(38, Number(raw.sleeveLength ?? 64.5))),
    sleeveOpeningHalf: Math.min(
      18,
      Math.max(10, Number(raw.sleeveOpeningHalf ?? 14.5))
    ),
    ribHeight: Math.min(8, Math.max(4, Number(raw.ribHeight ?? 6.0))),
    pocketOpening: Math.min(19, Math.max(12, Number(raw.pocketOpening ?? 16.0))),
    seamAllowance: Math.min(2.0, Math.max(0.6, Number(raw.seamAllowance ?? 1.0))),
    includeFullTrims:
      raw.includeFullTrims === undefined ? true : Boolean(raw.includeFullTrims),
  };
}

export function getBomberJacketDefaults(): ParamValues {
  const defaults: ParamValues = {};
  for (const field of bomberJacketSchema.fields) {
    defaults[field.key] = field.defaultValue;
  }
  return defaults;
}
