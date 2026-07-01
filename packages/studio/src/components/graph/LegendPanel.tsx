import { useState } from "react";
import { Info, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface LegendPanelProps {
  readonly className?: string;
}

const TIER_LEGEND: ReadonlyArray<{ label: string; color: string }> = [
  { label: "主角", color: "#f59e0b" },
  { label: "重要", color: "#3b82f6" },
  { label: "次要", color: "#6366f1" },
  { label: "客串", color: "#6b7280" },
  { label: "一次性", color: "#71717a" },
];

const RELATION_LEGEND: ReadonlyArray<{ label: string; color: string }> = [
  { label: "挚友", color: "#D4A855" },
  { label: "敌对", color: "#CC4444" },
  { label: "联盟", color: "#4A8FD4" },
  { label: "师徒", color: "#8B3A3A" },
  { label: "血缘", color: "#D4A855" },
  { label: "暗恋", color: "#8888AA" },
];

/**
 * Floating overlay panel showing the tier color legend and relation type
 * color legend. Collapsible — toggled via an info button.
 */
export function LegendPanel({ className }: LegendPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg bg-card/90 border border-border/40 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-card shadow-sm transition-colors"
        aria-label={open ? "收起图例" : "展开图例"}
      >
        <Info size={14} />
        <span>图例</span>
      </button>

      {/* Legend panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-20 w-52 rounded-xl border border-border/30 bg-card/95 backdrop-blur-sm shadow-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-foreground/80">图例</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-0.5 rounded text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Tier legend */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">
              角色等级
            </p>
            <div className="space-y-1.5">
              {TIER_LEGEND.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span
                    className="block shrink-0 rounded-full"
                    style={{
                      width: 10,
                      height: 10,
                      backgroundColor: item.color,
                      opacity: 0.7,
                    }}
                  />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Relation type legend */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">
              关系类型
            </p>
            <div className="space-y-1.5">
              {RELATION_LEGEND.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span
                    className="block shrink-0"
                    style={{
                      width: 16,
                      height: 3,
                      borderRadius: 1.5,
                      backgroundColor: item.color,
                    }}
                  />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Forgotten relation sample */}
          <div className="pt-2 border-t border-border/20">
            <div className="flex items-center gap-2">
              <span
                className="block shrink-0"
                style={{
                  width: 16,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: "#f59e0b",
                  opacity: 0.6,
                }}
              />
              <span className="text-[11px] text-muted-foreground/70">遗忘关系（虚线）</span>
              <span
                className="block shrink-0"
                style={{
                  width: 16,
                  height: 0,
                  borderTop: "2px dashed #f59e0b",
                  opacity: 0.6,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
