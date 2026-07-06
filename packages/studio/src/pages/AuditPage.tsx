// ── 章节审计 Dashboard (Issue #329) ──
// Batch audit support (Issue #365)

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  ThumbsUp,
  ChevronDown,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  XCircle,
  Loader2,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import { fetchJson, postApi } from "../hooks/use-api";

// ── Types ──

interface AuditIssue {
  type: string;
  severity: "info" | "warning" | "error";
  description: string;
  chapterNumber: number;
  location?: string;
}

type AuditStatus = "pending" | "pass" | "warn" | "fail" | "approved";

interface ChapterAuditEntry {
  chapterNumber: number;
  title: string;
  status: AuditStatus;
  issues: AuditIssue[];
  lastAuditedAt: string | null;
  approvedAt: string | null;
}

interface AuditSummary {
  totalChapters: number;
  auditedChapters: number;
  passedChapters: number;
  warnChapters: number;
  failedChapters: number;
}

interface AuditListResponse {
  chapters: ChapterAuditEntry[];
  summary: AuditSummary;
}

interface AuditResponse {
  audit: {
    chapterNumber: number;
    status: AuditStatus;
    issues: AuditIssue[];
    lastAuditedAt?: string;
    approvedAt?: string;
  };
}

interface BatchAuditResponse {
  batchSize: number;
  totalRequested: number;
  skipped: number;
  results: Array<{ chapterNumber: number; status: AuditStatus }>;
}

interface BatchProgress {
  total: number;
  completed: number;
  currentChapter: number | null;
  results: Array<{ chapterNumber: number; status: AuditStatus }>;
}

interface Volume {
  id: string;
  title: string;
  status: string;
  order: number;
}

interface ChapterIndexEntry {
  number: number;
  volumeId: string | null;
}

// ── Helpers ──

const SEVERITY_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string; label: string }> = {
  error: { icon: XCircle, color: "text-red-500", label: "错误" },
  warning: { icon: AlertTriangle, color: "text-amber-500", label: "警告" },
  info: { icon: Info, color: "text-blue-500", label: "提示" },
};

const STATUS_CONFIG: Record<AuditStatus, { color: string; bg: string; label: string }> = {
  pending: { color: "text-muted-foreground", bg: "bg-muted/50", label: "待审计" },
  pass: { color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", label: "通过" },
  warn: { color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30", label: "警告" },
  fail: { color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30", label: "未通过" },
  approved: { color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", label: "已批准" },
};

function statusIcon(status: AuditStatus) {
  switch (status) {
    case "pending": return <AlertCircle size={14} className="text-muted-foreground" />;
    case "pass": return <CheckCircle2 size={14} className="text-emerald-500" />;
    case "warn": return <AlertTriangle size={14} className="text-amber-500" />;
    case "fail": return <XCircle size={14} className="text-red-500" />;
    case "approved": return <ThumbsUp size={14} className="text-blue-500" />;
  }
}

// ── Props ──

interface AuditPageProps {
  readonly bookId: string;
  readonly nav?: {
    toBook: (bookId: string) => void;
    toDashboard: () => void;
  };
}

// ── Component ──

export function AuditPage({ bookId, nav }: AuditPageProps) {
  const [data, setData] = useState<AuditListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  // Location context popup state (PR #428)
  const [contextPopup, setContextPopup] = useState<{
    chapterNumber: number;
    location: string;
    content: string;
    paragraphIndex: number;
    lineIndex: number;
  } | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);

  const handleLocationClick = useCallback(
    async (chapterNumber: number, location: string) => {
      setContextLoading(true);
      setContextError(null);
      try {
        const data = await fetchJson<{ content: string }>(
          `/books/${encodeURIComponent(bookId)}/chapters/${chapterNumber}`,
        );
        const content = data.content;

        // Parse location like "第3段第5行" — extract paragraph and line indices
        const paraMatch = location.match(/(\d+)/g);
        const paragraphIndex = paraMatch && paraMatch.length > 0 ? parseInt(paraMatch[0], 10) - 1 : 0;
        const lineIndex = paraMatch && paraMatch.length > 1 ? parseInt(paraMatch[1], 10) - 1 : 0;

        setContextPopup({
          chapterNumber,
          location,
          content,
          paragraphIndex,
          lineIndex,
        });
      } catch (err) {
        setContextError(err instanceof Error ? err.message : "加载章节内容失败");
      } finally {
        setContextLoading(false);
      }
    },
    [bookId],
  );

  // Audit mode: "rule" (default, fast) or "ai" (deep, thorough) (PR #431)
  const [auditMode, setAuditMode] = useState<"rule" | "ai">("rule");

  // Volume filter state
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [volumeFilter, setVolumeFilter] = useState("");
  const [chapterVolumeMap, setChapterVolumeMap] = useState<Record<number, string>>({});

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Batch audit state
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set());
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);

  const fetchAudit = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchJson<AuditListResponse>(
        `/books/${encodeURIComponent(bookId)}/audit`,
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载审计数据失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookId]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  // Fetch volumes and chapter→volume mapping
  useEffect(() => {
    const init = async () => {
      try {
        const [volsRes, bookRes] = await Promise.all([
          fetchJson<{ volumes: Volume[] }>(`/books/${encodeURIComponent(bookId)}/volumes`),
          fetchJson<{ chapters: ChapterIndexEntry[] }>(`/books/${encodeURIComponent(bookId)}`),
        ]);
        setVolumes(volsRes.volumes);
        const map: Record<number, string> = {};
        for (const ch of bookRes.chapters) {
          if (ch.volumeId) {
            map[ch.number] = ch.volumeId;
          }
        }
        setChapterVolumeMap(map);
      } catch {
        // Volumes are optional – silently ignore failures
      }
    };
    init();
  }, [bookId]);

  const toggleChapter = (chapterNumber: number) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterNumber)) {
        next.delete(chapterNumber);
      } else {
        next.add(chapterNumber);
      }
      return next;
    });
  };

  const handleAudit = async (chapterNumber: number) => {
    const key = `audit-${chapterNumber}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await postApi<AuditResponse>(
        `/books/${encodeURIComponent(bookId)}/chapters/${chapterNumber}/audit${auditMode === "ai" ? `?mode=ai` : ""}`,
      );
      await fetchAudit();
    } catch (err) {
      alert(err instanceof Error ? err.message : "审计失败");
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleApprove = async (chapterNumber: number) => {
    const key = `approve-${chapterNumber}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await postApi<AuditResponse>(
        `/books/${encodeURIComponent(bookId)}/chapters/${chapterNumber}/audit/approve`,
      );
      await fetchAudit();
    } catch (err) {
      alert(err instanceof Error ? err.message : "批准失败");
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleReaudit = async (chapterNumber: number) => {
    const key = `reaudit-${chapterNumber}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await postApi<AuditResponse>(
        `/books/${encodeURIComponent(bookId)}/chapters/${chapterNumber}/audit/reaudit${auditMode === "ai" ? `?mode=ai` : ""}`,
      );
      await fetchAudit();
    } catch (err) {
      alert(err instanceof Error ? err.message : "重新审计失败");
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAudit();
  };

  // ── Batch Selection ──

  const toggleSelection = (chapterNumber: number) => {
    setSelectedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterNumber)) {
        next.delete(chapterNumber);
      } else {
        next.add(chapterNumber);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const chapters = data?.chapters ?? [];
    if (selectedChapters.size === chapters.length) {
      setSelectedChapters(new Set());
    } else {
      setSelectedChapters(new Set(chapters.map((c) => c.chapterNumber)));
    }
  };

  // ── Batch Audit ──

  const handleBatchAudit = async () => {
    if (selectedChapters.size === 0) return;
    const chapterNumbers = Array.from(selectedChapters).sort((a, b) => a - b);

    setBatchProgress({
      total: chapterNumbers.length,
      completed: 0,
      currentChapter: null,
      results: [],
    });

    try {
      // Sequential batch audit: each chapter is audited individually
      // so progress can be tracked per-chapter
      for (let i = 0; i < chapterNumbers.length; i++) {
        const chNum = chapterNumbers[i];
        setBatchProgress((prev) => ({
          ...prev!,
          currentChapter: chNum,
        }));

        await postApi<AuditResponse>(
          `/books/${encodeURIComponent(bookId)}/chapters/${chNum}/audit`,
        );

        setBatchProgress((prev) => ({
          ...prev!,
          completed: i + 1,
          currentChapter: i < chapterNumbers.length - 1 ? chapterNumbers[i + 1] : null,
          results: [
            ...(prev?.results ?? []),
            { chapterNumber: chNum, status: "pass" as AuditStatus },
          ],
        }));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "批量审计失败");
    }

    // Reload audit data
    await fetchAudit();
    setSelectedChapters(new Set());
    setBatchProgress(null);
  };

  // ── Loading State ──

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12 fade-in">
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // ── Error State ──

  if (error && !data) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12 fade-in">
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
          <AlertCircle size={32} className="text-destructive" />
          <p className="text-sm">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  const chapters = data?.chapters ?? [];
  const summary = data?.summary ?? { totalChapters: 0, auditedChapters: 0, passedChapters: 0, warnChapters: 0, failedChapters: 0 };

  // Filter by volume
  const filteredChapters = volumeFilter
    ? chapters.filter((c) => chapterVolumeMap[c.chapterNumber] === volumeFilter)
    : chapters;

  // Pagination
  const totalItems = filteredChapters.reduce((sum, c) => sum + c.issues.length, 0);
  const totalPages = Math.max(1, Math.ceil(filteredChapters.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedChapters = filteredChapters.slice((safePage - 1) * pageSize, safePage * pageSize);

  const allSelected = chapters.length > 0 && selectedChapters.size === chapters.length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          {nav && (
            <button
              onClick={() => nav.toBook(bookId)}
              className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
              title="返回"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
              <ShieldCheck size={22} className="text-primary" />
              章节审计
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              对全书各章节进行质量审计，检查剧情连续性和写作质量
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Audit Mode Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card text-xs text-muted-foreground">
            <span className={auditMode === "rule" ? "text-primary font-medium" : "text-muted-foreground/50"}>规则</span>
            <button
              onClick={() => setAuditMode((m) => m === "rule" ? "ai" : "rule")}
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                auditMode === "ai" ? "bg-primary" : "bg-secondary"
              }`}
              title={auditMode === "ai" ? "切换到规则快速审计" : "切换到 AI 深度审计"}
            >
              <span
                className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
                  auditMode === "ai" ? "translate-x-[14px]" : "translate-x-[2px]"
                }`}
              />
            </button>
            <span className={auditMode === "ai" ? "text-primary font-medium" : "text-muted-foreground/50"}>AI</span>
          </div>
          <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/60 bg-card hover:bg-secondary/30 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          刷新
        </button>
      </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <SummaryCard
          label="总章节"
          value={summary.totalChapters}
          color="text-foreground"
          bg="bg-card"
        />
        <SummaryCard
          label="已审计"
          value={summary.auditedChapters}
          color="text-muted-foreground"
          bg="bg-card"
        />
        <SummaryCard
          label="通过"
          value={summary.passedChapters}
          color="text-emerald-600"
          bg="bg-emerald-50/50 dark:bg-emerald-950/20"
        />
        <SummaryCard
          label="警告"
          value={summary.warnChapters}
          color="text-amber-600"
          bg="bg-amber-50/50 dark:bg-amber-950/20"
        />
        <SummaryCard
          label="未通过"
          value={summary.failedChapters}
          color="text-red-600"
          bg="bg-red-50/50 dark:bg-red-950/20"
        />
      </div>

      {/* ── Volume Filter + Batch Audit Toolbar ── */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-3">
          {/* Volume Filter Dropdown */}
          <select
            value={volumeFilter}
            onChange={(e) => {
              setVolumeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-border/40 bg-background px-3 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            <option value="">全部卷</option>
            {volumes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </select>

          {/* Select All Checkbox */}
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title={allSelected ? "取消全选" : "全选"}
          >
            {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
            <span>{allSelected ? "取消全选" : "全选"}</span>
          </button>
          {selectedChapters.size > 0 && (
            <span className="text-xs text-muted-foreground">
              已选 {selectedChapters.size} 章
            </span>
          )}
        </div>

        {/* Batch Audit Button */}
        {selectedChapters.size > 0 && !batchProgress && (
          <button
            onClick={handleBatchAudit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-all"
          >
            <ShieldCheck size={14} />
            批量审计 ({selectedChapters.size} 章)
          </button>
        )}
      </div>

      {/* ── Batch Progress ── */}
      {batchProgress && (
        <div className="mb-6 p-4 rounded-xl border border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              批量审计中…
            </span>
            <span className="text-xs text-muted-foreground">
              {batchProgress.completed} / {batchProgress.total} 章
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-secondary/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${(batchProgress.completed / batchProgress.total) * 100}%` }}
            />
          </div>
          {batchProgress.currentChapter !== null && (
            <p className="text-xs text-muted-foreground mt-2">
              正在审计第 {batchProgress.currentChapter} 章…
            </p>
          )}
          {/* Result summary */}
          {batchProgress.results.length > 0 && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {batchProgress.results.map((r) => (
                <span
                  key={r.chapterNumber}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    r.status === "pass" ? "bg-emerald-50 text-emerald-600" :
                    r.status === "warn" ? "bg-amber-50 text-amber-600" :
                    r.status === "fail" ? "bg-red-50 text-red-600" :
                    "bg-muted text-muted-foreground"
                  }`}
                >
                  #{r.chapterNumber}
                  {r.status === "pass" && <CheckCircle2 size={10} />}
                  {r.status === "warn" && <AlertTriangle size={10} />}
                  {r.status === "fail" && <XCircle size={10} />}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Chapter Audit List ── */}
      <div className="space-y-2">
        {filteredChapters.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <ShieldCheck size={40} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm">
              {volumeFilter ? "该卷下暂无章节数据" : "暂无章节数据"}
            </p>
          </div>
        )}

        {paginatedChapters.map((chapter) => {
          const statusCfg = STATUS_CONFIG[chapter.status];
          const isExpanded = expandedChapters.has(chapter.chapterNumber);
          const hasIssues = chapter.issues.length > 0;
          const auditKey = `audit-${chapter.chapterNumber}`;
          const approveKey = `approve-${chapter.chapterNumber}`;
          const reauditKey = `reaudit-${chapter.chapterNumber}`;
          const isSelected = selectedChapters.has(chapter.chapterNumber);

          return (
            <div
              key={chapter.chapterNumber}
              className={`rounded-xl border overflow-hidden transition-all ${
                isSelected
                  ? "border-primary/40 ring-1 ring-primary/20"
                  : "border-border/60"
              } ${isExpanded ? "shadow-sm" : ""}`}
            >
              {/* Chapter Header (always visible) */}
              <div className="flex items-center">
                {/* Checkbox */}
                {!batchProgress && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelection(chapter.chapterNumber);
                    }}
                    className="pl-4 py-3.5 text-muted-foreground hover:text-foreground transition-colors"
                    title={isSelected ? "取消选择" : "选择"}
                  >
                    {isSelected ? (
                      <CheckSquare size={16} className="text-primary" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                )}

                <button
                  onClick={() => toggleChapter(chapter.chapterNumber)}
                  className="flex-1 flex items-center gap-3 px-3 py-3.5 text-left hover:bg-secondary/20 transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    chapter.status === "pass" || chapter.status === "approved"
                      ? "bg-emerald-500"
                      : chapter.status === "warn"
                        ? "bg-amber-500"
                        : chapter.status === "fail"
                          ? "bg-red-500"
                          : "bg-gray-300 dark:bg-gray-600"
                  }`} />

                  <span className="text-sm font-medium text-foreground min-w-[4rem]">
                    第{chapter.chapterNumber}章
                  </span>

                  <span className="text-sm text-muted-foreground truncate flex-1">
                    {chapter.title}
                  </span>

                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                    {statusIcon(chapter.status)}
                    {statusCfg.label}
                  </span>

                  {hasIssues && (
                    <span className="text-xs text-muted-foreground/70 shrink-0">
                      {chapter.issues.length} 个问题
                    </span>
                  )}

                  <ChevronDown
                    size={14}
                    className={`text-muted-foreground/50 transition-transform shrink-0 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-border/40 bg-secondary/10">
                  <div className="px-5 py-4 space-y-4">
                    {/* Issues List */}
                    {!hasIssues && chapter.status !== "pending" && (
                      <div className="flex items-center gap-2 text-sm text-emerald-600">
                        <CheckCircle2 size={14} />
                        <span>未发现质量问题</span>
                      </div>
                    )}

                    {hasIssues && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          问题列表
                        </p>
                        {chapter.issues.map((issue, idx) => {
                          const severityCfg = SEVERITY_CONFIG[issue.severity] ?? SEVERITY_CONFIG.info;
                          const SeverityIcon = severityCfg.icon;
                          return (
                            <div
                              key={idx}
                              className="flex gap-3 p-3 rounded-lg bg-card border border-border/40"
                            >
                              <SeverityIcon size={16} className={`shrink-0 mt-0.5 ${severityCfg.color}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${severityCfg.color} bg-current/5`}>
                                    {severityCfg.label}
                                  </span>
                                  <span className="text-xs font-medium text-primary/70">
                                    {issueTypeLabel(issue.type)}
                                  </span>
                                  {issue.location && (
                                    <button
                                      onClick={() => handleLocationClick(chapter.chapterNumber, issue.location!)}
                                      className="text-xs text-primary/70 hover:text-primary underline underline-offset-2 decoration-dotted transition-colors"
                                      title="点击查看上下文"
                                    >
                                      @ {issue.location}
                                    </button>
                                  )}
                                </div>
                                <p className="text-sm text-foreground mt-1">{issue.description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="flex gap-4 text-xs text-muted-foreground/60">
                      {chapter.lastAuditedAt && (
                        <span>审计时间: {new Date(chapter.lastAuditedAt).toLocaleString("zh-CN")}</span>
                      )}
                      {chapter.approvedAt && (
                        <span>批准时间: {new Date(chapter.approvedAt).toLocaleString("zh-CN")}</span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-1">
                      {chapter.status === "pending" && (
                        <ActionButton
                          onClick={() => handleAudit(chapter.chapterNumber)}
                          loading={actionLoading[auditKey]}
                          icon={<ShieldCheck size={14} />}
                          label="开始审计"
                          variant="primary"
                        />
                      )}

                      {(chapter.status === "pass" || chapter.status === "warn" || chapter.status === "fail") && (
                        <>
                          <ActionButton
                            onClick={() => handleApprove(chapter.chapterNumber)}
                            loading={actionLoading[approveKey]}
                            icon={<ThumbsUp size={14} />}
                            label="批准"
                            variant="primary"
                          />
                          <ActionButton
                            onClick={() => handleReaudit(chapter.chapterNumber)}
                            loading={actionLoading[reauditKey]}
                            icon={<RefreshCw size={14} />}
                            label="重新审计"
                            variant="secondary"
                          />
                        </>
                      )}

                      {chapter.status === "approved" && (
                        <ActionButton
                          onClick={() => handleReaudit(chapter.chapterNumber)}
                          loading={actionLoading[reauditKey]}
                          icon={<RefreshCw size={14} />}
                          label="重新审计"
                          variant="secondary"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Pagination ── */}
      {filteredChapters.length > 0 && (
        <div className="flex items-center justify-between px-1 mt-4">
          <span className="text-xs text-muted-foreground">
            第{safePage}页 / 共{totalPages}页 · 总计{totalItems}个问题
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-border/60 bg-card text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              上一页
            </button>
            <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
              {safePage}/{totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-border/60 bg-card text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              下一页
            </button>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-border/40 bg-background px-2 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              <option value={10}>10条/页</option>
              <option value={20}>20条/页</option>
              <option value={50}>50条/页</option>
            </select>
          </div>
        </div>
      )}

      {/* ── Location Context Popup ── */}
      {(contextPopup || contextLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setContextPopup(null);
          }}
        >
          <div className="relative w-full max-w-2xl mx-4 max-h-[80vh] rounded-2xl border border-border/60 bg-card shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  第{contextPopup?.chapterNumber}章 · 上下文
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {contextPopup?.location ?? "加载中…"}
                </p>
              </div>
              <button
                onClick={() => setContextPopup(null)}
                className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                title="关闭"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-80px)]">
              {contextLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">加载章节内容…</span>
                </div>
              )}

              {contextError && (
                <div className="flex flex-col items-center py-8 text-muted-foreground gap-2">
                  <AlertCircle size={20} className="text-destructive" />
                  <p className="text-sm">{contextError}</p>
                  <button
                    onClick={() => setContextPopup(null)}
                    className="text-xs text-primary hover:underline mt-1"
                  >
                    关闭
                  </button>
                </div>
              )}

              {!contextLoading && !contextError && contextPopup && (
                <ContextViewer
                  content={contextPopup.content}
                  paragraphIndex={contextPopup.paragraphIndex}
                  lineIndex={contextPopup.lineIndex}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function SummaryCard({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <div className={`rounded-xl border border-border/60 px-4 py-3.5 ${bg}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
    </div>
  );
}

function ActionButton({
  onClick,
  loading,
  icon,
  label,
  variant,
}: {
  onClick: () => void;
  loading?: boolean;
  icon: React.ReactNode;
  label: string;
  variant: "primary" | "secondary";
}) {
  const baseClass =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:opacity-90"
      : "border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:bg-secondary/30";

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${baseClass}`}
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

function issueTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    continuity: "剧情连贯性",
    logic: "逻辑问题",
    character: "角色设定",
    style: "文风",
    pacing: "节奏",
    grammar: "语法",
    other: "其他",
  };
  return labels[type] ?? type;
}

// ── Context Viewer ──
// Displays chapter content around the issue location with highlighted line.

function ContextViewer({
  content,
  paragraphIndex,
  lineIndex,
}: {
  content: string;
  paragraphIndex: number;
  lineIndex: number;
}) {
  // Split content into paragraphs
  const paragraphs = content.split(/\n{2,}/);
  const para = paragraphs[paragraphIndex];
  if (!para) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        无法定位到指定段落
      </div>
    );
  }

  // Split paragraph into lines
  const lines = para.split("\n");
  const totalLines = lines.length;
  const clampedLine = Math.min(Math.max(lineIndex, 0), totalLines - 1);

  // Determine context window: 3 lines before and after the issue line
  const contextStart = Math.max(clampedLine - 3, 0);
  const contextEnd = Math.min(clampedLine + 4, totalLines); // exclusive end

  const contextLines: Array<{ index: number; text: string; isIssue: boolean }> = [];
  for (let i = contextStart; i < contextEnd; i++) {
    contextLines.push({
      index: i,
      text: lines[i],
      isIssue: i === clampedLine,
    });
  }

  return (
    <div className="font-mono text-sm leading-relaxed space-y-0.5">
      {contextLines.map((line, idx) => (
        <div
          key={idx}
          className={`flex gap-3 px-3 py-1 rounded ${
            line.isIssue
              ? "bg-amber-100 dark:bg-amber-900/30 border-l-2 border-amber-500"
              : ""
          }`}
        >
          <span className="text-xs text-muted-foreground/50 select-none w-8 text-right shrink-0 leading-5">
            {line.index + 1}
          </span>
          <span
            className={`leading-5 whitespace-pre-wrap break-words ${
              line.isIssue
                ? "text-foreground font-medium"
                : "text-muted-foreground/80"
            }`}
          >
            {line.text || "\u00A0"}
          </span>
        </div>
      ))}
    </div>
  );
}
