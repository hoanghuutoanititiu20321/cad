import * as THREE from "three";
import { parseCircleSkirtParams, WAISTBAND_HEIGHT_CM } from "@/templates/circle-skirt/schema";
import { parseBaggyJeanParams } from "@/templates/baggy-jean/schema";
import {
  getMannequinBodySpec,
  type BodyMeasurementStandard,
  type MannequinCategory,
} from "./bodyStandards";
import type { ParamValues } from "./types";

export interface FabricDrapePreset {
  id: string;
  name: string;
  color: string;
  seamColor: string;
  roughness: number;
  metalness: number;
  /** 0.75 = soft fluid silk drape, 1.0 = medium cotton, 1.25 = crisp denim/twill */
  stiffness: number;
  category: "general" | "denim";
}

export const FABRIC_PRESETS: FabricDrapePreset[] = [
  {
    id: "indigo-cotton",
    name: "Indigo Cotton",
    color: "#4F46E5",
    seamColor: "#F8FAFC",
    roughness: 0.72,
    metalness: 0.04,
    stiffness: 1.0,
    category: "general",
  },
  {
    id: "ivory-linen",
    name: "Kem Linen (Ivory)",
    color: "#E7DFD3",
    seamColor: "#64748B",
    roughness: 0.85,
    metalness: 0.02,
    stiffness: 1.05,
    category: "general",
  },
  {
    id: "crimson-silk",
    name: "Đỏ Đô Lụa (Satin)",
    color: "#9F1239",
    seamColor: "#FFE4E6",
    roughness: 0.34,
    metalness: 0.12,
    stiffness: 0.78,
    category: "general",
  },
  {
    id: "noir-twill",
    name: "Đen Tuyết Mưa",
    color: "#1E293B",
    seamColor: "#94A3B8",
    roughness: 0.64,
    metalness: 0.06,
    stiffness: 1.2,
    category: "general",
  },
  {
    id: "teal-poplin",
    name: "Xanh Ngọc Poplin",
    color: "#0D9488",
    seamColor: "#CCFBF1",
    roughness: 0.68,
    metalness: 0.04,
    stiffness: 1.0,
    category: "general",
  },
  // Authentic Denim Presets (WV1499LSB-TD — SH3790)
  {
    id: "sh3790-mstone",
    name: "SH3790 M-Stone Denim",
    color: "#4A6FA5",
    seamColor: "#D97706", // Golden Glo W32761 contrast topstitch!
    roughness: 0.86,
    metalness: 0.03,
    stiffness: 1.22,
    category: "denim",
  },
  {
    id: "raw-indigo-denim",
    name: "Raw Dark Indigo",
    color: "#223354",
    seamColor: "#EAB308",
    roughness: 0.82,
    metalness: 0.05,
    stiffness: 1.26,
    category: "denim",
  },
  {
    id: "vintage-ice-denim",
    name: "Vintage Stone Light",
    color: "#7B9EC7",
    seamColor: "#D97706",
    roughness: 0.88,
    metalness: 0.02,
    stiffness: 1.15,
    category: "denim",
  },
  {
    id: "washed-black-denim",
    name: "Washed Black Jean",
    color: "#27272A",
    seamColor: "#71717A",
    roughness: 0.84,
    metalness: 0.04,
    stiffness: 1.2,
    category: "denim",
  },
  {
    id: "ecru-denim",
    name: "Ecru Natural Denim",
    color: "#E5DDD0",
    seamColor: "#A16207",
    roughness: 0.88,
    metalness: 0.02,
    stiffness: 1.18,
    category: "denim",
  },
];

/** Height of natural waist line above studio floor in cm (scales slightly with body height) */
export const WAIST_ELEVATION_CM = 102;

const ELLIPSE_KX = 1.13;
const ELLIPSE_KZ = 0.86;

/**
 * Evaluate anatomical torso cross-section from the real TCVN/Asian Excel Body Standard!
 */
function bodyProfileAtY(
  yCm: number,
  body: BodyMeasurementStandard
): { rMean: number; kx: number; kz: number; zOffset: number } {
  const heightScale = body.heightMidCm / 161;
  const yWaist = 102 * heightScale;
  const yCrotch = yWaist - body.crotchDepthCm;
  const yHip = yCrotch + 7.8; // Full hip ~3" above crotch
  const yBust = yWaist + body.backLengthCm * 0.48;
  const yShoulder = yWaist + body.backLengthCm * 0.82;
  const yNeckBase = yWaist + body.backLengthCm * 0.96;
  const yNeckTop = yNeckBase + 7.2 * heightScale;

  const rWaist = body.waistCm / (2 * Math.PI);
  const rBust = body.bustCm / (2 * Math.PI);
  const rHip = body.hipCm / (2 * Math.PI);
  const rNeck = body.neckCm / (2 * Math.PI);
  const halfShoulder = body.shoulderCm / 2;

  const stops: Array<{ y: number; r: number; kx: number; kz: number; zOff: number }> = [
    { y: yCrotch, r: rHip * 0.9, kx: 1.16, kz: 0.84, zOff: -0.7 },
    { y: yHip, r: rHip, kx: 1.15, kz: 0.87, zOff: -0.9 },
    { y: (yHip + yWaist) / 2, r: (rWaist + rHip) * 0.51, kx: 1.13, kz: 0.86, zOff: -0.3 },
    { y: yWaist, r: rWaist, kx: ELLIPSE_KX, kz: ELLIPSE_KZ, zOff: 0 },
    { y: (yWaist + yBust) / 2, r: (rWaist + rBust) * 0.49, kx: 1.12, kz: 0.89, zOff: 0.4 },
    { y: yBust, r: rBust, kx: 1.1, kz: 0.95, zOff: 1.2 },
    {
      y: yShoulder,
      r: Math.max(rBust * 0.9, halfShoulder * 0.78),
      kx: 1.26,
      kz: 0.72,
      zOff: 0.1,
    },
    { y: yNeckBase, r: rNeck * 1.12, kx: 1.04, kz: 0.96, zOff: 0 },
    { y: yNeckTop, r: rNeck, kx: 1.0, kz: 1.0, zOff: 0 },
  ];

  if (yCm <= stops[0].y) {
    const s = stops[0];
    return { rMean: s.r, kx: s.kx, kz: s.kz, zOffset: s.zOff };
  }
  if (yCm >= stops[stops.length - 1].y) {
    const s = stops[stops.length - 1];
    return { rMean: s.r, kx: s.kx, kz: s.kz, zOffset: s.zOff };
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (yCm >= a.y && yCm <= b.y) {
      const rawT = (yCm - a.y) / Math.max(0.01, b.y - a.y);
      const t = rawT * rawT * (3 - 2 * rawT);
      return {
        rMean: a.r + (b.r - a.r) * t,
        kx: a.kx + (b.kx - a.kx) * t,
        kz: a.kz + (b.kz - a.kz) * t,
        zOffset: a.zOff + (b.zOff - a.zOff) * t,
      };
    }
  }
  return { rMean: rWaist, kx: ELLIPSE_KX, kz: ELLIPSE_KZ, zOffset: 0 };
}

function buildLoftedTubeGeometry(
  radialSegs: number,
  heightSegs: number,
  sampleFn: (theta: number, v: number) => THREE.Vector3,
  capBottom = false
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= heightSegs; j++) {
    const v = j / heightSegs;
    for (let i = 0; i <= radialSegs; i++) {
      const u = i / radialSegs;
      const theta = u * Math.PI * 2;
      const p = sampleFn(theta, v);
      positions.push(p.x, p.y, p.z);
      uvs.push(u, v);
    }
  }

  const stride = radialSegs + 1;
  for (let j = 0; j < heightSegs; j++) {
    for (let i = 0; i < radialSegs; i++) {
      const a = j * stride + i;
      const b = a + stride;
      const c = b + 1;
      const d = a + 1;
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  if (capBottom) {
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let i = 0; i < radialSegs; i++) {
      cx += positions[i * 3];
      cy += positions[i * 3 + 1];
      cz += positions[i * 3 + 2];
    }
    const centerIdx = positions.length / 3;
    positions.push(cx / radialSegs, cy / radialSegs, cz / radialSegs);
    uvs.push(0.5, 0);
    for (let i = 0; i < radialSegs; i++) {
      indices.push(centerIdx, i, i + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function mergeSimpleBufferGeometries(
  geometries: THREE.BufferGeometry[]
): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIndices = 0;
  for (const g of geometries) {
    const pos = g.getAttribute("position");
    totalVerts += pos.count;
    totalIndices += g.index ? g.index.count : pos.count;
  }

  const positions = new Float32Array(totalVerts * 3);
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;
  for (const g of geometries) {
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      positions[(vOffset + i) * 3] = pos.getX(i);
      positions[(vOffset + i) * 3 + 1] = pos.getY(i);
      positions[(vOffset + i) * 3 + 2] = pos.getZ(i);
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) {
        indices[iOffset + i] = g.index.getX(i) + vOffset;
      }
      iOffset += g.index.count;
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices[iOffset + i] = vOffset + i;
      }
      iOffset += pos.count;
    }
    vOffset += pos.count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeVertexNormals();
  return merged;
}

/**
 * Build FULL ANATOMICAL MANNEQUIN (Torso + Split Two Legs + Stand) driven directly
 * by `Bang_Thong_So_Co_The_Va_Ma_No_Canh_Chuan.xlsx` (Women / Men / Kids)!
 */
export function buildMannequinGeometries(
  waistCm: number,
  category: MannequinCategory = "women",
  sizeCode = "M",
  includeLegs = true
): {
  torsoGeometry: THREE.BufferGeometry;
  neckCapGeometry: THREE.BufferGeometry;
  poleGeometry: THREE.BufferGeometry;
  baseGeometry: THREE.BufferGeometry;
  bodySpec: BodyMeasurementStandard;
} {
  const std = getMannequinBodySpec(category, sizeCode);
  // Blend standard spec with live custom waist if user dragged waist slider significantly
  const waistScale = Math.max(0.75, Math.min(1.3, waistCm / Math.max(40, std.waistCm)));
  const body: BodyMeasurementStandard = {
    ...std,
    waistCm: std.waistCm * (0.35 + 0.65 * waistScale),
    hipCm: std.hipCm * (0.5 + 0.5 * waistScale),
    thighCm: std.thighCm * (0.55 + 0.45 * waistScale),
  };

  const heightScale = body.heightMidCm / 161;
  const yWaist = 102 * heightScale;
  const yCrotch = yWaist - body.crotchDepthCm;
  const yNeckTop = yWaist + body.backLengthCm * 0.96 + 7.2 * heightScale;

  // 1. Torso from Crotch up to Neck Top
  const torsoPart = buildLoftedTubeGeometry(
    64,
    48,
    (theta, v) => {
      const y = yCrotch + (yNeckTop - yCrotch) * v;
      const prof = bodyProfileAtY(y, body);
      return new THREE.Vector3(
        prof.rMean * prof.kx * Math.cos(theta),
        y,
        prof.rMean * prof.kz * Math.sin(theta) + prof.zOffset
      );
    },
    true
  );

  const bodyParts: THREE.BufferGeometry[] = [torsoPart];

  // 2. Sculpted Two Anatomical Legs (Left & Right) from Crotch down to Ankle (Y = 6 cm)
  if (includeLegs) {
    const rThigh = body.thighCm / (2 * Math.PI);
    const rKnee = body.kneeCm / (2 * Math.PI);
    const rAnkle = Math.max(3.3, (body.hemOpeningCm * 0.76) / (2 * Math.PI));
    const yAnkle = 5.5 * heightScale;
    const yKnee = yCrotch - 33 * heightScale;
    const yCalf = yCrotch - 48 * heightScale;
    const legSpanTop = rThigh * 1.04;
    const legSpanAnkle = legSpanTop * 0.96;

    for (const side of [-1, 1] as const) {
      const legGeo = buildLoftedTubeGeometry(
        36,
        36,
        (theta, v) => {
          const y = yAnkle + (yCrotch + 3.5 - yAnkle) * v;
          let r = rAnkle;
          if (y >= yKnee) {
            const t = Math.min(1, (y - yKnee) / Math.max(1, yCrotch + 3.5 - yKnee));
            r = rKnee + (rThigh * 1.02 - rKnee) * Math.pow(t, 0.82);
          } else if (y >= yCalf) {
            const t = (y - yCalf) / Math.max(1, yKnee - yCalf);
            r = rKnee * 0.94 + (rKnee - rKnee * 0.94) * t;
          } else {
            const t = (y - yAnkle) / Math.max(1, yCalf - yAnkle);
            r = rAnkle + (rKnee * 0.94 - rAnkle) * Math.pow(t, 0.72);
          }

          const centerX = side * (legSpanAnkle + (legSpanTop - legSpanAnkle) * v);
          const calfBackZ = y < yKnee && y > yAnkle + 8 ? -0.9 * Math.sin(((y - yAnkle) / (yKnee - yAnkle)) * Math.PI) : 0;
          return new THREE.Vector3(
            centerX + r * 0.98 * Math.cos(theta),
            y,
            r * 1.02 * Math.sin(theta) + calfBackZ - 0.35
          );
        },
        true
      );
      bodyParts.push(legGeo);
    }
  }

  const torsoGeometry = mergeSimpleBufferGeometries(bodyParts);

  const topProf = bodyProfileAtY(yNeckTop, body);
  const neckCapGeometry = new THREE.CylinderGeometry(
    topProf.rMean * 1.04,
    topProf.rMean * 1.04,
    2.4,
    40
  );
  neckCapGeometry.translate(0, yNeckTop + 1.0, 0);

  const poleHeight = includeLegs ? yCrotch : yCrotch;
  const poleGeometry = new THREE.CylinderGeometry(
    includeLegs ? 0.85 : 1.15,
    includeLegs ? 0.85 : 1.15,
    Math.max(10, poleHeight),
    20
  );
  poleGeometry.translate(0, poleHeight / 2, includeLegs ? -5.5 : -0.4);

  const baseGeometry = new THREE.CylinderGeometry(18, 20, 2.2, 48);
  baseGeometry.translate(0, 1.1, -1.0);

  return {
    torsoGeometry,
    neckCapGeometry,
    poleGeometry,
    baseGeometry,
    bodySpec: body,
  };
}

export interface Garment3DBuildResult {
  primaryGeometry: THREE.BufferGeometry;
  waistbandGeometry: THREE.BufferGeometry;
  seamLinesGeometry: THREE.BufferGeometry;
  hardwareGeometry: THREE.BufferGeometry | null;
  metrics: {
    waistElevationCm: number;
    hemElevationCm: number;
    detailLabel: string;
  };
}

/**
 * Build real-time 3D Draped Flared Circle Skirt directly from 2D pattern parameters.
 */
export function buildCircleSkirt3D(
  rawParams: ParamValues,
  stiffness = 1.0,
  category: MannequinCategory = "women",
  sizeCode = "M"
): Garment3DBuildResult {
  const params = parseCircleSkirtParams(rawParams);
  const body = getMannequinBodySpec(category, sizeCode);
  const heightScale = body.heightMidCm / 161;

  const waistCm = params.waist;
  const skirtLengthCm = params.skirtLength;
  const flareRatio = params.flareAngle / 360;
  const gatherExtra = Math.max(0, params.gatherRatio - 1);

  const fluteCount =
    params.flareAngle >= 360
      ? 12
      : params.flareAngle >= 270
        ? 10
        : params.flareAngle >= 180
          ? 8
          : params.flareAngle >= 135
            ? 6
            : 4;

  const radialSegs = 180;
  const lengthSegs = 64;
  const yWaist = 102 * heightScale;
  const wbHeight = WAISTBAND_HEIGHT_CM;

  const sampleSkirtSurface = (theta: number, v: number): THREE.Vector3 => {
    const s = v * skirtLengthCm;
    const baseSpreadSin =
      (0.14 + 0.42 * Math.pow(flareRatio, 0.88) + 0.06 * gatherExtra) *
      Math.min(1.28, Math.max(0.72, stiffness));
    const clampedSin = Math.min(0.76, baseSpreadSin);
    const cosSlope = Math.sqrt(1 - clampedSin * clampedSin);

    const y = yWaist - s * cosSlope;
    const prof = bodyProfileAtY(y, { ...body, waistCm });

    const rWaistBody = waistCm / (2 * Math.PI) + 0.4;
    const gatherPuff =
      gatherExtra * 1.45 * Math.sin(Math.min(1, v * 3.2) * Math.PI) * Math.exp(-v * 2.1);

    let rBase = rWaistBody + s * clampedSin + gatherPuff;
    const minClearanceR = prof.rMean + 0.65;
    if (rBase < minClearanceR) rBase = minClearanceR;

    const roundnessBlend = Math.min(1, Math.pow(v, 0.7) * (0.45 + 0.45 * flareRatio));
    const kx = prof.kx + (1.02 - prof.kx) * roundnessBlend;
    const kz = prof.kz + (0.98 - prof.kz) * roundnessBlend;
    const zShift = prof.zOffset * Math.max(0, 1 - v * 1.35);

    const fluteAmp =
      (0.45 + 4.8 * Math.pow(flareRatio, 1.18) + 1.1 * gatherExtra) *
      Math.pow(v, 1.32) *
      (0.85 + 0.15 * stiffness);

    const primaryWave =
      Math.sin(fluteCount * theta - 0.35) * 0.78 +
      Math.sin((fluteCount / 2) * theta + 1.1) * 0.22;

    const gatherPleatCount = params.gatherRatio >= 2 ? 48 : 36;
    const gatherAmp =
      gatherExtra *
      0.62 *
      Math.pow(Math.min(1, v * 8), 0.6) *
      Math.exp(-v * 3.6);
    const gatherWave = Math.sin(gatherPleatCount * theta);

    const rFinal = rBase + fluteAmp * primaryWave + gatherAmp * gatherWave;
    const yDip = -fluteAmp * 0.16 * primaryWave * v;

    return new THREE.Vector3(
      rFinal * kx * Math.cos(theta),
      y + yDip,
      rFinal * kz * Math.sin(theta) + zShift
    );
  };

  const skirtGeometry = buildLoftedTubeGeometry(
    radialSegs,
    lengthSegs,
    sampleSkirtSurface,
    false
  );

  // Waistband
  const isCurvedWb = params.waistbandType === "curved";
  const waistbandGeometry = buildLoftedTubeGeometry(
    96,
    8,
    (theta, t) => {
      const edgeBevel = Math.sin(t * Math.PI) * 0.16;
      const cfFactor = Math.max(0, Math.sin(theta));
      const contourDip = isCurvedWb ? -0.75 * cfFactor * cfFactor : 0;
      const y = yWaist + t * wbHeight + contourDip;
      const prof = bodyProfileAtY(y, { ...body, waistCm });
      const taperAdjust = isCurvedWb ? -0.22 * t : 0.12 * t;
      const rWb = waistCm / (2 * Math.PI) + 0.5 + edgeBevel + taperAdjust;
      return new THREE.Vector3(
        rWb * prof.kx * Math.cos(theta),
        y,
        rWb * prof.kz * Math.sin(theta) + prof.zOffset
      );
    },
    false
  );

  // Seam lines + zipper stop marker
  const seamSegments: number[] = [];
  const pushLine = (pts: THREE.Vector3[]) => {
    for (let k = 0; k < pts.length - 1; k++) {
      seamSegments.push(
        pts[k].x,
        pts[k].y,
        pts[k].z,
        pts[k + 1].x,
        pts[k + 1].y,
        pts[k + 1].z
      );
    }
  };

  const waistRing: THREE.Vector3[] = [];
  for (let i = 0; i <= 120; i++) {
    const p = sampleSkirtSurface((i / 120) * Math.PI * 2, 0.004);
    p.x *= 1.008;
    p.z *= 1.008;
    waistRing.push(p);
  }
  pushLine(waistRing);

  const seamAngles =
    params.pieceMultiplier === 2 ? [0, Math.PI] : [Math.PI * 1.5];
  for (const angle of seamAngles) {
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j <= lengthSegs; j++) {
      const p = sampleSkirtSurface(angle, j / lengthSegs);
      const rad = Math.hypot(p.x, p.z) || 1;
      p.x += (p.x / rad) * 0.16;
      p.z += (p.z / rad) * 0.16;
      pts.push(p);
    }
    pushLine(pts);
  }

  const seamLinesGeometry = new THREE.BufferGeometry();
  seamLinesGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(seamSegments, 3)
  );

  let hardwareGeometry: THREE.BufferGeometry | null = null;
  if (params.includeZipperNotch) {
    const zipAngle = params.pieceMultiplier === 2 ? Math.PI : Math.PI * 1.5;
    const pStop = sampleSkirtSurface(zipAngle, Math.min(0.75, 18 / skirtLengthCm));
    const rad = Math.hypot(pStop.x, pStop.z) || 1;
    const zStopGeo = new THREE.SphereGeometry(0.68, 16, 16);
    zStopGeo.translate(
      pStop.x + (pStop.x / rad) * 0.25,
      pStop.y,
      pStop.z + (pStop.z / rad) * 0.25
    );
    hardwareGeometry = zStopGeo;
  }

  const hemSample = sampleSkirtSurface(Math.PI / 2, 1);

  return {
    primaryGeometry: skirtGeometry,
    waistbandGeometry,
    seamLinesGeometry,
    hardwareGeometry,
    metrics: {
      waistElevationCm: Math.round(yWaist * 10) / 10,
      hemElevationCm: Math.round(hemSample.y * 10) / 10,
      detailLabel: `${fluteCount} múi sóng rũ tự nhiên`,
    },
  };
}

/**
 * Build real-time 3D LOW SUPER BAGGY JEAN (WV1499LSB-TD) draped over the 2-legged mannequin!
 * Reflects exact waist, hip, thigh (26.5"), knee (25.0"), bottom opening (25.0"), inseam (32"),
 * low-rise contour waistband (1 5/8"), back yoke, 5-pocket topstitching, 27L button & 14L rivets!
 */
export function buildBaggyJean3D(
  rawParams: ParamValues,
  stiffness = 1.2,
  category: MannequinCategory = "women",
  sizeCode = "M"
): Garment3DBuildResult {
  const p = parseBaggyJeanParams(rawParams);
  const body = getMannequinBodySpec(category, sizeCode);
  const heightScale = body.heightMidCm / 161;

  // Low-rise 9.5" front rise sits ~3.5 cm below natural waist on the upper hip!
  const yNaturalWaist = 102 * heightScale;
  const yCrotch = yNaturalWaist - body.crotchDepthCm;
  const yFrontTop = Math.min(yNaturalWaist + 2, yCrotch + p.frontRise - 1.5);
  const yBackTop = Math.min(yNaturalWaist + 5.5, yCrotch + p.backRise * 0.72);
  const wbH = p.waistbandHeight;
  const yHem = Math.max(2.2, yCrotch - p.inseam * 0.91);

  const rWaistJean = p.waist / (2 * Math.PI);
  const rHipJean = p.hip / (2 * Math.PI);
  const rThighLeg = p.thigh / (2 * Math.PI);
  const rKneeLeg = p.knee / (2 * Math.PI);
  const rHemLeg = p.hemOpening / (2 * Math.PI);

  // Pelvis / Hip Upper Trunk of Jeans (from Crotch up to bottom of Waistband)
  const samplePelvis = (theta: number, v: number): THREE.Vector3 => {
    // Low-rise front dips lower than back rise!
    const frontFactor = Math.sin(theta); // +1 at CF (+Z), -1 at CB (-Z)
    const yTopHere =
      (yFrontTop + yBackTop) / 2 - ((yBackTop - yFrontTop) / 2) * frontFactor;
    const yTopSeam = yTopHere - wbH;
    const y = yCrotch + (yTopSeam - yCrotch) * v;

    // Interpolate from full hip/pelvis at v=0..0.4 up to waistband at v=1
    const r =
      v < 0.42
        ? rHipJean * (0.98 + 0.03 * Math.sin((v / 0.42) * Math.PI))
        : rHipJean + (rWaistJean - rHipJean) * Math.pow((v - 0.42) / 0.58, 0.9);

    const kx = 1.16 - 0.03 * v;
    const kz = 0.88 - 0.02 * v;
    // Slight realistic denim drape crease around hip
    const softFold = 0.25 * (1 - v) * Math.sin(4 * theta + 0.4);
    const zOff = -0.6 * (1 - v * 0.65);

    return new THREE.Vector3(
      (r + softFold) * kx * Math.cos(theta),
      y,
      (r + softFold) * kz * Math.sin(theta) + zOff
    );
  };

  const pelvisGeo = buildLoftedTubeGeometry(84, 24, samplePelvis, false);

  // Two Super Baggy Trouser Legs (Left -X, Right +X)
  const legCenterTopX = Math.max(8.2, rHipJean * 0.54);
  const legCenterHemX = Math.max(9.6, legCenterTopX + (rHemLeg - 8) * 0.28);

  const sampleLeg = (
    side: -1 | 1,
    theta: number,
    v: number // 0 = hem, 1 = crotch join
  ): THREE.Vector3 => {
    const y = yHem + (yCrotch + 4.5 - yHem) * v;
    const kneeV = Math.min(0.85, Math.max(0.25, 1 - 33 / Math.max(40, p.inseam)));

    let r = rHemLeg;
    if (v >= kneeV) {
      const t = (v - kneeV) / Math.max(0.01, 1 - kneeV);
      r = rKneeLeg + (rThighLeg - rKneeLeg) * t;
    } else {
      const t = v / Math.max(0.01, kneeV);
      r = rHemLeg + (rKneeLeg - rHemLeg) * t;
    }

    // Authentic baggy denim vertical drape folds + subtle ankle pooling/stacking at bottom 15%
    const baggyFactor = Math.max(0, (p.hemOpening - 38) / 28);
    const drapeRipples =
      (0.35 + 1.05 * baggyFactor) *
      (1 - v * 0.72) *
      (0.7 * Math.sin(5 * theta + side * 0.8) +
        0.3 * Math.cos(3 * theta - side * 0.5));
    const ankleStack =
      v < 0.16
        ? 0.65 * baggyFactor * Math.sin((v / 0.16) * Math.PI * 2) * (0.6 + 0.4 * Math.sin(theta))
        : 0;

    // Slight inseam pinch at crotch top so two baggy legs don't intersect at crotch seam
    const centerX = side * (legCenterHemX + (legCenterTopX - legCenterHemX) * v);
    const rx = (r + drapeRipples + ankleStack) * 0.99;
    const rz = (r + drapeRipples + ankleStack) * 1.02;

    let x = centerX + rx * Math.cos(theta);
    // Keep inner side cleanly separated at x = 0 near crotch fork
    if (v > 0.75) {
      const clampX = side * 0.15;
      if (side === 1 && x < clampX) x = clampX;
      if (side === -1 && x > clampX) x = clampX;
    }

    const z = rz * Math.sin(theta) - 0.45 * v;
    return new THREE.Vector3(x, y, z);
  };

  const leftLegGeo = buildLoftedTubeGeometry(
    64,
    48,
    (theta, v) => sampleLeg(-1, theta, v),
    false
  );
  const rightLegGeo = buildLoftedTubeGeometry(
    64,
    48,
    (theta, v) => sampleLeg(1, theta, v),
    false
  );

  // Merge pelvis + 2 legs into one primary denim mesh!
  const primaryGeometry = mergeSimpleBufferGeometries([
    pelvisGeo,
    leftLegGeo,
    rightLegGeo,
  ]);

  // Contoured Waistband (1 5/8" = 4.13 cm)
  const isCurved = p.waistbandType === "curved";
  const waistbandGeometry = buildLoftedTubeGeometry(
    84,
    8,
    (theta, t) => {
      const frontFactor = Math.sin(theta);
      const yTopHere =
        (yFrontTop + yBackTop) / 2 - ((yBackTop - yFrontTop) / 2) * frontFactor;
      const contourDip = isCurved ? -0.45 * Math.max(0, frontFactor) : 0;
      const y = yTopHere - wbH + t * wbH + contourDip;
      const bevel = Math.sin(t * Math.PI) * 0.22;
      const r = rWaistJean + 0.35 + bevel - (isCurved ? 0.25 * t : 0);
      return new THREE.Vector3(
        r * 1.13 * Math.cos(theta),
        y,
        r * 0.86 * Math.sin(theta) - 0.2
      );
    },
    false
  );

  // Golden Glo Contrast Denim Topstitching (Outseams, Inseams, Back Yoke, J-Fly, Back Pockets, Hem)
  const seamSegments: number[] = [];
  const pushPoly = (pts: THREE.Vector3[]) => {
    for (let k = 0; k < pts.length - 1; k++) {
      seamSegments.push(
        pts[k].x,
        pts[k].y,
        pts[k].z,
        pts[k + 1].x,
        pts[k + 1].y,
        pts[k + 1].z
      );
    }
  };
  const offsetOut = (v: THREE.Vector3, amt = 0.22): THREE.Vector3 => {
    const rad = Math.hypot(v.x, v.z) || 1;
    return new THREE.Vector3(
      v.x + (v.x / rad) * amt,
      v.y,
      v.z + (v.z / rad) * amt
    );
  };

  // 1. Outseams & Hem topstitch rings on both legs
  for (const side of [-1, 1] as const) {
    const outAngle = side === 1 ? 0 : Math.PI;
    const outPts: THREE.Vector3[] = [];
    for (let j = 0; j <= 40; j++) {
      const ptL = sampleLeg(side, outAngle, j / 40);
      ptL.x += side * 0.22;
      outPts.push(ptL);
    }
    pushPoly(outPts);

    // 5/8" Hem topstitch ring
    const hemRing: THREE.Vector3[] = [];
    for (let i = 0; i <= 48; i++) {
      const ptH = sampleLeg(side, (i / 48) * Math.PI * 2, 0.025);
      const cx = side * legCenterHemX;
      const dx = ptH.x - cx;
      const rad = Math.hypot(dx, ptH.z) || 1;
      ptH.x += (dx / rad) * 0.22;
      ptH.z += (ptH.z / rad) * 0.22;
      hemRing.push(ptH);
    }
    pushPoly(hemRing);
  }

  // 2. Back Yoke V-seam (2" @CB → 3/4" @SS)
  const yokePts: THREE.Vector3[] = [];
  for (let i = 0; i <= 36; i++) {
    const theta = Math.PI + (i / 36) * Math.PI; // Back half (PI -> 2*PI)
    const cbWeight = Math.abs(Math.sin(theta)); // 1 at CB, 0 at SS
    const dropV = 0.88 - 0.24 * cbWeight;
    yokePts.push(offsetOut(samplePelvis(theta, dropV), 0.28));
  }
  pushPoly(yokePts);

  // 3. J-Stitch Front Fly (5" × 1.5")
  const flyPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const theta = Math.PI / 2 - 0.22 * (1 - Math.pow(t, 4));
    const v = 0.98 - t * 0.65;
    flyPts.push(offsetOut(samplePelvis(theta, v), 0.3));
  }
  pushPoly(flyPts);

  // 4. Two Pentagonal Back Patch Pockets (if includeFivePockets)
  if (p.includeFivePockets) {
    for (const side of [-1, 1] as const) {
      const tInner = Math.PI * 1.5 + side * 0.14;
      const tOuter = Math.PI * 1.5 + side * 0.72;
      const tMid = (tInner + tOuter) / 2;
      const p1 = offsetOut(samplePelvis(tInner, 0.62), 0.32);
      const p2 = offsetOut(samplePelvis(tOuter, 0.66), 0.32);
      const p3 = offsetOut(samplePelvis(tOuter - side * 0.04, 0.22), 0.32);
      const p4 = offsetOut(samplePelvis(tMid, 0.11), 0.32);
      const p5 = offsetOut(samplePelvis(tInner + side * 0.04, 0.22), 0.32);
      pushPoly([p1, p2, p3, p4, p5, p1]);
    }
  }

  const seamLinesGeometry = new THREE.BufferGeometry();
  seamLinesGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(seamSegments, 3)
  );

  // 27L Antique Copper Front Button + 3× 14L Brass Rivets!
  const hwParts: THREE.BufferGeometry[] = [];
  const btnPos = samplePelvis(Math.PI / 2, 1.0);
  const btnGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.4, 20);
  btnGeo.rotateX(Math.PI / 2);
  btnGeo.translate(btnPos.x, btnPos.y + wbH * 0.5, btnPos.z + 0.55);
  hwParts.push(btnGeo);

  for (const rTheta of [Math.PI * 0.15, Math.PI * 0.85, Math.PI * 0.26]) {
    const rp = offsetOut(samplePelvis(rTheta, 0.86), 0.35);
    const rv = new THREE.SphereGeometry(0.36, 12, 12);
    rv.translate(rp.x, rp.y, rp.z);
    hwParts.push(rv);
  }
  const hardwareGeometry = mergeSimpleBufferGeometries(hwParts);
  void stiffness;

  return {
    primaryGeometry,
    waistbandGeometry,
    seamLinesGeometry,
    hardwareGeometry,
    metrics: {
      waistElevationCm: Math.round(yFrontTop * 10) / 10,
      hemElevationCm: Math.round(yHem * 10) / 10,
      detailLabel: `WV1499LSB-TD • Ống rộng ${p.hemOpening} cm (25")`,
    },
  };
}
