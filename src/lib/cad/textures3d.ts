import * as THREE from "three";

/**
 * Procedural Canvas Textures for Fashion CAD 3D Studio (Zero external assets, instant sync).
 * Generates crisp diffuse maps + micro-weave bump maps for:
 * - Tailor's Fitting Mannequin (Cream Linen + Princess/CF/CB seams)
 * - 3x1 Diagonal Twill Stone-Wash Denim (WV1499LSB-TD SH3790)
 * - Polyester Cotton Fleece & 1x1 Striped Rib Knit (89865 Bomber)
 * - Pique Honeycomb Knit with Razor-Sharp Diagonal 4-Colorblock (HAZE026 Polo)
 * - Woven Twill / Linen / Satin Fabric (Flared Circle Skirt)
 */

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  return [canvas, ctx];
}

function toTexture(
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
  isColor = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const n = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shadeRgb(
  rgb: [number, number, number],
  delta: number
): string {
  const r = Math.min(255, Math.max(0, Math.round(rgb[0] + delta)));
  const g = Math.min(255, Math.max(0, Math.round(rgb[1] + delta)));
  const b = Math.min(255, Math.max(0, Math.round(rgb[2] + delta)));
  return `rgb(${r},${g},${b})`;
}

/** Deterministic fast hash noise (no Math.random flicker between renders) */
function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * 1. Professional Atelier Fitting Mannequin Linen Texture (Alvanon / Stockman style)
 */
export function createMannequinLinenTextures(): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const [c, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = "#ECE6DC";
  ctx.fillRect(0, 0, 512, 512);

  // Subtle woven linen crosshatch
  for (let y = 0; y < 512; y += 2) {
    const tone = (y % 4 === 0 ? 5 : -4) + (hash2(1, y) - 0.5) * 6;
    ctx.fillStyle = shadeRgb([236, 230, 220], tone);
    ctx.fillRect(0, y, 512, 1);
  }
  for (let x = 0; x < 512; x += 2) {
    ctx.fillStyle = x % 4 === 0 ? "rgba(255,255,255,0.16)" : "rgba(120,108,92,0.08)";
    ctx.fillRect(x, 0, 1, 512);
  }

  // Subtle tailor's black cotton tape lines (CF, CB, Side Seams, Natural Waistline)
  ctx.strokeStyle = "rgba(82, 74, 65, 0.24)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  for (const xPos of [0, 128, 256, 384]) {
    ctx.beginPath();
    ctx.moveTo(xPos, 0);
    ctx.lineTo(xPos, 512);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const [bCanvas, bCtx] = makeCanvas(256, 256);
  bCtx.fillStyle = "#808080";
  bCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    bCtx.fillStyle = y % 4 === 0 ? "#969696" : "#6c6c6c";
    bCtx.fillRect(0, y, 256, 1);
  }
  for (let x = 0; x < 256; x += 2) {
    bCtx.fillStyle = x % 4 === 0 ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.18)";
    bCtx.fillRect(x, 0, 1, 256);
  }

  return {
    map: toTexture(c, 1, 1, true),
    bumpMap: toTexture(bCanvas, 6, 6, false),
  };
}

/**
 * 2. Authentic Seamless 3x1 Diagonal Twill Indigo Denim Texture (WV1499LSB-TD SH3790)
 * Strictly tileable (ZERO repeating radial circles or loud vertical pinstripes!)
 */
export function createDenimTextures(baseHex: string): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const rgb = hexToRgb(baseHex);
  const [c, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  // Fine organic cotton indigo yarn variation (subtle, tileable, realistic denim grain)
  for (let y = 0; y < 512; y += 2) {
    for (let x = 0; x < 512; x += 2) {
      const n = (hash2(x % 256, y % 256) - 0.5) * 10;
      const diag = ((x + y) % 8 === 0) ? 7 : ((x + y) % 8 === 4 ? -6 : 0);
      ctx.fillStyle = shadeRgb(rgb, n + diag);
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // Crisp subtle 45-degree white weft flecks (classic woven denim look)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.065)";
  ctx.lineWidth = 1;
  for (let i = -512; i < 1024; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 512, 512);
    ctx.stroke();
  }

  // Seamless 3x1 diagonal twill bump map
  const [bCanvas, bCtx] = makeCanvas(256, 256);
  bCtx.fillStyle = "#808080";
  bCtx.fillRect(0, 0, 256, 256);
  bCtx.strokeStyle = "#9C9C9C";
  bCtx.lineWidth = 1.2;
  for (let i = -256; i < 512; i += 4) {
    bCtx.beginPath();
    bCtx.moveTo(i, 0);
    bCtx.lineTo(i + 256, 256);
    bCtx.stroke();
  }
  bCtx.strokeStyle = "#646464";
  for (let i = -256; i < 512; i += 4) {
    bCtx.beginPath();
    bCtx.moveTo(i + 2, 0);
    bCtx.lineTo(i + 258, 256);
    bCtx.stroke();
  }

  return {
    map: toTexture(c, 3, 5, true),
    bumpMap: toTexture(bCanvas, 8, 14, false),
  };
}

/**
 * 3. Soft Brushed Polyester Cotton Fleece Texture (Style 89865 Bomber)
 */
export function createFleeceTextures(baseHex: string): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const rgb = hexToRgb(baseHex);
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  // Fine jersey/fleece knit wales + micro-heather nap
  for (let y = 0; y < 256; y += 2) {
    for (let x = 0; x < 256; x += 2) {
      const n = (hash2(x, y) - 0.5) * 14 + (x % 4 === 0 ? 3 : -3);
      ctx.fillStyle = shadeRgb(rgb, n);
      ctx.fillRect(x, y, 2, 2);
    }
  }

  const [bCanvas, bCtx] = makeCanvas(128, 128);
  for (let y = 0; y < 128; y += 2) {
    for (let x = 0; x < 128; x += 2) {
      const v = Math.round(128 + (hash2(x, y) - 0.5) * 48 + (x % 4 === 0 ? 10 : -10));
      bCtx.fillStyle = `rgb(${v},${v},${v})`;
      bCtx.fillRect(x, y, 2, 2);
    }
  }

  return {
    map: toTexture(c, 5, 5, true),
    bumpMap: toTexture(bCanvas, 10, 10, false),
  };
}

/**
 * 4. Authentic 1x1 Vertical Rib Knit Texture with 2 Crisp Gold Stripes (89865 Collar/Basque/Cuffs)
 * UV convention: u = around circumference, v = 0 (bottom edge) to 1 (top edge)
 */
export function createStripedRibTextures(
  baseHex: string,
  stripeHex = "#EAB308",
  withStripes = true
): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const rgb = hexToRgb(baseHex);
  const sRgb = hexToRgb(stripeHex);
  const [c, ctx] = makeCanvas(512, 256);

  // Draw crisp 1x1 vertical rib wales across all 512px width
  for (let x = 0; x < 512; x++) {
    const wave = Math.sin((x / 512) * Math.PI * 2 * 64); // 64 ribs around band
    const shade = wave * 16;
    ctx.fillStyle = shadeRgb(rgb, shade);
    ctx.fillRect(x, 0, 1, 256);
  }

  // Paint 2 authentic horizontal Gold knit stripes (preserving 1x1 vertical rib texture inside stripes!)
  if (withStripes) {
    const stripeBands: Array<[number, number]> = [
      [Math.round(256 * 0.28), Math.round(256 * 0.40)],
      [Math.round(256 * 0.56), Math.round(256 * 0.68)],
    ];
    for (const [y0, y1] of stripeBands) {
      for (let x = 0; x < 512; x++) {
        const wave = Math.sin((x / 512) * Math.PI * 2 * 64);
        ctx.fillStyle = shadeRgb(sRgb, wave * 20);
        ctx.fillRect(x, y0, 1, y1 - y0);
      }
    }
  }

  // Matching vertical 1x1 rib bump map
  const [bCanvas, bCtx] = makeCanvas(512, 64);
  for (let x = 0; x < 512; x++) {
    const wave = Math.sin((x / 512) * Math.PI * 2 * 64);
    const v = Math.round(128 + wave * 68);
    bCtx.fillStyle = `rgb(${v},${v},${v})`;
    bCtx.fillRect(x, 0, 1, 64);
  }

  return {
    map: toTexture(c, 1, 1, true),
    bumpMap: toTexture(bCanvas, 1, 1, false),
  };
}

/**
 * 5. High-Resolution 1024x1024 Continuous Torso Texture for Style HAZE026-028 Colorblock Polo!
 * UV mapping on continuous torso tube:
 * - theta = u * 2*PI:
 *   - u = 0.00 -> +X (Viewer Right / Wearer Left side seam)
 *   - u = 0.25 -> +Z (Center Front / Placket!)
 *   - u = 0.50 -> -X (Viewer Left / Wearer Right side seam)
 *   - u = 0.75 -> -Z (Center Back!)
 * - v = 0 (Bottom Hem) -> v = 1 (Neck/Shoulder top)
 *
 * Notice how painting the 4 diagonal blocks on ONE continuous UV-mapped torso gives
 * RAZOR-SHARP anti-aliased diagonal seams + subtle stitched shadow + 100% smooth 3D normals!
 */
export function createPoloColorblockTextures(params: {
  mainHex: string;
  diagonalColorblock: boolean;
  stripeWidthRatio: number; // fraction of torso height (~0.075)
  placketWidthRatio: number; // fraction of torso circumference (~0.028)
  placketLengthRatio: number; // fraction of torso height (~0.24)
}): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const W = 1024;
  const H = 1024;
  const [c, ctx] = makeCanvas(W, H);
  const mainRgb = hexToRgb(params.mainHex);

  // Fill entire shirt with Main Fabric (LA65V Dark Bottle)
  ctx.fillStyle = params.mainHex;
  ctx.fillRect(0, 0, W, H);

  if (params.diagonalColorblock) {
    // Front half corresponds to u in [0.0, 0.5] -> x in [0, W/2]
    // Canvas Y=0 is TOP (v=1, Neck/Shoulders), Canvas Y=H is BOTTOM (v=0, Hem)!
    const frontW = W / 2;
    const yAtViewerLeft = H * 0.36; // starts cleanly right at left underarm
    const yAtViewerRight = H * 0.55; // slopes diagonally down toward right waist
    const bandPx = Math.max(38, Math.min(105, params.stripeWidthRatio * H * 1.15));

    const y1 = (x: number) =>
      yAtViewerRight + ((yAtViewerLeft - yAtViewerRight) * x) / frontW;

    // 1. FRT-1: Crisp LA65V White (upper front from neckline down to y1)
    ctx.fillStyle = "#F5F7FA";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(frontW, 0);
    ctx.lineTo(frontW, y1(frontW));
    ctx.lineTo(0, y1(0));
    ctx.closePath();
    ctx.fill();

    // 2. FRT-2: LA65V Black diagonal chest band
    ctx.fillStyle = "#16181D";
    ctx.beginPath();
    ctx.moveTo(0, y1(0));
    ctx.lineTo(frontW, y1(frontW));
    ctx.lineTo(frontW, y1(frontW) + bandPx);
    ctx.lineTo(0, y1(0) + bandPx);
    ctx.closePath();
    ctx.fill();

    // 3. FRT-3: JC50 Silver 1102 diagonal contrast trim band (distinct cool silver vs white!)
    ctx.fillStyle = "#B8C2CC";
    ctx.beginPath();
    ctx.moveTo(0, y1(0) + bandPx);
    ctx.lineTo(frontW, y1(frontW) + bandPx);
    ctx.lineTo(frontW, y1(frontW) + bandPx * 2);
    ctx.lineTo(0, y1(0) + bandPx * 2);
    ctx.closePath();
    ctx.fill();

    // Subtle realistic stitched seam shading along all 3 diagonal joins
    for (const off of [0, bandPx, bandPx * 2]) {
      ctx.strokeStyle = "rgba(15, 23, 42, 0.28)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, y1(0) + off);
      ctx.lineTo(frontW, y1(frontW) + off);
      ctx.stroke();

      // Fine topstitch dashes just above each diagonal seam
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y1(0) + off - 3);
      ctx.lineTo(frontW, y1(frontW) + off - 3);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Side seam subtle shading at u = 0 (x=0, x=W) and u = 0.5 (x=W/2)
  for (const sx of [0, W / 2, W]) {
    ctx.strokeStyle = "rgba(15, 23, 42, 0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, H);
    ctx.stroke();
  }

  // Twin-needle coverstitch hem near bottom (v ≈ 0.03 -> y ≈ H * 0.97)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1.3;
  ctx.setLineDash([5, 4]);
  for (const hy of [H * 0.962, H * 0.969]) {
    ctx.beginPath();
    ctx.moveTo(0, hy);
    ctx.lineTo(W, hy);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Fine cotton piqué honeycomb micro-texture overlaid softly across entire shirt
  ctx.fillStyle = "rgba(0, 0, 0, 0.032)";
  for (let y = 0; y < H; y += 4) {
    const xOff = (y % 8 === 0) ? 0 : 2;
    for (let x = xOff; x < W; x += 4) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // Subtle shoulder/neck seam highlight near top
  void mainRgb;

  // Fine piqué knit bump map
  const [bCanvas, bCtx] = makeCanvas(128, 128);
  bCtx.fillStyle = "#808080";
  bCtx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 4) {
    const xOff = y % 8 === 0 ? 0 : 2;
    for (let x = xOff; x < 128; x += 4) {
      bCtx.fillStyle = "#A2A2A2";
      bCtx.fillRect(x, y, 2, 2);
      bCtx.fillStyle = "#626262";
      bCtx.fillRect((x + 2) % 128, y, 2, 2);
    }
  }

  const mapTex = toTexture(c, 1, 1, true);
  mapTex.wrapS = THREE.RepeatWrapping;
  mapTex.wrapT = THREE.ClampToEdgeWrapping;

  return {
    map: mapTex,
    bumpMap: toTexture(bCanvas, 16, 16, false),
  };
}

/**
 * 6. Fine Piqué / Woven Cloth Micro-Weave Texture (for Polo Sleeves/Collar & Circle Skirt)
 */
export function createWovenClothTextures(baseHex: string, isPique = false): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const rgb = hexToRgb(baseHex);
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  if (isPique) {
    for (let y = 0; y < 256; y += 4) {
      const xOff = y % 8 === 0 ? 0 : 2;
      for (let x = xOff; x < 256; x += 4) {
        ctx.fillStyle = shadeRgb(rgb, 6);
        ctx.fillRect(x, y, 2, 2);
        ctx.fillStyle = shadeRgb(rgb, -7);
        ctx.fillRect((x + 2) % 256, y, 2, 2);
      }
    }
  } else {
    for (let y = 0; y < 256; y += 2) {
      ctx.fillStyle = shadeRgb(rgb, y % 4 === 0 ? 4 : -4);
      ctx.fillRect(0, y, 256, 1);
    }
    for (let x = 0; x < 256; x += 2) {
      ctx.fillStyle = x % 4 === 0 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
      ctx.fillRect(x, 0, 1, 256);
    }
  }

  const [bCanvas, bCtx] = makeCanvas(128, 128);
  bCtx.fillStyle = "#808080";
  bCtx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) {
    bCtx.fillStyle = y % 4 === 0 ? "#949494" : "#6C6C6C";
    bCtx.fillRect(0, y, 128, 1);
  }
  for (let x = 0; x < 128; x += 2) {
    bCtx.fillStyle = x % 4 === 0 ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.16)";
    bCtx.fillRect(x, 0, 1, 128);
  }

  return {
    map: toTexture(c, 5, 5, true),
    bumpMap: toTexture(bCanvas, 12, 12, false),
  };
}
