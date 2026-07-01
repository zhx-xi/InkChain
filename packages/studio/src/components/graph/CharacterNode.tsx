import type { GraphNodeData } from "../../store/relations/types";

export interface CharacterNodeProps {
  readonly nodeData: GraphNodeData;
  readonly x: number;
  readonly y: number;
  readonly nodeWidth?: number;
  readonly nodeHeight?: number;
  readonly isSelected: boolean;
  readonly onClick: (nodeId: string) => void;
}

/**
 * Tier-to-color mappings for the character avatar ring and border.
 * Kept in sync with TIER_CONFIG in truth-display.ts.
 */
const TIER_COLORS: Record<string, { ring: string; bg: string; text: string }> = {
  protagonist: { ring: "#f59e0b", bg: "rgba(245,158,11,0.12)", text: "#f59e0b" },
  supporting:  { ring: "#3b82f6", bg: "rgba(59,130,246,0.12)", text: "#3b82f6" },
  guest:       { ring: "#6366f1", bg: "rgba(99,102,241,0.12)", text: "#6366f1" },
  one_shot:    { ring: "#6b7280", bg: "rgba(107,114,128,0.12)", text: "#6b7280" },
  scene:       { ring: "#71717a", bg: "rgba(113,113,122,0.12)", text: "#71717a" },
};

const TIER_LABELS: Record<string, string> = {
  protagonist: "主角",
  supporting: "重要",
  guest: "次要",
  one_shot: "客串",
  scene: "一次性",
};

const DEFAULT_COLOR = { ring: "#71717a", bg: "rgba(113,113,122,0.12)", text: "#71717a" };

/**
 * SVG-based character node component.
 * Renders a rounded-card with a tier-colored circle avatar, character name,
 * and tier label badge.
 */
export function CharacterNode({
  nodeData,
  x,
  y,
  nodeWidth = 160,
  nodeHeight = 50,
  isSelected,
  onClick,
}: CharacterNodeProps) {
  const color = TIER_COLORS[nodeData.tier] ?? DEFAULT_COLOR;
  const avatarR = 16;
  const avatarCx = x - nodeWidth / 2 + avatarR + 12;
  const avatarCy = y;

  return (
    <g
      onClick={() => onClick(nodeData.id)}
      className="cursor-pointer"
      style={{ cursor: "pointer" }}
    >
      {/* Selection glow ring */}
      {isSelected && (
        <rect
          x={x - nodeWidth / 2 - 4}
          y={y - nodeHeight / 2 - 4}
          width={nodeWidth + 8}
          height={nodeHeight + 8}
          rx={10}
          fill="none"
          stroke={color.ring}
          strokeWidth={3}
          strokeOpacity={0.5}
        >
          <animate
            attributeName="stroke-opacity"
            values="0.3;0.6;0.3"
            dur="2s"
            repeatCount="indefinite"
          />
        </rect>
      )}

      {/* Card body */}
      <rect
        x={x - nodeWidth / 2}
        y={y - nodeHeight / 2}
        width={nodeWidth}
        height={nodeHeight}
        rx={8}
        fill={color.bg}
        stroke={isSelected ? color.ring : color.ring}
        strokeWidth={isSelected ? 2 : 1.2}
        strokeOpacity={isSelected ? 0.9 : 0.35}
        className="transition-all duration-200"
      />

      {/* Tier avatar circle (initials) */}
      <circle
        cx={avatarCx}
        cy={avatarCy}
        r={avatarR}
        fill={color.bg}
        stroke={color.ring}
        strokeWidth={1.5}
      />
      <text
        x={avatarCx}
        y={avatarCy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color.text}
        fontSize={12}
        fontWeight={600}
      >
        {nodeData.label.charAt(0)}
      </text>

      {/* Character name */}
      <text
        x={avatarCx + avatarR + 8}
        y={y - 3}
        textAnchor="start"
        dominantBaseline="auto"
        fill="currentColor"
        fontSize={13}
        fontWeight={500}
      >
        {nodeData.label.length > 8
          ? nodeData.label.slice(0, 8) + "…"
          : nodeData.label}
      </text>

      {/* Tier badge */}
      <text
        x={avatarCx + avatarR + 8}
        y={y + 11}
        textAnchor="start"
        dominantBaseline="auto"
        fill={color.text}
        fontSize={10}
        opacity={0.7}
      >
        {TIER_LABELS[nodeData.tier] ?? nodeData.tier}
      </text>
    </g>
  );
}
