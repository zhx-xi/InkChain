import { useState } from "react";
import { useApi } from "../../hooks/use-api";
import { Users, ChevronDown, ChevronRight, Star, User, UserPlus } from "lucide-react";

interface CharacterEntry {
  readonly name: string;
  readonly tier: string;
  readonly description: string;
}

interface DashboardData {
  readonly characters?: ReadonlyArray<CharacterEntry>;
}

const TIER_LABELS: Record<string, string> = {
  protagonist: "主角",
  supporting: "重要",
  guest: "客串",
  one_shot: "一次性",
  scene: "场景",
  major: "主要",
  minor: "次要",
};

const TIER_ORDER: Record<string, number> = {
  protagonist: 0,
  supporting: 1,
  guest: 2,
  one_shot: 3,
  scene: 4,
  major: 5,
  minor: 6,
};

function tierIcon(tier: string) {
  if (tier === "protagonist" || tier === "主角") return <Star size={14} className="text-amber-500" />;
  return <User size={14} className="text-muted-foreground" />;
}

function tierBadgeColor(tier: string): string {
  if (tier === "protagonist" || tier === "主角") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  if (tier === "supporting" || tier === "重要") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  if (tier === "guest" || tier === "客串" || tier === "scene" || tier === "场景") return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  return "bg-secondary/50 text-muted-foreground";
}

function formatTierLabel(tier: string): string {
  return TIER_LABELS[tier] ?? tier;
}

export function CharacterWidget({ bookId }: { bookId: string }) {
  const { data, loading } = useApi<DashboardData>(`/books/${bookId}/dashboard`);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const characters = data?.characters ?? [];

  // Group by tier
  const grouped = [...new Set(characters.map((c) => c.tier))]
    .sort((a, b) => (TIER_ORDER[a] ?? 99) - (TIER_ORDER[b] ?? 99))
    .map((tier) => ({
      tier,
      label: formatTierLabel(tier),
      characters: characters.filter((c) => c.tier === tier),
    }))
    .filter((g) => g.characters.length > 0);

  const toggleExpand = (name: string) => {
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

  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Users size={32} className="text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">暂无角色数据</p>
        <p className="text-xs text-muted-foreground/60 mt-1">写作时将自动生成角色</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users size={16} className="text-primary" />
        <span>共 {characters.length} 个角色</span>
      </div>

      {/* Tier groups */}
      <div className="space-y-3">
        {grouped.map((group) => (
          <div key={group.tier}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tierBadgeColor(group.tier)}`}>
                {group.label}
              </span>
              <span className="text-xs text-muted-foreground">{group.characters.length}</span>
            </div>
            <div className="space-y-1">
              {group.characters.slice(0, 8).map((ch) => (
                <div key={ch.name}>
                  <button
                    onClick={() => toggleExpand(ch.name)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors text-left"
                  >
                    {expanded.has(ch.name) ? <ChevronDown size={14} className="shrink-0 text-muted-foreground" /> : <ChevronRight size={14} className="shrink-0 text-muted-foreground" />}
                    {tierIcon(ch.tier)}
                    <span className="text-sm font-medium truncate">{ch.name}</span>
                  </button>
                  {expanded.has(ch.name) && ch.description && (
                    <div className="ml-8 mr-3 mb-2 text-xs text-muted-foreground bg-secondary/20 rounded-lg p-2">
                      {ch.description}
                    </div>
                  )}
                </div>
              ))}
              {group.characters.length > 8 && (
                <div className="text-xs text-muted-foreground/60 text-center pt-1">
                  +{group.characters.length - 8} 个更多
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
