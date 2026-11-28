import * as THREE from "three";
import {
  getMannequinBodySpec,
  type BodyMeasurementStandard,
  type MannequinCategory,
} from "./bodyStandards";

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function gaussian(x: number, sigma: number): number {
  const r = x / Math.max(1e-5, sigma);
  return Math.exp(-0.5 * r * r);
}

function superGauss(x: number, sigma: number, power = 2.0): number {
  const r = Math.abs(x) / Math.max(1e-5, sigma);
  return Math.exp(-0.5 * Math.pow(r, power));
}

function wrapAngleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export interface MannequinLandmarks {
  heightScale: number;
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

/**
 * Compute consistent human anatomical vertical landmarks directly from TCVN/Asian Body Standards!
 */
export function getMannequinLandmarks(
  body: BodyMeasurementStandard,
  category: MannequinCategory = "women"
): MannequinLandmarks {
  const heightScale = body.heightMidCm / 161;
  const isMen = category === "men";
  const isKids = category === "kids";

  const yFloor = 0;
  const yWaist = 102 * heightScale;
  const yCrotch = yWaist - body.crotchDepthCm;
  const yHip = yCrotch + 8.6 * heightScale;
  const yHighHip = lerp(yHip, yWaist, 0.54);
  const yUnderBust = yWaist + body.backLengthCm * (isMen ? 0.36 : 0.28);
  const yBust = yWaist + body.backLengthCm * (isMen ? 0.54 : 0.455);
  const yArmpit = yWaist + body.backLengthCm * 0.67;
  const yShoulder = yWaist + body.backLengthCm * 0.855;
  const yCollarbone = yWaist + body.backLengthCm * 0.93;
  const yNeckBase = yWaist + body.backLengthCm * 0.99;

  // Real human leg proportions (ankle ~4.8% height, calf peak ~20%, knee ~28.5%)
  const legLen = Math.max(30, yCrotch);
  const yAnkle = legLen * 0.105;
  const yCalf = legLen * 0.415;
  const yKnee = legLen * 0.585;

  // Real human head & neck proportions (natural balanced neck height — NO giraffe stretch!)
  const headHeight = isKids
    ? Math.max(16.8, body.heightMidCm * 0.152)
    : isMen
      ? 22.0 * heightScale
      : 21.0 * heightScale;
  const neckVisHeight = isKids ? 4.2 * heightScale : isMen ? 5.5 * heightScale : 5.4 * heightScale;
  const yNeckMid = yNeckBase + neckVisHeight * 0.5;
  const yChin = yNeckBase + neckVisHeight;
  const yCrown = yChin + headHeight;

  // Biacromial half-width (shoulder bone tip; deltoid flesh adds outside this smoothly!)
  const halfShoulderX = isMen
    ? body.shoulderCm * 0.455
    : isKids
      ? body.shoulderCm * 0.435
      : body.shoulderCm * 0.43;

  return {
    heightScale,
    yFloor,
    yAnkle,
    yCalf,
    yKnee,
    yCrotch,
    yHip,
    yHighHip,
    yWaist,
    yUnderBust,
    yBust,
    yArmpit,
    yShoulder,
    yCollarbone,
    yNeckBase,
    yNeckMid,
    yChin,
    yCrown,
    headHeight,
    halfShoulderX,
  };
}

/**
 * Base torso cross-section profile (pelvic saddle -> hips -> hourglass/athletic waist -> ribcage -> sloped shoulders -> neck)
 * BEFORE dual-breast / male pec / dual-glute / spine sculpting.
 */
export function bodyBaseProfileAtY(
  yCm: number,
  body: BodyMeasurementStandard,
  category: MannequinCategory = "women"
): { rx: number; rz: number; zOffset: number; zFront: number; zBack: number } {
  const lm = getMannequinLandmarks(body, category);
  const hs = lm.heightScale;
  const isWomen = category === "women";
  const isMen = category === "men";

  // Underlying ribcage is sleeker on Women because sculpted dual breasts project +3.8 cm ON TOP!
  const ribCirc = isWomen ? body.bustCm * 0.86 : isMen ? body.bustCm * 0.955 : body.bustCm * 0.95;
  const rRib = ribCirc / (2 * Math.PI);
  const rWaist = body.waistCm / (2 * Math.PI);
  const rHip = body.hipCm / (2 * Math.PI);
  const rNeck = body.neckCm / (2 * Math.PI);

  // Gender-authentic torso widths (Women: hourglass waist + curvy hips + narrow sloped shoulders;
  // Men: broad V-taper chest/lats + athletic waist + straighter hips + muscular neck!)
  const rxCrotch = rHip * (isWomen ? 1.04 : isMen ? 1.01 : 1.0);
  const rxHip = rHip * (isWomen ? 1.2 : isMen ? 1.1 : 1.08);
  const rxHighHip = lerp(rxHip, rWaist * (isWomen ? 1.07 : 1.15), 0.54);
  const rxWaist = rWaist * (isWomen ? 1.05 : isMen ? 1.16 : 1.1);
  const rxUnderBust = lerp(rxWaist, rRib * (isMen ? 1.25 : 1.14), 0.64);
  const rxBust = rRib * (isMen ? 1.27 : isWomen ? 1.13 : 1.12);
  const rxArmpit = isMen
    ? Math.max(rxBust * 1.05, lm.halfShoulderX * 0.92)
    : isWomen
      ? Math.max(rxBust * 1.01, lm.halfShoulderX * 0.89)
      : lm.halfShoulderX * 0.89;
  // Smooth anatomical trapezius-to-acromion shoulder width (blends seamlessly with deltoid shoulder cap!)
  const rxShoulder = lm.halfShoulderX * (isMen ? 0.97 : 0.95);
  const rxCollar = lm.halfShoulderX * (isMen ? 0.72 : 0.68);
  const rxNeckBase = rNeck * (isMen ? 1.06 : isWomen ? 0.94 : 0.95);
  const rxNeckMid = rNeck * (isMen ? 0.94 : isWomen ? 0.84 : 0.86);
  // Top of neck tucks smoothly INSIDE the closed skull/jaw base (ZERO visible flat cylinder top!)
  const rxNeckSkull = rNeck * (isMen ? 0.8 : isWomen ? 0.72 : 0.75);

  const zScaleHip = rHip / 14.8;
  const zScaleWaist = rWaist / 11.0;
  const zScaleRib = rRib / 12.2;
  const zScaleNeck = rNeck / 5.65;

  const stops: Array<{ y: number; rx: number; zF: number; zB: number }> = [
    // Smooth rounded anatomical pelvic saddle at bottom (ZERO flat dark disk shadow between thighs!)
    {
      y: lm.yCrotch - 2.0 * hs,
      rx: 1.8 * zScaleHip,
      zF: 2.2 * zScaleHip,
      zB: -2.6 * zScaleHip,
    },
    {
      y: lm.yCrotch - 0.8 * hs,
      rx: rxCrotch * 0.56,
      zF: 6.2 * zScaleHip,
      zB: -6.8 * zScaleHip,
    },
    {
      y: lm.yCrotch + 1.6 * hs,
      rx: rxCrotch,
      zF: 8.1 * zScaleHip,
      zB: -(isWomen ? 8.6 : 8.2) * zScaleHip,
    },
    {
      y: lm.yHip,
      rx: rxHip,
      zF: (isWomen ? 9.0 : 8.6) * zScaleHip,
      zB: -(isWomen ? 9.5 : 8.9) * zScaleHip,
    },
    {
      y: lm.yHighHip,
      rx: rxHighHip,
      zF: (isWomen ? 8.5 : 8.5) * lerp(zScaleHip, zScaleWaist, 0.5),
      zB: -(isWomen ? 8.2 : 8.3) * lerp(zScaleHip, zScaleWaist, 0.5),
    },
    {
      y: lm.yWaist,
      rx: rxWaist,
      zF: (isWomen ? 7.8 : isMen ? 8.8 : 8.3) * zScaleWaist,
      zB: -(isWomen ? 7.1 : isMen ? 7.8 : 7.5) * zScaleWaist,
    },
    {
      y: lm.yUnderBust,
      rx: rxUnderBust,
      zF: (isWomen ? 8.1 : isMen ? 9.2 : 8.3) * zScaleRib,
      zB: -(isWomen ? 8.3 : isMen ? 8.9 : 8.0) * zScaleRib,
    },
    {
      y: lm.yBust,
      rx: rxBust,
      // Underlying sleek ribcage front (sculpted dual breasts / male pecs rise ON TOP of this!)
      zF: (isWomen ? 8.3 : isMen ? 9.4 : 8.4) * zScaleRib,
      zB: -(isWomen ? 9.3 : isMen ? 9.8 : 8.6) * zScaleRib,
    },
    {
      y: lm.yArmpit,
      rx: rxArmpit,
      zF: (isWomen ? 8.2 : isMen ? 9.3 : 8.2) * zScaleRib,
      zB: -(isWomen ? 9.4 : isMen ? 9.9 : 8.5) * zScaleRib,
    },
    {
      y: lm.yShoulder,
      rx: rxShoulder,
      zF: (isWomen ? 7.1 : isMen ? 8.1 : 7.0) * zScaleRib,
      zB: -(isWomen ? 8.4 : isMen ? 9.1 : 7.7) * zScaleRib,
    },
    {
      y: lm.yCollarbone,
      rx: rxCollar,
      zF: (isWomen ? 6.1 : isMen ? 6.9 : 6.1) * zScaleRib,
      zB: -(isWomen ? 7.2 : isMen ? 7.8 : 6.8) * zScaleRib,
    },
    {
      y: lm.yNeckBase,
      rx: rxNeckBase,
      zF: (isWomen ? 4.7 : isMen ? 5.6 : 4.7) * zScaleNeck,
      zB: -(isWomen ? 5.1 : isMen ? 5.9 : 5.0) * zScaleNeck,
    },
    {
      y: lm.yNeckMid,
      rx: rxNeckMid,
      // Natural slender human neck tilting gently forward toward throat/jaw
      zF: (isWomen ? 4.4 : isMen ? 5.3 : 4.5) * zScaleNeck + 0.45 * hs,
      zB: -(isWomen ? 4.3 : isMen ? 5.1 : 4.4) * zScaleNeck + 0.45 * hs,
    },
    {
      y: lm.yChin + 1.2 * hs,
      rx: rxNeckMid * 0.96,
      // Front of neck tucks cleanly BACK behind the chin tip (real submental throat angle!)
      zF: (isWomen ? 4.2 : isMen ? 5.0 : 4.3) * zScaleNeck + 0.55 * hs,
      zB: -(isWomen ? 4.3 : isMen ? 5.1 : 4.4) * zScaleNeck + 0.55 * hs,
    },
    {
      y: lm.yChin + 4.8 * hs,
      rx: rxNeckSkull,
      zF: (isWomen ? 3.8 : isMen ? 4.5 : 3.9) * zScaleNeck + 0.65 * hs,
      zB: -(isWomen ? 3.8 : isMen ? 4.6 : 3.9) * zScaleNeck + 0.65 * hs,
    },
  ];

  const pack = (rx: number, zF: number, zB: number) => ({
    rx,
    rz: (zF - zB) / 2,
    zOffset: (zF + zB) / 2,
    zFront: zF,
    zBack: zB,
  });

  if (yCm <= stops[0].y) {
    return pack(stops[0].rx, stops[0].zF, stops[0].zB);
  }
  if (yCm >= stops[stops.length - 1].y) {
    const last = stops[stops.length - 1];
    return pack(last.rx, last.zF, last.zB);
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (yCm >= a.y && yCm <= b.y) {
      const t = smoothstep(a.y, b.y, yCm);
      return pack(lerp(a.rx, b.rx, t), lerp(a.zF, b.zF, t), lerp(a.zB, b.zB, t));
    }
  }
  return pack(rxWaist, 8.0, -7.4);
}

/**
 * HIGH-FIDELITY ANATOMICAL TORSO SURFACE EVALUATOR (100% NaN-FREE via `superGauss`!)
 * Shared identically by the 3D Mannequin Torso Mesh AND the Garment Collision-Clearance Solver!
 * Sculpts:
 * - Women: Full anatomical dual teardrop breasts + cleavage valley + inframammary crease + slender hourglass waist + curved hips + twin sculpted glutes
 * - Men: Broad flat-angled muscular pectoral plates + vertical sternum groove + lower pec line + athletic V-taper + firmer athletic glutes
 * - Both: Collarbones, throat notch, scapulae, central spine furrow, gluteal cleft
 */
export function mannequinSurfaceAt(
  yCm: number,
  theta: number,
  body: BodyMeasurementStandard,
  category: MannequinCategory = "women"
): { x: number; z: number; rx: number; rz: number; zOff: number } {
  const lm = getMannequinLandmarks(body, category);
  const prof = bodyBaseProfileAtY(yCm, body, category);
  const hs = lm.heightScale;

  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  // 1. Subtle anatomical superellipse squircle cross-section (fades out cleanly at crotch & neck!)
  const pelvisFade = smoothstep(lm.yCrotch - 0.5 * hs, lm.yCrotch + 3.0 * hs, yCm);
  const neckFade = 1 - smoothstep(lm.yCollarbone, lm.yNeckBase, yCm);
  const sqMask = pelvisFade * neckFade;
  const sqExp = lerp(2.0, category === "men" ? 2.38 : 2.2, sqMask);
  const sqDenom = Math.pow(
    Math.pow(Math.abs(cosT) + 1e-6, sqExp) + Math.pow(Math.abs(sinT) + 1e-6, sqExp),
    1 / sqExp
  );
  const sqScale = lerp(1.0, 1.0 / sqDenom, 0.3 * sqMask);

  let x = prof.rx * sqScale * cosT;
  let z = prof.rz * sqScale * sinT + prof.zOffset;

  const isWomen = category === "women";
  const isMen = category === "men";
  const isKids = category === "kids";

  const dCF = wrapAngleDiff(theta, Math.PI / 2);
  const dCB = wrapAngleDiff(theta, -Math.PI / 2);

  // 2. WOMEN: FULL ANATOMICAL DUAL TEARDROP BREASTS + CLEAVAGE + INFRAMAMMARY CREASE!
  if (isWomen) {
    const bustScale = body.bustCm / 87;
    const bustFullness = clamp((body.bustCm - body.waistCm) / 18, 0.78, 1.38);
    // Natural full feminine bust projection (~3.95 cm on size M -> unmistakable, graceful dual breasts!)
    const breastProj = 3.95 * bustScale * Math.pow(bustFullness, 0.55);
    const yApex = lm.yBust - 0.7 * hs;
    const dy = yCm - yApex;

    // Asymmetric natural teardrop vertical curve: gentle upper slope from collarbone, fuller rounder lower pole!
    const sigmaUp = 7.4 * hs * Math.pow(bustScale, 0.45);
    const sigmaDown = 4.35 * hs * Math.pow(bustScale, 0.45);
    let vProfile = 0;
    if (dy >= 0) {
      const u = dy / sigmaUp;
      vProfile = Math.exp(-0.55 * u * u) * (1 - smoothstep(sigmaUp * 1.4, sigmaUp * 1.9, dy));
    } else {
      const u = -dy / sigmaDown;
      vProfile = Math.exp(-0.82 * Math.pow(u, 2.25));
    }

    if (vProfile > 0.002 && sinT > 0.02) {
      // Two distinct breasts centered at ±0.44 rad (~25° from Center Front)
      const bAngle = 0.44;
      let moundSum = 0;
      for (const sgn of [-1, 1] as const) {
        const da = dCF - sgn * bAngle;
        const isMedial = sgn * da < 0;
        const sigmaAng = isMedial ? 0.245 : 0.34;
        // SAFE superGauss (uses Math.abs(da) — ZERO NaN!)
        moundSum += superGauss(da, sigmaAng, 2.1);
      }

      const push = breastProj * vProfile * Math.min(1.06, moundSum);
      const outDirX = cosT * 0.28;
      const outDirZ = Math.max(0.28, sinT);
      const norm = Math.hypot(outDirX, outDirZ) || 1;
      x += (outDirX / norm) * push * 0.55;
      z += (outDirZ / norm) * push;

      // Delicate natural sternum cleavage valley right between the two breasts!
      const cleavageDip =
        0.72 * bustScale * gaussian(dCF, 0.13) * gaussian(dy + 0.4 * hs, 3.6 * hs);
      z -= cleavageDip;
    }

    // Crisp subtle inframammary crease tucking under the lower pole of each breast!
    const yCrease = yApex - 5.1 * hs * Math.pow(bustScale, 0.45);
    const creaseV = gaussian(yCm - yCrease, 1.25 * hs);
    if (creaseV > 0.01 && sinT > 0.1) {
      const creaseH = gaussian(dCF - 0.43, 0.26) + gaussian(dCF + 0.43, 0.26);
      z -= 0.58 * bustScale * creaseV * Math.min(1, creaseH);
    }
  }

  // 3. MEN: BROAD SCULPTED PECTORAL PLATES + STERNUM GROOVE + LOWER PEC LINE + ATHLETIC ABS!
  if (isMen) {
    const chestScale = body.bustCm / 91;
    const yPecCenter = lm.yBust + 1.0 * hs;
    const dyPec = yCm - yPecCenter;

    const pecUp = dyPec >= 0 ? gaussian(dyPec, 6.2 * hs) : 1.0;
    const pecLowCut = smoothstep(-5.0 * hs, -2.2 * hs, dyPec);
    const pecV = dyPec >= 0 ? pecUp : pecLowCut;

    if (pecV > 0.01 && sinT > 0.05) {
      let pecH = 0;
      for (const sgn of [-1, 1] as const) {
        const da = dCF - sgn * 0.54;
        // Flat broad muscular pec plate (SAFE superGauss with exponent 2.8 — ZERO NaN!)
        pecH += superGauss(da, 0.37, 2.8);
      }
      const pecPush = 2.0 * chestScale * pecV * Math.min(1, pecH);
      z += pecPush * Math.max(0.32, sinT);
      x += Math.sign(cosT) * pecPush * 0.22 * Math.abs(cosT);

      // Crisp vertical sternum furrow right down center chest!
      const sternumGroove = 0.72 * chestScale * gaussian(dCF, 0.115) * pecV;
      z -= sternumGroove;
    }

    // Crisp horizontal lower-pec edge shadow
    const pecLine = gaussian(yCm - (yPecCenter - 4.3 * hs), 1.0 * hs);
    if (pecLine > 0.01 && sinT > 0.2) {
      const hMask = gaussian(dCF - 0.52, 0.32) + gaussian(dCF + 0.52, 0.32);
      z -= 0.45 * chestScale * pecLine * Math.min(1, hMask);
    }

    // Subtle athletic upper-ab / linea alba contour
    const abMask =
      smoothstep(lm.yHighHip, lm.yWaist, yCm) * (1 - smoothstep(lm.yUnderBust, lm.yBust, yCm));
    if (abMask > 0.01 && sinT > 0.25) {
      const lineaAlba = 0.34 * gaussian(dCF, 0.09) * abMask;
      const rectus =
        0.38 * (gaussian(dCF - 0.24, 0.14) + gaussian(dCF + 0.24, 0.14)) * abMask;
      z += rectus - lineaAlba;
    }
  }

  // 4. COLLARBONES (CLAVICLES) & SUPRASTERNAL THROAT NOTCH
  if (!isKids) {
    const clavV = gaussian(yCm - (lm.yCollarbone - 0.6 * hs), 1.15 * hs);
    if (clavV > 0.01 && sinT > 0.15) {
      const notch = (isWomen ? 0.65 : 0.58) * gaussian(dCF, 0.14) * clavV;
      const ridge =
        (isWomen ? 0.46 : 0.52) *
        (gaussian(dCF - 0.54, 0.34) + gaussian(dCF + 0.54, 0.34)) *
        clavV;
      z += ridge - notch;
    }
  }

  // 5. NATURAL UPPER-BACK SCAPULAE & CENTRAL SPINE FURROW
  const spineMask =
    smoothstep(lm.yHip + 1.5 * hs, lm.yHighHip + 2 * hs, yCm) *
    (1 - smoothstep(lm.yShoulder, lm.yNeckBase, yCm));
  if (spineMask > 0.01 && sinT < -0.1) {
    const spineDepth = isKids ? 0.32 : isWomen ? 0.68 : 0.78;
    z += spineDepth * gaussian(dCB, 0.145) * spineMask;

    const scapV = gaussian(yCm - (lm.yArmpit + 1.5 * hs), 5.2 * hs);
    if (scapV > 0.01) {
      const scapH = gaussian(dCB - 0.48, 0.28) + gaussian(dCB + 0.48, 0.28);
      z -= (isMen ? 0.96 : isWomen ? 0.6 : 0.3) * scapV * Math.min(1, scapH);
    }
  }

  // 6. REAL SCULPTED DUAL GLUTES (BUTTOCKS) + GLUTEAL CLEFT (100% NaN-FREE via superGauss!)
  const yGlutePeak = lm.yCrotch + (isWomen ? 6.8 : 7.2) * hs;
  const dyG = yCm - yGlutePeak;
  const gluteV =
    dyG >= 0
      ? gaussian(dyG, 6.2 * hs)
      : Math.exp(-0.78 * Math.pow(-dyG / (4.3 * hs), 2.15));

  if (gluteV > 0.005 && sinT < -0.05 && yCm > lm.yCrotch - 0.5 * hs) {
    const hipScale = body.hipCm / 93;
    const gluteProj = (isWomen ? 2.45 : isMen ? 1.55 : 0.8) * hipScale;
    let cheekSum = 0;
    for (const sgn of [-1, 1] as const) {
      const da = dCB - sgn * 0.44;
      cheekSum += superGauss(da, 0.33, 2.05);
    }
    const pushBack = gluteProj * gluteV * Math.min(1.05, cheekSum);
    z -= pushBack * Math.max(0.25, -sinT);
    x += Math.sign(cosT) * pushBack * 0.2 * Math.abs(cosT);

    // Natural gluteal cleft between cheeks
    const cleftDepth = (isWomen ? 1.2 : isMen ? 0.9 : 0.4) * hipScale;
    z += cleftDepth * gaussian(dCB, 0.13) * gluteV;
  }

  // 7. SUBTLE LOWER ABDOMEN CONTOUR & NECK SCM TENDONS
  if (!isKids && sinT > 0.25) {
    const bellyLow = gaussian(yCm - (lm.yHighHip - 0.4 * hs), 4.2 * hs);
    if (bellyLow > 0.01) {
      z += (isWomen ? 0.32 : 0.15) * bellyLow * gaussian(dCF, 0.42);
    }
  }

  if (yCm > lm.yNeckBase - 1.2 * hs && yCm < lm.yChin + 1.2 * hs) {
    const neckT = clamp((yCm - lm.yNeckBase) / Math.max(1, lm.yChin - lm.yNeckBase), 0, 1);
    const scmAngle = lerp(0.24, 0.85, neckT);
    const scmRidge =
      (isMen ? 0.32 : 0.2) *
      (gaussian(dCF - scmAngle, 0.14) + gaussian(dCF + scmAngle, 0.14)) *
      Math.sin(neckT * Math.PI);
    z += scmRidge * Math.max(0, sinT);

    if (isMen) {
      z += 0.32 * gaussian(dCF, 0.15) * gaussian(neckT - 0.56, 0.14);
    }
  }

  return { x, z, rx: prof.rx, rz: prof.rz, zOff: prof.zOffset };
}

/**
 * Smooth convex garment-drape body envelope (used by outerwear/tops like Bomber & Polo!).
 * Matches the full outer silhouette of breasts, pecs, shoulders, and hips, while naturally
 * bridging ACROSS anatomical concavities (cleavage valley, under-bust crease, lower-pec crease, spine furrow)
 * so real cloth drapes naturally over the body instead of vacuum-sealing into skin crevices!
 */
export function mannequinDrapeEnvelopeAt(
  yCm: number,
  theta: number,
  body: BodyMeasurementStandard,
  category: MannequinCategory = "women"
): { x: number; z: number; rx: number; rz: number; zOff: number } {
  const lm = getMannequinLandmarks(body, category);
  const prof = bodyBaseProfileAtY(yCm, body, category);
  const hs = lm.heightScale;

  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  const pelvisFade = smoothstep(lm.yCrotch - 0.5 * hs, lm.yCrotch + 3.0 * hs, yCm);
  const neckFade = 1 - smoothstep(lm.yCollarbone, lm.yNeckBase, yCm);
  const sqMask = pelvisFade * neckFade;
  const sqExp = lerp(2.0, category === "men" ? 2.35 : 2.18, sqMask);
  const sqDenom = Math.pow(
    Math.pow(Math.abs(cosT) + 1e-6, sqExp) + Math.pow(Math.abs(sinT) + 1e-6, sqExp),
    1 / sqExp
  );
  const sqScale = lerp(1.0, 1.0 / sqDenom, 0.28 * sqMask);

  const x = prof.rx * sqScale * cosT;
  let z = prof.rz * sqScale * sinT + prof.zOffset;

  const isWomen = category === "women";
  const isMen = category === "men";
  const dCF = wrapAngleDiff(theta, Math.PI / 2);
  const dCB = wrapAngleDiff(theta, -Math.PI / 2);

  // Smooth convex front chest bridge (strictly envelops BOTH breast apexes with ZERO poke-through & ZERO cleavage vacuum!)
  if (isWomen && sinT > 0.02) {
    const bustScale = body.bustCm / 87;
    const bustFullness = clamp((body.bustCm - body.waistCm) / 18, 0.78, 1.38);
    const bustEnv = 4.35 * bustScale * Math.pow(bustFullness, 0.55);
    const yApex = lm.yBust - 0.7 * hs;
    const dy = yCm - yApex;
    const vEnv =
      dy >= 0
        ? Math.exp(-0.5 * Math.pow(dy / (7.8 * hs), 2)) * (1 - smoothstep(10.5 * hs, 14.5 * hs, dy))
        : Math.exp(-0.38 * Math.pow(-dy / (8.8 * hs), 1.8));
    // Broad flat-topped super-gaussian covering ±0.44 rad breast apexes at >94% height!
    const hEnv = superGauss(dCF, 0.78, 3.2);
    z += bustEnv * vEnv * hEnv * Math.max(0.35, sinT);
  } else if (isMen && sinT > 0.05) {
    const chestScale = body.bustCm / 91;
    const yPec = lm.yBust + 0.8 * hs;
    const dy = yCm - yPec;
    const vEnv =
      dy >= 0
        ? gaussian(dy, 6.8 * hs)
        : Math.exp(-0.38 * Math.pow(-dy / (9.0 * hs), 1.8));
    const hEnv = superGauss(dCF, 0.76, 2.6);
    z += 2.0 * chestScale * vEnv * hEnv * Math.max(0.35, sinT);
  }

  // Smooth convex back glute bridge (no gluteal cleft dip!)
  if (sinT < -0.05 && yCm > lm.yCrotch - 0.5 * hs) {
    const hipScale = body.hipCm / 93;
    const yGlute = lm.yCrotch + 7.0 * hs;
    const dyG = yCm - yGlute;
    const gV = dyG >= 0 ? gaussian(dyG, 6.8 * hs) : Math.exp(-0.5 * Math.pow(-dyG / (5.5 * hs), 2.0));
    const gH = superGauss(dCB, 0.66, 2.3);
    const gProj = (isWomen ? 2.45 : isMen ? 1.55 : 0.8) * hipScale;
    z -= gProj * gV * gH * Math.max(0.3, -sinT);
  }

  return { x, z, rx: prof.rx, rz: prof.rz, zOff: prof.zOffset };
}

/**
 * SHARED ARTICULATED ARM SKELETON (Synchronized 100% between Mannequin Arms & Bomber/Polo Sleeves!)
 * Smooth anatomical rounded deltoid arc dropping ~6.4 cm from acromion into relaxed upper arm -> natural elbow -> wrist!
 */
export function getMannequinArmSkeleton(
  body: BodyMeasurementStandard,
  category: MannequinCategory = "women",
  side: -1 | 1 = 1
): ArmSkeletonSide {
  const lm = getMannequinLandmarks(body, category);
  const hs = lm.heightScale;
  const isMen = category === "men";
  const isKids = category === "kids";

  const shProf = bodyBaseProfileAtY(lm.yShoulder, body, category);
  const shoulderCenterZ = shProf.zOffset - 0.35 * hs;

  // Inner glenohumeral apex nested smoothly INSIDE the torso shoulder slope (ZERO stepped flat top!)
  const shoulderOrigin = new THREE.Vector3(
    side * (lm.halfShoulderX - (isMen ? 4.4 : 4.0) * hs),
    lm.yShoulder + (isMen ? 0.35 : 0.15) * hs,
    shoulderCenterZ
  );
  // Lower deltoid insertion (~6.4 cm below shoulder tip — smooth natural rounded human deltoid arc!)
  const deltoidOuter = new THREE.Vector3(
    side * (lm.halfShoulderX + (isMen ? 0.85 : 0.45) * hs),
    lm.yShoulder - (isMen ? 6.5 : 6.1) * hs,
    shoulderCenterZ
  );

  // Anatomical segment lengths from deltoid insertion down to elbow & wrist
  const upperLen = (isMen ? 25.4 : isKids ? 23.4 : 24.4) * hs;
  const forearmLen = (isMen ? 24.6 : isKids ? 22.8 : 23.4) * hs;

  // Natural graceful standing A-pose angles
  const upperOutRad = ((isMen ? 11.4 : 10.6) * Math.PI) / 180;
  const upperDir = new THREE.Vector3(
    side * Math.sin(upperOutRad),
    -Math.cos(upperOutRad),
    -0.028
  ).normalize();

  const elbowPos = deltoidOuter.clone().addScaledVector(upperDir, upperLen);

  // Forearm bends gently forward (~9°) and relaxes naturally alongside the outer thighs
  const foreOutRad = ((isMen ? 7.2 : 6.2) * Math.PI) / 180;
  const forearmDir = new THREE.Vector3(
    side * Math.sin(foreOutRad),
    -Math.cos(foreOutRad) * 0.985,
    0.145
  ).normalize();

  const wristPos = elbowPos.clone().addScaledVector(forearmDir, forearmLen);

  // Gender-authentic bare-arm radii (Women slender & graceful, Men muscular athletic!)
  const armScale = Math.pow(body.bustCm / (isMen ? 91 : 87), 0.72);
  const rDeltoid = (isMen ? 5.25 : isKids ? 3.85 : 4.2) * armScale;
  const rBicep = (isMen ? 4.75 : isKids ? 3.45 : 3.75) * armScale;
  const rElbow = (isMen ? 3.75 : isKids ? 2.9 : 3.05) * armScale;
  const rForearmTop = (isMen ? 4.1 : isKids ? 3.0 : 3.2) * armScale;
  const rWrist = (isMen ? 2.75 : isKids ? 2.1 : 2.2) * armScale;

  const blendHalf = 4.5 * hs;

  const sampleCenterAtDist = (distCm: number): THREE.Vector3 => {
    const d = clamp(distCm, 0, upperLen + forearmLen + 20 * hs);
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
      const t = clamp(distCm / upperLen, 0, 1);
      const delt = Math.exp(-Math.pow(t / 0.28, 2)) * (rDeltoid - rBicep);
      const bicepSwell = Math.sin(clamp((t - 0.1) / 0.75, 0, 1) * Math.PI) * (isMen ? 0.42 : 0.2);
      const base = lerp(rBicep, rElbow, smoothstep(0.4, 1.0, t)) + delt + bicepSwell;
      return { rx: base * 0.94, rz: base * 1.06 };
    }
    const u = clamp((distCm - upperLen) / Math.max(1, forearmLen), 0, 1);
    const foreSwell = Math.sin(clamp(u / 0.55, 0, 1) * Math.PI) * (rForearmTop - rElbow) * 1.15;
    const base = lerp(rElbow, rWrist, Math.pow(u, 0.85)) + foreSwell * (1 - u * 0.85);
    const wristFlatX = lerp(0.94, 0.74, smoothstep(0.45, 1.0, u));
    const wristDeepZ = lerp(1.04, 1.24, smoothstep(0.45, 1.0, u));
    return { rx: base * wristFlatX, rz: base * wristDeepZ };
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

function buildTube(
  radialSegs: number,
  heightSegs: number,
  sampleFn: (theta: number, v: number) => THREE.Vector3,
  capBottom = false,
  capTop = false,
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

  if (capTop) {
    const topStart = heightSegs * stride;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let i = 0; i < radialSegs; i++) {
      cx += positions[(topStart + i) * 3];
      cy += positions[(topStart + i) * 3 + 1];
      cz += positions[(topStart + i) * 3 + 2];
    }
    const centerIdx = positions.length / 3;
    positions.push(cx / radialSegs, cy / radialSegs, cz / radialSegs);
    uvs.push(0.5, 1);
    for (let i = 0; i < radialSegs; i++) {
      if (flipWinding) {
        indices.push(centerIdx, topStart + i, topStart + i + 1);
      } else {
        indices.push(centerIdx, topStart + i + 1, topStart + i);
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

function mergeGeos(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
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
 * SCULPTED STUDIO FASHION MANNEQUIN HEAD (CLO3D / Bonaveri Aesthetic)
 * Seamless neck-to-jaw connection (ZERO flat cylinder shelf under chin!),
 * realistic human skull depth, sculpted chin/jawline, nose bridge, cheekbones, brow & ears!
 */
function buildSculptedHead(
  body: BodyMeasurementStandard,
  category: MannequinCategory
): THREE.BufferGeometry[] {
  const lm = getMannequinLandmarks(body, category);
  const isMen = category === "men";
  const isKids = category === "kids";

  const H = lm.headHeight;
  const yChin = lm.yChin;
  const neckProf = bodyBaseProfileAtY(lm.yNeckMid, body, category);
  // Head sits naturally balanced with chin slightly forward & occiput nicely over cervical spine!
  const headZCenter = neckProf.zOffset + 1.45 * lm.heightScale;

  const halfW = H * (isMen ? 0.35 : isKids ? 0.365 : 0.33);
  const frontR = H * (isMen ? 0.425 : 0.41);
  const backR = H * (isMen ? 0.46 : 0.45);

  const headGeo = buildTube(
    56,
    46,
    (theta, v) => {
      const phi = v * Math.PI;
      const sinP = Math.sin(phi);
      const y = yChin + H * (0.5 - 0.5 * Math.cos(phi));

      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const dCF = wrapAngleDiff(theta, Math.PI / 2);

      const jawTaper = lerp(isMen ? 0.64 : 0.54, 1.0, smoothstep(0.05, 0.46, v));
      const templeFull = 1.0 + 0.05 * gaussian(v - 0.64, 0.16);
      const rx = Math.max(0.05, halfW * sinP * jawTaper * templeFull);

      const isFront = sinT >= 0;
      let rzHere = isFront ? frontR : backR;
      if (isFront) {
        const chinForward = lerp(0.86, 1.0, smoothstep(0.05, 0.25, v));
        const foreheadRound = 1 - 0.06 * smoothstep(0.65, 0.92, v);
        rzHere *= chinForward * foreheadRound;
      } else {
        // Full smooth transition at lower back skull overlapping upper neck cleanly!
        const occiputTuck = lerp(0.58, 1.04, smoothstep(0.06, 0.5, v));
        rzHere *= occiputTuck;
      }
      const rz = Math.max(0.05, rzHere * sinP);

      const zShift =
        headZCenter +
        H * (0.04 * (1 - smoothstep(0.0, 0.45, v)) - 0.025 * smoothstep(0.55, 0.85, v));

      let x = rx * cosT;
      let z = rz * sinT + zShift;

      if (sinT > 0.05 && v > 0.03 && v < 0.82) {
        // 1. Jawline contour (men squarer jaw, women softer oval)
        const jawV = gaussian(v - 0.17, 0.085);
        const jawCorner =
          (isMen ? 0.68 : 0.24) *
          jawV *
          (gaussian(dCF - 0.92, 0.24) + gaussian(dCF + 0.92, 0.24));
        x += Math.sign(cosT) * jawCorner;

        // 2. Sculpted chin tip
        z += (isMen ? 0.5 : 0.34) * gaussian(v - 0.1, 0.045) * gaussian(dCF, 0.22);

        // 3. Subtle cheekbone lift
        const cheek =
          (isMen ? 0.3 : 0.42) *
          gaussian(v - 0.41, 0.08) *
          (gaussian(dCF - 0.56, 0.22) + gaussian(dCF + 0.56, 0.22));
        z += cheek * 0.72;
        x += Math.sign(cosT) * cheek * 0.42;

        // 4. Sleek minimalist nose bridge & tip
        const noseBridge =
          (isMen ? 0.88 : 0.7) *
          gaussian(dCF, 0.115) *
          smoothstep(0.28, 0.37, v) *
          (1 - smoothstep(0.49, 0.57, v));
        const noseTip =
          (isMen ? 0.58 : 0.5) * gaussian(dCF, 0.1) * gaussian(v - 0.36, 0.035);
        z += noseBridge + noseTip;

        // 5. Gentle brow ridge & soft eye-socket recess
        const eyeSocket =
          (isMen ? 0.46 : 0.34) *
          gaussian(v - 0.49, 0.045) *
          (gaussian(dCF - 0.34, 0.16) + gaussian(dCF + 0.34, 0.16));
        const browRidge =
          (isMen ? 0.44 : 0.2) * gaussian(v - 0.56, 0.038) * gaussian(dCF, 0.48);
        z += browRidge - eyeSocket;

        // 6. Soft subtle lip plane
        z += 0.24 * gaussian(v - 0.22, 0.032) * gaussian(dCF, 0.22);
      }

      return new THREE.Vector3(x, y, z);
    },
    false,
    false
  );

  // Subtle sculpted ears
  const parts: THREE.BufferGeometry[] = [headGeo];
  const earY = yChin + H * 0.46;
  const earZ = headZCenter - H * 0.05;
  const earX = halfW * 0.95;
  for (const side of [-1, 1] as const) {
    const ear = new THREE.SphereGeometry(1, 14, 12);
    ear.scale(H * 0.046, H * 0.12, H * 0.072);
    ear.rotateY(side * 0.22);
    ear.rotateZ(-side * 0.12);
    ear.translate(side * earX, earY, earZ);
    parts.push(ear);
  }

  return parts;
}

/**
 * SEAMLESS SCULPTED FULL ANATOMICAL ARM + CONTINUOUS WRIST-TO-PALM + 5-FINGER RELAXED HAND
 * Zero shoulder-step line! Zero wrist seam ring!
 */
function buildSculptedArmAndHand(
  body: BodyMeasurementStandard,
  category: MannequinCategory,
  side: -1 | 1
): THREE.BufferGeometry[] {
  const sk = getMannequinArmSkeleton(body, category, side);
  const hs = getMannequinLandmarks(body, category).heightScale;
  const isMen = category === "men";
  const totalArmLen = sk.upperLen + sk.forearmLen;

  const worldZ = new THREE.Vector3(0, 0, 1);
  const wristDir = sk.forearmDir.clone().normalize();
  const handX = new THREE.Vector3().crossVectors(worldZ, wristDir).normalize();
  const handZ = new THREE.Vector3().crossVectors(wristDir, handX).normalize();
  const palmInward = handX.clone().multiplyScalar(-side);

  const handScale = hs * (isMen ? 1.05 : category === "kids" ? 0.9 : 0.95);
  const palmLen = 8.4 * handScale;
  const palmWidthZ = (isMen ? 4.3 : 3.65) * handScale;
  const palmThickX = (isMen ? 1.5 : 1.24) * handScale;

  // ONE continuous seamless mesh from rounded deltoid cap -> bicep -> elbow -> forearm -> wrist -> sculpted palm!
  // Eliminates BOTH the shoulder step AND the dark wrist seam line!
  const capFrac = 0.2;
  const armEndFrac = 0.86;
  const armAndPalmGeo = buildTube(
    36,
    72,
    (theta, v) => {
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      if (v <= capFrac) {
        // SMOOTH ROUNDED ANATOMICAL DELTOID SHOULDER ARC (6.4 cm vertical curve nested smoothly into torso shoulder!)
        const s = v / capFrac;
        const domeAngle = s * Math.PI * 0.5;
        const radScale = Math.max(0.03, Math.sin(domeAngle));
        const dropT = 1 - Math.cos(domeAngle);

        const c = new THREE.Vector3(
          lerp(sk.shoulderOrigin.x, sk.deltoidOuter.x, Math.pow(s, 0.68)),
          lerp(sk.shoulderOrigin.y, sk.deltoidOuter.y, Math.pow(dropT, 0.92)),
          lerp(sk.shoulderOrigin.z, sk.deltoidOuter.z, s)
        );

        const eX0 = new THREE.Vector3().crossVectors(worldZ, sk.upperDir).normalize();
        const eZ0 = new THREE.Vector3().crossVectors(sk.upperDir, eX0).normalize();
        const tilt = smoothstep(0.1, 1.0, s);
        const axX = new THREE.Vector3(1, 0, 0).lerp(eX0, tilt).normalize();
        const axZ = new THREE.Vector3(0, 0, 1).lerp(eZ0, tilt).normalize();

        const r0 = sk.sampleRadiusAtDist(0);
        // Full rounded outer deltoid shoulder cap; medial side merges inside torso cavity cleanly!
        const isInner = side * cosT < 0;
        const innerScale = isInner ? lerp(0.75, 1.0, s) : 1.0;
        return c
          .addScaledVector(axX, r0.rx * radScale * innerScale * cosT)
          .addScaledVector(axZ, r0.rz * radScale * sinT);
      }

      if (v <= armEndFrac) {
        // UPPER ARM -> ELBOW -> FOREARM -> WRIST
        const u = (v - capFrac) / (armEndFrac - capFrac);
        const dist = u * totalArmLen;
        const center = sk.sampleCenterAtDist(dist);
        const tang = sk.sampleTangentAtDist(dist);
        const eX = new THREE.Vector3().crossVectors(worldZ, tang).normalize();
        const eZ = new THREE.Vector3().crossVectors(tang, eX).normalize();

        const { rx, rz } = sk.sampleRadiusAtDist(dist);
        const uUpper = dist / sk.upperLen;
        const bicepBump =
          uUpper > 0.12 && uUpper < 0.85
            ? (isMen ? 0.36 : 0.15) *
              Math.sin(((uUpper - 0.12) / 0.73) * Math.PI) *
              Math.max(0, sinT)
            : 0;
        const elbowBack =
          0.24 * gaussian(dist - sk.upperLen, 2.2 * hs) * Math.max(0, -sinT);

        return center
          .addScaledVector(eX, rx * cosT)
          .addScaledVector(eZ, (rz + bicepBump + elbowBack) * sinT);
      }

      // CONTINUOUS WRIST -> SCULPTED METACARPAL PALM (Zero wrist seam!)
      const pT = (v - armEndFrac) / (1 - armEndFrac);
      const s = pT * palmLen;
      const curlIn = 0.75 * handScale * pT * pT;
      const c = sk.wristPos
        .clone()
        .addScaledVector(wristDir, s)
        .addScaledVector(palmInward, curlIn);

      const bareWrist = sk.sampleRadiusAtDist(totalArmLen);
      const wZ =
        lerp(bareWrist.rz, palmWidthZ, smoothstep(0.0, 0.65, pT)) *
        (pT > 0.86 ? lerp(1.0, 0.86, (pT - 0.86) / 0.14) : 1.0);
      const tX =
        lerp(bareWrist.rx, palmThickX, smoothstep(0.0, 0.55, pT)) *
        (pT > 0.82 ? lerp(1.0, 0.66, (pT - 0.82) / 0.18) : 1.0);

      const sqBlend = smoothstep(0.05, 0.5, pT);
      const sqDen = Math.pow(
        Math.pow(Math.abs(cosT) + 1e-5, 2.4) + Math.pow(Math.abs(sinT) + 1e-5, 2.4),
        1 / 2.4
      );
      const sq = lerp(1.0, 1.0 / sqDen, sqBlend * 0.85);
      const thenar =
        0.5 * handScale * gaussian(pT - 0.35, 0.25) * Math.max(0, sinT) * Math.max(0, -side * cosT);

      return c
        .addScaledVector(handX, (tX * sq + thenar) * cosT)
        .addScaledVector(handZ, wZ * sq * sinT);
    },
    false,
    true,
    true
  );

  const parts: THREE.BufferGeometry[] = [armAndPalmGeo];

  const addFinger = (
    baseOrigin: THREE.Vector3,
    dir: THREE.Vector3,
    curlDir: THREE.Vector3,
    length: number,
    rBase: number,
    rTip: number,
    curlAmt: number
  ) => {
    const fDir = dir.clone().normalize();
    const fCurl = curlDir.clone().normalize();
    const fSide = new THREE.Vector3().crossVectors(fDir, fCurl).normalize();

    const geo = buildTube(
      12,
      14,
      (theta, v) => {
        const effV = Math.min(1, v / 0.88);
        const tipT = v > 0.88 ? (v - 0.88) / 0.12 : 0;
        const tipScale = tipT > 0 ? Math.max(0.04, Math.cos(tipT * Math.PI * 0.5)) : 1;

        const dist = effV * length + tipT * rTip * 0.9;
        const bend = curlAmt * Math.pow(effV, 1.85);
        const c = baseOrigin
          .clone()
          .addScaledVector(fDir, dist)
          .addScaledVector(fCurl, bend);

        const r = lerp(rBase, rTip, Math.pow(effV, 0.72)) * tipScale;
        return c
          .addScaledVector(fCurl, r * 0.94 * Math.cos(theta))
          .addScaledVector(fSide, r * 1.04 * Math.sin(theta));
      },
      true,
      false,
      true
    );
    parts.push(geo);
  };

  // 4 Relaxed Sculpted Fingers tucked cleanly into knuckle edge
  const knuckleBase = sk.wristPos
    .clone()
    .addScaledVector(wristDir, palmLen * 0.84)
    .addScaledVector(palmInward, 0.52 * handScale);

  const fingerSpecs = [
    { zFrac: 0.64, len: 7.4, r0: 0.88, r1: 0.54, curl: 1.4, splayZ: 0.03 },
    { zFrac: 0.21, len: 8.1, r0: 0.91, r1: 0.56, curl: 1.65, splayZ: 0.0 },
    { zFrac: -0.22, len: 7.5, r0: 0.86, r1: 0.52, curl: 1.85, splayZ: -0.02 },
    { zFrac: -0.64, len: 6.0, r0: 0.76, r1: 0.45, curl: 2.0, splayZ: -0.05 },
  ];
  for (const f of fingerSpecs) {
    const fOrigin = knuckleBase
      .clone()
      .addScaledVector(handZ, f.zFrac * palmWidthZ * 0.86);
    const fDir = wristDir
      .clone()
      .addScaledVector(palmInward, 0.14)
      .addScaledVector(handZ, f.splayZ)
      .normalize();
    addFinger(
      fOrigin,
      fDir,
      palmInward,
      f.len * handScale,
      f.r0 * handScale,
      f.r1 * handScale,
      f.curl * handScale
    );
  }

  // Opposable Sculpted Thumb
  const thumbOrigin = sk.wristPos
    .clone()
    .addScaledVector(wristDir, palmLen * 0.34)
    .addScaledVector(handZ, palmWidthZ * 0.66)
    .addScaledVector(palmInward, 0.42 * handScale);
  const thumbDir = wristDir
    .clone()
    .addScaledVector(handZ, 0.42)
    .addScaledVector(palmInward, 0.26)
    .normalize();
  addFinger(
    thumbOrigin,
    thumbDir,
    palmInward.clone().addScaledVector(handZ, -0.25).normalize(),
    5.4 * handScale,
    1.04 * handScale,
    0.64 * handScale,
    0.85 * handScale
  );

  return parts;
}

/**
 * SCULPTED ANATOMICAL LEGS & SEAMLESS BAREFOOT FEET (Standing Flat on Studio Floor y = 0!)
 * Graceful ankle taper, sculpted outer & inner gastrocnemius calves, delicate kneecap,
 * smooth thigh-to-pelvis blend, and ZERO dark ankle seam ring!
 */
function buildSculptedLegsAndFeet(
  body: BodyMeasurementStandard,
  category: MannequinCategory
): THREE.BufferGeometry[] {
  const lm = getMannequinLandmarks(body, category);
  const hs = lm.heightScale;
  const isWomen = category === "women";
  const isMen = category === "men";
  const isKids = category === "kids";

  const rThigh = body.thighCm / (2 * Math.PI);
  const rKnee = body.kneeCm / (2 * Math.PI);
  // Real sculpted human calf & slender ankle proportions (Women visibly more slender & sculpted!)
  const rCalf = rKnee * (isMen ? 1.05 : isWomen ? 0.96 : 0.94);
  const rAnkle = (isMen ? 3.4 : isKids ? 2.5 : 2.85) * Math.pow(body.kneeCm / 37, 0.65);

  const crotchProf = bodyBaseProfileAtY(lm.yCrotch + 1.5 * hs, body, category);
  const legTopX = Math.min(crotchProf.rx * 0.51, rThigh * 0.96);
  const legKneeX = legTopX * (isWomen ? 0.87 : 0.95);
  const legAnkleX = legTopX * (isWomen ? 0.92 : 1.0);

  const yLegTop = lm.yCrotch + 9.2 * hs;
  // Extend lower ankle smoothly INSIDE top of foot arch with capBottom = false (ZERO dark ankle crease!)
  const yAnkleBottom = lm.yAnkle * 0.35;
  const parts: THREE.BufferGeometry[] = [];

  for (const side of [-1, 1] as const) {
    const legGeo = buildTube(
      44,
      64,
      (theta, v) => {
        const y = lerp(yAnkleBottom, yLegTop, v);
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const isOuter = side * cosT > 0;

        let rx = rAnkle;
        let rz = rAnkle * 1.12;
        let cx = side * legAnkleX;
        let cz = crotchProf.zOffset;

        if (y >= lm.yKnee) {
          const t = clamp((y - lm.yKnee) / Math.max(1, yLegTop - lm.yKnee), 0, 1);
          const thighRad = lerp(rKnee * 0.92, rThigh * 0.98, Math.pow(t, 0.74));
          const quadFull = Math.sin(t * Math.PI) * (isMen ? 0.82 : 0.45) * Math.max(0, sinT);
          const hamFull =
            Math.sin(Math.pow(t, 0.8) * Math.PI) * (isWomen ? 0.72 : 0.55) * Math.max(0, -sinT);
          // Graceful outer thigh sweep on Women
          const outerHipSweep =
            isOuter && isWomen ? 0.55 * hs * Math.pow(t, 1.3) * Math.abs(cosT) : 0;
          const topTuck = v > 0.84 ? 1 - 0.25 * Math.pow((v - 0.84) / 0.16, 1.5) : 1;

          rx = (thighRad * (isWomen ? 0.96 : 0.99) + outerHipSweep) * topTuck;
          rz = (thighRad * 1.03 + quadFull + hamFull) * topTuck;
          cx = side * lerp(legKneeX, legTopX, smoothstep(0, 0.85, t));
          cz = crotchProf.zOffset + 0.45 * hs * Math.sin(t * Math.PI);
        } else if (y >= lm.yCalf) {
          const t = clamp((y - lm.yCalf) / Math.max(1, lm.yKnee - lm.yCalf), 0, 1);
          // Subtle anatomical pinch right below knee (t ≈ 0.78) makes calves look 3x more shapely!
          const subKneePinch = 1 - (isWomen ? 0.085 : 0.055) * gaussian(t - 0.76, 0.18);
          const base = lerp(rCalf, rKnee * 0.92, smoothstep(0, 1, t)) * subKneePinch;
          const patella = 0.45 * hs * gaussian(t - 0.94, 0.14) * Math.max(0, sinT);
          const kneeHollow = 0.48 * hs * gaussian(t - 0.95, 0.14) * Math.max(0, -sinT);
          const calfMuscle =
            (isMen ? 1.25 : 0.95) * hs * gaussian(t - 0.1, 0.34) * Math.max(0, -sinT);
          // Classic outer-calf curve slightly lower than inner calf!
          const lateralCalf =
            (isOuter ? 0.35 : 0.22) * hs * gaussian(t - (isOuter ? 0.18 : 0.06), 0.32) * Math.abs(cosT);

          rx = base * 0.94 + lateralCalf;
          rz = base * 1.02 + patella + calfMuscle - kneeHollow;
          cx = side * lerp(lerp(legAnkleX, legKneeX, 0.52), legKneeX, t);
          cz = crotchProf.zOffset - 0.75 * hs * (1 - t);
        } else {
          const t = clamp((y - yAnkleBottom) / Math.max(1, lm.yCalf - yAnkleBottom), 0, 1);
          // Concave graceful taper into narrow Achilles ankle!
          const curveT = Math.pow(smoothstep(0.08, 1, t), 0.76);
          const base = lerp(rAnkle, rCalf, curveT);
          const gastroBack =
            (isMen ? 1.32 : 1.0) * hs * Math.pow(curveT, 1.45) * Math.max(0, -sinT);
          const shinFront = 0.2 * hs * Math.max(0, sinT);

          rx = base * lerp(0.84, 0.94, curveT);
          rz = base * lerp(1.16, 1.02, curveT) + gastroBack + shinFront;
          cx = side * lerp(legAnkleX, lerp(legAnkleX, legKneeX, 0.52), curveT);
          cz = crotchProf.zOffset - 0.75 * hs * curveT;
        }

        return new THREE.Vector3(cx + rx * cosT, y, cz + rz * sinT);
      },
      false,
      true
    );
    parts.push(legGeo);

    // 2. Sculpted Barefoot Studio Foot Standing Flat on Floor (y = 0!)
    const footLen = (isMen ? 24.5 : isKids ? 19.0 : 21.8) * hs;
    const footHalfW = (isMen ? 4.4 : isKids ? 3.3 : 3.75) * hs;
    const heelBackZ = -5.0 * hs;
    const toeFrontZ = heelBackZ + footLen;
    const ankleY = lm.yAnkle * 1.04;
    const toeOutRad = side * (5.5 * Math.PI) / 180;
    const cosYaw = Math.cos(toeOutRad);
    const sinYaw = Math.sin(toeOutRad);
    const footPivotX = side * legAnkleX;
    const footPivotZ = crotchProf.zOffset;

    const footGeo = buildTube(
      28,
      26,
      (theta, v) => {
        const zLocal = lerp(heelBackZ, toeFrontZ, v);
        const heelCap = v < 0.08 ? Math.max(0.06, Math.sin((v / 0.08) * Math.PI * 0.5)) : 1;
        const toeCap = v > 0.88 ? Math.max(0.05, Math.cos(((v - 0.88) / 0.12) * Math.PI * 0.5)) : 1;
        const capScale = heelCap * toeCap;

        const wProfile =
          v < 0.35
            ? lerp(0.68, 0.78, v / 0.35)
            : v < 0.74
              ? lerp(0.78, 1.03, smoothstep(0.35, 0.74, v))
              : lerp(1.03, 0.8, smoothstep(0.74, 0.94, v));
        const halfW = footHalfW * wProfile * capScale;

        const hTop =
          (v < 0.24
            ? lerp(ankleY * 0.5, ankleY * 1.12, smoothstep(0, 0.24, v))
            : lerp(ankleY * 1.12, 2.25 * hs, Math.pow((v - 0.24) / 0.76, 0.68))) *
          (v > 0.88 ? Math.max(0.18, toeCap) : v < 0.08 ? Math.max(0.28, heelCap) : 1);

        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const isInner = side * cosT < 0;
        const archLift =
          isInner && sinT < 0
            ? 0.95 * hs * Math.sin(clamp((v - 0.24) / 0.42, 0, 1) * Math.PI) * Math.abs(sinT) * Math.abs(cosT)
            : 0;
        const medialShift = -side * footHalfW * 0.12 * smoothstep(0.45, 0.95, v);

        const xLocal = medialShift + halfW * cosT;
        let yLocal = 0;
        if (sinT >= 0) {
          const midY = hTop * 0.34;
          yLocal = midY + (hTop - midY) * Math.pow(sinT, 0.78);
        } else {
          const midY = hTop * 0.34;
          const flatBottom = 0.06 + archLift;
          yLocal = lerp(midY, flatBottom, Math.pow(-sinT, 0.42));
        }

        const xr = footPivotX + xLocal * cosYaw + zLocal * sinYaw;
        const zr = footPivotZ - xLocal * sinYaw + zLocal * cosYaw;
        return new THREE.Vector3(xr, yLocal, zr);
      },
      true,
      true,
      true
    );
    parts.push(footGeo);
  }

  return parts;
}

export interface RealisticMannequinResult {
  bodyGeometry: THREE.BufferGeometry;
  plinthGeometry: THREE.BufferGeometry;
  bodySpec: BodyMeasurementStandard;
  landmarks: MannequinLandmarks;
}

/**
 * BUILD COMPLETE STUDIO-GRADE REALISTIC FULL-BODY HUMAN MANNEQUIN
 */
export function buildRealisticMannequin(
  category: MannequinCategory = "women",
  sizeCode = "M"
): RealisticMannequinResult {
  const body = getMannequinBodySpec(category, sizeCode);
  const lm = getMannequinLandmarks(body, category);

  // 1. High-res Sculpted Torso + Neck (rounded pelvic saddle at bottom -> seamlessly tucked inside skull at top!)
  const yTorsoBot = lm.yCrotch - 2.0 * lm.heightScale;
  const yTorsoTop = lm.yChin + 4.8 * lm.heightScale;
  const torsoGeo = buildTube(
    96,
    104,
    (theta, v) => {
      const y = lerp(yTorsoBot, yTorsoTop, v);
      const s = mannequinSurfaceAt(y, theta, body, category);
      return new THREE.Vector3(s.x, y, s.z);
    },
    true,
    false
  );

  // 2. Sculpted Studio Head + Ears
  const headParts = buildSculptedHead(body, category);

  // 3. Seamless Articulated Left & Right Arms + Continuous Palm + 5-Finger Hands
  const leftArmParts = buildSculptedArmAndHand(body, category, -1);
  const rightArmParts = buildSculptedArmAndHand(body, category, 1);

  // 4. Sculpted Anatomical Legs + Grounded Barefoot Feet
  const legAndFootParts = buildSculptedLegsAndFeet(body, category);

  const bodyGeometry = mergeGeos([
    torsoGeo,
    ...headParts,
    ...leftArmParts,
    ...rightArmParts,
    ...legAndFootParts,
  ]);

  // 5. Minimalist Low-Profile Circular Display Plinth under soles of feet
  const plinthPts = [
    new THREE.Vector2(0.01, -1.2),
    new THREE.Vector2(26.5, -1.2),
    new THREE.Vector2(26.5, -0.35),
    new THREE.Vector2(25.6, 0.04),
    new THREE.Vector2(0.01, 0.04),
  ];
  const plinthGeometry = new THREE.LatheGeometry(plinthPts, 64);
  plinthGeometry.translate(0, 0, 3.0);

  return {
    bodyGeometry,
    plinthGeometry,
    bodySpec: body,
    landmarks: lm,
  };
}
