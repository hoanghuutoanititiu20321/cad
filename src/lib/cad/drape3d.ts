import * as THREE from "three";
import { parseCircleSkirtParams, WAISTBAND_HEIGHT_CM } from "@/templates/circle-skirt/schema";
import { computeCircleSkirtRadii } from "@/templates/circle-skirt/geometry";
import type { ParamValues } from "./types";

export interface FabricDrapePreset {
  id: string;
  name: string;
  color: string;
  roughness: number;
  metalness: number;
  /** 0.75 = soft fluid silk drape, 1.0 = medium cotton, 1.25 = crisp structured taffeta/denim */
  stiffness: number;
}

export const FABRIC_PRESETS: FabricDrapePreset[] = [
  {
    id: "indigo-cotton",
    name: "Indigo Cotton",
    color: "#4F46E5",
    roughness: 0.72,
    metalness: 0.04,
    stiffness: 1.0,
  },
  {
    id: "ivory-linen",
    name: "Kem Linen (Ivory)",
    color: "#E7DFD3",
    roughness: 0.85,
    metalness: 0.02,
    stiffness: 1.05,
  },
  {
    id: "crimson-silk",
    name: "Đỏ Đô Lụa (Satin)",
    color: "#9F1239",
    roughness: 0.34,
    metalness: 0.12,
    stiffness: 0.78,
  },
  {
    id: "noir-twill",
    name: "Đen Tuyết Mưa",
    color: "#1E293B",
    roughness: 0.64,
    metalness: 0.06,
    stiffness: 1.2,
  },
  {
    id: "teal-poplin",
    name: "Xanh Ngọc Poplin",
    color: "#0D9488",
    roughness: 0.68,
    metalness: 0.04,
    stiffness: 1.0,
  },
];

/** Height of natural waist line above studio floor in cm */
export const WAIST_ELEVATION_CM = 102;

/**
 * Anatomical elliptical cross-section helper:
 * Human torso/pelvis is wider side-to-side (X) and shallower front-to-back (Z).
 * Perimeter of ellipse with semi-axes a = r*kx, b = r*kz where kx=1.13, kz=0.86
 * has Ramanujan perimeter ≈ 2*PI*r (within 0.2%!).
 */
const ELLIPSE_KX = 1.13;
const ELLIPSE_KZ = 0.86;

function bodyRadiusAtY(yCm: number, waistCm: number): {
  rMean: number;
  kx: number;
  kz: number;
  zOffset: number;
} {
  const rWaist = waistCm / (2 * Math.PI);
  const rBust = (waistCm + 18) / (2 * Math.PI);
  const rHip = (waistCm + 24) / (2 * Math.PI);
  const rNeck = Math.max(5.2, rWaist * 0.48);

  // Key anatomical Y landmarks (cm from floor):
  // 144: Neck top | 137: Neck base | 133: Shoulder slope | 120: Bust | 102: Waist | 82: Full Hip | 62: Lower thigh taper
  const stops: Array<{ y: number; r: number; kx: number; kz: number; zOff: number }> = [
    { y: 58, r: rHip * 0.66, kx: 1.06, kz: 0.94, zOff: -0.3 },
    { y: 66, r: rHip * 0.84, kx: 1.1, kz: 0.9, zOff: -0.4 },
    { y: 82, r: rHip, kx: 1.14, kz: 0.88, zOff: -0.8 }, // Full hip / seat slightly fuller in back (-Z)
    { y: 94, r: (rWaist + rHip) * 0.51, kx: 1.13, kz: 0.86, zOff: -0.3 },
    { y: 102, r: rWaist, kx: ELLIPSE_KX, kz: ELLIPSE_KZ, zOff: 0 }, // Natural waist
    { y: 112, r: (rWaist + rBust) * 0.49, kx: 1.12, kz: 0.89, zOff: 0.4 },
    { y: 121, r: rBust, kx: 1.1, kz: 0.94, zOff: 1.1 }, // Bust projection (+Z is Front)
    { y: 132, r: rBust * 0.92, kx: 1.24, kz: 0.76, zOff: 0.2 }, // Upper chest / shoulders
    { y: 137, r: rNeck * 1.12, kx: 1.04, kz: 0.96, zOff: 0 },
    { y: 144, r: rNeck, kx: 1.0, kz: 1.0, zOff: 0 },
  ];

  if (yCm <= stops[0].y) {
    return {
      rMean: stops[0].r,
      kx: stops[0].kx,
      kz: stops[0].kz,
      zOffset: stops[0].zOff,
    };
  }
  if (yCm >= stops[stops.length - 1].y) {
    const last = stops[stops.length - 1];
    return { rMean: last.r, kx: last.kx, kz: last.kz, zOffset: last.zOff };
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (yCm >= a.y && yCm <= b.y) {
      const rawT = (yCm - a.y) / (b.y - a.y);
      // Smoothstep interpolation for organic dress-form silhouette
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

/**
 * Build procedural Tailor Dress-Form (Mannequin Torso + Stand) BufferGeometries.
 */
export function buildMannequinGeometries(waistCm: number): {
  torsoGeometry: THREE.BufferGeometry;
  neckCapGeometry: THREE.BufferGeometry;
  poleGeometry: THREE.BufferGeometry;
  baseGeometry: THREE.BufferGeometry;
} {
  const radialSegs = 72;
  const heightSegs = 56;
  const yMin = 58;
  const yMax = 144;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= heightSegs; j++) {
    const v = j / heightSegs;
    const y = yMin + (yMax - yMin) * v;
    const prof = bodyRadiusAtY(y, waistCm);

    for (let i = 0; i <= radialSegs; i++) {
      const u = i / radialSegs;
      const theta = u * Math.PI * 2;
      // +Z = Front (theta = PI/2), -Z = Back (theta = 3*PI/2)
      const x = prof.rMean * prof.kx * Math.cos(theta);
      const z = prof.rMean * prof.kz * Math.sin(theta) + prof.zOffset;

      positions.push(x, y, z);
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

  // Bottom cap of torso at yMin
  const botCenterIdx = positions.length / 3;
  const botProf = bodyRadiusAtY(yMin, waistCm);
  positions.push(0, yMin, botProf.zOffset);
  uvs.push(0.5, 0);
  for (let i = 0; i < radialSegs; i++) {
    indices.push(botCenterIdx, i, i + 1);
  }

  const torsoGeometry = new THREE.BufferGeometry();
  torsoGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  torsoGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  torsoGeometry.setIndex(indices);
  torsoGeometry.computeVertexNormals();

  const topProf = bodyRadiusAtY(yMax, waistCm);
  const neckCapGeometry = new THREE.CylinderGeometry(
    topProf.rMean * 1.03,
    topProf.rMean * 1.03,
    2.4,
    48
  );
  neckCapGeometry.translate(0, yMax + 1.0, 0);

  const poleGeometry = new THREE.CylinderGeometry(1.15, 1.15, yMin, 24);
  poleGeometry.translate(0, yMin / 2, botProf.zOffset);

  const baseGeometry = new THREE.CylinderGeometry(16, 18, 2.2, 48);
  baseGeometry.translate(0, 1.1, botProf.zOffset);

  return { torsoGeometry, neckCapGeometry, poleGeometry, baseGeometry };
}

export interface Skirt3DBuildResult {
  skirtGeometry: THREE.BufferGeometry;
  waistbandGeometry: THREE.BufferGeometry;
  seamLinesGeometry: THREE.BufferGeometry;
  zipperPullPosition: THREE.Vector3 | null;
  metrics: {
    waistElevationCm: number;
    hemElevationCm: number;
    fluteCount: number;
  };
}

/**
 * Build real-time 3D Draped Garment Geometry directly from the 2D Pattern Parameters!
 * Reflects:
 * - `waist`: exact waist fit
 * - `skirtLength`: arc-length-preserving vertical drop
 * - `flareAngle` (90°..360°): cone spread + flute wave count & amplitude
 * - `gatherRatio` (1, 1.5, 2): high-frequency waist shirring/gathering pleats below waistband
 * - `waistbandType` (straight / curved): upright band vs contoured hip-hugging band
 * - `pieceMultiplier` (1 / 2): CB seam vs Left+Right side seams + 18cm zipper line
 */
export function buildCircleSkirt3D(
  rawParams: ParamValues,
  stiffness = 1.0
): Skirt3DBuildResult {
  const params = parseCircleSkirtParams(rawParams);
  const radii = computeCircleSkirtRadii(params);

  const waistCm = params.waist;
  const skirtLengthCm = params.skirtLength;
  const flareRatio = params.flareAngle / 360; // 0.25 .. 1.0
  const gatherExtra = Math.max(0, params.gatherRatio - 1); // 0, 0.5, 1.0

  // Number of natural gravity flutes increases with flareAngle
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

  const radialSegs = 180; // High angular resolution for crisp waist gathers & smooth hem waves
  const lengthSegs = 64;

  // Compute physical drape profile along meridional arc length s in [0, skirtLengthCm]
  // Preserve meridional arc-length ds so skirt never stretches unnaturally when flared!
  const yWaist = WAIST_ELEVATION_CM;
  const wbHeight = WAISTBAND_HEIGHT_CM; // 3.5 cm

  // Helper evaluating a 3D point on the skirt surface at (u in [0,1], v in [0,1])
  // theta = 0 is Right (+X), PI/2 is Front (+Z), PI is Left (-X), 3*PI/2 is Back (-Z)
  const sampleSkirtSurface = (theta: number, v: number): THREE.Vector3 => {
    const s = v * skirtLengthCm; // distance along fabric from waist seam

    // Cone spread angle depends on flareAngle, gather puff, and fabric stiffness
    const baseSpreadSin =
      (0.14 + 0.42 * Math.pow(flareRatio, 0.88) + 0.06 * gatherExtra) *
      Math.min(1.28, Math.max(0.72, stiffness));
    const clampedSin = Math.min(0.76, baseSpreadSin);
    const cosSlope = Math.sqrt(1 - clampedSin * clampedSin);

    const y = yWaist - s * cosSlope;
    const body = bodyRadiusAtY(y, waistCm);

    // Natural waist radius + outward flare cone
    const rWaistBody = waistCm / (2 * Math.PI) + 0.35;
    const gatherPuff =
      gatherExtra * 1.45 * Math.sin(Math.min(1, v * 3.2) * Math.PI) * Math.exp(-v * 2.1);

    let rBase = rWaistBody + s * clampedSin + gatherPuff;

    // Enforce collision-free clearance over mannequin hip/seat!
    const minClearanceR = body.rMean + 0.48;
    if (rBase < minClearanceR) {
      rBase = minClearanceR;
    }

    // Blend cross-section from anatomical body ellipse at waist (v=0) toward rounder bell at hem (v=1)
    const roundnessBlend = Math.min(1, Math.pow(v, 0.7) * (0.45 + 0.45 * flareRatio));
    const kx = body.kx + (1.02 - body.kx) * roundnessBlend;
    const kz = body.kz + (0.98 - body.kz) * roundnessBlend;
    const zShift = body.zOffset * Math.max(0, 1 - v * 1.35);

    // 1. Primary + secondary gravity flutes (organ-pipe / godet waves growing smoothly toward hem)
    const fluteAmp =
      (0.45 + 4.8 * Math.pow(flareRatio, 1.18) + 1.1 * gatherExtra) *
      Math.pow(v, 1.32) *
      (0.85 + 0.15 * stiffness);

    const primaryWave =
      Math.sin(fluteCount * theta - 0.35) * 0.78 +
      Math.sin((fluteCount / 2) * theta + 1.1) * 0.22;

    // 2. High-frequency waist shirring / gathering pleats right under waistband when gatherRatio > 1
    const gatherPleatCount = params.gatherRatio >= 2 ? 48 : 36;
    const gatherAmp =
      gatherExtra *
      0.62 *
      Math.pow(Math.min(1, v * 8), 0.6) *
      Math.exp(-v * 3.6);
    const gatherWave = Math.sin(gatherPleatCount * theta);

    const rFinal = rBase + fluteAmp * primaryWave + gatherAmp * gatherWave;
    // Slight hem dip in wave troughs for authentic 3D cloth hang
    const yDip = -fluteAmp * 0.16 * primaryWave * v;

    const x = rFinal * kx * Math.cos(theta);
    const z = rFinal * kz * Math.sin(theta) + zShift;
    return new THREE.Vector3(x, y + yDip, z);
  };

  // Build Skirt BufferGeometry
  const skirtPos: number[] = [];
  const skirtUvs: number[] = [];
  const skirtIdx: number[] = [];

  for (let j = 0; j <= lengthSegs; j++) {
    const v = j / lengthSegs;
    for (let i = 0; i <= radialSegs; i++) {
      const u = i / radialSegs;
      const theta = u * Math.PI * 2;
      const p = sampleSkirtSurface(theta, v);
      skirtPos.push(p.x, p.y, p.z);
      skirtUvs.push(u * 4, v * 2);
    }
  }

  const stride = radialSegs + 1;
  for (let j = 0; j < lengthSegs; j++) {
    for (let i = 0; i < radialSegs; i++) {
      const a = j * stride + i;
      const b = a + stride;
      const c = b + 1;
      const d = a + 1;
      skirtIdx.push(a, b, d);
      skirtIdx.push(b, c, d);
    }
  }

  const skirtGeometry = new THREE.BufferGeometry();
  skirtGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(skirtPos, 3)
  );
  skirtGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(skirtUvs, 2));
  skirtGeometry.setIndex(skirtIdx);
  skirtGeometry.computeVertexNormals();

  // ==================== Build 3.5 cm Waistband 3D Mesh ====================
  const wbRadialSegs = 96;
  const wbHeightSegs = 8;
  const wbPos: number[] = [];
  const wbIdx: number[] = [];

  const isCurvedWb = params.waistbandType === "curved";

  for (let j = 0; j <= wbHeightSegs; j++) {
    const t = j / wbHeightSegs; // 0 = bottom (at waist seam), 1 = top edge
    // Subtle rolled edge bevel at top & bottom of waistband for 3D realism
    const edgeBevel = Math.sin(t * Math.PI) * 0.16;

    for (let i = 0; i <= wbRadialSegs; i++) {
      const u = i / wbRadialSegs;
      const theta = u * Math.PI * 2;

      // Curved waistband dips gracefully ~0.75 cm at Center Front (+Z, theta=PI/2) and hugs contour!
      const cfFactor = Math.max(0, Math.sin(theta));
      const contourDip = isCurvedWb ? -0.75 * cfFactor * cfFactor : 0;
      const y = yWaist + t * wbHeight + contourDip;

      const body = bodyRadiusAtY(y, waistCm);
      // Straight waistband stands slightly more cylindrical; curved waistband tapers closer to upper waist
      const taperAdjust = isCurvedWb ? -0.22 * t : 0.12 * t;
      const rWb = waistCm / (2 * Math.PI) + 0.42 + edgeBevel + taperAdjust;

      const x = rWb * body.kx * Math.cos(theta);
      const z = rWb * body.kz * Math.sin(theta) + body.zOffset;
      wbPos.push(x, y, z);
    }
  }

  const wbStride = wbRadialSegs + 1;
  for (let j = 0; j < wbHeightSegs; j++) {
    for (let i = 0; i < wbRadialSegs; i++) {
      const a = j * wbStride + i;
      const b = a + wbStride;
      const c = b + 1;
      const d = a + 1;
      wbIdx.push(a, d, b);
      wbIdx.push(b, d, c);
    }
  }

  const waistbandGeometry = new THREE.BufferGeometry();
  waistbandGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(wbPos, 3)
  );
  waistbandGeometry.setIndex(wbIdx);
  waistbandGeometry.computeVertexNormals();

  // ==================== Build 3D Construction Seam Lines & Zipper ====================
  const seamSegments: number[] = [];
  const pushPolyline = (pts: THREE.Vector3[]) => {
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

  // 1. Waistband attachment seam ring
  const waistRingPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 120; i++) {
    const theta = (i / 120) * Math.PI * 2;
    const p = sampleSkirtSurface(theta, 0.004);
    p.x *= 1.008;
    p.z *= 1.008;
    waistRingPts.push(p);
  }
  pushPolyline(waistRingPts);

  // 2. Vertical panel seam(s):
  //    - pieceMultiplier === 1 -> Single Center Back seam (theta = 3*PI/2, -Z)
  //    - pieceMultiplier === 2 -> Two Side Seams at Right (theta = 0) & Left (theta = PI)
  const seamAngles =
    params.pieceMultiplier === 2 ? [0, Math.PI] : [Math.PI * 1.5];

  for (const angle of seamAngles) {
    const linePts: THREE.Vector3[] = [];
    for (let j = 0; j <= lengthSegs; j++) {
      const p = sampleSkirtSurface(angle, j / lengthSegs);
      // Offset 0.15 cm outward so stitch line never z-fights with cloth surface
      const radial2D = Math.hypot(p.x, p.z) || 1;
      p.x += (p.x / radial2D) * 0.16;
      p.z += (p.z / radial2D) * 0.16;
      linePts.push(p);
    }
    pushPolyline(linePts);
  }

  // 3. Zipper stop position (18 cm down from waist along CB or Left Side seam)
  let zipperPullPosition: THREE.Vector3 | null = null;
  if (params.includeZipperNotch) {
    const zipAngle = params.pieceMultiplier === 2 ? Math.PI : Math.PI * 1.5;
    const zipV = Math.min(0.75, 18 / skirtLengthCm);
    const pStop = sampleSkirtSurface(zipAngle, zipV);
    const radial2D = Math.hypot(pStop.x, pStop.z) || 1;
    pStop.x += (pStop.x / radial2D) * 0.25;
    pStop.z += (pStop.z / radial2D) * 0.25;
    zipperPullPosition = pStop;
  }

  const seamLinesGeometry = new THREE.BufferGeometry();
  seamLinesGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(seamSegments, 3)
  );

  // Sample lowest hem Y
  const hemSample = sampleSkirtSurface(Math.PI / 2, 1);
  // Touch radii to keep unused-var clean while exposing rich metadata if needed
  void radii;

  return {
    skirtGeometry,
    waistbandGeometry,
    seamLinesGeometry,
    zipperPullPosition,
    metrics: {
      waistElevationCm: yWaist,
      hemElevationCm: Math.round(hemSample.y * 10) / 10,
      fluteCount,
    },
  };
}
