"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Box,
  Columns2,
  Download,
  DraftingCompass,
  LayoutGrid,
  PenTool,
  Scissors,
} from "lucide-react";
import type {
  GradingOverrides,
  ParamValue,
  ParamValues,
  SizeCode,
} from "@/lib/cad/types";
import {
  getTemplateById,
  TEMPLATE_CATALOG,
} from "@/templates/registry";
import { Logo } from "@/components/brand/Logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CadCanvas,
  type CadCanvasHandle,
  type LayerVisibility,
} from "./CadCanvas";
import { ExportModal } from "./ExportModal";
import { GarmentViewer3D } from "./GarmentViewer3D";
import { InspectorPanel } from "./InspectorPanel";
import { MarkerModal } from "./MarkerModal";
import { ParameterPanel } from "./ParameterPanel";
import { WorkOrderModal } from "./WorkOrderModal";
import { cn } from "@/lib/utils";

type StudioViewMode = "2d" | "split" | "3d";

export function CadStudio({
  initialTemplateId = "circle-skirt",
}: {
  initialTemplateId?: string;
}) {
  const [templateId, setTemplateId] = useState(initialTemplateId);
  const template = useMemo(() => getTemplateById(templateId), [templateId]);

  const [params, setParams] = useState<ParamValues>(() =>
    getTemplateById(initialTemplateId).getDefaultParams()
  );
  const [baseSize, setBaseSize] = useState<SizeCode>("M");
  const [gradingOverrides, setGradingOverrides] = useState<GradingOverrides>({
    waistStepCm: 4.0,
    skirtLengthStepCm: initialTemplateId === "baggy-jean" ? 1.5 : 1.0,
    pos1WaistMidOffsetMm: 0,
    pos2HemMidOffsetMm: 0,
  });

  const [layers, setLayers] = useState<LayerVisibility>({
    cutLines: true,
    sewLines: true,
    grainlines: true,
    notches: true,
    dimensions: true,
    nestedGrading: true,
    grid: true,
  });

  const [visibleSizes, setVisibleSizes] = useState<SizeCode[]>([
    "S",
    "M",
    "L",
    "XL",
  ]);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [markerModalOpen, setMarkerModalOpen] = useState(false);
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<StudioViewMode>("2d");
  const canvasRef = useRef<CadCanvasHandle>(null);

  // Realtime parametric geometry & nested grading computation (0.01 mm precision)
  const grading = useMemo(
    () => template.generateGrading(params, baseSize, gradingOverrides),
    [template, params, baseSize, gradingOverrides]
  );

  const baseEntry = useMemo(
    () => grading.entries.find((e) => e.size === baseSize) ?? grading.entries[0],
    [grading.entries, baseSize]
  );

  const handleParamChange = (key: string, value: ParamValue) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleBulkParams = (patch: Partial<ParamValues>) => {
    setParams((prev) => {
      const next: ParamValues = { ...prev };
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) next[k] = v;
      }
      return next;
    });
  };

  const handleTemplateSwitch = (nextId: string) => {
    const found = TEMPLATE_CATALOG.find((t) => t.id === nextId);
    if (found?.status !== "active" || !found.template) return;
    setTemplateId(nextId);
    setParams(found.template.getDefaultParams());
    setBaseSize("M");
    setGradingOverrides({
      waistStepCm: 4.0,
      skirtLengthStepCm: nextId === "baggy-jean" ? 1.5 : 1.0,
      pos1WaistMidOffsetMm: 0,
      pos2HemMidOffsetMm: 0,
    });
    setSelectedPieceId(null);
    requestAnimationFrame(() => canvasRef.current?.fitAll());
  };

  const handleReset = () => {
    setParams(template.getDefaultParams());
    setBaseSize("M");
    setGradingOverrides({
      waistStepCm: 4.0,
      skirtLengthStepCm: templateId === "baggy-jean" ? 1.5 : 1.0,
      pos1WaistMidOffsetMm: 0,
      pos2HemMidOffsetMm: 0,
    });
    setSelectedPieceId(null);
    requestAnimationFrame(() => canvasRef.current?.fitAll());
  };

  const handleToggleLayer = (key: keyof LayerVisibility) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleSize = (size: SizeCode) => {
    setVisibleSizes((prev) => {
      if (prev.includes(size)) {
        if (prev.length === 1) return prev; // keep at least one visible
        return prev.filter((s) => s !== size);
      }
      return [...prev, size];
    });
  };

  const handleFocusPiece = (pieceId: string) => {
    setSelectedPieceId(pieceId);
    if (viewMode === "3d") {
      setViewMode("split");
    }
    requestAnimationFrame(() => canvasRef.current?.focusPiece(pieceId));
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white text-[#0F172A]">
      {/* Studio Top Bar */}
      <header className="flex h-13 shrink-0 items-center justify-between gap-4 border-b border-[#E2E8F0] bg-white px-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#0F172A]"
            title="Quay lại Trang chủ"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Trang chủ</span>
          </Link>

          <div className="h-5 w-px bg-[#E2E8F0]" />

          <Logo compact href="/" />

          <div className="hidden md:block h-5 w-px bg-[#E2E8F0]" />

          {/* Plugin Template Selector */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-400">
              Mẫu rập (Template):
            </span>
            <Select
              value={templateId}
              onValueChange={handleTemplateSwitch}
            >
              <SelectTrigger className="h-8 w-72 border-[#E2E8F0] bg-slate-50/70 text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATALOG.map((item) => (
                  <SelectItem
                    key={item.id}
                    value={item.id}
                    disabled={item.status === "coming-soon"}
                  >
                    <span className="flex items-center gap-2">
                      <span>
                        {item.name} ({item.englishName})
                      </span>
                      {item.status === "coming-soon" && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                          Sắp ra mắt
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Center / Right Quick View Mode Switcher (2D | 2D+3D | 3D) & Export */}
        <div className="flex items-center gap-2.5">
          {/* 2D / Split / 3D Simulation Switcher */}
          <div className="flex items-center rounded-lg border border-[#E2E8F0] bg-slate-100/90 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("2d")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                viewMode === "2d"
                  ? "bg-white text-[#4F46E5] shadow-2xs"
                  : "text-slate-600 hover:text-[#0F172A]"
              )}
            >
              <PenTool className="size-3.5" />
              <span>Rập 2D</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={cn(
                "hidden sm:inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                viewMode === "split"
                  ? "bg-white text-[#4F46E5] shadow-2xs"
                  : "text-slate-600 hover:text-[#0F172A]"
              )}
            >
              <Columns2 className="size-3.5" />
              <span>2D + 3D</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("3d")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                viewMode === "3d"
                  ? "bg-[#4F46E5] text-white shadow-2xs"
                  : "text-slate-600 hover:text-[#0F172A]"
              )}
            >
              <Box className="size-3.5" />
              <span>Xem mẫu 3D</span>
            </button>
          </div>

          <div className="hidden xl:flex items-center gap-2 text-xs text-slate-500">
            <Badge variant="outline" className="gap-1 font-mono text-[10px]">
              <DraftingCompass className="size-3 text-[#4F46E5]" />
              0.01 mm
            </Badge>
          </div>

          <Link
            href="/templates"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#4F46E5]"
          >
            <LayoutGrid className="size-3.5" />
            Thư viện mẫu
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setMarkerModalOpen(true)}
            className="h-8 gap-1.5 border-emerald-300 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/80 font-semibold"
          >
            <Scissors className="size-3.5" />
            <span>Giác sơ đồ</span>
          </Button>


          <Button
            size="sm"
            onClick={() => setExportModalOpen(true)}
            className="h-8 gap-1.5"
          >
            <Download className="size-3.5" />
            <span>Export</span>
          </Button>
        </div>
      </header>

      {/* 3-Column Parametric CAD Workspace */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Column: Parameters & Realtime Math */}
        <div className="w-[310px] xl:w-[335px] shrink-0 border-r border-[#E2E8F0] min-h-0 overflow-hidden">
          <ParameterPanel
            templateId={template.id}
            schema={template.schema}
            values={params}
            baseSize={baseSize}
            formulas={baseEntry.geometry.formulas}
            warnings={baseEntry.geometry.warnings}
            onChange={handleParamChange}
            onApplyPreset={handleBulkParams}
            onBaseSizeChange={setBaseSize}
            onReset={handleReset}
          />
        </div>

        {/* Center Column: Interactive 2D Drafting Canvas & Realtime 3D Garment Simulation */}
        <main className="flex flex-1 min-w-0 min-h-0 overflow-hidden">
          {(viewMode === "2d" || viewMode === "split") && (
            <div
              className={cn(
                "min-w-0 min-h-0 h-full overflow-hidden",
                viewMode === "split"
                  ? "w-1/2 border-r border-[#E2E8F0]"
                  : "flex-1"
              )}
            >
              <CadCanvas
                ref={canvasRef}
                grading={grading}
                layers={layers}
                visibleSizes={visibleSizes}
                selectedPieceId={selectedPieceId}
                onToggleLayer={handleToggleLayer}
                onToggleSize={handleToggleSize}
                onSelectPiece={setSelectedPieceId}
              />
            </div>
          )}

          {(viewMode === "3d" || viewMode === "split") && (
            <div
              className={cn(
                "min-w-0 min-h-0 h-full overflow-hidden",
                viewMode === "split" ? "w-1/2" : "flex-1"
              )}
            >
              <GarmentViewer3D
                templateId={template.id}
                grading={grading}
                activeBaseSize={baseSize}
              />
            </div>
          )}
        </main>

        {/* Right Column: Pieces, Grading Coordinate Table & DXF Export */}
        <div className="w-[330px] xl:w-[365px] shrink-0 border-l border-[#E2E8F0] min-h-0 overflow-hidden">
          <InspectorPanel
            templateId={template.id}
            grading={grading}
            gradingOverrides={gradingOverrides}
            visibleSizes={visibleSizes}
            selectedPieceId={selectedPieceId}
            onGradingOverridesChange={setGradingOverrides}
            onFocusPiece={handleFocusPiece}
            onOpenMarkerModal={() => setMarkerModalOpen(true)}
            onOpenExportModal={() => setExportModalOpen(true)}
            onOpenWorkOrderModal={() => setWorkOrderModalOpen(true)}
          />
        </div>
      </div>

      {/* Automated True-Shape Marker Nesting & Cutting Print Modal */}
      <MarkerModal
        open={markerModalOpen}
        onOpenChange={setMarkerModalOpen}
        templateName={`${template.name} (${template.englishName})`}
        grading={grading}
      />

      {/* Industrial Export & Tech Pack Modal */}
      <ExportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        templateId={template.id}
        templateName={`${template.name} (${template.englishName})`}
        params={params}
        grading={grading}
        gradingOverrides={gradingOverrides}
        initialSizes={layers.nestedGrading ? visibleSizes : [baseSize]}
      />

      {/* Printable A4 Workshop Production Worksheet / Sewing Job Sheet */}
      <WorkOrderModal
        key={template.id}
        open={workOrderModalOpen}
        onOpenChange={setWorkOrderModalOpen}
        templateId={template.id}
        templateName={`${template.name} (${template.englishName})`}
        params={params}
        grading={grading}
      />
    </div>
  );
}
