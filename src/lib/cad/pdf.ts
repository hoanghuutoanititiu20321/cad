import {
  PDFDocument,
  StandardFonts,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import {
  evalCubicBezier,
  polarPoint,
  radToDeg,
  roundCm,
  roundMm,
} from "./math";
import type {
  BoundingBox,
  GradedSizeEntry,
  NestedGradingResult,
  PatternPiece,
  Point2D,
  SizeCode,
  VectorPath,
} from "./types";

/** Exact typographic conversion: 1 inch = 25.4 mm = 72 PDF points */
export const MM_TO_PT = 72 / 25.4;

export interface PdfExportOptions {
  sizes: SizeCode[];
  includeSeamLines: boolean;
  includeGrainlines: boolean;
  includeNotches: boolean;
  includeAnnotations: boolean;
  templateName: string;
}

export interface PdfExportResult {
  bytes: Uint8Array;
  filename: string;
  pageCount: number;
  gridInfo?: { cols: number; rows: number; printedTiles: number };
}

const SIZE_PDF_COLORS: Record<SizeCode, RGB> = {
  S: rgb(0.02, 0.59, 0.41), // Emerald #059669
  M: rgb(0.31, 0.27, 0.9), // Royal Indigo #4F46E5
  L: rgb(0.85, 0.47, 0.02), // Amber #D97706
  XL: rgb(0.88, 0.11, 0.28), // Rose #E11D48
};

const COLOR_SLATE = rgb(0.06, 0.09, 0.16);
const COLOR_MUTED = rgb(0.39, 0.45, 0.55);
const COLOR_BORDER = rgb(0.82, 0.85, 0.9);
const COLOR_GRAIN = rgb(0.06, 0.46, 0.43);
const COLOR_NOTCH = rgb(0.49, 0.23, 0.93);

function toAscii(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/×/g, "x")
    .replace(/[^\x20-\x7E]/g, " ");
}

function slugify(text: string): string {
  return toAscii(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Sample a VectorPath into contiguous polylines (in mm) at high resolution (~1.5° per arc step)
 * so arcs and cubic Beziers render razor-sharp at 1:1 scale on A0 plotters and A4 printers.
 */
function pathToPolylinesMm(path: VectorPath): Point2D[][] {
  const polylines: Point2D[][] = [];
  let current: Point2D[] = [];
  let cursor: Point2D = { x: 0, y: 0 };
  let startPt: Point2D = { x: 0, y: 0 };

  for (const seg of path.segments) {
    if (seg.type === "M") {
      if (current.length > 1) polylines.push(current);
      cursor = seg.to;
      startPt = seg.to;
      current = [cursor];
    } else if (seg.type === "L") {
      cursor = seg.to;
      current.push(cursor);
    } else if (seg.type === "A") {
      if (
        seg.center &&
        seg.radius !== undefined &&
        seg.startAngle !== undefined &&
        seg.endAngle !== undefined
      ) {
        const diff = seg.endAngle - seg.startAngle;
        const steps = Math.max(12, Math.ceil(Math.abs(radToDeg(diff)) / 1.5));
        for (let i = 1; i <= steps; i++) {
          const a = seg.startAngle + (diff * i) / steps;
          current.push(polarPoint(seg.center, seg.radius, a));
        }
      } else {
        current.push(seg.to);
      }
      cursor = seg.to;
    } else if (seg.type === "C") {
      const steps = 32;
      for (let i = 1; i <= steps; i++) {
        current.push(evalCubicBezier(cursor, seg.cp1, seg.cp2, seg.to, i / steps));
      }
      cursor = seg.to;
    } else if (seg.type === "Z") {
      current.push(startPt);
      if (current.length > 1) polylines.push(current);
      current = [];
      cursor = startPt;
    }
  }

  if (current.length > 1) polylines.push(current);
  return polylines;
}

function drawPolyline(
  page: PDFPage,
  points: Point2D[],
  mapPt: (p: Point2D) => { x: number; y: number },
  style: {
    color: RGB;
    thickness: number;
    dashArray?: number[];
    opacity?: number;
  }
) {
  for (let i = 1; i < points.length; i++) {
    const a = mapPt(points[i - 1]);
    const b = mapPt(points[i]);
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.05) continue;
    page.drawLine({
      start: a,
      end: b,
      color: style.color,
      thickness: style.thickness,
      dashArray: style.dashArray,
      opacity: style.opacity ?? 1,
    });
  }
}

function drawPieceOnPage(
  page: PDFPage,
  piece: PatternPiece,
  size: SizeCode,
  isPrimary: boolean,
  isMultiSize: boolean,
  scaleFactor: number, // 1.0 for true 1:1 mm -> pt, or < 1 for overview map
  mapPt: (p: Point2D) => { x: number; y: number },
  options: PdfExportOptions,
  font: PDFFont,
  fontBold: PDFFont
) {
  const color = isMultiSize ? SIZE_PDF_COLORS[size] : COLOR_SLATE;
  const cutThickness = (isPrimary ? 1.35 : 0.95) * Math.max(0.55, scaleFactor);
  const sewThickness = (isPrimary ? 0.85 : 0.65) * Math.max(0.5, scaleFactor);

  // Cut lines (solid)
  for (const cp of piece.cutPaths) {
    for (const poly of pathToPolylinesMm(cp)) {
      drawPolyline(page, poly, mapPt, {
        color,
        thickness: cutThickness,
      });
    }
  }

  // Sew lines (dashed)
  if (options.includeSeamLines) {
    for (const sp of piece.sewPaths) {
      for (const poly of pathToPolylinesMm(sp)) {
        drawPolyline(page, poly, mapPt, {
          color,
          thickness: sewThickness,
          dashArray: [5, 3.5],
          opacity: isPrimary ? 0.85 : 0.55,
        });
      }
    }
  }

  if (!isPrimary) return;

  // Internal lines
  for (const ip of piece.internalPaths) {
    for (const poly of pathToPolylinesMm(ip)) {
      drawPolyline(page, poly, mapPt, {
        color: COLOR_MUTED,
        thickness: 0.6,
        dashArray: [4, 3],
        opacity: 0.75,
      });
    }
  }

  // Grainline
  if (options.includeGrainlines) {
    const g = piece.grainline;
    const gs = mapPt(g.start);
    const ge = mapPt(g.end);
    page.drawLine({
      start: gs,
      end: ge,
      color: COLOR_GRAIN,
      thickness: 0.95,
    });
    const angle = Math.atan2(g.end.y - g.start.y, g.end.x - g.start.x);
    const arrowLen = 9;
    const spread = 0.42;
    for (const [tip, dir] of [
      [g.start, angle],
      [g.end, angle + Math.PI],
    ] as const) {
      const p1 = mapPt({
        x: tip.x + Math.cos(dir + spread) * arrowLen,
        y: tip.y + Math.sin(dir + spread) * arrowLen,
      });
      const p2 = mapPt({
        x: tip.x + Math.cos(dir - spread) * arrowLen,
        y: tip.y + Math.sin(dir - spread) * arrowLen,
      });
      const t = mapPt(tip);
      page.drawLine({ start: t, end: p1, color: COLOR_GRAIN, thickness: 0.95 });
      page.drawLine({ start: t, end: p2, color: COLOR_GRAIN, thickness: 0.95 });
    }
  }

  // Notches
  if (options.includeNotches) {
    for (const n of piece.notches) {
      const origin = n.cutPoint ?? n.point;
      const tip = {
        x: origin.x + Math.cos(n.angle) * n.depth,
        y: origin.y + Math.sin(n.angle) * n.depth,
      };
      page.drawLine({
        start: mapPt(origin),
        end: mapPt(tip),
        color: COLOR_NOTCH,
        thickness: 1.1,
      });
      if (n.style === "T") {
        const perp = n.angle + Math.PI / 2;
        page.drawLine({
          start: mapPt({
            x: tip.x + Math.cos(perp) * 3.5,
            y: tip.y + Math.sin(perp) * 3.5,
          }),
          end: mapPt({
            x: tip.x - Math.cos(perp) * 3.5,
            y: tip.y - Math.sin(perp) * 3.5,
          }),
          color: COLOR_NOTCH,
          thickness: 1.1,
        });
      }
    }
  }

  // Piece annotations
  if (options.includeAnnotations && scaleFactor >= 0.4) {
    const anchor = mapPt(piece.labelAnchor);
    page.drawText(toAscii(`${piece.code} - ${piece.englishName.toUpperCase()}`), {
      x: anchor.x - 65,
      y: anchor.y + 8,
      size: 9.5,
      font: fontBold,
      color: COLOR_SLATE,
    });
    page.drawText(
      toAscii(`CUT x${piece.cutQuantity} | SIZE ${options.sizes.join("-")}`),
      {
        x: anchor.x - 65,
        y: anchor.y - 4,
        size: 7.5,
        font,
        color: COLOR_MUTED,
      }
    );
  }
}

function drawCalibrationSquare(
  page: PDFPage,
  xPt: number,
  yPt: number,
  font: PDFFont,
  fontBold: PDFFont
) {
  const sqPt = 50 * MM_TO_PT; // Exact 50 mm × 50 mm square
  page.drawRectangle({
    x: xPt,
    y: yPt,
    width: sqPt,
    height: sqPt,
    borderColor: COLOR_SLATE,
    borderWidth: 1,
  });
  // Inner 10mm reference ticks
  page.drawLine({
    start: { x: xPt, y: yPt + sqPt / 2 },
    end: { x: xPt + 6, y: yPt + sqPt / 2 },
    color: COLOR_MUTED,
    thickness: 0.7,
  });
  page.drawLine({
    start: { x: xPt + sqPt / 2, y: yPt },
    end: { x: xPt + sqPt / 2, y: yPt + 6 },
    color: COLOR_MUTED,
    thickness: 0.7,
  });
  page.drawText("50 x 50 mm", {
    x: xPt + 24,
    y: yPt + sqPt / 2 + 4,
    size: 9,
    font: fontBold,
    color: COLOR_SLATE,
  });
  page.drawText("TEST SCALE 100%", {
    x: xPt + 16,
    y: yPt + sqPt / 2 - 10,
    size: 7.5,
    font,
    color: COLOR_MUTED,
  });
}

function resolveEntries(
  grading: NestedGradingResult,
  sizes: SizeCode[]
): { entries: GradedSizeEntry[]; primarySize: SizeCode; bbox: BoundingBox } {
  const filtered = grading.entries.filter((e) => sizes.includes(e.size));
  const entries =
    filtered.length > 0
      ? filtered
      : [grading.entries.find((e) => e.isBase) ?? grading.entries[0]];

  const primarySize = entries.some((e) => e.size === grading.baseSize)
    ? grading.baseSize
    : entries[0].size;

  // Compute tight bounding box across selected entries
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const e of entries) {
    const b = e.geometry.bbox;
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }

  return {
    entries,
    primarySize,
    bbox: {
      minX: roundMm(minX),
      minY: roundMm(minY),
      maxX: roundMm(maxX),
      maxY: roundMm(maxY),
      width: roundMm(maxX - minX),
      height: roundMm(maxY - minY),
    },
  };
}

/**
 * Export 1:1 Full-Scale Large-Format Plotter PDF (A0: 841mm × 1189mm, auto-expanding if wider/taller).
 */
export async function generatePatternPdfA0(
  grading: NestedGradingResult,
  options: PdfExportOptions
): Promise<PdfExportResult> {
  const { entries, primarySize, bbox } = resolveEntries(grading, options.sizes);
  const isMultiSize = entries.length > 1;

  const marginMm = 35;
  const headerMm = 38;
  const neededW = bbox.width + marginMm * 2;
  const neededH = bbox.height + marginMm * 2 + headerMm;

  // Standard A0 is 841 × 1189 mm (pick portrait or landscape, or roll-fit if pattern is extra wide)
  const useLandscape = neededW > neededH;
  const baseW = useLandscape ? 1189 : 841;
  const baseH = useLandscape ? 841 : 1189;
  const sheetWmm = Math.max(baseW, Math.ceil(neededW / 10) * 10);
  const sheetHmm = Math.max(baseH, Math.ceil(neededH / 10) * 10);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`PatternCAD Pro - ${toAscii(options.templateName)} (A0 1:1)`);
  pdfDoc.setCreator("PatternCAD Pro Parametric Engine");

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([sheetWmm * MM_TO_PT, sheetHmm * MM_TO_PT]);

  // Outer engineering frame
  const mPt = 14 * MM_TO_PT;
  page.drawRectangle({
    x: mPt,
    y: mPt,
    width: (sheetWmm - 28) * MM_TO_PT,
    height: (sheetHmm - 28) * MM_TO_PT,
    borderColor: COLOR_BORDER,
    borderWidth: 1,
  });

  // Top Title Block
  const topY = (sheetHmm - 26) * MM_TO_PT;
  page.drawText(
    toAscii(
      `PATTERNCAD PRO  |  ${options.templateName.toUpperCase()}  |  A0 PLOTTER SHEET (SCALE 1:1)`
    ),
    {
      x: 24 * MM_TO_PT,
      y: topY,
      size: 13,
      font: fontBold,
      color: COLOR_SLATE,
    }
  );
  page.drawText(
    toAscii(
      `Sizes: ${entries.map((e) => e.size).join(", ")}  |  Pattern Size: ${roundCm(bbox.width / 10, 1)} x ${roundCm(bbox.height / 10, 1)} cm  |  Sheet: ${sheetWmm} x ${sheetHmm} mm  |  Print at 100% (Actual Size)`
    ),
    {
      x: 24 * MM_TO_PT,
      y: topY - 16,
      size: 9,
      font,
      color: COLOR_MUTED,
    }
  );

  // Size color legend
  let legendX = 24 * MM_TO_PT;
  for (const e of entries) {
    const col = isMultiSize ? SIZE_PDF_COLORS[e.size] : COLOR_SLATE;
    page.drawRectangle({
      x: legendX,
      y: topY - 32,
      width: 10,
      height: 6,
      color: col,
    });
    page.drawText(`Size ${e.size}`, {
      x: legendX + 14,
      y: topY - 32,
      size: 8.5,
      font: fontBold,
      color: COLOR_SLATE,
    });
    legendX += 62;
  }

  // 50mm x 50mm Calibration Square (top-right corner)
  drawCalibrationSquare(
    page,
    (sheetWmm - 72) * MM_TO_PT,
    (sheetHmm - 72) * MM_TO_PT,
    font,
    fontBold
  );

  // Center pattern in usable area (1:1 exact mm -> pt, flipping Y for PDF bottom-left origin)
  const usableTopMm = sheetHmm - headerMm - marginMm;
  const usableLeftMm = (sheetWmm - bbox.width) / 2;

  const mapPt = (p: Point2D) => ({
    x: (usableLeftMm + (p.x - bbox.minX)) * MM_TO_PT,
    y: (usableTopMm - (p.y - bbox.minY)) * MM_TO_PT,
  });

  for (const entry of entries) {
    const isPrimary = entry.size === primarySize;
    for (const piece of entry.geometry.pieces) {
      drawPieceOnPage(
        page,
        piece,
        entry.size,
        isPrimary,
        isMultiSize,
        1.0,
        mapPt,
        options,
        font,
        fontBold
      );
    }
  }

  const bytes = await pdfDoc.save();
  const sizesSlug = entries.map((e) => e.size).join("-");
  return {
    bytes,
    filename: `${slugify(options.templateName) || "pattern"}-A0-${sizesSlug}.pdf`,
    pageCount: 1,
  };
}

/**
 * Export 1:1 Multi-Page Tiled A4 PDF (210mm × 297mm) for home/office printers.
 * - Page 1: Full Assembly Map showing grid (A1, A2, B1, B2...) + 50x50mm calibration square.
 * - Pages 2..N: Exact 1:1 clipped A4 tiles with corner registration crosshairs & neighbor labels.
 */
export async function generatePatternPdfA4Tiled(
  grading: NestedGradingResult,
  options: PdfExportOptions
): Promise<PdfExportResult> {
  const { entries, primarySize, bbox } = resolveEntries(grading, options.sizes);
  const isMultiSize = entries.length > 1;

  const A4_W_MM = 210;
  const A4_H_MM = 297;
  const MARGIN_MM = 12;
  const TILE_W_MM = A4_W_MM - MARGIN_MM * 2; // 186 mm
  const TILE_H_MM = A4_H_MM - MARGIN_MM * 2; // 273 mm

  const padMm = 10;
  const originX = bbox.minX - padMm;
  const originY = bbox.minY - padMm;
  const totalW = bbox.width + padMm * 2;
  const totalH = bbox.height + padMm * 2;

  const cols = Math.max(1, Math.ceil(totalW / TILE_W_MM));
  const rows = Math.max(1, Math.ceil(totalH / TILE_H_MM));

  // Determine which tiles intersect at least one piece bounding box (skip completely empty pages!)
  const pieceBoxes = entries.flatMap((e) => e.geometry.pieces.map((p) => p.bbox));
  const tileActive: boolean[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const tx0 = originX + c * TILE_W_MM;
      const ty0 = originY + r * TILE_H_MM;
      const tx1 = tx0 + TILE_W_MM;
      const ty1 = ty0 + TILE_H_MM;
      return pieceBoxes.some(
        (b) => b.maxX >= tx0 && b.minX <= tx1 && b.maxY >= ty0 && b.minY <= ty1
      );
    })
  );

  const rowLetter = (r: number) => String.fromCharCode(65 + (r % 26));
  const tileCode = (r: number, c: number) => `${rowLetter(r)}${c + 1}`;

  const activeTiles: Array<{ r: number; c: number; code: string }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (tileActive[r][c]) {
        activeTiles.push({ r, c, code: tileCode(r, c) });
      }
    }
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`PatternCAD Pro - ${toAscii(options.templateName)} (A4 Tiled 1:1)`);
  pdfDoc.setCreator("PatternCAD Pro Parametric Engine");

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ==================== PAGE 1: ASSEMBLY MAP ====================
  const mapPage = pdfDoc.addPage([A4_W_MM * MM_TO_PT, A4_H_MM * MM_TO_PT]);

  mapPage.drawText("PATTERNCAD PRO  |  SO DO GHEP TRANG A4 (ASSEMBLY MAP)", {
    x: 15 * MM_TO_PT,
    y: (A4_H_MM - 20) * MM_TO_PT,
    size: 12,
    font: fontBold,
    color: COLOR_SLATE,
  });
  mapPage.drawText(
    toAscii(
      `Template: ${options.templateName}  |  Sizes: ${entries.map((e) => e.size).join(", ")}  |  Grid: ${cols} cols x ${rows} rows (${activeTiles.length} printable sheets)`
    ),
    {
      x: 15 * MM_TO_PT,
      y: (A4_H_MM - 27) * MM_TO_PT,
      size: 8.5,
      font,
      color: COLOR_MUTED,
    }
  );
  mapPage.drawText(
    "HUONG DAN IN: Chon 'Actual Size / 100%' (khong chon Fit to Page). Kiem tra o vuong 50x50mm ben duoi.",
    {
      x: 15 * MM_TO_PT,
      y: (A4_H_MM - 33) * MM_TO_PT,
      size: 8,
      font: fontBold,
      color: rgb(0.31, 0.27, 0.9),
    }
  );

  // Fit full grid into map box on Page 1
  const mapBoxX = 15 * MM_TO_PT;
  const mapBoxY = 76 * MM_TO_PT;
  const mapBoxW = (A4_W_MM - 30) * MM_TO_PT;
  const mapBoxH = 180 * MM_TO_PT;
  const gridFullW = cols * TILE_W_MM;
  const gridFullH = rows * TILE_H_MM;
  const mapScale = Math.min(mapBoxW / (gridFullW * MM_TO_PT), mapBoxH / (gridFullH * MM_TO_PT));

  const drawGridW = gridFullW * MM_TO_PT * mapScale;
  const drawGridH = gridFullH * MM_TO_PT * mapScale;
  const gridStartX = mapBoxX + (mapBoxW - drawGridW) / 2;
  const gridTopY = mapBoxY + mapBoxH - (mapBoxH - drawGridH) / 2;

  const overviewMapPt = (p: Point2D) => ({
    x: gridStartX + (p.x - originX) * MM_TO_PT * mapScale,
    y: gridTopY - (p.y - originY) * MM_TO_PT * mapScale,
  });

  // Draw overview grid cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellW = TILE_W_MM * MM_TO_PT * mapScale;
      const cellH = TILE_H_MM * MM_TO_PT * mapScale;
      const cx = gridStartX + c * cellW;
      const cy = gridTopY - (r + 1) * cellH;
      const active = tileActive[r][c];
      mapPage.drawRectangle({
        x: cx,
        y: cy,
        width: cellW,
        height: cellH,
        color: active ? rgb(1, 1, 1) : rgb(0.96, 0.97, 0.98),
        borderColor: COLOR_BORDER,
        borderWidth: 0.7,
      });
      mapPage.drawText(tileCode(r, c), {
        x: cx + 3,
        y: cy + cellH - 10,
        size: Math.min(8, Math.max(5.5, cellW * 0.16)),
        font: active ? fontBold : font,
        color: active ? COLOR_SLATE : COLOR_MUTED,
      });
    }
  }

  // Overlay miniature pattern on Assembly Map
  for (const entry of entries) {
    for (const piece of entry.geometry.pieces) {
      drawPieceOnPage(
        mapPage,
        piece,
        entry.size,
        entry.size === primarySize,
        isMultiSize,
        mapScale,
        overviewMapPt,
        { ...options, includeAnnotations: false, includeNotches: false },
        font,
        fontBold
      );
    }
  }

  // Exact 1:1 50x50mm calibration test square at bottom-left of Page 1
  drawCalibrationSquare(mapPage, 15 * MM_TO_PT, 16 * MM_TO_PT, font, fontBold);

  mapPage.drawText(
    toAscii(`Tong kich thuoc rap: ${roundCm(bbox.width / 10, 1)} x ${roundCm(bbox.height / 10, 1)} cm`),
    {
      x: 75 * MM_TO_PT,
      y: 42 * MM_TO_PT,
      size: 9,
      font: fontBold,
      color: COLOR_SLATE,
    }
  );
  mapPage.drawText(
    "Ghep cac trang theo ma A1 -> A2 (ngang) va A1 -> B1 (doc) tai dau cong (+).",
    {
      x: 75 * MM_TO_PT,
      y: 30 * MM_TO_PT,
      size: 8,
      font,
      color: COLOR_MUTED,
    }
  );

  // ==================== PAGES 2..N: 1:1 TILED A4 SHEETS ====================
  const mPt = MARGIN_MM * MM_TO_PT;
  const tileWPt = TILE_W_MM * MM_TO_PT;
  const tileHPt = TILE_H_MM * MM_TO_PT;

  activeTiles.forEach((tile, idx) => {
    const page = pdfDoc.addPage([A4_W_MM * MM_TO_PT, A4_H_MM * MM_TO_PT]);
    const tx0 = originX + tile.c * TILE_W_MM;
    const ty0 = originY + tile.r * TILE_H_MM;

    // Dashed glue/trim frame
    page.drawRectangle({
      x: mPt,
      y: mPt,
      width: tileWPt,
      height: tileHPt,
      borderColor: COLOR_BORDER,
      borderWidth: 0.75,
      borderDashArray: [4, 3],
    });

    // 4 Corner registration crosshairs (+)
    const corners = [
      { x: mPt, y: mPt },
      { x: mPt + tileWPt, y: mPt },
      { x: mPt, y: mPt + tileHPt },
      { x: mPt + tileWPt, y: mPt + tileHPt },
    ];
    for (const corner of corners) {
      page.drawLine({
        start: { x: corner.x - 6, y: corner.y },
        end: { x: corner.x + 6, y: corner.y },
        color: COLOR_SLATE,
        thickness: 0.8,
      });
      page.drawLine({
        start: { x: corner.x, y: corner.y - 6 },
        end: { x: corner.x, y: corner.y + 6 },
        color: COLOR_SLATE,
        thickness: 0.8,
      });
    }

    // Tile identification header & neighbor connectors
    page.drawText(
      `TILE ${tile.code}  (Row ${tile.r + 1}, Col ${tile.c + 1})  |  Sheet ${idx + 1} / ${activeTiles.length}  |  SCALE 1:1`,
      {
        x: mPt + 6,
        y: mPt + tileHPt + 6,
        size: 8,
        font: fontBold,
        color: COLOR_SLATE,
      }
    );

    if (tile.c + 1 < cols && tileActive[tile.r][tile.c + 1]) {
      page.drawText(`-> ${tileCode(tile.r, tile.c + 1)}`, {
        x: mPt + tileWPt - 26,
        y: mPt + tileHPt / 2,
        size: 7.5,
        font: fontBold,
        color: COLOR_MUTED,
      });
    }
    if (tile.r + 1 < rows && tileActive[tile.r + 1][tile.c]) {
      page.drawText(`v ${tileCode(tile.r + 1, tile.c)}`, {
        x: mPt + tileWPt / 2 - 10,
        y: mPt - 10,
        size: 7.5,
        font: fontBold,
        color: COLOR_MUTED,
      });
    }

    // Clip pattern drawing cleanly to the 186mm × 273mm printable tile box
    page.pushOperators(
      pushGraphicsState(),
      rectangle(mPt, mPt, tileWPt, tileHPt),
      clip(),
      endPath()
    );

    const tileMapPt = (p: Point2D) => ({
      x: mPt + (p.x - tx0) * MM_TO_PT,
      y: mPt + tileHPt - (p.y - ty0) * MM_TO_PT,
    });

    for (const entry of entries) {
      for (const piece of entry.geometry.pieces) {
        drawPieceOnPage(
          page,
          piece,
          entry.size,
          entry.size === primarySize,
          isMultiSize,
          1.0,
          tileMapPt,
          options,
          font,
          fontBold
        );
      }
    }

    page.pushOperators(popGraphicsState());
  });

  const bytes = await pdfDoc.save();
  const sizesSlug = entries.map((e) => e.size).join("-");
  return {
    bytes,
    filename: `${slugify(options.templateName) || "pattern"}-A4-tiled-${sizesSlug}.pdf`,
    pageCount: 1 + activeTiles.length,
    gridInfo: { cols, rows, printedTiles: activeTiles.length },
  };
}
