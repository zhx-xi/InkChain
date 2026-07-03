// ── Continue Writing Panel (Issue #103 — P3-2) ──
//
// AI-assisted chapter continuation panel with multi-candidate display,
// conflict warnings, and candidate selection.

import { useState, useCallback } from "react";
import { useWritingContinue, type ContinueCandidate, type ContinueParams } from "../hooks/use-writing-continue";

// ── Direction Labels ──

const DIRECTION_LABELS: Record<string, string> = {
  expand_dialogue: "扩展对话",
  advance_plot: "推进情节",
  deepen_character: "深化角色",
  world_building: "世界观拓展",
  tension_build: "营造张力",
};

const DIRECTION_COLORS: Record<string, string> = {
  expand_dialogue: "bg-blue-100 text-blue-800",
  advance_plot: "bg-red-100 text-red-800",
  deepen_character: "bg-purple-100 text-purple-800",
  world_building: "bg-green-100 text-green-800",
  tension_build: "bg-orange-100 text-orange-800",
};

const DIMENSION_LABELS: Record<string, string> = {
  world: "世界观",
  character: "角色",
  plot: "情节",
  timeline: "时间线",
  foreshadowing: "伏笔",
};

// ── Props ──

interface ContinueWritingPanelProps {
  bookId: string;
  chapterNumber: number;
  previousChapterContent?: string;
  /** Callback when user selects a candidate to insert */
  onSelect?: (content: string, candidate: ContinueCandidate) => void;
  /** Callback when user wants to rewrite/regenerate */
  onRegenerate?: () => void;
  /** Optional initial direction text */
  initialDirection?: string;
  /** Whether the panel is in a sidebar/compact mode */
  compact?: boolean;
}

// ── Component ──

export function ContinueWritingPanel({
  bookId,
  chapterNumber,
  previousChapterContent,
  onSelect,
  onRegenerate,
  initialDirection,
  compact = false,
}: ContinueWritingPanelProps) {
  const {
    generate,
    preview,
    reset,
    candidates,
    conflicts,
    context,
    loading,
    error,
    hasBlockingConflict,
  } = useWritingContinue();

  const [creativity, setCreativity] = useState(5);
  const [targetLength, setTargetLength] = useState(2000);
  const [style, setStyle] = useState("");
  const [userDirection, setUserDirection] = useState(initialDirection ?? "");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showConflicts, setShowConflicts] = useState(true);

  const handleGenerate = useCallback(async () => {
    setSelectedIndex(null);

    const params: ContinueParams = {
      bookId,
      chapterNumber,
      previousChapterContent,
      creativity,
      length: targetLength,
      style: style || undefined,
      userDirection: userDirection || undefined,
    };

    try {
      await generate(params);
    } catch {
      // Error is handled by the hook
    }
  }, [bookId, chapterNumber, previousChapterContent, creativity, targetLength, style, userDirection, generate]);

  const handleSelect = useCallback((index: number) => {
    setSelectedIndex(index);
    const candidate = candidates[index];
    if (candidate && onSelect) {
      onSelect(candidate.content, candidate);
    }
  }, [candidates, onSelect]);

  const handleReset = useCallback(() => {
    reset();
    setSelectedIndex(null);
  }, [reset]);

  // ── Conflict Summary ──

  const conflictSummary = (() => {
    if (!conflicts.length) return null;
    const errors = conflicts.filter((c) => c.severity === "error");
    const warnings = conflicts.filter((c) => c.severity === "warning");
    const parts: string[] = [];
    if (errors.length) parts.push(`${errors.length} 个冲突`);
    if (warnings.length) parts.push(`${warnings.length} 个警告`);
    return parts.join("，");
  })();

  // ── Render ──

  const panelClasses = compact ? "space-y-3" : "space-y-6";

  return (
    <div className={panelClasses}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-amber-900">AI 续写</h3>
        {(candidates.length > 0 || error) && (
          <button
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            清空
          </button>
        )}
      </div>

      {/* Context summary (when available) */}
      {context && (
        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          {context.worldEntityCount > 0 && (
            <span className="bg-amber-50 px-2 py-0.5 rounded">世界观 {context.worldEntityCount} 实体</span>
          )}
          {context.activeRelationCount > 0 && (
            <span className="bg-blue-50 px-2 py-0.5 rounded">关系 {context.activeRelationCount} 条</span>
          )}
          {context.timelineEventCount > 0 && (
            <span className="bg-green-50 px-2 py-0.5 rounded">时间线 {context.timelineEventCount} 事件</span>
          )}
          {context.activeForeshadowingCount > 0 && (
            <span className="bg-purple-50 px-2 py-0.5 rounded">伏笔 {context.activeForeshadowingCount} 条</span>
          )}
        </div>
      )}

      {/* Parameters */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600 w-16">创意度</label>
          <input
            type="range"
            min={1}
            max={10}
            value={creativity}
            onChange={(e) => setCreativity(Number(e.target.value))}
            className="flex-1"
            disabled={loading}
          />
          <span className="text-sm text-gray-500 w-6 text-right">{creativity}</span>
        </div>

        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600 w-16">目标字数</label>
          <input
            type="number"
            min={100}
            max={20000}
            step={100}
            value={targetLength}
            onChange={(e) => setTargetLength(Number(e.target.value))}
            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
            disabled={loading}
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600 w-16">风格</label>
          <input
            type="text"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="如：悬疑、热血、细腻..."
            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
            disabled={loading}
          />
        </div>

        <div className="flex items-start gap-4">
          <label className="text-sm text-gray-600 w-16 pt-1">方向</label>
          <textarea
            value={userDirection}
            onChange={(e) => setUserDirection(e.target.value)}
            placeholder="可选：对续写的具体方向要求..."
            rows={2}
            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm resize-none"
            disabled={loading}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className={`
            w-full py-2 rounded-lg text-sm font-medium transition-colors
            ${loading
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800"
            }
          `}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              生成中...
            </span>
          ) : (
            "生成续写候选"
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Conflict warnings */}
      {conflicts.length > 0 && showConflicts && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-yellow-800">
              检测到 {conflictSummary}
            </span>
            <button
              onClick={() => setShowConflicts(false)}
              className="text-xs text-yellow-600 hover:text-yellow-800"
            >
              收起
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {conflicts.slice(0, 5).map((conflict, i) => (
              <div key={i} className="text-xs text-yellow-700">
                <span className={conflict.severity === "error" ? "text-red-600 font-medium" : ""}>
                  [{conflict.severity === "error" ? "冲突" : "警告"}]
                </span>{" "}
                {conflict.description}
              </div>
            ))}
            {conflicts.length > 5 && (
              <div className="text-xs text-gray-500">...还有 {conflicts.length - 5} 条</div>
            )}
          </div>
        </div>
      )}

      {/* Candidates */}
      {candidates.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700">
              候选（{candidates.length} 个）
            </h4>
            <span className="text-xs text-gray-400">
              选择后插入编辑器
            </span>
          </div>

          {candidates.map((candidate, index) => (
            <div
              key={index}
              className={`
                border rounded-lg p-4 cursor-pointer transition-all
                ${selectedIndex === index
                  ? "border-amber-500 bg-amber-50 shadow-sm"
                  : "border-gray-200 hover:border-amber-300 hover:shadow-sm"
                }
              `}
              onClick={() => handleSelect(index)}
            >
              {/* Candidate header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">
                    候选项 {index + 1}
                  </span>
                  {candidate.direction && DIRECTION_LABELS[candidate.direction] && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${DIRECTION_COLORS[candidate.direction] ?? "bg-gray-100 text-gray-600"}`}>
                      {DIRECTION_LABELS[candidate.direction] ?? candidate.direction}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  ~{candidate.estimatedWords} 字
                </span>
              </div>

              {/* Summary */}
              {candidate.summary && (
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                  {candidate.summary}
                </p>
              )}

              {/* Preview snippet */}
              <p className="text-sm text-gray-800 mb-2 line-clamp-4 leading-relaxed">
                {candidate.content.slice(0, 200)}
                {candidate.content.length > 200 && "..."}
              </p>

              {/* Dimensions */}
              {candidate.addressedDimensions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {candidate.addressedDimensions.map((dim) => (
                    <span
                      key={dim}
                      className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                    >
                      {DIMENSION_LABELS[dim] ?? dim}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
