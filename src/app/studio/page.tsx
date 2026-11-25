import type { Metadata } from "next";
import { CadStudio } from "@/components/studio/CadStudio";

export const metadata: Metadata = {
  title: "Phòng thiết kế CAD (Studio) — PatternCAD Pro",
  description:
    "Thiết kế rập tham số chân váy xòe 2D chuẩn xác 0.01mm, nhảy size lồng nhau S-M-L-XL và xuất file DXF sản xuất.",
};

export default function StudioPage() {
  return <CadStudio />;
}
