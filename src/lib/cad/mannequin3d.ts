import * as THREE from "three";
import {
  getMannequinBodySpec,
  type BodyMeasurementStandard,
  type MannequinCategory,
} from "./bodyStandards";
import {
  REAL_MANNEQUIN_PROFILES,
  type RealMannequinProfileData,
} from "./mannequinMeshData";

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface MannequinLandmarks {
  heightScale: number;
  sizeScale: number;
  yFloor: number;
  yAnkle: number;
  yCalf: number;
  yKnee: number;
  yCrotch: number;
  yHip: number;
  yHighHip: number;
  yWaist: number;
  yUnderBust: number;
  yBust: number;
  yArmpit: number;
  yShoulder: number;
  yCollarbone: number;
  yNeckBase: number;
  yNeckMid: number;
  yChin: number;
  yCrown: number;
  headHeight: number;
  halfShoulderX: number;
}

export interface ArmSkeletonSide {
  side: -1 | 1;
  shoulderOrigin: THREE.Vector3;
  deltoidOuter: THREE.Vector3;
  elbowPos: THREE.Vector3;
  wristPos: THREE.Vector3;
  upperDir: THREE.Vector3;
  forearmDir: THREE.Vector3;
  upperLen: number;
  forearmLen: number;
  rDeltoid: number;
  rBicep: number;
  rElbow: number;
  rForearmTop: number;
  rWrist: number;
  sampleCenterAtDist: (distCm: number) => THREE.Vector3;
  sampleTangentAtDist: (distCm: number) => THREE.Vector3;
  sampleRadiusAtDist: (distCm: number) => { rx: number; rz: number };
}

export interface MannequinLegSpec {
  thigh: { cx: number; cz: number; rx: number; rz: number };
  knee: { cx: number; cz: number; rx: number; rz: number };
  calf: { cx: number; cz: number; rx: number; rz: number };
  ankle: { cx: number; cz: number; rx: number; rz: number };
}

export function getMannequinModelUrl(category: MannequinCategory): string {
  return `/models/mannequin-${category}.glb`;
}

export function getMannequinSizeScale(
  body: BodyMeasurementStandard,
  category: MannequinCategory = "women"
): number {
  const prof = REAL_MANNEQUIN_PROFILES[category];
  return body.heightMidCm / prof.baseHeightCm;
}

/**
 * Exact anatomical vertical landmarks measured directly from the posed CC0 MakeHuman GLB mesh,
 * scaled proportionally to the active TCVN size (S / M / L / XL)!
 */
export function getMannequinLandmarks(
  body: BodyMeasurementStandard,
  category: MannequinCategory = "women"
): MannequinLandmarks {
  const prof = REAL_MANNEQUIN_PROFILES[category];
  const s = body.heightMidCm / prof.baseHeightCm;
  const lm = prof.landmarks;

  return {
    heightScale: body.heightMidCm / 161,
    sizeScale: s,
    yFloor: 0,
    yAnkle: lm.yAnkle * s,
    yCalf: lm.yCalf * s,
    yKnee: lm.yKnee * s,
    yCrotch: lm.yCrotch * s,
    yHip: lm.yHip * s,
    yHighHip: lm.yHighHip * s,
    yWaist: lm.yWaist * s,
    yUnderBust: lm.yUnderBust * s,
    yBust: lm.yBust * s,
    yArmpit: lm.yArmpit * s,
    yShoulder: lm.yShoulder * s,
    yCollarbone: lm.yCollarbone * s,
    yNeckBase: lm.yNeckBase * s,
    yNeckMid: lm.yNeckMid * s,
    yChin: lm.yChin * s,
    yCrown: lm.yCrown * s,
    headHeight: lm.headHeight * s,
    halfShoulderX: lm.halfShoulderX * s,
  };
}

/**
 * Exact posed MakeHuman leg centers & radii (+X side; mirror X by -1 for right leg!).
 */
export function getMannequinLegSpec(
  body: BodyMeasurementStandard,
  category: MannequinCategory = "women"
): MannequinLegSpec {
  const prof = REAL_MANNEQUIN_PROFILES[category];
  const s = body.heightMidCm / prof.baseHeightCm;
  const pack = (a: [number, number, number, number]) => ({
    cx: a[0] * s,
    cz: a[1] * s,
    rx: a[2] * s,
    rz: a[3] * s,
  });
  return {
    thigh: pack(prof.legL.thigh),
    knee: pack(prof.legL.knee),
    calf: pack(prof.legL.calf),
    ankle: pack(prof.legL.ankle),
  };
}

function sampleGridPolar(
  prof: RealMannequinProfileData,
  yUnscaled: number,
  theta: number,
  convexWindow = 0
): { r: number; zOff: number } {
  const g = prof.torsoGrid;
  const tY = clamp((yUnscaled - g.yMin) / Math.max(1e-4, g.yMax - g.yMin), 0, 1);
  const fY = tY * (g.nY - 1);
  const iy0 = Math.floor(fY);
  const iy1 = Math.min(g.nY - 1, iy0 + 1);
  const wy = fY - iy0;

  const zOff = lerp(g.zOff[iy0], g.zOff[iy1], wy);

  const twoPi = Math.PI * 2;
  const normTh = ((theta % twoPi) + twoPi) % twoPi;
  const fT = (normTh / twoPi) * g.nTheta;
  const it0 = Math.floor(fT) % g.nTheta;
  const it1 = (it0 + 1) % g.nTheta;
  const wt = fT - Math.floor(fT);

  const evalAtIdx = (idx: number) =>
    lerp(g.radii[iy0][idx], g.radii[iy1][idx], wy);

  let r = lerp(evalAtIdx(it0), evalAtIdx(it1), wt);

  if (convexWindow > 0) {
    // Smooth convex cloth-bridge over anatomical hollows (cleavage valley, sternum groove, spine furrow, gluteal cleft)
    // Computes soft max across nearby angular neighbors so outerwear bridges smoothly without vacuum-sealing!
    let maxR = r;
    for (let k = -convexWindow; k <= convexWindow; k++) {
      if (k === 0) continue;
      const idx = (it0 + k + g.nTheta) % g.nTheta;
      const decay = 1 - 0.045 * Math.abs(k);
      const val = evalAtIdx(idx) * decay;
      if (val > maxR) maxR = val;
    }
    r = maxR;
  }

  return { r, zOff };
}

/**
 * Measure exact base cross-section extents (rx, rz, zOffset, zFront, zBack) directly from the real GLB mesh!
 */
export function bodyBaseProfileAtY(
  yCm: number,
  body: BodyMeasurementStandard,
  category: MannequinCategory = "women"
): { rx: number; rz: number; zOffset: number; zFront: number; zBack: number } {
  const prof = REAL_MANNEQUIN_PROFILES[category];
  const s = body.heightMidCm / prof.baseHeightCm;
  const yU = yCm / s;

  const side = sampleGridPolar(prof, yU, 0, 0);
  const front = sampleGridPolar(prof, yU, Math.PI / 2, 2);
  const back = sampleGridPolar(prof, yU, -Math.PI / 2, 2);

  const rx = side.r * s;
  const zOff = side.zOff * s;
  const zFront = zOff + front.r * s;
  const zBack = zOff - back.r * s;
  const rz = (zFront - zBack) * 0.5;
  return { rx, rz, zOffset: (zFront + zBack) * 0.5, zFront, zBack };
}

/**
 * EXACT REAL MAKEHUMAN TORSO/NECK/BUST/WAIST/HIP SURFACE EVALUATOR!
 * Bilinearly interpolates the exact 44x48 vertex surface measured directly off the posed GLB mesh.
 */
export function mannequinSurfaceAt(
  yCm: number,
  theta: number,
  body: BodyMeasurementStandard,
  category: MannequinCategory = "women"
): { x: number; z: number; rx: number; rz: number; zOff: number } {
  const prof = REAL_MANNEQUIN_PROFILES[category];
  const s = body.heightMidCm / prof.baseHeightCm;
  const { r, zOff } = sampleGridPolar(prof, yCm / s, theta, 0);
  const rScaled = r * s;
  const zOffScaled = zOff * s;
  return {
    x: rScaled * Math.cos(theta),
    z: rScaled * Math.sin(theta) + zOffScaled,
    rx: rScaled,
    rz: rScaled,
    zOff: zOffScaled,
  };
}

/**
 * SMOOTH CONVEX CLOTH-DRAPE ENVELOPE OVER REAL MAKEHUMAN SURFACE!
 * Strictly >= bare skin surface everywhere while smoothly bridging across cleavage, sternum,
 * spine furrow, and gluteal cleft so thick garments (Bomber, Polo, Jeans) drape like REAL cloth!
 */
export function mannequinDrapeEnvelopeAt(
  yCm: number,
  theta: number,
  body: BodyMeasurementStandard,
  category: MannequinCategory = "women"
): { x: number; z: number; rx: number; rz: number; zOff: number } {
  const prof = REAL_MANNEQUIN_PROFILES[category];
  const s = body.heightMidCm / prof.baseHeightCm;
  const yU = yCm / s;
  const lm = prof.landmarks;

  // Smooth convex bridge: wider across front bust/chest (win=4 -> ±30° smoothly bridges across both breasts without twin-cup imprint!),
  // 0 on neck so collars hug snugly!
  const sinT = Math.sin(theta);
  const isNeck = yU > lm.yNeckBase - 1.5;
  const isFrontBust = sinT > 0.2 && yU >= lm.yUnderBust - 2.0 && yU <= lm.yArmpit + 3.0;
  const isWaist = yU > lm.yHip + 5.0 && yU < lm.yUnderBust - 2.0;
  const win = isNeck ? 0 : isFrontBust ? 4 : isWaist ? 1 : 2;

  const { r, zOff } = sampleGridPolar(prof, yU, theta, win);
  // On female upper-front just below bust apex, bridge gently down from bust peak so outerwear drapes naturally!
  let rFinal = r;
  if (category === "women" && sinT > 0.25 && yU < lm.yBust && yU > lm.yUnderBust - 2.5) {
    const bustSamp = sampleGridPolar(prof, lm.yBust, theta, 4);
    const fade = clamp((yU - (lm.yUnderBust - 2.5)) / Math.max(1, lm.yBust - (lm.yUnderBust - 2.5)), 0, 1);
    rFinal = Math.max(rFinal, lerp(r, bustSamp.r * 0.96, fade * 0.65));
  }

  const rScaled = rFinal * s;
  const zOffScaled = zOff * s;
  return {
    x: rScaled * Math.cos(theta),
    z: rScaled * Math.sin(theta) + zOffScaled,
    rx: rScaled,
    rz: rScaled,
    zOff: zOffScaled,
  };
}

/**
 * EXACT POSED MAKEHUMAN ARM SKELETON (Synchronized 100% with the loaded GLB mesh's real arms!)
 * Note: `side = +1` is MakeHuman's Left Arm (+X); `side = -1` is exact X-mirror Right Arm (-X).
 */
export function getMannequinArmSkeleton(
  body: BodyMeasurementStandard,
  category: MannequinCategory = "women",
  side: -1 | 1 = 1
): ArmSkeletonSide {
  const prof = REAL_MANNEQUIN_PROFILES[category];
  const s = body.heightMidCm / prof.baseHeightCm;
  const a = prof.armL;

  const shJoint = new THREE.Vector3(side * a.shoulder[0] * s, a.shoulder[1] * s, a.shoulder[2] * s);
  const elbowPos = new THREE.Vector3(side * a.elbow[0] * s, a.elbow[1] * s, a.elbow[2] * s);
  const wristPos = new THREE.Vector3(side * a.wrist[0] * s, a.wrist[1] * s, a.wrist[2] * s);

  const rawUpper = elbowPos.clone().sub(shJoint);
  const fullUpperLen = rawUpper.length();
  const upperDir = rawUpper.clone().normalize();

  // Start sleeve tube 3.4 cm down the upper arm; raise shoulderOrigin above actual acromion roof (yShoulder + 0.8 cm!)
  // so Bomber & Polo deltoid shoulder caps cover 100% of the sculpted shoulder with ZERO exposed skin!
  const deltoidOuter = shJoint.clone().addScaledVector(upperDir, 3.4 * s);
  const yShRoof = prof.landmarks.yShoulder * s;
  const shoulderOrigin = new THREE.Vector3(
    shJoint.x - side * 3.8 * s,
    Math.max(yShRoof + 0.85 * s, shJoint.y + 7.2 * s),
    shJoint.z
  );
  const upperLen = Math.max(8, fullUpperLen - 3.4 * s);

  const foreVec = wristPos.clone().sub(elbowPos);
  const forearmLen = foreVec.length();
  const forearmDir = foreVec.clone().normalize();

  const rDeltoid = a.rDeltoid * s;
  const rBicep = a.rBicep * s;
  const rElbow = a.rElbow * s;
  const rForearmTop = a.rForearm * s;
  const rWrist = a.rWrist * s;

  const blendHalf = 4.5 * s;

  const sampleCenterAtDist = (distCm: number): THREE.Vector3 => {
    const d = clamp(distCm, 0, upperLen + forearmLen + 18 * s);
    if (d <= upperLen - blendHalf) {
      return deltoidOuter.clone().addScaledVector(upperDir, d);
    }
    if (d >= upperLen + blendHalf) {
      return elbowPos.clone().addScaledVector(forearmDir, d - upperLen);
    }
    const t = (d - (upperLen - blendHalf)) / (2 * blendHalf);
    const p0 = deltoidOuter.clone().addScaledVector(upperDir, upperLen - blendHalf);
    const p1 = elbowPos;
    const p2 = elbowPos.clone().addScaledVector(forearmDir, blendHalf);
    const omt = 1 - t;
    return new THREE.Vector3(
      omt * omt * p0.x + 2 * omt * t * p1.x + t * t * p2.x,
      omt * omt * p0.y + 2 * omt * t * p1.y + t * t * p2.y,
      omt * omt * p0.z + 2 * omt * t * p1.z + t * t * p2.z
    );
  };

  const sampleTangentAtDist = (distCm: number): THREE.Vector3 => {
    const eps = 0.25;
    const pA = sampleCenterAtDist(Math.max(0, distCm - eps));
    const pB = sampleCenterAtDist(distCm + eps);
    const dir = pB.sub(pA);
    if (dir.lengthSq() < 1e-6) return upperDir.clone();
    return dir.normalize();
  };

  const sampleRadiusAtDist = (distCm: number): { rx: number; rz: number } => {
    if (distCm <= upperLen) {
      const t = clamp(distCm / Math.max(1, upperLen), 0, 1);
      const r =
        t < 0.35
          ? lerp(rDeltoid * 0.92, rBicep, t / 0.35)
          : lerp(rBicep, rElbow, (t - 0.35) / 0.65);
      return { rx: r * 0.98, rz: r * 1.04 };
    }
    const u = clamp((distCm - upperLen) / Math.max(1, forearmLen), 0, 1);
    const r =
      u < 0.25
        ? lerp(rElbow, rForearmTop, u / 0.25)
        : lerp(rForearmTop, rWrist, (u - 0.25) / 0.75);
    return { rx: r * 0.95, rz: r * 1.08 };
  };

  return {
    side,
    shoulderOrigin,
    deltoidOuter,
    elbowPos,
    wristPos,
    upperDir,
    forearmDir,
    upperLen,
    forearmLen,
    rDeltoid,
    rBicep,
    rElbow,
    rForearmTop,
    rWrist,
    sampleCenterAtDist,
    sampleTangentAtDist,
    sampleRadiusAtDist,
  };
}

export interface RealisticMannequinMeta {
  modelUrl: string;
  sizeScale: number;
  plinthGeometry: THREE.BufferGeometry;
  bodySpec: BodyMeasurementStandard;
  landmarks: MannequinLandmarks;
}

/**
 * Returns metadata + sleek low-profile floor plinth for the real sculpted MakeHuman GLB mannequin!
 */
export function buildRealisticMannequinMeta(
  category: MannequinCategory = "women",
  sizeCode = "M"
): RealisticMannequinMeta {
  const body = getMannequinBodySpec(category, sizeCode);
  const landmarks = getMannequinLandmarks(body, category);
  const sizeScale = getMannequinSizeScale(body, category);

  const plinthPts = [
    new THREE.Vector2(0.01, -1.2),
    new THREE.Vector2(27.5, -1.2),
    new THREE.Vector2(27.5, -0.35),
    new THREE.Vector2(26.6, 0.02),
    new THREE.Vector2(0.01, 0.02),
  ];
  const plinthGeometry = new THREE.LatheGeometry(plinthPts, 64);
  plinthGeometry.translate(0, 0, 2.5);

  return {
    modelUrl: getMannequinModelUrl(category),
    sizeScale,
    plinthGeometry,
    bodySpec: body,
    landmarks,
  };
}
