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
    seamColor: "#E0E7FF",
    roughness: 0.78,
    metalness: 0.02,
    stiffness: 1.0,
    category: "general",
  },
  {
    id: "ivory-linen",
    name: "Kem Linen (Ivory)",
    color: "#E7DFD3",
    seamColor: "#64748B",
    roughness: 0.88,
    metalness: 0.01,
    stiffness: 1.05,
    category: "general",
  },
  {
    id: "crimson-silk",
    name: "Đỏ Đô Lụa (Satin)",
    color: "#9F1239",
    seamColor: "#FFE4E6",
    roughness: 0.38,
    metalness: 0.08,
    stiffness: 0.78,
    category: "general",
  },
  {
    id: "noir-twill",
    name: "Đen Tuyết Mưa",
    color: "#1E293B",
    seamColor: "#94A3B8",
    roughness: 0.7,
    metalness: 0.03,
    stiffness: 1.2,
    category: "general",
  },
  {
    id: "teal-poplin",
    name: "Xanh Ngọc Poplin",
    color: "#0D9488",
    seamColor: "#CCFBF1",
    roughness: 0.74,
    metalness: 0.02,
    stiffness: 1.0,
    category: "general",
  },
  // Authentic Denim Presets (WV1499LSB-TD — SH3790)
  {
    id: "sh3790-mstone",
    name: "SH3790 M-Stone Denim",
    color: "#36537E",
    seamColor: "#D97706",
    roughness: 0.92,
    metalness: 0.01,
    stiffness: 1.22,
    category: "denim",
  },
  {
    id: "raw-indigo-denim",
    name: "Raw Dark Indigo",
    color: "#1B2A48",
    seamColor: "#EAB308",
    roughness: 0.88,
    metalness: 0.02,
    stiffness: 1.26,
    category: "denim",
  },
  {
    id: "vintage-ice-denim",
    name: "Vintage Stone Light",
    color: "#698BB5",
    seamColor: "#D97706",
    roughness: 0.92,
    metalness: 0.01,
    stiffness: 1.15,
    category: "denim",
  },
  {
    id: "washed-black-denim",
    name: "Washed Black Jean",
    color: "#222226",
    seamColor: "#71717A",
    roughness: 0.9,
    metalness: 0.01,
    stiffness: 1.2,
    category: "denim",
  },
  {
    id: "ecru-denim",
    name: "Ecru Natural Denim",
    color: "#E0D7C8",
    seamColor: "#A16207",
    roughness: 0.92,
    metalness: 0.01,
    stiffness: 1.18,
    category: "denim",
  },
  // Authentic Polyester Cotton Fleece Presets (Style 89865 Bomber Jacket)
  {
    id: "maroon-fleece",
    name: "89865 Maroon Fleece (Mernda)",
    color: "#5C1327",
    seamColor: "#EAB308",
    roughness: 0.95,
    metalness: 0.01,
    stiffness: 1.12,
    category: "fleece",
  },
  {
    id: "navy-fleece",
    name: "School Navy Fleece",
    color: "#152B4D",
    seamColor: "#EAB308",
    roughness: 0.95,
    metalness: 0.01,
    stiffness: 1.12,
    category: "fleece",
  },
  {
    id: "forest-fleece",
    name: "Forest Green Fleece",
    color: "#123228",
    seamColor: "#FACC15",
    roughness: 0.95,
    metalness: 0.01,
    stiffness: 1.12,
    category: "fleece",
  },
  {
    id: "charcoal-fleece",
    name: "Charcoal Heather Fleece",
    color: "#2C3748",
    seamColor: "#CBD5E1",
    roughness: 0.95,
    metalness: 0.01,
    stiffness: 1.12,
    category: "fleece",
  },
  // Authentic LA65V Piqué Polo Presets (Style HAZE026-028 Colorblock Polo)
  {
    id: "haze026-bottle",
    name: "HAZE026 LA65V Dark Bottle",
    color: "#11322A",
    seamColor: "#CBD5E1",
    roughness: 0.88,
    metalness: 0.01,
    stiffness: 1.0,
    category: "polo",
  },
  {
    id: "haze-navy",
    name: "LA65V Classic Navy",
    color: "#162844",
    seamColor: "#CBD5E1",
    roughness: 0.88,
    metalness: 0.01,
    stiffness: 1.0,
    category: "polo",
  },
  {
    id: "haze-maroon",
    name: "LA65V Heritage Maroon",
    color: "#5C1327",
    seamColor: "#E2E8F0",
    roughness: 0.88,
    metalness: 0.01,
    stiffness: 1.0,
    category: "polo",
  },
  {
    id: "haze-royal",
    name: "LA65V Royal Blue",
    color: "#1A44B8",
    seamColor: "#E2E8F0",
    roughness: 0.88,
    metalness: 0.01,
    stiffness: 1.0,
    category: "polo",
  },
];

export const WAIST_ELEVATION_CM = 102;
const ELLIPSE_KX = 1.14;
const ELLIPSE_KZ = 0.86;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Evaluate exact mannequin outer surface point (including bust fullness & waist hollow)
 * at height `yCm` and angle `theta`. Used by BOTH the mannequin mesh AND the garment
 * collision-clearance solver so clothing NEVER pokes/clips through the mannequin!
 */
function mannequinSurfaceAt(
  yCm: number,
  theta: number,
  body: BodyMeasurementStandard,
  category: MannequinCategory
): { x: number; z: number; rx: number; rz: number; zOff: number } {
  const heightScale = body.heightMidCm / 161;
  const yWaist = 102 * heightScale;
  const prof = bodyProfileAtY(yCm, body);
  const bustBump =
    Math.exp(-Math.pow((yCm - (yWaist + body.backLengthCm * 0.47)) / 7.5, 2)) *
    Math.max(0, Math.sin(theta)) *
    (category === "women" ? 1.15 : 0.45) *
    Math.pow(Math.sin(theta), 1.4);
  const backHollow =
    Math.exp(-Math.pow((yCm - yWaist) / 9, 2)) *
    Math.max(0, -Math.sin(theta)) *
    0.55;
  const rx = prof.rx;
  const rz = prof.rz + bustBump - backHollow;
  return {
    x: rx * Math.cos(theta),
    z: rz * Math.sin(theta) + prof.zOffset,
    rx,
    rz,
    zOff: prof.zOffset,
  };
}

/**
 * Exact radial collision-clearance solver (like CLO3D avatar offset):
 * Pushes any cloth vertex smoothly outside the mannequin surface by at least `minGapCm`
 * (zero poke-through across chest, bust, collarbone, belly, or hips for any size/mannequin!).
 */
function enforceMannequinClearance(
  pt: THREE.Vector3,
  body: BodyMeasurementStandard,
  category: MannequinCategory,
  minGapCm = 0.95
): THREE.Vector3 {
  const heightScale = body.heightMidCm / 161;
  const yWaist = 102 * heightScale;
  const yCrotch = yWaist - body.crotchDepthCm;
  const yNeckBase = yWaist + body.backLengthCm * 0.99;

  if (pt.y < yCrotch - 2.0 || pt.y > yNeckBase + 0.8) {
    return pt;
  }

  const clampedY = Math.max(yCrotch, pt.y);
  const prof = bodyProfileAtY(clampedY, body);
  const dz = pt.z - prof.zOffset;
  const theta = Math.atan2(dz, pt.x);
  const surf = mannequinSurfaceAt(clampedY, theta, body, category);

  const bodyDx = surf.x;
  const bodyDz = surf.z - prof.zOffset;
  const bodyDist = Math.hypot(bodyDx, bodyDz);
  const ptDist = Math.hypot(pt.x, dz);
  const reqDist = bodyDist + minGapCm;

  if (ptDist < reqDist) {
    const dirX = ptDist > 1e-4 ? pt.x / ptDist : Math.cos(theta);
    const dirZ = ptDist > 1e-4 ? dz / ptDist : Math.sin(theta);
    return new THREE.Vector3(dirX * reqDist, pt.y, prof.zOffset + dirZ * reqDist);
  }
  return pt;
}

/**
 * Evaluate smooth anatomical torso cross-section from TCVN/Asian Body Standards.
 * Uses smooth curved shoulder taper (NO sharp boxy plateau!) so the tailor dummy
 * has natural deltoid shoulders, collarbone slope, sculpted bust/waist/hips.
 */
function bodyProfileAtY(
  yCm: number,
  body: BodyMeasurementStandard
): { rx: number; rz: number; zOffset: number } {
  const heightScale = body.heightMidCm / 161;
  const yWaist = 102 * heightScale;
  const yCrotch = yWaist - body.crotchDepthCm;
  const yHip = yCrotch + 8.0;
  const yBust = yWaist + body.backLengthCm * 0.47;
  const yArmpit = yWaist + body.backLengthCm * 0.67;
  const yShoulder = yWaist + body.backLengthCm * 0.83;
  const yCollarbone = yWaist + body.backLengthCm * 0.93;
  const yNeckBase = yWaist + body.backLengthCm * 0.99;
  const yNeckTop = yNeckBase + 7.2 * heightScale;

  const rWaist = body.waistCm / (2 * Math.PI);
  const rBust = body.bustCm / (2 * Math.PI);
  const rHip = body.hipCm / (2 * Math.PI);
  const rNeck = body.neckCm / (2 * Math.PI);
  // Keep tailor dummy shoulders sleek & rounded (real Stockman mannequin armhole profile)
  const halfShoulder = body.shoulderCm * 0.46;

  const stops: Array<{ y: number; rx: number; rz: number; zOff: number }> = [
    { y: yCrotch, rx: rHip * 1.03, rz: rHip * 0.78, zOff: -0.6 },
    { y: yHip, rx: rHip * 1.15, rz: rHip * 0.88, zOff: -0.8 },
    { y: (yHip + yWaist) / 2, rx: lerp(rHip, rWaist, 0.5) * 1.14, rz: lerp(rHip, rWaist, 0.5) * 0.85, zOff: -0.3 },
    { y: yWaist, rx: rWaist * ELLIPSE_KX, rz: rWaist * ELLIPSE_KZ, zOff: 0.0 },
    { y: (yWaist + yBust) / 2, rx: lerp(rWaist, rBust, 0.5) * 1.13, rz: lerp(rWaist, rBust, 0.5) * 0.89, zOff: 0.4 },
    { y: yBust, rx: rBust * 1.11, rz: rBust * 0.95, zOff: 1.1 },
    { y: yArmpit, rx: Math.max(rBust * 1.14, halfShoulder * 0.94), rz: rBust * 0.82, zOff: 0.5 },
    { y: yShoulder, rx: halfShoulder, rz: rBust * 0.62, zOff: 0.1 },
    { y: yCollarbone, rx: lerp(halfShoulder, rNeck * 1.25, 0.65), rz: lerp(rBust * 0.62, rNeck * 1.05, 0.65), zOff: 0.0 },
    { y: yNeckBase, rx: rNeck * 1.06, rz: rNeck * 0.98, zOff: 0.0 },
    { y: yNeckTop, rx: rNeck * 0.94, rz: rNeck * 0.94, zOff: 0.0 },
  ];

  if (yCm <= stops[0].y) {
    return { rx: stops[0].rx, rz: stops[0].rz, zOffset: stops[0].zOff };
  }
  if (yCm >= stops[stops.length - 1].y) {
    const last = stops[stops.length - 1];
    return { rx: last.rx, rz: last.rz, zOffset: last.zOff };
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (yCm >= a.y && yCm <= b.y) {
      const t = smoothstep(a.y, b.y, yCm);
      return {
        rx: lerp(a.rx, b.rx, t),
        rz: lerp(a.rz, b.rz, t),
        zOffset: lerp(a.zOff, b.zOff, t),
      };
    }
  }
  return { rx: rWaist * ELLIPSE_KX, rz: rWaist * ELLIPSE_KZ, zOffset: 0 };
}

function buildLoftedTubeGeometry(
  radialSegs: number,
  heightSegs: number,
  sampleFn: (theta: number, v: number) => THREE.Vector3,
  capBottom = false,
  flipWinding = false
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
  // Standard upward-lofted tube (y increases with v, theta CCW in XZ -> d/dtheta = +Z, d/dv = +Y):
  // (b - a) x (d - a) = +Y x +Z = +X (OUTWARD normal!) when flipWinding = false!
  for (let j = 0; j < heightSegs; j++) {
    for (let i = 0; i < radialSegs; i++) {
      const a = j * stride + i;
      const b = a + stride;
      const c = b + 1;
      const d = a + 1;
      if (flipWinding) {
        indices.push(a, d, b);
        indices.push(b, d, c);
      } else {
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
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
      if (flipWinding) {
        indices.push(centerIdx, i + 1, i);
      } else {
        indices.push(centerIdx, i, i + 1);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildSurfacePatchGeometry(
  uSegs: number,
  vSegs: number,
  sampleFn: (u: number, v: number) => THREE.Vector3,
  flipWinding = false
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
      if (flipWinding) {
        indices.push(a, b, d);
        indices.push(b, c, d);
      } else {
        indices.push(a, d, b);
        indices.push(b, d, c);
      }
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
 * Merge BufferGeometries while PRESERVING UV attributes so procedural fabric textures render cleanly!
 */
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
  const uvs = new Float32Array(totalVerts * 2);
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;
  for (const g of geometries) {
    const pos = g.getAttribute("position");
    const uv = g.getAttribute("uv");
    for (let i = 0; i < pos.count; i++) {
      positions[(vOffset + i) * 3] = pos.getX(i);
      positions[(vOffset + i) * 3 + 1] = pos.getY(i);
      positions[(vOffset + i) * 3 + 2] = pos.getZ(i);
      if (uv) {
        uvs[(vOffset + i) * 2] = uv.getX(i);
        uvs[(vOffset + i) * 2 + 1] = uv.getY(i);
      }
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
  merged.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeVertexNormals();
  return merged;
}

/**
 * Build SCULPTED ATELIER TAILOR MANNEQUIN (Stockman / Alvanon Style)
 * Smooth anatomical shoulders, natural neck finial, and unified pelvis-to-legs form.
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
  const waistScale = Math.max(0.78, Math.min(1.26, waistCm / Math.max(40, std.waistCm)));
  const body: BodyMeasurementStandard = {
    ...std,
    waistCm: std.waistCm * (0.4 + 0.6 * waistScale),
    hipCm: std.hipCm * (0.55 + 0.45 * waistScale),
    thighCm: std.thighCm * (0.6 + 0.4 * waistScale),
  };

  const heightScale = body.heightMidCm / 161;
  const yWaist = 102 * heightScale;
  const yCrotch = yWaist - body.crotchDepthCm;
  const yNeckTop = yWaist + body.backLengthCm * 0.99 + 7.2 * heightScale;

  // Sculpted smooth torso from Crotch up to Neck Top (uses shared mannequinSurfaceAt!)
  const torsoPart = buildLoftedTubeGeometry(
    72,
    56,
    (theta, v) => {
      const y = yCrotch + (yNeckTop - yCrotch) * v;
      const s = mannequinSurfaceAt(y, theta, body, category);
      return new THREE.Vector3(s.x, y, s.z);
    },
    true
  );

  const bodyParts: THREE.BufferGeometry[] = [torsoPart];

  // Sculpted two legs (blending smoothly into lower pelvis!)
  if (includeLegs) {
    const rThigh = body.thighCm / (2 * Math.PI);
    const rKnee = body.kneeCm / (2 * Math.PI);
    const rAnkle = Math.max(3.3, (body.hemOpeningCm * 0.74) / (2 * Math.PI));
    const yAnkle = 5.5 * heightScale;
    const yKnee = yCrotch - 33 * heightScale;
    const yCalf = yCrotch - 48 * heightScale;
    const legSpanTop = rThigh * 1.01;
    const legSpanAnkle = legSpanTop * 0.92;

    for (const side of [-1, 1] as const) {
      const legGeo = buildLoftedTubeGeometry(
        36,
        40,
        (theta, v) => {
          const y = yAnkle + (yCrotch + 4.8 - yAnkle) * v;
          let r = rAnkle;
          if (y >= yKnee) {
            const t = Math.min(1, (y - yKnee) / Math.max(1, yCrotch + 4.8 - yKnee));
            r = rKnee + (rThigh * 1.0 - rKnee) * Math.pow(t, 0.85);
          } else if (y >= yCalf) {
            const t = (y - yCalf) / Math.max(1, yKnee - yCalf);
            r = rKnee * 0.94 + (rKnee - rKnee * 0.94) * t;
          } else {
            const t = (y - yAnkle) / Math.max(1, yCalf - yAnkle);
            r = rAnkle + (rKnee * 0.94 - rAnkle) * Math.pow(t, 0.72);
          }
          // Taper top 8% smoothly inside hip pelvis so there is no step!
          const topTaper = v > 0.92 ? 1 - 0.14 * ((v - 0.92) / 0.08) : 1;
          const centerX = side * lerp(legSpanAnkle, legSpanTop, v);
          const calfBackZ =
            y < yKnee && y > yAnkle + 8
              ? -0.95 * Math.sin(((y - yAnkle) / (yKnee - yAnkle)) * Math.PI)
              : 0;
          return new THREE.Vector3(
            centerX + r * topTaper * 0.97 * Math.cos(theta),
            y,
            r * topTaper * 1.01 * Math.sin(theta) + calfBackZ - 0.35
          );
        },
        true
      );
      bodyParts.push(legGeo);
    }
  }

  const torsoGeometry = mergeSimpleBufferGeometries(bodyParts);

  // Turned Parisian Wooden Atelier Neck Finial (collar disc + tapered wood stem + rounded knob!)
  const topProf = bodyProfileAtY(yNeckTop, body);
  const rCap = topProf.rx * 1.02;
  const finialPts = [
    new THREE.Vector2(0.01, yNeckTop - 0.2),
    new THREE.Vector2(rCap, yNeckTop - 0.2),
    new THREE.Vector2(rCap * 1.04, yNeckTop + 0.9),
    new THREE.Vector2(rCap * 0.72, yNeckTop + 1.8),
    new THREE.Vector2(rCap * 0.38, yNeckTop + 2.6),
    new THREE.Vector2(rCap * 0.56, yNeckTop + 4.0),
    new THREE.Vector2(rCap * 0.44, yNeckTop + 5.2),
    new THREE.Vector2(0.01, yNeckTop + 5.7),
  ];
  const neckCapGeometry = new THREE.LatheGeometry(finialPts, 40);

  const poleHeight = yCrotch;
  const poleGeometry = new THREE.CylinderGeometry(0.85, 0.95, Math.max(10, poleHeight), 20);
  poleGeometry.translate(0, poleHeight / 2, -4.8);

  const basePts = [
    new THREE.Vector2(0.01, 0),
    new THREE.Vector2(19.5, 0),
    new THREE.Vector2(19.0, 1.4),
    new THREE.Vector2(14.5, 2.2),
    new THREE.Vector2(3.2, 3.0),
    new THREE.Vector2(1.4, 4.4),
    new THREE.Vector2(0.01, 4.4),
  ];
  const baseGeometry = new THREE.LatheGeometry(basePts, 48);
  baseGeometry.translate(0, 0, -1.6);

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
  /** Optional procedural texture kind for rich realistic material shading */
  textureKind?: "polo-torso" | "polo-solid" | "rib-striped" | "fleece" | "denim" | "solid";
  /** Optional extra parameters for procedural canvas texture generation */
  textureParams?: Record<string, number | string | boolean>;
}

export interface Garment3DBuildResult {
  primaryGeometry: THREE.BufferGeometry;
  waistbandGeometry: THREE.BufferGeometry;
  seamLinesGeometry: THREE.BufferGeometry;
  hardwareGeometry: THREE.BufferGeometry | null;
  extraParts?: ExtraPart3D[];
  /** Texture style hint for primary & waistband meshes */
  primaryTextureKind?: "woven" | "denim" | "fleece" | "polo-torso" | "polo-solid";
  waistbandTextureKind?: "woven" | "denim" | "rib-striped" | "polo-solid";
  textureParams?: Record<string, number | string | boolean>;
  metrics: {
    waistElevationCm: number;
    hemElevationCm: number;
    detailLabel: string;
  };
}

/**
 * 1. REAL-TIME 3D FLARED CIRCLE SKIRT
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
    const minClearanceR = Math.max(prof.rx, prof.rz) * 0.94 + 0.7;
    if (rBase < minClearanceR) rBase = minClearanceR;

    const roundnessBlend = Math.min(1, Math.pow(v, 0.7) * (0.45 + 0.45 * flareRatio));
    const kx = lerp(ELLIPSE_KX, 1.02, roundnessBlend);
    const kz = lerp(ELLIPSE_KZ, 0.98, roundnessBlend);
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

  const isCurvedWb = params.waistbandType === "curved";
  const waistbandGeometry = buildLoftedTubeGeometry(
    96,
    10,
    (theta, t) => {
      const edgeBevel = Math.sin(t * Math.PI) * 0.22;
      const cfFactor = Math.max(0, Math.sin(theta));
      const contourDip = isCurvedWb ? -0.75 * cfFactor * cfFactor : 0;
      const y = yWaist + t * wbHeight + contourDip;
      const prof = bodyProfileAtY(y, { ...body, waistCm });
      const taperAdjust = isCurvedWb ? -0.22 * t : 0.12 * t;
      const rWb = waistCm / (2 * Math.PI) + 0.55 + edgeBevel + taperAdjust;
      return new THREE.Vector3(
        rWb * ELLIPSE_KX * Math.cos(theta),
        y,
        rWb * ELLIPSE_KZ * Math.sin(theta) + prof.zOffset
      );
    },
    false
  );

  const seamSegments: number[] = [];
  const pushLine = (pts: THREE.Vector3[]) => {
    for (let k = 0; k < pts.length - 1; k++) {
      seamSegments.push(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
    }
  };
  const waistRing: THREE.Vector3[] = [];
  for (let i = 0; i <= 120; i++) {
    const p = sampleSkirtSurface((i / 120) * Math.PI * 2, 0.005);
    p.x *= 1.007;
    p.z *= 1.007;
    waistRing.push(p);
  }
  pushLine(waistRing);

  const seamAngles = params.pieceMultiplier === 2 ? [0, Math.PI] : [Math.PI * 1.5];
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
  seamLinesGeometry.setAttribute("position", new THREE.Float32BufferAttribute(seamSegments, 3));

  let hardwareGeometry: THREE.BufferGeometry | null = null;
  if (params.includeZipperNotch) {
    const zipAngle = params.pieceMultiplier === 2 ? Math.PI : Math.PI * 1.5;
    const pStop = sampleSkirtSurface(zipAngle, Math.min(0.75, 18 / skirtLengthCm));
    const rad = Math.hypot(pStop.x, pStop.z) || 1;
    const zStopGeo = new THREE.SphereGeometry(0.55, 16, 16);
    zStopGeo.translate(
      pStop.x + (pStop.x / rad) * 0.22,
      pStop.y,
      pStop.z + (pStop.z / rad) * 0.22
    );
    hardwareGeometry = zStopGeo;
  }

  const hemSample = sampleSkirtSurface(Math.PI / 2, 1);
  return {
    primaryGeometry: skirtGeometry,
    waistbandGeometry,
    seamLinesGeometry,
    hardwareGeometry,
    primaryTextureKind: "woven",
    waistbandTextureKind: "woven",
    metrics: {
      waistElevationCm: Math.round(yWaist * 10) / 10,
      hemElevationCm: Math.round(hemSample.y * 10) / 10,
      detailLabel: `${fluteCount} múi sóng rũ tự nhiên`,
    },
  };
}

/**
 * 2. SEAMLESS UNIFIED-SADDLE 3D LOW SUPER BAGGY JEAN (WV1499LSB-TD)
 * Uses continuous bifurcated Left + Right Half-Trouser Topology that zips seamlessly
 * along the anatomical Center-Front Fly, Crotch Saddle Fork, and Center-Back Seat Seam!
 * ZERO horizontal cut ledge under the pockets — ONE real continuous denim silhouette!
 */
export function buildBaggyJean3D(
  rawParams: ParamValues,
  stiffness = 1.22,
  category: MannequinCategory = "women",
  sizeCode = "M"
): Garment3DBuildResult {
  const p = parseBaggyJeanParams(rawParams);
  const body = getMannequinBodySpec(category, sizeCode);
  const heightScale = body.heightMidCm / 161;

  const yNaturalWaist = 102 * heightScale;
  const yCrotch = yNaturalWaist - body.crotchDepthCm;
  const yFrontTop = Math.min(yNaturalWaist + 1.5, yCrotch + p.frontRise - 1.4);
  const yBackTop = Math.min(yNaturalWaist + 5.2, yCrotch + p.backRise * 0.72);
  const wbH = p.waistbandHeight;
  const yHem = Math.max(2.2, yCrotch - p.inseam * 0.91);

  const rWaistJean = Math.max(body.waistCm / (2 * Math.PI) + 1.0, p.waist / (2 * Math.PI));
  const rHipJean = Math.max(body.hipCm / (2 * Math.PI) + 1.2, p.hip / (2 * Math.PI));
  const rxHip = rHipJean * 1.15;
  const rzHip = rHipJean * 0.89;
  const rxWaist = rWaistJean * 1.13;
  const rzWaist = rWaistJean * 0.86;

  // Thigh/Knee/Hem radii (crotch leg center sits at half of hip width so inner thigh touches x=0 at crotch!)
  const rThighRaw = p.thigh / (2 * Math.PI);
  const rxThigh = Math.min(rxHip * 0.505, Math.max(8.2, rThighRaw * 0.98));
  const rzThigh = Math.min(rzHip * 0.92, Math.max(8.0, rThighRaw * 0.96));
  const rKneeLeg = Math.max(6.4, (p.knee / (2 * Math.PI)) * 0.96);
  const rHemLeg = Math.max(6.0, (p.hemOpening / (2 * Math.PI)) * 0.96);

  const legCenterCrotchX = rxThigh; // guarantees inner seam (theta = PI) meets x = 0 at crotch!
  const legCenterHemX = Math.max(legCenterCrotchX + 0.6, rHemLeg + 0.85);
  const kneeV = Math.min(0.82, Math.max(0.28, 1 - 33 / Math.max(40, p.inseam)));
  const baggyFactor = Math.max(0, (p.hemOpening - 38) / 28);

  /**
   * Unified Continuous Right-Half Trouser Sampler (side = +1; mirrored cleanly for side = -1!)
   * Parameter `v` runs continuously from 0 (Hem) -> vCrotch (0.72 = Crotch Saddle) -> 1.0 (Waistband Seam).
   * Parameter `theta` runs around loop:
   * - 0       = Outer side seam (+X)
   * - PI/2    = Front (+Z) -> becomes Center Front Fly (x = 0) above crotch!
   * - PI      = Inner inseam -> stays pinned at Crotch Saddle (x = 0, y = yCrotch)!
   * - 3*PI/2  = Back (-Z) -> becomes Center Back Seat Seam (x = 0) above crotch!
   */
  const vCrotch = 0.72;

  const sampleUnifiedHalfJean = (
    side: 1 | -1,
    theta: number,
    v: number
  ): THREE.Vector3 => {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    // Top waistband seam height at this front/back angle
    const yTopSeamAtTheta =
      (yFrontTop + yBackTop) / 2 - ((yBackTop - yFrontTop) / 2) * sinT - wbH;

    if (v <= vCrotch) {
      // BELOW CROTCH: Sculpted wide-leg super baggy denim trouser leg
      const legV = v / vCrotch; // 0 = hem, 1 = crotch
      const y = lerp(yHem, yCrotch, legV);

      let rx = rHemLeg;
      let rz = rHemLeg;
      if (legV >= kneeV) {
        const t = (legV - kneeV) / Math.max(0.01, 1 - kneeV);
        const sT = smoothstep(0, 1, t);
        rx = lerp(rKneeLeg, rxThigh, sT);
        rz = lerp(rKneeLeg, rzThigh, sT);
      } else {
        const t = legV / Math.max(0.01, kneeV);
        rx = lerp(rHemLeg, rKneeLeg, t);
        rz = lerp(rHemLeg, rKneeLeg, t);
      }

      // Natural heavy denim drape ripples + subtle hem break/stacking (fading smoothly to 0 at crotch!)
      const rippleMask = Math.pow(1 - legV, 0.85);
      const drapeRipples =
        (0.28 + 0.72 * baggyFactor) *
        rippleMask *
        (0.65 * Math.sin(4 * theta + side * 0.6) + 0.35 * Math.cos(3 * theta));
      const ankleStack =
        legV < 0.14
          ? 0.42 * baggyFactor * Math.sin((legV / 0.14) * Math.PI) * (0.65 + 0.35 * sinT)
          : 0;

      const cx = lerp(legCenterHemX, legCenterCrotchX, Math.pow(legV, 0.9));
      let x = cx + (rx + drapeRipples + ankleStack) * cosT;
      // Keep legs cleanly touching at x=0 right at crotch without crossing over!
      if (x < 0.08) x = 0.08;
      const z = (rz + drapeRipples + ankleStack) * sinT - 0.55 * legV;

      return new THREE.Vector3(side * x, y, z);
    }

    // ABOVE CROTCH (v in [vCrotch, 1.0]): SEAMLESS CONTINUOUS PELVIS / BUTTOCKS / FLY BIFURCATION!
    const s = (v - vCrotch) / (1 - vCrotch); // 0 = crotch, 1 = waistband seam
    const hipCurve = Math.sin(Math.min(1, s * 1.45) * Math.PI * 0.5);
    const rxPelvis = lerp(rxHip * (0.98 + 0.03 * hipCurve), rxWaist, Math.pow(s, 1.15));
    const rzPelvis = lerp(rzHip * (0.98 + 0.03 * hipCurve), rzWaist, Math.pow(s, 1.15));
    const zOff = lerp(-0.35, 0.05, s);

    if (cosT >= 0) {
      // EXTERIOR RIGHT/LEFT HALF OF PELVIS (Back-center -> Outer Hip -> Front-center)
      const blend = smoothstep(0, 0.16, s);
      const xLegTop = legCenterCrotchX + rxThigh * cosT;
      const zLegTop = rzThigh * sinT - 0.35;

      const xPel = rxPelvis * cosT;
      const seatCurve =
        Math.max(0, -sinT) * 1.15 * Math.sin(Math.min(1, s * 1.15) * Math.PI);
      const zPel = (rzPelvis + seatCurve) * sinT + zOff;

      const x = lerp(xLegTop, xPel, blend);
      const z = lerp(zLegTop, zPel, blend);
      const y = lerp(yCrotch, yTopSeamAtTheta, s);
      return enforceMannequinClearance(
        new THREE.Vector3(side * x, y, z),
        body,
        category,
        0.95
      );
    } else {
      // INNER CROTCH SADDLE ARCH (cosT < 0):
      // Smooth U-shaped front/back crotch rise seam cleanly covering crotch & front fly (ZERO gap!)
      const innerDepth = -cosT; // 0 at CF/CB (theta=±PI/2), 1 at crotch fork bottom (theta=PI)
      const xLegTop = Math.max(0, legCenterCrotchX + rxThigh * cosT);
      const zLegTop = rzThigh * sinT - 0.35;

      const blend = smoothstep(0, 0.16, s);
      const x = lerp(xLegTop, 0.0, blend);

      // Keep front crotch & fly cleanly proud over mannequin pelvis (ZERO sliver gap!)
      const riseFactor = Math.pow(1 - innerDepth, 0.35);
      const y = lerp(yCrotch, yTopSeamAtTheta, s * riseFactor);

      const seatCurve =
        Math.max(0, -sinT) * 0.95 * Math.sin(Math.min(1, s * riseFactor * 1.15) * Math.PI);
      const pinchZ = sinT >= 0 ? 0.14 : 0.36;
      const zTarget = (rzPelvis + seatCurve) * sinT * (1 - pinchZ * innerDepth) + zOff;
      const z = lerp(zLegTop, zTarget, blend);

      const rawPt = new THREE.Vector3(side * x, y, z);
      return enforceMannequinClearance(rawPt, body, category, 1.05);
    }
  };

  // Build Right Half (+1) & Left Half (-1, flipped winding for outward normals!)
  const rightHalfGeo = buildLoftedTubeGeometry(
    64,
    68,
    (theta, v) => sampleUnifiedHalfJean(1, theta, v),
    false,
    false
  );
  const leftHalfGeo = buildLoftedTubeGeometry(
    64,
    68,
    (theta, v) => sampleUnifiedHalfJean(-1, theta, v),
    false,
    true
  );

  // Smooth 3D raised Pentagonal Back Patch Pockets cleanly proud of buttocks (ZERO z-fighting!)
  const pocketMeshes: THREE.BufferGeometry[] = [];
  if (p.includeFivePockets) {
    for (const side of [-1, 1] as const) {
      const pktGeo = buildSurfacePatchGeometry(
        14,
        14,
        (u, v) => {
          const tInner = -Math.PI / 2 + 0.14;
          const tOuter = -Math.PI / 2 + 0.72;
          const theta = lerp(tInner, tOuter, u);
          const vTop = lerp(0.895, 0.915, u);
          const pointDip = 0.032 * (1 - Math.abs(u * 2 - 1));
          const vBot = 0.785 - pointDip;
          const vPos = lerp(vBot, vTop, v);
          const pt3 = sampleUnifiedHalfJean(side, theta, vPos);
          // Uniform clean +0.52 cm offset along outward normal so curved surface NEVER z-fights!
          const borderFade = Math.min(1, u * 10, (1 - u) * 10, v * 10, (1 - v) * 10);
          const push = 0.34 + 0.2 * smoothstep(0, 1, borderFade);
          const rad = Math.hypot(pt3.x, pt3.z) || 1;
          return new THREE.Vector3(
            pt3.x + (pt3.x / rad) * push,
            pt3.y,
            pt3.z + (pt3.z / rad) * push
          );
        },
        side === -1
      );
      // Scale pocket UVs to match jean fabric weave scale (prevents texture compression/dimpling!)
      const pUv = pktGeo.getAttribute("uv");
      for (let k = 0; k < pUv.count; k++) {
        pUv.setXY(k, pUv.getX(k) * 0.18, pUv.getY(k) * 0.14);
      }
      pocketMeshes.push(pktGeo);
    }
  }

  const primaryGeometry = mergeSimpleBufferGeometries([
    rightHalfGeo,
    leftHalfGeo,
    ...pocketMeshes,
  ]);

  // Contoured Waistband (1 5/8") + 5 Real 3D Denim Belt Loops!
  const isCurved = p.waistbandType === "curved";
  const sampleWaistband = (theta: number, t: number, extraR = 0): THREE.Vector3 => {
    const sinT = Math.sin(theta);
    const yTopHere = (yFrontTop + yBackTop) / 2 - ((yBackTop - yFrontTop) / 2) * sinT;
    const contourDip = isCurved ? -0.4 * Math.max(0, sinT) : 0;
    const y = yTopHere - wbH + t * wbH + contourDip;
    const bevel = Math.sin(t * Math.PI) * 0.26;
    const taper = isCurved ? -0.22 * t : 0.0;
    const rx = rxWaist + 0.55 + bevel + taper + extraR;
    const rz = rzWaist + 0.55 + bevel + taper + extraR;
    return enforceMannequinClearance(
      new THREE.Vector3(rx * Math.cos(theta), y, rz * Math.sin(theta) + 0.05),
      body,
      category,
      1.05 + extraR
    );
  };

  const wbParts: THREE.BufferGeometry[] = [
    buildLoftedTubeGeometry(88, 10, (theta, t) => sampleWaistband(theta, t), false),
  ];

  // 5 Authentic Belt Loops (2 Front, 2 Side over Yoke, 1 Center Back)
  const loopAngles = [Math.PI * 0.3, Math.PI * 0.7, -Math.PI * 0.12, -Math.PI * 0.88, -Math.PI * 0.5];
  for (const ang of loopAngles) {
    const halfAng = 0.036;
    const loopGeo = buildSurfacePatchGeometry(4, 8, (u, v) => {
      const th = lerp(ang - halfAng, ang + halfAng, u);
      const arch = Math.sin(v * Math.PI) * 0.36;
      return sampleWaistband(th, lerp(-0.12, 1.08, v), 0.22 + arch);
    });
    wbParts.push(loopGeo);
  }
  const waistbandGeometry = mergeSimpleBufferGeometries(wbParts);

  // Golden Glo Contrast Denim Topstitching (Outseams, Hem, Back Yoke V-Seam, J-Fly, Back Pockets, Front Scoop)
  const seamSegments: number[] = [];
  const pushPoly = (pts: THREE.Vector3[]) => {
    for (let k = 0; k < pts.length - 1; k++) {
      seamSegments.push(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
    }
  };
  const offsetOut = (v: THREE.Vector3, amt = 0.22): THREE.Vector3 => {
    const rad = Math.hypot(v.x, v.z) || 1;
    return new THREE.Vector3(v.x + (v.x / rad) * amt, v.y, v.z + (v.z / rad) * amt);
  };

  for (const side of [-1, 1] as const) {
    // Outseam from hem all the way to waistband
    const outPts: THREE.Vector3[] = [];
    for (let j = 0; j <= 50; j++) {
      const pOut = sampleUnifiedHalfJean(side, 0, j / 50);
      pOut.x += side * 0.22;
      outPts.push(pOut);
    }
    pushPoly(outPts);

    // 5/8" Hem topstitch ring
    const hemRing: THREE.Vector3[] = [];
    for (let i = 0; i <= 48; i++) {
      const pH = sampleUnifiedHalfJean(side, (i / 48) * Math.PI * 2, 0.02);
      const dx = pH.x - side * legCenterHemX;
      const rad = Math.hypot(dx, pH.z) || 1;
      hemRing.push(new THREE.Vector3(pH.x + (dx / rad) * 0.22, pH.y, pH.z + (pH.z / rad) * 0.22));
    }
    pushPoly(hemRing);

    // Back Yoke V-seam (2" @CB -> 3/4" @SS)
    const yokePts: THREE.Vector3[] = [];
    for (let i = 0; i <= 18; i++) {
      const theta = lerp(-Math.PI / 2, 0, i / 18); // CB -> Outer Side Seam
      const cbWeight = Math.abs(Math.sin(theta));
      const vYoke = 0.96 - 0.045 * cbWeight;
      yokePts.push(offsetOut(sampleUnifiedHalfJean(side, theta, vYoke), 0.26));
    }
    pushPoly(yokePts);

    // Front Scoop Pocket topstitch curve
    const scoopPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const theta = lerp(0.03, 0.72, t);
      const vScoop = 0.995 - 0.09 * Math.pow(1 - t, 1.5);
      scoopPts.push(offsetOut(sampleUnifiedHalfJean(side, theta, vScoop), 0.28));
    }
    pushPoly(scoopPts);

    // Pentagonal Back Patch Pocket double topstitch outline
    if (p.includeFivePockets) {
      const tInner = -Math.PI / 2 + 0.14;
      const tOuter = -Math.PI / 2 + 0.72;
      const tMid = (tInner + tOuter) / 2;
      const p1 = offsetOut(sampleUnifiedHalfJean(side, tInner, 0.895), 0.62);
      const p2 = offsetOut(sampleUnifiedHalfJean(side, tOuter, 0.915), 0.62);
      const p3 = offsetOut(sampleUnifiedHalfJean(side, tOuter, 0.785), 0.62);
      const p4 = offsetOut(sampleUnifiedHalfJean(side, tMid, 0.753), 0.62);
      const p5 = offsetOut(sampleUnifiedHalfJean(side, tInner, 0.785), 0.62);
      pushPoly([p1, p2, p3, p4, p5, p1]);
    }
  }

  // J-Stitch Front Fly
  const flyPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const theta = Math.PI / 2 - 0.18 * (1 - Math.pow(t, 4));
    const v = 0.995 - t * 0.175;
    flyPts.push(offsetOut(sampleUnifiedHalfJean(-1, theta, v), 0.3));
  }
  pushPoly(flyPts);

  const seamLinesGeometry = new THREE.BufferGeometry();
  seamLinesGeometry.setAttribute("position", new THREE.Float32BufferAttribute(seamSegments, 3));

  // 27L Antique Copper Front Button + 3x 14L Brass Rivets
  const hwParts: THREE.BufferGeometry[] = [];
  const btnPos = sampleWaistband(Math.PI / 2, 0.52, 0.28);
  const btnGeo = new THREE.CylinderGeometry(0.88, 0.88, 0.36, 20);
  btnGeo.rotateX(Math.PI / 2);
  btnGeo.translate(btnPos.x, btnPos.y, btnPos.z);
  hwParts.push(btnGeo);

  for (const [side, th, vPos] of [
    [1, 0.08, 0.915] as const,
    [-1, 0.08, 0.915] as const,
    [1, 0.48, 0.97] as const,
  ]) {
    const rp = offsetOut(sampleUnifiedHalfJean(side, th, vPos), 0.32);
    const rv = new THREE.SphereGeometry(0.34, 12, 12);
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
    primaryTextureKind: "denim",
    waistbandTextureKind: "denim",
    metrics: {
      waistElevationCm: Math.round(yFrontTop * 10) / 10,
      hemElevationCm: Math.round(yHem * 10) / 10,
      detailLabel: `WV1499LSB-TD • Liền đáy nguyên khối • Ống rộng ${p.hemOpening} cm`,
    },
  };
}

/**
 * SHARED ANATOMICAL UPPER-BODY TORSO SAMPLER (Full-Shoulder Coverage — ZERO Mannequin Poke-Through!)
 * Smoothly spans from Hem (v=0) -> Waist -> Chest/Armpit (v=0.66) -> Outer Shoulder Tip (v=0.84)
 * -> Real Anatomical Sloped Shoulder Roof -> Collar Neckline Ring (v=1.0).
 */
interface UpperTorsoConfig {
  yBottom: number;
  yArmpit: number;
  yShoulderTip: number;
  yHSP: number;
  frontNeckDrop: number;
  backNeckDrop: number;
  rxBottom: number;
  rzBottom: number;
  rxChest: number;
  rzChest: number;
  halfShoulder: number;
  shoulderDepth: number;
  rNeckX: number;
  rNeckZ: number;
  blousonPuff: number; // >0 for Bomber rib hem gather, 0 for straight Polo
  body: BodyMeasurementStandard;
  category: MannequinCategory;
}

/**
 * C2-SMOOTH FULL-SHOULDER TORSO SAMPLER WITH EXACT AVATAR CLEARANCE (ZERO mannequin poke-through!)
 */
function sampleFullShoulderTorso(
  cfg: UpperTorsoConfig,
  theta: number,
  v: number,
  extraR = 0
): THREE.Vector3 {
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const frontW = Math.max(0, sinT);
  const backW = Math.max(0, -sinT);

  const yNeckAtTheta =
    cfg.yHSP -
    cfg.frontNeckDrop * Math.pow(frontW, 1.55) -
    cfg.backNeckDrop * Math.pow(backW, 1.55);

  const shoulderArc = Math.sin(smoothstep(0.65, 1.0, v) * Math.PI);
  const sideLift = (1 - frontW * 0.78 - backW * 0.25) * 1.45 * shoulderArc;
  const y = lerp(cfg.yBottom, yNeckAtTheta, v) + sideLift;

  const chestW = smoothstep(0.0, 0.52, v);
  const shT = smoothstep(0.54, 0.80, v);
  const neckT = smoothstep(0.74, 1.0, v);
  const neckEase = Math.pow(neckT, 1.28);

  const blouson =
    cfg.blousonPuff > 0
      ? cfg.blousonPuff * Math.sin(Math.min(1, v * 3.1) * Math.PI) * Math.exp(-v * 2.2)
      : 0;

  const rxMid = lerp(cfg.rxBottom, cfg.rxChest, chestW) + blouson;
  const rxSh = lerp(rxMid, cfg.halfShoulder, shT * 0.85);
  const rx = lerp(rxSh, cfg.rNeckX, neckEase);

  const rzMid = lerp(cfg.rzBottom, cfg.rzChest, chestW) + blouson * 0.7;
  const rzSh = lerp(rzMid, cfg.shoulderDepth, shT);
  const rz = lerp(rzSh, cfg.rNeckZ, neckEase);

  // Follow mannequin's anatomical bust/chest Z-center smoothly so front cloth clears bust cleanly!
  const mProf = bodyProfileAtY(y, cfg.body);
  const zOff = mProf.zOffset * (1 - neckT * 0.85) + 0.35 * (1 - neckT);

  const foldMask = (1 - smoothstep(0.55, 0.82, v)) * (0.3 + 0.7 * Math.sin(v * Math.PI));
  const softFold = 0.22 * foldMask * (0.65 * Math.sin(5 * theta + 0.3) + 0.35 * Math.cos(3 * theta));

  // Natural straight garment chest drape (thick fleece/piqué hangs smoothly down from bust instead of clinging inward under bust!)
  const heightScale = cfg.body.heightMidCm / 161;
  const yBustLine = 102 * heightScale + cfg.body.backLengthCm * 0.47;
  const bustDrapeFill =
    frontW *
    (cfg.blousonPuff > 0 ? 1.55 : 1.05) *
    smoothstep(cfg.yBottom, yBustLine, y) *
    (1 - smoothstep(yBustLine, cfg.yHSP, y)) *
    Math.pow(frontW, 1.1);

  const rawPt = new THREE.Vector3(
    (rx + softFold) * cosT,
    y,
    (rz + softFold * 0.8 + bustDrapeFill) * sinT + zOff
  );
  // Guarantee at least +1.15 cm clearance outside mannequin chest, bust, collarbone, and hips!
  const cleared = enforceMannequinClearance(rawPt, cfg.body, cfg.category, 1.15);
  if (extraR !== 0) {
    const rad = Math.hypot(cleared.x, cleared.z) || 1;
    cleared.x += (cleared.x / rad) * extraR;
    cleared.z += (cleared.z / rad) * extraR;
  }
  return cleared;
}

/**
 * SCULPTED CLOSED-DOME SET-IN SLEEVE (ZERO floating tubes! ZERO open holes at shoulders!)
 * Top 22% forms a closed, rounded elliptical deltoid shoulder cap tucked seamlessly into
 * the torso's shoulder slope and armhole cavity, then flows gracefully downward along a
 * natural relaxed arm curve (11-14° outward, subtle elbow forward drape).
 */
function buildSculptedSetInSleeve(params: {
  side: -1 | 1;
  halfShoulder: number;
  rxChest: number;
  yShoulderTip: number;
  yArmpit: number;
  sleeveLengthCm: number;
  rBicepCm: number;
  rEndCm: number;
  armAngleDeg: number;
  isShortSleeve: boolean;
  radialSegs?: number;
  lengthSegs?: number;
}): {
  geometry: THREE.BufferGeometry;
  endCenter: THREE.Vector3;
  endDir: THREE.Vector3;
  endOrtho1: THREE.Vector3;
  endOrtho2: THREE.Vector3;
  rEndFinal: number;
} {
  const {
    side,
    halfShoulder,
    rxChest,
    yShoulderTip,
    yArmpit,
    sleeveLengthCm,
    rBicepCm,
    rEndCm,
    armAngleDeg,
    isShortSleeve,
    radialSegs = 40,
    lengthSegs = 36,
  } = params;

  const ang = (armAngleDeg * Math.PI) / 180;
  // Natural tailored set-in shoulder slope: apex sits snug INSIDE the sloped shoulder seam
  // and curves gently downward over the deltoid (ZERO boxy football-pad bulge!)
  const shoulderAnchorX = side * (halfShoulder - 4.2);
  const shoulderAnchorY = yShoulderTip + 0.4;

  const deltoidOuterX = side * (halfShoulder - 0.55);
  const deltoidY = lerp(yShoulderTip, yArmpit, 0.72);

  const armDir = new THREE.Vector3(
    side * Math.sin(ang),
    -Math.cos(ang),
    isShortSleeve ? 0.025 : 0.055
  ).normalize();
  // Guaranteed right-handed, ZERO-TWIST basis aligned cleanly with world (+X, +Z) for BOTH left & right sleeves!
  const worldZ = new THREE.Vector3(0, 0, 1);
  const eX = new THREE.Vector3().crossVectors(worldZ, armDir).normalize(); // eX.x = +cos(ang) > 0 ALWAYS!
  const eZ = new THREE.Vector3().crossVectors(armDir, eX).normalize();     // eZ.z > 0 ALWAYS!

  const capFrac = Math.min(0.36, Math.max(0.18, ((yShoulderTip - yArmpit) * 0.72) / Math.max(12, sleeveLengthCm)));
  const tubeLen = Math.max(6, sleeveLengthCm * (1 - capFrac));

  const sampleSleeveRing = (theta: number, v: number): THREE.Vector3 => {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    // For short sleeve: add a realistic 1.2 cm turned-in hem wall at very bottom (v > 0.94)!
    const hemTuck = isShortSleeve && v > 0.94 ? (v - 0.94) / 0.06 : 0;
    const effV = isShortSleeve ? Math.min(1, v / 0.94) : v;

    if (effV <= capFrac) {
      // CLOSED ELLIPSOIDAL DELTOID SHOULDER DOME (s = 0 closed apex -> s = 1 exact tube ring at bicep!)
      const s = effV / capFrac;
      const domeAngle = s * Math.PI * 0.5;
      const radScale = Math.max(0.015, Math.sin(domeAngle)); // 0 at apex -> 1 at bicep with smooth round top!
      const dropT = 1 - Math.cos(domeAngle); // 0 at apex -> 1 at bicep

      // Centerline glides smoothly from inside shoulder seam out to deltoid center
      const cx = lerp(shoulderAnchorX, deltoidOuterX, Math.pow(s, 0.78));
      const cy = lerp(shoulderAnchorY, deltoidY, dropT);
      const cz = lerp(0.1, 0.25, s);

      // Blend local horizontal ring smoothly into tilted armDir (eX, eZ) ring so s=1 matches uArm=0 EXACTLY!
      const tiltBlend = smoothstep(0.15, 1.0, s);
      const axX = new THREE.Vector3(1, 0, 0).lerp(eX, tiltBlend).normalize();
      const axZ = new THREE.Vector3(0, 0, 1).lerp(eZ, tiltBlend).normalize();

      const rx = rBicepCm * 0.96 * radScale;
      const rz = rBicepCm * 1.04 * radScale;
      const isInnerSide = side * cosT < 0;
      const innerTuck = isInnerSide ? 1 - 0.14 * (1 - s) : 1.0;

      const pLocal = new THREE.Vector3(cx, cy, cz)
        .addScaledVector(axX, rx * innerTuck * cosT)
        .addScaledVector(axZ, rz * sinT);

      void rxChest;
      return pLocal;
    }

    // HANGING RELAXED SLEEVE TUBE (uArm = 0 at bicep -> 1 at wrist/short-sleeve opening)
    const uArm = (effV - capFrac) / Math.max(0.01, 1 - capFrac);
    const sDist = uArm * tubeLen - hemTuck * 1.1;

    // Gentle natural human elbow forward bend on long sleeves
    const elbowBendZ = !isShortSleeve ? 1.6 * Math.pow(uArm, 1.7) : 0;
    const center = new THREE.Vector3(
      deltoidOuterX + armDir.x * sDist,
      deltoidY + armDir.y * sDist,
      0.25 + armDir.z * sDist + elbowBendZ
    );

    const rBase = lerp(rBicepCm, rEndCm, Math.pow(uArm, 0.86));
    const crease =
      0.2 * Math.sin(3 * theta + side * 0.5) * Math.sin(uArm * Math.PI) * (1 - hemTuck);
    const rFinal = rBase * (1 - 0.08 * hemTuck) + crease;

    const rx = rFinal * 0.96 * cosT;
    const rz = rFinal * 1.04 * sinT;
    return center
      .clone()
      .addScaledVector(eX, rx)
      .addScaledVector(eZ, rz);
  };

  const geometry = buildLoftedTubeGeometry(
    radialSegs,
    lengthSegs,
    sampleSleeveRing,
    false,
    true
  );

  const endCenter = new THREE.Vector3(
    deltoidOuterX + armDir.x * tubeLen,
    deltoidY + armDir.y * tubeLen,
    0.25 + armDir.z * tubeLen + (!isShortSleeve ? 1.6 : 0)
  );

  return {
    geometry,
    endCenter,
    endDir: armDir,
    endOrtho1: eX,
    endOrtho2: eZ,
    rEndFinal: rEndCm,
  };
}

/**
 * 3. REAL-TIME 3D STYLE 89865 BOMBER FLEECE JACKET (BEARE & LEY / Mernda Primary)
 * Seamless Full-Shoulder Fleece Torso + Closed Deltoid-Dome Long Sleeves
 * + Textured 1x1 Vertical Rib Knit Collar / Basque / Cuffs with 2 Crisp Gold Stripes
 * + 3D Angled Welt Pockets + 6x 11mm Press Studs!
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
  const yNeckBase = yWaist + body.backLengthCm * 0.99;
  const yHSP = yNeckBase + 0.6;
  const yShoulderTip = yWaist + body.backLengthCm * 0.855;
  const yArmpit = yWaist + body.backLengthCm * 0.65;

  const totalLen = Math.min(78, Math.max(44, p.frontLength * 0.92));
  const ribH = p.ribHeight;
  const yRibBottom = yHSP - totalLen;
  const yRibTop = yRibBottom + ribH;

  // Compute generous fleece radii guaranteeing ZERO mannequin poke-through!
  const mBust = bodyProfileAtY(yWaist + body.backLengthCm * 0.47, body);
  const mSh = bodyProfileAtY(yWaist + body.backLengthCm * 0.83, body);
  const mNeck = bodyProfileAtY(yNeckBase, body);

  const rxChest = Math.max(mBust.rx + 2.0, (p.chest / (2 * Math.PI)) * 1.05);
  const rzChest = Math.max(mBust.rz + 1.9, (p.chest / (2 * Math.PI)) * 0.82);
  const rxRib = Math.max(mBust.rx + 0.8, ((p.ribHemHalf * 2) / (2 * Math.PI)) * 1.04);
  const rzRib = Math.max(mBust.rz + 0.7, ((p.ribHemHalf * 2) / (2 * Math.PI)) * 0.8);
  // Sleek natural tailored bomber shoulder width (no 1980s shoulder pads!)
  const halfShoulder = Math.max(mSh.rx + 1.6, Math.min(rxChest + 1.6, p.shoulder * 0.435));
  const shoulderDepth = Math.max(mSh.rz + 1.8, rzChest * 0.72);
  const rNeckX = Math.max(mNeck.rx + 0.8, p.neckWidth * 0.43);
  const rNeckZ = Math.max(mNeck.rz + 0.8, rNeckX * 0.92);

  const torsoCfg: UpperTorsoConfig = {
    yBottom: yRibTop,
    yArmpit,
    yShoulderTip,
    yHSP,
    frontNeckDrop: Math.min(7.2, p.frontNeckDrop * 0.65),
    backNeckDrop: 1.0,
    rxBottom: rxRib,
    rzBottom: rzRib,
    rxChest,
    rzChest,
    halfShoulder,
    shoulderDepth,
    rNeckX,
    rNeckZ,
    blousonPuff: 1.1,
    body,
    category,
  };

  // 1. Continuous Full-Shoulder Fleece Torso
  const torsoGeo = buildLoftedTubeGeometry(
    84,
    48,
    (theta, v) => sampleFullShoulderTorso(torsoCfg, theta, v),
    false
  );

  // 2. Sculpted Closed-Dome Long Sleeves (tucked seamlessly into shoulders!)
  const sleeveFabLen = Math.max(26, (p.sleeveLength - ribH) * 0.86);
  const rBicep = Math.max(5.5, Math.min(6.9, (p.armholeHalf * 0.76) / Math.PI));
  const rSleeveWrist = Math.max(3.8, (p.sleeveOpeningHalf * 2) / (2 * Math.PI) * 0.84);

  const leftSleeve = buildSculptedSetInSleeve({
    side: -1,
    halfShoulder,
    rxChest,
    yShoulderTip,
    yArmpit,
    sleeveLengthCm: sleeveFabLen,
    rBicepCm: rBicep,
    rEndCm: rSleeveWrist,
    armAngleDeg: 11,
    isShortSleeve: false,
  });
  const rightSleeve = buildSculptedSetInSleeve({
    side: 1,
    halfShoulder,
    rxChest,
    yShoulderTip,
    yArmpit,
    sleeveLengthCm: sleeveFabLen,
    rBicepCm: rBicep,
    rEndCm: rSleeveWrist,
    armAngleDeg: 11,
    isShortSleeve: false,
  });

  // 3. Subtle 3D Center-Front Placket Overlap + 3D Angled Welt Pocket Strips (Fleece)
  const cfPlacket = buildSurfacePatchGeometry(4, 24, (u, v) => {
    const theta = Math.PI / 2 + lerp(-0.06, 0.06, u);
    const vPos = lerp(0.0, 0.99, v);
    const bevel = Math.sin(u * Math.PI) * 0.28;
    return sampleFullShoulderTorso(torsoCfg, theta, vPos, 0.16 + bevel);
  });

  const weltParts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1] as const) {
    const tBot = Math.PI / 2 + side * 0.78;
    const tTop = Math.PI / 2 + side * 0.48;
    const weltGeo = buildSurfacePatchGeometry(
      4,
      10,
      (u, v) => {
        const thetaBase = lerp(tBot, tTop, v);
        const theta = thetaBase - side * 0.11 * u;
        const vPos = lerp(0.11, 0.36, v) - 0.015 * u;
        const bevel = Math.sin(u * Math.PI) * 0.34;
        return sampleFullShoulderTorso(torsoCfg, theta, vPos, 0.14 + bevel);
      },
      side === 1
    );
    weltParts.push(weltGeo);
  }

  // 4. Self-Fabric Front Hem Square Panels (G: 8x6 cm on either side of CF press-studs per 89865 SPEC!)
  const frontHemSquares = buildSurfacePatchGeometry(12, 6, (u, v) => {
    const theta = Math.PI / 2 + lerp(-0.34, 0.34, u);
    const y = lerp(yRibBottom, yRibTop + 0.15, v);
    const rx = rxRib + 0.25;
    const rz = rzRib + 0.25;
    return enforceMannequinClearance(
      new THREE.Vector3(rx * Math.cos(theta), y, rz * Math.sin(theta) + 0.18),
      body,
      category,
      1.18
    );
  });

  const primaryGeometry = mergeSimpleBufferGeometries([
    torsoGeo,
    leftSleeve.geometry,
    rightSleeve.geometry,
    cfPlacket,
    frontHemSquares,
    ...weltParts,
  ]);

  // 5. 1×1 Striped Rib Knit Trims (Basque + Thick Stand-Up Rib Collar + Both Rib Cuffs!)
  // Uses UV v in [0, 1] cleanly mapped to `createStripedRibTextures` (2 Gold Stripes + 1x1 vertical rib wales!)
  const basqueGeo = buildLoftedTubeGeometry(
    72,
    10,
    (theta, v) => {
      const y = lerp(yRibBottom, yRibTop + 0.2, v);
      const pinch = 0.96 + 0.04 * v + 0.012 * Math.sin(v * Math.PI);
      return enforceMannequinClearance(
        new THREE.Vector3(rxRib * pinch * Math.cos(theta), y, rzRib * pinch * Math.sin(theta) + 0.15),
        body,
        category,
        0.95
      );
    },
    false
  );

  // Plush smooth curved bomber stand-up rib collar (clean level rim — ZERO corner spikes!)
  const collarGeo = buildLoftedTubeGeometry(
    64,
    14,
    (theta, v) => {
      const basePt = sampleFullShoulderTorso(torsoCfg, theta, 1.0, 0.16);
      const frontW = Math.max(0, Math.sin(theta));
      const yRimTarget = yHSP + Math.min(4.6, ribH * 0.76) - Math.min(5.2, torsoCfg.frontNeckDrop * 0.72) * Math.pow(frontW, 1.65);
      const roll = v > 0.85 ? (v - 0.85) / 0.15 : 0;
      const riseT = Math.min(1, v / 0.85);
      const y = lerp(basePt.y - 0.35, yRimTarget, riseT) - roll * 0.55;
      const rad = Math.hypot(basePt.x, basePt.z) || 1;
      const rOff = 0.24 - 0.26 * roll + 0.12 * (1 - riseT);
      return new THREE.Vector3(
        basePt.x + (basePt.x / rad) * rOff,
        y,
        basePt.z + (basePt.z / rad) * rOff
      );
    },
    false
  );

  // Seamless Rib Cuffs continuing directly off the wrist rings of Left & Right Sleeves!
  const buildRibCuff = (slv: typeof leftSleeve): THREE.BufferGeometry => {
    const cuffLen = ribH * 0.9;
    const rCuffEnd = Math.max(3.1, slv.rEndFinal * 0.76);
    return buildLoftedTubeGeometry(
      32,
      10,
      (theta, v) => {
        const s = v * cuffLen;
        const r = lerp(slv.rEndFinal * 0.96, rCuffEnd, Math.pow(v, 0.75)) + 0.12 * Math.sin(v * Math.PI);
        const center = slv.endCenter.clone().addScaledVector(slv.endDir, s - 0.3);
        return center
          .addScaledVector(slv.endOrtho1, r * 0.96 * Math.cos(theta))
          .addScaledVector(slv.endOrtho2, r * 1.04 * Math.sin(theta));
      },
      false,
      true
    );
  };

  const waistbandGeometry = mergeSimpleBufferGeometries([
    basqueGeo,
    collarGeo,
    buildRibCuff(leftSleeve),
    buildRibCuff(rightSleeve),
  ]);

  // Crisp subtle seam lines (CF opening + pocket slit shadow lines)
  const seamSegments: number[] = [];
  const pushPoly = (pts: THREE.Vector3[]) => {
    for (let k = 0; k < pts.length - 1; k++) {
      seamSegments.push(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
    }
  };
  const cfLine: THREE.Vector3[] = [];
  for (let j = 0; j <= 28; j++) {
    cfLine.push(sampleFullShoulderTorso(torsoCfg, Math.PI / 2, j / 28, 0.48));
  }
  pushPoly(cfLine);

  const seamLinesGeometry = new THREE.BufferGeometry();
  seamLinesGeometry.setAttribute("position", new THREE.Float32BufferAttribute(seamSegments, 3));

  // 6x 11mm Press Studs cleanly aligned down Center Front (including bottom square panel!)
  const studParts: THREE.BufferGeometry[] = [];
  for (let s = 0; s < 6; s++) {
    const pos =
      s === 0
        ? new THREE.Vector3(0, yRibBottom + ribH * 0.5, rzRib + 0.55)
        : sampleFullShoulderTorso(torsoCfg, Math.PI / 2, 0.08 + ((s - 1) / 4) * 0.84, 0.48);
    const stud = new THREE.CylinderGeometry(0.55, 0.55, 0.25, 16);
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
    primaryTextureKind: "fleece",
    waistbandTextureKind: "rib-striped",
    metrics: {
      waistElevationCm: Math.round(yHSP * 10) / 10,
      hemElevationCm: Math.round(yRibBottom * 10) / 10,
      detailLabel: `89865 Bomber Fleece • Ngực ${p.chest} cm • Bo 1×1 2 sọc Gold`,
    },
  };
}

/**
 * 4. REAL-TIME 3D STYLE HAZE026-028 COLORBLOCK POLO SHIRT (AFW)
 * - ONE 100% Continuous Smooth Full-Shoulder Torso Mesh UV-mapped with a razor-sharp
 *   1024x1024 Piqué Colorblock Texture (White FRT-1 / Black FRT-2 / Silver FRT-3 / Dark Bottle FRT-4)!
 * - Closed Deltoid-Dome Short Set-In Sleeves with turned-in 1.2 cm hem walls (ZERO floating pipes!)
 * - Sculpted Rolled Turned-Down Polo Collar + 3D Dark Bottle Placket + 2/3 Buttons!
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
  const yNeckBase = yWaist + body.backLengthCm * 0.99;
  const yHSP = yNeckBase + 0.5;
  const yShoulderTip = yWaist + body.backLengthCm * 0.855;
  const yArmpit = yWaist + body.backLengthCm * 0.65;

  const bodyLen = Math.min(78, Math.max(42, (p.cbLength + p.backNeckDrop) * 0.92));
  const yHem = yHSP - bodyLen;

  const mBust = bodyProfileAtY(yWaist + body.backLengthCm * 0.47, body);
  const mSh = bodyProfileAtY(yWaist + body.backLengthCm * 0.83, body);
  const mNeck = bodyProfileAtY(yNeckBase, body);

  const rxChest = Math.max(mBust.rx + 1.8, (p.chest / (2 * Math.PI)) * 1.03);
  const rzChest = Math.max(mBust.rz + 1.6, (p.chest / (2 * Math.PI)) * 0.81);
  // Sleek natural Polo shoulder width (merges seamlessly into short sleeves!)
  const halfShoulder = Math.max(mSh.rx + 1.4, Math.min(rxChest + 1.2, p.shoulder * 0.425));
  const shoulderDepth = Math.max(mSh.rz + 1.6, rzChest * 0.72);
  const rNeckX = Math.max(mNeck.rx + 0.65, p.neckWidth * 0.39);
  const rNeckZ = Math.max(mNeck.rz + 0.65, rNeckX * 0.92);

  const torsoCfg: UpperTorsoConfig = {
    yBottom: yHem,
    yArmpit,
    yShoulderTip,
    yHSP,
    frontNeckDrop: Math.min(6.8, p.frontNeckDrop * 0.68),
    backNeckDrop: p.backNeckDrop * 0.85,
    rxBottom: rxChest * 0.99,
    rzBottom: rzChest * 0.99,
    rxChest,
    rzChest,
    halfShoulder,
    shoulderDepth,
    rNeckX,
    rNeckZ,
    blousonPuff: 0,
    body,
    category,
  };

  // 1. Continuous Full-Shoulder Polo Torso (mapped cleanly to 1024x1024 Colorblock Piqué Texture!)
  const primaryGeometry = buildLoftedTubeGeometry(
    96,
    52,
    (theta, v) => sampleFullShoulderTorso(torsoCfg, theta, v),
    false
  );

  // 2. Sculpted Closed-Dome Short Set-In Sleeves (rendered in solid Main Color LA65V Dark Bottle!)
  const shortLen = Math.max(15, p.sleeveLength * 0.86);
  const rBicep = Math.max(5.0, Math.min(6.3, (p.armholeHalf * 0.72) / Math.PI));
  const rOpen = Math.max(4.5, Math.min(rBicep * 0.94, (p.sleeveOpeningHalf * 2) / (2 * Math.PI) * 0.78));

  const leftSleeve = buildSculptedSetInSleeve({
    side: -1,
    halfShoulder,
    rxChest,
    yShoulderTip,
    yArmpit,
    sleeveLengthCm: shortLen,
    rBicepCm: rBicep,
    rEndCm: rOpen,
    armAngleDeg: 12,
    isShortSleeve: true,
    lengthSegs: 28,
  });
  const rightSleeve = buildSculptedSetInSleeve({
    side: 1,
    halfShoulder,
    rxChest,
    yShoulderTip,
    yArmpit,
    sleeveLengthCm: shortLen,
    rBicepCm: rBicep,
    rEndCm: rOpen,
    armAngleDeg: 12,
    isShortSleeve: true,
    lengthSegs: 28,
  });

  // 3. Sculpted Rolled Turned-Down Flat-Knit Polo Collar anchored directly to cleared torso neckline!
  const collarGeo = buildSurfacePatchGeometry(68, 18, (u, v) => {
    const theta = Math.PI * 0.555 + u * Math.PI * 1.89;
    const basePt = sampleFullShoulderTorso(torsoCfg, theta, 1.0, 0.12);
    const rad = Math.hypot(basePt.x, basePt.z) || 1;
    const ux = basePt.x / rad;
    const uz = basePt.z / rad;

    const standH = 2.6;
    const leafLen = Math.min(7.2, p.collarDepth * 0.78);
    const tipBoost = 1 + 0.16 * Math.pow(Math.abs(u * 2 - 1), 3);

    let dy: number;
    let rOff: number;
    if (v <= 0.34) {
      const t = v / 0.34;
      dy = -0.35 + (standH + 0.35) * t;
      rOff = 0.12 + 0.15 * t;
    } else if (v <= 0.54) {
      const t = (v - 0.34) / 0.20;
      const archAng = t * Math.PI;
      dy = standH + 0.65 * Math.sin(archAng);
      rOff = 0.27 + 0.95 * (1 - Math.cos(archAng)) * 0.5;
    } else {
      const t = (v - 0.54) / 0.46;
      const drop = leafLen * tipBoost * t;
      dy = standH - drop * 0.62;
      rOff = 1.22 + drop * 0.72;
    }

    const ptC = new THREE.Vector3(
      basePt.x + ux * rOff,
      basePt.y + dy,
      basePt.z + uz * rOff
    );
    // Keep collar leaf cleanly resting OUTSIDE upper chest & shoulder cloth!
    return v > 0.54
      ? enforceMannequinClearance(ptC, body, category, 1.38)
      : ptC;
  });

  // 4. Authentic full-length 3D Dark Bottle Front Placket (17.5 cm adult / 14 cm youth!)
  // Because y(v) is linear from yHem -> yFrontNeck, vStart = 1 - placketLength / (yFrontNeck - yHem)!
  const frontTorsoSpan = Math.max(30, yHSP - torsoCfg.frontNeckDrop - yHem);
  const plkHalfAngle = Math.min(0.11, (p.placketWidth * 0.54) / Math.max(10, rxChest));
  const plkStartV = Math.max(0.58, Math.min(0.82, 1 - (p.placketLength * 0.92) / frontTorsoSpan));
  const placketGeo = buildSurfacePatchGeometry(8, 18, (u, v) => {
    const theta = Math.PI / 2 + lerp(-plkHalfAngle, plkHalfAngle, u);
    const vPos = lerp(plkStartV, 0.998, v);
    const bevel = Math.sin(u * Math.PI) * 0.28;
    return sampleFullShoulderTorso(torsoCfg, theta, vPos, 0.22 + bevel);
  });

  // Merge Sleeves + Collar + Placket into `waistbandGeometry` (all share solid Main LA65V Dark Bottle Piqué!)
  const waistbandGeometry = mergeSimpleBufferGeometries([
    leftSleeve.geometry,
    rightSleeve.geometry,
    collarGeo,
    placketGeo,
  ]);

  // Subtle placket edge topstitch & box stitch at bottom of placket
  const seamSegments: number[] = [];
  const pushPoly = (pts: THREE.Vector3[]) => {
    for (let k = 0; k < pts.length - 1; k++) {
      seamSegments.push(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
    }
  };
  const plkOutline: THREE.Vector3[] = [];
  for (let j = 0; j <= 14; j++) {
    plkOutline.push(sampleFullShoulderTorso(torsoCfg, Math.PI / 2 - plkHalfAngle, lerp(plkStartV, 0.995, j / 14), 0.36));
  }
  const plkOutlineR: THREE.Vector3[] = [];
  for (let j = 0; j <= 14; j++) {
    plkOutlineR.push(sampleFullShoulderTorso(torsoCfg, Math.PI / 2 + plkHalfAngle, lerp(plkStartV, 0.995, j / 14), 0.36));
  }
  pushPoly(plkOutline);
  pushPoly(plkOutlineR);
  pushPoly([plkOutline[0], plkOutlineR[0]]);

  const seamLinesGeometry = new THREE.BufferGeometry();
  seamLinesGeometry.setAttribute("position", new THREE.Float32BufferAttribute(seamSegments, 3));

  // 2 or 3 Polo Placket Buttons evenly spaced down the full placket!
  const buttonCount = p.chest <= 99 ? 2 : 3;
  const btnParts: THREE.BufferGeometry[] = [];
  for (let b = 0; b < buttonCount; b++) {
    const vBtn = lerp(0.955, plkStartV + 0.035, b / Math.max(1, buttonCount - 1));
    const pos = sampleFullShoulderTorso(torsoCfg, Math.PI / 2, vBtn, 0.56);
    const btn = new THREE.CylinderGeometry(0.45, 0.45, 0.22, 16);
    btn.rotateX(Math.PI / 2);
    btn.translate(pos.x, pos.y, pos.z);
    btnParts.push(btn);
  }
  const hardwareGeometry = mergeSimpleBufferGeometries(btnParts);
  void stiffness;

  return {
    primaryGeometry,
    waistbandGeometry,
    seamLinesGeometry,
    hardwareGeometry,
    primaryTextureKind: "polo-torso",
    waistbandTextureKind: "polo-solid",
    textureParams: {
      diagonalColorblock: p.diagonalColorblock,
      stripeWidthRatio: p.stripeWidth / Math.max(40, p.cbLength),
      placketWidthRatio: p.placketWidth / Math.max(60, p.chest),
      placketLengthRatio: p.placketLength / Math.max(40, p.cbLength),
    },
    metrics: {
      waistElevationCm: Math.round(yHSP * 10) / 10,
      hemElevationCm: Math.round(yHem * 10) / 10,
      detailLabel: p.diagonalColorblock
        ? `HAZE026-028 • Phối chéo 4 màu liền vai (${buttonCount} nút trụ)`
        : `HAZE026 Polo • Ngực ${p.chest} cm (${buttonCount} nút trụ)`,
    },
  };
}
