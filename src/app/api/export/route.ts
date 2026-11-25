import { NextResponse } from "next/server";
import JSZip from "jszip";
import { generatePatternDxf, type DxfUnit } from "@/lib/cad/dxf";
import { generatePatternPdfA0, generatePatternPdfA4Tiled } from "@/lib/cad/pdf";
import { generateTechPackCsv } from "@/lib/cad/techpack";
import type { GradingOverrides, ParamValues, SizeCode } from "@/lib/cad/types";
import { getTemplateById } from "@/templates/registry";

export type ExportFormat = "dxf" | "pdf-a0" | "pdf-a4" | "zip";

interface ExportRequestBody {
  templateId?: string;
  params?: ParamValues;
  baseSize?: SizeCode;
  sizes?: SizeCode[];
  format?: ExportFormat;
  unit?: DxfUnit;
  includeSeamLines?: boolean;
  includeMarkings?: boolean;
  gradingOverrides?: GradingOverrides;
}

const VALID_SIZES: SizeCode[] = ["S", "M", "L", "XL"];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExportRequestBody;

    const template = getTemplateById(body.templateId ?? "circle-skirt");
    const params: ParamValues = {
      ...template.getDefaultParams(),
      ...(body.params ?? {}),
    };

    const baseSize: SizeCode = VALID_SIZES.includes(body.baseSize as SizeCode)
      ? (body.baseSize as SizeCode)
      : "M";

    const requestedSizes = Array.isArray(body.sizes)
      ? body.sizes.filter((s): s is SizeCode => VALID_SIZES.includes(s))
      : [baseSize];
    const sizes: SizeCode[] =
      requestedSizes.length > 0 ? requestedSizes : [baseSize];

    const format: ExportFormat = body.format ?? "dxf";
    const unit: DxfUnit = body.unit === "cm" ? "cm" : "mm";
    const includeSeamLines = body.includeSeamLines ?? true;
    const includeMarkings = body.includeMarkings ?? true;

    const grading = template.generateGrading(
      params,
      baseSize,
      body.gradingOverrides
    );
    const templateLabel = `${template.name} (${template.englishName})`;

    if (format === "dxf") {
      const dxf = generatePatternDxf(grading, {
        sizes,
        unit,
        includeSeamLines,
        includeGrainlines: includeMarkings,
        includeNotches: includeMarkings,
        includeAnnotations: includeMarkings,
        templateName: template.name,
      });

      return new NextResponse(dxf.content, {
        status: 200,
        headers: {
          "Content-Type": "application/dxf; charset=utf-8",
          "Content-Disposition": `attachment; filename="${dxf.filename}"`,
          "X-Export-Filename": dxf.filename,
          "X-Export-Format": "dxf",
          "X-Export-Entities": String(dxf.entityCount),
          "X-Export-Bytes": String(dxf.byteSize),
        },
      });
    }

    if (format === "pdf-a0") {
      const pdf = await generatePatternPdfA0(grading, {
        sizes,
        includeSeamLines,
        includeGrainlines: includeMarkings,
        includeNotches: includeMarkings,
        includeAnnotations: includeMarkings,
        templateName: templateLabel,
      });

      return new NextResponse(Buffer.from(pdf.bytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${pdf.filename}"`,
          "X-Export-Filename": pdf.filename,
          "X-Export-Format": "pdf-a0",
          "X-Export-Pages": String(pdf.pageCount),
          "X-Export-Bytes": String(pdf.bytes.byteLength),
        },
      });
    }

    if (format === "pdf-a4") {
      const pdf = await generatePatternPdfA4Tiled(grading, {
        sizes,
        includeSeamLines,
        includeGrainlines: includeMarkings,
        includeNotches: includeMarkings,
        includeAnnotations: includeMarkings,
        templateName: templateLabel,
      });

      return new NextResponse(Buffer.from(pdf.bytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${pdf.filename}"`,
          "X-Export-Filename": pdf.filename,
          "X-Export-Format": "pdf-a4",
          "X-Export-Pages": String(pdf.pageCount),
          "X-Export-Bytes": String(pdf.bytes.byteLength),
        },
      });
    }

    // Complete Production Tech Pack ZIP Bundle (DXF + PDF A0 + PDF A4 Tiled + CSV Spec)
    const dxf = generatePatternDxf(grading, {
      sizes,
      unit,
      includeSeamLines,
      includeGrainlines: includeMarkings,
      includeNotches: includeMarkings,
      includeAnnotations: includeMarkings,
      templateName: template.name,
    });
    const pdfA0 = await generatePatternPdfA0(grading, {
      sizes,
      includeSeamLines,
      includeGrainlines: includeMarkings,
      includeNotches: includeMarkings,
      includeAnnotations: includeMarkings,
      templateName: templateLabel,
    });
    const pdfA4 = await generatePatternPdfA4Tiled(grading, {
      sizes,
      includeSeamLines,
      includeGrainlines: includeMarkings,
      includeNotches: includeMarkings,
      includeAnnotations: includeMarkings,
      templateName: templateLabel,
    });
    const specCsv = generateTechPackCsv(grading, templateLabel, sizes);

    const zip = new JSZip();
    zip.file(dxf.filename, dxf.content);
    zip.file(pdfA0.filename, pdfA0.bytes);
    zip.file(pdfA4.filename, pdfA4.bytes);
    zip.file(`tech-pack-grading-${sizes.join("-")}.csv`, specCsv);

    const zipBytes = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const zipFilename = `tech-pack-${template.id}-${sizes.join("-")}.zip`;

    return new NextResponse(Buffer.from(zipBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
        "X-Export-Filename": zipFilename,
        "X-Export-Format": "zip",
        "X-Export-Entities": String(dxf.entityCount),
        "X-Export-Pages": String(pdfA4.pageCount),
        "X-Export-Bytes": String(zipBytes.byteLength),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lỗi xuất file sản xuất";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
