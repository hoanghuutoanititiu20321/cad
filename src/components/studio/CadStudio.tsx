"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  DraftingCompass,
  LayoutGrid,
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
import { InspectorPanel } from "./InspectorPanel";
import { ParameterPanel } from "./ParameterPanel";

export function CadStudio() {
  const [templateId, setTemplateId] = useState("circle-skirt");
  const template = useMemo(() => getTemplateById(templateId), [templateId]);

  const [params, setParams] = useState<ParamValues>(() =>
    template.getDefaultParams()
  );
  const [baseSize, setBaseSize] = useState<SizeCode>("M");
  const [gradingOverrides, setGradingOverrides] = useState<GradingOverrides>({
    waistStepCm: 4.0,
    skirtLengthStepCm: 1.0,
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

  const handleReset = () => {
    setParams(template.getDefaultParams());
    setBaseSize("M");
    setGradingOverrides({
      waistStepCm: 4.0,
      skirtLengthStepCm: 1.0,
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
    canvasRef.current?.focusPiece(pieceId);
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
              onValueChange={(val) => {
                const found = TEMPLATE_CATALOG.find((t) => t.id === val);
                if (found?.status === "active") {
                  setTemplateId(val);
                }
              }}
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

        {/* Right Quick Info & Export */}
        <div className="flex items-center gap-2.5">
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500">
            <Badge variant="outline" className="gap-1 font-mono text-[10px]">
              <DraftingCompass className="size-3 text-[#4F46E5]" />
              v{template.version} • Vector 0.01 mm
            </Badge>
            <Badge variant="secondary" className="font-mono text-[10px]">
              R_eo {baseEntry.measurements.rWaistCm.toFixed(2)} cm • R_lai{" "}
              {baseEntry.measurements.rHemCm.toFixed(2)} cm
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
            size="sm"
            onClick={() => setExportModalOpen(true)}
            className="h-8 gap-1.5"
          >
            <Download className="size-3.5" />
            <span>Xuất file & Tech Pack</span>
          </Button>
        </div>
      </header>

      {/* 3-Column Parametric CAD Workspace */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Column: Parameters & Realtime Math */}
        <div className="w-[310px] xl:w-[335px] shrink-0 border-r border-[#E2E8F0] min-h-0 overflow-hidden">
          <ParameterPanel
            schema={template.schema}
            values={params}
            baseSize={baseSize}
            formulas={baseEntry.geometry.formulas}
            warnings={baseEntry.geometry.warnings}
            onChange={handleParamChange}
            onBaseSizeChange={setBaseSize}
            onReset={handleReset}
          />
        </div>

        {/* Center Column: Interactive 2D Drafting Canvas */}
        <main className="flex-1 min-w-0 min-h-0 overflow-hidden">
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
        </main>

        {/* Right Column: Pieces, Grading Coordinate Table & DXF Export */}
        <div className="w-[330px] xl:w-[365px] shrink-0 border-l border-[#E2E8F0] min-h-0 overflow-hidden">
          <InspectorPanel
            grading={grading}
            gradingOverrides={gradingOverrides}
            visibleSizes={visibleSizes}
            selectedPieceId={selectedPieceId}
            onGradingOverridesChange={setGradingOverrides}
            onFocusPiece={handleFocusPiece}
            onOpenExportModal={() => setExportModalOpen(true)}
          />
        </div>
      </div>

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
    </div>
  );
}
