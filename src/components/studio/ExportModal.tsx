"use client";

import React, { useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Download,
  FileCode2,
  FileText,
  Grid2X2,
  Layers,
  Loader2,
  Printer,
} from "lucide-react";
import type { ExportFormat } from "@/app/api/export/route";
import type { DxfUnit } from "@/lib/cad/dxf";
import { pathToSvgD, roundCm } from "@/lib/cad/math";
import type {
  GradingOverrides,
  NestedGradingResult,
  ParamValues,
  SizeCode,
} from "@/lib/cad/types";
import { SIZE_DEFINITIONS } from "@/templates/circle-skirt/grading";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName: string;
  params: ParamValues;
  grading: NestedGradingResult;
  gradingOverrides: GradingOverrides;
  initialSizes: SizeCode[];
}

interface ExportFeedback {
  filename: string;
  format: string;
  byteSize: number;
  entities?: string | null;
  pages?: string | null;
}

const FORMAT_OPTIONS: Array<{
  id: ExportFormat;
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "dxf",
    title: "AAMA / ASTM DXF (Lồng size)",
    subtitle: "Gerber AccuMark • Optitex • CLO3D (BLOCKS + POLYLINE đồng bộ đỉnh)",
    badge: "AAMA .DXF",
    icon: FileCode2,
  },
  {
    id: "pdf-a0",
    title: "PDF Khổ lớn A0",
    subtitle: "In máy vẽ sơ đồ 1:1 kèm ô vuông kiểm chuẩn 50×50 mm",
    badge: "PDF A0",
    icon: Printer,
  },
  {
    id: "pdf-a4",
    title: "PDF Chia trang A4",
    subtitle: "Tự động chia lưới A1..An kèm Sơ đồ ghép trang & dấu cộng (+)",
    badge: "PDF A4",
    icon: Grid2X2,
  },
  {
    id: "zip",
    title: "Gói Tech Pack đầy đủ",
    subtitle: "Gồm file DXF + PDF A0 + PDF A4 + Bảng tọa độ nhảy size (.CSV)",
    badge: ".ZIP Bundle",
    icon: Archive,
  },
];

const AAMA_LAYERS = [
  { code: "Layer 1", name: "Đường cắt & Piece/Size (Cut)", color: "#0F172A" },
  { code: "Layer 2", name: "Điểm nhảy size (Grade Points)", color: "#D97706" },
  { code: "Layer 4", name: "Dấu bấm định vị (Notches)", color: "#7C3AED" },
  { code: "Layer 7", name: "Đường canh sợi (Grainline)", color: "#0F766E" },
  { code: "Layer 11", name: "Lỗ khoét trong (Cutout 360°)", color: "#E11D48" },
  { code: "Layer 14", name: "Đường may (Sew Line)", color: "#4F46E5" },
  { code: "Layer 15", name: "Chú thích mảnh (Annotation)", color: "#475569" },
];

export function ExportModal({
  open,
  onOpenChange,
  templateId,
  templateName,
  params,
  grading,
  gradingOverrides,
  initialSizes,
}: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>("dxf");
  const [unit, setUnit] = useState<DxfUnit>("mm");
  const [selectedSizes, setSelectedSizes] = useState<SizeCode[]>(
    initialSizes.length > 0 ? initialSizes : [grading.baseSize]
  );
  const [includeSeamLines, setIncludeSeamLines] = useState(true);
  const [includeMarkings, setIncludeMarkings] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ExportFeedback | null>(null);

  const selectedEntries = useMemo(() => {
    const filtered = grading.entries.filter((e) =>
      selectedSizes.includes(e.size)
    );
    return filtered.length > 0
      ? filtered
      : [grading.entries.find((e) => e.isBase) ?? grading.entries[0]];
  }, [grading.entries, selectedSizes]);

  // Compute tight preview bbox & A4 grid estimate
  const previewMetrics = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const e of selectedEntries) {
      const b = e.geometry.bbox;
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
    }
    const width = Math.max(10, maxX - minX);
    const height = Math.max(10, maxY - minY);
    const pad = 10;
    const cols = Math.max(1, Math.ceil((width + pad * 2) / 186));
    const rows = Math.max(1, Math.ceil((height + pad * 2) / 273));
    return { minX, minY, maxX, maxY, width, height, cols, rows };
  }, [selectedEntries]);

  const toggleSize = (code: SizeCode) => {
    setSelectedSizes((prev) => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== code);
      }
      const order: Record<SizeCode, number> = { S: 0, M: 1, L: 2, XL: 3 };
      return [...prev, code].sort((a, b) => order[a] - order[b]);
    });
  };

  const handleDownload = async () => {
    setIsExporting(true);
    setErrorMsg(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          params,
          baseSize: grading.baseSize,
          sizes: selectedSizes,
          format,
          unit,
          includeSeamLines,
          includeMarkings,
          gradingOverrides,
        }),
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(err.error ?? "Không thể xuất file sản xuất");
      }

      const blob = await response.blob();
      const filename =
        response.headers.get("X-Export-Filename") ??
        `pattern-${selectedSizes.join("-")}.${format === "zip" ? "zip" : format === "dxf" ? "dxf" : "pdf"}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setFeedback({
        filename,
        format,
        byteSize: blob.size,
        entities: response.headers.get("X-Export-Entities"),
        pages: response.headers.get("X-Export-Pages"),
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Đã xảy ra lỗi xuất file");
    } finally {
      setIsExporting(false);
    }
  };

  const viewPad = Math.max(previewMetrics.width, previewMetrics.height) * 0.08 + 30;
  const viewBox = `${previewMetrics.minX - viewPad} ${previewMetrics.minY - viewPad} ${previewMetrics.width + viewPad * 2} ${previewMetrics.height + viewPad * 2}`;
  const showA4Grid = format === "pdf-a4" || format === "zip";
  const showUnitPicker = format === "dxf" || format === "zip";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-[#4F46E5] border border-indigo-200">
              <FileText className="size-4" />
            </span>
            <div>
              <DialogTitle>
                Xuất file sản xuất & Tech Pack (Export Engine)
              </DialogTitle>
              <DialogDescription>
                {templateName} • Chuẩn tỷ lệ 1:1 (0.01 mm) tương thích Gerber
                AccuMark, Optitex & CLO3D
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-12 max-h-[82vh] overflow-y-auto">
          {/* LEFT COLUMN: Live Cutting Schematic Preview */}
          <div className="md:col-span-5 flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#E2E8F0] bg-[#F8FAFC] p-5 space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#0F172A]">
                  Xem trước sơ đồ mảnh cắt (Preview)
                </span>
                <Badge variant="outline" className="bg-white font-mono text-[10px]">
                  {roundCm(previewMetrics.width / 10, 1)} ×{" "}
                  {roundCm(previewMetrics.height / 10, 1)} cm
                </Badge>
              </div>

              {/* SVG Preview Box */}
              <div className="relative h-64 w-full rounded-xl border border-[#E2E8F0] bg-white cad-grid-bg overflow-hidden">
                <svg
                  viewBox={viewBox}
                  preserveAspectRatio="xMidYMid meet"
                  className="h-full w-full"
                >
                  {/* Optional A4 Tiling Grid Overlay */}
                  {showA4Grid &&
                    Array.from({ length: previewMetrics.rows }).map((_, r) =>
                      Array.from({ length: previewMetrics.cols }).map((__, c) => {
                        const x = previewMetrics.minX - 10 + c * 186;
                        const y = previewMetrics.minY - 10 + r * 273;
                        return (
                          <rect
                            key={`tile-${r}-${c}`}
                            x={x}
                            y={y}
                            width={186}
                            height={273}
                            fill="none"
                            stroke="#94A3B8"
                            strokeWidth={0.8}
                            strokeDasharray="3 3"
                            vectorEffect="non-scaling-stroke"
                          />
                        );
                      })
                    )}

                  {/* Selected Nested / Single Sizes */}
                  {[...selectedEntries].reverse().map((entry) => (
                    <g key={entry.size}>
                      {entry.geometry.pieces.map((piece) => (
                        <g key={`${entry.size}-${piece.id}`}>
                          {piece.cutPaths.map((cp) => (
                            <path
                              key={cp.id}
                              d={pathToSvgD(cp)}
                              fill={entry.isBase ? entry.color : "none"}
                              fillOpacity={entry.isBase ? 0.06 : 0}
                              fillRule="evenodd"
                              stroke={entry.color}
                              strokeWidth={entry.isBase ? 1.8 : 1.2}
                              vectorEffect="non-scaling-stroke"
                            />
                          ))}
                          {includeSeamLines &&
                            entry.isBase &&
                            piece.sewPaths.map((sp) => (
                              <path
                                key={sp.id}
                                d={pathToSvgD(sp)}
                                fill="none"
                                stroke={entry.color}
                                strokeWidth={1}
                                strokeDasharray="4 3"
                                strokeOpacity={0.6}
                                vectorEffect="non-scaling-stroke"
                              />
                            ))}
                        </g>
                      ))}
                    </g>
                  ))}
                </svg>

                {showA4Grid && (
                  <div className="absolute top-2 right-2 rounded-md border border-indigo-200 bg-indigo-50/95 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#4F46E5]">
                    Lưới A4: {previewMetrics.cols}×{previewMetrics.rows} ô
                  </div>
                )}
              </div>
            </div>

            {/* AAMA Standard Layer Breakdown */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0F172A]">
                  <Layers className="size-3.5 text-[#4F46E5]" />
                  Cấu trúc Layer DXF chuẩn ngành may
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  AAMA/ASTM
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 text-[11px]">
                {AAMA_LAYERS.map((layer) => (
                  <div
                    key={layer.code}
                    className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1"
                  >
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold text-[#0F172A]">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: layer.color }}
                      />
                      {layer.code}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {layer.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Format, Sizes, Units & Download */}
          <div className="md:col-span-7 flex flex-col justify-between p-5 space-y-5">
            <div className="space-y-4">
              {/* 1. Format Picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#0F172A]">
                  1. Chọn định dạng xuất (Export Format)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FORMAT_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = format === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFormat(opt.id)}
                        className={cn(
                          "flex flex-col items-start rounded-xl border p-3 text-left transition-all cursor-pointer",
                          active
                            ? "border-[#4F46E5] bg-indigo-50/60 ring-1 ring-[#4F46E5]/20"
                            : "border-[#E2E8F0] bg-white hover:border-slate-300 hover:bg-slate-50/70"
                        )}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs font-bold",
                              active ? "text-[#4F46E5]" : "text-[#0F172A]"
                            )}
                          >
                            <Icon className="size-3.5" />
                            {opt.title}
                          </span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold",
                              active
                                ? "bg-[#4F46E5] text-white"
                                : "bg-slate-100 text-slate-600"
                            )}
                          >
                            {opt.badge}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] leading-snug text-slate-500">
                          {opt.subtitle}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Size Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#0F172A]">
                    2. Chọn các size muốn xuất (Sizes)
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedSizes([grading.baseSize])}
                      className="font-medium text-slate-500 hover:text-[#4F46E5] cursor-pointer"
                    >
                      Chỉ Size gốc ({grading.baseSize})
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSizes(["S", "M", "L", "XL"])}
                      className="font-semibold text-[#4F46E5] hover:underline cursor-pointer"
                    >
                      Chọn tất cả (S–XL)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {SIZE_DEFINITIONS.map((sz) => {
                    const checked = selectedSizes.includes(sz.code);
                    const isBase = sz.code === grading.baseSize;
                    return (
                      <button
                        key={sz.code}
                        type="button"
                        onClick={() => toggleSize(sz.code)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition-all cursor-pointer",
                          checked
                            ? "border-[#4F46E5] bg-indigo-50/70 text-[#0F172A] shadow-2xs"
                            : "border-[#E2E8F0] bg-white text-slate-400 hover:text-slate-600"
                        )}
                      >
                        <span
                          className="size-2.5 rounded-full"
                          style={{
                            backgroundColor: checked ? sz.color : "#CBD5E1",
                          }}
                        />
                        {sz.code}
                        {isBase && (
                          <span className="text-[9px] font-semibold text-[#4F46E5]">
                            (Gốc)
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Unit & Layer Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-[#E2E8F0] bg-slate-50/70 p-3">
                {showUnitPicker && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-[#0F172A]">
                      Đơn vị bản vẽ DXF (1:1)
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(["mm", "cm"] as const).map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setUnit(u)}
                          className={cn(
                            "rounded-md border py-1 font-mono text-[11px] font-semibold transition-all cursor-pointer",
                            unit === u
                              ? "border-[#4F46E5] bg-white text-[#4F46E5]"
                              : "border-[#E2E8F0] bg-white/60 text-slate-500 hover:bg-white"
                          )}
                        >
                          {u === "mm" ? "mm (Chuẩn)" : "cm (1:1)"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  className={cn(
                    "space-y-1.5",
                    !showUnitPicker && "sm:col-span-2"
                  )}
                >
                  <span className="text-[11px] font-semibold text-[#0F172A]">
                    Tùy chọn lớp kỹ thuật (Layers)
                  </span>
                  <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] text-slate-700">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeSeamLines}
                        onChange={(e) => setIncludeSeamLines(e.target.checked)}
                        className="size-3.5 rounded accent-[#4F46E5]"
                      />
                      Đường may (Layer 14)
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeMarkings}
                        onChange={(e) => setIncludeMarkings(e.target.checked)}
                        className="size-3.5 rounded accent-[#4F46E5]"
                      />
                      Dấu bấm, Canh sợi & Chữ
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Action & Export Feedback */}
            <div className="space-y-2.5 border-t border-[#E2E8F0] pt-4">
              {errorMsg && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {errorMsg}
                </div>
              )}

              {feedback && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <div className="min-w-0">
                    <p className="truncate font-mono font-semibold">
                      Đã tải xuống: {feedback.filename}
                    </p>
                    <p className="text-[11px] text-emerald-700/90">
                      Dung lượng {(feedback.byteSize / 1024).toFixed(1)} KB
                      {feedback.entities
                        ? ` • ${feedback.entities} đối tượng CAD`
                        : ""}
                      {feedback.pages ? ` • ${feedback.pages} trang in` : ""}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isExporting}
                >
                  Đóng
                </Button>
                <Button
                  size="lg"
                  onClick={handleDownload}
                  disabled={isExporting}
                  className="min-w-52 shadow-sm"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Đang tạo file chuẩn 1:1...
                    </>
                  ) : (
                    <>
                      <Download className="size-4" />
                      {format === "zip"
                        ? "Tải gói Tech Pack (.ZIP)"
                        : format === "dxf"
                          ? `Tải file DXF (${unit})`
                          : format === "pdf-a0"
                            ? "Tải file PDF A0 (1:1)"
                            : "Tải file PDF A4 ghép trang"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
