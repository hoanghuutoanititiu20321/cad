import { roundCm } from "./math";
import type { NestedGradingResult, ParamValues, SizeCode } from "./types";
import { parseCircleSkirtParams, WAISTBAND_HEIGHT_CM } from "@/templates/circle-skirt/schema";
import { parseBaggyJeanParams, WV1499_TECHPACK_META } from "@/templates/baggy-jean/schema";
import { parseBomberJacketParams, BOMBER_89865_META } from "@/templates/bomber-jacket/schema";
import { parseColorblockPoloParams, HAZE026_META } from "@/templates/colorblock-polo/schema";

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

  if (templateId === "bomber-jacket") {
    const bp = parseBomberJacketParams(rawParams);
    const saText = `${bp.seamAllowance.toFixed(1)} cm`;
    const sewingSteps: SewingStep[] = [
      {
        stepNo: 1,
        department: "Tổ Cắt & Ép keo",
        instruction: `Kiểm đủ ${bp.includeFullTrims ? "10 mảnh rập" : "3 mảnh chính"} mã ${BOMBER_89865_META.styleCode} (${BOMBER_89865_META.school}). Tách riêng vải nỉ Fleece Maroon và bo gân 1×1 (Maroon & 2 sọc Gold). Ép keo dọc Đáp nẹp trong (FAC-01) để đóng nút bấm 11mm không bị rách nỉ.`,
        machineType: "Bàn cắt / Máy ép keo",
      },
      {
        stepNo: 2,
        department: "Thêu Logo & Túi cơi xéo",
        instruction: `Thêu logo trường trên ngực trái (cách mép trước 8.0 cm, cách HSP 17.5 cm ở size M). Mổ 2 túi cơi xéo bản 3.0 cm (miệng ${bp.pocketOpening} cm, cách sườn 3.0 cm, cách đường bo 7.5 cm), diễu mí xung quanh và đánh bọ hai đầu cơi.`,
        machineType: "Máy thêu + Máy 1 kim + Đánh bọ",
      },
      {
        stepNo: 3,
        department: "Xử lý Lót túi & Đáp nẹp lên vai (QC Fix)",
        instruction: `Đính mép trong của Lót túi (PKB-01) vào Đáp nẹp trong (FAC-01) để lót túi KHÔNG bị lật lộ khi mặc (lỗi PPS 03.04.2025). Kéo dài Đáp nẹp lên tận đường vai con (bản vai 5.0 cm, thân 9.0 cm).`,
        machineType: "Máy 1 kim + Vắt sổ 4 chỉ",
      },
      {
        stepNo: 4,
        department: "Ráp Vai, Tra Tay & Ráp Sườn",
        instruction: `Ráp vai thân trước – sau (kẹp kèm đầu đáp nẹp vai, chừa ${saText}). Tra 2 tay dài (SLV-01) khớp dấu bấm đỉnh vai & mang trước. Vắt sổ 4 chỉ kín sườn tay xuống sườn thân.`,
        machineType: "Máy vắt sổ 4 chỉ + 1 kim",
      },
      {
        stepNo: 5,
        department: "Tra Cổ Bo, Bo Gấu & Bo Cửa Tay 1×1",
        instruction: `Nối 2 Đáp gấu vải chính vuông (FHP-01: 8×6 cm) vào 2 đầu Bo gấu 1×1 (BSQ-01), tra vào lai thân sao cho đáy Lót túi (PKB-01) kẹp gọn trong đường may bo. Tra Cổ bo (CLR-01) và Bo tay (CUF-01) cao ${bp.ribHeight} cm khớp sọc Gold đều nhau.`,
        machineType: "Máy vắt sổ 4 chỉ + 1 kim diễu mí",
      },
      {
        stepNo: 6,
        department: "Đóng Nút Bấm 11mm & Kiểm QC",
        instruction: `Đóng 6 bộ nút bấm kim loại 11mm cùng màu (DTM) thẳng hàng dọc tâm nẹp trước, gài nhãn BEARE & LEY + size pip + nhãn giặt. Đo kiểm toàn bộ thông số chuẩn Australian Size Standards trước khi đóng túi poly.`,
        machineType: "Máy đóng nút bấm + QC đo bàn",
      },
    ];

    return {
      totalGarments,
      totalSkirtPanels: totalGarments * 3, // 2 Front + 1 Back
      totalWaistbandPieces: totalGarments * 4, // Collar + Basque + 2 Cuffs
      totalInterfacingPieces: totalGarments * 2, // 2 Front Facings
      totalZippers: totalGarments * 6, // 6× 11mm press studs per jacket
      estimatedFabricMeters,
      sewingSteps,
    };
  }

  if (templateId === "colorblock-polo") {
    const pp = parseColorblockPoloParams(rawParams);
    const saText = `${pp.seamAllowance.toFixed(1)} cm`;
    const btnCount = pp.chest <= 99 ? 2 : 3;
    const sewingSteps: SewingStep[] = [
      {
        stepNo: 1,
        department: "Tổ Cắt 4 Màu Vải",
        instruction: `Phân tách bàn cắt theo đúng 4 mã màu ${HAZE026_META.styleCode}: (1) Vải chính LA65V Dark Bottle (khổ 161 cm: S-BK, S-SLV, S-FRT4, SF-PL), (2) Vải phối 1 LA65V White (161 cm: W-FRT1), (3) LA65V Black (80.5 cm: B-FRT2), (4) Viền JC50 Silver (80.5 cm: C-FRT3) + Keo ép trụ HAZE026-KEO.`,
        machineType: "Bàn cắt / Bấm dấu khớp chéo",
      },
      {
        stepNo: 2,
        department: "Ráp Phối Chéo 4 Mảnh Thân Trước",
        instruction: pp.diagonalColorblock
          ? `Ráp nối theo đúng thứ tự từ trên xuống: W-FRT1 (Trắng) → B-FRT2 (Đen ${pp.stripeWidth} cm) → C-FRT3 (Bạc ${pp.stripeWidth} cm) → S-FRT4 (Xanh Đậm), khớp chính xác 3 dấu bấm định vị trên đường chéo (chừa ${saText}). Diễu mí đè 0.1 cm giữ êm đường phối.`
          : `Kiểm thân trước nguyên mảnh LA65V Dark Bottle, lấy dấu tâm trụ nút và dấu thêu logo.`,
        machineType: "Vắt sổ 4 chỉ + Máy 1 kim diễu mí",
      },
      {
        stepNo: 3,
        department: "Làm Nẹp Trụ Cổ (2/3 Nút)",
        instruction: `Ép keo HAZE026-KEO lên 2 lá trụ SF-PL (rộng ${pp.placketWidth} cm × dài ${pp.placketLength} cm). Bổ trụ giữa thân trước trên (W-FRT1), may chặn hộp chân trụ chắc chắn. Lưu ý quy cách .PLT: Size 4–16 dùng 2 nút, Size XS–3XL dùng 3 nút (mẫu hiện tại: ${btnCount} nút).`,
        machineType: "Máy ép keo + Máy 1 kim",
      },
      {
        stepNo: 4,
        department: "Ráp Vai & Tra Lá Cổ Dệt Polo",
        instruction: `Ráp vai con thân trước – sau (kèm dây xương cá / viền chống giãn vai). Tra lá cổ dệt phẳng Dark Bottle (bản CB ${pp.collarDepth} cm), cuốn bọc viền cổ sau sạch đường may, khớp chuẩn dấu bấm giữa cổ sau (CB).`,
        machineType: "Vắt sổ 4 chỉ + Máy viền cổ",
      },
      {
        stepNo: 5,
        department: "Tra Tay Ngắn & Ráp Sườn",
        instruction: `Tra 2 tay ngắn (S-SLV, dài ${pp.sleeveLength} cm) vào vòng nách (1/2 nách ${pp.armholeHalf} cm) khớp dấu bấm đỉnh tay & mang trước. Vắt sổ 4 chỉ liền sườn tay xuống sườn thân, lưu ý trùng khít mép các dải phối chéo hai bên sườn.`,
        machineType: "Máy vắt sổ 4 chỉ",
      },
      {
        stepNo: 6,
        department: "Trần Đè Lai 2.5 cm, Đính Nút & QC",
        instruction: `Gấp lai áo & lai cửa tay 2.5 cm chạy trần đè 2 kim (Coverstitch). Thùa khuy và đính ${btnCount} nút trụ đúng vị trí. Ủi hơi, đo kiểm thông số bảng SPEC (Ngực ${pp.chest} cm, Dài CB ${pp.cbLength} cm) trước khi xuất hàng AFW.`,
        machineType: "Máy trần đè (Kansai) + Thùa khuy + Đính nút",
      },
    ];

    return {
      totalGarments,
      totalSkirtPanels: totalGarments * (pp.diagonalColorblock ? 5 : 2), // 4 Front colorblocks + 1 Back
      totalWaistbandPieces: totalGarments * 1, // Flat-knit collar
      totalInterfacingPieces: totalGarments * 2, // 2 Placket interfacings (KEO)
      totalZippers: totalGarments * btnCount, // Total buttons
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
