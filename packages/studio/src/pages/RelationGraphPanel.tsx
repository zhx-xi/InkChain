import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type OnNodeClick,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { useGraphStore } from "../store/relations/graph-store";
import { fetchJson } from "../hooks/use-api";
import { Sparkles } from "lucide-react";
import { AlertBanner } from "../components/graph/AlertBanner";
import { MemoCharacterNode } from "../components/graph/CharacterNode";
import { MemoRelationEdge } from "../components/graph/RelationEdge";
import { LegendPanel } from "../components/graph/LegendPanel";
import { DetailPanel } from "../components/graph/DetailPanel";
import { RelationExtractionReviewPanel } from "../components/RelationExtractionReviewPanel";
import { getLayout, type LayoutNode } from "../components/graph/layout";
import type { GraphNodeData, GraphEdgeData } from "../store/relations/types";

interface VolumeInfo {
  id: string;
  title: string;
  order: number;
}

interface RelationGraphPanelProps {
  readonly bookId: string;
}

// Tiers to hide in simplified view
const SIMPLIFIED_HIDE_TIERS = new Set(["guest", "one_shot", "scene"]);

// ReactFlow custom node and edge type registrations
const nodeTypes: NodeTypes = {
  character: MemoCharacterNode,
};

const edgeTypes: EdgeTypes = {
  relation: MemoRelationEdge,
};

/**
 * Convert dagre layout nodes and edges into ReactFlow-compatible
 * Node[] and Edge[] arrays.
 */
function toReactFlowNodes(
  layoutNodes: ReadonlyArray<LayoutNode>,
): Node<GraphNodeData>[] {
  return layoutNodes.map((n) => ({
    id: n.id,
    type: "character",
    position: { x: n.x, y: n.y },
    data: {
      id: n.id,
      label: n.label,
      tier: n.tier,
      rolePath: n.rolePath,
      description: n.description,
      chapterAppearances: n.chapterAppearances,
    },
    draggable: true,
  }));
}

function toReactFlowEdges(
  edges: ReadonlyArray<GraphEdgeData>,
): Edge<GraphEdgeData>[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "relation",
    data: {
      id: e.id,
      source: e.source,
      target: e.target,
      relationType: e.relationType,
      label: e.label,
      intensity: e.intensity,
      isForgotten: e.isForgotten,
      description: e.description,
    },
    style: { pointerEvents: "stroke" },
  }));
}

/**
 * Interactive relation graph page using @xyflow/react with dagre layout.
 * Replaces the manual SVG rendering approach with ReactFlow's built-in
 * pan/zoom/drag, custom nodes and edges, and Controls component.
 */
export function RelationGraphPanel({ bookId }: RelationGraphPanelProps) {
  const storeNodes = useGraphStore((s) => s.nodes);
  const storeEdges = useGraphStore((s) => s.edges);
  const loading = useGraphStore((s) => s.loading);
  const error = useGraphStore((s) => s.error);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const loadGraph = useGraphStore((s) => s.loadGraph);
  const selectNode = useGraphStore((s) => s.selectNode);

  const [simplified, setSimplified] = useState(false);
  const [selectedVolumeId, setSelectedVolumeId] = useState<string | null>(null);
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [chapterVolumeMap, setChapterVolumeMap] = useState<Map<number, string>>(new Map());
  const [showExtraction, setShowExtraction] = useState(false);
  const reactFlowRef = useRef<HTMLDivElement>(null);

  // ── Load graph data on mount ──
  useEffect(() => {
    loadGraph(bookId);
  }, [bookId, loadGraph]);

  // ── Load volumes and chapter-to-volume mapping ──
  useEffect(() => {
    let cancelled = false;

    async function loadVolumes() {
      try {
        const data = await fetchJson<{ volumes: VolumeInfo[] }>(`/books/${bookId}/volumes`);
        if (cancelled) return;
        setVolumes(data.volumes ?? []);

        // Load chapter index to build chapter→volume mapping
        const chapters = await fetchJson<{ chapters: Array<{ number: number; volumeId: string | null }> }>(
          `/books/${bookId}/chapters`,
        );
        if (cancelled) return;
        const map = new Map<number, string>();
        for (const ch of chapters.chapters ?? []) {
          if (ch.volumeId) {
            map.set(ch.number, ch.volumeId);
          }
        }
        setChapterVolumeMap(map);
      } catch {
        // Volumes or chapters not available — ignore
      }
    }

    loadVolumes();
    return () => { cancelled = true; };
  }, [bookId]);

  // ── Volume-based filter: compute chapter range for selected volume ──
  const volumeChapterRange = useMemo<[number, number] | null>(() => {
    if (!selectedVolumeId) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const [ch, volId] of chapterVolumeMap) {
      if (volId === selectedVolumeId) {
        if (ch < min) min = ch;
        if (ch > max) max = ch;
      }
    }
    if (min === Infinity) return null;
    return [min, max];
  }, [selectedVolumeId, chapterVolumeMap]);

  // ── Filter edges by volume chapter range ──
  const volumeFilteredEdges = useMemo(() => {
    if (!volumeChapterRange) return storeEdges;
    const [minCh, maxCh] = volumeChapterRange;
    return storeEdges.filter((e) => {
      // Show relations whose validFromChapter falls within the volume's range
      // If intensity is used as a proxy (higher = more relevant), keep all for now
      // and let the node visibility handle it
      return true;
    });
  }, [storeEdges, volumeChapterRange]);

  // ── Filter nodes to show only those with visible edges ──
  const volumeFilteredNodeIds = useMemo(() => {
    if (!volumeChapterRange) return null;
    const ids = new Set<string>();
    for (const e of volumeFilteredEdges) {
      ids.add(e.source);
      ids.add(e.target);
    }
    return ids;
  }, [volumeChapterRange, volumeFilteredEdges]);

  const volumeFilteredNodes = useMemo(() => {
    if (!volumeFilteredNodeIds) return storeNodes;
    return storeNodes.filter((n) => volumeFilteredNodeIds.has(n.id));
  }, [storeNodes, volumeFilteredNodeIds]);

  // ── Detect forgotten edges for banner ──
  const hasForgottenEdges = useMemo(
    () => storeEdges.some((e) => e.isForgotten),
    [storeEdges],
  );

  // ── Compute dagre layout ──
  const layoutedNodes = useMemo(() => {
    if (volumeFilteredNodes.length === 0) return [];
    try {
      return getLayout(volumeFilteredNodes, volumeFilteredEdges, "LR");
    } catch {
      return volumeFilteredNodes.map((n) => ({
        ...n,
        x: 0,
        y: 0,
        nodeWidth: 160,
        nodeHeight: 50,
      }));
    }
  }, [volumeFilteredNodes, volumeFilteredEdges]);

  // ── Apply simplified view filter and convert to ReactFlow format ──
  const filteredLayoutNodes = useMemo(() => {
    if (!simplified) return layoutedNodes;
    return layoutedNodes.filter((n) => !SIMPLIFIED_HIDE_TIERS.has(n.tier));
  }, [layoutedNodes, simplified]);

  const initialNodes = useMemo(
    () => toReactFlowNodes(filteredLayoutNodes),
    [filteredLayoutNodes],
  );

  // Build filtered edges that only connect visible nodes
  const visibleNodeIds = useMemo(
    () => new Set(filteredLayoutNodes.map((n) => n.id)),
    [filteredLayoutNodes],
  );

  const visibleEdges = useMemo(
    () => volumeFilteredEdges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target),
    ),
    [volumeFilteredEdges, visibleNodeIds],
  );

  const initialEdges = useMemo(
    () => toReactFlowEdges(visibleEdges),
    [visibleEdges],
  );

  // ── ReactFlow state ──
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes when layout changes (dagre recomputation)
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // ── Fit view on first layout ─-
  const [hasFit, setHasFit] = useState(false);
  useEffect(() => {
    if (nodes.length > 0 && !hasFit) {
      setHasFit(true);
      // Delay to let ReactFlow mount and compute dimensions
      const timer = setTimeout(() => {
        // Find the ReactFlow instance and fit view
        const viewportEl = reactFlowRef.current?.querySelector(".react-flow__viewport");
        if (viewportEl) {
          // Trigger fitView via a brief state toggle — ReactFlow auto-fitView
          // handles this, but we force via a resize event trick
          window.dispatchEvent(new Event("resize"));
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, hasFit]);

  // ── Reset handler ──
  const handleReset = useCallback(() => {
    selectNode(null);
    setHasFit(false);
    window.dispatchEvent(new Event("resize"));
  }, [selectNode]);

  // ── Node click handler ──
  const onNodeClick: OnNodeClick = useCallback(
    (_event, node) => {
      selectNode(selectedNodeId === node.id ? null : node.id);
    },
    [selectedNodeId, selectNode],
  );

  // ── Selected node data for detail panel ──
  const selectedNode = useMemo(
    () => storeNodes.find((n) => n.id === selectedNodeId) ?? null,
    [storeNodes, selectedNodeId],
  );

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
            <svg
              className="w-6 h-6 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-sm text-destructive font-medium">
            无法加载关系数据
          </p>
          <p className="text-xs text-muted-foreground max-w-md text-center">
            {error}
          </p>
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
  if (storeNodes.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <svg
            className="w-12 h-12 text-muted-foreground/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <p className="text-sm text-muted-foreground">暂无角色关系数据</p>
          <p className="text-xs text-muted-foreground/60">
            写作过程中角色关系将自动生成
          </p>
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
            <h2 className="text-base font-semibold text-foreground">
              角色关系图谱
            </h2>
            <span className="text-xs text-muted-foreground/60">
              {storeNodes.length} 个角色 · {storeEdges.length} 条关系
              {selectedVolumeId && ` · 筛选`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Volume filter dropdown */}
            {volumes.length > 0 && (
              <select
                value={selectedVolumeId ?? ""}
                onChange={(e) => setSelectedVolumeId(e.target.value || null)}
                className="rounded-lg bg-card/80 border border-border/30 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer max-w-[140px] truncate"
              >
                <option value="">所有卷</option>
                {volumes.sort((a, b) => a.order - b.order).map((v) => (
                  <option key={v.id} value={v.id}>{v.title}</option>
                ))}
              </select>
            )}

            {/* Simplified view toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={simplified}
                onChange={(e) => setSimplified(e.target.checked)}
                className="rounded border-border/50 text-primary focus:ring-primary/30"
              />
              <span className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                简化视图
              </span>
            </label>

            <LegendPanel />

            {/* AI Relation Extraction button */}
            <button
              type="button"
              onClick={() => setShowExtraction(!showExtraction)}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                showExtraction
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card/80 border-border/30 text-muted-foreground hover:text-foreground hover:bg-card",
              )}
            >
              <Sparkles size={14} className="inline mr-1" />
              AI 提取
            </button>

            {/* Consistency check button */}
            <button
              type="button"
              onClick={async () => {
                try {
                  const result = await fetchJson<{
                    ok: boolean;
                    checks: Array<{ name: string; passed: boolean; detail: string }>;
                  }>(`/books/${bookId}/consistency`);
                  const allPassed = result.checks?.every((c) => c.passed) ?? false;
                  if (allPassed) {
                    alert("✅ 数据一致性检查通过\n\n所有跨模块引用均完整。");
                  } else {
                    const failures = result.checks
                      ?.filter((c) => !c.passed)
                      .map((c) => `❌ ${c.name}: ${c.detail}`)
                      .join("\n");
                    alert(`⚠️ 发现数据一致性问题：\n\n${failures}`);
                  }
                } catch {
                  alert("❌ 一致性检查失败：无法连接到服务器");
                }
              }}
              className="rounded-lg bg-card/80 border border-border/30 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
            >
              一致性检查
            </button>

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

        {/* ReactFlow canvas */}
        <div ref={reactFlowRef} className="flex-1 min-h-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            nodesDraggable
            panOnDrag
            zoomOnScroll
            zoomOnDoubleClick={false}
            deleteKeyCode={null}
            className="bg-background/50"
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="currentColor"
              style={{ opacity: 0.08 }}
            />
            <Controls
              showInteractive={false}
              className="!shadow-sm !border !border-border/20 !rounded-lg"
            />
            {/* Simplified view indicator */}
            {simplified && nodes.length > 0 && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
                <span className="text-[11px] text-muted-foreground/60 bg-card/70 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border/20 shadow-sm">
                  简化模式：已隐藏客串和一次性角色（{storeNodes.length - nodes.length} 个）
                </span>
              </div>
            )}
          </ReactFlow>
        </div>
      </div>

      {/* Detail panel (renders beside the graph when a node is selected) */}
      {selectedNode && (
        <DetailPanel
          node={selectedNode}
          edges={storeEdges}
          nodes={storeNodes}
          onClose={() => selectNode(null)}
          className="border-l border-border/20"
        />
      )}

      {/* AI Relation Extraction panel (renders beside the graph when toggled) */}
      {showExtraction && !selectedNode && (
        <div className="w-96 shrink-0 border-l border-border/20 overflow-y-auto">
          <RelationExtractionReviewPanel
            bookId={bookId}
            onClose={() => setShowExtraction(false)}
          />
        </div>
      )}
    </div>
  );
}
