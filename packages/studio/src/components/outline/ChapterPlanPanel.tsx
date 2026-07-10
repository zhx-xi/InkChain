import { useState, useCallback } from "react";
import { postApi } from "../../hooks/use-api";
import type { ChapterPlan } from "@actalk/inkchain-core";
import type { ChapterOutline } from "@actalk/inkchain-core";

// ── Props ──

interface ChapterPlanPanelProps {
  bookId: string;
  /** Called after successful confirm. */
  onConfirm?: (chapters: ChapterOutline[]) => void;
  /** Called to dismiss / close the panel. */
  onClose?: () => void;
}

// ── Helpers ──

function planToOutline(plan: ChapterPlan): ChapterOutline {
  return {
    number: plan.chapterNumber,
    title: plan.title,
    summary: plan.plotPoints.join("\n"),
    wordTarget: plan.wordCount,
    plotLine: "main",
    keyEvents: [],
  };
}

// ── Component ──

export function ChapterPlanPanel({ bookId, onConfirm, onClose }: ChapterPlanPanelProps) {
  const [chapterCount, setChapterCount] = useState(10);
  const [plans, setPlans] = useState<ChapterPlan[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await postApi<{ plans: ChapterPlan[] }>(
        `/books/${bookId}/outline/plan-chapters`,
        { chapterCount },
      );
      setPlans(result.plans);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [bookId, chapterCount]);

  const handleConfirm = useCallback(async () => {
    if (!plans || plans.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const chapters = plans.map(planToOutline);
      await postApi(`/books/${bookId}/outline`, { chapters });
      onConfirm?.(chapters);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [plans, bookId, onConfirm]);

  const handleRegenerate = useCallback(() => {
    setPlans(null);
    handlePlan();
  }, [handlePlan]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          AI 卷纲规划
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="关闭"
          >
            ✕
          </button>
        )}
      </div>

      {/* Chapter count input */}
      <div className="flex items-center gap-3">
        <label
          htmlFor="chapter-count"
          className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap"
        >
          目标章节数
        </label>
        <input
          id="chapter-count"
          type="number"
          min={1}
          max={100}
          value={chapterCount}
          onChange={(e) => setChapterCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
          className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-gray-100"
        />
        <button
          onClick={handlePlan}
          disabled={loading}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "规划中..." : "开始规划"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded border border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Plans */}
      {plans && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerate}
              disabled={loading}
              className="rounded border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              重新生成
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || plans.length === 0}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "保存中..." : "确认并转为大纲"}
            </button>
          </div>

          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {plans.map((plan, idx) => (
              <ChapterPlanCard
                key={plan.chapterNumber}
                plan={plan}
                index={idx}
                onChange={(updated) => {
                  setPlans((prev) => {
                    if (!prev) return prev;
                    const next = [...prev];
                    next[idx] = updated;
                    return next;
                  });
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Chapter Plan Card (editable) ──

interface ChapterPlanCardProps {
  plan: ChapterPlan;
  index: number;
  onChange: (updated: ChapterPlan) => void;
}

function ChapterPlanCard({ plan, onChange }: ChapterPlanCardProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingPlot, setEditingPlot] = useState(false);

  const handleTitleChange = (title: string) => {
    onChange({ ...plan, title });
  };

  const handlePlotPointChange = (i: number, text: string) => {
    const next = [...plan.plotPoints];
    next[i] = text;
    onChange({ ...plan, plotPoints: next });
  };

  const handleAddPlotPoint = () => {
    onChange({ ...plan, plotPoints: [...plan.plotPoints, ""] });
  };

  const handleRemovePlotPoint = (i: number) => {
    const next = plan.plotPoints.filter((_, idx) => idx !== i);
    onChange({ ...plan, plotPoints: next });
  };

  const handleCharsChange = (chars: string) => {
    onChange({
      ...plan,
      characters: chars
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean),
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-sm">
      {/* Chapter header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-xs font-bold text-indigo-700 dark:text-indigo-300">
            {plan.chapterNumber}
          </span>
          {editingTitle ? (
            <input
              type="text"
              value={plan.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
              className="rounded border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-gray-700 px-1.5 py-0.5 text-sm font-medium text-gray-900 dark:text-gray-100"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              {plan.title}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{plan.wordCount.toLocaleString()} 字</span>
          <span>{plan.characters.join(", ")}</span>
        </div>
      </div>

      {/* Plot points */}
      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
        {plan.plotPoints.map((point, i) => (
          <div key={i} className="flex items-start gap-1">
            <span className="mt-0.5 shrink-0 text-gray-400">•</span>
            {editingPlot ? (
              <div className="flex-1 flex items-center gap-1">
                <input
                  type="text"
                  value={point}
                  onChange={(e) => handlePlotPointChange(i, e.target.value)}
                  className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-1.5 py-0.5 text-xs text-gray-900 dark:text-gray-100"
                />
                <button
                  onClick={() => handleRemovePlotPoint(i)}
                  className="text-red-400 hover:text-red-600 text-xs"
                  title="删除剧情点"
                >
                  ✕
                </button>
              </div>
            ) : (
              <span>{point}</span>
            )}
          </div>
        ))}
      </div>

      {/* Edit actions */}
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => setEditingPlot(!editingPlot)}
          className="text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          {editingPlot ? "完成编辑" : "编辑剧情点"}
        </button>
        {editingPlot && (
          <button
            onClick={handleAddPlotPoint}
            className="text-xs text-emerald-500 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            + 添加剧情点
          </button>
        )}
        <button
          onClick={() => {
            const charStr = prompt("输入角色名（用逗号分隔）", plan.characters.join(", "));
            if (charStr !== null) handleCharsChange(charStr);
          }}
          className="text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          编辑角色
        </button>
      </div>
    </div>
  );
}
