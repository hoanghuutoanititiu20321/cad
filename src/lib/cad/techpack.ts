import { roundCm } from "./math";
import type { NestedGradingResult, SizeCode } from "./types";

/**
 * Generate a UTF-8 CSV Tech Pack & Grading Coordinate Sheet (opens cleanly in Excel).
 */
export function generateTechPackCsv(
  grading: NestedGradingResult,
  templateName: string,
  exportedSizes: SizeCode[]
): string {
  const lines: string[] = [];
  const baseEntry =
    grading.entries.find((e) => e.size === grading.baseSize) ??
    grading.entries[0];

  lines.push(`PatternCAD Pro - TECH PACK & GRADING SPECIFICATION`);
  lines.push(`Template,${templateName}`);
  lines.push(`Base Size,${grading.baseSize}`);
  lines.push(`Exported Sizes,${exportedSizes.join(" / ")}`);
  lines.push(`Precision,0.01 mm (1:1 Scale)`);
  lines.push("");

  lines.push("1. DANH SACH MANH RAP (PATTERN PIECES - BASE SIZE)");
  lines.push(
    "Ma manh,Ten manh,So luong cat,Rong (cm),Cao (cm),Chu vi cat (cm),Dien tich (m2),So dau bam"
  );
  for (const p of baseEntry.geometry.pieces) {
    lines.push(
      [
        p.code,
        `"${p.name} (${p.englishName})"`,
        `x${p.cutQuantity}`,
        roundCm(p.metrics.widthMm / 10, 2),
        roundCm(p.metrics.heightMm / 10, 2),
        roundCm(p.metrics.perimeterMm / 10, 2),
        roundCm(p.metrics.areaMm2 / 1_000_000, 3),
        p.notches.length,
      ].join(",")
    );
  }
  lines.push("");

  lines.push("2. BANG NHAY SIZE (GRADING RADII & MEASUREMENTS)");
  lines.push(
    "Size,Base,Vong eo (cm),Vong eo nhun (cm),Dai vay (cm),R_waist (mm),R_hem (mm),Delta R_waist (mm),Delta R_hem (mm)"
  );
  for (const e of grading.entries) {
    if (!exportedSizes.includes(e.size)) continue;
    lines.push(
      [
        e.size,
        e.isBase ? "YES" : "NO",
        e.measurements.waistCm.toFixed(2),
        e.measurements.effectiveWaistCm.toFixed(2),
        e.measurements.skirtLengthCm.toFixed(2),
        e.measurements.rWaistMm.toFixed(2),
        e.measurements.rHemMm.toFixed(2),
        e.measurements.deltaRWaistMm.toFixed(2),
        e.measurements.deltaRHemMm.toFixed(2),
      ].join(",")
    );
  }
  lines.push("");

  lines.push("3. BANG TOA DO DIEM CHUAN (KEY POINT COORDINATES - mm)");
  lines.push("Manh,Ma diem,Ten diem,Size,X (mm),Y (mm),dX (mm),dY (mm)");
  for (const row of grading.pointTable) {
    for (const sz of exportedSizes) {
      const c = row.bySize[sz];
      if (!c) continue;
      lines.push(
        [
          `"${row.pieceName}"`,
          row.pointCode,
          `"${row.pointLabel}"`,
          sz,
          c.x.toFixed(2),
          c.y.toFixed(2),
          c.dx.toFixed(2),
          c.dy.toFixed(2),
        ].join(",")
      );
    }
  }

  // UTF-8 BOM for clean Vietnamese display in Microsoft Excel
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
