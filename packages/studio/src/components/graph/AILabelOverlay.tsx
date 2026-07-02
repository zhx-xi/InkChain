// ── AI Relation Labeling Overlay (Issue #99 — R-15) ──
//
// Floating panel displayed on the relation graph page that shows
// AI-suggested relation types between character pairs.
// Users can accept or dismiss suggestions.

import { useState, useEffect } from "react";
import { Sparkles, Check, X, Loader2 } from "lucide-react";
import type { RelationSuggestion } from "@actalk/inkos-core";
import { SUGGESTED_RELATION_LABELS } from "@actalk/inkos-core";

interface AILabelOverlayProps {
  readonly bookId: string;
  readonly className?: string;
  /** Callback when a relation is accepted — parent can refresh graph */
  readonly onRelationAccepted?: () => void;
}

type LoadingState = "idle" | "loading" | "loaded" | "error";

/**
 * AI Label Overlay panel for the relation graph page.
 * Triggers AI relation labeling when mounted and displays suggestions
 * that users can accept or dismiss one by one.
 */
export function AILabelOverlay({
  bookId,
  className = "",
  onRelationAccepted,
}: AILabelOverlayProps) {
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [suggestions, setSuggestions] = useState<RelationSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [accepting, setAccepting] = useState(false);

  // Load suggestions on mount
  useEffect(() => {
    loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  async function loadSuggestions() {
    setLoadingState("loading");
    setError(null);
    try {
      const res = await fetch(`/api/v1/books/${encodeURIComponent(bookId)}/suggest-relations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message ?? `请求失败 (${res.status})`);
      }

      const data = await res.json();
      const allSuggestions: RelationSuggestion[] = data.suggestions ?? [];
      // Filter out low-confidence neutral suggestions
      const filtered = allSuggestions.filter(
        (s) => s.suggestedRelation !== "neutral" || s.confidence >= 0.5,
      );

      setSuggestions(filtered);
      setActiveSuggestionIndex(0);
      setLoadingState("loaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoadingState("error");
    }
  }

  const activeSuggestion = suggestions[activeSuggestionIndex];

  async function handleAccept() {
    if (!activeSuggestion || accepting) return;
    setAccepting(true);
    try {
      const res = await fetch(
        `/api/v1/books/${encodeURIComponent(bookId)}/suggest-relations/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestion: activeSuggestion }),
        },
      );

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message ?? `接受失败 (${res.status})`);
      }

      // Move to next suggestion
      setDismissed((prev) => new Set(prev).add(`${activeSuggestionIndex}`));
      advanceToNext();
      onRelationAccepted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAccepting(false);
    }
  }

  function handleDismiss() {
    setDismissed((prev) => new Set(prev).add(`${activeSuggestionIndex}`));
    advanceToNext();
  }

  function advanceToNext() {
    // Find next non-dismissed suggestion
    let next = activeSuggestionIndex + 1;
    while (next < suggestions.length && dismissed.has(`${next}`)) {
      next++;
    }
    if (next < suggestions.length) {
      setActiveSuggestionIndex(next);
    } else {
      // All dismissed — show "all done"
      setActiveSuggestionIndex(suggestions.length);
    }
  }

  // ── Render ──

  if (loadingState === "loading") {
    return (
      <div className={`rounded-xl border border-border/30 bg-card/95 backdrop-blur-sm p-4 shadow-lg ${className}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm">正在分析角色关系...</span>
        </div>
      </div>
    );
  }

  if (loadingState === "error") {
    return (
      <div className={`rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-4 shadow-lg ${className}`}>
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <X className="size-4" />
          <span className="text-sm">加载失败: {error}</span>
        </div>
        <button
          onClick={loadSuggestions}
          className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
        >
          重试
        </button>
      </div>
    );
  }

  if (loadingState === "idle") {
    return null;
  }

  // All suggestions reviewed
  if (activeSuggestionIndex >= suggestions.length) {
    return (
      <div className={`rounded-xl border border-border/30 bg-card/95 backdrop-blur-sm p-4 shadow-lg ${className}`}>
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-amber-500" />
          <span className="text-sm font-medium">AI 标注完成</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          已处理 {suggestions.length} 条关系建议
        </p>
        <button
          onClick={() => { setSuggestions([]); setLoadingState("idle"); }}
          className="mt-2 text-xs text-primary hover:underline"
        >
          关闭
        </button>
      </div>
    );
  }

  if (!activeSuggestion || dismissed.has(`${activeSuggestionIndex}`)) {
    return null;
  }

  const relationLabel =
    SUGGESTED_RELATION_LABELS[activeSuggestion.suggestedRelation] ??
    activeSuggestion.suggestedRelation;

  return (
    <div className={`rounded-xl border border-amber-200/50 bg-amber-50/90 dark:bg-amber-950/30 dark:border-amber-800/30 backdrop-blur-sm p-4 shadow-lg w-72 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-4 text-amber-500" />
          <span className="text-sm font-medium">AI 标注建议</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {activeSuggestionIndex + 1}/{suggestions.length}
        </span>
      </div>

      {/* Suggestion content */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">建议关系</span>
          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
            {relationLabel}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">可信度</span>
          <span className="text-xs font-medium">
            {Math.round(activeSuggestion.confidence * 100)}%
          </span>
        </div>

        {activeSuggestion.evidence.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground block mb-1">依据</span>
            <ul className="text-xs text-foreground/80 space-y-0.5">
              {activeSuggestion.evidence.slice(0, 3).map((e, i) => (
                <li key={i} className="line-clamp-1">· {e}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {error && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-xs font-medium py-1.5 transition-colors"
        >
          {accepting ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Check className="size-3" />
          )}
          接受
        </button>
        <button
          onClick={handleDismiss}
          disabled={accepting}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs font-medium py-1.5 transition-colors"
        >
          <X className="size-3" />
          忽略
        </button>
      </div>
    </div>
  );
}
