import type { PatternTemplate } from "@/lib/cad/types";
import {
  circleSkirtSchema,
  getCircleSkirtDefaults,
} from "./circle-skirt/schema";
import { generateCircleSkirtGeometry } from "./circle-skirt/geometry";
import { generateCircleSkirtGrading } from "./circle-skirt/grading";
import {
  baggyJeanSchema,
  getBaggyJeanDefaults,
} from "./baggy-jean/schema";
import { generateBaggyJeanGeometry } from "./baggy-jean/geometry";
import { generateBaggyJeanGrading } from "./baggy-jean/grading";
import {
  bomberJacketSchema,
  getBomberJacketDefaults,
} from "./bomber-jacket/schema";
import { generateBomberJacketGeometry } from "./bomber-jacket/geometry";
import { generateBomberJacketGrading } from "./bomber-jacket/grading";
import {
  colorblockPoloSchema,
  getColorblockPoloDefaults,
} from "./colorblock-polo/schema";
import { generateColorblockPoloGeometry } from "./colorblock-polo/geometry";
import { generateColorblockPoloGrading } from "./colorblock-polo/grading";

export const circleSkirtTemplate: PatternTemplate = {
  id: "circle-skirt",
  name: "Chân váy xòe",
  englishName: "Flared Circle Skirt",
  category: "Chân váy (Skirts)",
  version: "1.0.0",
  description:
    "Dựng rập tự động chân váy xòe từ 90° đến 360°, hỗ trợ nhún eo, chia mảnh cắt, bản lưng thẳng/cong 3.5 cm và nhảy size lồng nhau S-M-L-XL.",
  status: "active",
  schema: circleSkirtSchema,
  getDefaultParams: getCircleSkirtDefaults,
  generateGeometry: generateCircleSkirtGeometry,
  generateGrading: generateCircleSkirtGrading,
};

export const baggyJeanTemplate: PatternTemplate = {
  id: "baggy-jean",
  name: "Quần Jean Super Baggy (WV1499)",
  englishName: '9 1/2" Low Super Baggy Jean',
  category: "Quần Jean (Denim / Trousers)",
  version: "1.0.0",
  description:
    'Phom quần Jean 5 túi cạp trễ 9 1/2" ống rộng 25" chuẩn Tech Pack WV1499LSB-TD (CELLO / SH3790): đủ 8 mảnh rập (Thân trước, Thân sau, Cạp cong 1 5/8", Đô sau, Túi sau, Túi đồng hồ, Mo-guết, 5 Đỉa) và nhảy size chuẩn Nữ TCVN.',
  status: "active",
  schema: baggyJeanSchema,
  getDefaultParams: getBaggyJeanDefaults,
  generateGeometry: generateBaggyJeanGeometry,
  generateGrading: generateBaggyJeanGrading,
};

export const bomberJacketTemplate: PatternTemplate = {
  id: "bomber-jacket",
  name: "Áo khoác Bomber nỉ (89865)",
  englishName: "Bomber Fleece Jacket — Block LU9335",
  category: "Áo khoác (Jackets / Fleece)",
  version: "1.0.0",
  description:
    "Bộ rập áo khoác Bomber vải nỉ Polyester Fleece chuẩn BEARE & LEY / Mernda Primary (Style 89865 — Australian Size Standards): đủ 10 mảnh rập gồm Đáp nẹp kéo lên vai, Bo cổ/Bo gấu/Bo tay 1×1 (2 sọc Gold), Đáp gấu vuông và Túi cơi xéo 3 cm.",
  status: "active",
  schema: bomberJacketSchema,
  getDefaultParams: getBomberJacketDefaults,
  generateGeometry: generateBomberJacketGeometry,
  generateGrading: generateBomberJacketGrading,
};

export const colorblockPoloTemplate: PatternTemplate = {
  id: "colorblock-polo",
  name: "Áo Polo phối chéo (HAZE026)",
  englishName: "Colorblock Polo Shirt — HAZE026-028",
  category: "Áo Polo (Knitwear / Uniform)",
  version: "1.0.0",
  description:
    "Bộ rập áo Polo đồng phục phối màu chéo 4 mã vải chuẩn AFW (Style HAZE026-028): rã mảnh thân trước theo đúng sơ đồ cắt thực tế W-FRT1 (Trắng), B-FRT2 (Đen), C-FRT3 (Bạc), S-FRT4 (Xanh Đậm) + Thân sau, Tay ngắn, Trụ 2/3 nút & Lá cổ dệt.",
  status: "active",
  schema: colorblockPoloSchema,
  getDefaultParams: getColorblockPoloDefaults,
  generateGeometry: generateColorblockPoloGeometry,
  generateGrading: generateColorblockPoloGrading,
};

export interface TemplateCatalogItem {
  id: string;
  name: string;
  englishName: string;
  category: string;
  description: string;
  highlights: string[];
  status: "active" | "coming-soon";
  template?: PatternTemplate;
}

/**
 * Modular Template Plugin Registry.
 */
export const TEMPLATE_CATALOG: TemplateCatalogItem[] = [
  {
    id: circleSkirtTemplate.id,
    name: circleSkirtTemplate.name,
    englishName: circleSkirtTemplate.englishName,
    category: circleSkirtTemplate.category,
    description: circleSkirtTemplate.description,
    highlights: [
      "Góc xòe 90° – 360° & nhún eo ×1 / ×1.5 / ×2",
      "Bản lưng thẳng / cong 3.5 cm tự động",
      "Nhảy size lồng nhau S – M – L – XL",
    ],
    status: "active",
    template: circleSkirtTemplate,
  },
  {
    id: baggyJeanTemplate.id,
    name: baggyJeanTemplate.name,
    englishName: baggyJeanTemplate.englishName,
    category: baggyJeanTemplate.category,
    description: baggyJeanTemplate.description,
    highlights: [
      'Chuẩn PP Fit WV1499LSB-TD: Eo 31" • Mông 40.5" • Ống 25"',
      "Đủ 8 mảnh rập 5 túi + *Change Grainlines R&D",
      "Nhảy size theo bảng chuẩn Nữ & mô phỏng 3D 2 ống",
    ],
    status: "active",
    template: baggyJeanTemplate,
  },
  {
    id: bomberJacketTemplate.id,
    name: bomberJacketTemplate.name,
    englishName: bomberJacketTemplate.englishName,
    category: bomberJacketTemplate.category,
    description: bomberJacketTemplate.description,
    highlights: [
      "Chuẩn 89865 AU Spec (PPS 03.04.2025): Ngực 117 • Dài 73 cm",
      "Đủ 10 mảnh rập: Đáp nẹp lên vai 5 cm, Bo 1×1 2 sọc Gold, Cơi xéo",
      "Nạp nhanh size 4 / 8 / 14 / Adult M & Mô phỏng 3D áo khoác",
    ],
    status: "active",
    template: bomberJacketTemplate,
  },
  {
    id: colorblockPoloTemplate.id,
    name: colorblockPoloTemplate.name,
    englishName: colorblockPoloTemplate.englishName,
    category: colorblockPoloTemplate.category,
    description: colorblockPoloTemplate.description,
    highlights: [
      "Rã 4 mảnh chéo chuẩn .PLT: W-FRT1 / B-FRT2 / C-FRT3 / S-FRT4",
      "Quy cách trụ 3 cm: 2 nút (Size 4–16) / 3 nút (XS–3XL)",
      "Phân tách 4 màu vải (Dark Bottle / White / Black / Silver) + 3D",
    ],
    status: "active",
    template: colorblockPoloTemplate,
  },
  {
    id: "basic-shift-dress",
    name: "Đầm suông cơ bản",
    englishName: "Basic Shift Dress",
    category: "Đầm (Dresses)",
    description:
      "Phom đầm suông công sở có chiết ben ngực, vòng nách chuẩn công thức Bezier và tùy chọn tay ngắn/tay lỡ.",
    highlights: [
      "Ben ngực & ben eo tự động theo ngực – eo",
      "Tùy chọn cổ tròn / cổ V / cổ vuông",
      "Nhảy size chuẩn S – XXL",
    ],
    status: "coming-soon",
  },
  {
    id: "womens-shirt",
    name: "Áo sơ mi nữ",
    englishName: "Women's Tailored Shirt",
    category: "Áo (Tops & Shirts)",
    description:
      "Bộ rập áo sơ mi nữ đầy đủ thân trước, thân sau, đô vai, cổ đức 2 mảnh, măng sét và trụ tay.",
    highlights: [
      "Cổ sơ mi 2 mảnh (Collar & Stand)",
      "Tay áo 1 mảnh + nẹp trụ tay",
      "Tự động cộng cử động (Ease)",
    ],
    status: "coming-soon",
  },
];

export function getTemplateById(id: string): PatternTemplate {
  const found = TEMPLATE_CATALOG.find(
    (item) => item.id === id && item.template
  );
  return found?.template ?? circleSkirtTemplate;
}
