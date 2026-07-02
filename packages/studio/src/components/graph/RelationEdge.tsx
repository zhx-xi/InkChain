import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import type { GraphEdgeData } from "../../store/relations/types";

/**
 * Edge color mapping by relation type.
 * close_friend & blood share gold; rival is red; alliance is blue;
 * mentor is maroon; secret_crush is muted purple.
 */
const EDGE_COLORS: Record<string, string> = {
  close_friend: "#D4A855",
  rival: "#CC4444",
  alliance: "#4A8FD4",
  mentor: "#8B3A3A",
  blood: "#D4A855",
  secret_crush: "#8888AA",
};

const RELATION_LABELS: Record<string, string> = {
  close_friend: "挚友",
  rival: "敌对",
  alliance: "联盟",
  mentor: "师徒",
  blood: "血缘",
  secret_crush: "暗恋",
};

const DEFAULT_COLOR = "#9ca3af";

export type RelationEdgeData = GraphEdgeData;

/** Render weight stars (1-5). */
function WeightStars({ intensity }: { readonly intensity: number }) {
  return (
    <span style={{ letterSpacing: "1px", fontSize: 9 }}>
      {"★".repeat(Math.min(intensity, 5))}
      {"☆".repeat(Math.max(0, 5 - intensity))}
    </span>
  );
}

/**
 * Resolve the display label for an edge.
 * Priority: customLabel on data > preset label > raw type key.
 */
function resolveLabel(data: GraphEdgeData | undefined): string {
  if (!data) return "";
  if (data.customLabel) return data.customLabel;
  return RELATION_LABELS[data.relationType] ?? data.relationType;
}

/**
 * ReactFlow Custom Edge for rendering a character relation connection.
 * Draws a smooth-step path with relation-type color, optional dash for
 * forgotten relations, and a centered label overlay.
 * Enhanced with:
 * - Custom label support (user-defined relation types)
 * - Weight stars display (intensity 1-5 as ★☆☆☆☆)
 * - Thicker stroke for weight > 3
 */
export function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps<RelationEdgeData>) {
  const color = data?.relationType
    ? EDGE_COLORS[data.relationType] ?? DEFAULT_COLOR
    : DEFAULT_COLOR;
  const isHighlighted = selected;
  const isForgotten = data?.isForgotten ?? false;
  const intensity = data?.intensity ?? 3;

  // Thicker line for stronger relationships
  const baseWidth = intensity >= 4 ? 2.5 : intensity >= 2 ? 1.5 : 1;
  const strokeWidth = isHighlighted ? baseWidth + 1 : baseWidth;
  const opacity = isForgotten ? 0.4 : isHighlighted ? 0.9 : 0.65;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const label = resolveLabel(data);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth,
          strokeDasharray: isForgotten ? "8 4" : undefined,
          strokeLinecap: "round",
          opacity,
        }}
      />

      {/* Edge label with weight stars */}
      {label && (
        <EdgeLabelRenderer>
          <div
            className="absolute px-2 py-0.5 rounded text-[10px] font-medium leading-tight pointer-events-none flex flex-col items-center gap-0.5 min-w-[40px]"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              backgroundColor: "rgba(0,0,0,0.35)",
              color,
              opacity,
            }}
          >
            <span>{label}</span>
            <WeightStars intensity={intensity} />
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Forgotten marker */}
      {isForgotten && (
        <EdgeLabelRenderer>
          <div
            className="absolute px-1.5 py-0.5 rounded text-[9px] font-medium leading-tight pointer-events-none"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + 24}px)`,
              color: "#f59e0b",
              opacity: 0.7,
            }}
          >
            已遗忘
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const MemoRelationEdge = memo(RelationEdge);
