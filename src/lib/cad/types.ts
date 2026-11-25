/**
 * Core Parametric Garment Pattern CAD Types
 * Internal geometry coordinate unit: millimeters (mm), accurate to 0.01 mm.
 * Coordinate system: +X right, +Y down (screen/SVG aligned; DXF exporter flips Y -> -Y).
 */

export type UnitType = "cm" | "mm" | "°" | "x";

export interface Point2D {
  x: number;
  y: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export type PathSegment =
  | { type: "M"; to: Point2D }
  | { type: "L"; to: Point2D }
  | {
      type: "A";
      rx: number;
      ry: number;
      rotation: number;
      largeArc: 0 | 1;
      sweep: 0 | 1;
      to: Point2D;
      /** Exact circular arc metadata for precision DXF ARC/CIRCLE export */
      center?: Point2D;
      radius?: number;
      startAngle?: number;
      endAngle?: number;
      fullCircle?: boolean;
    }
  | { type: "C"; cp1: Point2D; cp2: Point2D; to: Point2D }
  | { type: "Z" };

export type PathKind = "cut" | "sew" | "internal" | "fold";

export interface VectorPath {
  id: string;
  segments: PathSegment[];
  closed: boolean;
  kind: PathKind;
  label?: string;
}

export interface Notch {
  id: string;
  /** Point on the finished sew line */
  point: Point2D;
  /** Corresponding point on the cut edge (outside seam allowance) */
  cutPoint?: Point2D;
  /** Inward direction angle (radians, pointing into the pattern piece) */
  angle: number;
  /** Slit depth in mm (typically 4-6 mm) */
  depth: number;
  style: "slit" | "T" | "V";
  label?: string;
}

export interface Grainline {
  start: Point2D;
  end: Point2D;
  label: string;
}

export interface DimensionCallout {
  id: string;
  from: Point2D;
  to: Point2D;
  label: string;
  kind: "linear" | "radial";
  offsetMm?: number;
}

export interface KeyPoint {
  id: string;
  code: string;
  label: string;
  point: Point2D;
}

export interface PatternPieceMetrics {
  widthMm: number;
  heightMm: number;
  perimeterMm: number;
  sewPerimeterMm: number;
  areaMm2: number;
}

export interface PatternPiece {
  id: string;
  code: string;
  name: string;
  englishName: string;
  cutQuantity: number;
  cutNote: string;
  material: "self" | "lining" | "interfacing";
  sewPaths: VectorPath[];
  cutPaths: VectorPath[];
  internalPaths: VectorPath[];
  notches: Notch[];
  grainline: Grainline;
  dimensions: DimensionCallout[];
  labelAnchor: Point2D;
  keyPoints: KeyPoint[];
  bbox: BoundingBox;
  metrics: PatternPieceMetrics;
}

export interface FormulaItem {
  id: string;
  symbol: string;
  label: string;
  expression: string;
  substitution: string;
  valueCm: number;
  valueMm: number;
  displayValue?: string;
}

export interface PatternSummary {
  totalCutPieces: number;
  estimatedFabricWidthCm: number;
  estimatedFabricLengthCm: number;
  totalAreaM2: number;
  metadata: Record<string, number | string>;
}

export interface PatternGeometryResult {
  pieces: PatternPiece[];
  formulas: FormulaItem[];
  warnings: string[];
  bbox: BoundingBox;
  summary: PatternSummary;
}

/* ==================== Schema / Dynamic Form Types ==================== */

export interface ParamGroup {
  id: string;
  title: string;
  description?: string;
}

interface ParamFieldBase {
  key: string;
  label: string;
  shortLabel?: string;
  description?: string;
  group: string;
}

export interface NumberParamField extends ParamFieldBase {
  type: "number";
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  unit: UnitType;
}

export interface SelectParamOption {
  value: string | number;
  label: string;
  sublabel?: string;
}

export interface SelectParamField extends ParamFieldBase {
  type: "select";
  defaultValue: string | number;
  display?: "select" | "segmented";
  options: SelectParamOption[];
}

export interface ToggleParamField extends ParamFieldBase {
  type: "toggle";
  defaultValue: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}

export type ParamField = NumberParamField | SelectParamField | ToggleParamField;

export type ParamValue = number | string | boolean;
export type ParamValues = Record<string, ParamValue>;

export interface TemplateSchema {
  groups: ParamGroup[];
  fields: ParamField[];
}

/* ==================== Grading Types ==================== */

export type SizeCode = "S" | "M" | "L" | "XL";

export interface SizeDefinition {
  code: SizeCode;
  label: string;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  stepFromM: number;
}

export interface GradedSizeEntry {
  size: SizeCode;
  isBase: boolean;
  color: string;
  params: ParamValues;
  measurements: {
    waistCm: number;
    effectiveWaistCm: number;
    skirtLengthCm: number;
    rWaistCm: number;
    rWaistMm: number;
    rHemCm: number;
    rHemMm: number;
    deltaRWaistMm: number;
    deltaRHemMm: number;
    pieceArcWaistCm: number;
    pieceArcHemCm: number;
  };
  geometry: PatternGeometryResult;
}

export interface PointGradingRow {
  pieceId: string;
  pieceName: string;
  pointCode: string;
  pointLabel: string;
  bySize: Record<
    SizeCode,
    {
      x: number;
      y: number;
      dx: number;
      dy: number;
    }
  >;
}

export interface NestedGradingResult {
  baseSize: SizeCode;
  sizes: SizeCode[];
  entries: GradedSizeEntry[];
  pointTable: PointGradingRow[];
  combinedBbox: BoundingBox;
}

/* ==================== Template Plugin Interface ==================== */

export interface GradingOverrides {
  /** Step increment per size for waist circumference (cm, default 4.0) */
  waistStepCm?: number;
  /** Step increment per size for skirt length (cm, default 1.0) */
  skirtLengthStepCm?: number;
  /** Extra radial grade adjustment at Position [1] (Center Waist CF, mm per size step, default 0) */
  pos1WaistMidOffsetMm?: number;
  /** Extra radial grade adjustment at Position [2] (Center Hem CF, mm per size step, default 0) */
  pos2HemMidOffsetMm?: number;
}

export interface PatternTemplate {
  id: string;
  name: string;
  englishName: string;
  category: string;
  version: string;
  description: string;
  status: "active" | "coming-soon";
  schema: TemplateSchema;
  getDefaultParams: () => ParamValues;
  generateGeometry: (
    params: ParamValues,
    options?: Record<string, unknown>
  ) => PatternGeometryResult;
  generateGrading: (
    baseParams: ParamValues,
    baseSize: SizeCode,
    overrides?: GradingOverrides
  ) => NestedGradingResult;
}
