import { X } from "lucide-react";
import type { GraphNodeData, GraphEdgeData } from "../../store/relations/types";
import { cn } from "../../lib/utils";

interface DetailPanelProps {
  readonly node: GraphNodeData;
  readonly edges: ReadonlyArray<GraphEdgeData>;
  readonly nodes: ReadonlyArray<GraphNodeData>;
  readonly onClose: () => void;
  readonly className?: string;
}

const TIER_LABELS: Record<string, string> = {
  protagonist: "主角",
  supporting: "重要角色",
  guest: "次要角色",
  one_shot: "客串角色",
  scene: "一次性角色",
};

const RELATION_LABELS: Record<string, string> = {
  close_friend: "挚友",
  rival: "敌对",
  alliance: "联盟",
  mentor: "师徒",
  blood: "血缘",
  secret_crush: "暗恋",
};

const TIER_DOT_COLORS: Record<string, string> = {
  protagonist: "bg-amber-500",
  supporting: "bg-blue-500",
  guest: "bg-indigo-500",
  one_shot: "bg-gray-500",
  scene: "bg-zinc-500",
};

/**
 * Detail side panel that appears when a graph node is selected.
 * Shows character profile, metadata, and a list of connected characters
 * with their relation types.
 */
export function DetailPanel({
  node,
  edges,
  nodes,
  onClose,
  className,
}: DetailPanelProps) {
  // Filter edges connected to this node
  const relatedEdges = edges.filter(
    (e) => e.source === node.id || e.target === node.id,
  );

  return (
    <div
      className={cn(
        "w-72 shrink-0 rounded-xl border border-border/30 bg-card/95 backdrop-blur-sm shadow-xl overflow-hidden animate-in slide-in-from-right-2 mt-[72px]",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Tier dot */}
          <span
            className={cn(
              "inline-block w-2.5 h-2.5 rounded-full shrink-0",
              TIER_DOT_COLORS[node.tier] ?? "bg-zinc-500",
            )}
          />
          <h3 className="text-sm font-semibold text-foreground truncate">
            {node.label}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-background/50 transition-colors"
          aria-label="关闭详情"
        >
          <X size={16} />
        </button>
      </div>

      {/* Tier label */}
      <div className="px-4 pb-2">
        <span className="inline-block text-[11px] text-muted-foreground/70 bg-secondary/50 px-2 py-0.5 rounded-full">
          {TIER_LABELS[node.tier] ?? node.tier}
        </span>
      </div>

      {/* Description */}
      {node.description && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {node.description}
          </p>
        </div>
      )}

      {/* Metadata */}
      <div className="px-4 pb-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground/60">出场章节数</span>
          <span className="text-foreground/80 font-medium">
            {node.chapterAppearances}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground/60">关联关系</span>
          <span className="text-foreground/80 font-medium">
            {relatedEdges.length}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground/60">角色路径</span>
          <span className="text-foreground/60 text-[10px] truncate ml-2 max-w-[140px]">
            {node.rolePath}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-border/20" />

      {/* Related characters */}
      {relatedEdges.length > 0 && (
        <div className="px-4 py-3">
          <p className="text-[11px] font-medium text-muted-foreground/70 mb-2">
            关联角色
          </p>
          <div className="space-y-1.5">
            {relatedEdges.map((edge) => {
              const otherId =
                edge.source === node.id ? edge.target : edge.source;
              const other = nodes.find((n) => n.id === otherId);
              return (
                <div
                  key={edge.id}
                  className="flex items-center gap-2 text-xs bg-background/40 rounded-lg px-2.5 py-1.5"
                >
                  <span
                    className={cn(
                      "inline-block w-2 h-2 rounded-full shrink-0",
                      TIER_DOT_COLORS[other?.tier ?? "scene"],
                    )}
                  />
                  <span className="font-medium text-foreground/70 truncate flex-1">
                    {other?.label ?? "?"}
                  </span>
                  <span className="text-muted-foreground/50 shrink-0">
                    {RELATION_LABELS[edge.relationType] ?? edge.label}
                  </span>
                  {edge.isForgotten && (
                    <span className="text-amber-500/70 text-[10px] shrink-0">
                      遗忘
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state for no relations */}
      {relatedEdges.length === 0 && (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground/40">
            该角色暂无关联关系
          </p>
        </div>
      )}
    </div>
  );
}
