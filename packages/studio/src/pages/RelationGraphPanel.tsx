import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useGraphStore } from "../store/relations/graph-store";
import { AlertBanner } from "../components/graph/AlertBanner";
import { CharacterNode } from "../components/graph/CharacterNode";
import { RelationEdge } from "../components/graph/RelationEdge";
import { LegendPanel } from "../components/graph/LegendPanel";
import { DetailPanel } from "../components/graph/DetailPanel";
import { getLayout, type LayoutNode } from "../components/graph/layout";
import type { GraphNodeData, GraphEdgeData } from "../store/relations/types";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";

interface RelationGraphPanelProps {
  readonly bookId: string;
  readonly theme?: Theme;
  readonly t?: TFunction;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

/**
 * Compute view-port dimensions (node bounding rect padded) for fitView.
 */
function computeViewBox(
  nodes: ReadonlyArray<LayoutNode>,
  padding = 60,
): { x: number; y: number; width: number; height: number } {
  if (nodes.length === 0) return { x: 0, y: 0, width: 800, height: 600 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const hw = (n.nodeWidth ?? 160) / 2;
    const hh = (n.nodeHeight ?? 50) / 2;
    minX = Math.min(minX, n.x - hw);
    minY = Math.min(minY, n.y - hh);
    maxX = Math.max(maxX, n.x + hw);
    maxY = Math.max(maxY, n.y + hh);
  }
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

export function RelationGraphPanel({ bookId }: RelationGraphPanelProps) {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const loading = useGraphStore((s) => s.loading);
  const error = useGraphStore((s) => s.error);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const loadGraph = useGraphStore((s) => s.loadGraph);
  const selectNode = useGraphStore((s) => s.selectNode);

  // Viewport state
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 800, height: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, vbX: 0, vbY: 0 });

  // Node drag state
  const [dragState, setDragState] = useState<{
    nodeId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Position overrides from drag (to avoid mutating layout data)
  const [dragOffsets, setDragOffsets] = useState<Map<string, { x: number; y: number }>>(
    () => new Map(),
  );

  // Load graph data on mount
  useEffect(() => {
    loadGraph(bookId);
  }, [bookId, loadGraph]);

  // Detect forgotten edges
  const hasForgottenEdges = useMemo(
    () => edges.some((e) => e.isForgotten),
    [edges],
  );

  // Compute dagre layout
  const layoutedNodes = useMemo(() => {
    if (nodes.length === 0) return [];
    try {
      return getLayout(nodes, edges, "LR");
    } catch {
      return nodes.map((n) => ({ ...n, x: 0, y: 0, nodeWidth: 160, nodeHeight: 50 }));
    }
  }, [nodes, edges]);

  // Fit view on initial layout or reset
  const fitView = useCallback(() => {
    if (layoutedNodes.length === 0) return;
    const vb = computeViewBox(layoutedNodes);
    setViewBox(vb);
  }, [layoutedNodes]);

  // Fit view on layout change
  useEffect(() => {
    fitView();
  }, [fitView]);

  // ── Pan handlers ──

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only pan on background (target is the SVG element itself)
      if (e.target === svgRef.current) {
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY, vbX: viewBox.x, vbY: viewBox.y });
      }
    },
    [viewBox],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning && dragState === null) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        const wRatio = viewBox.width / (svgRef.current?.clientWidth ?? 800);
        const hRatio = viewBox.height / (svgRef.current?.clientHeight ?? 600);
        setViewBox((vb) => ({
          ...vb,
          x: panStart.vbX - dx * wRatio,
          y: panStart.vbY - dy * hRatio,
        }));
      }

      // Node drag
      if (dragState !== null) {
        const wRatio = viewBox.width / (svgRef.current?.clientWidth ?? 800);
        const hRatio = viewBox.height / (svgRef.current?.clientHeight ?? 600);
        const newX = dragState.origX + (e.clientX - dragState.startX) * wRatio;
        const newY = dragState.origY + (e.clientY - dragState.startY) * hRatio;
        setDragOffsets((prev) => {
          const next = new Map(prev);
          next.set(dragState.nodeId, { x: newX, y: newY });
          return next;
        });
      }
    },
    [isPanning, panStart, dragState, viewBox],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    if (dragState !== null) {
      setDragState(null);
    }
  }, [dragState]);

  // ── Zoom handler ──

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const wRatio = viewBox.width / rect.width;
      const hRatio = viewBox.height / rect.height;

      const cursorVbX = viewBox.x + cursorX * wRatio;
      const cursorVbY = viewBox.y + cursorY * hRatio;

      let newWidth = viewBox.width * (1 - delta);
      let newHeight = viewBox.height * (1 - delta);
      newWidth = Math.max(100, Math.min(10000, newWidth));
      newHeight = Math.max(100, Math.min(10000, newHeight));

      // Check zoom limits
      const zoom = viewBox.width / newWidth;
      if (zoom < MIN_ZOOM || zoom > MAX_ZOOM) return;

      const newX = cursorVbX - cursorX * (newWidth / rect.width);
      const newY = cursorVbY - cursorY * (newHeight / rect.height);

      setViewBox((vb) => ({
        ...vb,
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      }));
    },
    [viewBox],
  );

  // ── Node click handler ──

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      selectNode(selectedNodeId === nodeId ? null : nodeId);
    },
    [selectedNodeId, selectNode],
  );

  // ── Node drag handlers ──

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, node: LayoutNode) => {
      e.stopPropagation();
      const offset = dragOffsets.get(node.id);
      setDragState({
        nodeId: node.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: offset?.x ?? node.x,
        origY: offset?.y ?? node.y,
      });
    },
    [dragOffsets],
  );

  // ── Selected node data ──
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  // ── Reset view ──
  const handleReset = useCallback(() => {
    fitView();
    selectNode(null);
    setDragOffsets(new Map());
  }, [fitView, selectNode]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">加载关系图谱…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <div className="rounded-full bg-destructive/10 p-3">
            <svg className="w-6 h-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-destructive font-medium">无法加载关系数据</p>
          <p className="text-xs text-muted-foreground max-w-md text-center">{error}</p>
          <button
            type="button"
            onClick={() => loadGraph(bookId)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (nodes.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <svg className="w-12 h-12 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <p className="text-sm text-muted-foreground">暂无角色关系数据</p>
          <p className="text-xs text-muted-foreground/60">写作过程中角色关系将自动生成</p>
        </div>
      </div>
    );
  }

  // ── Main graph view ──
  return (
    <div className="flex h-full min-h-0">
      {/* Graph area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 shrink-0 border-b border-border/10">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-foreground">角色关系图谱</h2>
            <span className="text-xs text-muted-foreground/60">
              {nodes.length} 个角色 · {edges.length} 条关系
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LegendPanel />
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg bg-card/80 border border-border/30 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
            >
              重置
            </button>
            <button
              type="button"
              onClick={() => {
                const el = document.fullscreenElement;
                if (el) {
                  document.exitFullscreen();
                } else {
                  document.documentElement.requestFullscreen();
                }
              }}
              className="rounded-lg bg-card/80 border border-border/30 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
            >
              全屏
            </button>
          </div>
        </div>

        {/* Forgotten alert */}
        {hasForgottenEdges && (
          <div className="px-6 pt-3 shrink-0">
            <AlertBanner />
          </div>
        )}

        {/* SVG canvas */}
        <div
          className="flex-1 min-h-0 relative"
          style={{ cursor: isPanning ? "grabbing" : dragState !== null ? "grabbing" : "grab" }}
        >
          <svg
            ref={svgRef}
            className="w-full h-full"
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {/* Background grid */}
            <defs>
              <pattern id="grid" width={40} height={40} patternUnits="userSpaceOnUse">
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={0.5}
                  opacity={0.06}
                />
              </pattern>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Grid pattern */}
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Edges */}
            {edges.map((edge) => {
              const sourceNode = layoutedNodes.find((n) => n.id === edge.source);
              const targetNode = layoutedNodes.find((n) => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const offset = dragOffsets.get(edge.source);
              const targetOffset = dragOffsets.get(edge.target);
              const x1 = offset?.x ?? sourceNode.x;
              const y1 = offset?.y ?? sourceNode.y;
              const x2 = targetOffset?.x ?? targetNode.x;
              const y2 = targetOffset?.y ?? targetNode.y;

              const isHighlighted =
                selectedNodeId === edge.source ||
                selectedNodeId === edge.target;

              return (
                <RelationEdge
                  key={edge.id}
                  edge={edge}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  isHighlighted={isHighlighted}
                />
              );
            })}

            {/* Nodes */}
            {layoutedNodes.map((node) => {
              const offset = dragOffsets.get(node.id);
              const x = offset?.x ?? node.x;
              const y = offset?.y ?? node.y;

              return (
                <g
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                >
                  <CharacterNode
                    nodeData={node}
                    x={x}
                    y={y}
                    nodeWidth={node.nodeWidth}
                    nodeHeight={node.nodeHeight}
                    isSelected={selectedNodeId === node.id}
                    onClick={handleNodeClick}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Detail panel (renders beside the graph when a node is selected) */}
      {selectedNode && (
        <DetailPanel
          node={selectedNode}
          edges={edges}
          nodes={nodes}
          onClose={() => selectNode(null)}
          className="border-l border-border/20"
        />
      )}
    </div>
  );
}
