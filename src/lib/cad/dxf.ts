import {
  Colors,
  DxfWriter,
  Units,
  point3d,
} from "@tarikjabiri/dxf";
import {
  evalCubicBezier,
  radToDeg,
  roundMm,
} from "./math";
import type {
  NestedGradingResult,
  PatternPiece,
  Point2D,
  SizeCode,
  VectorPath,
} from "./types";

export type DxfUnit = "mm" | "cm";

export interface DxfExportOptions {
  /** Which sizes to include (1 size = single export, multiple = nested export in 1 file) */
  sizes: SizeCode[];
  /** Export unit (1:1 true scale in millimeters or centimeters) */
  unit?: DxfUnit;
  includeSeamLines: boolean;
  includeGrainlines: boolean;
  includeNotches: boolean;
  includeAnnotations: boolean;
  templateName: string;
  /** Legacy compatibility option */
  mode?: "nested" | "base";
  visibleSizes?: SizeCode[];
}

export interface DxfExportResult {
  content: string;
  filename: string;
  entityCount: number;
  byteSize: number;
  unit: DxfUnit;
  exportedSizes: SizeCode[];
}

/**
 * Standard Garment Industry AAMA / ASTM Layer Definitions
 * Compatible with Gerber AccuMark, Optitex PDS, CLO3D, and AutoCAD:
 * - Layer 1:  Cut Line (Đường cắt - nét liền)
 * - Layer 4:  Seam / Sew Line (Đường may - nét đứt)
 * - Layer 7:  Notches (Dấu bấm)
 * - Layer 8:  Grainline (Đường canh sợi)
 * - Layer 11: Text Annotations (Tên mảnh, size, số lượng cắt x1/x2)
 */
export const GARMENT_DXF_LAYERS = {
  CUT: "1",
  SEAM: "4",
  NOTCH: "7",
  GRAINLINE: "8",
  TEXT: "11",
} as const;

const SIZE_ACI_COLORS: Record<SizeCode, number> = {
  S: Colors.Green, // 3
  M: Colors.Blue, // 5
  L: 30, // Orange/Amber
  XL: Colors.Red, // 1
};

function normalizeDeg360(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return Math.round((d + Number.EPSILON) * 1000) / 1000;
}

function toAsciiSafe(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/×/g, "x")
    .replace(/[^\x20-\x7E]/g, " ");
}

function roundUnit(val: number, unit: DxfUnit): number {
  const factor = unit === "cm" ? 1000 : 100; // 0.01 mm precision in both mm & cm
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

function makeCoordinateMapper(offsetXMm: number, maxYMm: number, unit: DxfUnit) {
  const scale = unit === "cm" ? 0.1 : 1;
  return (p: Point2D) =>
    point3d(
      roundUnit((p.x - offsetXMm) * scale, unit),
      roundUnit((maxYMm - p.y) * scale, unit),
      0
    );
}

function emitVectorPath(
  dxf: DxfWriter,
  path: VectorPath,
  layerName: string,
  colorNumber: number | undefined,
  lineType: string | undefined,
  unit: DxfUnit,
  mapPt: (p: Point2D) => ReturnType<typeof point3d>
): number {
  const unitScale = unit === "cm" ? 0.1 : 1;
  const opts = {
    layerName,
    ...(colorNumber !== undefined ? { colorNumber } : {}),
    ...(lineType ? { lineType } : {}),
  };

  let count = 0;
  let cursor: Point2D = { x: 0, y: 0 };
  let startPt: Point2D = { x: 0, y: 0 };
  const hasFullCircle = path.segments.some(
    (s) => s.type === "A" && s.fullCircle
  );

  for (const seg of path.segments) {
    if (seg.type === "M") {
      cursor = seg.to;
      startPt = seg.to;
    } else if (seg.type === "L") {
      if (Math.hypot(seg.to.x - cursor.x, seg.to.y - cursor.y) > 0.01) {
        dxf.addLine(mapPt(cursor), mapPt(seg.to), opts);
        count++;
      }
      cursor = seg.to;
    } else if (seg.type === "A") {
      if (seg.fullCircle && seg.center && seg.radius) {
        dxf.addCircle(
          mapPt(seg.center),
          roundUnit(seg.radius * unitScale, unit),
          opts
        );
        count++;
      } else if (
        seg.center &&
        seg.radius !== undefined &&
        seg.startAngle !== undefined &&
        seg.endAngle !== undefined
      ) {
        const isSecondHalfOfCircle =
          hasFullCircle &&
          Math.abs(seg.startAngle - Math.PI) < 1e-6 &&
          Math.abs(seg.endAngle - Math.PI * 2) < 1e-6;

        if (!isSecondHalfOfCircle) {
          // Flipping Y -> -Y reverses angle sign & sweep direction; DXF ARC always sweeps CCW
          const a1 = radToDeg(seg.startAngle);
          const a2 = radToDeg(seg.endAngle);
          const dxfStart = normalizeDeg360(seg.sweep === 1 ? -a2 : -a1);
          const dxfEnd = normalizeDeg360(seg.sweep === 1 ? -a1 : -a2);
          dxf.addArc(
            mapPt(seg.center),
            roundUnit(seg.radius * unitScale, unit),
            dxfStart,
            dxfEnd,
            opts
          );
          count++;
        }
      } else {
        dxf.addLine(mapPt(cursor), mapPt(seg.to), opts);
        count++;
      }
      cursor = seg.to;
    } else if (seg.type === "C") {
      const steps = 32;
      let prev = cursor;
      for (let i = 1; i <= steps; i++) {
        const curr = evalCubicBezier(cursor, seg.cp1, seg.cp2, seg.to, i / steps);
        dxf.addLine(mapPt(prev), mapPt(curr), opts);
        count++;
        prev = curr;
      }
      cursor = seg.to;
    } else if (seg.type === "Z") {
      if (Math.hypot(startPt.x - cursor.x, startPt.y - cursor.y) > 0.05) {
        dxf.addLine(mapPt(cursor), mapPt(startPt), opts);
        count++;
      }
      cursor = startPt;
    }
  }

  return count;
}

function emitPiece(
  dxf: DxfWriter,
  piece: PatternPiece,
  size: SizeCode,
  isPrimaryForMarkings: boolean,
  isMultiSize: boolean,
  exportedSizesLabel: string,
  unit: DxfUnit,
  options: DxfExportOptions,
  mapPt: (p: Point2D) => ReturnType<typeof point3d>
): number {
  let count = 0;
  const unitScale = unit === "cm" ? 0.1 : 1;
  const sizeColor = isMultiSize ? SIZE_ACI_COLORS[size] : Colors.White;

  // Layer 1: Cut Lines (Đường cắt — Nét liền)
  for (const path of piece.cutPaths) {
    count += emitVectorPath(
      dxf,
      path,
      GARMENT_DXF_LAYERS.CUT,
      sizeColor,
      "Continuous",
      unit,
      mapPt
    );
  }

  // Layer 4: Seam Lines (Đường may — Nét đứt)
  if (options.includeSeamLines) {
    for (const path of piece.sewPaths) {
      count += emitVectorPath(
        dxf,
        path,
        GARMENT_DXF_LAYERS.SEAM,
        isMultiSize ? sizeColor : Colors.Blue,
        "DASHED",
        unit,
        mapPt
      );
    }
  }

  // Internal lines (zipper slit, center fold reference) on Layer 4
  if (isPrimaryForMarkings) {
    for (const path of piece.internalPaths) {
      count += emitVectorPath(
        dxf,
        path,
        GARMENT_DXF_LAYERS.SEAM,
        Colors.Blue,
        "DASHED",
        unit,
        mapPt
      );
    }
  }

  // Layer 7: Notches (Dấu bấm)
  if (options.includeNotches && isPrimaryForMarkings) {
    for (const notch of piece.notches) {
      const origin = notch.cutPoint ?? notch.point;
      const tip: Point2D = {
        x: roundMm(origin.x + Math.cos(notch.angle) * notch.depth),
        y: roundMm(origin.y + Math.sin(notch.angle) * notch.depth),
      };
      dxf.addLine(mapPt(origin), mapPt(tip), {
        layerName: GARMENT_DXF_LAYERS.NOTCH,
        colorNumber: Colors.Magenta,
      });
      count++;

      if (notch.style === "T") {
        const perp = notch.angle + Math.PI / 2;
        const tA: Point2D = {
          x: roundMm(tip.x + Math.cos(perp) * 3.5),
          y: roundMm(tip.y + Math.sin(perp) * 3.5),
        };
        const tB: Point2D = {
          x: roundMm(tip.x - Math.cos(perp) * 3.5),
          y: roundMm(tip.y - Math.sin(perp) * 3.5),
        };
        dxf.addLine(mapPt(tA), mapPt(tB), {
          layerName: GARMENT_DXF_LAYERS.NOTCH,
          colorNumber: Colors.Magenta,
        });
        count++;
      }
    }
  }

  // Layer 8: Grainline (Đường canh sợi)
  if (options.includeGrainlines && isPrimaryForMarkings) {
    const g = piece.grainline;
    const grainOpts = {
      layerName: GARMENT_DXF_LAYERS.GRAINLINE,
      colorNumber: Colors.Cyan,
    };
    dxf.addLine(mapPt(g.start), mapPt(g.end), grainOpts);
    count++;

    const angle = Math.atan2(g.end.y - g.start.y, g.end.x - g.start.x);
    const arrowLen = 10;
    const spread = 0.42;

    const s1 = {
      x: g.start.x + Math.cos(angle + spread) * arrowLen,
      y: g.start.y + Math.sin(angle + spread) * arrowLen,
    };
    const s2 = {
      x: g.start.x + Math.cos(angle - spread) * arrowLen,
      y: g.start.y + Math.sin(angle - spread) * arrowLen,
    };
    dxf.addLine(mapPt(g.start), mapPt(s1), grainOpts);
    dxf.addLine(mapPt(g.start), mapPt(s2), grainOpts);

    const e1 = {
      x: g.end.x - Math.cos(angle + spread) * arrowLen,
      y: g.end.y - Math.sin(angle + spread) * arrowLen,
    };
    const e2 = {
      x: g.end.x - Math.cos(angle - spread) * arrowLen,
      y: g.end.y - Math.sin(angle - spread) * arrowLen,
    };
    dxf.addLine(mapPt(g.end), mapPt(e1), grainOpts);
    dxf.addLine(mapPt(g.end), mapPt(e2), grainOpts);
    count += 4;
  }

  // Layer 11: Text Annotations (Tên mảnh, size, số lượng cắt x1/x2)
  if (options.includeAnnotations) {
    if (isPrimaryForMarkings) {
      const labelBase = mapPt(piece.labelAnchor);
      const hTitle = roundUnit(10 * unitScale, unit);
      const hSub = roundUnit(7.5 * unitScale, unit);
      const lineGap = roundUnit(13 * unitScale, unit);

      dxf.addText(
        point3d(labelBase.x - roundUnit(55 * unitScale, unit), labelBase.y + lineGap, 0),
        hTitle,
        toAsciiSafe(`${piece.code} - ${piece.englishName.toUpperCase()}`),
        { layerName: GARMENT_DXF_LAYERS.TEXT, colorNumber: Colors.White }
      );
      dxf.addText(
        point3d(labelBase.x - roundUnit(55 * unitScale, unit), labelBase.y, 0),
        hSub,
        toAsciiSafe(`CUT x${piece.cutQuantity} (${piece.material.toUpperCase()}) | SIZE: ${exportedSizesLabel}`),
        { layerName: GARMENT_DXF_LAYERS.TEXT, colorNumber: Colors.White }
      );
      count += 2;
    }

    // Individual size tag on contour when nested multi-size
    if (isMultiSize) {
      const tagKp =
        piece.id === "skirt-panel"
          ? piece.keyPoints.find((k) => k.code === "P5") ?? piece.keyPoints[0]
          : piece.keyPoints.find((k) => k.code === "W3") ?? piece.keyPoints[0];
      if (tagKp) {
        const p = mapPt(tagKp.point);
        dxf.addText(
          point3d(p.x + roundUnit(6 * unitScale, unit), p.y, 0),
          roundUnit(6.5 * unitScale, unit),
          size,
          { layerName: GARMENT_DXF_LAYERS.TEXT, colorNumber: sizeColor }
        );
        count++;
      }
    }
  }

  return count;
}

/**
 * Generate an industrial garment-standard DXF file via @tarikjabiri/dxf.
 * Layers strictly follow garment CAD convention:
 * - Layer 1:  Cut Line
 * - Layer 4:  Seam Line (DASHED)
 * - Layer 7:  Notches
 * - Layer 8:  Grainline
 * - Layer 11: Piece / Size / Cut Qty Text Annotations
 */
export function generatePatternDxf(
  grading: NestedGradingResult,
  options: DxfExportOptions
): DxfExportResult {
  const unit: DxfUnit = options.unit ?? "mm";

  // Resolve sizes cleanly (supports both new `sizes` array and legacy `mode`/`visibleSizes`)
  let targetSizes: SizeCode[] = options.sizes;
  if (!targetSizes || targetSizes.length === 0) {
    targetSizes =
      options.mode === "base"
        ? [grading.baseSize]
        : options.visibleSizes && options.visibleSizes.length > 0
          ? options.visibleSizes
          : grading.sizes;
  }

  const entriesToExport = grading.entries.filter((e) =>
    targetSizes.includes(e.size)
  );
  const effectiveEntries =
    entriesToExport.length > 0
      ? entriesToExport
      : [grading.entries.find((e) => e.isBase) ?? grading.entries[0]];

  const exportedSizes = effectiveEntries.map((e) => e.size);
  const isMultiSize = effectiveEntries.length > 1;
  const exportedSizesLabel = exportedSizes.join("-");

  const dxf = new DxfWriter();
  dxf.setUnits(unit === "cm" ? Units.Centimeters : Units.Millimeters);
  dxf.setVariable("$MEASUREMENT", { 70: 1 }); // Metric system

  // Line types
  const dashLen = unit === "cm" ? 0.8 : 8.0;
  const gapLen = unit === "cm" ? -0.4 : -4.0;
  dxf.addLType("DASHED", "Dashed __ __ __", [dashLen, gapLen]);

  // Standard Garment CAD Layers (1, 4, 7, 8, 11)
  dxf.addLayer(GARMENT_DXF_LAYERS.CUT, Colors.White, "Continuous");
  dxf.addLayer(GARMENT_DXF_LAYERS.SEAM, Colors.Blue, "DASHED");
  dxf.addLayer(GARMENT_DXF_LAYERS.NOTCH, Colors.Magenta, "Continuous");
  dxf.addLayer(GARMENT_DXF_LAYERS.GRAINLINE, Colors.Cyan, "Continuous");
  dxf.addLayer(GARMENT_DXF_LAYERS.TEXT, Colors.White, "Continuous");

  const bbox = grading.combinedBbox;
  const padMm = 20;
  const mapPt = makeCoordinateMapper(bbox.minX - padMm, bbox.maxY + padMm, unit);

  // Set drawing extents accurately for immediate Zoom Extents in CAD viewers
  const unitScale = unit === "cm" ? 0.1 : 1;
  dxf.setVariable("$EXTMIN", { 10: 0, 20: 0, 30: 0 });
  dxf.setVariable("$EXTMAX", {
    10: roundUnit((bbox.width + padMm * 2) * unitScale, unit),
    20: roundUnit((bbox.height + padMm * 2) * unitScale, unit),
    30: 0,
  });

  let entityCount = 0;
  const primarySize = exportedSizes.includes(grading.baseSize)
    ? grading.baseSize
    : exportedSizes[0];

  for (const entry of effectiveEntries) {
    const isPrimary = entry.size === primarySize;
    for (const piece of entry.geometry.pieces) {
      entityCount += emitPiece(
        dxf,
        piece,
        entry.size,
        isPrimary,
        isMultiSize,
        exportedSizesLabel,
        unit,
        options,
        mapPt
      );
    }
  }

  const content = dxf.stringify();
  const slug = toAsciiSafe(options.templateName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const filename = `${slug || "pattern"}-${isMultiSize ? `nested-${exportedSizesLabel}` : `size-${exportedSizesLabel}`}-${unit}.dxf`;

  return {
    content,
    filename,
    entityCount,
    byteSize: new TextEncoder().encode(content).length,
    unit,
    exportedSizes,
  };
}
