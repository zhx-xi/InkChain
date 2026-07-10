import { useEffect, useMemo, useState, useCallback } from "react";
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
  type OnNodeClick,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { useApi } from "../hooks/use-api";
import { ArrowLeft, Globe, Maxmize, Minus, Plus } from "lucide-react";
import { MemoWorldRegionNode, type WorldRegionNodeData } from "../components/graph/WorldRegionNode";
import type { WorldConfig, WorldRegion, WorldRegionType } from "@actalk/inkchain-core";

interface WorldGeoVizProps {
  readonly worldId: string;
  readonly nav?: {
    toWorldDetail: (worldId: string) => void;
  };
}

const nodeTypes: NodeTypes = {
  worldRegion: MemoWorldRegionNode,
};

const REGION_TYPE_ORDER: Record<string, number> = {
  "大陆": 0,
  "国家": 1,
  "城市": 2,
  "地点": 3,
};

/**
 * Build a tree from flat regions list using parentId, then flatten top-down
 * so children always appear after parents (dagre can then lay out top-to-bottom).
 */
function buildTree(regions: WorldRegion[]): WorldRegion[] {
  const childrenMap = new Map<string, WorldRegion[]>();
  const roots: WorldRegion[] = [];

  for (const region of regions) {
    if (!region.parentId) {
      roots.push(region);
    } else {
      const siblings = childrenMap.get(region.parentId) ?? [];
      siblings.push(region);
      childrenMap.set(region.parentId, siblings);
    }
  }

  // Sort each level by type order (大陆→国家→城市→地点)
  const sortByType = (list: WorldRegion[]) =>
    list.sort((a, b) => (REGION_TYPE_ORDER[a.type] ?? 99) - (REGION_TYPE_ORDER[b.type] ?? 99));

  sortByType(roots);
  for (const [, siblings] of childrenMap) {
    sortByType(siblings);
  }

  const result: WorldRegion[] = [];
  function walk(node: WorldRegion) {
    result.push(node);
    const children = childrenMap.get(node.id);
    if (children) {
      for (const child of children) {
        walk(child);
      }
    }
  }

  for (const root of roots) {
    walk(root);
  }

  return result;
}

/**
 * Convert WorldRegion[] to ReactFlow nodes and edges with manual tree layout.
 * Root→Child direction: child is placed below parent.
 */
function toReactFlowGraph(regions: WorldRegion[]): {
  nodes: Node<WorldRegionNodeData>[];
  edges: Edge[];
} {
  const childrenMap = new Map<string, WorldRegion[]>();
  for (const r of regions) {
    if (r.parentId) {
      const siblings = childrenMap.get(r.parentId) ?? [];
      siblings.push(r);
      childrenMap.set(r.parentId, siblings);
    }
  }

  const nodeWidth = 180;
  const nodeHeight = 80;
  const levelGap = 140; // vertical gap between levels
  const siblingGap = 30; // horizontal gap between siblings

  const nodes: Node<WorldRegionNodeData>[] = [];
  const edges: Edge[] = [];
  const yOffsets = new Map<string, number>(); // node id → vertical position
  const xOffsets = new Map<string, number>(); // node id → horizontal position

  // For each root, compute subtree widths and positions
  function assignPositions(regionId: string, x: number, y: number): number {
    // Position this node
    const region = regions.find((r) => r.id === regionId);
    if (!region) return 0;

    xOffsets.set(regionId, x);
    yOffsets.set(regionId, y);

    const children = childrenMap.get(regionId) ?? [];
    if (children.length === 0) {
      return nodeWidth; // leaf node width = nodeWidth
    }

    // Position children
    let totalChildWidth = 0;
    const childWidths: number[] = [];
    for (const child of children) {
      const w = assignPositions(child.id, 0, y + levelGap);
      childWidths.push(w);
      totalChildWidth += w;
    }

    // Center children under parent
    const totalWidth = totalChildWidth + siblingGap * (children.length - 1);
    let cx = x - totalWidth / 2 + childWidths[0] / 2;
    for (let i = 0; i < children.length; i++) {
      const childX = cx;
      const childW = childWidths[i];
      xOffsets.set(children[i].id, childX);
      cx += childW / 2 + siblingGap + (childWidths[i + 1] ?? 0) / 2;
    }

    return Math.max(nodeWidth, totalWidth);
  }

  // Get roots (no parentId or parent doesn't exist in the list)
  const regionIds = new Set(regions.map((r) => r.id));
  const roots = regions.filter((r) => !r.parentId || !regionIds.has(r.parentId));

  // Position each root and its subtree
  let currentX = 0;
  for (let ri = 0; ri < roots.length; ri++) {
    const root = roots[ri];
    if (ri > 0) currentX += siblingGap * 2;
    const subtreeWidth = assignPositions(root.id, currentX, 40);
    currentX += subtreeWidth / 2 + siblingGap * 2 + 40;
  }

  // Create ReactFlow nodes
  for (const region of regions) {
    const x = xOffsets.get(region.id) ?? 0;
    const y = yOffsets.get(region.id) ?? 0;
    const children = childrenMap.get(region.id) ?? [];

    nodes.push({
      id: region.id,
      type: "worldRegion",
      position: { x: x - nodeWidth / 2, y },
      data: {
        id: region.id,
        name: region.name,
        type: region.type,
        description: region.description,
        childCount: children.length,
      },
      draggable: true,
    });
  }

  // Create edges (parent → child)
  for (const region of regions) {
    if (!region.parentId) continue;
    if (!regionIds.has(region.parentId)) continue;

    edges.push({
      id: `edge-${region.parentId}-${region.id}`,
      source: region.parentId,
      target: region.id,
      type: "smoothstep",
      animated: false,
      style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5, opacity: 0.5 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 8, color: "hsl(var(--muted-foreground))" },
    });
  }

  return { nodes, edges };
}

export function WorldGeoVizPanel({ worldId, nav }: WorldGeoVizProps) {
  const { data, loading, error } = useApi<{ world: WorldConfig }>(
    `/api/worlds/${encodeURIComponent(worldId)}`
  );

  const regions = data?.world?.regions ?? [];

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => toReactFlowGraph(regions),
    [regions],
  );

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(layoutNodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(layoutEdges);
  const [selectedRegion, setSelectedRegion] = useState<WorldRegion | null>(null);
  const [detailExpand, setDetailExpand] = useState(false);

  // Sync nodes/edges when layout changes (regions updated)
  useEffect(() => {
    setRfNodes(layoutNodes);
    setRfEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setRfNodes, setRfEdges]);

  const onNodeClick: OnNodeClick = useCallback(
    (_event, node) => {
      const region = regions.find((r) => r.id === node.id) ?? null;
      setSelectedRegion((prev) =>
        prev?.id === node.id && detailExpand ? null : region,
      );
      setDetailExpand(false);
    },
    [regions, detailExpand],
  );

  const onPaneClick = useCallback(() => {
    setSelectedRegion(null);
    setDetailExpand(false);
  }, []);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="max-w-md text-center space-y-3 p-6">
          <Globe className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">无法加载世界数据</p>
          <p className="text-xs text-destructive/70">{error}</p>
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (regions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="max-w-md text-center space-y-4 p-6">
          <Globe className="w-16 h-16 mx-auto text-muted-foreground/20" />
          <h3 className="text-lg font-medium text-muted-foreground">暂无地理区域数据</h3>
          <p className="text-sm text-muted-foreground/60">
            请先在世界详情中添加地理区域，再查看地理可视化。
          </p>
          <button
            type="button"
            onClick={() => nav?.toWorldDetail(worldId)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <ArrowLeft size={14} />
            返回世界编辑
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => nav?.toWorldDetail(worldId)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            返回
          </button>
          <h2 className="text-base font-semibold">
            {data?.world?.name ?? "世界"} — 地理层级可视化
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
          <span>{regions.length} 个区域</span>
          <span className="w-px h-3 bg-border/40" />
          <span>{new Set(regions.map((r) => r.type)).size} 种类型</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2.5}
          attributionPosition="bottom-right"
        >
          <Controls
            showInteractive={false}
            className="!rounded-lg !border !border-border/40 !shadow-sm !bg-card"
          />
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="hsl(var(--muted-foreground) / 0.1)"
          />
        </ReactFlow>

        {/* Legend */}
        <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg border border-border/40 p-3 shadow-sm text-xs space-y-1.5 z-10">
          <div className="font-medium text-muted-foreground mb-1.5">区域类型</div>
          {["大陆", "国家", "城市", "地点"].map((type) => {
            const count = regions.filter((r) => r.type === type).length;
            return (
              <div key={type} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{
                    backgroundColor:
                      type === "大陆" ? "#34D399" :
                      type === "国家" ? "#60A5FA" :
                      type === "城市" ? "#FBBF24" :
                      "#A78BFA"
                  }}
                />
                <span>{type}</span>
                <span className="text-muted-foreground/50">({count})</span>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        {selectedRegion && (
          <div className="absolute top-4 right-4 w-72 bg-card/95 backdrop-blur-sm rounded-lg border border-border/40 p-4 shadow-md z-10 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">{selectedRegion.name}</h4>
              <button
                type="button"
                onClick={() => setSelectedRegion(null)}
                className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-muted-foreground/60">类型: </span>
                <span className="font-medium">{selectedRegion.type}</span>
              </div>
              {selectedRegion.parentId && (
                <div>
                  <span className="text-muted-foreground/60">父区域: </span>
                  <span className="font-medium">
                    {regions.find((r) => r.id === selectedRegion.parentId)?.name ?? "未知"}
                  </span>
                </div>
              )}
              {selectedRegion.description && (
                <div>
                  <span className="text-muted-foreground/60 block mb-0.5">描述:</span>
                  <p className="text-muted-foreground/80 leading-relaxed">{selectedRegion.description}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
