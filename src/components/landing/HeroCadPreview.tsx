"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, DraftingCompass, Layers } from "lucide-react";
import { pathToSvgD } from "@/lib/cad/math";
import { circleSkirtTemplate } from "@/templates/registry";
import { cn } from "@/lib/utils";

const QUICK_ANGLES = [
  { angle: 180, label: "180° Bán nguyệt" },
  { angle: 270, label: "270° Xòe 3/4" },
  { angle: 360, label: "360° Tròn đủ" },
  { angle: 90, label: "90° Xòe 1/4" },
] as const;

export function HeroCadPreview() {
  const [flareAngle, setFlareAngle] = useState<number>(180);

  const grading = useMemo(() => {
    const defaults = circleSkirtTemplate.getDefaultParams();
    return circleSkirtTemplate.generateGrading(
      {
        ...defaults,
        flareAngle,
        pieceMultiplier: flareAngle === 360 ? 2 : 1,
      },
      "M"
    );
  }, [flareAngle]);

  const baseEntry =
    grading.entries.find((e) => e.isBase) ?? grading.entries[1];
  const bbox = grading.combinedBbox;
  const pad = Math.max(bbox.width, bbox.height) * 0.08 + 45;
  const viewBox = `${bbox.minX - pad} ${bbox.minY - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`;

  return (
    <div className="relative rounded-2xl border border-[#E2E8F0] bg-white shadow-xl shadow-slate-200/60 overflow-hidden">
      {/* Window chrome / CAD Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-slate-50/90 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-slate-300" />
            <span className="size-2.5 rounded-full bg-slate-300" />
            <span className="size-2.5 rounded-full bg-slate-300" />
          </span>
          <span className="ml-2 font-mono text-[11px] font-semibold text-slate-600">
            chan-vay-xoe-nested-S-XL.dxf
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#4F46E5]">
            <DraftingCompass className="size-2.5" />
            Vector 0.01 mm
          </span>
        </div>
      </div>

      {/* Interactive angle switcher bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] bg-white px-4 py-2">
        <div className="flex items-center gap-1.5">
          {QUICK_ANGLES.map((item) => (
            <button
              key={item.angle}
              type="button"
              onClick={() => setFlareAngle(item.angle)}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-medium transition-all cursor-pointer",
                flareAngle === item.angle
                  ? "border-[#4F46E5] bg-indigo-50 text-[#4F46E5] font-semibold"
                  : "border-[#E2E8F0] bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          {grading.entries.map((e) => (
            <span
              key={e.size}
              className="inline-flex items-center gap-1 font-bold text-slate-700"
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: e.color }}
              />
              {e.size}
            </span>
          ))}
        </div>
      </div>

      {/* Live SVG Vector Preview rendered directly by our CAD engine */}
      <div className="relative h-[380px] sm:h-[420px] w-full cad-grid-bg bg-white">
        <svg
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
        >
          {/* Origin crosshair */}
          <line
            x1={-30}
            y1={0}
            x2={30}
            y2={0}
            stroke="#CBD5E1"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={0}
            y1={-30}
            x2={0}
            y2={30}
            stroke="#CBD5E1"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />

          {/* Nested S-M-L-XL paths */}
          {[...grading.entries].reverse().map((entry) => (
            <g key={entry.size}>
              {entry.geometry.pieces.map((piece) => (
                <g key={`${entry.size}-${piece.id}`}>
                  {entry.isBase &&
                    piece.cutPaths.map((cp) => (
                      <path
                        key={`fill-${cp.id}`}
                        d={pathToSvgD(cp)}
                        fill={entry.color}
                        fillOpacity={0.05}
                        fillRule="evenodd"
                      />
                    ))}
                  {piece.cutPaths.map((cp) => (
                    <path
                      key={`cut-${entry.size}-${cp.id}`}
                      d={pathToSvgD(cp)}
                      fill="none"
                      stroke={entry.color}
                      strokeWidth={entry.isBase ? 2 : 1.35}
                      strokeOpacity={entry.isBase ? 1 : 0.85}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  {entry.isBase &&
                    piece.sewPaths.map((sp) => (
                      <path
                        key={`sew-${sp.id}`}
                        d={pathToSvgD(sp)}
                        fill="none"
                        stroke={entry.color}
                        strokeWidth={1.15}
                        strokeOpacity={0.65}
                        strokeDasharray="5 4"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  {entry.isBase && (
                    <line
                      x1={piece.grainline.start.x}
                      y1={piece.grainline.start.y}
                      x2={piece.grainline.end.x}
                      y2={piece.grainline.end.y}
                      stroke="#0F766E"
                      strokeWidth={1.3}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </g>
              ))}
            </g>
          ))}
        </svg>

        {/* Live Floating Math Overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-white/95 px-3.5 py-2.5 shadow-sm backdrop-blur-xs">
          <div className="flex flex-wrap items-center gap-4 font-mono text-[11px]">
            <div>
              <span className="text-[10px] text-slate-400 block font-sans">
                Bán kính eo (R_waist)
              </span>
              <strong className="text-[#4F46E5]">
                {baseEntry.measurements.rWaistCm.toFixed(2)} cm
              </strong>{" "}
              <span className="text-slate-400">
                ({baseEntry.measurements.rWaistMm.toFixed(2)} mm)
              </span>
            </div>
            <div className="h-6 w-px bg-[#E2E8F0]" />
            <div>
              <span className="text-[10px] text-slate-400 block font-sans">
                Bán kính lai (R_hem)
              </span>
              <strong className="text-[#0F172A]">
                {baseEntry.measurements.rHemCm.toFixed(2)} cm
              </strong>{" "}
              <span className="text-slate-400">
                ({baseEntry.measurements.rHemMm.toFixed(2)} mm)
              </span>
            </div>
          </div>

          <Link
            href="/studio"
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-[#4F46E5] transition-colors hover:bg-indigo-100"
          >
            <Layers className="size-3.5" />
            Tùy chỉnh trong Studio
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
