import * as THREE from "three";
import { parseCircleSkirtParams, WAISTBAND_HEIGHT_CM } from "@/templates/circle-skirt/schema";
import { parseBaggyJeanParams } from "@/templates/baggy-jean/schema";
import { parseBomberJacketParams } from "@/templates/bomber-jacket/schema";
import { parseColorblockPoloParams } from "@/templates/colorblock-polo/schema";
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
  category: "general" | "denim" | "fleece" | "polo";
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
  // Authentic Polyester Cotton Fleece Presets (Style 89865 Bomber Jacket)
  {
    id: "maroon-fleece",
    name: "89865 Maroon Fleece (Mernda)",
    color: "#6D1D32",
    seamColor: "#EAB308",
    roughness: 0.9,
    metalness: 0.02,
    stiffness: 1.12,
    category: "fleece",
  },
  {
    id: "navy-fleece",
    name: "School Navy Fleece",
    color: "#1E3A5F",
    seamColor: "#EAB308",
    roughness: 0.9,
    metalness: 0.02,
    stiffness: 1.12,
    category: "fleece",
  },
  {
    id: "forest-fleece",
    name: "Forest Green Fleece",
    color: "#1A3A32",
    seamColor: "#FACC15",
    roughness: 0.9,
    metalness: 0.02,
    stiffness: 1.12,
    category: "fleece",
  },
  {
    id: "charcoal-fleece",
    name: "Charcoal Heather Fleece",
    color: "#334155",
    seamColor: "#CBD5E1",
    roughness: 0.92,
    metalness: 0.02,
    stiffness: 1.12,
    category: "fleece",
  },
  // Authentic LA65V Piqué Polo Presets (Style HAZE026-028 Colorblock Polo)
  {
    id: "haze026-bottle",
    name: "HAZE026 LA65V Dark Bottle",
    color: "#1A3A32",
    seamColor: "#CBD5E1",
    roughness: 0.8,
    metalness: 0.03,
    stiffness: 1.0,
    category: "polo",
  },
  {
    id: "haze-navy",
    name: "LA65V Classic Navy",
    color: "#1B2E4B",
    seamColor: "#CBD5E1",
    roughness: 0.8,
    metalness: 0.03,
    stiffness: 1.0,
    category: "polo",
  },
  {
    id: "haze-maroon",
    name: "LA65V Heritage Maroon",
    color: "#6D1D32",
    seamColor: "#E2E8F0",
    roughness: 0.8,
    metalness: 0.03,
    stiffness: 1.0,
    category: "polo",
  },
  {
    id: "haze-royal",
    name: "LA65V Royal Blue",
    color: "#1D4ED8",
    seamColor: "#E2E8F0",
    roughness: 0.8,
    metalness: 0.03,
    stiffness: 1.0,
    category: "polo",
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

export interface ExtraPart3D {
  geometry: THREE.BufferGeometry;
  color: string;
  roughness?: number;
  metalness?: number;
}

export interface Garment3DBuildResult {
  primaryGeometry: THREE.BufferGeometry;
  waistbandGeometry: THREE.BufferGeometry;
  seamLinesGeometry: THREE.BufferGeometry;
  hardwareGeometry: THREE.BufferGeometry | null;
  extraParts?: ExtraPart3D[];
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

/**
 * Helper to build a parametric 3D surface grid patch (u in [0,1], v in [0,1])
 * for razor-sharp diagonal colorblock panels and tailored torso sections.
 */
function buildSurfacePatchGeometry(
  uSegs: number,
  vSegs: number,
  sampleFn: (u: number, v: number) => THREE.Vector3
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= vSegs; j++) {
    const v = j / vSegs;
    for (let i = 0; i <= uSegs; i++) {
      const u = i / uSegs;
      const p = sampleFn(u, v);
      positions.push(p.x, p.y, p.z);
      uvs.push(u, v);
    }
  }

  const stride = uSegs + 1;
  for (let j = 0; j < vSegs; j++) {
    for (let i = 0; i < uSegs; i++) {
      const a = j * stride + i;
      const b = a + stride;
      const c = b + 1;
      const d = a + 1;
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Build a sculpted tubular set-in sleeve starting at the shoulder socket and angling
 * naturally downward along the body side.
 */
function buildSleeveTube(params: {
  side: -1 | 1;
  shoulderX: number;
  shoulderY: number;
  sleeveLengthCm: number;
  rTopCm: number;
  rEndCm: number;
  armAngleDeg: number;
  radialSegs?: number;
  lengthSegs?: number;
  startV?: number;
  endV?: number;
  radialOffset?: number;
}): THREE.BufferGeometry {
  const {
    side,
    shoulderX,
    shoulderY,
    sleeveLengthCm,
    rTopCm,
    rEndCm,
    armAngleDeg,
    radialSegs = 36,
    lengthSegs = 28,
    startV = 0,
    endV = 1,
    radialOffset = 0,
  } = params;

  const ang = (armAngleDeg * Math.PI) / 180;
  // Unit axis pointing along arm from shoulder down & slightly outward
  const dir = new THREE.Vector3(side * Math.sin(ang), -Math.cos(ang), 0.04).normalize();
  const upRef = new THREE.Vector3(0, 0, 1);
  const ortho1 = new THREE.Vector3().crossVectors(dir, upRef).normalize();
  const ortho2 = new THREE.Vector3().crossVectors(ortho1, dir).normalize();

  return buildLoftedTubeGeometry(
    radialSegs,
    lengthSegs,
    (theta, localV) => {
      const v = startV + (endV - startV) * localV;
      const s = v * sleeveLengthCm;
      // Soft shoulder cap rounding at very top (v < 0.14)
      const capRound = v < 0.14 ? 0.88 + 0.12 * Math.sin((v / 0.14) * (Math.PI / 2)) : 1;
      const drapeFold = 0.22 * Math.sin(3 * theta + side * 0.6) * Math.sin(v * Math.PI);
      const r = (rTopCm + (rEndCm - rTopCm) * Math.pow(v, 0.85)) * capRound + drapeFold + radialOffset;
      const center = new THREE.Vector3(
        shoulderX + dir.x * s,
        shoulderY + dir.y * s,
        0.15 + dir.z * s
      );
      const rx = r * 0.96 * Math.cos(theta);
      const rz = r * 1.04 * Math.sin(theta);
      return center
        .addScaledVector(ortho1, rx)
        .addScaledVector(ortho2, rz);
    },
    false
  );
}

/**
 * Build real-time 3D STYLE 89865 BOMBER FLEECE JACKET (BEARE & LEY / Mernda Primary)
 * Includes Fleece torso + 2 long sleeves + 1x1 Rib Collar/Basque/Cuffs with 2 Gold Stripes
 * + 6× 11mm Press Studs + Angled 3cm Welt Pockets!
 */
export function buildBomberJacket3D(
  rawParams: ParamValues,
  stiffness = 1.12,
  category: MannequinCategory = "women",
  sizeCode = "M"
): Garment3DBuildResult {
  const p = parseBomberJacketParams(rawParams);
  const body = getMannequinBodySpec(category, sizeCode);
  const heightScale = body.heightMidCm / 161;

  const yWaist = 102 * heightScale;
  const yNeckBase = yWaist + body.backLengthCm * 0.96;
  const yShoulder = yWaist + body.backLengthCm * 0.84;
  const totalLen = Math.min(82, Math.max(44, p.frontLength * 0.94));
  const ribH = p.ribHeight;
  const yRibBottom = yNeckBase - totalLen;
  const yRibTop = yRibBottom + ribH;

  const rBodyChest = Math.max(body.bustCm / (2 * Math.PI) + 1.6, p.chest / (2 * Math.PI) * 0.95);
  const rRibHem = Math.max(body.hipCm / (2 * Math.PI) + 0.9, (p.ribHemHalf * 2) / (2 * Math.PI) * 0.96);
  const rNeck = Math.max(body.neckCm / (2 * Math.PI) + 0.7, (p.neckWidth * 2.55) / (2 * Math.PI));
  const halfShoulder = Math.max(body.shoulderCm * 0.5 + 1.4, p.shoulder * 0.5 * 0.92);

  // Sample Fleece Torso from top of Rib Basque (v=0) up to Collar seam (v=1)
  const sampleBomberTorso = (theta: number, v: number): THREE.Vector3 => {
    const frontFactor = Math.max(0, Math.sin(theta)); // +1 at CF
    const neckDropHere =
      frontFactor * Math.min(8.5, p.frontNeckDrop * 0.72) +
      (1 - frontFactor) * 1.0;
    const yTopAtTheta = yNeckBase - neckDropHere;
    const y = yRibTop + (yTopAtTheta - yRibTop) * v;

    let r = rBodyChest;
    let kx = 1.14;
    let kz = 0.88;
    if (v < 0.18) {
      // Gentle blouson puff right above the elastic 1x1 rib basque
      const t = v / 0.18;
      r = rRibHem + (rBodyChest - rRibHem) * Math.pow(t, 0.55) + 0.9 * Math.sin(t * Math.PI);
    } else if (v > 0.78) {
      // Taper cleanly over shoulders toward neck opening
      const t = (v - 0.78) / 0.22;
      const smooth = t * t * (3 - 2 * t);
      const shoulderR = Math.max(rBodyChest * 0.88, halfShoulder * 0.82);
      r = shoulderR + (rNeck - shoulderR) * smooth;
      kx = 1.24 + (1.03 - 1.24) * smooth;
      kz = 0.76 + (0.96 - 0.76) * smooth;
    }

    const fleeceFold = 0.28 * Math.sin(6 * theta + 0.4) * Math.sin(v * Math.PI);
    return new THREE.Vector3(
      (r + fleeceFold) * kx * Math.cos(theta),
      y,
      (r + fleeceFold) * kz * Math.sin(theta) + 0.25 * (1 - v)
    );
  };

  const torsoGeo = buildLoftedTubeGeometry(84, 36, sampleBomberTorso, false);

  // Left & Right Long Fleece Sleeves (length = sleeveLength - ribHeight)
  const sleeveFabLen = Math.max(26, (p.sleeveLength - ribH) * 0.9);
  const rArmTop = Math.max(5.8, (p.armholeHalf * 1.18) / Math.PI);
  const rArmCuff = Math.max(4.0, (p.sleeveOpeningHalf * 2) / (2 * Math.PI));
  const shoulderSocketX = halfShoulder * 0.94;
  const shoulderSocketY = yShoulder - 2.4;

  const leftSleeve = buildSleeveTube({
    side: -1,
    shoulderX: -shoulderSocketX,
    shoulderY: shoulderSocketY,
    sleeveLengthCm: sleeveFabLen,
    rTopCm: rArmTop,
    rEndCm: rArmCuff,
    armAngleDeg: 18,
  });
  const rightSleeve = buildSleeveTube({
    side: 1,
    shoulderX: shoulderSocketX,
    shoulderY: shoulderSocketY,
    sleeveLengthCm: sleeveFabLen,
    rTopCm: rArmTop,
    rEndCm: rArmCuff,
    armAngleDeg: 18,
  });

  const primaryGeometry = mergeSimpleBufferGeometries([
    torsoGeo,
    leftSleeve,
    rightSleeve,
  ]);

  // 1×1 Rib Knit Trims: Basque + Collar + Left/Right Cuffs (rendered via waistbandGeometry)
  const basqueGeo = buildLoftedTubeGeometry(
    72,
    10,
    (theta, v) => {
      const y = yRibBottom + ribH * v;
      const r = rRibHem * (0.97 + 0.03 * v) + 0.14 * Math.sin(v * Math.PI);
      return new THREE.Vector3(r * 1.14 * Math.cos(theta), y, r * 0.88 * Math.sin(theta) + 0.2);
    },
    false
  );

  const collarGeo = buildLoftedTubeGeometry(
    64,
    10,
    (theta, v) => {
      const frontFactor = Math.max(0, Math.sin(theta));
      const neckDropHere =
        frontFactor * Math.min(8.5, p.frontNeckDrop * 0.72) +
        (1 - frontFactor) * 1.0;
      const collarH = ribH * (0.88 - 0.35 * frontFactor * frontFactor);
      const y = yNeckBase - neckDropHere + collarH * v;
      const r = rNeck + 0.35 + 0.25 * (1 - v);
      return new THREE.Vector3(r * 1.04 * Math.cos(theta), y, r * 0.96 * Math.sin(theta));
    },
    false
  );

  const cuffTotalLen = sleeveFabLen + ribH * 0.92;
  const rRibCuff = Math.max(3.2, rArmCuff * 0.72);
  const leftCuff = buildSleeveTube({
    side: -1,
    shoulderX: -shoulderSocketX,
    shoulderY: shoulderSocketY,
    sleeveLengthCm: cuffTotalLen,
    rTopCm: rArmCuff * 0.82,
    rEndCm: rRibCuff,
    armAngleDeg: 18,
    radialSegs: 28,
    lengthSegs: 8,
    startV: sleeveFabLen / cuffTotalLen,
    endV: 1,
    radialOffset: 0.12,
  });
  const rightCuff = buildSleeveTube({
    side: 1,
    shoulderX: shoulderSocketX,
    shoulderY: shoulderSocketY,
    sleeveLengthCm: cuffTotalLen,
    rTopCm: rArmCuff * 0.82,
    rEndCm: rRibCuff,
    armAngleDeg: 18,
    radialSegs: 28,
    lengthSegs: 8,
    startV: sleeveFabLen / cuffTotalLen,
    endV: 1,
    radialOffset: 0.12,
  });

  const waistbandGeometry = mergeSimpleBufferGeometries([
    basqueGeo,
    collarGeo,
    leftCuff,
    rightCuff,
  ]);

  // Extra Part 1: Authentic 2 Gold Rib Stripes (#EAB308) on Basque, Collar, and Both Cuffs!
  const goldBands: THREE.BufferGeometry[] = [];
  for (const bandV of [0.34, 0.64]) {
    const bandHalf = 0.075;
    // Basque gold stripe
    goldBands.push(
      buildLoftedTubeGeometry(
        72,
        2,
        (theta, lv) => {
          const v = bandV - bandHalf + lv * bandHalf * 2;
          const y = yRibBottom + ribH * v;
          const r = rRibHem * (0.97 + 0.03 * v) + 0.28;
          return new THREE.Vector3(r * 1.14 * Math.cos(theta), y, r * 0.88 * Math.sin(theta) + 0.2);
        },
        false
      )
    );
    // Collar gold stripe
    goldBands.push(
      buildLoftedTubeGeometry(
        64,
        2,
        (theta, lv) => {
          const v = bandV - bandHalf + lv * bandHalf * 2;
          const frontFactor = Math.max(0, Math.sin(theta));
          const neckDropHere =
            frontFactor * Math.min(8.5, p.frontNeckDrop * 0.72) +
            (1 - frontFactor) * 1.0;
          const collarH = ribH * (0.88 - 0.35 * frontFactor * frontFactor);
          const y = yNeckBase - neckDropHere + collarH * v;
          const r = rNeck + 0.5 + 0.25 * (1 - v);
          return new THREE.Vector3(r * 1.04 * Math.cos(theta), y, r * 0.96 * Math.sin(theta));
        },
        false
      )
    );
    // Both sleeve cuffs gold stripes
    for (const side of [-1, 1] as const) {
      const startRatio = sleeveFabLen / cuffTotalLen;
      const segSpan = 1 - startRatio;
      goldBands.push(
        buildSleeveTube({
          side,
          shoulderX: side * shoulderSocketX,
          shoulderY: shoulderSocketY,
          sleeveLengthCm: cuffTotalLen,
          rTopCm: rArmCuff * 0.82,
          rEndCm: rRibCuff,
          armAngleDeg: 18,
          radialSegs: 28,
          lengthSegs: 2,
          startV: startRatio + (bandV - bandHalf) * segSpan,
          endV: startRatio + (bandV + bandHalf) * segSpan,
          radialOffset: 0.28,
        })
      );
    }
  }
  const goldStripesGeo = mergeSimpleBufferGeometries(goldBands);

  // Seam lines (Center front placket, angled welt pockets, hem rib join)
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
  const outVec = (v: THREE.Vector3, amt = 0.25): THREE.Vector3 => {
    const rad = Math.hypot(v.x, v.z) || 1;
    return new THREE.Vector3(v.x + (v.x / rad) * amt, v.y, v.z + (v.z / rad) * amt);
  };

  // Center front press-stud opening line
  const cfPts: THREE.Vector3[] = [];
  for (let j = 0; j <= 28; j++) {
    cfPts.push(outVec(sampleBomberTorso(Math.PI / 2, j / 28), 0.35));
  }
  pushPoly(cfPts);

  // Two Angled Welt Pockets on left & right front chest/waist
  for (const side of [-1, 1] as const) {
    const tBot = Math.PI / 2 + side * 0.86;
    const tTop = Math.PI / 2 + side * 0.56;
    const vBot = 0.14;
    const vTop = 0.42;
    const p1 = outVec(sampleBomberTorso(tBot, vBot), 0.42);
    const p2 = outVec(sampleBomberTorso(tTop, vTop), 0.42);
    const p3 = outVec(sampleBomberTorso(tTop - side * 0.11, vTop - 0.02), 0.42);
    const p4 = outVec(sampleBomberTorso(tBot - side * 0.11, vBot - 0.02), 0.42);
    pushPoly([p1, p2, p3, p4, p1]);
  }

  const seamLinesGeometry = new THREE.BufferGeometry();
  seamLinesGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(seamSegments, 3)
  );

  // 6× 11mm Press Studs down Center Front
  const studParts: THREE.BufferGeometry[] = [];
  for (let s = 0; s < 6; s++) {
    const v = 0.06 + (0.86 * s) / 5;
    const pos = outVec(sampleBomberTorso(Math.PI / 2, v), 0.42);
    const stud = new THREE.CylinderGeometry(0.55, 0.55, 0.28, 16);
    stud.rotateX(Math.PI / 2);
    stud.translate(pos.x, pos.y, pos.z);
    studParts.push(stud);
  }
  const hardwareGeometry = mergeSimpleBufferGeometries(studParts);
  void stiffness;

  return {
    primaryGeometry,
    waistbandGeometry,
    seamLinesGeometry,
    hardwareGeometry,
    extraParts: [
      {
        geometry: goldStripesGeo,
        color: "#EAB308",
        roughness: 0.72,
        metalness: 0.08,
      },
    ],
    metrics: {
      waistElevationCm: Math.round(yNeckBase * 10) / 10,
      hemElevationCm: Math.round(yRibBottom * 10) / 10,
      detailLabel: `89865 Bomber Fleece • Ngực ${p.chest} cm • Bo 1×1 2 sọc Gold`,
    },
  };
}

/**
 * Build real-time 3D STYLE HAZE026-028 COLORBLOCK POLO SHIRT!
 * Features razor-sharp 4-panel diagonal colorblock front (White FRT-1, Black FRT-2,
 * Silver FRT-3, Dark Bottle FRT-4), solid back + short set-in sleeves, flat-knit
 * folded polo collar & 2/3-button front placket!
 */
export function buildColorblockPolo3D(
  rawParams: ParamValues,
  stiffness = 1.0,
  category: MannequinCategory = "women",
  sizeCode = "M"
): Garment3DBuildResult {
  const p = parseColorblockPoloParams(rawParams);
  const body = getMannequinBodySpec(category, sizeCode);
  const heightScale = body.heightMidCm / 161;

  const yWaist = 102 * heightScale;
  const yNeckBase = yWaist + body.backLengthCm * 0.96;
  const yShoulder = yWaist + body.backLengthCm * 0.85;
  const bodyLen = Math.min(82, Math.max(42, (p.cbLength + p.backNeckDrop) * 0.94));
  const yHem = yNeckBase - bodyLen;

  const rChest = Math.max(body.bustCm / (2 * Math.PI) + 1.35, (p.chest / (2 * Math.PI)) * 0.94);
  const rNeck = Math.max(body.neckCm / (2 * Math.PI) + 0.65, (p.neckWidth * 2.45) / (2 * Math.PI));
  const halfShoulder = Math.max(body.shoulderCm * 0.5 + 1.2, p.shoulder * 0.5 * 0.9);

  // Evaluate polo torso cross-section at any (theta, y)
  const evalPoloPoint = (theta: number, y: number, extraR = 0): THREE.Vector3 => {
    const frontFactor = Math.max(0, Math.sin(theta));
    const neckDropHere =
      frontFactor * Math.min(7.5, p.frontNeckDrop * 0.72) +
      (1 - frontFactor) * p.backNeckDrop * 0.85;
    const yTopHere = yNeckBase - neckDropHere;
    const v = Math.min(1, Math.max(0, (y - yHem) / Math.max(1, yTopHere - yHem)));

    let r = rChest;
    let kx = 1.14;
    let kz = 0.87;
    if (v > 0.78) {
      const t = (v - 0.78) / 0.22;
      const smooth = t * t * (3 - 2 * t);
      const shoulderR = Math.max(rChest * 0.88, halfShoulder * 0.81);
      r = shoulderR + (rNeck - shoulderR) * smooth;
      kx = 1.24 + (1.03 - 1.24) * smooth;
      kz = 0.76 + (0.96 - 0.76) * smooth;
    }

    const softFold = 0.22 * Math.sin(5 * theta - 0.2) * (1 - v * 0.7);
    return new THREE.Vector3(
      (r + softFold + extraR) * kx * Math.cos(theta),
      y,
      (r + softFold + extraR) * kz * Math.sin(theta) + 0.2 * (1 - v)
    );
  };

  // Back half (theta from PI to 2*PI) -> Solid Main Color (Dark Bottle)
  const backGeo = buildSurfacePatchGeometry(42, 32, (u, v) => {
    const theta = Math.PI + u * Math.PI;
    const yTopHere = yNeckBase - p.backNeckDrop * 0.85;
    const y = yHem + (yTopHere - yHem) * v;
    return evalPoloPoint(theta, y);
  });

  // Short Set-In Sleeves -> Solid Main Color (Dark Bottle)
  const shortLen = Math.max(14, p.sleeveLength * 0.92);
  const rArmTop = Math.max(5.5, (p.armholeHalf * 1.15) / Math.PI);
  const rArmEnd = Math.max(4.5, (p.sleeveOpeningHalf * 2) / (2 * Math.PI) * 0.9);
  const shoulderSocketX = halfShoulder * 0.93;
  const shoulderSocketY = yShoulder - 2.0;

  const leftSleeve = buildSleeveTube({
    side: -1,
    shoulderX: -shoulderSocketX,
    shoulderY: shoulderSocketY,
    sleeveLengthCm: shortLen,
    rTopCm: rArmTop,
    rEndCm: rArmEnd,
    armAngleDeg: 22,
    lengthSegs: 18,
  });
  const rightSleeve = buildSleeveTube({
    side: 1,
    shoulderX: shoulderSocketX,
    shoulderY: shoulderSocketY,
    sleeveLengthCm: shortLen,
    rTopCm: rArmTop,
    rEndCm: rArmEnd,
    armAngleDeg: 22,
    lengthSegs: 18,
  });

  const primaryParts: THREE.BufferGeometry[] = [backGeo, leftSleeve, rightSleeve];
  const extraParts: ExtraPart3D[] = [];
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

  if (p.diagonalColorblock) {
    // Diagonal lines matching HAZE026 photo: higher on viewer's left (-X, u=0), sloping down to viewer's right (+X, u=1)
    const y1Left = yNeckBase - bodyLen * 0.35;
    const y1Right = yNeckBase - bodyLen * 0.51;
    const stripeBandY = Math.min(bodyLen * 0.14, p.stripeWidth * 1.04);

    const y1At = (u: number) => y1Left + (y1Right - y1Left) * u;
    const y2At = (u: number) => y1At(u) - stripeBandY;
    const y3At = (u: number) => y2At(u) - stripeBandY;

    // 1. FRT-1 White Upper Panel
    const frt1White = buildSurfacePatchGeometry(44, 18, (u, v) => {
      const theta = Math.PI * (1 - u); // PI (-X viewer left) -> 0 (+X viewer right) across +Z front!
      const frontFactor = Math.max(0, Math.sin(theta));
      const yTop = yNeckBase - frontFactor * Math.min(7.5, p.frontNeckDrop * 0.72);
      const yBot = y1At(u);
      return evalPoloPoint(theta, yBot + (yTop - yBot) * v);
    });
    // 2. FRT-2 Black Diagonal Stripe
    const frt2Black = buildSurfacePatchGeometry(44, 6, (u, v) => {
      const theta = Math.PI * (1 - u);
      const yBot = y2At(u);
      const yTop = y1At(u);
      return evalPoloPoint(theta, yBot + (yTop - yBot) * v);
    });
    // 3. FRT-3 Silver Diagonal Trim Stripe
    const frt3Silver = buildSurfacePatchGeometry(44, 6, (u, v) => {
      const theta = Math.PI * (1 - u);
      const yBot = y3At(u);
      const yTop = y2At(u);
      return evalPoloPoint(theta, yBot + (yTop - yBot) * v);
    });
    // 4. FRT-4 Dark Bottle Lower Panel (merged into primaryGeometry!)
    const frt4Bottle = buildSurfacePatchGeometry(44, 14, (u, v) => {
      const theta = Math.PI * (1 - u);
      const yTop = y3At(u);
      return evalPoloPoint(theta, yHem + (yTop - yHem) * v);
    });

    primaryParts.push(frt4Bottle);
    extraParts.push(
      { geometry: frt1White, color: "#F8FAFC", roughness: 0.82, metalness: 0.02 },
      { geometry: frt2Black, color: "#18181B", roughness: 0.82, metalness: 0.03 },
      { geometry: frt3Silver, color: "#CBD5E1", roughness: 0.74, metalness: 0.08 }
    );

    // Crisp diagonal topstitch seam overlays
    for (const yFn of [y1At, y2At, y3At]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 40; i++) {
        const u = i / 40;
        const theta = Math.PI * (1 - u);
        pts.push(evalPoloPoint(theta, yFn(u), 0.24));
      }
      pushPoly(pts);
    }
  } else {
    // Solid front polo panel
    const solidFront = buildSurfacePatchGeometry(44, 32, (u, v) => {
      const theta = Math.PI * (1 - u);
      const frontFactor = Math.max(0, Math.sin(theta));
      const yTop = yNeckBase - frontFactor * Math.min(7.5, p.frontNeckDrop * 0.72);
      return evalPoloPoint(theta, yHem + (yTop - yHem) * v);
    });
    primaryParts.push(solidFront);
  }

  const primaryGeometry = mergeSimpleBufferGeometries(primaryParts);

  // Folded Flat-Knit Polo Collar + Center-Front Placket (rendered in main Dark Bottle fabric!)
  const collarStandGeo = buildLoftedTubeGeometry(
    64,
    6,
    (theta, v) => {
      const frontFactor = Math.max(0, Math.sin(theta));
      const yBase =
        yNeckBase -
        frontFactor * Math.min(7.5, p.frontNeckDrop * 0.72) -
        (1 - frontFactor) * p.backNeckDrop * 0.85;
      const y = yBase + 2.6 * v;
      const r = rNeck + 0.35;
      return new THREE.Vector3(r * 1.04 * Math.cos(theta), y, r * 0.96 * Math.sin(theta));
    },
    false
  );
  // Turned-down Polo Collar Leaf flaring gracefully outward over shoulder/neck
  const collarLeafGeo = buildSurfacePatchGeometry(60, 8, (u, v) => {
    // Open slightly at center front (leave ~12 deg gap for placket V)
    const theta = Math.PI * 0.56 + u * Math.PI * 1.88;
    const frontFactor = Math.max(0, Math.sin(theta));
    const yCrease =
      yNeckBase -
      frontFactor * Math.min(7.5, p.frontNeckDrop * 0.72) -
      (1 - frontFactor) * p.backNeckDrop * 0.85 +
      2.6;
    const leafLen = Math.min(7.5, p.collarDepth * 0.78);
    const y = yCrease - leafLen * 0.72 * v;
    const r = rNeck + 0.45 + leafLen * 0.68 * v;
    return new THREE.Vector3(r * 1.06 * Math.cos(theta), y, r * 0.98 * Math.sin(theta));
  });

  // Dark Bottle Front Placket Patch proud over the White upper chest!
  const plkTop = yNeckBase - Math.min(7.5, p.frontNeckDrop * 0.72) + 0.4;
  const plkBot = plkTop - Math.min(18, p.placketLength * 0.9);
  const plkHalfAngle = Math.min(0.14, (p.placketWidth * 0.52) / Math.max(8, rChest));
  const placketGeo = buildSurfacePatchGeometry(6, 12, (u, v) => {
    const theta = Math.PI / 2 - plkHalfAngle + u * plkHalfAngle * 2;
    const y = plkBot + (plkTop - plkBot) * v;
    return evalPoloPoint(theta, y, 0.38);
  });

  const waistbandGeometry = mergeSimpleBufferGeometries([
    collarStandGeo,
    collarLeafGeo,
    placketGeo,
  ]);

  // 2 or 3 Polo Placket Buttons (matching real HAZE026 .PLT rule!)
  const buttonCount = p.chest <= 99 ? 2 : 3;
  const btnParts: THREE.BufferGeometry[] = [];
  for (let b = 0; b < buttonCount; b++) {
    const yBtn = plkTop - 2.4 - ((plkTop - plkBot - 5.2) * b) / Math.max(1, buttonCount - 1);
    const pos = evalPoloPoint(Math.PI / 2, yBtn, 0.52);
    const btn = new THREE.CylinderGeometry(0.48, 0.48, 0.22, 16);
    btn.rotateX(Math.PI / 2);
    btn.translate(pos.x, pos.y, pos.z);
    btnParts.push(btn);
  }
  const hardwareGeometry = mergeSimpleBufferGeometries(btnParts);

  // Hem topstitch ring
  const hemPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    hemPts.push(evalPoloPoint((i / 64) * Math.PI * 2, yHem + 1.8, 0.22));
  }
  pushPoly(hemPts);

  const seamLinesGeometry = new THREE.BufferGeometry();
  seamLinesGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(seamSegments, 3)
  );
  void stiffness;

  return {
    primaryGeometry,
    waistbandGeometry,
    seamLinesGeometry,
    hardwareGeometry,
    extraParts,
    metrics: {
      waistElevationCm: Math.round(yNeckBase * 10) / 10,
      hemElevationCm: Math.round(yHem * 10) / 10,
      detailLabel: p.diagonalColorblock
        ? `HAZE026-028 • Phối chéo 4 màu (${buttonCount} nút trụ)`
        : `HAZE026 Polo • Ngực ${p.chest} cm (${buttonCount} nút trụ)`,
    },
  };
}
