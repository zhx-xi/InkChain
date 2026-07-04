import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { fetchJson } from "../hooks/use-api";
import { ConfirmDialog } from "./ConfirmDialog";
import { X, Clock, RotateCcw, Camera, GitCompare, FileText, Loader2 } from "lucide-react";

// ── Types ──

interface ChapterVersionMeta {
  readonly timestamp: string;
  readonly chapterNum: number;
  readonly wordCount: number;
  readonly label?: string;
}

interface ChapterHistoryPanelProps {
  readonly bookId: string;
  readonly chapterNum: number;
  readonly chapterTitle?: string;
  readonly onClose: () => void;
}

type DiffLineType = "unchanged" | "added" | "removed";

interface DiffLine {
  readonly type: DiffLineType;
  readonly text: string;
}

type PanelTab = "list" | "diff";

// ── Helpers ──

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const time = d.toLocaleTimeString("zh-CN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  return `${date} ${time}`;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return formatTimestamp(iso);
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  // LCS DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const result: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: "unchanged" as const, text: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "added" as const, text: newLines[j - 1] });
      j--;
    } else {
      result.push({ type: "removed" as const, text: oldLines[i - 1] });
      i--;
    }
  }

  return result.reverse();
}

// ── Component ──

export function ChapterHistoryPanel({
  bookId,
  chapterNum,
  chapterTitle,
  onClose,
}: ChapterHistoryPanelProps) {
  const [versions, setVersions] = useState<ReadonlyArray<ChapterVersionMeta>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshotPending, setSnapshotPending] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<ChapterVersionMeta | null>(null);
  const [restorePending, setRestorePending] = useState(false);
  const [tab, setTab] = useState<PanelTab>("list");
  const [selectedForDiff, setSelectedForDiff] = useState<Set<string>>(new Set());

  // Diff state
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffResult, setDiffResult] = useState<{
    oldText: string;
    newText: string;
    oldLabel: string;
    newLabel: string;
    lines: DiffLine[];
  } | null>(null);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<{
        versions: ReadonlyArray<ChapterVersionMeta>;
        chapterNum: number;
      }>(`/books/${bookId}/chapters/${chapterNum}/versions`);
      setVersions(data.versions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load versions");
    } finally {
      setLoading(false);
    }
  }, [bookId, chapterNum]);

  useEffect(() => {
    void fetchVersions();
  }, [fetchVersions]);

  const handleSnapshot = async () => {
    setSnapshotPending(true);
    try {
      await fetchJson(`/books/${bookId}/chapters/${chapterNum}/versions/snapshot`, {
        method: "POST",
      });
      void fetchVersions();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Snapshot failed");
    } finally {
      setSnapshotPending(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setRestorePending(true);
    try {
      await fetchJson(
        `/books/${bookId}/chapters/${chapterNum}/versions/${restoreTarget.timestamp}/restore`,
        { method: "POST" },
      );
      alert(`已从 ${formatTimestamp(restoreTarget.timestamp)} 的版本恢复`);
      setRestoreTarget(null);
      void fetchVersions();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setRestorePending(false);
    }
  };

  const toggleDiffSelection = (timestamp: string) => {
    setSelectedForDiff((prev) => {
      const next = new Set(prev);
      if (next.has(timestamp)) {
        next.delete(timestamp);
      } else {
        if (next.size >= 2) {
          // Replace the first selection
          const first = next.values().next().value;
          if (first) next.delete(first);
        }
        next.add(timestamp);
      }
      return next;
    });
  };

  const handleCompareDiff = async () => {
    const timestamps = Array.from(selectedForDiff);
    if (timestamps.length !== 2) return;
    setDiffLoading(true);
    setDiffResult(null);
    try {
      const [oldTs, newTs] = timestamps.sort(); // older first
      const [oldResp, newResp] = await Promise.all([
        fetchJson<{ content: string; timestamp: string }>(
          `/books/${bookId}/chapters/${chapterNum}/versions/${oldTs}`,
        ),
        fetchJson<{ content: string; timestamp: string }>(
          `/books/${bookId}/chapters/${chapterNum}/versions/${newTs}`,
        ),
      ]);

      const oldVersion = versions.find((v) => v.timestamp === oldTs);
      const newVersion = versions.find((v) => v.timestamp === newTs);

      const lines = computeDiff(oldResp.content, newResp.content);
      setDiffResult({
        oldText: oldResp.content,
        newText: newResp.content,
        oldLabel: oldVersion?.label ?? formatTimestamp(oldTs),
        newLabel: newVersion?.label ?? formatTimestamp(newTs),
        lines,
      });
      setTab("diff");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Diff failed");
    } finally {
      setDiffLoading(false);
    }
  };

  const handleBackToList = () => {
    setTab("list");
    setDiffResult(null);
    setSelectedForDiff(new Set());
  };

  // ── Render: Overlay ──

  const panelContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-[#8B3A3A]/10">
        <div className="flex items-center gap-3 min-w-0">
          <FileText size={18} className="text-[#8B3A3A] shrink-0" />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#2D1B0E] truncate">
              {tab === "diff" ? "版本对比" : `章节履历 — ${chapterTitle ?? `第 ${chapterNum} 章`}`}
            </h2>
            {tab === "list" && (
              <p className="text-xs text-[#8B3A3A]/60 mt-0.5">
                {loading ? "加载中…" : `共 ${versions.length} 个版本`}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#8B3A3A]/50 hover:text-[#8B3A3A] hover:bg-[#8B3A3A]/5 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Tab bar (only visible when in diff mode) */}
      {tab === "diff" && (
        <div className="shrink-0 flex items-center gap-2 px-6 py-2 border-b border-[#8B3A3A]/10 bg-[#8B3A3A]/[0.02]">
          <button
            onClick={handleBackToList}
            className="text-xs font-medium text-[#8B3A3A] hover:underline"
          >
            &larr; 返回版本列表
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {tab === "list" && (
          <div className="p-4 space-y-3">
            {/* Action: Snapshot */}
            <button
              onClick={handleSnapshot}
              disabled={snapshotPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-[#8B3A3A]/10 text-[#8B3A3A] hover:bg-[#8B3A3A]/20 transition-all border border-[#8B3A3A]/20 disabled:opacity-50"
            >
              {snapshotPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Camera size={16} />
              )}
              手动快照
            </button>

            {/* Loading state */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <Loader2 size={24} className="animate-spin text-[#8B3A3A]/40" />
                <span className="text-sm text-[#8B3A3A]/40">加载版本历史…</span>
              </div>
            )}

            {/* Error state */}
            {error && !loading && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
                <button
                  onClick={() => void fetchVersions()}
                  className="ml-2 underline hover:no-underline"
                >
                  重试
                </button>
              </div>
            )}

            {/* No versions */}
            {!loading && !error && versions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <Clock size={32} className="text-[#8B3A3A]/20" />
                <span className="text-sm text-[#8B3A3A]/40">暂无版本记录</span>
                <span className="text-xs text-[#8B3A3A]/30">点击上方按钮创建第一个快照</span>
              </div>
            )}

            {/* Version list */}
            {!loading && !error && versions.length > 0 && (
              <div className="space-y-2">
                {versions.map((version) => {
                  const isSelected = selectedForDiff.has(version.timestamp);
                  const selCount = selectedForDiff.size;
                  return (
                    <div
                      key={version.timestamp}
                      className={`group rounded-xl border p-4 transition-all ${
                        isSelected
                          ? "border-[#8B3A3A]/40 bg-[#8B3A3A]/5 shadow-sm"
                          : "border-[#8B3A3A]/10 bg-white hover:border-[#8B3A3A]/20 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Diff checkbox */}
                        <button
                          onClick={() => toggleDiffSelection(version.timestamp)}
                          className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? "border-[#8B3A3A] bg-[#8B3A3A] text-white"
                              : "border-[#8B3A3A]/30 hover:border-[#8B3A3A]/60"
                          }`}
                          title="选择以对比"
                        >
                          {isSelected && <span className="text-[10px] font-bold">&check;</span>}
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-[#8B3A3A]/50">
                              {formatTimestamp(version.timestamp)}
                            </span>
                            <span className="text-[10px] text-[#8B3A3A]/30">{formatRelativeTime(version.timestamp)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-medium text-[#5C4033]">
                              {(version.wordCount ?? 0).toLocaleString()} 字
                            </span>
                            {version.label && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#8B3A3A]/8 text-[#8B3A3A] border border-[#8B3A3A]/15">
                                {version.label}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Restore button */}
                        <button
                          onClick={() => setRestoreTarget(version)}
                          className="shrink-0 p-1.5 rounded-lg text-[#8B3A3A]/40 hover:text-[#8B3A3A] hover:bg-[#8B3A3A]/10 transition-all opacity-0 group-hover:opacity-100"
                          title="恢复此版本"
                        >
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Compare button */}
                {selectedForDiff.size === 2 && (
                  <div className="sticky bottom-0 pt-2 pb-1 bg-gradient-to-t from-[#FDF6F0] via-[#FDF6F0] to-transparent">
                    <button
                      onClick={handleCompareDiff}
                      disabled={diffLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-[#8B3A3A] text-white hover:bg-[#8B3A3A]/90 transition-all shadow-lg shadow-[#8B3A3A]/20 disabled:opacity-50"
                    >
                      {diffLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <GitCompare size={16} />
                      )}
                      对比选中版本
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "diff" && diffResult && (
          <div className="p-4 space-y-3">
            {/* Diff header info */}
            <div className="flex items-center justify-between text-xs text-[#8B3A3A]/60 px-2">
              <span className="font-medium">旧版: {diffResult.oldLabel}</span>
              <GitCompare size={14} className="text-[#8B3A3A]/40" />
              <span className="font-medium">新版: {diffResult.newLabel}</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-[#8B3A3A]/40 px-2">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-green-200 border border-green-400" />
                新增 ({diffResult.lines.filter((l) => l.type === "added").length})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-red-200 border border-red-400" />
                删除 ({diffResult.lines.filter((l) => l.type === "removed").length})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-gray-100 border border-gray-300" />
                未变 ({diffResult.lines.filter((l) => l.type === "unchanged").length})
              </span>
            </div>

            {/* Diff lines */}
            <div className="rounded-xl border border-[#8B3A3A]/10 overflow-hidden bg-white">
              <div className="max-h-[50vh] overflow-y-auto text-xs font-mono leading-relaxed">
                {diffResult.lines.map((line, i) => (
                  <div
                    key={i}
                    className={`px-4 py-0.5 border-b border-[#8B3A3A]/5 last:border-b-0 whitespace-pre-wrap break-words ${
                      line.type === "added"
                        ? "bg-green-50 text-green-800 border-l-4 border-l-green-400"
                        : line.type === "removed"
                          ? "bg-red-50 text-red-800 border-l-4 border-l-red-400"
                          : "text-gray-600"
                    }`}
                  >
                    {line.text || <span className="opacity-30">&nbsp;</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Copy diff button */}
            <button
              onClick={() => {
                const text = diffResult.lines
                  .map((l) => {
                    const prefix = l.type === "added" ? "+ " : l.type === "removed" ? "- " : "  ";
                    return prefix + l.text;
                  })
                  .join("\n");
                void navigator.clipboard.writeText(text);
                alert("差异已复制到剪贴板");
              }}
              className="w-full px-4 py-2 text-xs font-medium rounded-xl border border-[#8B3A3A]/20 text-[#8B3A3A] hover:bg-[#8B3A3A]/5 transition-all"
            >
              复制差异文本
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {createPortal(
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-black/30 backdrop-blur-sm fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {/* Panel */}
          <div
            className="w-[480px] max-w-[90vw] h-full bg-[#FDF6F0] border-l border-[#8B3A3A]/15 shadow-2xl shadow-[#8B3A3A]/10 flex flex-col animate-slide-in-right"
          >
            {panelContent}
          </div>
        </div>,
        document.body,
      )}

      <ConfirmDialog
        open={restoreTarget !== null}
        title="恢复版本"
        message={
          restoreTarget
            ? `确定将第 ${chapterNum} 章恢复到 ${formatTimestamp(restoreTarget.timestamp)} 的版本吗？当前内容将自动创建快照。`
            : ""
        }
        confirmLabel={restorePending ? "恢复中…" : "恢复"}
        cancelLabel="取消"
        variant="default"
        onConfirm={handleRestore}
        onCancel={() => setRestoreTarget(null)}
      />
    </>
  );
}
