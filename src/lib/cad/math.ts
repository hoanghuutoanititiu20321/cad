import type {
  BoundingBox,
  PathSegment,
  Point2D,
  VectorPath,
} from "./types";

/** Round a millimeter coordinate/value to 0.01 mm precision */
export function roundMm(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Round a centimeter value to 0.01 cm (0.1 mm) or custom decimals */
export function roundCm(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function pt(x: number, y: number): Point2D {
  return { x: roundMm(x), y: roundMm(y) };
}

export function polarPoint(
  center: Point2D,
  radius: number,
  angleRad: number
): Point2D {
  return pt(
    center.x + radius * Math.cos(angleRad),
    center.y + radius * Math.sin(angleRad)
  );
}

export function distance2D(a: Point2D, b: Point2D): number {
  return roundMm(Math.hypot(b.x - a.x, b.y - a.y));
}

export function lerpPoint(a: Point2D, b: Point2D, t: number): Point2D {
  return pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
}

/**
 * Evaluate a point on a cubic Bezier curve at parameter t in [0, 1].
 */
export function evalCubicBezier(
  p0: Point2D,
  cp1: Point2D,
  cp2: Point2D,
  p3: Point2D,
  t: number
): Point2D {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return pt(
    uuu * p0.x + 3 * uu * t * cp1.x + 3 * u * tt * cp2.x + ttt * p3.x,
    uuu * p0.y + 3 * uu * t * cp1.y + 3 * u * tt * cp2.y + ttt * p3.y
  );
}

/**
 * Create a closed circular ring as two 180° SVG/CAD arcs so both SVG and DXF stay exact.
 */
export function createFullCircleSegments(
  center: Point2D,
  radius: number,
  sweep: 0 | 1 = 1
): PathSegment[] {
  const r = roundMm(radius);
  const start = pt(center.x + r, center.y);
  const mid = pt(center.x - r, center.y);
  return [
    { type: "M", to: start },
    {
      type: "A",
      rx: r,
      ry: r,
      rotation: 0,
      largeArc: 0,
      sweep,
      to: mid,
      center,
      radius: r,
      startAngle: 0,
      endAngle: Math.PI,
      fullCircle: true,
    },
    {
      type: "A",
      rx: r,
      ry: r,
      rotation: 0,
      largeArc: 0,
      sweep,
      to: start,
      center,
      radius: r,
      startAngle: Math.PI,
      endAngle: Math.PI * 2,
      fullCircle: false,
    },
    { type: "Z" },
  ];
}

/**
 * Create an annular sector (donut wedge) path between innerRadius and outerRadius
 * spanning from startAngle to endAngle (in radians, where endAngle > startAngle, +Y down).
 */
export function createAnnularSectorSegments(params: {
  center: Point2D;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
}): PathSegment[] {
  const { center, innerRadius, outerRadius, startAngle, endAngle } = params;
  const rIn = roundMm(innerRadius);
  const rOut = roundMm(outerRadius);
  const span = Math.abs(endAngle - startAngle);
  const largeArc: 0 | 1 = span > Math.PI ? 1 : 0;

  const pWaistStart = polarPoint(center, rIn, startAngle);
  const pHemStart = polarPoint(center, rOut, startAngle);
  const pHemEnd = polarPoint(center, rOut, endAngle);
  const pWaistEnd = polarPoint(center, rIn, endAngle);

  return [
    { type: "M", to: pWaistStart },
    { type: "L", to: pHemStart },
    {
      type: "A",
      rx: rOut,
      ry: rOut,
      rotation: 0,
      largeArc,
      sweep: 1,
      to: pHemEnd,
      center,
      radius: rOut,
      startAngle,
      endAngle,
    },
    { type: "L", to: pWaistEnd },
    {
      type: "A",
      rx: rIn,
      ry: rIn,
      rotation: 0,
      largeArc,
      sweep: 0,
      to: pWaistStart,
      center,
      radius: rIn,
      startAngle: endAngle,
      endAngle: startAngle,
    },
    { type: "Z" },
  ];
}

/**
 * Exact geometric seam-allowance offset for an annular sector!
 * - Outer arc expands outward by `outerSa` -> R_out_cut = outerRadius + outerSa
 * - Inner arc shifts inward toward center by `innerSa` -> R_in_cut = max(2, innerRadius - innerSa)
 * - Radial sides shift parallel outward by `sideSa`:
 *   Exact intersection of a line parallel to ray(theta) at perpendicular distance `sideSa`
 *   with circle(R) sits at angle `theta +/- arcsin(sideSa / R)`.
 */
export function createOffsetAnnularSectorSegments(params: {
  center: Point2D;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  innerSa: number;
  outerSa: number;
  sideSa: number;
}): {
  segments: PathSegment[];
  innerCutRadius: number;
  outerCutRadius: number;
  innerStartAngle: number;
  innerEndAngle: number;
  outerStartAngle: number;
  outerEndAngle: number;
} {
  const {
    center,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    innerSa,
    outerSa,
    sideSa,
  } = params;

  const rInCut = roundMm(Math.max(2, innerRadius - innerSa));
  const rOutCut = roundMm(outerRadius + outerSa);

  const deltaInner =
    sideSa > 0 ? Math.asin(Math.min(0.95, sideSa / rInCut)) : 0;
  const deltaOuter =
    sideSa > 0 ? Math.asin(Math.min(0.95, sideSa / rOutCut)) : 0;

  const innerStartAngle = startAngle - deltaInner;
  const innerEndAngle = endAngle + deltaInner;
  const outerStartAngle = startAngle - deltaOuter;
  const outerEndAngle = endAngle + deltaOuter;

  const outerSpan = Math.abs(outerEndAngle - outerStartAngle);
  const innerSpan = Math.abs(innerEndAngle - innerStartAngle);

  const pWaistStart = polarPoint(center, rInCut, innerStartAngle);
  const pHemStart = polarPoint(center, rOutCut, outerStartAngle);
  const pHemEnd = polarPoint(center, rOutCut, outerEndAngle);
  const pWaistEnd = polarPoint(center, rInCut, innerEndAngle);

  const segments: PathSegment[] = [
    { type: "M", to: pWaistStart },
    { type: "L", to: pHemStart },
    {
      type: "A",
      rx: rOutCut,
      ry: rOutCut,
      rotation: 0,
      largeArc: outerSpan > Math.PI ? 1 : 0,
      sweep: 1,
      to: pHemEnd,
      center,
      radius: rOutCut,
      startAngle: outerStartAngle,
      endAngle: outerEndAngle,
    },
    { type: "L", to: pWaistEnd },
    {
      type: "A",
      rx: rInCut,
      ry: rInCut,
      rotation: 0,
      largeArc: innerSpan > Math.PI ? 1 : 0,
      sweep: 0,
      to: pWaistStart,
      center,
      radius: rInCut,
      startAngle: innerEndAngle,
      endAngle: innerStartAngle,
    },
    { type: "Z" },
  ];

  return {
    segments,
    innerCutRadius: rInCut,
    outerCutRadius: rOutCut,
    innerStartAngle,
    innerEndAngle,
    outerStartAngle,
    outerEndAngle,
  };
}

/**
 * Convert a VectorPath into an SVG path `d` attribute string.
 */
export function pathToSvgD(path: VectorPath): string {
  const parts: string[] = [];
  for (const seg of path.segments) {
    switch (seg.type) {
      case "M":
        parts.push(`M ${roundMm(seg.to.x)} ${roundMm(seg.to.y)}`);
        break;
      case "L":
        parts.push(`L ${roundMm(seg.to.x)} ${roundMm(seg.to.y)}`);
        break;
      case "A":
        parts.push(
          `A ${roundMm(seg.rx)} ${roundMm(seg.ry)} ${seg.rotation} ${seg.largeArc} ${seg.sweep} ${roundMm(seg.to.x)} ${roundMm(seg.to.y)}`
        );
        break;
      case "C":
        parts.push(
          `C ${roundMm(seg.cp1.x)} ${roundMm(seg.cp1.y)}, ${roundMm(seg.cp2.x)} ${roundMm(seg.cp2.y)}, ${roundMm(seg.to.x)} ${roundMm(seg.to.y)}`
        );
        break;
      case "Z":
        parts.push("Z");
        break;
    }
  }
  return parts.join(" ");
}

/**
 * Sample points along a VectorPath for exact bounding box calculation and snapping.
 */
export function samplePathPoints(
  path: VectorPath,
  arcStepDeg = 4
): Point2D[] {
  const points: Point2D[] = [];
  let cursor: Point2D = { x: 0, y: 0 };
  let startPt: Point2D = { x: 0, y: 0 };

  for (const seg of path.segments) {
    if (seg.type === "M") {
      cursor = seg.to;
      startPt = seg.to;
      points.push(cursor);
    } else if (seg.type === "L") {
      cursor = seg.to;
      points.push(cursor);
    } else if (seg.type === "A") {
      if (
        seg.center &&
        seg.radius !== undefined &&
        seg.startAngle !== undefined &&
        seg.endAngle !== undefined
      ) {
        const diff = seg.endAngle - seg.startAngle;
        const steps = Math.max(
          8,
          Math.ceil(Math.abs(radToDeg(diff)) / arcStepDeg)
        );
        for (let i = 1; i <= steps; i++) {
          const a = seg.startAngle + (diff * i) / steps;
          points.push(polarPoint(seg.center, seg.radius, a));
        }
      } else {
        points.push(seg.to);
      }
      cursor = seg.to;
    } else if (seg.type === "C") {
      const steps = 24;
      for (let i = 1; i <= steps; i++) {
        points.push(evalCubicBezier(cursor, seg.cp1, seg.cp2, seg.to, i / steps));
      }
      cursor = seg.to;
    } else if (seg.type === "Z") {
      points.push(startPt);
      cursor = startPt;
    }
  }

  return points;
}

/**
 * Compute exact perimeter of a VectorPath in millimeters (0.01 mm precision).
 */
export function computePathPerimeter(path: VectorPath): number {
  let total = 0;
  let cursor: Point2D = { x: 0, y: 0 };
  let startPt: Point2D = { x: 0, y: 0 };

  for (const seg of path.segments) {
    if (seg.type === "M") {
      cursor = seg.to;
      startPt = seg.to;
    } else if (seg.type === "L") {
      total += Math.hypot(seg.to.x - cursor.x, seg.to.y - cursor.y);
      cursor = seg.to;
    } else if (seg.type === "A") {
      if (
        seg.radius !== undefined &&
        seg.startAngle !== undefined &&
        seg.endAngle !== undefined
      ) {
        total += Math.abs(seg.endAngle - seg.startAngle) * seg.radius;
      } else {
        total += Math.hypot(seg.to.x - cursor.x, seg.to.y - cursor.y);
      }
      cursor = seg.to;
    } else if (seg.type === "C") {
      const steps = 32;
      let prev = cursor;
      for (let i = 1; i <= steps; i++) {
        const curr = evalCubicBezier(cursor, seg.cp1, seg.cp2, seg.to, i / steps);
        total += Math.hypot(curr.x - prev.x, curr.y - prev.y);
        prev = curr;
      }
      cursor = seg.to;
    } else if (seg.type === "Z") {
      total += Math.hypot(startPt.x - cursor.x, startPt.y - cursor.y);
      cursor = startPt;
    }
  }

  return roundMm(total);
}

export function computeBoundingBoxFromPoints(points: Point2D[]): BoundingBox {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    minX: roundMm(minX),
    minY: roundMm(minY),
    maxX: roundMm(maxX),
    maxY: roundMm(maxY),
    width: roundMm(maxX - minX),
    height: roundMm(maxY - minY),
  };
}

export function computePathsBoundingBox(paths: VectorPath[]): BoundingBox {
  const allPoints: Point2D[] = [];
  for (const p of paths) {
    allPoints.push(...samplePathPoints(p, 2));
  }
  return computeBoundingBoxFromPoints(allPoints);
}

export function mergeBoundingBoxes(boxes: BoundingBox[]): BoundingBox {
  if (boxes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  return {
    minX: roundMm(minX),
    minY: roundMm(minY),
    maxX: roundMm(maxX),
    maxY: roundMm(maxY),
    width: roundMm(maxX - minX),
    height: roundMm(maxY - minY),
  };
}
