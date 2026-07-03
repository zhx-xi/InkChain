import { useMemo, useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { useHashRoute } from "../hooks/use-hash-route";
import { Search, X, Globe, Plus, Bot, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { useApi, postApi } from "../hooks/use-api";
import type { WorldConfig } from "@actalk/inkos-core";

interface WorldsListResponse {
  readonly worlds: ReadonlyArray<WorldConfig>;
}

const DIMENSION_LABELS: Record<string, string> = {
  settings: "世界观设定",
  roles: "世界角色",
  relations: "世界关系",
  regions: "地理区域",
  institutions: "组织势力",
  history: "历史事件",
  rules: "世界规则",
};

const DIMENSION_COLORS: Record<string, string> = {
  settings: "#4A90D9",
  roles: "#22C55E",
  relations: "#8B5CF6",
  regions: "#E88D3A",
  institutions: "#EC4899",
  history: "#F59E0B",
  rules: "#EF4444",
};

export function WorldListPage({ nav, bookId }: {
  readonly nav?: { toWorldDetail: (id: string) => void; toWorldCreate: () => void; toBook?: (id: string) => void };
  readonly bookId?: string;
}) {
  const { setRoute } = useHashRoute();
  const { data: booksData } = useApi<{ books: ReadonlyArray<{ id: string; title: string }> }>("/api/v1/books");
  const { data, loading, error, refetch } = useApi<WorldsListResponse>(
    bookId ? `/api/books/${encodeURIComponent(bookId)}/worlds` : "/api/worlds",
  );
  const [query, setQuery] = useState("");
  const [showAiExtract, setShowAiExtract] = useState(false);
  const [aiExtractLoading, setAiExtractLoading] = useState(false);
  const [aiExtractError, setAiExtractError] = useState<string | null>(null);
  const [aiExtractResult, setAiExtractResult] = useState<string | null>(null);

  const handleAiExtract = useCallback(async () => {
    if (!bookId) return;
    setAiExtractLoading(true);
    setAiExtractError(null);
    setAiExtractResult(null);
    try {
      const result = await postApi<{ summary: string }>(
        `/api/v1/books/${encodeURIComponent(bookId)}/chapters/1/extract/timeline`,
      );
      setAiExtractResult("世界设定提取功能即将完善，当前版本支持从章节文本提取伏笔和时间线事件。");
    } catch (err) {
      setAiExtractError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiExtractLoading(false);
    }
  }, [bookId]);

  const bookName = useMemo(() => {
    if (!bookId || !booksData?.books) return "";
    return booksData.books.find((b) => b.id === bookId)?.title ?? "";
  }, [bookId, booksData]);

  const filteredWorlds = useMemo(() => {
    const list = data?.worlds ?? [];
    return list.filter((world) => {
      if (query.trim()) {
        const q = query.toLowerCase();
        const nameMatch = world.name.toLowerCase().includes(q);
        const descMatch = (world.description ?? "").toLowerCase().includes(q);
        return nameMatch || descMatch;
      }
      return true;
    });
  }, [data, query]);

  const dimensionCount = (world: WorldConfig, key: string): number => {
    const arr = (world as Record<string, unknown>)[key];
    return Array.isArray(arr) ? arr.length : 0;
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        type="button"
        onClick={() => bookId ? setRoute({ page: "book", bookId }) : setRoute({ page: "dashboard" })}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft size={16} />
        <span>{bookId ? (bookName || "返回书籍") : "返回首页"}</span>
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">
            {bookId ? (bookName ? `${bookName} — 世界设定` : "书籍世界设定") : "世界设定"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {bookId
              ? `该书关联的 ${filteredWorlds.length} 个世界观`
              : "管理世界观配置，7 维度数据驱动小说创作"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setAiExtractResult(null); setAiExtractError(null); setShowAiExtract(true); }}
            className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary shadow-sm transition hover:bg-primary/10"
          >
            <Bot size={16} />
            AI 提取
          </button>
          <button
            type="button"
            onClick={() => {
              // Navigate to world create — use hash-based navigation if nav is available
              if (nav?.toWorldCreate) {
                nav.toWorldCreate();
              } else {
                window.location.hash = "#/worlds/new";
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            新建世界
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索世界名称或描述…"
          className="w-full pl-9 pr-8 py-2 rounded-lg border border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          加载失败：{error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/40 bg-card p-4 space-y-3 animate-pulse">
              <div className="h-5 w-32 bg-muted rounded" />
              <div className="h-3 w-48 bg-muted rounded" />
              <div className="flex gap-2 mt-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-6 w-16 bg-muted rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filteredWorlds.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <Globe size={28} className="text-muted-foreground/40" />
          </div>
          <p className="text-base text-muted-foreground mb-1">
            {query ? "没有符合条件的 World" : bookId ? "该书还没有关联任何世界设定" : "还没有创建任何世界设定"}
          </p>
          <p className="text-sm text-muted-foreground/60 mb-4">
            {query ? "尝试修改搜索词" : bookId ? "在书籍配置中设置 worldId 来关联世界" : "创建您的第一个世界，为小说提供完整的背景设定"}
          </p>
          {!query && !bookId && (
            <button
              type="button"
              onClick={() => {
                if (nav?.toWorldCreate) nav.toWorldCreate();
                else window.location.hash = "#/worlds/new";
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Plus size={16} />
              创建世界
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {!loading && filteredWorlds.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredWorlds.map((world) => (
            <div
              key={world.id}
              className={cn(
                "rounded-xl border border-border/40 bg-card p-5 transition-all cursor-pointer hover:border-border/70 hover:shadow-sm"
              )}
              onClick={() => {
                if (nav?.toWorldDetail) nav.toWorldDetail(world.id);
                else window.location.hash = `#/worlds/${encodeURIComponent(world.id)}`;
              }}
            >
              <h3 className="font-medium text-foreground text-base mb-1">{world.name}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2em]">
                {world.description || "无描述"}
              </p>

              {/* Dimension chips */}
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(DIMENSION_LABELS).map(([key, label]) => {
                  const count = dimensionCount(world, key);
                  return (
                    <span
                      key={key}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                      )}
                      style={{
                        backgroundColor: `${DIMENSION_COLORS[key]}15`,
                        color: DIMENSION_COLORS[key],
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: DIMENSION_COLORS[key] }}
                      />
                      {label} {count}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Extract Modal */}
      {showAiExtract && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/35 backdrop-blur-[2px]">
          <button
            type="button"
            aria-label="关闭"
            className="absolute inset-0 cursor-default"
            onClick={() => setShowAiExtract(false)}
          />
          <div className="relative w-full max-w-lg rounded-xl border border-border/55 bg-card shadow-2xl mx-4">
            <div className="flex items-center justify-between border-b border-border/45 px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">AI 提取世界设定</h2>
              <button
                type="button"
                onClick={() => setShowAiExtract(false)}
                className="p-1 rounded-md text-muted-foreground hover:bg-secondary/60"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                AI 可从章节文本中自动提取伏笔和时间线事件。请使用对应的伏笔页面和时间线页面中的 AI 提取功能。
                {bookId && (
                  <span className="block mt-2">
                    当前书籍：<strong>{bookName || bookId}</strong>
                  </span>
                )}
              </p>

              {aiExtractError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {aiExtractError}
                </div>
              )}

              {aiExtractResult && (
                <div className="rounded-lg border border-border/40 bg-background p-4 text-sm text-foreground">
                  {aiExtractResult}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-border/45 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowAiExtract(false)}
                className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-secondary/60"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
