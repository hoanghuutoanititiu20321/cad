import { roundCm } from "./math";
import type { NestedGradingResult, ParamValues, SizeCode } from "./types";
import { parseCircleSkirtParams, WAISTBAND_HEIGHT_CM } from "@/templates/circle-skirt/schema";

export interface WorkOrderConfig {
  styleCode: string;
  workshopLine: string;
  fabricInfo: string;
  fabricWidthCm: number;
  preparedBy: string;
  issueDate: string;
  sizeQuantities: Record<SizeCode, number>;
  customNote: string;
}

export interface SewingStep {
  stepNo: number;
  department: string;
  instruction: string;
  machineType: string;
}

export interface WorkOrderComputed {
  totalGarments: number;
  totalSkirtPanels: number;
  totalWaistbandPieces: number;
  totalInterfacingPieces: number;
  totalZippers: number;
  estimatedFabricMeters: number;
  sewingSteps: SewingStep[];
}

/**
 * Compute production quantities, fabric consumption (with 12% marker loss allowance),
 * and dynamic step-by-step sewing instructions tailored to the exact pattern parameters!
 */
export function computeWorkOrderDetails(
  rawParams: ParamValues,
  grading: NestedGradingResult,
  config: WorkOrderConfig
): WorkOrderComputed {
  const p = parseCircleSkirtParams(rawParams);
  const sizes: SizeCode[] = ["S", "M", "L", "XL"];

  const totalGarments = sizes.reduce(
    (sum, sz) => sum + Math.max(0, Math.floor(config.sizeQuantities[sz] || 0)),
    0
  );

  const totalSkirtPanels = totalGarments * p.pieceMultiplier;
  const totalWaistbandPieces = totalGarments * 2; // Vải chính + đáp trong
  const totalInterfacingPieces = totalGarments * 1; // Keo dựng ép lưng
  const totalZippers = totalGarments;

  // Weighted area across ordered sizes + 12% marker efficiency waste
  let totalPatternAreaM2 = 0;
  for (const entry of grading.entries) {
    const qty = Math.max(0, Math.floor(config.sizeQuantities[entry.size] || 0));
    if (qty > 0) {
      totalPatternAreaM2 += entry.geometry.summary.totalAreaM2 * qty;
    }
  }
  const usableWidthM = Math.max(0.9, (config.fabricWidthCm || 150) / 100 - 0.04);
  const rawMeters = (totalPatternAreaM2 / usableWidthM) * 1.14; // +14% hao hụt giác sơ đồ & đầu bàn
  const estimatedFabricMeters = roundCm(rawMeters, 2);

  // Dynamic step-by-step sewing operations for line workers
  const saText = `${p.seamAllowance.toFixed(1)} cm`;
  const wbLabel =
    p.waistbandType === "curved"
      ? `bản lưng cong ${WAISTBAND_HEIGHT_CM} cm`
      : `bản lưng thẳng ${WAISTBAND_HEIGHT_CM} cm`;

  const sewingSteps: SewingStep[] = [
    {
      stepNo: 1,
      department: "Tổ Cắt & Ép keo",
      instruction: `Kiểm đủ bán thành phẩm theo dấu bấm định vị (CF, 1/4 eo, dừng khóa). Ép keo dựng mặt trái lá ngoài của ${wbLabel}, ủi định hình đúng độ cong rập.`,
      machineType: "Bàn ủi hơi / Máy ép keo",
    },
    {
      stepNo: 2,
      department: "Vắt sổ",
      instruction:
        p.pieceMultiplier === 2
          ? "Vắt sổ 4 chỉ/3 chỉ rời từng cạnh sườn trái & sườn phải của 2 mảnh tùng váy trước khi ráp."
          : "Vắt sổ sạch hai mép đường xẻ sống lưng giữa sau (Center Back) từ eo xuống lai.",
      machineType: "Máy vắt sổ (Overlock)",
    },
    ...(p.gatherRatio > 1
      ? [
          {
            stepNo: 3,
            department: "May chuẩn bị",
            instruction: `Chạy 2 đường chỉ thưa song song (bước chỉ 4.0 mm) cách mép cắt eo ${(p.seamAllowance * 0.6).toFixed(1)} cm và ${(p.seamAllowance * 0.9).toFixed(1)} cm. Rút nhún đều hệ số ×${p.gatherRatio} sao cho khớp đúng các dấu bấm chia tư của bản lưng.`,
            machineType: "Máy 1 kim (Lockstitch)",
          },
        ]
      : []),
    {
      stepNo: p.gatherRatio > 1 ? 4 : 3,
      department: "May thân & Khóa",
      instruction:
        p.pieceMultiplier === 2
          ? `Ráp kín đường sườn phải (chừa đường may ${saText}), ủi rẽ. Bên sườn trái: may từ lai lên đến đúng dấu bấm dừng khóa kéo (cách eo 18 cm), tra dây kéo giọt nước ẩn sát chân lưng.`
          : `May khép đường sống lưng giữa sau từ lai lên đến dấu bấm dừng khóa kéo (cách eo 18 cm, chừa đường may ${saText}), ủi rẽ và tra dây kéo giọt nước 18 cm.`,
      machineType: "Máy 1 kim + Chân vịt giọt nước",
    },
    {
      stepNo: p.gatherRatio > 1 ? 5 : 4,
      department: "Đóng bản lưng",
      instruction: `Ráp lá lưng chính vào vòng eo tùng váy (chừa đường may ${saText}), trùng khít dấu bấm giữa (CF) và sườn. May lộn hai đầu lưng + mép trên với lá lưng lót, lộn phải, ủi êm và diễu mí 0.1 cm chân lưng.`,
      machineType: "Máy 1 kim",
    },
    {
      stepNo: p.gatherRatio > 1 ? 6 : 5,
      department: "Lên lai & Hoàn tất",
      instruction: `Treo tùng váy ổn định canh sợi, gọt đều nếu giãn thiên vải, cuốn biên / gấp lai nhỏ (${saText}) đều quanh vòng lai. Ủi hơi hoàn thiện, kiểm thông số theo bảng QC trước khi đóng gói.`,
      machineType: "Máy cuốn biên / 1 kim + Ủi hơi",
    },
  ];

  return {
    totalGarments,
    totalSkirtPanels,
    totalWaistbandPieces,
    totalInterfacingPieces,
    totalZippers,
    estimatedFabricMeters,
    sewingSteps,
  };
}
