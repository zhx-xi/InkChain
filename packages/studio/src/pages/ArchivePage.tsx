// ── ArchivePage ──
// 会话归档管理页面：查看、搜索、解档已归档会话。
//
// 功能：
// 1. 归档会话卡片列表（标题 + 摘要 + 归档日期 + 状态标识）
// 2. 搜索高亮（客户端过滤，调用 HighlightedText）
// 3. 单个解档 / 批量解档（复选框选择 + 确认对话框）
// 4. 排序（按归档日期最新/最早）+ 标签筛选
// 5. 分页 + 空状态

import { useState, useEffect, useCallback, useMemo, useRef, type KeyboardEvent } from "react";
import { Archive, Search, ArrowUpDown, RotateCcw, Check, X, Loader2, Inbox } from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { cn } from "@/lib/utils";
import { HighlightedText } from "../components/SearchPanel";

// ── Types ──

interface SessionSummary {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly status: "active" | "archived";
  readonly archivedAt?: string;
  readonly tags?: string[];
  readonly updatedAt: string;
}

interface ArchiveListResponse {
  readonly sessions: SessionSummary[];
}

// ── Constants ──

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

type SortOrder = "newest" | "oldest";

// ── Helper: format date ──

function formatDate(isoString: string | undefined): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

// ── Helper: format relative time ──

function formatRelativeTime(isoString: string | undefined): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";
    const diff = Date.now() - d.getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} 天前`;
    const months = Math.floor(days / 30);
    return `${months} 个月前`;
  } catch {
    return "";
  }
}

// ── Helper: client-side text search with highlight positions ──

function findMatchPositions(text: string, query: string): Array<{ start: number; end: number }> {
  if (!query || !text) return [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const positions: Array<{ start: number; end: number }> = [];
  let idx = 0;
  while (idx < lowerText.length) {
    const found = lowerText.indexOf(lowerQuery, idx);
    if (found === -1) break;
    positions.push({ start: found, end: found + lowerQuery.length });
    idx = found + lowerQuery.length;
  }
  return positions;
}

// ── Helper: get snippet around first match ──

function getSnippet(text: string, query: string, maxLen = 120): string {
  if (!query || !text) return text.slice(0, maxLen);
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const firstIdx = lowerText.indexOf(lowerQuery);
  if (firstIdx === -1) return text.slice(0, maxLen);

  const snippetStart = Math.max(0, firstIdx - 40);
  const snippetEnd = Math.min(text.length, firstIdx + lowerQuery.length + 60);
  let snippet = text.slice(snippetStart, snippetEnd);
  if (snippetStart > 0) snippet = `…${snippet}`;
  if (snippetEnd < text.length) snippet = `${snippet}…`;
  return snippet;
}

// ── ArchivePage Component ──

export function ArchivePage() {
  // ── State ──
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filteredSessions, setFilteredSessions] = useState<SessionSummary[]>([]);

  // Sort & Filter
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // Selection (batch unarchive)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Confirm dialog
  const [confirmTarget, setConfirmTarget] = useState<{
    type: "single" | "batch";
    sessionId?: string;
    sessionTitle?: string;
  } | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Unarchive loading state (per-session)
  const [unarchivingIds, setUnarchivingIds] = useState<Set<string>>(new Set());
  const [batchUnarchiving, setBatchUnarchiving] = useState(false);

  // ── Fetch archived sessions ──

  const fetchArchivedSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/project/sessions?status=archived");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { error?: { message?: string } })?.error?.message ?? `请求失败 (${res.status})`,
        );
      }
      const data = (await res.json()) as ArchiveListResponse;
      setSessions(data.sessions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchArchivedSessions();
  }, [fetchArchivedSessions]);

  // ── Search / Filter logic (client-side) ──

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      let result = [...sessions];

      // Search filter
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        result = result.filter((s) => {
          const title = s.title.toLowerCase();
          const summary = s.summary.toLowerCase();
          const tags = (s.tags ?? []).map((t) => t.toLowerCase());
          return (
            title.includes(query) ||
            summary.includes(query) ||
            tags.some((t) => t.includes(query))
          );
        });
      }

      // Tag filter
      if (selectedTags.size > 0) {
        result = result.filter((s) =>
          (s.tags ?? []).some((t) => selectedTags.has(t)),
        );
      }

      // Sort
      result.sort((a, b) => {
        const dateA = a.archivedAt ? new Date(a.archivedAt).getTime() : 0;
        const dateB = b.archivedAt ? new Date(b.archivedAt).getTime() : 0;
        return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
      });

      // If search active, sort matched sessions to top
      if (query) {
        const matched: SessionSummary[] = [];
        const unmatched: SessionSummary[] = [];
        for (const s of result) {
          const title = s.title.toLowerCase();
          const summary = s.summary.toLowerCase();
          const tags = (s.tags ?? []).map((t) => t.toLowerCase());
          const isMatch =
            title.includes(query) ||
            summary.includes(query) ||
            tags.some((t) => t.includes(query));
          if (isMatch) matched.push(s);
          else unmatched.push(s);
        }
        result = [...matched, ...unmatched];
      }

      setFilteredSessions(result);
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, sessions, selectedTags, sortOrder]);

  // ── Derive all unique tags from sessions ──

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const s of sessions) {
      for (const t of s.tags ?? []) {
        tagSet.add(t);
      }
    }
    return [...tagSet].sort();
  }, [sessions]);

  // ── Pagination ──

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredSessions.slice(start, start + PAGE_SIZE);
  }, [filteredSessions, currentPage]);

  // ── Selection handlers ──

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedSessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedSessions.map((s) => s.id)));
    }
  };

  // ── Unarchive handlers ──

  const handleUnarchiveSingle = useCallback(
    async (sessionId: string) => {
      setUnarchivingIds((prev) => new Set(prev).add(sessionId));
      try {
        const res = await fetch(`/api/v1/project/sessions/${encodeURIComponent(sessionId)}/unarchive`, {
          method: "POST",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            (body as { error?: { message?: string } })?.error?.message ?? `解档失败 (${res.status})`,
          );
        }
        // Remove from local state
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setUnarchivingIds((prev) => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
      }
    },
    [],
  );

  const handleBatchUnarchive = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBatchUnarchiving(true);
    try {
      // Unarchive sequentially (no batch unarchive API, so call individually)
      for (const id of ids) {
        setUnarchivingIds((prev) => new Set(prev).add(id));
        try {
          const res = await fetch(`/api/v1/project/sessions/${encodeURIComponent(id)}/unarchive`, {
            method: "POST",
          });
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            console.warn(`解档失败: ${id}`, body);
          }
        } catch (e) {
          console.warn(`解档失败: ${id}`, e);
        } finally {
          setUnarchivingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      }
      // Refresh the full list after batch operation
      setSessions((prev) => prev.filter((s) => !ids.includes(s.id)));
      setSelectedIds(new Set());
    } finally {
      setBatchUnarchiving(false);
    }
  }, [selectedIds]);

  // ── Confirm dialog handlers ──

  const handleConfirmUnarchive = useCallback(() => {
    if (!confirmTarget) return;
    if (confirmTarget.type === "single" && confirmTarget.sessionId) {
      void handleUnarchiveSingle(confirmTarget.sessionId);
    } else if (confirmTarget.type === "batch") {
      void handleBatchUnarchive();
    }
    setConfirmTarget(null);
  }, [confirmTarget, handleUnarchiveSingle, handleBatchUnarchive]);

  // ── Search keyboard handlers ──

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setSearchQuery("");
    }
  };

  // ── Clear all filters ──

  const hasActiveFilters = searchQuery.trim().length > 0 || selectedTags.size > 0;

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTags(new Set());
    setSortOrder("newest");
  };

  // ── Render ──

  const query = searchQuery.trim().toLowerCase();

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Archive size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">会话归档</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            管理已归档的会话记录，支持搜索、筛选和解档
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <X size={16} className="mt-0.5 text-destructive shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">加载失败</p>
              <p className="text-xs text-destructive/80 mt-1">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setError(null);
                void fetchArchivedSessions();
              }}
              className="shrink-0 text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* Toolbar: Search + Sort + Tags Filter */}
      <div className="space-y-3">
        {/* Search + Sort Row */}
        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="搜索归档会话…"
              aria-label="搜索归档会话"
              className={cn(
                "w-full h-9 pl-9 pr-8 text-sm rounded-lg",
                "bg-muted/50 border border-input",
                "placeholder:text-muted-foreground/60",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                "transition-colors",
              )}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort Toggle */}
          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"))}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium",
              "border border-input bg-muted/50 hover:bg-muted/80",
              "transition-colors",
            )}
          >
            <ArrowUpDown size={14} />
            <span>{sortOrder === "newest" ? "最新归档" : "最早归档"}</span>
          </button>

          {/* Count Badge */}
          <span className="text-xs text-muted-foreground">
            {loading ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" />
                加载中…
              </span>
            ) : (
              <>
                共 <strong>{sessions.length}</strong> 个归档会话
                {hasActiveFilters && (
                  <span className="text-muted-foreground/60">
                    ，筛选后 <strong>{filteredSessions.length}</strong> 个
                  </span>
                )}
              </>
            )}
          </span>
        </div>

        {/* Tags Filter + Clear */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground shrink-0">标签筛选：</span>
            {allTags.map((tag) => {
              const isActive = selectedTags.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setSelectedTags((prev) => {
                      const next = new Set(prev);
                      if (next.has(tag)) next.delete(tag);
                      else next.add(tag);
                      return next;
                    });
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "bg-muted/50 text-muted-foreground border border-border/50 hover:bg-muted/80",
                  )}
                >
                  {tag}
                  {isActive && <X size={10} />}
                </button>
              );
            })}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors ml-1"
              >
                清除筛选
              </button>
            )}
          </div>
        )}
      </div>

      {/* Batch Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary/50 border border-border">
          <span className="text-sm text-muted-foreground">
            已选择 <strong className="text-foreground">{selectedIds.size}</strong> 个会话
          </span>
          <button
            type="button"
            onClick={() => setConfirmTarget({ type: "batch" })}
            disabled={batchUnarchiving}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {batchUnarchiving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RotateCcw size={14} />
            )}
            <span>批量解档</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            取消选择
          </button>
        </div>
      )}

      {/* Content Area */}
      <div className="space-y-2">
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 size={32} className="animate-spin mb-4" />
            <p className="text-sm">加载归档会话…</p>
          </div>
        )}

        {/* Empty State (no archived sessions at all) */}
        {!loading && !error && sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Inbox size={32} className="text-muted-foreground/40" />
            </div>
            <p className="text-lg font-medium text-foreground/60">暂无归档会话</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              将会话归档后，可以在这里查看和管理
            </p>
          </div>
        )}

        {/* Empty State (filtered, no results) */}
        {!loading && !error && sessions.length > 0 && filteredSessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Search size={32} className="text-muted-foreground/30 mb-4" />
            <p className="text-sm font-medium">没有匹配的归档会话</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              尝试不同的搜索词或调整筛选条件
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              清除筛选条件
            </button>
          </div>
        )}

        {/* Select All Checkbox + Header (when there are results) */}
        {!loading && !error && paginatedSessions.length > 0 && (
          <div className="flex items-center gap-2 px-1 py-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={paginatedSessions.length > 0 && selectedIds.size === paginatedSessions.length}
                onChange={toggleSelectAll}
                className="rounded border-border text-primary focus:ring-primary/30"
              />
              <span className="text-xs text-muted-foreground">全选</span>
            </label>
          </div>
        )}

        {/* Session Cards */}
        {!loading && !error && paginatedSessions.length > 0 && (
          <div className="space-y-2">
            {paginatedSessions.map((session) => {
              const isSelected = selectedIds.has(session.id);
              const isUnarchiving = unarchivingIds.has(session.id);

              // Compute match positions for highlighting
              const titlePositions = query
                ? findMatchPositions(session.title, query)
                : [];
              const summarySnippet = query
                ? getSnippet(session.summary, query)
                : session.summary.slice(0, 120);
              const summaryPositions = query
                ? findMatchPositions(summarySnippet, query)
                : [];

              return (
                <div
                  key={session.id}
                  className={cn(
                    "group relative rounded-lg border transition-all",
                    isSelected
                      ? "border-primary/40 bg-primary/5 shadow-sm"
                      : "border-border/60 bg-card hover:border-border hover:shadow-sm",
                  )}
                >
                  <div className="flex items-start gap-3 p-4">
                    {/* Checkbox for batch selection */}
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(session.id)}
                        className="rounded border-border text-primary focus:ring-primary/30 cursor-pointer"
                        aria-label={`选择 ${session.title}`}
                      />
                    </div>

                    {/* Card Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title Row */}
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-foreground truncate">
                          {query && titlePositions.length > 0 ? (
                            <HighlightedText text={session.title} positions={titlePositions} />
                          ) : (
                            session.title || "（无标题）"
                          )}
                        </h3>
                        {/* Status Badge */}
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          <Archive size={10} />
                          已归档
                        </span>
                      </div>

                      {/* Summary */}
                      {session.summary && (
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                          {query && summaryPositions.length > 0 ? (
                            <HighlightedText text={summarySnippet} positions={summaryPositions} />
                          ) : (
                            session.summary.slice(0, 120)
                          )}
                          {!query && session.summary.length > 120 && "…"}
                        </p>
                      )}

                      {/* Tags + Archive Date Row */}
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {/* Tags */}
                        {(session.tags ?? []).length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {(session.tags ?? []).map((tag) => {
                              const isTagActive = selectedTags.has(tag);
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTags((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(tag)) next.delete(tag);
                                      else next.add(tag);
                                      return next;
                                    });
                                  }}
                                  className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded-full border transition-colors",
                                    isTagActive
                                      ? "bg-primary/15 text-primary border-primary/30"
                                      : "bg-muted/30 text-muted-foreground/70 border-border/40 hover:bg-muted/50",
                                  )}
                                >
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Archived Date */}
                        {session.archivedAt && (
                          <span className="text-[10px] text-muted-foreground/50" title={formatDate(session.archivedAt)}>
                            归档于 {formatRelativeTime(session.archivedAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Unarchive Button */}
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmTarget({
                          type: "single",
                          sessionId: session.id,
                          sessionTitle: session.title || "未命名会话",
                        })
                      }
                      disabled={isUnarchiving}
                      className={cn(
                        "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        "opacity-0 group-hover:opacity-100 focus:opacity-100",
                        "bg-secondary/80 text-foreground hover:bg-secondary border border-border/50",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                      )}
                      title="解档"
                    >
                      {isUnarchiving ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RotateCcw size={14} />
                      )}
                      <span>解档</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && filteredSessions.length > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-2 pt-4 pb-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                "border border-input bg-muted/50 hover:bg-muted/80",
                "disabled:opacity-30 disabled:cursor-not-allowed",
              )}
            >
              上一页
            </button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (currentPage <= 4) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = currentPage - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-xs font-medium transition-colors",
                    currentPage === pageNum
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted/80 border border-transparent",
                  )}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                "border border-input bg-muted/50 hover:bg-muted/80",
                "disabled:opacity-30 disabled:cursor-not-allowed",
              )}
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmTarget !== null}
        title={
          confirmTarget?.type === "single"
            ? "解档会话"
            : "批量解档"
        }
        message={
          confirmTarget?.type === "single"
            ? `确认将会话「${confirmTarget?.sessionTitle ?? ""}」解档？解档后该会话将恢复到活跃会话列表中。`
            : `确认解档已选择的 ${selectedIds.size} 个会话？解档后这些会话将恢复到活跃会话列表中。`
        }
        confirmLabel="确认解档"
        cancelLabel="取消"
        variant="default"
        onConfirm={handleConfirmUnarchive}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
