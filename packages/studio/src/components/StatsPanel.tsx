import { useEffect, useState } from "react";
import { fetchJson } from "../hooks/use-api";
import { BarChart3, BookOpen, TrendingUp } from "lucide-react";

interface ChapterWordTrend {
  chapter: number;
  wordCount: number;
  status: string;
}

interface WritingStats {
  bookId: string;
  totalChapters: number;
  totalWords: number;
  avgWordsPerChapter: number;
  wordTrend: ReadonlyArray<ChapterWordTrend>;
  statusDistribution: Record<string, number>;
  topCharacters: ReadonlyArray<{ role: string; count: number }>;
  avgWpm?: number;
}

interface StatsPanelProps {
  readonly bookId: string;
}

const STATUS_LABELS: Record<string, string> = {
  "card-generated": "已生成卡片",
  drafting: "撰写中",
  drafted: "已完稿",
  auditing: "审核中",
  "audit-passed": "审核通过",
  "audit-failed": "需修改",
  approved: "已核准",
  published: "已发布",
};

export function StatsPanel({ bookId }: StatsPanelProps) {
  const [stats, setStats] = useState<WritingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const data = await fetchJson<WritingStats>(`/books/${bookId}/stats`);
        if (cancelled) return;
        setStats(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [bookId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive text-center py-8">
        无法加载统计数据: {error}
      </div>
    );
  }

  if (!stats) return null;

  // Compute max word count for bar chart scaling
  const maxWords = Math.max(...stats.wordTrend.map((w) => w.wordCount), 1);

  // Format status distribution
  const statusEntries = Object.entries(stats.statusDistribution).sort(
    ([, a], [, b]) => b - a,
  );
  const maxStatusCount = Math.max(...statusEntries.map(([, c]) => c), 1);

  return (
    <div className="space-y-6 fade-in">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/20 bg-card/50 p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <BookOpen size={16} />
            <span className="text-xs font-medium">总章节</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {stats.totalChapters}
          </p>
        </div>
        <div className="rounded-xl border border-border/20 bg-card/50 p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <BarChart3 size={16} />
            <span className="text-xs font-medium">总字数</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {stats.totalWords.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-border/20 bg-card/50 p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp size={16} />
            <span className="text-xs font-medium">平均每章</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {stats.avgWordsPerChapter.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Word count trend bar chart */}
      <div className="rounded-xl border border-border/20 bg-card/50 p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          章节字数趋势
        </h3>
        {stats.wordTrend.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            暂无章节数据
          </p>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {stats.wordTrend.map((w) => {
              const heightPct = Math.max((w.wordCount / maxWords) * 100, 4);
              return (
                <div
                  key={w.chapter}
                  className="flex-1 flex flex-col items-center gap-1 group relative"
                >
                  <div
                    className="w-full rounded-t-sm transition-all duration-300 hover:opacity-80"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor:
                        w.status === "approved" || w.status === "published"
                          ? "hsl(142, 71%, 45%)"
                          : w.status === "drafted"
                            ? "hsl(200, 89%, 55%)"
                            : "hsl(35, 92%, 65%)",
                      minHeight: 4,
                    }}
                  />
                  {/* Tooltip on hover */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap bg-card border border-border/20 rounded px-2 py-1 text-[10px] text-foreground shadow-sm">
                    第{w.chapter}章 · {w.wordCount.toLocaleString()}字
                  </div>
                  <span className="text-[9px] text-muted-foreground/60 mt-1">
                    {w.chapter}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/10">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
            <span className="text-[10px] text-muted-foreground">已核准</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
            <span className="text-[10px] text-muted-foreground">已完稿</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
            <span className="text-[10px] text-muted-foreground">其他</span>
          </div>
        </div>
      </div>

      {/* Status distribution */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/20 bg-card/50 p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            状态分布
          </h3>
          {statusEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              暂无数据
            </p>
          ) : (
            <div className="space-y-2">
              {statusEntries.map(([status, count]) => (
                <div key={status} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16 truncate">
                    {STATUS_LABELS[status] ?? status}
                  </span>
                  <div className="flex-1 h-3 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/60 transition-all"
                      style={{
                        width: `${(count / maxStatusCount) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-foreground w-6 text-right">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Writing speed */}
        <div className="rounded-xl border border-border/20 bg-card/50 p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            写作速度
          </h3>
          {stats.avgWpm ? (
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold text-primary">
                {stats.avgWpm}
              </div>
              <div className="text-xs text-muted-foreground">
                字/分钟
                <br />
                <span className="text-[10px] text-muted-foreground/60">
                  (基于写作会话数据)
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              写作速度数据将在更多写作会话后生成
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
