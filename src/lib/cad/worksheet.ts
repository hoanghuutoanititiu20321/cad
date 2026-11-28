import { roundCm } from "./math";
import type { NestedGradingResult, ParamValues, SizeCode } from "./types";
import { parseCircleSkirtParams, WAISTBAND_HEIGHT_CM } from "@/templates/circle-skirt/schema";
import { parseBaggyJeanParams, WV1499_TECHPACK_META } from "@/templates/baggy-jean/schema";

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
  config: WorkOrderConfig,
  templateId = "circle-skirt"
): WorkOrderComputed {
  const sizes: SizeCode[] = ["S", "M", "L", "XL"];
  const totalGarments = sizes.reduce(
    (sum, sz) => sum + Math.max(0, Math.floor(config.sizeQuantities[sz] || 0)),
    0
  );

  // Weighted area across ordered sizes + 14% marker efficiency waste
  let totalPatternAreaM2 = 0;
  for (const entry of grading.entries) {
    const qty = Math.max(0, Math.floor(config.sizeQuantities[entry.size] || 0));
    if (qty > 0) {
      totalPatternAreaM2 += entry.geometry.summary.totalAreaM2 * qty;
    }
  }
  const usableWidthM = Math.max(0.9, (config.fabricWidthCm || 150) / 100 - 0.04);
  const estimatedFabricMeters = roundCm((totalPatternAreaM2 / usableWidthM) * 1.14, 2);

  if (templateId === "baggy-jean") {
    const jp = parseBaggyJeanParams(rawParams);
    const saText = `${jp.seamAllowance.toFixed(1)} cm`;
    const sewingSteps: SewingStep[] = [
      {
        stepNo: 1,
        department: "Tổ Cắt & Ghi chú R&D",
        instruction: `Kiểm đủ ${jp.includeFivePockets ? "8 mẫu rập 5 túi" : "4 mẫu thân chính"} theo mã ${WV1499_TECHPACK_META.styleCode}. ${jp.revisedGrainlines ? "LƯU Ý *Change Grainlines: cắt đúng canh ngang cho Đô sau (YKE-01) và Đáp túi trước." : ""}`,
        machineType: "Bàn cắt / Máy cắt đứng",
      },
      {
        stepNo: 2,
        department: "Cụm Túi Trước & Khóa",
        instruction: `Ráp túi lót trắng & đáp miệng túi trước (4 1/4" × 2 1/2"), diễu mí 1/4" DN. Dán túi đồng hồ (3" × 3") bên phải, đóng 3 đinh tán 14L Brass. Tra dây kéo 4 1/2" Navy Tape và diễu J-Stitch (5" × 1 1/2") + bọ 1/2" Bartack.`,
        machineType: "Máy 1 kim + 2 kim (1/4\" DN) + Đóng nút",
      },
      {
        stepNo: 3,
        department: "Cụm Thân Sau & Túi Sau",
        instruction: `Ráp Đô sau (2" @CB / 3/4" @SS) vào Thân sau (chừa ${saText}), cuốn/diễu 1/4" DN Overlock. Dán 2 Túi sau ngũ giác (6 1/4" × 6 1/4") cách CB 1 5/8", cách đường đô 1 3/8" @CB và 1 5/8" @SS, đánh bọ 1/2" hai góc túi.`,
        machineType: "Máy 2 kim + Máy đánh bọ (Bartack)",
      },
      {
        stepNo: 4,
        department: "Ráp Sườn & Đáy Quần",
        instruction: `Ráp sườn ngoài (diễu 6" từ cạp xuống mí 1/16") và ráp sườn trong (inseam ${jp.inseam} cm), vắt sổ 1/4" DN Overlock. Ráp kín vòng đáy sau (2 kim móc xích chịu lực).`,
        machineType: "Vắt sổ 5 chỉ + Máy cuốn sườn",
      },
      {
        stepNo: 5,
        department: "Vào Cạp Cong & 5 Đỉa",
        instruction: `Vào cạp cong 2 lá rộng ${jp.waistbandHeight} cm (1 5/8"), diễu mí 1/8" quanh cạp. Đánh 5 đỉa quần (2 1/2" × 5/8") — đỉa sườn cách đường sườn 1 1/4" dính lên đô sau. Đóng 1 nút 27L Anti-Copper & thùa khuy đầu cạp.`,
        machineType: "Máy vào cạp + Đánh bọ + Thùa khuy mắt phụng",
      },
      {
        stepNo: 6,
        department: "Lên Lai & Wash Hoàn Tất",
        instruction: `Cuốn lai sạch 5/8" (${jp.hemAllowance} cm SN Clean Finished Hem). Chuyển xử lý Wash (M Stone + Tint + Dry Process + Grinding & Destroy + Silicone Softener) và đo kiểm QC theo bảng PP Fit.`,
        machineType: "Máy lên lai Jeans + Xưởng Wash",
      },
    ];

    return {
      totalGarments,
      totalSkirtPanels: totalGarments * 4, // 2 Front + 2 Back
      totalWaistbandPieces: totalGarments * 2,
      totalInterfacingPieces: totalGarments * 2, // 2 Back Yokes
      totalZippers: totalGarments,
      estimatedFabricMeters,
      sewingSteps,
    };
  }

  const p = parseCircleSkirtParams(rawParams);
  const totalSkirtPanels = totalGarments * p.pieceMultiplier;
  const totalWaistbandPieces = totalGarments * 2; // Vải chính + đáp trong
  const totalInterfacingPieces = totalGarments * 1; // Keo dựng ép lưng
  const totalZippers = totalGarments;

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
