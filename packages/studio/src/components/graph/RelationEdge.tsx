import type { GraphEdgeData } from "../../store/relations/types";

export interface RelationEdgeProps {
  readonly edge: GraphEdgeData;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly isHighlighted: boolean;
}

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

/**
 * SVG edge component for a character relation.
 * Draws a line between two positioned nodes with relation-type color,
 * optional dash for forgotten relations, and a centered label.
 */
export function RelationEdge({
  edge,
  x1,
  y1,
  x2,
  y2,
  isHighlighted,
}: RelationEdgeProps) {
  const color = EDGE_COLORS[edge.relationType] ?? DEFAULT_COLOR;
  const strokeWidth = isHighlighted ? 2.5 : 1.5;
  const opacity = edge.isForgotten ? 0.4 : isHighlighted ? 0.9 : 0.65;

  return (
    <g>
      {/* Invisible wider click/hover target */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="transparent"
        strokeWidth={12}
      />

      {/* Visible edge line */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={edge.isForgotten ? "8 4" : undefined}
        strokeLinecap="round"
        opacity={opacity}
        className="transition-all duration-200"
      />

      {/* Edge label — positioned at midpoint with a subtle background */}
      {edge.label && (
        <>
          <rect
            x={(x1 + x2) / 2 - edge.label.length * 4 - 4}
            y={(y1 + y2) / 2 - 11}
            width={edge.label.length * 8 + 8}
            height={18}
            rx={4}
            fill="rgba(0,0,0,0.35)"
            opacity={opacity}
          />
          <text
            x={(x1 + x2) / 2}
            y={(y1 + y2) / 2 + 4}
            textAnchor="middle"
            dominantBaseline="central"
            fill={color}
            fontSize={10}
            fontWeight={500}
            opacity={opacity}
          >
            {RELATION_LABELS[edge.relationType] ?? edge.label}
          </text>
        </>
      )}

      {/* Forgotten marker icon */}
      {edge.isForgotten && (
        <text
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2 + 14}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#f59e0b"
          fontSize={8}
          opacity={0.7}
        >
          已遗忘
        </text>
      )}
    </g>
  );
}
