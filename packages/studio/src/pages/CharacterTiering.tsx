import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchJson } from "../hooks/use-api";
import { TIER_DIR_MAP, TIER_CONFIG, type CharacterTier } from "../lib/truth-display";
import { useHashRoute } from "../hooks/use-hash-route";
import { Plus, Edit3, Share2, Clock } from "lucide-react";

// ── 5-tier badge color scheme (kept in sync with TIER_CONFIG in core) ──

interface TierBadgeStyle {
  readonly dot: string;
  readonly bg: string;
  readonly text: string;
  readonly border: string;
  readonly badgeBg: string;
  readonly badgeText: string;
}

const TIER_STYLE: Record<CharacterTier, TierBadgeStyle> = {
  protagonist: {
    dot: "bg-amber-400",
    bg: "bg-amber-50 dark:bg-amber-500/5",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-500/20",
    badgeBg: "bg-amber-400",
    badgeText: "text-stone-800",
  },
  supporting: {
    dot: "bg-blue-400",
    bg: "bg-blue-50 dark:bg-blue-500/5",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-500/20",
    badgeBg: "bg-blue-400",
    badgeText: "text-white",
  },
  guest: {
    dot: "bg-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-500/5",
    text: "text-indigo-700 dark:text-indigo-400",
    border: "border-indigo-200 dark:border-indigo-500/20",
    badgeBg: "bg-indigo-400",
    badgeText: "text-white",
  },
  one_shot: {
    dot: "bg-gray-400",
    bg: "bg-gray-50 dark:bg-gray-500/5",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200 dark:border-gray-500/20",
    badgeBg: "bg-gray-400",
    badgeText: "text-white",
  },
  scene: {
    dot: "bg-zinc-300",
    bg: "bg-zinc-50 dark:bg-zinc-500/5",
    text: "text-zinc-500 dark:text-zinc-400",
    border: "border-zinc-200 dark:border-zinc-500/20",
    badgeBg: "bg-zinc-300",
    badgeText: "text-white",
  },
};

interface CharacterEntry {
  readonly name: string;
  readonly tier: CharacterTier;
  readonly description: string;
}

// ── Tab definitions ──

interface TabItem {
  readonly id: CharacterTier | "all";
  readonly label: string;
}

const TIER_TABS: ReadonlyArray<TabItem> = [
  { id: "all", label: "全部" },
  { id: "protagonist", label: "主角" },
  { id: "supporting", label: "重要" },
  { id: "guest", label: "次要" },
  { id: "one_shot", label: "客串" },
  { id: "scene", label: "一次性" },
];

// ── Tier sort order ──

const TIER_SORT_ORDER: Record<CharacterTier, number> = {
  protagonist: 1,
  supporting: 2,
  guest: 3,
  one_shot: 4,
  scene: 5,
};

// ── Legend items ──

const TIER_LEGEND: ReadonlyArray<{ tier: CharacterTier; description: string }> = [
  { tier: "protagonist", description: "主角 — 全程推动核心叙事" },
  { tier: "supporting", description: "重要 — 关键段落/支线驱动" },
  { tier: "guest", description: "次要 — 阶段性辅助/转变" },
  { tier: "one_shot", description: "客串 — 场景NPC/群像" },
  { tier: "scene", description: "一次性 — 1-2句出场 · 可归档" },
];

// ── Badge symbol ──

const TIER_SYMBOL: Record<CharacterTier, string> = {
  protagonist: "★",
  supporting: "★",
  guest: "●",
  one_shot: "●",
  scene: "·",
};

// ── Main component ──

interface CharacterTieringProps {
  readonly bookId: string;
}

export function CharacterTiering({ bookId }: CharacterTieringProps) {
  const [characters, setCharacters] = useState<ReadonlyArray<CharacterEntry>>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CharacterTier | "all">("all");
  const { setRoute } = useHashRoute();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchJson<{ characters: ReadonlyArray<{ name: string; tier: string }> }>(
      `/books/${bookId}/characters`,
    )
      .then((data) => {
        if (cancelled) return;
        const parsed: CharacterEntry[] = data.characters
          .map((c) => {
            const tier = TIER_DIR_MAP[c.tier];
            if (!tier) return null;
            return { name: c.name, tier, description: "" };
          })
          .filter((c): c is CharacterEntry => c !== null)
          .sort((a, b) => {
            const orderA = TIER_SORT_ORDER[a.tier];
            const orderB = TIER_SORT_ORDER[b.tier];
            if (orderA !== orderB) return orderA - orderB;
            return a.name.localeCompare(b.name, "zh");
          });
        setCharacters(parsed);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setCharacters([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  // Filter by active tab
  const filteredCharacters = useMemo(() => {
    if (activeTab === "all") return characters;
    return characters.filter((c) => c.tier === activeTab);
  }, [characters, activeTab]);

  // Count per tier
  const tierCounts = useMemo(() => {
    const counts: Partial<Record<CharacterTier, number>> = {};
    for (const c of characters) {
      counts[c.tier] = (counts[c.tier] ?? 0) + 1;
    }
    return counts;
  }, [characters]);

  // Get label for active tab
  const activeLabel = activeTab === "all" ? "全部角色" : (TIER_CONFIG[activeTab]?.label ?? activeTab);

  const handleNavigate = useCallback(
    (page: "relations" | "timeline") => {
      if (page === "relations") {
        setRoute({ page: "relations", bookId });
      } else {
        setRoute({ page: "timeline", bookId });
      }
    },
    [bookId, setRoute],
  );

  // Loading state
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
      {/* Page header */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="font-serif italic text-2xl text-foreground">角色分层管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {characters.length} 个角色 · 5 级出场层级
          </p>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus size={16} />
          新建角色
        </button>
      </div>

      {/* Tier tab bar */}
      <div className="flex gap-1 bg-muted/30 p-1 rounded-lg mb-4">
        {TIER_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tab.id === "all" ? characters.length : (tierCounts[tab.id] ?? 0);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-3.5 py-1.5 rounded-md text-sm transition-all
                ${isActive
                  ? "bg-primary text-primary-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }
              `}
            >
              {tab.label} {count}
            </button>
          );
        })}
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 py-2 mb-2 text-xs text-muted-foreground">
        <span>当前筛选: <strong className="text-foreground">{activeLabel}</strong></span>
        {activeTab !== "all" && (
          <span>
            角色数: <strong className="text-foreground">{filteredCharacters.length}</strong>
          </span>
        )}
        {activeTab === "all" && (
          <span>
            总角色: <strong className="text-foreground">{characters.length}</strong>
          </span>
        )}
      </div>

      {/* Character list */}
      <div className="space-y-1.5">
        {filteredCharacters.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            该层级暂无角色
          </div>
        )}
        {filteredCharacters.map((char) => {
          const style = TIER_STYLE[char.tier];
          const config = TIER_CONFIG[char.tier];
          return (
            <div
              key={`${char.tier}-${char.name}`}
              className={`
                group flex items-center gap-3 rounded-lg border px-4 py-3
                bg-card text-card-foreground
                ${style.border}
                hover:border-primary/50 hover:shadow-sm
                transition-all cursor-pointer
              `}
            >
              {/* Tier badge */}
              <div
                className={`
                  flex items-center justify-center w-6 h-6 rounded-full shrink-0
                  ${style.badgeBg} ${style.badgeText}
                  text-xs font-bold
                `}
              >
                {TIER_SYMBOL[char.tier]}
              </div>

              {/* Character info */}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground">
                  {char.name}
                  <span className="text-xs text-muted-foreground ml-2 font-normal">
                    {config?.label ?? char.tier}
                  </span>
                </span>
                {char.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {char.description}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                  title="编辑"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={() => handleNavigate("relations")}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  title="关系图"
                >
                  <Share2 size={14} />
                </button>
                <button
                  onClick={() => handleNavigate("timeline")}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  title="时间线"
                >
                  <Clock size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tier legend */}
      <div className="flex flex-wrap gap-4 pt-4 mt-4 border-t border-border">
        {TIER_LEGEND.map((item) => {
          const style = TIER_STYLE[item.tier];
          return (
            <div key={item.tier} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={`w-2.5 h-2.5 rounded-full ${style.dot} shrink-0`} />
              <span>{item.description}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
