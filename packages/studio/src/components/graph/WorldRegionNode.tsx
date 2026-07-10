import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { WorldRegionType } from "@actalk/inkchain-core";

export interface WorldRegionNodeData {
  id: string;
  name: string;
  type: WorldRegionType;
  description: string;
  childCount: number;
}

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  "大陆": { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-400 dark:border-emerald-600", text: "text-emerald-700 dark:text-emerald-300", icon: "🗺️" },
  "国家": { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-400 dark:border-blue-600", text: "text-blue-700 dark:text-blue-300", icon: "🏛️" },
  "城市": { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-400 dark:border-amber-600", text: "text-amber-700 dark:text-amber-300", icon: "🏙️" },
  "地点": { bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-400 dark:border-purple-600", text: "text-purple-700 dark:text-purple-300", icon: "📍" },
};

const DEFAULT_COLOR = { bg: "bg-gray-50 dark:bg-gray-950/30", border: "border-gray-400 dark:border-gray-600", text: "text-gray-700 dark:text-gray-300", icon: "📍" };

function WorldRegionNodeComponent({ data }: NodeProps<WorldRegionNodeData>) {
  const colors = TYPE_COLORS[data.type] ?? DEFAULT_COLOR;
  const truncatedDesc = data.description
    ? data.description.length > 40
      ? data.description.slice(0, 40) + "…"
      : data.description
    : "";

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        className={`rounded-xl border-2 px-4 py-3 min-w-[140px] shadow-sm transition-shadow hover:shadow-md ${colors.bg} ${colors.border}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{colors.icon}</span>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-semibold truncate ${colors.text}`}>
              {data.name || "(未命名)"}
            </div>
            <div className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wide">
              {data.type}
              {data.childCount > 0 && ` · ${data.childCount} 子区域`}
            </div>
          </div>
        </div>
        {truncatedDesc && (
          <p className="text-[10px] text-muted-foreground/50 mt-1.5 leading-tight line-clamp-2">
            {truncatedDesc}
          </p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

export const WorldRegionNode = memo(WorldRegionNodeComponent);
export const MemoWorldRegionNode = WorldRegionNode;
