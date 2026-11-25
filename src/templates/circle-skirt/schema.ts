import type { ParamValues, TemplateSchema } from "@/lib/cad/types";

export interface CircleSkirtParams {
  waist: number;
  gatherRatio: number;
  skirtLength: number;
  flareAngle: number;
  pieceMultiplier: number;
  waistbandType: "straight" | "curved";
  seamAllowance: number;
  includeZipperNotch: boolean;
}

export const WAISTBAND_HEIGHT_CM = 3.5;

export const circleSkirtSchema: TemplateSchema = {
  groups: [
    {
      id: "measurements",
      title: "Thông số cơ thể & Dáng váy (Measurements)",
      description: "Thông số gốc cho size chuẩn (Base Size)",
    },
    {
      id: "construction",
      title: "Kết cấu & Bản lưng (Construction)",
      description: "Độ xòe, chia mảnh cắt và kiểu bản lưng 3.5 cm",
    },
    {
      id: "production",
      title: "Kỹ thuật may & Chừa đường may (Production)",
      description: "Chừa đường may và dấu bấm sản xuất",
    },
  ],
  fields: [
    {
      key: "waist",
      type: "number",
      group: "measurements",
      label: "Vòng eo / lưng (Waist)",
      shortLabel: "Vòng eo",
      description: "Số đo vòng eo thành phẩm trước khi nhún",
      defaultValue: 68,
      min: 48,
      max: 130,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "skirtLength",
      type: "number",
      group: "measurements",
      label: "Độ dài tùng váy (Skirt Length)",
      shortLabel: "Dài váy",
      description: "Chiều dài từ đường chân lưng xuống lai váy",
      defaultValue: 55,
      min: 25,
      max: 115,
      step: 0.5,
      unit: "cm",
    },
    {
      key: "gatherRatio",
      type: "select",
      group: "measurements",
      label: "Hệ số nhún eo (Gather Ratio)",
      shortLabel: "Nhún eo",
      description: "Nhân hệ số chu vi vòng eo tùng váy để tạo độ nhún",
      defaultValue: 1,
      display: "segmented",
      options: [
        { value: 1, label: "Không nhún", sublabel: "×1.0" },
        { value: 1.5, label: "Nhún nhẹ", sublabel: "×1.5" },
        { value: 2, label: "Nhún bèo", sublabel: "×2.0" },
      ],
    },
    {
      key: "flareAngle",
      type: "select",
      group: "construction",
      label: "Góc xòe (Flare Angle)",
      shortLabel: "Góc xòe",
      description: "Tổng góc cung tròn của toàn bộ tùng váy",
      defaultValue: 180,
      display: "select",
      options: [
        { value: 360, label: "360° — Xòe tròn toàn phần (Full Circle)" },
        { value: 270, label: "270° — Xòe 3/4 tròn (3/4 Circle)" },
        { value: 180, label: "180° — Xòe bán nguyệt (Half Circle)" },
        { value: 135, label: "135° — Xòe 3/8 tròn (3/8 Circle)" },
        { value: 90, label: "90° — Xòe 1/4 tròn (Quarter Circle)" },
      ],
    },
    {
      key: "pieceMultiplier",
      type: "select",
      group: "construction",
      label: "Số mảnh cắt tùng váy (Piece Multiplier)",
      shortLabel: "Số mảnh cắt",
      description: "Cắt nguyên mảnh liền hoặc chia đôi thân trước / thân sau",
      defaultValue: 1,
      display: "segmented",
      options: [
        { value: 1, label: "×1 Nguyên mảnh", sublabel: "Single Piece" },
        { value: 2, label: "×2 Cắt đôi", sublabel: "2 Panels" },
      ],
    },
    {
      key: "waistbandType",
      type: "select",
      group: "construction",
      label: "Kiểu bản lưng (Waistband Type — 3.5 cm)",
      shortLabel: "Bản lưng",
      description: "Bản rộng tiêu chuẩn 3.5 cm (cắt x2: vải chính + lót/keo)",
      defaultValue: "curved",
      display: "segmented",
      options: [
        { value: "straight", label: "Lưng thẳng", sublabel: "Straight 3.5cm" },
        { value: "curved", label: "Lưng cong", sublabel: "Curved 3.5cm" },
      ],
    },
    {
      key: "seamAllowance",
      type: "number",
      group: "production",
      label: "Chừa đường may (Seam Allowance)",
      shortLabel: "Đường may",
      description: "Độ rộng chừa đường may đồng đều quanh rập",
      defaultValue: 1.0,
      min: 0,
      max: 2.5,
      step: 0.1,
      unit: "cm",
    },
    {
      key: "includeZipperNotch",
      type: "toggle",
      group: "production",
      label: "Dấu bấm dừng khóa kéo 18 cm (Zipper Notch)",
      shortLabel: "Dấu khóa kéo",
      description: "Tự động đặt dấu bấm tra khóa giọt nước trên đường sườn/giữa sau",
      defaultValue: true,
      activeLabel: "Hiển thị (18 cm)",
      inactiveLabel: "Tắt",
    },
  ],
};

export function parseCircleSkirtParams(raw: ParamValues): CircleSkirtParams {
  const waist = Math.min(130, Math.max(48, Number(raw.waist ?? 68)));
  const gatherRatio = Number(raw.gatherRatio ?? 1);
  const skirtLength = Math.min(115, Math.max(25, Number(raw.skirtLength ?? 55)));
  const flareAngle = Number(raw.flareAngle ?? 180);
  const pieceMultiplier = Number(raw.pieceMultiplier ?? 1) === 2 ? 2 : 1;
  const waistbandType =
    raw.waistbandType === "straight" ? "straight" : "curved";
  const seamAllowance = Math.min(
    2.5,
    Math.max(0, Number(raw.seamAllowance ?? 1.0))
  );
  const includeZipperNotch =
    raw.includeZipperNotch === undefined
      ? true
      : Boolean(raw.includeZipperNotch);

  return {
    waist,
    gatherRatio,
    skirtLength,
    flareAngle,
    pieceMultiplier,
    waistbandType,
    seamAllowance,
    includeZipperNotch,
  };
}

export function getCircleSkirtDefaults(): ParamValues {
  const defaults: ParamValues = {};
  for (const field of circleSkirtSchema.fields) {
    defaults[field.key] = field.defaultValue;
  }
  return defaults;
}
