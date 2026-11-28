"use client";

import React from "react";
import {
  AlertTriangle,
  Calculator,
  RotateCcw,
  SlidersHorizontal,
  UserCheck,
} from "lucide-react";
import {
  getMannequinBodySpec,
} from "@/lib/cad/bodyStandards";
import type {
  FormulaItem,
  ParamField,
  ParamValue,
  ParamValues,
  SizeCode,
  TemplateSchema,
} from "@/lib/cad/types";
import { getBaggyJeanDefaults } from "@/templates/baggy-jean/schema";
import { SIZE_DEFINITIONS } from "@/templates/circle-skirt/grading";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

interface ParameterPanelProps {
  templateId: string;
  schema: TemplateSchema;
  values: ParamValues;
  baseSize: SizeCode;
  formulas: FormulaItem[];
  warnings: string[];
  onChange: (key: string, value: ParamValue) => void;
  onApplyPreset: (patch: Partial<ParamValues>) => void;
  onBaseSizeChange: (size: SizeCode) => void;
  onReset: () => void;
}

export function ParameterPanel({
  templateId,
  schema,
  values,
  baseSize,
  formulas,
  warnings,
  onChange,
  onApplyPreset,
  onBaseSizeChange,
  onReset,
}: ParameterPanelProps) {
  const renderField = (field: ParamField) => {
    const current = values[field.key] ?? field.defaultValue;

    if (field.type === "number") {
      const numVal = Number(current);
      return (
        <div key={field.key} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`param-${field.key}`} className="text-xs font-medium text-[#0F172A]">
              {field.label}
            </Label>
            <div className="flex items-center gap-1 shrink-0">
              <Input
                id={`param-${field.key}`}
                type="number"
                value={numVal}
                min={field.min}
                max={field.max}
                step={field.step}
                onChange={(e) => {
                  const parsed = parseFloat(e.target.value);
                  if (!Number.isNaN(parsed)) {
                    onChange(field.key, parsed);
                  }
                }}
                onBlur={(e) => {
                  const parsed = parseFloat(e.target.value);
                  if (Number.isNaN(parsed)) {
                    onChange(field.key, field.defaultValue);
                  } else {
                    const clamped = Math.min(
                      field.max,
                      Math.max(field.min, parsed)
                    );
                    onChange(field.key, clamped);
                  }
                }}
                className="h-7 w-18 px-2 text-right font-mono text-xs font-semibold tabular-nums"
              />
              <span className="w-6 text-[11px] font-medium text-slate-500">
                {field.unit}
              </span>
            </div>
          </div>
          <Slider
            value={[Math.min(field.max, Math.max(field.min, numVal))]}
            min={field.min}
            max={field.max}
            step={field.step}
            onValueChange={([v]) => onChange(field.key, v)}
          />
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>
              {field.min} {field.unit}
            </span>
            <span>
              {field.max} {field.unit}
            </span>
          </div>
        </div>
      );
    }

    if (field.type === "select") {
      if (field.display === "segmented") {
        const cols = field.options.length === 2 ? "grid-cols-2" : "grid-cols-3";
        return (
          <div key={field.key} className="space-y-2">
            <Label className="text-xs font-medium text-[#0F172A]">
              {field.label}
            </Label>
            <div className={cn("grid gap-1.5", cols)}>
              {field.options.map((opt) => {
                const isSelected = String(current) === String(opt.value);
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => onChange(field.key, opt.value)}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-lg border px-2 py-2 text-center transition-all cursor-pointer",
                      isSelected
                        ? "border-[#4F46E5] bg-indigo-50/80 text-[#4F46E5] shadow-2xs ring-1 ring-[#4F46E5]/20"
                        : "border-[#E2E8F0] bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <span className="text-[11px] font-semibold leading-tight">
                      {opt.label}
                    </span>
                    {opt.sublabel && (
                      <span
                        className={cn(
                          "mt-0.5 font-mono text-[10px]",
                          isSelected ? "text-[#4F46E5]/85" : "text-slate-400"
                        )}
                      >
                        {opt.sublabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      return (
        <div key={field.key} className="space-y-1.5">
          <Label className="text-xs font-medium text-[#0F172A]">
            {field.label}
          </Label>
          <Select
            value={String(current)}
            onValueChange={(val) => {
              const matched = field.options.find(
                (o) => String(o.value) === val
              );
              onChange(field.key, matched ? matched.value : val);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((opt) => (
                <SelectItem key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.type === "toggle") {
      const checked = Boolean(current);
      return (
        <div
          key={field.key}
          className="flex items-start justify-between gap-3 rounded-lg border border-[#E2E8F0] bg-slate-50/60 px-3 py-2.5"
        >
          <div className="space-y-0.5">
            <Label
              htmlFor={`param-${field.key}`}
              className="text-xs font-medium text-[#0F172A] cursor-pointer"
            >
              {field.label}
            </Label>
            {field.description && (
              <p className="text-[11px] leading-snug text-slate-500">
                {field.description}
              </p>
            )}
          </div>
          <Switch
            id={`param-${field.key}`}
            checked={checked}
            onCheckedChange={(v) => onChange(field.key, v)}
            className="mt-0.5"
          />
        </div>
      );
    }

    return null;
  };

  return (
    <aside className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-[#4F46E5]" />
          <div>
            <h2 className="text-xs font-semibold text-[#0F172A]">
              Thông số thiết kế (Parameters)
            </h2>
            <p className="text-[10px] text-slate-500">
              Cập nhật hình học realtime • 0.01 mm
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-7 px-2 text-[11px] text-slate-500 hover:text-[#4F46E5]"
          title="Khôi phục thông số mặc định"
        >
          <RotateCcw className="size-3" />
          Mặc định
        </Button>
      </div>

      {/* Scrollable form + realtime formulas */}
      <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-5">
        {/* Base Size Picker */}
        <div className="rounded-lg border border-[#E2E8F0] bg-slate-50/70 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#0F172A]">
              Size gốc nhập liệu (Base Size)
            </span>
            <span className="font-mono text-[10px] text-slate-500">
              {templateId === "baggy-jean"
                ? "+4cm eo/mông • +2.5cm đùi"
                : "+4cm eo / +1cm dài"}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {SIZE_DEFINITIONS.map((sz) => {
              const active = sz.code === baseSize;
              return (
                <button
                  key={sz.code}
                  type="button"
                  onClick={() => onBaseSizeChange(sz.code)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs font-semibold transition-all cursor-pointer",
                    active
                      ? "border-[#4F46E5] bg-white text-[#4F46E5] shadow-2xs ring-1 ring-[#4F46E5]/20"
                      : "border-[#E2E8F0] bg-white/70 text-slate-600 hover:bg-white"
                  )}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: sz.color }}
                  />
                  {sz.code}
                </button>
              );
            })}
          </div>
        </div>

        {/* Standard Body / Tech Pack Quick Presets (from Excel + WV1499LSB-TD) */}
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/35 p-2.5 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0F172A]">
            <UserCheck className="size-3.5 text-[#4F46E5]" />
            Nạp nhanh theo Cốt Chuẩn / Tech Pack
          </div>
          {templateId === "baggy-jean" ? (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onApplyPreset(getBaggyJeanDefaults())}
                className="rounded-md border border-indigo-200 bg-white px-2 py-1.5 text-left transition-colors hover:bg-indigo-50 cursor-pointer"
              >
                <div className="text-[10.5px] font-bold text-[#4F46E5]">
                  WV1499 Size &lt;3&gt;
                </div>
                <div className="font-mono text-[9.5px] text-slate-500">
                  Eo 31&quot; • Mông 40.5&quot;
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  const b = getMannequinBodySpec("women", "M");
                  onApplyPreset({
                    waist: Math.round((b.waistCm + 6) * 2) / 2,
                    hip: Math.round((b.hipCm + 9) * 2) / 2,
                    thigh: Math.round((b.thighCm + 12) * 2) / 2,
                    knee: Math.round((b.kneeCm + 24) * 2) / 2,
                    hemOpening: Math.round((b.hemOpeningCm + 30) * 2) / 2,
                  });
                }}
                className="rounded-md border border-[#E2E8F0] bg-white px-2 py-1.5 text-left transition-colors hover:border-indigo-200 cursor-pointer"
              >
                <div className="text-[10.5px] font-semibold text-[#0F172A]">
                  Cốt Nữ M (TCVN)
                </div>
                <div className="font-mono text-[9.5px] text-slate-500">
                  Cơ thể Eo 69 / Mông 93
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  const b = getMannequinBodySpec("women", "L");
                  onApplyPreset({
                    waist: Math.round((b.waistCm + 6) * 2) / 2,
                    hip: Math.round((b.hipCm + 9) * 2) / 2,
                    thigh: Math.round((b.thighCm + 12) * 2) / 2,
                    knee: Math.round((b.kneeCm + 24) * 2) / 2,
                    hemOpening: Math.round((b.hemOpeningCm + 30) * 2) / 2,
                  });
                }}
                className="rounded-md border border-[#E2E8F0] bg-white px-2 py-1.5 text-left transition-colors hover:border-indigo-200 cursor-pointer"
              >
                <div className="text-[10.5px] font-semibold text-[#0F172A]">
                  Cốt Nữ L (TCVN)
                </div>
                <div className="font-mono text-[9.5px] text-slate-500">
                  Cơ thể Eo 73 / Mông 97
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  const b = getMannequinBodySpec("men", "M");
                  onApplyPreset({
                    waist: Math.round((b.waistCm + 5) * 2) / 2,
                    hip: Math.round((b.hipCm + 10) * 2) / 2,
                    thigh: Math.round((b.thighCm + 11) * 2) / 2,
                    knee: Math.round((b.kneeCm + 22) * 2) / 2,
                    hemOpening: Math.round((b.hemOpeningCm + 26) * 2) / 2,
                  });
                }}
                className="rounded-md border border-[#E2E8F0] bg-white px-2 py-1.5 text-left transition-colors hover:border-indigo-200 cursor-pointer"
              >
                <div className="text-[10.5px] font-semibold text-[#0F172A]">
                  Cốt Nam M (TCVN)
                </div>
                <div className="font-mono text-[9.5px] text-slate-500">
                  Cơ thể Eo 75 / Mông 91
                </div>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {(["S", "M", "L"] as const).map((sz) => {
                const b = getMannequinBodySpec("women", sz);
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => onApplyPreset({ waist: b.waistCm })}
                    className="rounded-md border border-[#E2E8F0] bg-white px-2 py-1.5 text-center transition-colors hover:border-indigo-200 cursor-pointer"
                  >
                    <div className="text-[10.5px] font-semibold text-[#0F172A]">
                      Nữ {sz}
                    </div>
                    <div className="font-mono text-[9.5px] text-slate-500">
                      Eo {b.waistCm}cm
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Dynamic Schema Groups */}
        {schema.groups.map((group, groupIdx) => {
          const groupFields = schema.fields.filter((f) => f.group === group.id);
          if (groupFields.length === 0) return null;
          return (
            <div key={group.id} className="space-y-3.5">
              {groupIdx > 0 && <Separator />}
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.title}
                </h3>
              </div>
              <div className="space-y-4">
                {groupFields.map((field) => renderField(field))}
              </div>
            </div>
          );
        })}

        {/* Technical Warnings */}
        {warnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <AlertTriangle className="size-3.5 shrink-0" />
              Lưu ý kỹ thuật cắt (Cutting Note)
            </div>
            {warnings.map((w, i) => (
              <p key={i} className="text-[11px] leading-relaxed text-amber-800/90">
                {w}
              </p>
            ))}
          </div>
        )}

        <Separator />

        {/* Realtime Mathematical Formulas Card */}
        <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Calculator className="size-3.5 text-[#4F46E5]" />
              <h3 className="text-xs font-semibold text-[#0F172A]">
                Công thức tính Realtime (Live Math)
              </h3>
            </div>
            <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#4F46E5] border border-indigo-200">
              Size {baseSize}
            </span>
          </div>

          <div className="space-y-2.5">
            {formulas.map((f) => (
              <div
                key={f.id}
                className="rounded-lg border border-indigo-100 bg-white px-2.5 py-2 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold text-[#4F46E5]">
                    {f.symbol}
                  </span>
                  <span className="font-mono text-xs font-bold text-[#0F172A] tabular-nums">
                    {f.displayValue ?? `${f.valueCm.toFixed(2)} cm`}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] font-medium text-slate-600">
                  {f.label}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2 border-t border-slate-100 pt-1 font-mono text-[10px] text-slate-400">
                  <span className="truncate" title={`${f.expression} = ${f.substitution}`}>
                    = {f.substitution}
                  </span>
                  {!f.displayValue && (
                    <span className="shrink-0 text-slate-500">
                      {f.valueMm.toFixed(2)} mm
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
