import type { PatternTemplate } from "@/lib/cad/types";
import {
  circleSkirtSchema,
  getCircleSkirtDefaults,
} from "./circle-skirt/schema";
import { generateCircleSkirtGeometry } from "./circle-skirt/geometry";
import { generateCircleSkirtGrading } from "./circle-skirt/grading";

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
 * Add new garment templates by dropping a folder under `src/templates/<template-id>/`
 * with `schema.ts`, `geometry.ts`, and `grading.ts`, then registering it here.
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
  {
    id: "womens-trousers",
    name: "Quần tây nữ",
    englishName: "Women's Tailored Trousers",
    category: "Quần (Trousers)",
    description:
      "Phom quần tây nữ ống đứng / ống suông với đường cong đáy tính chuẩn giải phẫu và túi chéo hai bên.",
    highlights: [
      "Đường cong đáy trước/sau tự cân bằng",
      "Tùy chỉnh độ rộng ống & hạ đáy",
      "Kèm lót túi chéo & đáp dây kéo",
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
