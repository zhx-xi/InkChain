// ── Agent Flow Editor (Issue #233, Phase 2) ──
//
// ReactFlow-based visualization of agent collaboration flow.
// Renders built-in + custom agents as styled nodes with edges showing
// sequential / parallel / conditional collaboration relationships.

import { useCallback, useMemo, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  useNodesState,
  useEdgesState,
  MarkerType,
  type NodeProps,
  type EdgeProps,
  BaseEdge,
  getBezierPath,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "../lib/utils";
import type { AgentRole, AgentMetadata } from "./AgentCard";

// ── Props ──

export interface AgentFlowEditorProps {
  readonly builtinAgents: ReadonlyArray<AgentMetadata>;
  readonly customAgents: ReadonlyArray<{
    id: string;
    name: string;
    role: string;
    description: string;
    color: string;
    icon: string;
  }>;
  readonly agentOrder: ReadonlyArray<string>;
  readonly collaborationMode: "sequential" | "parallel" | "hybrid";
  readonly onOrderChange?: (newOrder: ReadonlyArray<string>) => void;
  readonly className?: string;
}

// ── Custom Node Component ──

interface AgentNodeData {
  label: string;
  description: string;
  color: string;
  icon: string;
  status: "ready" | "busy" | "error" | "disabled";
  isCustom?: boolean;
}

const WARM_LITERARY = {
  bg: "#FDF6F0",
  bgCard: "#FFFBF7",
  border: "#E8D8C8",
  brand: "#8B3A3A",
  brandLight: "rgba(139,58,58,0.1)",
  text: "#3a2a1a",
  textMuted: "#8a7a6a",
  accent1: "#8B3A3A",
  accent2: "#D4A855",
  accent3: "#6a8ac0",
};

function AgentFlowNode({ data }: NodeProps<AgentNodeData>) {
  return (
    <div
      className="relative flex items-center gap-3 rounded-xl border-2 px-4 py-3 shadow-sm min-w-[180px] transition-shadow hover:shadow-md"
      style={{
        borderColor: data.status === "disabled" ? `${WARM_LITERAL.border}` : `${data.color}60`,
        backgroundColor: data.status === "disabled" ? `${WARM_LITERAL.bgCard}` : `${data.color}10`,
      }}
    >
      {/* Status dot */}
      <span
        className={cn(
          "absolute top-2 right-2 h-2 w-2 rounded-full",
          data.status === "ready" && "bg-emerald-500",
          data.status === "busy" && "bg-amber-500 animate-pulse",
          data.status === "error" && "bg-red-500",
          data.status === "disabled" && "bg-zinc-300",
        )}
      />

      {/* Icon */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg shadow-sm"
        style={{ backgroundColor: `${data.color}18` }}
      >
        <span role="img">{data.icon}</span>
      </div>

      {/* Info */}
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-semibold truncate" style={{ color: WARM_LITERAL.text }}>
          {data.label}
        </span>
        <span className="text-[11px] truncate leading-tight" style={{ color: WARM_LITERAL.textMuted }}>
          {data.description}
        </span>
      </div>

      {/* Custom badge */}
      {data.isCustom && (
        <span
          className="absolute -top-2 -right-2 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider shadow-sm"
          style={{ backgroundColor: data.color, color: "#fff" }}
        >
          custom
        </span>
      )}
    </div>
  );
}

// ── Custom Edge Component ──

interface FlowEdgeData {
  label?: string;
}

function FlowEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps<FlowEdgeData>) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <BaseEdge
      path={edgePath}
      style={style}
      markerEnd={markerEnd}
    />
  );
}

// ── Node Type Registration ──

const nodeTypes: NodeTypes = {
  agentNode: AgentFlowNode,
};

const edgeTypes: EdgeTypes = {
  flowEdge: FlowEdge,
};

// ── Helper: Build nodes from agent data ──

function buildNodes(
  builtinAgents: ReadonlyArray<AgentMetadata>,
  customAgents: AgentFlowEditorProps["customAgents"],
  agentOrder: ReadonlyArray<string>,
  collaborationMode: string,
): Node<AgentNodeData>[] {
  // Merge all agents: builtins ordered first, then customs
  const allAgents: Array<{
    id: string;
    label: string;
    description: string;
    color: string;
    icon: string;
    status: "ready" | "busy" | "error" | "disabled";
    isCustom: boolean;
  }> = [];

  // Use agentOrder to determine order, or fall back to declaration order
  const orderMap = new Map<string, number>();
  agentOrder.forEach((id, idx) => orderMap.set(id, idx));

  const builtinEntries = builtinAgents
    .filter((a) => orderMap.has(a.role))
    .map((a) => ({
      id: a.role,
      label: a.label,
      description: a.description,
      color: a.color,
      icon: a.icon,
      status: "ready" as const,
      isCustom: false,
      order: orderMap.get(a.role) ?? 999,
    }));

  const customEntries = customAgents
    .filter((a) => orderMap.has(a.id))
    .map((a) => ({
      id: a.id,
      label: a.name,
      description: a.description,
      color: a.color,
      icon: a.icon,
      status: "ready" as const,
      isCustom: true,
      order: orderMap.get(a.id) ?? 999,
    }));

  // Merge and sort by order
  allAgents.push(...builtinEntries, ...customEntries);
  allAgents.sort((a, b) => a.order - b.order);

  // Layout: left-to-right, auto-spacing
  const spacingX = 260;
  const spacingY = 20;
  const startX = 40;
  const startY = 60;

  return allAgents.map((agent, index) => ({
    id: agent.id,
    type: "agentNode" as const,
    position: {
      x: startX + index * spacingX,
      y: startY,
    },
    data: {
      label: agent.label,
      description: agent.description,
      color: agent.color,
      icon: agent.icon,
      status: agent.status,
      isCustom: agent.isCustom,
    },
    draggable: true,
  }));
}

// ── Helper: Build edges from collaboration mode ──

function buildEdges(
  nodes: Node<AgentNodeData>[],
  collaborationMode: string,
): Edge<FlowEdgeData>[] {
  if (nodes.length <= 1) return [];

  const edges: Edge<FlowEdgeData>[] = [];

  for (let i = 0; i < nodes.length - 1; i++) {
    const source = nodes[i];
    const target = nodes[i + 1];

    const isParallel = collaborationMode === "parallel";
    const isConditional = collaborationMode === "hybrid" && i % 3 === 2;

    edges.push({
      id: `e-${source.id}-${target.id}`,
      source: source.id,
      target: target.id,
      type: "flowEdge",
      animated: isParallel || isConditional,
      style: {
        stroke: isConditional ? "#D4A855" : isParallel ? "#6a8ac0" : "#c4b4a0",
        strokeWidth: 2,
        strokeDasharray: isConditional ? "6 3" : isParallel ? "3 3" : undefined,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isConditional ? "#D4A855" : isParallel ? "#6a8ac0" : "#c4b4a0",
      },
      data: {
        label: isConditional
          ? "条件分支"
          : isParallel
            ? "并行"
            : "顺序",
      },
    });
  }

  return edges;
}

// ── Component ──

export function AgentFlowEditor({
  builtinAgents,
  customAgents,
  agentOrder,
  collaborationMode,
  onOrderChange,
  className,
}: AgentFlowEditorProps) {
  const initialNodes = useMemo(
    () => buildNodes(builtinAgents, customAgents, agentOrder, collaborationMode),
    [builtinAgents, customAgents, agentOrder, collaborationMode],
  );
  const initialEdges = useMemo(
    () => buildEdges(initialNodes, collaborationMode),
    [initialNodes, collaborationMode],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const flowWrapperRef = useRef<HTMLDivElement>(null);

  // Track last order updates via drag
  const lastOrderRef = useRef(agentOrder);

  useEffect(() => {
    // Rebuild nodes when props change
    const newNodes = buildNodes(builtinAgents, customAgents, agentOrder, collaborationMode);
    setNodes(newNodes);
    setEdges(buildEdges(newNodes, collaborationMode));
  }, [builtinAgents, customAgents, agentOrder, collaborationMode, setNodes, setEdges]);

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);

      // Detect drag end (position change)
      const positionChanges = changes.filter(
        (c) => c.type === "position" && c.dragging === false,
      );
      if (positionChanges.length > 0 && onOrderChange) {
        // Re-compute order based on X position
        const currentNodes = nodes.map((n) => ({
          id: n.id,
          x: n.position.x,
        }));
        currentNodes.sort((a, b) => a.x - b.x);
        const newOrder = currentNodes.map((n) => n.id);

        // Only trigger if order actually changed
        const oldKey = lastOrderRef.current.join(",");
        const newKey = newOrder.join(",");
        if (oldKey !== newKey) {
          lastOrderRef.current = newOrder;
          onOrderChange(newOrder);
        }
      }
    },
    [nodes, onNodesChange, onOrderChange],
  );

  return (
    <div
      ref={flowWrapperRef}
      data-testid="reactflow"
      className={cn(
        "rounded-xl border overflow-hidden",
        className,
      )}
      style={{ height: 420, backgroundColor: WARM_LITERAL.bg, borderColor: WARM_LITERAL.border }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        attributionPosition="bottom-left"
        defaultEdgeOptions={{
          type: "flowEdge",
        }}
        style={{ backgroundColor: WARM_LITERAL.bg }}
      >
        <Background color="#D4C8B8" gap={20} size={1} />
        <Controls
          showInteractive={false}
          className="[&>button]:border-[#E8D8C8] [&>button]:bg-[#FFFBF7] [&>button]:text-[#3a2a1a]"
        />
        <MiniMap
          nodeColor={(node) => node.data?.color ?? "#c4b4a0"}
          maskColor="rgba(139,58,58,0.06)"
          className="rounded-lg border"
          style={{ width: 120, height: 80, borderColor: WARM_LITERAL.border }}
        />
      </ReactFlow>
    </div>
  );
}

export { type AgentNodeData };
