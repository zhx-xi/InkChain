import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { GraphNodeData } from "../../store/relations/types";

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
  supporting:  "重要",
  guest:       "次要",
  one_shot:    "客串",
  scene:       "一次性",
};

const DEFAULT_COLOR = { ring: "#71717a", bg: "rgba(113,113,122,0.12)", text: "#71717a" };

export type CharacterNodeData = GraphNodeData;

/**
 * ReactFlow Custom Node for rendering a character in the relation graph.
 * Renders a rounded card with a tier-colored avatar circle, character name,
 * and tier label badge. Includes Handle ports for edge connections.
 */
export function CharacterNode({ data, selected }: NodeProps<CharacterNodeData>) {
  const tier = data.tier ?? "scene";
  const color = TIER_COLORS[tier] ?? DEFAULT_COLOR;
  const label = data.label ?? "";
  const displayLabel = label.length > 8 ? label.slice(0, 8) + "…" : label;

  return (
    <div
      className="relative flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all duration-200 cursor-pointer min-w-[140px] shadow-sm hover:shadow-md"
      style={{
        backgroundColor: color.bg,
        borderColor: selected ? color.ring : `${color.ring}55`,
        borderWidth: selected ? 2 : 1.2,
        ...(selected ? { boxShadow: `0 0 0 2px ${color.ring}40` } : {}),
      }}
    >
      {/* Target handle (left side) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !border-2 !bg-background !border-border !shadow-sm"
      />

      {/* Avatar circle with initial */}
      <div
        className="flex items-center justify-center rounded-full shrink-0"
        style={{
          width: 32,
          height: 32,
          backgroundColor: color.bg,
          border: `1.5px solid ${color.ring}`,
        }}
      >
        <span className="text-xs font-semibold" style={{ color: color.text }}>
          {label.charAt(0) || "?"}
        </span>
      </div>

      {/* Name and tier badge */}
      <div className="flex flex-col min-w-0 gap-0.5">
        <span
          className="text-sm font-medium leading-tight truncate text-foreground"
          style={{ maxWidth: 100 }}
          title={label}
        >
          {displayLabel}
        </span>
        <span className="text-[10px] leading-tight opacity-75" style={{ color: color.text }}>
          {TIER_LABELS[tier] ?? tier}
        </span>
      </div>

      {/* Source handle (right side) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !border-2 !bg-background !border-border !shadow-sm"
      />
    </div>
  );
}

export const MemoCharacterNode = memo(CharacterNode);
