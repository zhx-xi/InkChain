// ── Consistency Check UI Page (Issue #276) ──
//
// Displays consistency check results from POST /api/consistency/check
// with stat cards, filter bar, issue cards, and floating notification.

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { RefreshCw, AlertTriangle, CheckCircle2, Eye, EyeOff, XCircle, Info, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { postApi } from "../hooks/use-api";
import type { ConsistencyIssue, ConsistencyReport, IssueType, IssueSeverity } from "@inkchain/inkchain-core";

// ── Local types ──

type IssueStatus = "pending" | "confirmed" | "ignored";

// ── Constants ──

const SEVERITY_MAP: Record<IssueSeverity, "critical" | "warning" | "info"> = {
  high: "critical",
  medium: "warning",
  low: "info",
};

const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  high: "必须修复",
  medium: "建议关注",
  low: "提示",
};

const TYPE_LABELS: Record<IssueType, string> = {
  character_contradiction: "角色矛盾",
  relationship_break: "关系断裂",
  setting_conflict: "设定冲突",
  timeline_paradox: "时间线悖论",
};

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "全部" },
  { value: "character_contradiction", label: "角色矛盾" },
  { value: "relationship_break", label: "关系断裂" },
  { value: "setting_conflict", label: "设定冲突" },
  { value: "timeline_paradox", label: "时间线悖论" },
];

const SEVERITY_FILTERS: Array<{ value: string; label: string; colorClass: string }> = [
  { value: "all", label: "全部", colorClass: "filter-severity-btn--red" },
  { value: "high", label: "必须修复", colorClass: "filter-severity-btn--red" },
  { value: "medium", label: "建议关注", colorClass: "filter-severity-btn--gold" },
  { value: "low", label: "提示", colorClass: "filter-severity-btn--gray" },
];

// ── Helpers ──

function getIssueSeverityClass(severity: IssueSeverity): string {
  switch (severity) {
    case "high": return "bg-[#C0392B]";
    case "medium": return "bg-[#D4A855]";
    case "low": return "bg-[#A09888]";
  }
}

function getIssueCategoryTagClass(type: IssueType): string {
  switch (type) {
    case "character_contradiction": return "bg-[#FDE8E8] text-[#C0392B]";
    case "relationship_break": return "bg-[#FDF0E0] text-[#D49A3A]";
    case "setting_conflict": return "bg-[#E8EEF8] text-[#3A6B8B]";
    case "timeline_paradox": return "bg-[#F0E8F8] text-[#7B3A9B]";
  }
}

function getSeverityTagClass(severity: IssueSeverity): string {
  switch (severity) {
    case "high": return "bg-[#FDE8E8] text-[#C0392B]";
    case "medium": return "bg-[#FDF0E0] text-[#D49A3A]";
    case "low": return "bg-[#F0F0EE] text-[#A09888]";
  }
}

// ── Components ──

function StatCard({
  label,
  value,
  sub,
  valueColor,
  icon,
}: {
  label: string;
  value: number;
  sub: string;
  valueColor: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-3d-hover">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="opacity-50 w-[18px] h-[18px]">{icon}</span>
      </div>
      <div className={cn("font-serif text-[2rem] font-bold leading-none", valueColor)}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-2">{sub}</div>
    </div>
  );
}

function IssueCard({
  issue,
  status,
  onConfirm,
  onIgnore,
  onLocate,
}: {
  issue: ConsistencyIssue;
  status: IssueStatus;
  onConfirm: () => void;
  onIgnore: () => void;
  onLocate: () => void;
}) {
  const sevClass = SEVERITY_MAP[issue.severity];
  const isConfirmed = status === "confirmed";
  const isIgnored = status === "ignored";

  return (
    <div
      className={cn(
        "flex rounded-xl border border-border bg-card overflow-hidden shadow-soft transition-all",
        isConfirmed && "opacity-65",
        isIgnored && "opacity-50",
      )}
    >
      {/* Severity left border */}
      <div className={cn("w-1 shrink-0", getIssueSeverityClass(issue.severity))} />

      <div className={cn("flex-1 p-5 flex flex-col gap-3", isIgnored && "grayscale")}>
        {/* Title + Tags */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3
              className={cn(
                "text-[15px] font-semibold text-foreground mb-2 leading-tight",
                isConfirmed && "line-through text-muted-foreground",
                isIgnored && "text-muted-foreground",
              )}
            >
              {issue.description.split("\n")[0]}
            </h3>
            <div className="flex gap-2 flex-wrap">
              <span className={cn("tag inline-block text-[11px] font-medium px-[10px] py-[2px] rounded tracking-wider", getIssueCategoryTagClass(issue.type))}>
                {TYPE_LABELS[issue.type]}
              </span>
              <span className={cn("tag inline-block text-[11px] font-medium px-[10px] py-[2px] rounded tracking-wider", getSeverityTagClass(issue.severity))}>
                {SEVERITY_LABELS[issue.severity]}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2">
          {issue.description}
        </p>

        {/* Source locations */}
        {issue.sources.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap text-[12px] text-muted-foreground">
            {issue.sources.map((src, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-muted-foreground">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                {src}
              </span>
            ))}
          </div>
        )}

        {/* Suggestion */}
        {issue.suggestion && (
          <div className="text-[13px] text-muted-foreground p-3 bg-background rounded-lg border-l-[3px] border-[#D4A855]">
            <strong className="font-semibold text-foreground">建议：</strong>
            {issue.suggestion}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 flex-wrap pt-2 border-t border-border">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirmed}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-all",
              isConfirmed
                ? "bg-[#5D8A5D]/10 text-[#5D8A5D] border border-[#5D8A5D]/30 cursor-not-allowed"
                : "bg-[#5D8A5D] text-white border border-[#5D8A5D] hover:bg-[#4D7A4D] shadow-sm",
            )}
          >
            <CheckCircle2 size={14} />
            {isConfirmed ? "已确认" : "确认修复"}
          </button>
          <button
            type="button"
            onClick={onIgnore}
            disabled={isIgnored}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-all border",
              isIgnored
                ? "bg-muted/30 text-muted-foreground/50 border-border cursor-not-allowed"
                : "bg-transparent text-muted-foreground border-border hover:bg-background hover:text-foreground",
            )}
          >
            <EyeOff size={14} />
            {isIgnored ? "已忽略" : "忽略"}
          </button>
          <button
            type="button"
            onClick={onLocate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-all bg-transparent text-muted-foreground border border-transparent hover:bg-background hover:text-foreground"
          >
            <Eye size={14} />
            定位到章节
          </button>
        </div>
      </div>
    </div>
  );
}

function FloatNotif({
  pendingCount,
  onClick,
}: {
  pendingCount: number;
  onClick: () => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  if (pendingCount === 0) return null;

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 z-[200]">
      {panelOpen && (
        <div className="absolute bottom-full right-0 mb-3 w-[340px] bg-card border border-border rounded-xl shadow-3d p-5">
          <h4 className="text-[14px] font-semibold text-foreground mb-3 pb-3 border-b border-border">
            最新检测结果
          </h4>
          <div className="text-[13px] text-muted-foreground">
            <strong className="text-foreground font-semibold">{pendingCount}</strong> 个待处理问题
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setPanelOpen(!panelOpen)}
        className="flex items-center gap-3 px-5 py-3 bg-card border border-border rounded-full shadow-3d hover:shadow-3d-hover hover:-translate-y-0.5 transition-all font-sans"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-[#C0392B] animate-[pulse_2s_ease-in-out_infinite]" />
        <span className="font-serif text-[17px] font-bold text-[#C0392B]">{pendingCount}</span>
        <span className="text-[12px] text-muted-foreground">个待处理</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("w-4 h-4 text-muted-foreground transition-transform", panelOpen && "rotate-180")}>
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
    </div>
  );
}

// ── Main Page Component ──

export function ConsistencyCheck({
  bookId,
  nav,
}: {
  bookId: string;
  nav: {
    toDashboard: () => void;
    [key: string]: unknown;
  };
}) {
  // Data state
  const [issues, setIssues] = useState<ConsistencyIssue[]>([]);
  const [summary, setSummary] = useState("");
  const [score, setScore] = useState(100);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local UI state for issue status (not persisted)
  const [issueStatus, setIssueStatus] = useState<Record<string, IssueStatus>>({});

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  // Floating notification
  const [floatNotifOpen, setFloatNotifOpen] = useState(false);

  const getStatus = useCallback(
    (index: number): IssueStatus => issueStatus[`issue-${index}`] ?? "pending",
    [issueStatus],
  );

  const runCheck = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const result = await postApi<{ report: ConsistencyReport }>("/api/consistency/check", {
        chapter: {
          id: bookId,
          title: "",
          text: "一致性检查",
          characters: [],
        },
      });
      setIssues(result.report.issues);
      setSummary(result.report.summary);
      setScore(result.report.score);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      // Fall back with empty state so the UI still renders
      setIssues([]);
    } finally {
      setScanning(false);
      setLoading(false);
    }
  }, [bookId]);

  // Auto-scan on mount
  useEffect(() => {
    setLoading(true);
    runCheck();
  }, [runCheck]);

  // Filtered issues
  const filteredIssues = useMemo(() => {
    return issues.filter((_, idx) => {
      const catMatch = categoryFilter === "all" || issues[idx].type === categoryFilter;
      const sevMatch = severityFilter === "all" || issues[idx].severity === severityFilter;
      return catMatch && sevMatch;
    });
  }, [issues, categoryFilter, severityFilter]);

  // Stats
  const total = issues.length;
  const pendingCount = issues.filter((_, idx) => getStatus(idx) === "pending").length;
  const confirmedCount = issues.filter((_, idx) => getStatus(idx) === "confirmed").length;
  const ignoredCount = issues.filter((_, idx) => getStatus(idx) === "ignored").length;

  // Handlers
  const handleConfirm = useCallback((index: number) => {
    setIssueStatus((prev) => ({ ...prev, [`issue-${index}`]: "confirmed" }));
  }, []);

  const handleIgnore = useCallback((index: number) => {
    setIssueStatus((prev) => ({ ...prev, [`issue-${index}`]: "ignored" }));
  }, []);

  const handleLocate = useCallback((_index: number) => {
    // Highlight visual feedback only — no actual navigation
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <header className="flex items-center justify-between pb-5 border-b border-border">
        <div>
          <h2 className="font-serif text-[24px] italic font-bold text-foreground tracking-tight">
            <span>叙事一致性检查</span>
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            检测角色状态矛盾、关系断裂、设定冲突 · {scanning ? "扫描中…" : `评分 ${score}/100`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runCheck}
            disabled={scanning}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:shadow-soft transition-all disabled:opacity-50"
            title="重新扫描"
          >
            <RefreshCw size={15} className={cn(scanning && "animate-spin")} />
            扫描
          </button>
        </div>
      </header>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">正在检查叙事一致性…</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">检查失败</p>
              <p className="text-destructive/80">{error}</p>
              <button
                type="button"
                onClick={runCheck}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3.5 py-1.5 text-[12px] font-medium hover:bg-destructive/10 transition-colors"
              >
                <RefreshCw size={13} />
                重试
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content (only show when loaded) */}
      {!loading && (
        <>
          {/* Stat Cards */}
          <section className="grid grid-cols-4 gap-4 max-sm:grid-cols-2 max-[520px]:grid-cols-1">
            <StatCard
              label="总问题"
              value={total}
              sub="本次扫描发现"
              valueColor="text-foreground"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              }
            />
            <StatCard
              label="待处理"
              value={pendingCount}
              sub="需人工确认"
              valueColor="text-[#C0392B]"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              }
            />
            <StatCard
              label="已确认"
              value={confirmedCount}
              sub="已确认待修复"
              valueColor="text-[#5D8A5D]"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              }
            />
            <StatCard
              label="已忽略"
              value={ignoredCount}
              sub="已标记忽略"
              valueColor="text-muted-foreground"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              }
            />
          </section>

          {/* Filter Bar */}
          <section className="flex items-center gap-3 mb-5 p-3 px-4 bg-card border border-border rounded-xl shadow-soft flex-wrap">
            <span className="text-[12px] font-semibold text-muted-foreground">分类</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="appearance-none px-3 py-2 pr-8 rounded-lg border border-border bg-background text-[13px] text-foreground cursor-pointer focus:outline-none focus:border-[#D4A855] bg-[length:12px] bg-no-repeat bg-[right_10px_center]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237A6A5A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              }}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <span className="text-[12px] font-semibold text-muted-foreground ml-2">严重程度</span>
            <div className="flex gap-0.5 bg-background rounded-lg p-0.5">
              {SEVERITY_FILTERS.map((sf) => (
                <button
                  key={sf.value}
                  type="button"
                  onClick={() => setSeverityFilter(sf.value)}
                  className={cn(
                    "px-3 py-2 rounded-[calc(0.6rem-2px)] text-[12px] font-medium transition-all bg-transparent text-muted-foreground hover:text-foreground",
                    severityFilter === sf.value && "bg-card text-foreground shadow-[0_1px_3px_rgba(44,24,16,0.06)]",
                    severityFilter === sf.value && sf.value === "high" && "text-[#C0392B] font-semibold",
                    severityFilter === sf.value && sf.value === "medium" && "text-[#D49A3A] font-semibold",
                    severityFilter === sf.value && sf.value === "low" && "text-muted-foreground font-semibold",
                  )}
                >
                  {sf.label === "必须修复" && <span className="mr-1">⚠</span>}
                  {sf.label}
                </button>
              ))}
            </div>

            <span className="ml-auto text-[12px] text-muted-foreground">
              显示 {filteredIssues.length} 条
            </span>
          </section>

          {/* Issue Card List */}
          <section className="flex flex-col gap-4 mb-8">
            {filteredIssues.length > 0 ? (
              filteredIssues.map((issue, idx) => {
                const realIndex = issues.indexOf(issue);
                return (
                  <IssueCard
                    key={`issue-${realIndex}`}
                    issue={issue}
                    status={getStatus(realIndex)}
                    onConfirm={() => handleConfirm(realIndex)}
                    onIgnore={() => handleIgnore(realIndex)}
                    onLocate={() => handleLocate(realIndex)}
                  />
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 mx-auto mb-4 opacity-30">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <h3 className="font-serif text-[17px] font-semibold text-muted-foreground mb-2">
                  {issues.length === 0 ? "未发现一致性问题" : "暂无匹配问题"}
                </h3>
                <p className="text-[13px]">
                  {issues.length === 0
                    ? "当前没有一致性检查问题。"
                    : "当前筛选条件下未发现一致性检查问题。"}
                </p>
              </div>
            )}
          </section>
        </>
      )}

      {/* Floating Notification */}
      <FloatNotif
        pendingCount={pendingCount}
        onClick={() => setFloatNotifOpen(!floatNotifOpen)}
      />
    </div>
  );
}
