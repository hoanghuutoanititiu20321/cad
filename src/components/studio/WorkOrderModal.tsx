"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  ClipboardList,
  Download,
  Printer,
} from "lucide-react";
import { pathToSvgD, roundCm } from "@/lib/cad/math";
import type { NestedGradingResult, ParamValues, SizeCode } from "@/lib/cad/types";
import {
  computeWorkOrderDetails,
  type WorkOrderConfig,
} from "@/lib/cad/worksheet";
import { WAISTBAND_HEIGHT_CM } from "@/templates/circle-skirt/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WorkOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string;
  templateName: string;
  params: ParamValues;
  grading: NestedGradingResult;
}

const SIZES: SizeCode[] = ["S", "M", "L", "XL"];

export function WorkOrderModal({
  open,
  onOpenChange,
  templateId = "circle-skirt",
  templateName,
  params,
  grading,
}: WorkOrderModalProps) {
  const isJean = templateId === "baggy-jean";
  const isBomber = templateId === "bomber-jacket";
  const isPolo = templateId === "colorblock-polo";
  const isTopGarment = isBomber || isPolo;
  const sheetRef = useRef<HTMLDivElement>(null);

  const [config, setConfig] = useState<WorkOrderConfig>(() => ({
    styleCode: isJean
      ? "WV1499LSB-TD"
      : isBomber
        ? "89865-BOMBER"
        : isPolo
          ? "HAZE026-028"
          : "CVX-2026-01",
    workshopLine: isJean
      ? "Chuyền Jeans 02 — P.O. JC-0347"
      : isBomber
        ? "Chuyền Nỉ 03 — BEARE & LEY (Mernda Primary)"
        : isPolo
          ? "Xí Nghiệp May I — AFW (EM06082026A/B/C)"
          : "Chuyền May 01 — Tổ Mẫu",
    fabricInfo: isJean
      ? "SH3790 Denim (M Stone + Tint + Grinding)"
      : isBomber
        ? "Polyester Cotton Fleece Maroon + 1×1 Rib Maroon/2 Gold Stripes"
        : isPolo
          ? "LA65V Dark Bottle + Phối White, Black + Viền JC50 Silver 1102"
          : "Tuyết mưa / Cotton lạnh (Ít co giãn)",
    fabricWidthCm: isPolo ? 161 : 150,
    preparedBy: "Phòng Kỹ Thuật Rập",
    issueDate: "28/11/2026",
    sizeQuantities: { S: 10, M: 20, L: 15, XL: 5 },
    customNote: isJean
      ? "Chỉ may Golden Glo W32761 (T105 Topstitch, T60 Bartack, T40 Overlock). Nút 27L Anti-Copper (×1), Đinh tán 14L Brass (×3), Dây kéo 4 1/2\" Navy Tape."
      : isBomber
        ? "LƯU Ý QC PPS 03.04.2025: Đáp nẹp trước phải kéo lên đường vai con (5 cm). Lót túi PKB-01 phải kẹp đường may bo gấu và đính gài vào Đáp nẹp trong. Nút bấm 11mm DTM (×6). Thêu logo trường ngực trái."
        : isPolo
          ? "Tách 4 màu vải theo sơ đồ .PLT (Dark Bottle 161cm, White 161cm, Black 80.5cm, Silver 80.5cm, Keo 98cm). Quy cách trụ: Size 4–16 may 2 nút, Size XS–3XL may 3 nút. Gập lai áo & tay 2.5 cm trần đè."
          : "Mật độ mũi chỉ 4 mũi/cm. Chỉ may cùng màu vải chính. Ủi rẽ đường sườn êm phẳng trước khi đóng lưng.",
  }));

  const computed = useMemo(
    () => computeWorkOrderDetails(params, grading, config, templateId),
    [config, grading, params, templateId]
  );

  const baseEntry = useMemo(
    () =>
      grading.entries.find((e) => e.size === grading.baseSize) ??
      grading.entries[1],
    [grading.baseSize, grading.entries]
  );

  const bbox = grading.combinedBbox;
  const pad = Math.max(bbox.width, bbox.height) * 0.08 + 35;
  const viewBox = `${bbox.minX - pad} ${bbox.minY - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`;

  const buildPrintableHtmlDocument = (innerHtml: string, autoPrint: boolean) => `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Phieu-San-Xuat-${config.styleCode}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      margin: 0;
      padding: 0;
      font-family: Inter, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      font-size: 11px;
      line-height: 1.4;
    }
    .sheet { width: 100%; max-width: 190mm; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #CBD5E1; padding: 4px 6px; text-align: left; font-size: 10.5px; }
    th { background: #F1F5F9; font-weight: 700; color: #0F172A; }
    .num { text-align: right; font-family: "JetBrains Mono", Consolas, monospace; }
    .center { text-align: center; }
    .section-title {
      margin: 10px 0 5px;
      padding: 3px 8px;
      background: #EEF2FF;
      border-left: 3px solid #4F46E5;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #1E1B4B;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0F172A;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    .grid-2 { display: grid; grid-template-columns: 38% 62%; gap: 10px; align-items: start; }
    .sign-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
    .sign-box {
      border: 1px dashed #94A3B8;
      border-radius: 4px;
      padding: 6px;
      height: 68px;
      text-align: center;
      font-size: 10px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="sheet">${innerHtml}</div>
  ${autoPrint ? `<script>window.onload = function(){ setTimeout(function(){ window.focus(); window.print(); }, 180); };</script>` : ""}
</body>
</html>`;

  const handlePrintNow = () => {
    if (!sheetRef.current) return;
    const html = buildPrintableHtmlDocument(sheetRef.current.innerHTML, true);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 60000);
  };

  const handleDownloadHtmlSheet = () => {
    if (!sheetRef.current) return;
    const html = buildPrintableHtmlDocument(sheetRef.current.innerHTML, false);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `phieu-san-xuat-${config.styleCode.toLowerCase()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-[#4F46E5] border border-indigo-200">
                <ClipboardList className="size-4" />
              </span>
              <div>
                <DialogTitle>
                  Phiếu Giao Việc & Lệnh Sản Xuất Xưởng May (Bản in A4)
                </DialogTitle>
                <DialogDescription>
                  Tài liệu cầm tay cho Tổ Bàn Cắt, Công Nhân Chuyền May & QC Kiểm
                  Hàng — Đầy đủ thông số, định mức & quy trình may
                </DialogDescription>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadHtmlSheet}
              >
                <Download className="size-3.5" />
                Lưu file phiếu
              </Button>
              <Button size="sm" onClick={handlePrintNow}>
                <Printer className="size-3.5" />
                In ngay ra A4 (Ctrl+P)
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-12 max-h-[84vh] overflow-hidden">
          {/* LEFT: Quick Production Order Inputs */}
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-[#E2E8F0] bg-[#F8FAFC] p-4 overflow-y-auto space-y-4">
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Thông tin Lệnh sản xuất
              </h3>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px]">Mã hàng (Style Code)</Label>
                  <Input
                    value={config.styleCode}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, styleCode: e.target.value }))
                    }
                    className="h-8 bg-white font-mono text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Ngày giao việc</Label>
                  <Input
                    value={config.issueDate}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, issueDate: e.target.value }))
                    }
                    className="h-8 bg-white font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Tổ / Chuyền nhận việc</Label>
                <Input
                  value={config.workshopLine}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, workshopLine: e.target.value }))
                  }
                  className="h-8 bg-white text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label className="text-[11px]">Loại vải sử dụng</Label>
                  <Input
                    value={config.fabricInfo}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, fabricInfo: e.target.value }))
                    }
                    className="h-8 bg-white text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Khổ vải (cm)</Label>
                  <Input
                    type="number"
                    min={90}
                    max={220}
                    value={config.fabricWidthCm}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        fabricWidthCm: Number(e.target.value) || 150,
                      }))
                    }
                    className="h-8 bg-white font-mono text-xs text-right"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Kỹ thuật lập phiếu</Label>
                <Input
                  value={config.preparedBy}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, preparedBy: e.target.value }))
                  }
                  className="h-8 bg-white text-xs"
                />
              </div>
            </div>

            {/* Size Order Quantities */}
            <div className="space-y-2 border-t border-[#E2E8F0] pt-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  2. Số lượng cắt theo Size (Cái)
                </h3>
                <span className="font-mono text-xs font-bold text-[#4F46E5]">
                  Tổng: {computed.totalGarments} SP
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {SIZES.map((sz) => (
                  <div key={sz} className="space-y-1">
                    <Label className="block text-center font-mono text-[11px] font-bold">
                      Size {sz}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={9999}
                      value={config.sizeQuantities[sz]}
                      onChange={(e) => {
                        const val = Math.max(
                          0,
                          parseInt(e.target.value || "0", 10) || 0
                        );
                        setConfig((c) => ({
                          ...c,
                          sizeQuantities: { ...c.sizeQuantities, [sz]: val },
                        }));
                      }}
                      className="h-8 bg-white text-center font-mono text-xs font-semibold"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Note */}
            <div className="space-y-1.5 border-t border-[#E2E8F0] pt-3.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                3. Lưu ý riêng cho Tổ May / Ủi
              </Label>
              <textarea
                rows={3}
                value={config.customNote}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, customNote: e.target.value }))
                }
                className="w-full rounded-md border border-[#E2E8F0] bg-white p-2 text-xs text-[#0F172A] focus:border-[#4F46E5] focus:outline-none"
              />
            </div>

            <div className="pt-1 flex flex-col gap-2">
              <Button size="lg" onClick={handlePrintNow} className="w-full">
                <Printer className="size-4" />
                In ngay Phiếu Giao Việc (Khổ A4)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadHtmlSheet}
                className="w-full"
              >
                <Download className="size-3.5" />
                Tải file bản in (.HTML gửi Zalo/Email)
              </Button>
            </div>
          </div>

          {/* RIGHT: Live WYSIWYG A4 Printable Sheet Preview */}
          <div className="lg:col-span-8 bg-slate-200/70 p-4 sm:p-6 overflow-y-auto">
            <div
              ref={sheetRef}
              className="mx-auto max-w-[760px] rounded-lg border border-slate-300 bg-white p-6 shadow-lg text-[#0F172A] text-[11px] leading-snug"
            >
              {/* Document Header */}
              <div className="header-box flex items-start justify-between border-b-2 border-[#0F172A] pb-2.5 mb-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#4F46E5]">
                    PATTERNCAD PRO • TÀI LIỆU KỸ THUẬT XƯỞNG MAY
                  </div>
                  <h1 className="text-base font-extrabold uppercase tracking-tight text-[#0F172A] mt-0.5">
                    PHIẾU LỆNH SẢN XUẤT & HƯỚNG DẪN MAY
                  </h1>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Mẫu sản phẩm: <strong>{templateName}</strong> • Size gốc:{" "}
                    <strong>{grading.baseSize}</strong> • Chừa đường may:{" "}
                    <strong>{Number(params.seamAllowance ?? 1).toFixed(1)} cm</strong>
                  </p>
                </div>
                <div className="text-right font-mono text-[11px]">
                  <div className="inline-block rounded border border-[#0F172A] px-2 py-0.5 font-bold text-xs">
                    MÃ HÀNG: {config.styleCode}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-600">
                    Ngày lập: <strong>{config.issueDate}</strong>
                  </div>
                  <div className="text-[10px] text-slate-600">
                    Đơn vị nhận: <strong>{config.workshopLine}</strong>
                  </div>
                </div>
              </div>

              {/* Section 1: Order Quantities & 2D Schematic */}
              <div className="grid-2 grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                {/* 2D Pattern Diagram */}
                <div className="sm:col-span-5 rounded border border-slate-300 p-2 bg-white">
                  <div className="text-[10px] font-bold text-center uppercase text-slate-600 mb-1">
                    Sơ đồ chi tiết mảnh rập ({grading.entries[0].geometry.pieces.length} mảnh)
                  </div>
                  <div className="h-44 w-full">
                    <svg
                      viewBox={viewBox}
                      preserveAspectRatio="xMidYMid meet"
                      className="h-full w-full"
                    >
                      {baseEntry.geometry.pieces.map((piece) => (
                        <g key={piece.id}>
                          {piece.cutPaths.map((cp) => (
                            <path
                              key={cp.id}
                              d={pathToSvgD(cp)}
                              fill={piece.displayColor ?? "#EEF2FF"}
                              fillOpacity={piece.displayColor ? 0.2 : 1}
                              fillRule="evenodd"
                              stroke="#0F172A"
                              strokeWidth={1.6}
                              vectorEffect="non-scaling-stroke"
                            />
                          ))}
                          {piece.sewPaths.map((sp) => (
                            <path
                              key={sp.id}
                              d={pathToSvgD(sp)}
                              fill="none"
                              stroke="#4F46E5"
                              strokeWidth={1}
                              strokeDasharray="4 3"
                              vectorEffect="non-scaling-stroke"
                            />
                          ))}
                          <line
                            x1={piece.grainline.start.x}
                            y1={piece.grainline.start.y}
                            x2={piece.grainline.end.x}
                            y2={piece.grainline.end.y}
                            stroke="#0F766E"
                            strokeWidth={1.2}
                            vectorEffect="non-scaling-stroke"
                          />
                        </g>
                      ))}
                    </svg>
                  </div>
                  <div className="text-[9.5px] text-center text-slate-500 border-t border-slate-200 pt-1">
                    Nét liền: Đường cắt • Nét đứt: Đường may ({Number(params.seamAllowance ?? 1).toFixed(1)}cm)
                  </div>
                </div>

                {/* Order Breakdown & Material Summary */}
                <div className="sm:col-span-7 space-y-2">
                  <div className="text-[10.5px]">
                    <strong>Chất liệu vải:</strong> {config.fabricInfo} (Khổ{" "}
                    <strong>{config.fabricWidthCm} cm</strong>) •{" "}
                    <strong>Kỹ thuật:</strong> {config.preparedBy}
                  </div>

                  {/* Size Qty Table */}
                  <table className="w-full border-collapse text-[10.5px]">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-300 px-2 py-1">
                          Cỡ (Size)
                        </th>
                        {SIZES.map((sz) => (
                          <th
                            key={sz}
                            className="center border border-slate-300 px-2 py-1 text-center"
                          >
                            {sz}
                          </th>
                        ))}
                        <th className="num border border-slate-300 px-2 py-1 text-right">
                          TỔNG CỘNG
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-300 px-2 py-1 font-semibold">
                          Số lượng SP
                        </td>
                        {SIZES.map((sz) => (
                          <td
                            key={sz}
                            className="center border border-slate-300 px-2 py-1 text-center font-mono font-bold"
                          >
                            {config.sizeQuantities[sz] || 0}
                          </td>
                        ))}
                        <td className="num border border-slate-300 px-2 py-1 text-right font-mono font-extrabold text-[#4F46E5]">
                          {computed.totalGarments} cái
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Semi-finished Cutting & Trims Table */}
                  <table className="w-full border-collapse text-[10.5px]">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-300 px-2 py-1">
                          Mã mảnh / Vật tư
                        </th>
                        <th className="border border-slate-300 px-2 py-1">
                          Chi tiết cắt & Phụ liệu
                        </th>
                        <th className="center border border-slate-300 px-2 py-1 text-center">
                          Định mức/SP
                        </th>
                        <th className="num border border-slate-300 px-2 py-1 text-right">
                          Tổng xuất/cắt
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {baseEntry.geometry.pieces.map((pc) => (
                        <tr key={pc.id}>
                          <td className="border border-slate-300 px-2 py-1 font-mono font-bold">
                            {pc.code}
                          </td>
                          <td className="border border-slate-300 px-2 py-1">
                            {pc.name} ({pc.englishName})
                          </td>
                          <td className="center border border-slate-300 px-2 py-1 text-center font-mono">
                            ×{pc.cutQuantity}
                          </td>
                          <td className="num border border-slate-300 px-2 py-1 text-right font-mono font-semibold">
                            {computed.totalGarments * pc.cutQuantity} lá
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td className="border border-slate-300 px-2 py-1 font-mono">
                          PHU-LIEU
                        </td>
                        <td className="border border-slate-300 px-2 py-1">
                          {isJean
                            ? 'Dây kéo 4 1/2" Navy + 1 Nút 27L Copper + 3 Đinh tán 14L Brass'
                            : isBomber
                              ? "6 Nút bấm 11mm DTM + Nhãn BEARE & LEY + Size pip + Keo nẹp"
                              : isPolo
                                ? "2–3 Nút trụ Polo + Keo ép trụ HAZE026-KEO + Dây xương cá cổ"
                                : "Dây kéo giọt nước 18 cm + Keo ép lưng + Móc lưng"}
                        </td>
                        <td className="center border border-slate-300 px-2 py-1 text-center font-mono">
                          1 bộ
                        </td>
                        <td className="num border border-slate-300 px-2 py-1 text-right font-mono">
                          {isBomber || isPolo
                            ? `${computed.totalGarments} bộ`
                            : `${computed.totalZippers} bộ`}
                        </td>
                      </tr>
                      <tr className="bg-indigo-50/60">
                        <td
                          colSpan={3}
                          className="border border-slate-300 px-2 py-1 font-bold"
                        >
                          Tổng vải chính dự kiến (đã cộng ~14% hao hụt sơ đồ):
                        </td>
                        <td className="num border border-slate-300 px-2 py-1 text-right font-mono font-bold text-[#4F46E5]">
                          ≈ {computed.estimatedFabricMeters} m
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 2: Finished Garment Spec & QC Tolerance Table */}
              <div className="section-title mt-3.5 mb-1.5 bg-indigo-50 border-l-3 border-[#4F46E5] px-2 py-1 text-[10.5px] font-bold uppercase text-indigo-950">
                II. Bảng Thông Số Thành Phẩm & Kiểm Hàng QC (Đơn vị: cm)
              </div>
              <table className="w-full border-collapse text-[10.5px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-2 py-1">
                      Vị trí đo kiểm (Measurement Point)
                    </th>
                    {grading.entries.map((e) => (
                      <th
                        key={e.size}
                        className="num border border-slate-300 px-2 py-1 text-right"
                      >
                        Size {e.size} {e.isBase ? "(Gốc)" : ""}
                      </th>
                    ))}
                    <th className="center border border-slate-300 px-2 py-1 text-center">
                      Dung sai QC
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isJean ? (
                    <>
                      <tr>
                        <td className="border border-slate-300 px-2 py-1 font-semibold">
                          1. Vòng eo đỉnh cạp (Waist @Top)
                        </td>
                        {grading.entries.map((e) => (
                          <td key={e.size} className="num border border-slate-300 px-2 py-1 text-right font-mono font-bold">
                            {e.measurements.waistCm.toFixed(1)}
                          </td>
                        ))}
                        <td className="center border border-slate-300 px-2 py-1 text-center font-mono">±1.2 cm (1/2&quot;)</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-2 py-1 font-semibold">
                          2. Vòng mông (Hip 3&quot; above crotch)
                        </td>
                        {grading.entries.map((e) => (
                          <td key={e.size} className="num border border-slate-300 px-2 py-1 text-right font-mono font-semibold">
                            {(e.measurements.hipCm ?? 0).toFixed(1)}
                          </td>
                        ))}
                        <td className="center border border-slate-300 px-2 py-1 text-center font-mono">±1.2 cm (1/2&quot;)</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-2 py-1">
                          3. Vòng đùi dưới đáy 1&quot; (Thigh)
                        </td>
                        {grading.entries.map((e) => (
                          <td key={e.size} className="num border border-slate-300 px-2 py-1 text-right font-mono">
                            {(e.measurements.thighCm ?? 0).toFixed(1)}
                          </td>
                        ))}
                        <td className="center border border-slate-300 px-2 py-1 text-center font-mono">±0.6 cm (1/4&quot;)</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-2 py-1">
                          4. Vòng gối 13&quot; / Vòng ống lai (Knee / Opening)
                        </td>
                        {grading.entries.map((e) => (
                          <td key={e.size} className="num border border-slate-300 px-2 py-1 text-right font-mono">
                            {(e.measurements.kneeCm ?? 0).toFixed(1)} / {(e.measurements.hemOpeningCm ?? 0).toFixed(1)}
                          </td>
                        ))}
                        <td className="center border border-slate-300 px-2 py-1 text-center font-mono">±0.6 / ±0.3 cm</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-2 py-1">
                          5. Dài trong (Inseam) • Đáy T/S (F/B Rise)
                        </td>
                        {grading.entries.map((e) => (
                          <td key={e.size} className="num border border-slate-300 px-2 py-1 text-right font-mono text-[10px]">
                            {(e.measurements.inseamCm ?? 0).toFixed(1)} • {(e.measurements.frontRiseCm ?? 0).toFixed(1)}/{(e.measurements.backRiseCm ?? 0).toFixed(1)}
                          </td>
                        ))}
                        <td className="center border border-slate-300 px-2 py-1 text-center font-mono text-[10px]">±1.2 / ±0.6 cm</td>
                      </tr>
                    </>
                  ) : isTopGarment ? (
                    <>
                      <tr>
                        <td className="border border-slate-300 px-2 py-1 font-semibold">
                          1. Vòng ngực thành phẩm (Chest Circ.)
                        </td>
                        {grading.entries.map((e) => (
                          <td key={e.size} className="num border border-slate-300 px-2 py-1 text-right font-mono font-bold">
                            {(e.measurements.chestCm ?? 0).toFixed(1)}
                          </td>
                        ))}
                        <td className="center border border-slate-300 px-2 py-1 text-center font-mono">±1.0 cm</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-2 py-1 font-semibold">
                          2. Ngang vai (Shoulder Width)
                        </td>
                        {grading.entries.map((e) => (
                          <td key={e.size} className="num border border-slate-300 px-2 py-1 text-right font-mono font-semibold">
                            {(e.measurements.shoulderCm ?? 0).toFixed(1)}
                          </td>
                        ))}
                        <td className="center border border-slate-300 px-2 py-1 text-center font-mono">±0.5 cm</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-2 py-1">
                          3. {isBomber ? "Dài áo từ HSP gồm bo (Front Length)" : "Dài áo giữa sau (Center Back Length)"}
                        </td>
                        {grading.entries.map((e) => (
                          <td key={e.size} className="num border border-slate-300 px-2 py-1 text-right font-mono font-semibold">
                            {(e.measurements.bodyLengthCm ?? 0).toFixed(1)}
                          </td>
                        ))}
                        <td className="center border border-slate-300 px-2 py-1 text-center font-mono">±1.0 cm</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-2 py-1">
                          4. 1/2 Vòng nách cong (1/2 Armhole) • Rộng cổ (Neck)
                        </td>
                        {grading.entries.map((e) => (
                          <td key={e.size} className="num border border-slate-300 px-2 py-1 text-right font-mono">
                            {(e.measurements.armholeHalfCm ?? 0).toFixed(1)} • {(e.measurements.neckWidthCm ?? 0).toFixed(1)}
                          </td>
                        ))}
                        <td className="center border border-slate-300 px-2 py-1 text-center font-mono">±0.5 cm</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-2 py-1">
                          5. Dài tay (Sleeve Length) • 1/2 Cửa tay (Opening)
                        </td>
                        {grading.entries.map((e) => (
                          <td key={e.size} className="num border border-slate-300 px-2 py-1 text-right font-mono">
                            {(e.measurements.sleeveLengthCm ?? 0).toFixed(1)} • {(e.measurements.sleeveOpeningHalfCm ?? 0).toFixed(1)}
                          </td>
                        ))}
                        <td className="center border border-slate-300 px-2 py-1 text-center font-mono">±0.5 cm</td>
                      </tr>
                      {isBomber && (
                        <tr>
                          <td className="border border-slate-300 px-2 py-1">
                            6. 1/2 Bo gấu tự nhiên (Rib Hem Half)
                          </td>
                          {grading.entries.map((e) => (
                            <td key={e.size} className="num border border-slate-300 px-2 py-1 text-right font-mono">
                              {(e.measurements.ribHemHalfCm ?? 0).toFixed(1)}
                            </td>
                          ))}
                          <td className="center border border-slate-300 px-2 py-1 text-center font-mono">±0.5 cm</td>
                        </tr>
                      )}
                    </>
                  ) : (
                    <>
                      <tr>
                        <td className="border border-slate-300 px-2 py-1 font-semibold">
                          1. Vòng eo thành phẩm (Finished Waist)
                        </td>
                        {grading.entries.map((e) => (
                          <td
                            key={e.size}
                            className="num border border-slate-300 px-2 py-1 text-right font-mono font-bold"
                          >
                            {e.measurements.waistCm.toFixed(1)}
                          </td>
                        ))}
                        <td className="center border border-slate-300 px-2 py-1 text-center font-mono">
                          ±0.5 cm
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-2 py-1">
                          2. Dài tùng váy dưới chân lưng (Skirt Length)
                        </td>
                        {grading.entries.map((e) => (
                          <td
                            key={e.size}
                            className="num border border-slate-300 px-2 py-1 text-right font-mono font-semibold"
                          >
                            {e.measurements.skirtLengthCm.toFixed(1)}
                          </td>
                        ))}
                        <td className="center border border-slate-300 px-2 py-1 text-center font-mono">
                          ±0.8 cm
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-2 py-1">
                          3. Bản rộng lưng thành phẩm (Waistband Height)
                        </td>
                        {grading.entries.map((e) => (
                          <td
                            key={e.size}
                            className="num border border-slate-300 px-2 py-1 text-right font-mono"
                          >
                            {WAISTBAND_HEIGHT_CM.toFixed(1)}
                          </td>
                        ))}
                        <td className="center border border-slate-300 px-2 py-1 text-center font-mono">
                          ±0.2 cm
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-2 py-1 text-slate-600">
                          4. Bán kính cắt eo / lai tham chiếu (R_eo / R_lai)
                        </td>
                        {grading.entries.map((e) => (
                          <td
                            key={e.size}
                            className="num border border-slate-300 px-2 py-1 text-right font-mono text-[10px] text-slate-600"
                          >
                            {roundCm(e.measurements.rWaistCm, 1)} /{" "}
                            {roundCm(e.measurements.rHemCm, 1)}
                          </td>
                        ))}
                        <td className="center border border-slate-300 px-2 py-1 text-center font-mono text-[10px]">
                          ±0.2 cm
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>

              {/* Section 3: Step-by-Step Sewing Operations */}
              <div className="section-title mt-3.5 mb-1.5 bg-indigo-50 border-l-3 border-[#4F46E5] px-2 py-1 text-[10.5px] font-bold uppercase text-indigo-950">
                III. Quy Trình May Lắp Ráp Chuyền (Sewing Operations)
              </div>
              <table className="w-full border-collapse text-[10.5px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="center border border-slate-300 px-1.5 py-1 text-center w-9">
                      Bước
                    </th>
                    <th className="border border-slate-300 px-2 py-1 w-28">
                      Công đoạn
                    </th>
                    <th className="border border-slate-300 px-2 py-1">
                      Nội dung thao tác kỹ thuật
                    </th>
                    <th className="border border-slate-300 px-2 py-1 w-32">
                      Thiết bị / Cữ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {computed.sewingSteps.map((st) => (
                    <tr key={st.stepNo}>
                      <td className="center border border-slate-300 px-1.5 py-1 text-center font-mono font-bold">
                        {st.stepNo}
                      </td>
                      <td className="border border-slate-300 px-2 py-1 font-semibold">
                        {st.department}
                      </td>
                      <td className="border border-slate-300 px-2 py-1">
                        {st.instruction}
                      </td>
                      <td className="border border-slate-300 px-2 py-1 text-[10px] text-slate-600">
                        {st.machineType}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {config.customNote.trim() && (
                <div className="mt-2 rounded border border-amber-300 bg-amber-50/70 px-2.5 py-1.5 text-[10.5px]">
                  <strong>Lưu ý kỹ thuật & Chất lượng:</strong> {config.customNote}
                </div>
              )}

              {/* Section 4: 4-Department Sign-Off */}
              <div className="sign-grid grid grid-cols-4 gap-2.5 mt-3.5">
                {[
                  "KỸ THUẬT RẬP",
                  "TỔ TRƯỞNG BÀN CẮT",
                  "TỔ TRƯỞNG CHUYỀN MAY",
                  "QC KIỂM HÀNG",
                ].map((role) => (
                  <div
                    key={role}
                    className="sign-box rounded border border-dashed border-slate-400 p-1.5 h-16 text-center text-[10px] font-bold text-slate-700"
                  >
                    <div>{role}</div>
                    <div className="text-[9px] font-normal text-slate-400 mt-0.5">
                      (Ký & ghi rõ họ tên)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
