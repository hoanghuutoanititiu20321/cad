"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  Camera,
  Eye,
  Grid3X3,
  RefreshCw,
  RotateCw,
  Scissors,
  User,
} from "lucide-react";
import {
  MANNEQUIN_STANDARD_GROUPS,
  type MannequinCategory,
} from "@/lib/cad/bodyStandards";
import {
  buildBaggyJean3D,
  buildBomberJacket3D,
  buildCircleSkirt3D,
  buildColorblockPolo3D,
  buildMannequinGeometries,
  FABRIC_PRESETS,
} from "@/lib/cad/drape3d";
import {
  createDenimTextures,
  createFleeceTextures,
  createMannequinLinenTextures,
  createPoloColorblockTextures,
  createStripedRibTextures,
  createWovenClothTextures,
} from "@/lib/cad/textures3d";
import type { NestedGradingResult, SizeCode } from "@/lib/cad/types";
import { SIZE_DEFINITIONS } from "@/templates/circle-skirt/grading";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface GarmentViewer3DProps {
  templateId: string;
  grading: NestedGradingResult;
  activeBaseSize: SizeCode;
}

type CameraPreset = "front" | "three-quarter" | "side" | "back";

export function GarmentViewer3D({
  templateId,
  grading,
  activeBaseSize,
}: GarmentViewer3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  const isJean = templateId === "baggy-jean";
  const isBomber = templateId === "bomber-jacket";
  const isPolo = templateId === "colorblock-polo";
  const isTopGarment = isBomber || isPolo;
  const [previewSize, setPreviewSize] = useState<SizeCode>(activeBaseSize);
  const [mannequinCategory, setMannequinCategory] =
    useState<MannequinCategory>("women");
  const [fabricByTemplate, setFabricByTemplate] = useState<Record<string, string>>({
    "circle-skirt": "indigo-cotton",
    "baggy-jean": "sh3790-mstone",
    "bomber-jacket": "maroon-fleece",
    "colorblock-polo": "haze026-bottle",
  });
  const [showMannequin, setShowMannequin] = useState(true);
  const [showSeams, setShowSeams] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);

  const threeRefs = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    mannequinGroup: THREE.Group;
    torsoMesh: THREE.Mesh;
    neckCapMesh: THREE.Mesh;
    poleMesh: THREE.Mesh;
    baseMesh: THREE.Mesh;
    primaryMesh: THREE.Mesh;
    waistbandMesh: THREE.Mesh;
    extraPartsGroup: THREE.Group;
    seamLines: THREE.LineSegments;
    seamMat: THREE.LineBasicMaterial;
    hardwareMesh: THREE.Mesh;
    clothMaterial: THREE.MeshPhysicalMaterial;
    wbMaterial: THREE.MeshPhysicalMaterial;
  } | null>(null);

  const availableFabrics = useMemo(() => {
    const cat = isJean
      ? "denim"
      : isBomber
        ? "fleece"
        : isPolo
          ? "polo"
          : "general";
    return FABRIC_PRESETS.filter((f) => f.category === cat);
  }, [isBomber, isJean, isPolo]);

  const activeFabricId =
    fabricByTemplate[templateId] ?? availableFabrics[0].id;
  const selectedFabric = useMemo(
    () =>
      availableFabrics.find((f) => f.id === activeFabricId) ??
      availableFabrics[0],
    [activeFabricId, availableFabrics]
  );

  const sizeEntry = useMemo(
    () =>
      grading.entries.find((e) => e.size === previewSize) ??
      grading.entries.find((e) => e.size === activeBaseSize) ??
      grading.entries[0],
    [activeBaseSize, grading.entries, previewSize]
  );

  // Initialize Three.js Studio Scene once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = Math.max(240, container.clientWidth);
    const height = Math.max(240, container.clientHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#F8FAFC");

    const camera = new THREE.PerspectiveCamera(36, width / height, 2, 950);
    camera.position.set(118, 102, 205);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.target.set(0, 74, 0);
    controls.minDistance = 75;
    controls.maxDistance = 420;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.update();

    // Soft Fashion Atelier IBL Studio Environment (balanced so dark Maroon/Bottle fabrics stay deep & rich!)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.2;

    // 3-Point Fashion Studio Lighting
    const hemiLight = new THREE.HemisphereLight("#FFFFFF", "#CBD5E1", 0.78);
    hemiLight.position.set(0, 240, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight("#FFFDF9", 1.15);
    keyLight.position.set(105, 220, 155);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 40;
    keyLight.shadow.camera.far = 450;
    keyLight.shadow.camera.left = -100;
    keyLight.shadow.camera.right = 100;
    keyLight.shadow.camera.top = 175;
    keyLight.shadow.camera.bottom = -15;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight("#E0E7FF", 0.52);
    rimLight.position.set(-115, 155, -135);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight("#FFFFFF", 0.36);
    fillLight.position.set(-85, 85, 115);
    scene.add(fillLight);

    // Studio Floor
    const floorGeo = new THREE.CircleGeometry(135, 64);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: "#F1F5F9",
      roughness: 0.96,
      metalness: 0.0,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const gridHelper = new THREE.GridHelper(210, 21, "#CBD5E1", "#E2E8F0");
    gridHelper.position.y = 0.12;
    scene.add(gridHelper);

    // Sculpted Atelier Tailor Mannequin Group (Linen Canvas + Walnut Neck Finial + Brushed Steel Stand)
    const mannequinGroup = new THREE.Group();
    const linenTex = createMannequinLinenTextures();
    const linenFormMat = new THREE.MeshStandardMaterial({
      color: "#FFFFFF",
      map: linenTex.map,
      bumpMap: linenTex.bumpMap,
      bumpScale: 0.22,
      roughness: 0.9,
      metalness: 0.01,
      side: THREE.DoubleSide,
    });
    const walnutWoodMat = new THREE.MeshStandardMaterial({
      color: "#6B4423",
      roughness: 0.42,
      metalness: 0.08,
    });
    const standMetalMat = new THREE.MeshStandardMaterial({
      color: "#334155",
      roughness: 0.32,
      metalness: 0.78,
    });

    const torsoMesh = new THREE.Mesh(new THREE.BufferGeometry(), linenFormMat);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;

    const neckCapMesh = new THREE.Mesh(new THREE.BufferGeometry(), walnutWoodMat);
    neckCapMesh.castShadow = true;

    const poleMesh = new THREE.Mesh(new THREE.BufferGeometry(), standMetalMat);
    poleMesh.castShadow = true;

    const baseMesh = new THREE.Mesh(new THREE.BufferGeometry(), standMetalMat);
    baseMesh.receiveShadow = true;

    mannequinGroup.add(torsoMesh, neckCapMesh, poleMesh, baseMesh);
    scene.add(mannequinGroup);

    // Cloth Physical Materials (Deep Matte Natural Fabric Sheen + Bump Map Ready!)
    const clothMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#FFFFFF"),
      roughness: 0.88,
      metalness: 0.01,
      sheen: 0.18,
      sheenRoughness: 0.85,
      sheenColor: new THREE.Color("#FFFFFF"),
      bumpScale: 0.32,
      side: THREE.DoubleSide,
    });
    const wbMaterial = clothMaterial.clone();

    const primaryMesh = new THREE.Mesh(new THREE.BufferGeometry(), clothMaterial);
    primaryMesh.castShadow = true;
    primaryMesh.receiveShadow = true;
    scene.add(primaryMesh);

    const waistbandMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      wbMaterial
    );
    waistbandMesh.castShadow = true;
    waistbandMesh.receiveShadow = true;
    scene.add(waistbandMesh);

    const extraPartsGroup = new THREE.Group();
    scene.add(extraPartsGroup);

    // Topstitching / Seam Overlay
    const seamMat = new THREE.LineBasicMaterial({
      color: "#F8FAFC",
      transparent: true,
      opacity: 0.88,
    });
    const seamLines = new THREE.LineSegments(new THREE.BufferGeometry(), seamMat);
    scene.add(seamLines);

    // Antique Copper Button / Brass Rivets / Zipper Stop Hardware
    const hwMat = new THREE.MeshStandardMaterial({
      color: "#B45309",
      roughness: 0.28,
      metalness: 0.88,
    });
    const hardwareMesh = new THREE.Mesh(new THREE.BufferGeometry(), hwMat);
    scene.add(hardwareMesh);

    threeRefs.current = {
      renderer,
      scene,
      camera,
      controls,
      mannequinGroup,
      torsoMesh,
      neckCapMesh,
      poleMesh,
      baseMesh,
      primaryMesh,
      waistbandMesh,
      extraPartsGroup,
      seamLines,
      seamMat,
      hardwareMesh,
      clothMaterial,
      wbMaterial,
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(200, Math.floor(entry.contentRect.width));
        const h = Math.max(200, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      while (extraPartsGroup.children.length > 0) {
        const child = extraPartsGroup.children[0] as THREE.Mesh;
        extraPartsGroup.remove(child);
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      controls.dispose();
      renderer.dispose();
      envRT.dispose();
      pmremGenerator.dispose();
      linenTex.map.dispose();
      linenTex.bumpMap.dispose();
      linenFormMat.dispose();
      walnutWoodMat.dispose();
      standMetalMat.dispose();
      clothMaterial.map?.dispose();
      clothMaterial.bumpMap?.dispose();
      clothMaterial.dispose();
      wbMaterial.map?.dispose();
      wbMaterial.bumpMap?.dispose();
      wbMaterial.dispose();
      seamMat.dispose();
      hwMat.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      threeRefs.current = null;
    };
  }, []);

  // Rebuild 3D Mannequin (from Excel Standard!) & Garment whenever template, params, size, or mannequin category changes
  const drapeData = useMemo(() => {
    const mannequin = buildMannequinGeometries(
      isTopGarment ? 72 : sizeEntry.measurements.waistCm,
      mannequinCategory,
      sizeEntry.size,
      true
    );
    const garment = isJean
      ? buildBaggyJean3D(
          sizeEntry.params,
          selectedFabric.stiffness,
          mannequinCategory,
          sizeEntry.size
        )
      : isBomber
        ? buildBomberJacket3D(
            sizeEntry.params,
            selectedFabric.stiffness,
            mannequinCategory,
            sizeEntry.size
          )
        : isPolo
          ? buildColorblockPolo3D(
              sizeEntry.params,
              selectedFabric.stiffness,
              mannequinCategory,
              sizeEntry.size
            )
          : buildCircleSkirt3D(
              sizeEntry.params,
              selectedFabric.stiffness,
              mannequinCategory,
              sizeEntry.size
            );
    return { mannequin, garment };
  }, [isBomber, isJean, isPolo, isTopGarment, mannequinCategory, selectedFabric.stiffness, sizeEntry]);

  useEffect(() => {
    const ctx = threeRefs.current;
    if (!ctx) return;

    const { mannequin, garment } = drapeData;

    ctx.torsoMesh.geometry.dispose();
    ctx.torsoMesh.geometry = mannequin.torsoGeometry;

    ctx.neckCapMesh.geometry.dispose();
    ctx.neckCapMesh.geometry = mannequin.neckCapGeometry;

    ctx.poleMesh.geometry.dispose();
    ctx.poleMesh.geometry = mannequin.poleGeometry;

    ctx.baseMesh.geometry.dispose();
    ctx.baseMesh.geometry = mannequin.baseGeometry;

    ctx.primaryMesh.geometry.dispose();
    ctx.primaryMesh.geometry = garment.primaryGeometry;

    ctx.waistbandMesh.geometry.dispose();
    ctx.waistbandMesh.geometry = garment.waistbandGeometry;

    // Clear & rebuild multi-color extra parts (Bomber Gold Stripes, Polo White/Black/Silver blocks)
    while (ctx.extraPartsGroup.children.length > 0) {
      const child = ctx.extraPartsGroup.children[0] as THREE.Mesh;
      ctx.extraPartsGroup.remove(child);
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
    }
    if (garment.extraParts) {
      for (const ep of garment.extraParts) {
        const mat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(ep.color),
          roughness: ep.roughness ?? 0.8,
          metalness: ep.metalness ?? 0.03,
          sheen: 0.35,
          sheenRoughness: 0.7,
          sheenColor: new THREE.Color("#FFFFFF"),
          wireframe,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(ep.geometry, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        ctx.extraPartsGroup.add(mesh);
      }
    }

    ctx.seamLines.geometry.dispose();
    ctx.seamLines.geometry = garment.seamLinesGeometry;

    ctx.hardwareMesh.geometry.dispose();
    if (garment.hardwareGeometry) {
      ctx.hardwareMesh.geometry = garment.hardwareGeometry;
      ctx.hardwareMesh.visible = showSeams;
    } else {
      ctx.hardwareMesh.geometry = new THREE.BufferGeometry();
      ctx.hardwareMesh.visible = false;
    }

    // Center camera smoothly on upper-body vs lower-body garment
    const targetY = isTopGarment ? 112 : isJean ? 68 : 82;
    ctx.controls.target.set(0, targetY, 0);
    ctx.controls.update();
  }, [drapeData, isJean, isTopGarment, showSeams, wireframe]);

  useEffect(() => {
    const ctx = threeRefs.current;
    if (!ctx) return;

    const { garment } = drapeData;
    const pKind = garment.primaryTextureKind ?? "woven";
    const wbKind = garment.waistbandTextureKind ?? "woven";

    // Dispose old procedural cloth textures cleanly before assigning new ones
    ctx.clothMaterial.map?.dispose();
    ctx.clothMaterial.bumpMap?.dispose();
    ctx.wbMaterial.map?.dispose();
    ctx.wbMaterial.bumpMap?.dispose();

    // Primary fabric texture (Denim Twill, Brushed Fleece, 1024px Diagonal Colorblock Polo, or Woven Skirt)
    const primaryTex =
      pKind === "denim"
        ? createDenimTextures(selectedFabric.color)
        : pKind === "fleece"
          ? createFleeceTextures(selectedFabric.color)
          : pKind === "polo-torso"
            ? createPoloColorblockTextures({
                mainHex: selectedFabric.color,
                diagonalColorblock: Boolean(garment.textureParams?.diagonalColorblock ?? true),
                stripeWidthRatio: Number(garment.textureParams?.stripeWidthRatio ?? 0.075),
                placketWidthRatio: Number(garment.textureParams?.placketWidthRatio ?? 0.028),
                placketLengthRatio: Number(garment.textureParams?.placketLengthRatio ?? 0.24),
              })
            : createWovenClothTextures(selectedFabric.color, pKind === "polo-solid");

    ctx.clothMaterial.color.set("#FFFFFF");
    ctx.clothMaterial.map = primaryTex.map;
    ctx.clothMaterial.bumpMap = primaryTex.bumpMap;
    ctx.clothMaterial.bumpScale =
      pKind === "denim" ? 0.45 : pKind === "fleece" ? 0.38 : 0.26;
    ctx.clothMaterial.roughness = selectedFabric.roughness;
    ctx.clothMaterial.metalness = selectedFabric.metalness;
    ctx.clothMaterial.wireframe = wireframe;
    ctx.clothMaterial.needsUpdate = true;

    // Trim / Waistband / Collar / Rib texture (1x1 Rib Knit w/ 2 Gold Stripes, Solid Piqué Sleeves/Collar, Denim Band)
    const wbTex =
      wbKind === "rib-striped"
        ? createStripedRibTextures(selectedFabric.color, selectedFabric.seamColor, true)
        : wbKind === "denim"
          ? createDenimTextures(selectedFabric.color)
          : createWovenClothTextures(selectedFabric.color, wbKind === "polo-solid");

    ctx.wbMaterial.color.set("#FFFFFF");
    ctx.wbMaterial.map = wbTex.map;
    ctx.wbMaterial.bumpMap = wbTex.bumpMap;
    ctx.wbMaterial.bumpScale = wbKind === "rib-striped" ? 0.85 : 0.3;
    ctx.wbMaterial.roughness = Math.max(0.32, selectedFabric.roughness - 0.04);
    ctx.wbMaterial.metalness = selectedFabric.metalness;
    ctx.wbMaterial.wireframe = wireframe;
    ctx.wbMaterial.needsUpdate = true;

    ctx.seamMat.color.set(selectedFabric.seamColor);
    ctx.seamMat.needsUpdate = true;

    // Match hardware color to real garment trims (DTM press studs on Bomber, Dark Bottle buttons on Polo, Copper on Jeans!)
    const hwMat = ctx.hardwareMesh.material as THREE.MeshStandardMaterial;
    if (isBomber) {
      hwMat.color.set(selectedFabric.color);
      hwMat.roughness = 0.36;
      hwMat.metalness = 0.45;
    } else if (isPolo) {
      hwMat.color.set("#1C2523");
      hwMat.roughness = 0.42;
      hwMat.metalness = 0.15;
    } else {
      hwMat.color.set("#B45309");
      hwMat.roughness = 0.28;
      hwMat.metalness = 0.85;
    }
    hwMat.needsUpdate = true;

    ctx.mannequinGroup.visible = showMannequin;
    ctx.seamLines.visible = showSeams;
    ctx.hardwareMesh.visible =
      showSeams && Boolean(garment.hardwareGeometry);
    ctx.controls.autoRotate = autoRotate;
    ctx.controls.autoRotateSpeed = 1.6;
  }, [
    autoRotate,
    drapeData,
    isBomber,
    isPolo,
    selectedFabric,
    showMannequin,
    showSeams,
    wireframe,
  ]);

  const setCameraPreset = (preset: CameraPreset) => {
    const ctx = threeRefs.current;
    if (!ctx) return;
    const focusY = isTopGarment ? 112 : isJean ? 68 : 82;
    const camY = isTopGarment ? 124 : 88;
    const dist = isTopGarment ? 175 : 225;
    ctx.controls.target.set(0, focusY, 0);
    if (preset === "front") {
      ctx.camera.position.set(0, camY, dist);
    } else if (preset === "three-quarter") {
      ctx.camera.position.set(dist * 0.52, camY + 12, dist * 0.9);
    } else if (preset === "side") {
      ctx.camera.position.set(dist, camY, 0);
    } else if (preset === "back") {
      ctx.camera.position.set(0, camY + 2, -dist);
    }
    ctx.controls.update();
  };

  const handleCapturePng = () => {
    const ctx = threeRefs.current;
    if (!ctx) return;
    ctx.renderer.render(ctx.scene, ctx.camera);
    const dataUrl = ctx.renderer.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `3d-${templateId}-size-${sizeEntry.size}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const stdBody = drapeData.mannequin.bodySpec;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#F8FAFC] select-none">
      {/* Top 3D Simulation Toolbar */}
      <div className="z-20 flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] bg-white px-3 py-2">
        {/* Left: Size Fit + Standard Mannequin Selector (from Excel!) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-slate-50 px-1.5 py-0.5">
            <span className="px-1 text-[10px] font-semibold text-slate-500">
              Size:
            </span>
            {SIZE_DEFINITIONS.map((sz) => {
              const active = sizeEntry.size === sz.code;
              return (
                <button
                  key={sz.code}
                  type="button"
                  onClick={() => setPreviewSize(sz.code)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] font-bold transition-all cursor-pointer border",
                    active
                      ? "border-[#4F46E5] bg-white text-[#4F46E5] shadow-2xs"
                      : "border-transparent text-slate-500 hover:text-[#0F172A]"
                  )}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: sz.color }}
                  />
                  {sz.code}
                </button>
              );
            })}
          </div>

          {/* Standard Mannequin Switcher (Women / Men / Kids from Excel) */}
          <div className="flex items-center gap-0.5 rounded-lg border border-[#E2E8F0] bg-slate-50 p-0.5">
            {(["women", "men", "kids"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setMannequinCategory(cat)}
                className={cn(
                  "rounded px-2 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer",
                  mannequinCategory === cat
                    ? "bg-white text-[#4F46E5] shadow-2xs"
                    : "text-slate-500 hover:text-[#0F172A]"
                )}
              >
                {cat === "women" ? "Cốt Nữ" : cat === "men" ? "Cốt Nam" : "Trẻ em"}
              </button>
            ))}
          </div>

          <div className="hidden xl:flex items-center gap-1">
            {(
              [
                { id: "three-quarter", label: "3/4" },
                { id: "front", label: "Trước" },
                { id: "side", label: "Sườn" },
                { id: "back", label: "Sau" },
              ] as const
            ).map((cam) => (
              <button
                key={cam.id}
                type="button"
                onClick={() => setCameraPreset(cam.id)}
                className="rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-[10.5px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-[#4F46E5] cursor-pointer"
              >
                {cam.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Display Toggles & Snapshot */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setShowMannequin((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer",
              showMannequin
                ? "border-indigo-200 bg-indigo-50/80 text-[#4F46E5]"
                : "border-[#E2E8F0] bg-white text-slate-500"
            )}
          >
            <User className="size-3" />
            <span className="hidden xl:inline">Ma-nơ-canh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSeams((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer",
              showSeams
                ? "border-indigo-200 bg-indigo-50/80 text-[#4F46E5]"
                : "border-[#E2E8F0] bg-white text-slate-500"
            )}
          >
            <Scissors className="size-3" />
            <span className="hidden xl:inline">Đường chỉ</span>
          </button>

          <button
            type="button"
            onClick={() => setWireframe((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer",
              wireframe
                ? "border-indigo-200 bg-indigo-50/80 text-[#4F46E5]"
                : "border-[#E2E8F0] bg-white text-slate-500"
            )}
          >
            <Grid3X3 className="size-3" />
            <span className="hidden xl:inline">Lưới 3D</span>
          </button>

          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer",
              autoRotate
                ? "border-[#4F46E5] bg-[#4F46E5] text-white"
                : "border-[#E2E8F0] bg-white text-slate-600 hover:text-[#0F172A]"
            )}
          >
            <RotateCw className={cn("size-3", autoRotate && "animate-spin")} />
            <span className="hidden xl:inline">Xoay 360°</span>
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCapturePng}
            className="h-7 gap-1 px-2 text-[11px]"
          >
            <Camera className="size-3 text-[#4F46E5]" />
            <span className="hidden lg:inline">Chụp PNG</span>
          </Button>
        </div>
      </div>

      {/* Main WebGL 3D Viewport */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div
          ref={mountRef}
          className="h-full w-full cursor-grab active:cursor-grabbing"
        />

        {/* Floating Fabric Swatch Picker (Top-Left) */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white/92 px-3 py-2 shadow-xs backdrop-blur-xs">
          <span className="text-[10px] font-semibold text-slate-500">
            {isJean
              ? "Vải Denim:"
              : isBomber
                ? "Vải Nỉ Fleece:"
                : isPolo
                  ? "Màu Chính Polo:"
                  : "Chất vải:"}
          </span>
          <div className="flex items-center gap-1.5">
            {availableFabrics.map((fab) => {
              const active = fab.id === selectedFabric.id;
              return (
                <button
                  key={fab.id}
                  type="button"
                  onClick={() =>
                    setFabricByTemplate((prev) => ({
                      ...prev,
                      [templateId]: fab.id,
                    }))
                  }
                  title={fab.name}
                  className={cn(
                    "size-5 rounded-full border transition-transform cursor-pointer",
                    active
                      ? "scale-115 ring-2 ring-[#4F46E5] ring-offset-1 border-white"
                      : "border-slate-300 hover:scale-105"
                  )}
                  style={{ backgroundColor: fab.color }}
                />
              );
            })}
          </div>
          <span className="hidden sm:inline text-[11px] font-medium text-[#0F172A]">
            {selectedFabric.name}
          </span>
        </div>

        {/* Floating Standard Mannequin Body Spec Card (Top-Right) */}
        <div className="pointer-events-none absolute top-3 right-3 z-10 hidden sm:block rounded-xl border border-[#E2E8F0] bg-white/92 px-3 py-2 text-[10px] text-slate-600 shadow-xs backdrop-blur-xs">
          <div className="font-semibold text-[#0F172A]">
            {MANNEQUIN_STANDARD_GROUPS[mannequinCategory].name} • Cỡ {stdBody.size}
          </div>
          <div className="mt-0.5 font-mono text-[9.5px] text-slate-500">
            Cao {stdBody.heightRangeCm} | Ngực {stdBody.bustCm} | Eo{" "}
            {stdBody.waistCm.toFixed(0)} | Mông {stdBody.hipCm.toFixed(0)} | Đùi{" "}
            {stdBody.thighCm.toFixed(1)} cm
          </div>
        </div>

        {/* Floating Live Garment Specs Badge (Bottom-Left) */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-[#E2E8F0] bg-white/92 px-3 py-1.5 text-[10px] font-medium text-slate-600 shadow-xs backdrop-blur-xs">
          {isJean ? (
            <>
              <span>
                WV1499LSB-TD Size{" "}
                <strong className="font-mono text-[#4F46E5]">
                  {sizeEntry.size}
                </strong>
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-mono">
                Eo {sizeEntry.measurements.waistCm} • Mông{" "}
                {sizeEntry.measurements.hipCm} • Đùi{" "}
                {sizeEntry.measurements.thighCm} • Ống{" "}
                {sizeEntry.measurements.hemOpeningCm} • Dài trong{" "}
                {sizeEntry.measurements.inseamCm} cm
              </span>
            </>
          ) : isBomber ? (
            <>
              <span>
                89865 Bomber Size{" "}
                <strong className="font-mono text-[#4F46E5]">
                  {sizeEntry.size}
                </strong>
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-mono">
                Ngực {sizeEntry.measurements.chestCm} • Vai{" "}
                {sizeEntry.measurements.shoulderCm} • Dài{" "}
                {sizeEntry.measurements.bodyLengthCm} • 1/2 Nách{" "}
                {sizeEntry.measurements.armholeHalfCm} • Dài tay{" "}
                {sizeEntry.measurements.sleeveLengthCm} cm
              </span>
            </>
          ) : isPolo ? (
            <>
              <span>
                HAZE026-028 Size{" "}
                <strong className="font-mono text-[#4F46E5]">
                  {sizeEntry.size}
                </strong>
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-mono">
                Ngực {sizeEntry.measurements.chestCm} • Vai{" "}
                {sizeEntry.measurements.shoulderCm} • Dài CB{" "}
                {sizeEntry.measurements.bodyLengthCm} • Tay ngắn{" "}
                {sizeEntry.measurements.sleeveLengthCm} cm
              </span>
            </>
          ) : (
            <>
              <span>
                Size đang mặc:{" "}
                <strong className="font-mono text-[#4F46E5]">
                  {sizeEntry.size}
                </strong>{" "}
                (Eo {sizeEntry.measurements.waistCm} cm • Dài{" "}
                {sizeEntry.measurements.skirtLengthCm} cm)
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Góc xòe:{" "}
                <strong className="font-mono text-[#0F172A]">
                  {String(sizeEntry.params.flareAngle)}°
                </strong>{" "}
                • Nhún{" "}
                <strong className="font-mono text-[#0F172A]">
                  ×{String(sizeEntry.params.gatherRatio)}
                </strong>
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCameraPreset("three-quarter")}
          className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white/92 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 shadow-xs transition-colors hover:text-[#4F46E5] cursor-pointer"
        >
          <RefreshCw className="size-3" />
          Reset góc nhìn
        </button>
      </div>

      {/* Bottom 3D Status Bar */}
      <div className="flex items-center justify-between border-t border-[#E2E8F0] bg-white px-3 py-1.5 text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <Eye className="size-3.5 text-[#4F46E5]" />
          <span>
            Mô phỏng 3D Realtime •{" "}
            <strong className="text-[#0F172A]">
              {drapeData.garment.metrics.detailLabel}
            </strong>
          </span>
        </div>
        <span className="hidden md:inline text-slate-400">
          Kéo chuột trái: Xoay 360° • Chuột phải: Di chuyển • Con lăn: Phóng to
        </span>
      </div>
    </div>
  );
}
