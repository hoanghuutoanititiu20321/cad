"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCode2,
  Loader2,
  Printer,
  Scissors,
} from "lucide-react";
import {
  generateFullScaleMarkerPdf,
  generateMarkerDxf,
  generateMarkerNesting,
  type MarkerSettings,
  type RotationPolicy,
} from "@/lib/cad/marker";
import { roundCm } from "@/lib/cad/math";
import type { NestedGradingResult, Point2D, SizeCode } from "@/lib/cad/types";
import { cn } from "@/lib/utils";
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

interface MarkerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  grading: NestedGradingResult;
}

const SIZES: SizeCode[] = ["S", "M", "L", "XL"];
const FABRIC_WIDTH_PRESETS = [115, 145, 148, 150, 160];

function polyToSvgPoints(poly: Point2D[]): string {
  return poly.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

export function MarkerModal({
  open,
  onOpenChange,
  templateName,
  grading,
}: MarkerModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [styleCode, setStyleCode] = useState("CVX-2026-01");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [settings, setSettings] = useState<MarkerSettings>({
    fabricWidthCm: 150,
    selvedgeMarginCm: 1.5,
    pieceBufferMm: 4,
    sizeRatio: { S: 1, M: 1, L: 1, XL: 1 },
    fabricPlies: 20,
    rotationPolicy: "smart-fit",
  });

  // Compute True-Shape Nested Marker Layout in real time!
  const marker = useMemo(
    () => generateMarkerNesting(grading, settings),
    [grading, settings]
  );

  // Ruler ticks every 25 cm (250 mm) along marker length
  const lengthTicksMm = useMemo(() => {
    const step = marker.markerLengthMm > 4000 ? 500 : 250;
    const ticks: number[] = [];
    for (let x = 0; x <= marker.markerLengthMm; x += step) {
      ticks.push(x);
    }
    return ticks;
  }, [marker.markerLengthMm]);

  const handlePrintMiniMarkerA4 = () => {
    if (!printAreaRef.current) return;
    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Ban-Giac-So-Do-${styleCode}</title>
  <style>
    @page { size: A4 landscape; margin: 9mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      margin: 0;
      padding: 0;
      font-family: Inter, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      font-size: 11px;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #CBD5E1; padding: 4px 6px; text-align: left; font-size: 10px; }
    th { background: #F1F5F9; font-weight: 700; }
    .kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 8px 0; }
    .kpi-card { border: 1px solid #CBD5E1; border-radius: 6px; padding: 6px 8px; background: #F8FAFC; }
    .kpi-val { font-family: Consolas, monospace; font-size: 14px; font-weight: 800; color: #0F172A; }
    .sign-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px; }
    .sign-cell { border: 1px dashed #94A3B8; border-radius: 4px; height: 52px; padding: 4px; text-align: center; font-size: 9.5px; font-weight: 700; }
  </style>
</head>
<body>
  ${printAreaRef.current.innerHTML}
  <script>window.onload = function(){ setTimeout(function(){ window.focus(); window.print(); }, 180); };</script>
</body>
</html>`;

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
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 60000);
  };

  const handleDownloadPlotterPdf1To1 = async () => {
    setIsGeneratingPdf(true);
    try {
      const { bytes, filename } = await generateFullScaleMarkerPdf(
        marker,
        templateName,
        styleCode
      );
      const blob = new Blob([new Uint8Array(bytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadMarkerDxf = () => {
    const { content, filename } = generateMarkerDxf(marker, styleCode);
    const blob = new Blob([content], { type: "application/dxf;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const rulerH = 26;
  const svgViewW = marker.markerLengthMm + 40;
  const svgViewH = marker.fabricWidthMm + rulerH + 20;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-[#4F46E5] border border-indigo-200">
                <Scissors className="size-4" />
              </span>
              <div>
                <DialogTitle>
                  Giác Sơ Đồ Tự Động & Tối Ưu Khổ Vải (Automated Marker Nesting)
                </DialogTitle>
                <DialogDescription>
                  Xếp khít khìn khịt
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadMarkerDxf}
              >
                <FileCode2 className="size-3.5 text-[#4F46E5]" />
                DXF Sơ đồ 1:1
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPlotterPdf1To1}
                disabled={isGeneratingPdf}
              >
                {isGeneratingPdf ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5 text-[#4F46E5]" />
                )}
                PDF Sơ đồ 1:1 (Plotter)
              </Button>
              <Button size="sm" onClick={handlePrintMiniMarkerA4}>
                <Printer className="size-3.5" />
                In Bản Giác A4 (Bàn cắt)
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-12 max-h-[84vh] overflow-hidden">
          {/* LEFT SIDEBAR: Fabric Roll, Ratio & Nesting Rules */}
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-[#E2E8F0] bg-[#F8FAFC] p-4 overflow-y-auto space-y-4">
            {/* Style & Fabric Width */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Khổ vải & Thông số bàn cắt
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px]">Mã bàn cắt / Mã hàng</Label>
                  <Input
                    value={styleCode}
                    onChange={(e) => setStyleCode(e.target.value)}
                    className="h-8 bg-white font-mono text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Số lớp vải trải (Lớp)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={settings.fabricPlies}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        fabricPlies: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                    className="h-8 bg-white font-mono text-xs text-right font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">Khổ vải nguyên cây (cm)</Label>
                  <span className="font-mono text-[10px] text-slate-500">
                    Hữu dụng: {roundCm(marker.usableWidthMm / 10, 1)} cm
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {FABRIC_WIDTH_PRESETS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() =>
                        setSettings((s) => ({ ...s, fabricWidthCm: w }))
                      }
                      className={cn(
                        "flex-1 rounded-md border py-1 font-mono text-[11px] font-semibold transition-colors cursor-pointer",
                        settings.fabricWidthCm === w
                          ? "border-[#4F46E5] bg-indigo-50 text-[#4F46E5]"
                          : "border-[#E2E8F0] bg-white text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {w}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500">
                      Trừ biên kim mỗi bên (cm)
                    </Label>
                    <Input
                      type="number"
                      step={0.5}
                      min={0}
                      max={5}
                      value={settings.selvedgeMarginCm}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          selvedgeMarginCm: Math.max(
                            0,
                            parseFloat(e.target.value) || 0
                          ),
                        }))
                      }
                      className="h-7 bg-white font-mono text-xs text-right"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500">
                      Khe dao cắt giữa mảnh (mm)
                    </Label>
                    <Input
                      type="number"
                      step={1}
                      min={0}
                      max={15}
                      value={settings.pieceBufferMm}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          pieceBufferMm: Math.max(
                            0,
                            parseFloat(e.target.value) || 0
                          ),
                        }))
                      }
                      className="h-7 bg-white font-mono text-xs text-right"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Marker Size Ratio */}
            <div className="space-y-2 border-t border-[#E2E8F0] pt-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  2. Tỉ lệ ghép Size / 1 bàn (Ratio)
                </h3>
                <span className="font-mono text-[11px] font-bold text-[#4F46E5]">
                  {marker.garmentsPerLay} SP / lớp ({marker.placedPieces.length} mảnh)
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {SIZES.map((sz) => (
                  <div key={sz} className="space-y-1">
                    <Label className="block text-center font-mono text-[11px] font-bold">
                      {sz}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={6}
                      value={settings.sizeRatio[sz]}
                      onChange={(e) => {
                        const val = Math.min(
                          6,
                          Math.max(0, parseInt(e.target.value || "0", 10) || 0)
                        );
                        setSettings((s) => ({
                          ...s,
                          sizeRatio: { ...s.sizeRatio, [sz]: val },
                        }));
                      }}
                      className="h-8 bg-white text-center font-mono text-xs font-bold"
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() =>
                    setSettings((s) => ({
                      ...s,
                      sizeRatio: { S: 1, M: 1, L: 1, XL: 1 },
                    }))
                  }
                  className="rounded border border-[#E2E8F0] bg-white px-2 py-0.5 font-medium text-slate-600 hover:text-[#4F46E5] cursor-pointer"
                >
                  Tỉ lệ 1-1-1-1
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((s) => ({
                      ...s,
                      sizeRatio: { S: 1, M: 2, L: 2, XL: 1 },
                    }))
                  }
                  className="rounded border border-[#E2E8F0] bg-white px-2 py-0.5 font-medium text-slate-600 hover:text-[#4F46E5] cursor-pointer"
                >
                  Tỉ lệ 1-2-2-1
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((s) => ({
                      ...s,
                      sizeRatio: {
                        S: grading.baseSize === "S" ? 2 : 0,
                        M: grading.baseSize === "M" ? 2 : 0,
                        L: grading.baseSize === "L" ? 2 : 0,
                        XL: grading.baseSize === "XL" ? 2 : 0,
                      },
                    }))
                  }
                  className="rounded border border-[#E2E8F0] bg-white px-2 py-0.5 font-medium text-slate-600 hover:text-[#4F46E5] cursor-pointer"
                >
                  Chỉ 2 SP Size {grading.baseSize}
                </button>
              </div>
            </div>

            {/* Grainline Rotation Policy */}
            <div className="space-y-2 border-t border-[#E2E8F0] pt-3.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                3. Quy tắc xoay & Chống tràn khổ vải
              </h3>
              <div className="space-y-1.5">
                {(
                  [
                    {
                      id: "smart-fit",
                      title: "Tối ưu chống tràn thông minh (Khuyên dùng)",
                      desc: "Đảo 0°/180° + Tự xoay ngang 90°/270° cài so le trên-dưới nếu mảnh rộng hơn khổ vải",
                    },
                    {
                      id: "two-way-180",
                      title: "Đảo đầu 0° / 180° theo canh dọc",
                      desc: "Ưu tiên giữ canh dọc, tự xoay/tách đôi nếu vượt khổ vải",
                    },
                    {
                      id: "nap-one-way",
                      title: "Một chiều duy nhất (Vải tuyết / Hoa 1 chiều)",
                      desc: "Giữ tất cả các mảnh cùng 1 hướng chiều tuyết vải",
                    },
                  ] as Array<{ id: RotationPolicy; title: string; desc: string }>
                ).map((opt) => {
                  const active = settings.rotationPolicy === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setSettings((s) => ({ ...s, rotationPolicy: opt.id }))
                      }
                      className={cn(
                        "w-full rounded-lg border px-2.5 py-2 text-left transition-all cursor-pointer",
                        active
                          ? "border-[#4F46E5] bg-indigo-50/70 ring-1 ring-[#4F46E5]/20"
                          : "border-[#E2E8F0] bg-white hover:bg-slate-50"
                      )}
                    >
                      <div
                        className={cn(
                          "text-[11px] font-semibold",
                          active ? "text-[#4F46E5]" : "text-[#0F172A]"
                        )}
                      >
                        {opt.title}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {opt.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {marker.optimizationNotes.length > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-2.5 text-[11px] text-emerald-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                  Tự động tối ưu chống tràn khổ
                </div>
                {marker.optimizationNotes.map((note, idx) => (
                  <p key={idx} className="text-[10.5px] leading-snug">
                    {note}
                  </p>
                ))}
              </div>
            )}

            {marker.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  Cảnh báo khổ vải
                </div>
                {marker.warnings.map((w, idx) => (
                  <p key={idx} className="text-[10.5px]">
                    {w}
                  </p>
                ))}
              </div>
            )}

            {/* Quick Action Buttons */}
            <div className="space-y-2 border-t border-[#E2E8F0] pt-3">
              <Button
                size="lg"
                onClick={handlePrintMiniMarkerA4}
                className="w-full"
              >
                <Printer className="size-4" />
                In Bản Giác Sơ Đồ A4 (Bàn cắt)
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPlotterPdf1To1}
                  disabled={isGeneratingPdf}
                >
                  <Download className="size-3.5" />
                  PDF Sơ đồ 1:1
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadMarkerDxf}
                >
                  <FileCode2 className="size-3.5" />
                  DXF Sơ đồ 1:1
                </Button>
              </div>
            </div>
          </div>

          {/* RIGHT AREA: Live Marker Visualization & Printable Job Sheet */}
          <div className="lg:col-span-8 bg-slate-100 p-4 sm:p-5 overflow-y-auto">
            <div
              ref={printAreaRef}
              className="mx-auto rounded-xl border border-slate-300 bg-white p-5 shadow-sm space-y-3"
            >
              {/* Printable Header */}
              <div className="flex flex-wrap items-start justify-between gap-2 border-b-2 border-[#0F172A] pb-2.5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#4F46E5]">
                    PATTERNCAD PRO • PHIẾU SƠ ĐỒ GIÁC MẪU & LỆNH TRẢI VẢI BÀN CẮT
                  </div>
                  <h2 className="text-base font-extrabold uppercase text-[#0F172A]">
                    BẢN GIÁC SƠ ĐỒ TỐI ƯU KHỔ VẢI — MÃ: {styleCode}
                  </h2>
                  <p className="text-[11px] text-slate-600">
                    Sản phẩm: <strong>{templateName}</strong> • Tỉ lệ ghép size:{" "}
                    <strong>
                      {SIZES.filter((s) => settings.sizeRatio[s] > 0)
                        .map((s) => `${s}:${settings.sizeRatio[s]}`)
                        .join(" / ")}
                    </strong>
                  </p>
                </div>

                <div className="text-right font-mono text-[11px]">
                  <div className="rounded bg-emerald-50 border border-emerald-300 px-2.5 py-1 text-xs font-extrabold text-emerald-800">
                    HIỆU SUẤT VẢI: {marker.efficiencyPct}% (Hao hụt {marker.wastePct}%)
                  </div>
                </div>
              </div>

              {/* 5 Key Cutting-Room Metrics */}
              <div className="kpi-row grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="kpi-card rounded-lg border border-[#E2E8F0] bg-slate-50 px-3 py-2">
                  <div className="text-[10px] text-slate-500">Khổ vải cắt</div>
                  <div className="kpi-val font-mono text-sm font-bold text-[#0F172A]">
                    {settings.fabricWidthCm} cm
                  </div>
                  <div className="text-[9.5px] text-slate-400">
                    Rộng rập: {roundCm(marker.usableWidthMm / 10, 1)} cm
                  </div>
                </div>

                <div className="kpi-card rounded-lg border border-[#E2E8F0] bg-slate-50 px-3 py-2">
                  <div className="text-[10px] text-slate-500">
                    Dài sơ đồ (1 lớp)
                  </div>
                  <div className="kpi-val font-mono text-sm font-bold text-[#4F46E5]">
                    {(marker.markerLengthMm / 1000).toFixed(2)} m
                  </div>
                  <div className="text-[9.5px] text-slate-400">
                    ({roundCm(marker.markerLengthMm / 10, 1)} cm)
                  </div>
                </div>

                <div className="kpi-card rounded-lg border border-[#E2E8F0] bg-slate-50 px-3 py-2">
                  <div className="text-[10px] text-slate-500">
                    Định mức TB / 1 SP
                  </div>
                  <div className="kpi-val font-mono text-sm font-bold text-[#0F172A]">
                    {marker.metersPerGarment.toFixed(2)} m/cái
                  </div>
                  <div className="text-[9.5px] text-slate-400">
                    {marker.placedPieces.length} mảnh / lớp
                  </div>
                </div>

                <div className="kpi-card rounded-lg border border-[#E2E8F0] bg-slate-50 px-3 py-2">
                  <div className="text-[10px] text-slate-500">
                    Tổng sản lượng cắt
                  </div>
                  <div className="kpi-val font-mono text-sm font-bold text-[#0F172A]">
                    {marker.totalGarmentsCut} cái
                  </div>
                  <div className="text-[9.5px] text-slate-400">
                    ({settings.fabricPlies} lớp × {marker.garmentsPerLay} SP)
                  </div>
                </div>

                <div className="kpi-card rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2">
                  <div className="text-[10px] font-semibold text-indigo-900">
                    Tổng vải xuất kho
                  </div>
                  <div className="kpi-val font-mono text-sm font-extrabold text-[#4F46E5]">
                    {marker.totalFabricMeters.toFixed(2)} m
                  </div>
                  <div className="text-[9.5px] text-indigo-700/80">
                    Đã cộng 2cm đầu bàn/lớp
                  </div>
                </div>
              </div>

              {/* VISUAL 2D NESTED MARKER DIAGRAM */}
              <div className="rounded-lg border border-slate-300 bg-white p-2 overflow-x-auto">
                <svg
                  viewBox={`-20 -${rulerH} ${svgViewW} ${svgViewH}`}
                  className="w-full h-auto min-h-[230px] max-h-[340px]"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Top Metric Length Ruler (along fabric warp X) */}
                  <line
                    x1={0}
                    y1={-6}
                    x2={marker.markerLengthMm}
                    y2={-6}
                    stroke="#64748B"
                    strokeWidth={1.2}
                    vectorEffect="non-scaling-stroke"
                  />
                  {lengthTicksMm.map((xMm) => (
                    <g key={xMm}>
                      <line
                        x1={xMm}
                        y1={-13}
                        x2={xMm}
                        y2={0}
                        stroke="#475569"
                        strokeWidth={1}
                        vectorEffect="non-scaling-stroke"
                      />
                      <text
                        x={xMm + 4}
                        y={-10}
                        fontSize={Math.max(22, marker.markerLengthMm * 0.014)}
                        fontFamily="monospace"
                        fontWeight="700"
                        fill="#334155"
                      >
                        {(xMm / 1000).toFixed(2)}m
                      </text>
                    </g>
                  ))}

                  {/* Fabric Roll Sheet Background */}
                  <rect
                    x={0}
                    y={0}
                    width={marker.markerLengthMm}
                    height={marker.fabricWidthMm}
                    fill="#F8FAFC"
                    stroke="#0F172A"
                    strokeWidth={1.8}
                    vectorEffect="non-scaling-stroke"
                  />

                  {/* Top & Bottom Selvedge Strip Shading */}
                  {marker.selvedgeMm > 0 && (
                    <>
                      <rect
                        x={0}
                        y={0}
                        width={marker.markerLengthMm}
                        height={marker.selvedgeMm}
                        fill="#E2E8F0"
                        fillOpacity={0.55}
                      />
                      <line
                        x1={0}
                        y1={marker.selvedgeMm}
                        x2={marker.markerLengthMm}
                        y2={marker.selvedgeMm}
                        stroke="#94A3B8"
                        strokeWidth={1}
                        strokeDasharray="6 4"
                        vectorEffect="non-scaling-stroke"
                      />
                      <rect
                        x={0}
                        y={marker.fabricWidthMm - marker.selvedgeMm}
                        width={marker.markerLengthMm}
                        height={marker.selvedgeMm}
                        fill="#E2E8F0"
                        fillOpacity={0.55}
                      />
                      <line
                        x1={0}
                        y1={marker.fabricWidthMm - marker.selvedgeMm}
                        x2={marker.markerLengthMm}
                        y2={marker.fabricWidthMm - marker.selvedgeMm}
                        stroke="#94A3B8"
                        strokeWidth={1}
                        strokeDasharray="6 4"
                        vectorEffect="non-scaling-stroke"
                      />
                    </>
                  )}

                  {/* Nested True-Shape Pieces */}
                  {marker.placedPieces.map((p) => {
                    const dPath = p.cutPolygons
                      .map(
                        (poly) =>
                          `M ${polyToSvgPoints(poly).replace(/ /g, " L ")} Z`
                      )
                      .join(" ");
                    const sewD = p.sewPolygons
                      .map(
                        (poly) =>
                          `M ${polyToSvgPoints(poly).replace(/ /g, " L ")} Z`
                      )
                      .join(" ");
                    const labelSize = Math.max(
                      18,
                      Math.min(32, Math.min(p.bbox.width, p.bbox.height) * 0.14)
                    );

                    return (
                      <g key={p.uid}>
                        <path
                          d={dPath}
                          fill={p.color}
                          fillOpacity={0.16}
                          fillRule="evenodd"
                          stroke={p.color}
                          strokeWidth={1.6}
                          vectorEffect="non-scaling-stroke"
                        />
                        <path
                          d={sewD}
                          fill="none"
                          stroke={p.color}
                          strokeOpacity={0.55}
                          strokeWidth={0.9}
                          strokeDasharray="4 3"
                          vectorEffect="non-scaling-stroke"
                        />
                        {/* Grainline arrow along warp */}
                        <line
                          x1={p.grainStart.x}
                          y1={p.grainStart.y}
                          x2={p.grainEnd.x}
                          y2={p.grainEnd.y}
                          stroke="#0F766E"
                          strokeWidth={1.2}
                          vectorEffect="non-scaling-stroke"
                        />
                        <text
                          x={p.labelPos.x}
                          y={p.labelPos.y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={labelSize}
                          fontFamily="monospace"
                          fontWeight="800"
                          fill="#0F172A"
                          stroke="#FFFFFF"
                          strokeWidth={labelSize * 0.22}
                          paintOrder="stroke"
                        >
                          {p.code} [{p.size}]
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                  <span>
                    ← Chiều dài trải vải (Canh sợi dọc song song hai biên vải) →
                  </span>
                  <span>
                    Dải xám hai mép: Biên kim ({settings.selvedgeMarginCm} cm/bên) •
                    Khe dao cắt: {settings.pieceBufferMm} mm
                  </span>
                </div>
              </div>

              {/* Piece Breakdown Table for Cutting Room */}
              <table className="w-full border-collapse text-[10.5px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-2 py-1">
                      Size
                    </th>
                    <th className="border border-slate-300 px-2 py-1 text-center">
                      Tỉ lệ trên sơ đồ
                    </th>
                    <th className="border border-slate-300 px-2 py-1 text-center">
                      Số lớp trải
                    </th>
                    <th className="border border-slate-300 px-2 py-1 text-right">
                      Thành phẩm đạt được
                    </th>
                    <th className="border border-slate-300 px-2 py-1">
                      Danh sách mảnh trên 1 lớp sơ đồ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SIZES.filter((sz) => settings.sizeRatio[sz] > 0).map((sz) => {
                    const ratio = settings.sizeRatio[sz];
                    const szPieces = marker.placedPieces.filter(
                      (p) => p.size === sz
                    );
                    return (
                      <tr key={sz}>
                        <td className="border border-slate-300 px-2 py-1 font-bold">
                          Size {sz}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-center font-mono font-bold">
                          {ratio} SP
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-center font-mono">
                          {settings.fabricPlies} lớp
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold text-[#4F46E5]">
                          {ratio * settings.fabricPlies} cái
                        </td>
                        <td className="border border-slate-300 px-2 py-1 font-mono text-[10px] text-slate-600">
                          {szPieces
                            .map((p) => `${p.code}(${p.rotationDeg}°)`)
                            .join(", ")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Sign-Off Boxes for Cutting Room */}
              <div className="sign-row grid grid-cols-4 gap-2.5 pt-1">
                {[
                  "GIÁC SƠ ĐỒ / KỸ THUẬT",
                  "THỦ KHO CẤP VẢI",
                  "THỢ TRẢI VẢI",
                  "THỢ CẮT CHÍNH",
                ].map((role) => (
                  <div
                    key={role}
                    className="sign-cell rounded border border-dashed border-slate-400 p-1.5 h-14 text-center text-[9.5px] font-bold text-slate-700"
                  >
                    {role}
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
