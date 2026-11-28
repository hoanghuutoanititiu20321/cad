import React from "react";
import { pathToSvgD } from "@/lib/cad/math";
import {
  baggyJeanTemplate,
  bomberJacketTemplate,
  circleSkirtTemplate,
  colorblockPoloTemplate,
} from "@/templates/registry";

interface TemplateThumbnailProps {
  templateId: string;
}

const ACTIVE_TEMPLATE_MAP = {
  "circle-skirt": circleSkirtTemplate,
  "baggy-jean": baggyJeanTemplate,
  "bomber-jacket": bomberJacketTemplate,
  "colorblock-polo": colorblockPoloTemplate,
} as const;

export function TemplateThumbnail({ templateId }: TemplateThumbnailProps) {
  if (templateId in ACTIVE_TEMPLATE_MAP) {
    const tpl =
      ACTIVE_TEMPLATE_MAP[templateId as keyof typeof ACTIVE_TEMPLATE_MAP];
    const grading = tpl.generateGrading(tpl.getDefaultParams(), "M");
    const bbox = grading.combinedBbox;
    const pad = Math.max(bbox.width, bbox.height) * 0.06 + 40;
    const viewBox = `${bbox.minX - pad} ${bbox.minY - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`;
    const useColorblockFill =
      templateId === "colorblock-polo" || templateId === "bomber-jacket";

    return (
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
      >
        {[...grading.entries].reverse().map((entry) => (
          <g key={entry.size}>
            {entry.geometry.pieces.map((piece) =>
              piece.cutPaths.map((cp) => (
                <path
                  key={`${entry.size}-${cp.id}`}
                  d={pathToSvgD(cp)}
                  fill={
                    entry.isBase
                      ? useColorblockFill && piece.displayColor
                        ? piece.displayColor
                        : entry.color
                      : "none"
                  }
                  fillOpacity={
                    entry.isBase
                      ? useColorblockFill && piece.displayColor
                        ? 0.22
                        : 0.06
                      : 0
                  }
                  fillRule="evenodd"
                  stroke={entry.color}
                  strokeWidth={entry.isBase ? 1.8 : 1.05}
                  vectorEffect="non-scaling-stroke"
                />
              ))
            )}
          </g>
        ))}
      </svg>
    );
  }

  if (templateId === "basic-shift-dress") {
    return (
      <svg viewBox="0 0 220 180" className="h-full w-full text-slate-400">
        <path
          d="M 48 26 Q 66 36 84 26 L 100 34 C 95 54 96 66 104 72 L 108 156 L 36 156 L 40 72 C 48 66 49 54 44 34 Z"
          fill="#F8FAFC"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M 132 28 Q 152 33 172 28 L 186 35 C 182 54 183 66 190 72 L 194 156 L 122 156 L 126 72 C 133 66 134 54 128 35 Z"
          fill="#F8FAFC"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <path d="M 42 74 L 62 78 L 41 84" fill="none" stroke="#94A3B8" strokeWidth="1.1" />
        <line x1="72" y1="54" x2="72" y2="136" stroke="#0F766E" strokeWidth="1" strokeOpacity="0.6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 220 180" className="h-full w-full text-slate-400">
      <path
        d="M 38 30 Q 56 40 74 30 L 92 38 C 88 58 90 68 98 74 L 96 150 Q 66 158 34 150 L 32 74 C 40 68 42 58 38 38 Z"
        fill="#F8FAFC"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M 118 58 C 132 28 168 28 182 58 L 172 146 L 128 146 Z"
        fill="#F8FAFC"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M 122 158 L 178 158 L 186 170 L 114 170 Z"
        fill="#F8FAFC"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <line x1="150" y1="54" x2="150" y2="132" stroke="#0F766E" strokeWidth="1" strokeOpacity="0.6" />
    </svg>
  );
}
