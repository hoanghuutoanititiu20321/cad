import React, { Suspense } from "react";
import type { Metadata } from "next";
import { StudioClientEntry } from "@/components/studio/StudioClientEntry";

export const metadata: Metadata = {
  title: "Phòng thiết kế CAD (Studio) — PatternCAD Pro",
  description:
    "Thiết kế rập tham số 2D/3D chuẩn xác 0.01mm (Chân váy xòe, Quần Jean Super Baggy WV1499LSB-TD), nhảy size S-M-L-XL, giác sơ đồ vải và xuất DXF AAMA.",
};

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-white text-xs text-slate-500">
          Đang khởi tạo Phòng thiết kế CAD...
        </div>
      }
    >
      <StudioClientEntry />
    </Suspense>
  );
}
