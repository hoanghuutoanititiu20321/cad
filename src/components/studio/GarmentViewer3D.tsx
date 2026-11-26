"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
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
  buildCircleSkirt3D,
  buildMannequinGeometries,
  FABRIC_PRESETS,
} from "@/lib/cad/drape3d";
import type { NestedGradingResult, SizeCode } from "@/lib/cad/types";
import { SIZE_DEFINITIONS } from "@/templates/circle-skirt/grading";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface GarmentViewer3DProps {
  grading: NestedGradingResult;
  activeBaseSize: SizeCode;
}

type CameraPreset = "front" | "three-quarter" | "side" | "back";

export function GarmentViewer3D({
  grading,
  activeBaseSize,
}: GarmentViewer3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  const [previewSize, setPreviewSize] = useState<SizeCode>(activeBaseSize);
  const [fabricId, setFabricId] = useState<string>(FABRIC_PRESETS[0].id);
  const [showMannequin, setShowMannequin] = useState(true);
  const [showSeams, setShowSeams] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);

  // Keep refs to Three.js scene objects so parameter updates swap geometries smoothly at 60fps without re-creating WebGLContext
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
    skirtMesh: THREE.Mesh;
    waistbandMesh: THREE.Mesh;
    seamLines: THREE.LineSegments;
    zipperStopMarker: THREE.Mesh;
    clothMaterial: THREE.MeshPhysicalMaterial;
    wbMaterial: THREE.MeshPhysicalMaterial;
  } | null>(null);

  const selectedFabric = useMemo(
    () =>
      FABRIC_PRESETS.find((f) => f.id === fabricId) ?? FABRIC_PRESETS[0],
    [fabricId]
  );

  const sizeEntry = useMemo(
    () =>
      grading.entries.find((e) => e.size === previewSize) ??
      grading.entries.find((e) => e.size === activeBaseSize) ??
      grading.entries[0],
    [activeBaseSize, grading.entries, previewSize]
  );

  // Initialize Three.js WebGL Studio Scene once on mount
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = Math.max(240, container.clientWidth);
    const height = Math.max(240, container.clientHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#F8FAFC");

    const camera = new THREE.PerspectiveCamera(36, width / height, 2, 900);
    camera.position.set(115, 108, 185);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true, // Allows crisp PNG snapshot capture!
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
    controls.target.set(0, 82, 0);
    controls.minDistance = 75;
    controls.maxDistance = 380;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.update();

    // Soft 3-Point Fashion Studio Lighting
    const hemiLight = new THREE.HemisphereLight("#FFFFFF", "#CBD5E1", 1.15);
    hemiLight.position.set(0, 220, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight("#FFFDF9", 1.45);
    keyLight.position.set(95, 210, 130);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 40;
    keyLight.shadow.camera.far = 420;
    keyLight.shadow.camera.left = -95;
    keyLight.shadow.camera.right = 95;
    keyLight.shadow.camera.top = 160;
    keyLight.shadow.camera.bottom = -20;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight("#E0E7FF", 0.75);
    rimLight.position.set(-110, 145, -120);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight("#FFFFFF", 0.45);
    fillLight.position.set(-80, 75, 110);
    scene.add(fillLight);

    // Studio Floor Shadow Catcher + Subtle Metric Polar/Grid Floor
    const floorGeo = new THREE.CircleGeometry(130, 64);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: "#F1F5F9",
      roughness: 0.95,
      metalness: 0.0,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const gridHelper = new THREE.GridHelper(200, 20, "#CBD5E1", "#E2E8F0");
    gridHelper.position.y = 0.12;
    scene.add(gridHelper);

    // Mannequin Group
    const mannequinGroup = new THREE.Group();
    const linenFormMat = new THREE.MeshStandardMaterial({
      color: "#F3EFE6",
      roughness: 0.85,
      metalness: 0.02,
    });
    const woodMetalMat = new THREE.MeshStandardMaterial({
      color: "#475569",
      roughness: 0.35,
      metalness: 0.72,
    });

    const torsoMesh = new THREE.Mesh(new THREE.BufferGeometry(), linenFormMat);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;

    const neckCapMesh = new THREE.Mesh(new THREE.BufferGeometry(), woodMetalMat);
    neckCapMesh.castShadow = true;

    const poleMesh = new THREE.Mesh(new THREE.BufferGeometry(), woodMetalMat);
    poleMesh.castShadow = true;

    const baseMesh = new THREE.Mesh(new THREE.BufferGeometry(), woodMetalMat);
    baseMesh.receiveShadow = true;

    mannequinGroup.add(torsoMesh, neckCapMesh, poleMesh, baseMesh);
    scene.add(mannequinGroup);

    // Cloth Physical Materials (with fabric sheen!)
    const clothMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(FABRIC_PRESETS[0].color),
      roughness: FABRIC_PRESETS[0].roughness,
      metalness: FABRIC_PRESETS[0].metalness,
      sheen: 0.55,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color("#FFFFFF"),
      side: THREE.DoubleSide,
    });

    const wbMaterial = clothMaterial.clone();

    const skirtMesh = new THREE.Mesh(new THREE.BufferGeometry(), clothMaterial);
    skirtMesh.castShadow = true;
    skirtMesh.receiveShadow = true;
    scene.add(skirtMesh);

    const waistbandMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      wbMaterial
    );
    waistbandMesh.castShadow = true;
    waistbandMesh.receiveShadow = true;
    scene.add(waistbandMesh);

    // Seam Stitch Overlay + Zipper Stop Marker
    const seamMat = new THREE.LineBasicMaterial({
      color: "#F8FAFC",
      transparent: true,
      opacity: 0.82,
    });
    const seamLines = new THREE.LineSegments(new THREE.BufferGeometry(), seamMat);
    scene.add(seamLines);

    const zipGeo = new THREE.SphereGeometry(0.68, 16, 16);
    const zipMat = new THREE.MeshStandardMaterial({
      color: "#F59E0B",
      roughness: 0.25,
      metalness: 0.85,
    });
    const zipperStopMarker = new THREE.Mesh(zipGeo, zipMat);
    scene.add(zipperStopMarker);

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
      skirtMesh,
      waistbandMesh,
      seamLines,
      zipperStopMarker,
      clothMaterial,
      wbMaterial,
    };

    // Responsive ResizeObserver
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

    // Animation loop
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
      controls.dispose();
      renderer.dispose();
      linenFormMat.dispose();
      woodMetalMat.dispose();
      clothMaterial.dispose();
      wbMaterial.dispose();
      seamMat.dispose();
      zipGeo.dispose();
      zipMat.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      threeRefs.current = null;
    };
  }, []);

  // Update 3D Draped Garment + Mannequin whenever pattern parameters, size, or fabric stiffness change!
  const drapeMetrics = useMemo(() => {
    const waistCm = sizeEntry.measurements.waistCm;
    const mannequin = buildMannequinGeometries(waistCm);
    const garment = buildCircleSkirt3D(
      sizeEntry.params,
      selectedFabric.stiffness
    );
    return { mannequin, garment };
  }, [selectedFabric.stiffness, sizeEntry]);

  useEffect(() => {
    const ctx = threeRefs.current;
    if (!ctx) return;

    const { mannequin, garment } = drapeMetrics;

    ctx.torsoMesh.geometry.dispose();
    ctx.torsoMesh.geometry = mannequin.torsoGeometry;

    ctx.neckCapMesh.geometry.dispose();
    ctx.neckCapMesh.geometry = mannequin.neckCapGeometry;

    ctx.poleMesh.geometry.dispose();
    ctx.poleMesh.geometry = mannequin.poleGeometry;

    ctx.baseMesh.geometry.dispose();
    ctx.baseMesh.geometry = mannequin.baseGeometry;

    ctx.skirtMesh.geometry.dispose();
    ctx.skirtMesh.geometry = garment.skirtGeometry;

    ctx.waistbandMesh.geometry.dispose();
    ctx.waistbandMesh.geometry = garment.waistbandGeometry;

    ctx.seamLines.geometry.dispose();
    ctx.seamLines.geometry = garment.seamLinesGeometry;

    if (garment.zipperPullPosition) {
      ctx.zipperStopMarker.position.copy(garment.zipperPullPosition);
      ctx.zipperStopMarker.visible = showSeams;
    } else {
      ctx.zipperStopMarker.visible = false;
    }
  }, [drapeMetrics, showSeams]);

  // Update Materials & Visibility toggles without rebuilding geometry
  useEffect(() => {
    const ctx = threeRefs.current;
    if (!ctx) return;

    ctx.clothMaterial.color.set(selectedFabric.color);
    ctx.clothMaterial.roughness = selectedFabric.roughness;
    ctx.clothMaterial.metalness = selectedFabric.metalness;
    ctx.clothMaterial.wireframe = wireframe;
    ctx.clothMaterial.needsUpdate = true;

    ctx.wbMaterial.color.set(selectedFabric.color);
    ctx.wbMaterial.roughness = Math.max(0.25, selectedFabric.roughness - 0.06);
    ctx.wbMaterial.metalness = selectedFabric.metalness;
    ctx.wbMaterial.wireframe = wireframe;
    ctx.wbMaterial.needsUpdate = true;

    ctx.mannequinGroup.visible = showMannequin;
    ctx.seamLines.visible = showSeams;
    ctx.zipperStopMarker.visible =
      showSeams && Boolean(drapeMetrics.garment.zipperPullPosition);
    ctx.controls.autoRotate = autoRotate;
    ctx.controls.autoRotateSpeed = 1.8;
  }, [
    autoRotate,
    drapeMetrics.garment.zipperPullPosition,
    selectedFabric,
    showMannequin,
    showSeams,
    wireframe,
  ]);

  const setCameraPreset = (preset: CameraPreset) => {
    const ctx = threeRefs.current;
    if (!ctx) return;
    ctx.controls.target.set(0, 82, 0);
    if (preset === "front") {
      ctx.camera.position.set(0, 96, 210);
    } else if (preset === "three-quarter") {
      ctx.camera.position.set(115, 108, 185);
    } else if (preset === "side") {
      ctx.camera.position.set(210, 96, 0);
    } else if (preset === "back") {
      ctx.camera.position.set(0, 98, -210);
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
    a.download = `3d-preview-size-${sizeEntry.size}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#F8FAFC] select-none">
      {/* Top 3D Simulation Toolbar */}
      <div className="z-20 flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] bg-white px-3 py-2">
        {/* Left: Size Fit Selector & Camera Views */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-slate-50 px-1.5 py-0.5">
            <span className="px-1 text-[10px] font-semibold text-slate-500">
              Thử Size:
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

          <div className="hidden sm:flex items-center gap-1">
            {(
              [
                { id: "three-quarter", label: "Góc 3/4" },
                { id: "front", label: "Trước" },
                { id: "side", label: "Sườn" },
                { id: "back", label: "Sau (Khóa)" },
              ] as const
            ).map((cam) => (
              <button
                key={cam.id}
                type="button"
                onClick={() => setCameraPreset(cam.id)}
                className="rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-[#4F46E5] cursor-pointer"
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
            title="Ẩn/hiện cốt Ma-nơ-canh"
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
            title="Ẩn/hiện đường may ráp & điểm dừng khóa kéo"
          >
            <Scissors className="size-3" />
            <span className="hidden xl:inline">Đường may</span>
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
            title="Xem lưới cấu trúc 3D (Mesh Wireframe)"
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
            title="Tự động xoay bàn mẫu 360°"
          >
            <RotateCw className={cn("size-3", autoRotate && "animate-spin")} />
            <span className="hidden xl:inline">Xoay 360°</span>
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCapturePng}
            className="h-7 gap-1 px-2 text-[11px]"
            title="Chụp ảnh mẫu 3D lưu file PNG"
          >
            <Camera className="size-3 text-[#4F46E5]" />
            <span className="hidden lg:inline">Chụp PNG</span>
          </Button>
        </div>
      </div>

      {/* Main WebGL 3D Viewport */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

        {/* Floating Fabric Swatch Picker (Top-Left) */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white/92 px-3 py-2 shadow-xs backdrop-blur-xs">
          <span className="text-[10px] font-semibold text-slate-500">
            Chất vải:
          </span>
          <div className="flex items-center gap-1.5">
            {FABRIC_PRESETS.map((fab) => {
              const active = fab.id === selectedFabric.id;
              return (
                <button
                  key={fab.id}
                  type="button"
                  onClick={() => setFabricId(fab.id)}
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

        {/* Floating Live Garment Specs Badge (Bottom-Left) */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-[#E2E8F0] bg-white/92 px-3 py-1.5 text-[10px] font-medium text-slate-600 shadow-xs backdrop-blur-xs">
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
            </strong>{" "}
            •{" "}
            {sizeEntry.params.waistbandType === "curved"
              ? "Lưng cong 3.5cm"
              : "Lưng thẳng 3.5cm"}
          </span>
        </div>

        {/* Reset Camera Quick Button (Bottom-Right) */}
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
              {drapeMetrics.garment.metrics.fluteCount} múi sóng rũ tự nhiên
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
