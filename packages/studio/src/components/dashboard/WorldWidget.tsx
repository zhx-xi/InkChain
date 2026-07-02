import { useState } from "react";
import { useApi } from "../../hooks/use-api";
import { Globe, ChevronDown, ChevronRight, Layers } from "lucide-react";

interface DimensionEntry {
  readonly name: string;
  readonly content: string;
}

interface WorldSummary {
  readonly id: string;
  readonly name: string;
  readonly dimensions: ReadonlyArray<DimensionEntry>;
}

interface DashboardData {
  readonly world?: WorldSummary | null;
}

const DIMENSION_LABELS: Record<string, string> = {
  geography: "地理",
  history: "历史",
  culture: "文化",
  magic: "魔法/科技",
  factions: "势力",
  characters: "人物",
  cosmology: "宇宙观",
};

function dimensionLabel(key: string): string {
  return DIMENSION_LABELS[key.toLowerCase()] ?? key;
}

function dimensionIcon(key: string): string {
  const icons: Record<string, string> = {
    geography: "🌍",
    history: "📜",
    culture: "🎭",
    magic: "✨",
    factions: "⚔️",
    characters: "👥",
    cosmology: "🌌",
  };
  return icons[key.toLowerCase()] ?? "📋";
}

export function WorldWidget({ bookId }: { bookId: string }) {
  const { data, loading } = useApi<DashboardData>(`/books/${bookId}/dashboard`);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const world = data?.world;
  const dimensions = world?.dimensions ?? [];

  const toggleDimension = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!world) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Globe size={32} className="text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">暂无世界观数据</p>
        <p className="text-xs text-muted-foreground/60 mt-1">设置世界观后将在此显示</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Globe size={16} className="text-primary" />
        <span className="font-medium">{world.name}</span>
        <span className="text-xs text-muted-foreground/60">
          {dimensions.length} 个维度
        </span>
      </div>

      {/* Dimension cards */}
      <div className="space-y-2">
        {dimensions.map((dim) => {
          const isExpanded = expanded.has(dim.name);
          const displayContent = isExpanded
            ? dim.content
            : dim.content.slice(0, 100) + (dim.content.length > 100 ? "…" : "");

          return (
            <div
              key={dim.name}
              className="border border-border/40 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => toggleDimension(dim.name)}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-secondary/20 hover:bg-secondary/40 transition-colors text-left"
              >
                <span className="text-base">{dimensionIcon(dim.name)}</span>
                <span className="text-sm font-medium flex-1">
                  {dimensionLabel(dim.name)}
                </span>
                {dim.content.length > 100 && (
                  <span className="text-xs text-muted-foreground">
                    {isExpanded ? "收起" : "展开"}
                  </span>
                )}
                {isExpanded
                  ? <ChevronDown size={14} className="text-muted-foreground" />
                  : <ChevronRight size={14} className="text-muted-foreground" />
                }
              </button>
              {displayContent && (
                <div className="px-4 py-2 text-xs text-muted-foreground leading-relaxed">
                  {displayContent}
                </div>
              )}
              {!displayContent && (
                <div className="px-4 py-2 text-xs text-muted-foreground/50 italic">
                  暂无内容
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
