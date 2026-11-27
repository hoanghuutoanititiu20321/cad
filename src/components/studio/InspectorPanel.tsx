"use client";

import React, { useState } from "react";
import {
  Download,
  FileCode2,
  Layers,
  Printer,
  Ruler,
  Scissors,
  TableProperties,
} from "lucide-react";
import { roundCm } from "@/lib/cad/math";
import type {
  GradingOverrides,
  NestedGradingResult,
  SizeCode,
} from "@/lib/cad/types";
import { SIZE_DEFINITIONS } from "@/templates/circle-skirt/grading";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface InspectorPanelProps {
  grading: NestedGradingResult;
  gradingOverrides: GradingOverrides;
  visibleSizes: SizeCode[];
  selectedPieceId: string | null;
  onGradingOverridesChange: (next: GradingOverrides) => void;
  onFocusPiece: (pieceId: string) => void;
  onOpenMarkerModal: () => void;
  onOpenExportModal: () => void;
  onOpenWorkOrderModal: () => void;
}

export function InspectorPanel({
  grading,
  gradingOverrides,
  visibleSizes,
  selectedPieceId,
  onGradingOverridesChange,
  onFocusPiece,
  onOpenMarkerModal,
  onOpenExportModal,
  onOpenWorkOrderModal,
}: InspectorPanelProps) {
  const [inspectPointSize, setInspectPointSize] = useState<SizeCode>("XL");

  const baseEntry =
    grading.entries.find((e) => e.size === grading.baseSize) ??
    grading.entries[0];
  const pieces = baseEntry.geometry.pieces;
  const summary = baseEntry.geometry.summary;

  return (
    <aside className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
        <div className="flex items-center gap-2">
          <TableProperties className="size-4 text-[#4F46E5]" />
          <div>
            <h2 className="text-xs font-semibold text-[#0F172A]">
              Chi tiết rập & Nhảy size (Inspector)
            </h2>
            <p className="text-[10px] text-slate-500">
              {pieces.length} mẫu rập • Tổng {summary.totalCutPieces} mảnh cắt
            </p>
          </div>
        </div>
        <Badge variant="default" className="font-mono text-[10px] px-2 py-0.5">
          Base {grading.baseSize}
        </Badge>
      </div>

      {/* Main Scrollable Tabbed Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <Tabs defaultValue="pieces" className="w-full">
          <TabsList>
            <TabsTrigger value="pieces">
              <Scissors className="size-3" />
              Mảnh rập ({pieces.length})
            </TabsTrigger>
            <TabsTrigger value="grading">
              <Layers className="size-3" />
              Nhảy size (S–XL)
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Pattern Pieces & Production Summary */}
          <TabsContent value="pieces" className="space-y-3">
            {pieces.map((piece) => {
              const isSelected = selectedPieceId === piece.id;
              return (
                <button
                  key={piece.id}
                  type="button"
                  onClick={() => onFocusPiece(piece.id)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-all cursor-pointer",
                    isSelected
                      ? "border-[#4F46E5] bg-indigo-50/40 ring-1 ring-[#4F46E5]/20"
                      : "border-[#E2E8F0] bg-white hover:border-slate-300 hover:bg-slate-50/60"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#0F172A]">
                          {piece.code}
                        </span>
                        <span className="text-xs font-semibold text-[#0F172A]">
                          {piece.name}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {piece.englishName}
                      </p>
                    </div>
                    <Badge
                      variant={isSelected ? "default" : "secondary"}
                      className="shrink-0 font-mono text-[10px]"
                    >
                      ×{piece.cutQuantity}
                    </Badge>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5 text-[11px]">
                    <div>
                      <span className="text-[10px] text-slate-400">
                        Kích thước bao (W × H)
                      </span>
                      <p className="font-mono font-semibold text-[#0F172A] tabular-nums">
                        {roundCm(piece.metrics.widthMm / 10, 2)} ×{" "}
                        {roundCm(piece.metrics.heightMm / 10, 2)} cm
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">
                        Chu vi cắt (Perimeter)
                      </span>
                      <p className="font-mono font-semibold text-[#0F172A] tabular-nums">
                        {roundCm(piece.metrics.perimeterMm / 10, 2)} cm
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">
                        Dấu bấm (Notches)
                      </span>
                      <p className="font-mono font-medium text-slate-700">
                        {piece.notches.length} điểm bấm
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">
                        Diện tích (Area / mảnh)
                      </span>
                      <p className="font-mono font-medium text-slate-700 tabular-nums">
                        {roundCm(piece.metrics.areaMm2 / 1_000_000, 3)} m²
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Fabric & Production Estimate Card */}
            <div className="rounded-xl border border-[#E2E8F0] bg-slate-50/70 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0F172A]">
                <Ruler className="size-3.5 text-[#4F46E5]" />
                Ước tính định mức (Production Estimate — {grading.baseSize})
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2">
                  <span className="text-[10px] text-slate-400">
                    Khổ vải tối thiểu
                  </span>
                  <p className="font-mono text-xs font-bold text-[#0F172A] tabular-nums">
                    {summary.estimatedFabricWidthCm} cm
                  </p>
                </div>
                <div className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2">
                  <span className="text-[10px] text-slate-400">
                    Tổng diện tích rập
                  </span>
                  <p className="font-mono text-xs font-bold text-[#0F172A] tabular-nums">
                    {summary.totalAreaM2} m²
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: Grading Spec Table & Key Point Coordinates (X, Y) */}
          <TabsContent value="grading" className="space-y-4">
            {/* Custom Grade Step & Position [1] / [2] Input Box */}
            <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-[#0F172A]">
                  Ô điền giá trị nhảy size & Vị trí [1] – [2]
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    onGradingOverridesChange({
                      waistStepCm: 4.0,
                      skirtLengthStepCm: 1.0,
                      pos1WaistMidOffsetMm: 0,
                      pos2HemMidOffsetMm: 0,
                    })
                  }
                  className="text-[10px] font-medium text-[#4F46E5] hover:underline cursor-pointer"
                >
                  Mặc định
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600">
                    Bước eo / size (cm)
                  </label>
                  <Input
                    type="number"
                    step={0.5}
                    min={1}
                    max={10}
                    value={gradingOverrides.waistStepCm ?? 4.0}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) {
                        onGradingOverridesChange({
                          ...gradingOverrides,
                          waistStepCm: v,
                        });
                      }
                    }}
                    className="h-7 bg-white font-mono text-xs text-right"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600">
                    Bước dài / size (cm)
                  </label>
                  <Input
                    type="number"
                    step={0.5}
                    min={0}
                    max={6}
                    value={gradingOverrides.skirtLengthStepCm ?? 1.0}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) {
                        onGradingOverridesChange({
                          ...gradingOverrides,
                          skirtLengthStepCm: v,
                        });
                      }
                    }}
                    className="h-7 bg-white font-mono text-xs text-right"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600">
                    Vị trí [1] Giữa eo (bù mm)
                  </label>
                  <Input
                    type="number"
                    step={0.5}
                    min={-25}
                    max={25}
                    value={gradingOverrides.pos1WaistMidOffsetMm ?? 0}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) {
                        onGradingOverridesChange({
                          ...gradingOverrides,
                          pos1WaistMidOffsetMm: v,
                        });
                      }
                    }}
                    className="h-7 bg-white font-mono text-xs text-right"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600">
                    Vị trí [2] Giữa lai (bù mm)
                  </label>
                  <Input
                    type="number"
                    step={0.5}
                    min={-25}
                    max={25}
                    value={gradingOverrides.pos2HemMidOffsetMm ?? 0}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) {
                        onGradingOverridesChange({
                          ...gradingOverrides,
                          pos2HemMidOffsetMm: v,
                        });
                      }
                    }}
                    className="h-7 bg-white font-mono text-xs text-right"
                  />
                </div>
              </div>

              <p className="text-[10px] leading-snug text-slate-500">
                Mặc định bù <strong className="font-mono text-[#0F172A]">0 mm</strong> →
                đồng tâm chuẩn (<strong className="text-[#4F46E5]">Y sườn = X giữa [1]/[2]</strong>).
                Điền +/- mm để tùy chỉnh riêng tại vị trí [1] hoặc [2].
              </p>
            </div>

            {/* Table 1: Radii & Spec Table across S, M, L, XL */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-[#0F172A]">
                  Bảng thông số bán kính S – XL (Radii Grading)
                </h3>
                <span className="font-mono text-[10px] text-slate-400">
                  cm / mm
                </span>
              </div>

              <div className="overflow-hidden rounded-lg border border-[#E2E8F0]">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-[10px] font-semibold text-slate-500 border-b border-[#E2E8F0]">
                    <tr>
                      <th className="px-2 py-2">Size</th>
                      <th className="px-2 py-2 text-right">Eo (cm)</th>
                      <th className="px-2 py-2 text-right">Dài (cm)</th>
                      <th className="px-2 py-2 text-right">R_eo (mm)</th>
                      <th className="px-2 py-2 text-right">R_lai (mm)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                    {grading.entries.map((entry) => (
                      <tr
                        key={entry.size}
                        className={cn(
                          entry.isBase ? "bg-indigo-50/50 font-semibold" : "bg-white"
                        )}
                      >
                        <td className="px-2 py-2">
                          <span className="inline-flex items-center gap-1.5 font-sans font-bold text-[#0F172A]">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            {entry.size}
                            {entry.isBase && (
                              <span className="text-[9px] font-semibold text-[#4F46E5]">
                                *
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right text-slate-700">
                          {entry.measurements.waistCm.toFixed(1)}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-700">
                          {entry.measurements.skirtLengthCm.toFixed(1)}
                        </td>
                        <td className="px-2 py-2 text-right text-[#0F172A]">
                          {entry.measurements.rWaistMm.toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-right text-[#0F172A]">
                          {entry.measurements.rHemMm.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-500">
                * Quy tắc nhảy size chuẩn: mỗi size chênh{" "}
                <strong className="text-[#0F172A]">+4.0 cm</strong> vòng eo và{" "}
                <strong className="text-[#0F172A]">+1.0 cm</strong> dài váy.
              </p>
            </div>

            <Separator />

            {/* Table 2: Key Point Coordinates (X, Y) & Grade Rules (ΔX, ΔY) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[11px] font-semibold text-[#0F172A]">
                  Bảng tọa độ điểm (Point Coords — mm)
                </h3>
                <div className="flex items-center gap-1">
                  {SIZE_DEFINITIONS.map((sz) => (
                    <button
                      key={sz.code}
                      type="button"
                      onClick={() => setInspectPointSize(sz.code)}
                      className={cn(
                        "rounded px-1.5 py-0.5 font-mono text-[10px] font-bold transition-colors cursor-pointer border",
                        inspectPointSize === sz.code
                          ? "border-[#4F46E5] bg-indigo-50 text-[#4F46E5]"
                          : "border-[#E2E8F0] bg-white text-slate-500 hover:text-[#0F172A]"
                      )}
                    >
                      {sz.code}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-[#E2E8F0]">
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-slate-50 font-semibold text-slate-500 border-b border-[#E2E8F0]">
                    <tr>
                      <th className="px-2 py-1.5">Điểm</th>
                      <th className="px-2 py-1.5 text-right">X (mm)</th>
                      <th className="px-2 py-1.5 text-right">Y (mm)</th>
                      <th className="px-2 py-1.5 text-right">
                        ΔX / ΔY ({inspectPointSize}–{grading.baseSize})
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                    {grading.pointTable.map((row) => {
                      const c = row.bySize[inspectPointSize];
                      const fmtDelta = (v: number) =>
                        `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
                      return (
                        <tr
                          key={`${row.pieceId}-${row.pointCode}`}
                          className="hover:bg-slate-50/70"
                        >
                          <td className="px-2 py-1.5">
                            <span className="font-bold text-[#4F46E5]">
                              {row.pointCode}
                            </span>
                            <span className="ml-1 font-sans text-[9px] text-slate-500">
                              {row.pointLabel.split("(")[0].trim()}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right text-[#0F172A]">
                            {c.x.toFixed(2)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-[#0F172A]">
                            {c.y.toFixed(2)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-slate-600">
                            {fmtDelta(c.dx)}, {fmtDelta(c.dy)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Docked Production Export Footer */}
      <div className="border-t border-[#E2E8F0] bg-slate-50/80 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0F172A]">
            <FileCode2 className="size-3.5 text-[#4F46E5]" />
            Xuất file sản xuất & Tech Pack
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            1:1 • {visibleSizes.length} size
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-600">
          <span className="rounded border border-[#E2E8F0] bg-white px-1.5 py-0.5">
            AAMA DXF
          </span>
          <span className="rounded border border-[#E2E8F0] bg-white px-1.5 py-0.5">
            PDF A0
          </span>
          <span className="rounded border border-[#E2E8F0] bg-white px-1.5 py-0.5">
            PDF A4
          </span>
          <span className="rounded border border-[#E2E8F0] bg-white px-1.5 py-0.5">
            Tech Pack .ZIP
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenMarkerModal}
            className="border-emerald-300 bg-emerald-50/70 font-semibold text-emerald-800 hover:bg-emerald-100/80"
          >
            <Scissors className="size-3.5" />
            Giác sơ đồ vải
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenWorkOrderModal}
            className="border-indigo-200 bg-white font-semibold text-[#4F46E5] hover:bg-indigo-50"
          >
            <Printer className="size-3.5" />
            Phiếu may A4
          </Button>
        </div>

        <Button
          size="lg"
          onClick={onOpenExportModal}
          className="w-full font-semibold shadow-sm"
        >
          <Download className="size-4" />
          Xuất file & Tech Pack (Export)
        </Button>

        <p className="text-center text-[10px] text-slate-400">
          Layer 1/4/7/8/11 chuẩn Gerber AccuMark, Optitex & CLO3D
        </p>
      </div>
    </aside>
  );
}
