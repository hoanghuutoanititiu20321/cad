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
