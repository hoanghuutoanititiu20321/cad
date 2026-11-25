"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Crosshair,
  Eye,
  Grid3X3,
  Hand,
  Layers,
  Maximize2,
  Ruler,
  Scissors,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  distance2D,
  pathToSvgD,
  roundCm,
  roundMm,
} from "@/lib/cad/math";
import type {
  BoundingBox,
  GradedSizeEntry,
  NestedGradingResult,
  Notch,
  PatternPiece,
  Point2D,
  SizeCode,
} from "@/lib/cad/types";
import { SIZE_DEFINITIONS } from "@/templates/circle-skirt/grading";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface LayerVisibility {
  cutLines: boolean;
  sewLines: boolean;
  grainlines: boolean;
  notches: boolean;
  dimensions: boolean;
  nestedGrading: boolean;
  grid: boolean;
}

export interface CadCanvasHandle {
  fitAll: () => void;
  focusPiece: (pieceId: string) => void;
}

interface CadCanvasProps {
  grading: NestedGradingResult;
  layers: LayerVisibility;
  visibleSizes: SizeCode[];
  selectedPieceId: string | null;
  onToggleLayer: (key: keyof LayerVisibility) => void;
  onToggleSize: (size: SizeCode) => void;
  onSelectPiece: (pieceId: string | null) => void;
}

type ActiveTool = "pan" | "measure";

const RULER_SIZE = 28; // px
const MIN_SCALE = 0.08;
const MAX_SCALE = 6.0;

function pickNiceGridStepMm(scalePxPerMm: number): {
  majorMm: number;
  minorMm: number;
} {
  // Aim for major grid lines ~75–140 px apart
  const targetMm = 95 / Math.max(scalePxPerMm, 0.01);
  const candidates = [10, 20, 50, 100, 200, 500, 1000];
  let majorMm = 100;
  for (const c of candidates) {
    if (c >= targetMm) {
      majorMm = c;
      break;
    }
  }
  const minorMm = majorMm >= 500 ? 100 : majorMm >= 100 ? 20 : majorMm / 5;
  return { majorMm, minorMm };
}

function renderNotchElements(notch: Notch, color: string, invScale: number) {
  const origin = notch.cutPoint ?? notch.point;
  const depth = Math.max(notch.depth, 5);
  const tip = {
    x: roundMm(origin.x + Math.cos(notch.angle) * depth),
    y: roundMm(origin.y + Math.sin(notch.angle) * depth),
  };

  if (notch.style === "T") {
    const perp = notch.angle + Math.PI / 2;
    const barHalf = 4;
    const tA = {
      x: roundMm(tip.x + Math.cos(perp) * barHalf),
      y: roundMm(tip.y + Math.sin(perp) * barHalf),
    };
    const tB = {
      x: roundMm(tip.x - Math.cos(perp) * barHalf),
      y: roundMm(tip.y - Math.sin(perp) * barHalf),
    };
    return (
      <g key={notch.id}>
        <line
          x1={origin.x}
          y1={origin.y}
          x2={tip.x}
          y2={tip.y}
          stroke={color}
          strokeWidth={1.6 * invScale}
        />
        <line
          x1={tA.x}
          y1={tA.y}
          x2={tB.x}
          y2={tB.y}
          stroke={color}
          strokeWidth={1.6 * invScale}
        />
        <circle
          cx={notch.point.x}
          cy={notch.point.y}
          r={2.3 * invScale}
          fill={color}
        />
      </g>
    );
  }

  return (
    <g key={notch.id}>
      <line
        x1={origin.x}
        y1={origin.y}
        x2={tip.x}
        y2={tip.y}
        stroke={color}
        strokeWidth={1.7 * invScale}
        strokeLinecap="round"
      />
    </g>
  );
}

export const CadCanvas = forwardRef<CadCanvasHandle, CadCanvasProps>(
  function CadCanvas(
    {
      grading,
      layers,
      visibleSizes,
      selectedPieceId,
      onToggleLayer,
      onToggleSize,
      onSelectPiece,
    },
    ref
  ) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 900, height: 640 });

  // Camera transform: screenX = worldX * scale + pan.x, screenY = worldY * scale + pan.y
  const [scale, setScale] = useState(0.36);
  const [pan, setPan] = useState({ x: 450, y: 120 });
  const hasAutoFittedRef = useRef(false);
  const initialBboxRef = useRef(grading.combinedBbox);

  const [tool, setTool] = useState<ActiveTool>("pan");
  const [isPanning, setIsPanning] = useState(false);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const [cursorWorld, setCursorWorld] = useState<Point2D | null>(null);
  const [cursorScreen, setCursorScreen] = useState<Point2D | null>(null);

  // Tape Measure state
  const [measureA, setMeasureA] = useState<Point2D | null>(null);
  const [measureB, setMeasureB] = useState<Point2D | null>(null);
  const [snappedPoint, setSnappedPoint] = useState<Point2D | null>(null);

  const computeFitTransform = useCallback(
    (box: BoundingBox, vpW: number, vpH: number, paddingPx = 68) => {
      const usableW = Math.max(120, vpW - RULER_SIZE - paddingPx * 2);
      const usableH = Math.max(120, vpH - RULER_SIZE - paddingPx * 2);
      const boxW = Math.max(10, box.width);
      const boxH = Math.max(10, box.height);

      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, Math.min(usableW / boxW, usableH / boxH))
      );

      const cx = (box.minX + box.maxX) / 2;
      const cy = (box.minY + box.maxY) / 2;
      const centerScreenX = (vpW - RULER_SIZE) / 2;
      const centerScreenY = (vpH - RULER_SIZE) / 2;

      return {
        nextScale,
        nextPan: {
          x: centerScreenX - cx * nextScale,
          y: centerScreenY - cy * nextScale,
        },
      };
    },
    []
  );

  const fitBoxToViewport = useCallback(
    (box: BoundingBox, paddingPx = 68) => {
      const { nextScale, nextPan } = computeFitTransform(
        box,
        viewportSize.width,
        viewportSize.height,
        paddingPx
      );
      setScale(nextScale);
      setPan(nextPan);
    },
    [computeFitTransform, viewportSize.height, viewportSize.width]
  );

  // Track container resize and auto-fit cleanly inside the external ResizeObserver callback
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(200, Math.floor(entry.contentRect.width));
        const h = Math.max(200, Math.floor(entry.contentRect.height));
        setViewportSize({ width: w, height: h });
        if (!hasAutoFittedRef.current && w > 220) {
          hasAutoFittedRef.current = true;
          const { nextScale, nextPan } = computeFitTransform(
            initialBboxRef.current,
            w,
            h,
            64
          );
          setScale(nextScale);
          setPan(nextPan);
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [computeFitTransform]);

  // Expose imperative camera methods to parent event handlers (avoids effect-driven state)
  useImperativeHandle(
    ref,
    () => ({
      fitAll: () => fitBoxToViewport(grading.combinedBbox, 64),
      focusPiece: (pieceId: string) => {
        const base =
          grading.entries.find((e) => e.isBase) ?? grading.entries[0];
        const piece = base?.geometry.pieces.find((p) => p.id === pieceId);
        if (piece) {
          fitBoxToViewport(piece.bbox, 84);
        } else {
          fitBoxToViewport(grading.combinedBbox, 64);
        }
      },
    }),
    [fitBoxToViewport, grading]
  );

  // Escape clears active measurement
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMeasureA(null);
        setMeasureB(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const baseEntry = useMemo(
    () => grading.entries.find((e) => e.isBase) ?? grading.entries[0],
    [grading.entries]
  );

  // Snap targets for tape measure (all base piece keyPoints + arc center (0, 0))
  const snapTargets = useMemo<Point2D[]>(() => {
    const pts: Point2D[] = [{ x: 0, y: 0 }];
    for (const entry of grading.entries) {
      if (
        !layers.nestedGrading &&
        entry.size !== grading.baseSize
      ) {
        continue;
      }
      if (!visibleSizes.includes(entry.size)) continue;
      for (const piece of entry.geometry.pieces) {
        for (const kp of piece.keyPoints) {
          pts.push(kp.point);
        }
      }
    }
    return pts;
  }, [grading.baseSize, grading.entries, layers.nestedGrading, visibleSizes]);

  const screenToWorld = useCallback(
    (sx: number, sy: number): Point2D => ({
      x: roundMm((sx - pan.x) / scale),
      y: roundMm((sy - pan.y) / scale),
    }),
    [pan.x, pan.y, scale]
  );

  const findNearestSnap = useCallback(
    (worldPt: Point2D): Point2D | null => {
      const thresholdMm = 14 / scale; // 14px magnetic snap radius
      let best: Point2D | null = null;
      let bestDist = thresholdMm;
      for (const t of snapTargets) {
        const d = Math.hypot(t.x - worldPt.x, t.y - worldPt.y);
        if (d < bestDist) {
          bestDist = d;
          best = t;
        }
      }
      return best;
    },
    [scale, snapTargets]
  );

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * zoomFactor));

    const worldX = (mouseX - pan.x) / scale;
    const worldY = (mouseY - pan.y) / scale;

    setScale(nextScale);
    setPan({
      x: mouseX - worldX * nextScale,
      y: mouseY - worldY * nextScale,
    });
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Middle mouse or Pan mode -> pan
    if (e.button === 1 || (tool === "pan" && e.button === 0)) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsPanning(true);
      dragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      return;
    }

    // Measure mode click
    if (tool === "measure" && e.button === 0) {
      const worldPt = screenToWorld(sx, sy);
      const target = findNearestSnap(worldPt) ?? worldPt;
      if (!measureA || (measureA && measureB)) {
        setMeasureA(target);
        setMeasureB(null);
      } else {
        setMeasureB(target);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    setCursorScreen({ x: sx, y: sy });

    const worldPt = screenToWorld(sx, sy);
    setCursorWorld(worldPt);

    if (tool === "measure") {
      setSnappedPoint(findNearestSnap(worldPt));
    } else if (snappedPoint) {
      setSnappedPoint(null);
    }

    if (isPanning && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.clientX;
      const dy = e.clientY - dragStartRef.current.clientY;
      setPan({
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isPanning) {
      setIsPanning(false);
      dragStartRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const zoomBy = (factor: number) => {
    const canvasW = viewportSize.width - RULER_SIZE;
    const canvasH = viewportSize.height - RULER_SIZE;
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
    const worldX = (cx - pan.x) / scale;
    const worldY = (cy - pan.y) / scale;
    setScale(nextScale);
    setPan({
      x: cx - worldX * nextScale,
      y: cy - worldY * nextScale,
    });
  };

  // Compute grid lines & ruler ticks for current viewport
  const canvasW = Math.max(100, viewportSize.width - RULER_SIZE);
  const canvasH = Math.max(100, viewportSize.height - RULER_SIZE);

  const { majorMm, minorMm } = useMemo(() => pickNiceGridStepMm(scale), [scale]);

  const visibleWorldBounds = useMemo(() => {
    const minX = -pan.x / scale;
    const maxX = (canvasW - pan.x) / scale;
    const minY = -pan.y / scale;
    const maxY = (canvasH - pan.y) / scale;
    return { minX, maxX, minY, maxY };
  }, [canvasH, canvasW, pan.x, pan.y, scale]);

  const xTicks = useMemo(() => {
    const start = Math.floor(visibleWorldBounds.minX / majorMm) * majorMm;
    const end = Math.ceil(visibleWorldBounds.maxX / majorMm) * majorMm;
    const ticks: number[] = [];
    for (let x = start; x <= end && ticks.length < 120; x += majorMm) {
      ticks.push(x);
    }
    return ticks;
  }, [majorMm, visibleWorldBounds.maxX, visibleWorldBounds.minX]);

  const yTicks = useMemo(() => {
    const start = Math.floor(visibleWorldBounds.minY / majorMm) * majorMm;
    const end = Math.ceil(visibleWorldBounds.maxY / majorMm) * majorMm;
    const ticks: number[] = [];
    for (let y = start; y <= end && ticks.length < 120; y += majorMm) {
      ticks.push(y);
    }
    return ticks;
  }, [majorMm, visibleWorldBounds.maxY, visibleWorldBounds.minY]);

  // Entries to render (order: largest XL -> L -> S -> Base on top so base stays crispest!)
  const entriesToRender = useMemo<GradedSizeEntry[]>(() => {
    const filtered = layers.nestedGrading
      ? grading.entries.filter((e) => visibleSizes.includes(e.size))
      : grading.entries.filter((e) => e.size === grading.baseSize);

    return [...filtered].sort((a, b) => {
      if (a.isBase) return 1;
      if (b.isBase) return -1;
      const order: Record<SizeCode, number> = { XL: 0, L: 1, M: 2, S: 3 };
      return order[a.size] - order[b.size];
    });
  }, [grading.baseSize, grading.entries, layers.nestedGrading, visibleSizes]);

  const invScale = roundMm(1 / scale);

  // Active tape measure endpoint
  const activeMeasureEnd =
    measureB ?? (measureA ? snappedPoint ?? cursorWorld : null);
  const activeMeasureDistMm =
    measureA && activeMeasureEnd ? distance2D(measureA, activeMeasureEnd) : null;

  const renderPieceMarkings = (piece: PatternPiece, color: string) => {
    const isSelected = selectedPieceId === piece.id;
    const g = piece.grainline;
    const gAngle = Math.atan2(g.end.y - g.start.y, g.end.x - g.start.x);
    const arrowLen = roundMm(9 * invScale);
    const spread = 0.42;

    const arrowPts = (tip: Point2D, dir: number) => {
      const p1 = {
        x: roundMm(tip.x + Math.cos(dir + spread) * arrowLen),
        y: roundMm(tip.y + Math.sin(dir + spread) * arrowLen),
      };
      const p2 = {
        x: roundMm(tip.x + Math.cos(dir - spread) * arrowLen),
        y: roundMm(tip.y + Math.sin(dir - spread) * arrowLen),
      };
      return `${p1.x},${p1.y} ${roundMm(tip.x)},${roundMm(tip.y)} ${p2.x},${p2.y}`;
    };

    const gMid = {
      x: roundMm((g.start.x + g.end.x) / 2),
      y: roundMm((g.start.y + g.end.y) / 2),
    };
    const isVerticalGrain = Math.abs(g.end.y - g.start.y) > Math.abs(g.end.x - g.start.x);
    const gTextX = isVerticalGrain ? roundMm(gMid.x + 12 * invScale) : gMid.x;
    const gTextY = isVerticalGrain ? gMid.y : roundMm(gMid.y - 8 * invScale);

    return (
      <g key={`markings-${piece.id}`}>
        {/* Internal paths (CF line, zipper slit) */}
        {piece.internalPaths.map((ip) => (
          <path
            key={ip.id}
            d={pathToSvgD(ip)}
            fill="none"
            stroke="#94A3B8"
            strokeWidth={roundMm(1.1 * invScale)}
            strokeDasharray={`${roundMm(5 * invScale)} ${roundMm(4 * invScale)}`}
          />
        ))}

        {/* Grainline (Đường canh sợi) */}
        {layers.grainlines && (
          <g className="pointer-events-none">
            <line
              x1={g.start.x}
              y1={g.start.y}
              x2={g.end.x}
              y2={g.end.y}
              stroke="#0F766E"
              strokeWidth={roundMm(1.4 * invScale)}
            />
            <polyline
              points={arrowPts(g.start, gAngle)}
              fill="none"
              stroke="#0F766E"
              strokeWidth={roundMm(1.4 * invScale)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={arrowPts(g.end, gAngle + Math.PI)}
              fill="none"
              stroke="#0F766E"
              strokeWidth={roundMm(1.4 * invScale)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text
              x={gTextX}
              y={gTextY}
              textAnchor="middle"
              transform={
                isVerticalGrain
                  ? `rotate(-90 ${gTextX} ${gTextY})`
                  : undefined
              }
              fontSize={roundMm(9.5 * invScale)}
              fontWeight="600"
              fill="#0F766E"
              letterSpacing={roundMm(0.5 * invScale)}
            >
              CANH SỢI • GRAINLINE
            </text>
          </g>
        )}

        {/* Notches (Dấu bấm) */}
        {layers.notches && (
          <g className="pointer-events-none">
            {piece.notches.map((n) => renderNotchElements(n, "#7C3AED", invScale))}
          </g>
        )}

        {/* Dimension callouts */}
        {layers.dimensions && (
          <g className="pointer-events-none">
            {piece.dimensions.map((dim) => {
              const mx = (dim.from.x + dim.to.x) / 2;
              const my = (dim.from.y + dim.to.y) / 2;
              const dx = dim.to.x - dim.from.x;
              const dy = dim.to.y - dim.from.y;
              const len = Math.hypot(dx, dy) || 1;
              const nx = -dy / len;
              const ny = dx / len;
              const off = dim.offsetMm ?? 0;

              const a = {
                x: roundMm(dim.from.x + nx * off),
                y: roundMm(dim.from.y + ny * off),
              };
              const b = {
                x: roundMm(dim.to.x + nx * off),
                y: roundMm(dim.to.y + ny * off),
              };
              const lx = roundMm(
                mx + nx * (off + (off >= 0 ? 12 * invScale : -12 * invScale))
              );
              const ly = roundMm(
                my + ny * (off + (off >= 0 ? 12 * invScale : -12 * invScale))
              );

              return (
                <g key={dim.id}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="#64748B"
                    strokeWidth={roundMm(1 * invScale)}
                    strokeDasharray={
                      dim.kind === "radial"
                        ? `${roundMm(4 * invScale)} ${roundMm(3 * invScale)}`
                        : undefined
                    }
                  />
                  <circle cx={a.x} cy={a.y} r={roundMm(2.2 * invScale)} fill="#64748B" />
                  <circle cx={b.x} cy={b.y} r={roundMm(2.2 * invScale)} fill="#64748B" />
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={roundMm(10 * invScale)}
                    fontWeight="600"
                    fontFamily="var(--font-jetbrains-mono), monospace"
                    fill="#334155"
                    stroke="#FFFFFF"
                    strokeWidth={roundMm(3.5 * invScale)}
                    paintOrder="stroke"
                  >
                    {dim.label}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* Piece identification annotation block */}
        <g className="pointer-events-none">
          <text
            x={piece.labelAnchor.x}
            y={piece.labelAnchor.y - 16 * invScale}
            textAnchor="middle"
            fontSize={11.5 * invScale}
            fontWeight="700"
            fill={isSelected ? "#4F46E5" : "#0F172A"}
            stroke="#FFFFFF"
            strokeWidth={4 * invScale}
            paintOrder="stroke"
          >
            {piece.code} • {piece.name.toUpperCase()}
          </text>
          <text
            x={piece.labelAnchor.x}
            y={piece.labelAnchor.y - 2 * invScale}
            textAnchor="middle"
            fontSize={9.5 * invScale}
            fontWeight="500"
            fontFamily="var(--font-jetbrains-mono), monospace"
            fill={color}
            stroke="#FFFFFF"
            strokeWidth={3.5 * invScale}
            paintOrder="stroke"
          >
            {piece.cutNote} • BASE {grading.baseSize}
          </text>
        </g>
      </g>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative flex h-full flex-col bg-[#F8FAFC] select-none overflow-hidden">
        {/* Top CAD Canvas Toolbar */}
        <div className="z-20 flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] bg-white px-3 py-2">
          {/* Left: Tools & Zoom */}
          <div className="flex items-center gap-1">
            <div className="flex items-center rounded-lg border border-[#E2E8F0] bg-slate-50 p-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      setTool("pan");
                      setMeasureA(null);
                      setMeasureB(null);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                      tool === "pan"
                        ? "bg-white text-[#4F46E5] shadow-2xs"
                        : "text-slate-600 hover:text-[#0F172A]"
                    )}
                  >
                    <Hand className="size-3.5" />
                    <span className="hidden xl:inline">Di chuyển</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Kéo thả di chuyển bàn vẽ (Pan)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setTool("measure")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                      tool === "measure"
                        ? "bg-white text-[#4F46E5] shadow-2xs"
                        : "text-slate-600 hover:text-[#0F172A]"
                    )}
                  >
                    <Ruler className="size-3.5" />
                    <span className="hidden xl:inline">Thước đo</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  Đo khoảng cách 2 điểm chính xác 0.01mm (Tape Measure)
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="mx-1 h-5 w-px bg-[#E2E8F0]" />

            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => zoomBy(1 / 1.2)}
                  >
                    <ZoomOut className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Thu nhỏ (Zoom Out)</TooltipContent>
              </Tooltip>

              <span className="min-w-12 text-center font-mono text-[11px] font-semibold text-slate-700 tabular-nums">
                {Math.round(scale * 100)}%
              </span>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => zoomBy(1.2)}
                  >
                    <ZoomIn className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Phóng to (Zoom In)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fitBoxToViewport(grading.combinedBbox, 64)}
                    className="ml-1 h-7 gap-1 px-2 text-[11px]"
                  >
                    <Maximize2 className="size-3" />
                    Vừa khung
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Căn giữa toàn bộ rập (Fit to Screen)</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Right: Layer Toggles & Nested Size Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Nested Grading master toggle + Size badges */}
            <div className="flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-slate-50 px-1.5 py-0.5">
              <button
                type="button"
                onClick={() => onToggleLayer("nestedGrading")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer",
                  layers.nestedGrading
                    ? "bg-[#4F46E5] text-white"
                    : "text-slate-600 hover:bg-white"
                )}
              >
                <Layers className="size-3" />
                Nhảy size
              </button>
              {layers.nestedGrading &&
                SIZE_DEFINITIONS.map((sz) => {
                  const active = visibleSizes.includes(sz.code);
                  return (
                    <button
                      key={sz.code}
                      type="button"
                      onClick={() => onToggleSize(sz.code)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] font-bold transition-all cursor-pointer border",
                        active
                          ? "bg-white text-[#0F172A] border-slate-300 shadow-2xs"
                          : "bg-transparent text-slate-400 border-transparent opacity-50 hover:opacity-80"
                      )}
                      title={`Bật/tắt lớp Size ${sz.code}`}
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: sz.color }}
                      />
                      {sz.code}
                    </button>
                  );
                })}
            </div>

            {/* Individual CAD Layer toggles */}
            <div className="flex items-center gap-1">
              {(
                [
                  { key: "cutLines", label: "Đường cắt", icon: Scissors },
                  { key: "sewLines", label: "Đường may", icon: Eye },
                  { key: "grainlines", label: "Canh sợi", icon: Crosshair },
                  { key: "notches", label: "Dấu bấm", icon: Crosshair },
                  { key: "dimensions", label: "Kích thước", icon: Ruler },
                  { key: "grid", label: "Lưới", icon: Grid3X3 },
                ] as const
              ).map((item) => {
                const active = layers[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onToggleLayer(item.key)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                      active
                        ? "border-indigo-200 bg-indigo-50/80 text-[#4F46E5]"
                        : "border-[#E2E8F0] bg-white text-slate-400 hover:text-slate-700"
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Drafting Surface with Top & Left Synchronized Rulers */}
        <div ref={containerRef} className="relative flex-1 min-h-0 overflow-hidden bg-white">
          {/* Corner Unit Cell */}
          <div
            className="absolute top-0 left-0 z-20 flex items-center justify-center border-r border-b border-[#E2E8F0] bg-slate-50 font-mono text-[9px] font-bold text-slate-500"
            style={{ width: RULER_SIZE, height: RULER_SIZE }}
          >
            cm
          </div>

          {/* Top Horizontal Ruler */}
          <svg
            className="absolute top-0 z-10 border-b border-[#E2E8F0] bg-slate-50/95"
            style={{ left: RULER_SIZE, width: canvasW, height: RULER_SIZE }}
          >
            {xTicks.map((xMm) => {
              const sx = xMm * scale + pan.x;
              if (sx < -40 || sx > canvasW + 40) return null;
              const subStep = majorMm / 2;
              const midSx = (xMm + subStep) * scale + pan.x;
              return (
                <g key={xMm}>
                  <line
                    x1={sx}
                    y1={RULER_SIZE - 10}
                    x2={sx}
                    y2={RULER_SIZE}
                    stroke="#94A3B8"
                    strokeWidth={1}
                  />
                  <text
                    x={sx + 3}
                    y={11}
                    fontSize={9.5}
                    fontFamily="var(--font-jetbrains-mono), monospace"
                    fill="#64748B"
                  >
                    {roundCm(xMm / 10, 1)}
                  </text>
                  {midSx >= 0 && midSx <= canvasW && (
                    <line
                      x1={midSx}
                      y1={RULER_SIZE - 5}
                      x2={midSx}
                      y2={RULER_SIZE}
                      stroke="#CBD5E1"
                      strokeWidth={1}
                    />
                  )}
                </g>
              );
            })}
            {/* Live cursor indicator on top ruler */}
            {cursorScreen && (
              <line
                x1={cursorScreen.x}
                y1={0}
                x2={cursorScreen.x}
                y2={RULER_SIZE}
                stroke="#4F46E5"
                strokeWidth={1.5}
              />
            )}
          </svg>

          {/* Left Vertical Ruler */}
          <svg
            className="absolute left-0 z-10 border-r border-[#E2E8F0] bg-slate-50/95"
            style={{ top: RULER_SIZE, width: RULER_SIZE, height: canvasH }}
          >
            {yTicks.map((yMm) => {
              const sy = yMm * scale + pan.y;
              if (sy < -40 || sy > canvasH + 40) return null;
              const subStep = majorMm / 2;
              const midSy = (yMm + subStep) * scale + pan.y;
              return (
                <g key={yMm}>
                  <line
                    x1={RULER_SIZE - 10}
                    y1={sy}
                    x2={RULER_SIZE}
                    y2={sy}
                    stroke="#94A3B8"
                    strokeWidth={1}
                  />
                  <text
                    x={10}
                    y={sy - 3}
                    fontSize={9.5}
                    fontFamily="var(--font-jetbrains-mono), monospace"
                    fill="#64748B"
                    transform={`rotate(-90 10 ${sy - 3})`}
                  >
                    {roundCm(yMm / 10, 1)}
                  </text>
                  {midSy >= 0 && midSy <= canvasH && (
                    <line
                      x1={RULER_SIZE - 5}
                      y1={midSy}
                      x2={RULER_SIZE}
                      y2={midSy}
                      stroke="#CBD5E1"
                      strokeWidth={1}
                    />
                  )}
                </g>
              );
            })}
            {/* Live cursor indicator on left ruler */}
            {cursorScreen && (
              <line
                x1={0}
                y1={cursorScreen.y}
                x2={RULER_SIZE}
                y2={cursorScreen.y}
                stroke="#4F46E5"
                strokeWidth={1.5}
              />
            )}
          </svg>

          {/* Interactive 2D Vector SVG Drafting Canvas */}
          <svg
            className={cn(
              "absolute bg-white",
              tool === "pan"
                ? isPanning
                  ? "cursor-grabbing"
                  : "cursor-grab"
                : "cursor-crosshair"
            )}
            style={{
              left: RULER_SIZE,
              top: RULER_SIZE,
              width: canvasW,
              height: canvasH,
            }}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => {
              setCursorScreen(null);
              setCursorWorld(null);
              setSnappedPoint(null);
            }}
          >
            {/* Dynamic Adaptive Engineering Grid */}
            {layers.grid && (
              <defs>
                <pattern
                  id="cad-minor-grid"
                  width={minorMm * scale}
                  height={minorMm * scale}
                  patternUnits="userSpaceOnUse"
                  x={pan.x % (minorMm * scale)}
                  y={pan.y % (minorMm * scale)}
                >
                  <path
                    d={`M ${minorMm * scale} 0 L 0 0 0 ${minorMm * scale}`}
                    fill="none"
                    stroke="#F1F5F9"
                    strokeWidth="1"
                  />
                </pattern>
                <pattern
                  id="cad-major-grid"
                  width={majorMm * scale}
                  height={majorMm * scale}
                  patternUnits="userSpaceOnUse"
                  x={pan.x % (majorMm * scale)}
                  y={pan.y % (majorMm * scale)}
                >
                  <rect
                    width={majorMm * scale}
                    height={majorMm * scale}
                    fill="url(#cad-minor-grid)"
                  />
                  <path
                    d={`M ${majorMm * scale} 0 L 0 0 0 ${majorMm * scale}`}
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
            )}

            {layers.grid && (
              <rect
                x={0}
                y={0}
                width={canvasW}
                height={canvasH}
                fill="url(#cad-major-grid)"
              />
            )}

            {/* World-Space Transformed CAD Layer */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
              {/* Origin / Circle Arc Center Crosshair (0, 0) */}
              <g className="pointer-events-none" opacity={0.7}>
                <line
                  x1={-16 * invScale}
                  y1={0}
                  x2={16 * invScale}
                  y2={0}
                  stroke="#94A3B8"
                  strokeWidth={1 * invScale}
                />
                <line
                  x1={0}
                  y1={-16 * invScale}
                  x2={0}
                  y2={16 * invScale}
                  stroke="#94A3B8"
                  strokeWidth={1 * invScale}
                />
                <circle
                  cx={0}
                  cy={0}
                  r={3.5 * invScale}
                  fill="none"
                  stroke="#64748B"
                  strokeWidth={1.1 * invScale}
                />
                <text
                  x={8 * invScale}
                  y={-7 * invScale}
                  fontSize={9 * invScale}
                  fontFamily="var(--font-jetbrains-mono), monospace"
                  fill="#64748B"
                >
                  Tâm cung O (0, 0)
                </text>
              </g>

              {/* Pattern Pieces across visible Nested Sizes (S, M, L, XL) */}
              {entriesToRender.map((entry) => {
                const isBase = entry.isBase;
                const cutStrokeWidth = (isBase ? 2.0 : 1.35) * invScale;
                const sewStrokeWidth = (isBase ? 1.35 : 0.95) * invScale;

                return (
                  <g key={`size-layer-${entry.size}`}>
                    {entry.geometry.pieces.map((piece) => {
                      const isSelected = selectedPieceId === piece.id;
                      const fillOpacity = isBase
                        ? isSelected
                          ? 0.085
                          : 0.035
                        : 0;

                      // Tag position for Nested Grading size identification
                      const tagKp =
                        piece.id === "skirt-panel"
                          ? piece.keyPoints.find((k) => k.code === "P5") ??
                            piece.keyPoints[0]
                          : piece.keyPoints.find((k) => k.code === "W3") ??
                            piece.keyPoints[0];

                      return (
                        <g
                          key={`${entry.size}-${piece.id}`}
                          onClick={(ev) => {
                            if (tool === "pan") {
                              ev.stopPropagation();
                              onSelectPiece(
                                selectedPieceId === piece.id ? null : piece.id
                              );
                            }
                          }}
                        >
                          {/* Subtle Base Piece Fill */}
                          {isBase &&
                            piece.cutPaths.map((cp) => (
                              <path
                                key={`fill-${cp.id}`}
                                d={pathToSvgD(cp)}
                                fill={entry.color}
                                fillOpacity={fillOpacity}
                                fillRule="evenodd"
                                stroke="none"
                              />
                            ))}

                          {/* CUT LINES (Đường cắt — Nét liền) */}
                          {layers.cutLines &&
                            piece.cutPaths.map((cp) => (
                              <path
                                key={`cut-${entry.size}-${cp.id}`}
                                d={pathToSvgD(cp)}
                                fill="none"
                                stroke={entry.color}
                                strokeWidth={cutStrokeWidth}
                                strokeOpacity={isBase ? 1 : 0.85}
                                strokeLinejoin="round"
                              />
                            ))}

                          {/* SEW LINES (Đường may — Nét đứt) */}
                          {layers.sewLines &&
                            piece.sewPaths.map((sp) => (
                              <path
                                key={`sew-${entry.size}-${sp.id}`}
                                d={pathToSvgD(sp)}
                                fill="none"
                                stroke={entry.color}
                                strokeWidth={sewStrokeWidth}
                                strokeOpacity={isBase ? 0.78 : 0.45}
                                strokeDasharray={`${6 * invScale} ${4 * invScale}`}
                              />
                            ))}

                          {/* Nested Size Tag Badge on contour edge */}
                          {layers.nestedGrading && tagKp && (
                            <g className="pointer-events-none">
                              <circle
                                cx={tagKp.point.x}
                                cy={tagKp.point.y}
                                r={2.2 * invScale}
                                fill={entry.color}
                              />
                              <text
                                x={
                                  piece.id === "skirt-panel"
                                    ? tagKp.point.x + 12 * invScale
                                    : tagKp.point.x + 10 * invScale
                                }
                                y={
                                  piece.id === "skirt-panel"
                                    ? tagKp.point.y + 4 * invScale
                                    : tagKp.point.y - 4 * invScale
                                }
                                fontSize={9 * invScale}
                                fontWeight="700"
                                fontFamily="var(--font-jetbrains-mono), monospace"
                                fill={entry.color}
                                stroke="#FFFFFF"
                                strokeWidth={3 * invScale}
                                paintOrder="stroke"
                              >
                                {entry.size}
                              </text>
                            </g>
                          )}

                          {/* Markings, Grainlines, Notches & Labels rendered cleanly on Base Size */}
                          {isBase && renderPieceMarkings(piece, entry.color)}
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* Snap highlight circle in Measure mode */}
              {tool === "measure" && snappedPoint && (
                <circle
                  cx={snappedPoint.x}
                  cy={snappedPoint.y}
                  r={6.5 * invScale}
                  fill="rgba(79, 70, 229, 0.14)"
                  stroke="#4F46E5"
                  strokeWidth={1.8 * invScale}
                  className="pointer-events-none"
                />
              )}

              {/* Interactive Tape Measure Overlay */}
              {measureA && activeMeasureEnd && activeMeasureDistMm !== null && (
                <g className="pointer-events-none">
                  <line
                    x1={measureA.x}
                    y1={measureA.y}
                    x2={activeMeasureEnd.x}
                    y2={activeMeasureEnd.y}
                    stroke="#4F46E5"
                    strokeWidth={1.8 * invScale}
                    strokeDasharray={`${5 * invScale} ${3 * invScale}`}
                  />
                  <circle
                    cx={measureA.x}
                    cy={measureA.y}
                    r={4 * invScale}
                    fill="#4F46E5"
                  />
                  <circle
                    cx={activeMeasureEnd.x}
                    cy={activeMeasureEnd.y}
                    r={4 * invScale}
                    fill="#4F46E5"
                  />
                  {/* Floating distance pill */}
                  {(() => {
                    const mx = (measureA.x + activeMeasureEnd.x) / 2;
                    const my = (measureA.y + activeMeasureEnd.y) / 2 - 14 * invScale;
                    const label = `${roundCm(activeMeasureDistMm / 10, 2)} cm (${activeMeasureDistMm.toFixed(2)} mm)`;
                    return (
                      <g>
                        <rect
                          x={mx - 88 * invScale}
                          y={my - 11 * invScale}
                          width={176 * invScale}
                          height={22 * invScale}
                          rx={6 * invScale}
                          fill="#0F172A"
                        />
                        <text
                          x={mx}
                          y={my + 1 * invScale}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={10 * invScale}
                          fontWeight="600"
                          fontFamily="var(--font-jetbrains-mono), monospace"
                          fill="#FFFFFF"
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })()}
                </g>
              )}
            </g>
          </svg>

          {/* Compact Legend Floating Bottom-Left */}
          <div className="pointer-events-none absolute bottom-3 left-10 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-[#E2E8F0] bg-white/92 px-3 py-1.5 text-[10px] font-medium text-slate-600 shadow-xs backdrop-blur-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-[#4F46E5]" />
              Đường cắt (Cut)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0 w-4 border-t-[1.5px] border-dashed border-[#4F46E5]" />
              Đường may (Sew)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-[#0F766E]" />
              Canh sợi (Grainline)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#7C3AED]" />
              Dấu bấm (Notch)
            </span>
          </div>
        </div>

        {/* Bottom CAD Status Bar */}
        <div className="flex items-center justify-between border-t border-[#E2E8F0] bg-white px-3 py-1.5 text-[11px] text-slate-500">
          <div className="flex items-center gap-4 font-mono tabular-nums">
            <span>
              X:{" "}
              <strong className="text-[#0F172A]">
                {cursorWorld ? `${cursorWorld.x.toFixed(2)} mm` : "—"}
              </strong>
            </span>
            <span>
              Y:{" "}
              <strong className="text-[#0F172A]">
                {cursorWorld ? `${cursorWorld.y.toFixed(2)} mm` : "—"}
              </strong>
            </span>
            {cursorWorld && (
              <span className="hidden sm:inline text-slate-400">
                ({roundCm(cursorWorld.x / 10, 2)} cm,{" "}
                {roundCm(cursorWorld.y / 10, 2)} cm)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="hidden md:inline text-slate-400">
              {tool === "measure"
                ? "Click 2 điểm để đo khoảng cách • ESC để xóa"
                : "Cuộn chuột để Zoom • Kéo chuột để Pan • Click mảnh để chọn"}
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
              {baseEntry?.geometry.pieces.length ?? 0} mảnh rập • 0.01 mm
            </span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
});
