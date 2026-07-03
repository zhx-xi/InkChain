// ── Writing Continue Hook (Issue #103 — P3-2) ──
//
// React hook for the continue-writing feature.
// Provides generate, preview, and candidate management.

import { useState, useCallback } from "react";

// ── Types ──

export interface ContinueCandidate {
  content: string;
  summary: string;
  estimatedWords: number;
  addressedDimensions: string[];
  direction: string;
}

export interface ConflictIssue {
  dimension: "world" | "character" | "plot" | "timeline" | "foreshadowing";
  severity: "error" | "warning";
  description: string;
  suggestion: string;
}

export interface ContextStats {
  worldEntityCount: number;
  activeRelationCount: number;
  timelineEventCount: number;
  activeForeshadowingCount: number;
  runtimeFactCount: number;
}

export interface ContinueResult {
  candidates: ContinueCandidate[];
  conflicts: ConflictIssue[];
  context: ContextStats;
}

export interface ContinueParams {
  bookId: string;
  chapterNumber: number;
  previousChapterContent?: string;
  creativity?: number;
  length?: number;
  style?: string;
  userDirection?: string;
}

export interface UseWritingContinueReturn {
  /** Generate continue candidates */
  generate: (params: ContinueParams) => Promise<ContinueResult>;
  /** Preview context without LLM call */
  preview: (bookId: string, chapterNumber: number) => Promise<Record<string, unknown>>;
  /** Select a candidate and return its content */
  selectCandidate: (candidate: ContinueCandidate) => string;
  /** Clear current state */
  reset: () => void;
  /** Current state */
  candidates: ContinueCandidate[];
  conflicts: ConflictIssue[];
  context: ContextStats | null;
  loading: boolean;
  error: string | null;
  /** Whether there are blocking conflicts */
  hasBlockingConflict: boolean;
}

// ── Hook ──

export function useWritingContinue(): UseWritingContinueReturn {
  const [candidates, setCandidates] = useState<ContinueCandidate[]>([]);
  const [conflicts, setConflicts] = useState<ConflictIssue[]>([]);
  const [context, setContext] = useState<ContextStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (params: ContinueParams): Promise<ContinueResult> => {
    setLoading(true);
    setError(null);

    try {
      const baseUrl = buildApiUrl("/api/v1/writing/continue");
      if (!baseUrl) {
        throw new Error("API 服务不可用");
      }

      const response = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "请求失败" }));
        throw new Error(errData.error ?? `请求失败 (${response.status})`);
      }

      const result: ContinueResult = await response.json();
      setCandidates(result.candidates);
      setConflicts(result.conflicts);
      setContext(result.context);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "未知错误";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const preview = useCallback(async (bookId: string, chapterNumber: number): Promise<Record<string, unknown>> => {
    setLoading(true);
    setError(null);

    try {
      const baseUrl = buildApiUrl("/api/v1/writing/continue/preview");
      if (!baseUrl) {
        throw new Error("API 服务不可用");
      }

      const response = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, chapterNumber }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "请求失败" }));
        throw new Error(errData.error ?? `请求失败 (${response.status})`);
      }

      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : "未知错误";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const selectCandidate = useCallback((candidate: ContinueCandidate): string => {
    return candidate.content;
  }, []);

  const reset = useCallback(() => {
    setCandidates([]);
    setConflicts([]);
    setContext(null);
    setLoading(false);
    setError(null);
  }, []);

  const hasBlockingConflict = conflicts.some((c) => c.severity === "error");

  return {
    generate,
    preview,
    selectCandidate,
    reset,
    candidates,
    conflicts,
    context,
    loading,
    error,
    hasBlockingConflict,
  };
}

// ── Helper: build API URL ──

function buildApiUrl(path: string): string | null {
  // Try Vite proxy in dev mode
  if (typeof window !== "undefined" && window.location) {
    const origin = window.location.origin;
    // In dev mode, Vite proxies /api to the backend
    return `${origin}${path}`;
  }
  return null;
}
