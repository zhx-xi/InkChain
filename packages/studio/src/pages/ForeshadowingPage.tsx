import { useMemo, useState, useCallback, useEffect } from "react";
import { ArrowLeft, RotateCw } from "lucide-react";
import { useHashRoute } from "../hooks/use-hash-route";
import {
  Search, X, Sparkles, Plus, AlertTriangle, CheckCircle2, Clock,
  XCircle, Eye, EyeOff, Loader2, Bot, Network,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useApi, fetchJson, postApi } from "../hooks/use-api";
import type { Foreshadowing, ForeshadowingType, ForeshadowingStatus } from "@actalk/inkchain-core/models/foreshadowing.js";
import {
  FORESHADOWING_TYPE_LABELS,
  FORESHADOWING_STATUS_LABELS,
  ForeshadowingTypeEnum,
  ForeshadowingStatusEnum,
} from "@actalk/inkchain-core/models/foreshadowing.js";

interface ForeshadowingResponseItem extends Foreshadowing {
  _forgotten?: boolean;
}

interface ForeshadowingListResponse {
  readonly foreshadowing: ReadonlyArray<ForeshadowingResponseItem>;
  readonly total: number;
  readonly currentChapter: number | null;
}

interface ForeshadowingExtractCandidate {
  title: string;
  type: string;
  description: string;
  expectedPayoffChapter: number | null;
  lastMentionedChapter?: number;
  confidence: number;
  chapter?: number;
}

interface ForeshadowingRelation {
  type: string;
  sourceIdx: number;
  targetIdx: number;
  label: string;
}

const TYPE_COLORS: Record<ForeshadowingType, string> = {
  "情节伏笔": "#4A90D9",
  "角色伏笔": "#E88D3A",
  "物品伏笔": "#22C55E",
  "设定伏笔": "#8B5CF6",
};

const TYPE_BG: Record<ForeshadowingType, string> = {
  "情节伏笔": "bg-[#4A90D9]/10 text-[#4A90D9]",
  "角色伏笔": "bg-[#E88D3A]/10 text-[#E88D3A]",
  "物品伏笔": "bg-[#22C55E]/10 text-[#22C55E]",
  "设定伏笔": "bg-[#8B5CF6]/10 text-[#8B5CF6]",
};

const STATUS_ICONS: Record<ForeshadowingStatus, React.ReactNode> = {
  active: <Clock size={14} />,
  paid_off: <CheckCircle2 size={14} />,
  abandoned: <XCircle size={14} />,
};

const STATUS_COLORS: Record<ForeshadowingStatus, string> = {
  active: "text-amber-500",
  paid_off: "text-emerald-500",
  abandoned: "text-muted-foreground/50",
};

function CreateForeshadowingModal({
  isOpen,
  onClose,
  onSaved,
  currentChapter,
  bookId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  currentChapter: number;
  bookId: string;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ForeshadowingType>("情节伏笔");
  const [createdChapter, setCreatedChapter] = useState(currentChapter);
  const [expectedPayoffChapter, setExpectedPayoffChapter] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setTitle("");
    setDescription("");
    setType("情节伏笔");
    setCreatedChapter(currentChapter);
    setExpectedPayoffChapter(null);
    setNotes("");
    setError(null);
  }, [currentChapter]);

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen, reset]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setError("伏笔标题不能为空");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = `fs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await fetchJson("/api/foreshadowing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          bookId,
          title: title.trim(),
          description,
          type,
          createdChapter,
          expectedPayoffChapter,
          notes,
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [title, description, type, createdChapter, expectedPayoffChapter, notes, bookId, onSaved, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/35 backdrop-blur-[2px]" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-xl border border-border/55 bg-card shadow-2xl mx-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border/45 px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">创建伏笔</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:bg-secondary/60">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">标题 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="伏笔名称"
              className="mt-1 w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="伏笔描述"
              rows={3}
              className="mt-1 w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">类型</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ForeshadowingType)}
                className="mt-1 w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
              >
                {ForeshadowingTypeEnum.options.map((t) => (
                  <option key={t} value={t}>{FORESHADOWING_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">创建章节</label>
              <input
                type="number"
                min={0}
                value={createdChapter}
                onChange={(e) => setCreatedChapter(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">预期回收章节（可选）</label>
            <input
              type="number"
              min={0}
              value={expectedPayoffChapter ?? ""}
              onChange={(e) => setExpectedPayoffChapter(e.target.value ? Number(e.target.value) : null)}
              placeholder="不填表示未定"
              className="mt-1 w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">备注</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="额外备注"
              rows={2}
              className="mt-1 w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 transition-colors resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border/45 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-secondary/60 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            创建
          </button>
        </div>
      </div>
    </div>
  );
}

function EditForeshadowingModal({
  entry,
  currentChapter,
  isOpen,
  onClose,
  onSaved,
}: {
  entry: Foreshadowing | null;
  currentChapter: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Foreshadowing | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (entry) {
      setDraft({ ...entry });
      setError(null);
    }
  }, [entry]);

  const hasChanges = useMemo(() => {
    if (!entry || !draft) return false;
    return JSON.stringify(entry) !== JSON.stringify(draft);
  }, [entry, draft]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await fetchJson(`/api/foreshadowing/${encodeURIComponent(draft.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          type: draft.type,
          status: draft.status,
          expectedPayoffChapter: draft.expectedPayoffChapter,
          lastMentionedChapter: draft.lastMentionedChapter,
          notes: draft.notes,
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [draft, onSaved, onClose]);

  const handlePayoff = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await fetchJson(`/api/foreshadowing/${encodeURIComponent(draft.id)}/payoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoffChapter: currentChapter }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [draft, currentChapter, onSaved, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !draft) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/35 backdrop-blur-[2px]" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-xl border border-border/55 bg-card shadow-2xl mx-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border/45 px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">编辑伏笔</h2>
          <div className="flex items-center gap-2">
            {draft.status === "active" && (
              <button
                type="button"
                onClick={handlePayoff}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <CheckCircle2 size={14} />
                标记回收
              </button>
            )}
            <button type="button" onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:bg-secondary/60">
              <X size={18} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">标题</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="伏笔名称"
              className="mt-1 w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">描述</label>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">类型</label>
              <select
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as ForeshadowingType })}
                className="mt-1 w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
              >
                {ForeshadowingTypeEnum.options.map((t) => (
                  <option key={t} value={t}>{FORESHADOWING_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">状态</label>
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as ForeshadowingStatus })}
                className="mt-1 w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
              >
                {ForeshadowingStatusEnum.options.map((s) => (
                  <option key={s} value={s}>{FORESHADOWING_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">最近提及章节</label>
              <input
                type="number"
                min={0}
                value={draft.lastMentionedChapter}
                onChange={(e) => setDraft({ ...draft, lastMentionedChapter: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">预期回收章节</label>
              <input
                type="number"
                min={0}
                value={draft.expectedPayoffChapter ?? ""}
                onChange={(e) => setDraft({ ...draft, expectedPayoffChapter: e.target.value ? Number(e.target.value) : null })}
                className="mt-1 w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">备注</label>
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border/45 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-secondary/60"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export function ForeshadowingPage({ bookId }: { bookId: string }) {
  const { setRoute } = useHashRoute();
  // Fetch actual chapter count from book data (dynamic, not hardcoded 999)
  const { data: bookChapterData } = useApi<{ nextChapter: number }>(
    `/api/v1/books/${encodeURIComponent(bookId)}`,
  );
  const actualChapterCount = bookChapterData
    ? Math.max(0, bookChapterData.nextChapter - 1)
    : 0;
  const effectiveChapter = Math.max(1, actualChapterCount);

  const { data, loading, error, refetch } = useApi<ForeshadowingListResponse>(
    `/api/foreshadowing?bookId=${encodeURIComponent(bookId)}&currentChapter=${effectiveChapter}`,
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ForeshadowingStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | ForeshadowingType>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Foreshadowing | null>(null);
  const [showAiExtract, setShowAiExtract] = useState(false);
  const [aiExtractResult, setAiExtractResult] = useState<ForeshadowingExtractCandidate[] | null>(null);
  const [aiExtractLoading, setAiExtractLoading] = useState(false);
  const [extractChapterFrom, setExtractChapterFrom] = useState(1);
  const [extractChapterTo, setExtractChapterTo] = useState(1);
  const [aiExtractError, setAiExtractError] = useState<string | null>(null);
  const [selectedExtractIndices, setSelectedExtractIndices] = useState<Set<number>>(new Set());
  const [applyingIndices, setApplyingIndices] = useState<Set<number>>(new Set());
  const [extractProgress, setExtractProgress] = useState<{ current: number; total: number } | null>(null);
  const [relations, setRelations] = useState<ForeshadowingRelation[] | null>(null);
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "table" | "graph">("table");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [graphViewForeshadowing, setGraphViewForeshadowing] = useState<ForeshadowingResponseItem[]>([]);
  const [graphViewRelations, setGraphViewRelations] = useState<{source: string; target: string; label: string}[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Use dynamically fetched chapter count instead of hardcoded 999
  const maxChapter = Math.max(1, actualChapterCount || data?.currentChapter || 1);
  const chapterOptions = Array.from({ length: maxChapter }, (_, i) => i + 1);
  const currentChapter = maxChapter;
  const hasNoChapters = bookChapterData && actualChapterCount === 0;

  const handleAiExtract = useCallback(async () => {
    setAiExtractLoading(true);
    setAiExtractError(null);
    setAiExtractResult(null);
    setRelations(null);
    setRelationsLoading(false);
    setSelectedExtractIndices(new Set());
    try {
      const allCandidates: ForeshadowingExtractCandidate[] = [];
      const from = Math.min(extractChapterFrom, extractChapterTo);
      const to = Math.max(extractChapterFrom, extractChapterTo);
      const totalChapters = to - from + 1;
      setExtractProgress({ current: 0, total: totalChapters });
      for (let ch = from; ch <= to; ch++) {
        const result = await postApi<{ success: boolean; data: { candidates: ForeshadowingExtractCandidate[] } }>(
          `/api/extract`,
          { skillId: "extract-foreshadowing", bookId, chapterNumber: ch },
        );
        for (const c of result.data.candidates) {
          allCandidates.push({ ...c, chapter: ch });
        }
        setExtractProgress({ current: ch - from + 1, total: totalChapters });
      }
      setAiExtractResult(allCandidates);

      // After all chapters extracted, find cross-chapter relations
      if (allCandidates.length > 0) {
        setRelationsLoading(true);
        try {
          const relResult = await postApi<{ relations: ForeshadowingRelation[] }>(
            `/api/v1/books/${encodeURIComponent(bookId)}/foreshadowing/relations`,
            { candidates: allCandidates },
          );
          setRelations(relResult.relations.filter((r) => r.label));
        } catch {
          // Relations are non-critical, ignore errors
        } finally {
          setRelationsLoading(false);
        }
      }
    } catch (err) {
      setAiExtractError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiExtractLoading(false);
      setExtractProgress(null);
    }
  }, [bookId, extractChapterFrom, extractChapterTo]);

  const applyCandidate = useCallback(async (idx: number): Promise<boolean> => {
    const candidate = aiExtractResult?.[idx];
    if (!candidate) return false;
    try {
      setApplyingIndices((prev) => new Set(prev).add(idx));

      // 去重检测：检查是否已有同名伏笔
      const existingTitles = (data?.foreshadowing ?? []).map((f) => f.title.trim().toLowerCase());
      const candidateTitle = candidate.title.trim().toLowerCase();
      if (existingTitles.includes(candidateTitle)) {
        return false;
      }

      const id = `fs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await fetchJson("/api/foreshadowing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          bookId,
          title: candidate.title,
          type: candidate.type,
          description: candidate.description,
          expectedPayoffChapter: candidate.expectedPayoffChapter,
          lastMentionedChapter: candidate.lastMentionedChapter ?? candidate.chapter ?? extractChapterFrom,
          confidence: candidate.confidence,
          chapter: candidate.chapter ?? extractChapterFrom,
        }),
      });
      return true;
    } catch {
      return false;
    } finally {
      setApplyingIndices((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  }, [aiExtractResult, data, bookId, extractChapterFrom]);

  const handleApplySelected = useCallback(async () => {
    const indices = aiExtractResult
      ?.map((_, i) => i)
      .filter((i) => selectedExtractIndices.has(i)) ?? [];
    const succeeded: number[] = [];
    const failed: number[] = [];
    for (const idx of indices) {
      const ok = await applyCandidate(idx);
      if (ok) {
        succeeded.push(idx);
      } else {
        failed.push(idx);
      }
    }
    if (failed.length > 0) {
      // 移除成功项，保留失败项
      setAiExtractResult((prev) => {
        if (!prev) return prev;
        return prev.filter((_, i) => failed.includes(i));
      });
      setSelectedExtractIndices(new Set(failed));
    } else {
      setAiExtractResult(null);
    }
    if (succeeded.length > 0) {
      refetch();
    }
  }, [aiExtractResult, selectedExtractIndices, applyCandidate, refetch]);

  const handleApplyAll = useCallback(async () => {
    if (!aiExtractResult) return;
    const allIndices = aiExtractResult.map((_, i) => i);
    const succeeded: number[] = [];
    const failed: number[] = [];
    for (const idx of allIndices) {
      const ok = await applyCandidate(idx);
      if (ok) {
        succeeded.push(idx);
      } else {
        failed.push(idx);
      }
    }
    if (failed.length > 0) {
      // 移除成功项，保留失败项
      setAiExtractResult((prev) => {
        if (!prev) return prev;
        return prev.filter((_, i) => failed.includes(i));
      });
      setSelectedExtractIndices(new Set(failed));
    } else {
      setAiExtractResult(null);
    }
    if (succeeded.length > 0) {
      refetch();
    }
  }, [aiExtractResult, applyCandidate, refetch]);

  const toggleSelectExtract = useCallback((idx: number) => {
    setSelectedExtractIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  const toggleSelectAllExtract = useCallback(() => {
    setSelectedExtractIndices((prev) => {
      if (!aiExtractResult) return prev;
      const total = aiExtractResult.length;
      if (prev.size === total) {
        return new Set<number>();
      }
      return new Set(aiExtractResult.map((_, i) => i));
    });
  }, [aiExtractResult]);

  const selectedCount = selectedExtractIndices.size;

  const filtered = useMemo(() => {
    const list = data?.foreshadowing ?? [];
    return list.filter((f) => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (typeFilter !== "all" && f.type !== typeFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return f.title.toLowerCase().includes(q) || f.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [data, statusFilter, typeFilter, query]);

  const sorted = useMemo(() => {
    if (!sortField) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = String((a as any)[sortField] ?? "");
      const bVal = String((b as any)[sortField] ?? "");
      const cmp = aVal.localeCompare(bVal, "zh-CN");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const handleSort = useCallback((field: string) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return field;
      }
      setSortDir("asc");
      return field;
    });
  }, []);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, typeFilter, pageSize]);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        type="button"
        onClick={() => setRoute({ page: "dashboard" })}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft size={16} />
        <span>返回首页</span>
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">伏笔追踪</h1>
          <p className="text-sm text-muted-foreground mt-1">
            创建与追踪故事中的伏笔，监控遗忘风险
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border/30 bg-background p-0.5 mr-1">
            {(["card", "table", "graph"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-2.5 py-1.5 text-xs rounded-md transition font-medium",
                  viewMode === mode
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {mode === "card" ? "卡片" : mode === "table" ? "表格" : "关系图"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setAiExtractResult(null); setAiExtractError(null); setShowAiExtract(true); }}
            className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary/10"
            data-testid="fs-btn-ai-extract"
          >
            <Bot size={15} />
            AI 提取
          </button>
          <button
            type="button"
            onClick={refetch}
            className="inline-flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="fs-btn-refresh"
          >
            <RotateCw size={14} />
            刷新
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            data-testid="fs-create-btn"
          >
            <Plus size={15} />
            新建伏笔
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索伏笔名称或描述…"
            className="w-full pl-9 pr-8 py-2 rounded-lg border border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors"
            data-testid="fs-input-search"
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | ForeshadowingStatus)}
          className="px-3 py-2 rounded-lg border border-border/40 bg-background text-sm text-foreground outline-none focus:border-primary/50"
        >
          <option value="all">全部状态</option>
          <option value="active">活跃</option>
          <option value="paid_off">已回收</option>
          <option value="abandoned">已废弃</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "all" | ForeshadowingType)}
          className="px-3 py-2 rounded-lg border border-border/40 bg-background text-sm text-foreground outline-none focus:border-primary/50"
        >
          <option value="all">全部类型</option>
          {ForeshadowingTypeEnum.options.map((t) => (
            <option key={t} value={t}>{FORESHADOWING_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" data-testid="fs-state-error">
          <p>无法加载伏笔数据</p>
          <p className="text-xs text-destructive/70 mt-1">({error})</p>
          <button
            type="button"
            onClick={refetch}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            重试
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3" data-testid="fs-state-loading">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/40 bg-card p-4 space-y-3 animate-pulse">
              <div className="h-4 w-48 bg-muted rounded" />
              <div className="h-3 w-full bg-muted rounded" />
              <div className="h-3 w-32 bg-muted rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="fs-state-empty">
          <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
            <Sparkles size={20} className="text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground">
            {query || statusFilter !== "all" || typeFilter !== "all"
              ? "没有符合条件的伏笔"
              : "暂无伏笔，点击「新建伏笔」开始追踪"}
          </p>
        </div>
      )}

      {/* Card List */}
      {!loading && filtered.length > 0 && viewMode === "card" && (
        <div className="space-y-2">
          {paginated.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setEditingEntry(f as unknown as Foreshadowing)}
              className={cn(
                "w-full text-left rounded-xl border bg-card p-4 transition-all hover:shadow-sm",
                f._forgotten
                  ? "border-destructive/40 bg-destructive/[0.03]"
                  : "border-border/40",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={cn(
                      "font-medium truncate",
                      f._forgotten ? "text-destructive" : "text-foreground",
                    )}>
                      {f.title}
                    </h3>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0",
                      TYPE_BG[f.type as ForeshadowingType],
                    )}>
                      {FORESHADOWING_TYPE_LABELS[f.type as ForeshadowingType]}
                    </span>
                  </div>
                  {f.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {f.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground/60">
                    <span className="flex items-center gap-1">
                      创建于第 {f.createdChapter} 章
                    </span>
                    <span className="flex items-center gap-1">
                      最近提及：第 {f.lastMentionedChapter} 章
                    </span>
                    {f.expectedPayoffChapter ? (
                      <span className="flex items-center gap-1">
                        预期回收：第 {f.expectedPayoffChapter} 章
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-500/70">
                        预期回收：大纲未指定
                      </span>
                    )}
                    {f.payoffChapter && (
                      <span className="flex items-center gap-1">
                        回收：第 {f.payoffChapter} 章
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={cn(
                    "inline-flex items-center gap-1 text-xs font-medium",
                    STATUS_COLORS[f.status as ForeshadowingStatus],
                  )}>
                    {STATUS_ICONS[f.status as ForeshadowingStatus]}
                    {FORESHADOWING_STATUS_LABELS[f.status as ForeshadowingStatus]}
                  </span>
                  {f._forgotten && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive">
                      <AlertTriangle size={10} />
                      遗忘警报
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Table View */}
      {!loading && filtered.length > 0 && viewMode === "table" && (
        <div className="overflow-x-auto rounded-xl border border-border/40 bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 bg-muted/30">
                {[
                  { key: "title", label: "标题" },
                  { key: "type", label: "类型" },
                  { key: "createdChapter", label: "创建章" },
                  { key: "lastMentionedChapter", label: "最近提及" },
                  { key: "expectedPayoffChapter", label: "预期回收" },
                  { key: "status", label: "状态" },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={cn(
                      "px-4 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors",
                      sortField === col.key && "text-foreground",
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortField === col.key && (
                        <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => setEditingEntry(f as unknown as Foreshadowing)}
                  className={cn(
                    "border-b border-border/20 transition-colors cursor-pointer",
                    f._forgotten ? "bg-destructive/[0.02] hover:bg-destructive/[0.04]" : "hover:bg-muted/20",
                  )}
                >
                  <td className={cn(
                    "px-4 py-3 font-medium",
                    f._forgotten ? "text-destructive" : "text-foreground",
                  )}>
                    {f.title}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium",
                      TYPE_BG[f.type as ForeshadowingType],
                    )}>
                      {FORESHADOWING_TYPE_LABELS[f.type as ForeshadowingType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">第 {f.createdChapter} 章</td>
                  <td className="px-4 py-3 text-muted-foreground">第 {f.lastMentionedChapter} 章</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {f.expectedPayoffChapter ? `第 ${f.expectedPayoffChapter} 章` : <span className="text-muted-foreground italic">大纲未指定</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium",
                      STATUS_COLORS[f.status as ForeshadowingStatus],
                    )}>
                      {STATUS_ICONS[f.status as ForeshadowingStatus]}
                      {FORESHADOWING_STATUS_LABELS[f.status as ForeshadowingStatus]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Relation Graph View */}
      {!loading && filtered.length > 0 && viewMode === "graph" && (
        <div className="rounded-xl border border-border/40 bg-card p-8">
          <p className="text-sm text-muted-foreground text-center">
            关系图视图：通过 predecessor/successor 连线展示伏笔之间的关系。
          </p>
          <div className="mt-6 space-y-4 max-w-lg mx-auto">
            {filtered.map((f) => (
              <div
                key={f.id}
                onClick={() => setEditingEntry(f as unknown as Foreshadowing)}
                className="rounded-lg border border-border/30 bg-background p-4 cursor-pointer hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-foreground">{f.title}</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                    TYPE_BG[f.type as ForeshadowingType],
                  )}>
                    {FORESHADOWING_TYPE_LABELS[f.type as ForeshadowingType]}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
                  <span>第 {f.createdChapter} 章</span>
                  <span className={cn(
                    "inline-flex items-center gap-1 text-xs font-medium",
                    STATUS_COLORS[f.status as ForeshadowingStatus],
                  )}>
                    {STATUS_ICONS[f.status as ForeshadowingStatus]}
                    {FORESHADOWING_STATUS_LABELS[f.status as ForeshadowingStatus]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between border-t border-border/30 pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>共 {filtered.length} 条</span>
            <span className="text-border/50">|</span>
            <span>第 {safePage}/{totalPages} 页</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="ml-2 rounded border border-border/30 bg-background px-2 py-1 text-xs outline-none focus:border-primary/50"
            >
              <option value={10}>10条/页</option>
              <option value={20}>20条/页</option>
              <option value={50}>50条/页</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              className="rounded-lg border border-border/30 bg-background px-3 py-1.5 text-xs transition hover:bg-secondary/40 disabled:opacity-30 disabled:pointer-events-none"
            >
              上一页
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const startPage = Math.max(1, Math.min(safePage - 3, totalPages - 6));
              const p = startPage + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={cn(
                    "min-w-[2rem] rounded-lg px-2.5 py-1.5 text-xs transition",
                    p === safePage
                      ? "bg-primary text-primary-foreground"
                      : "border border-border/30 bg-background hover:bg-secondary/40",
                  )}
                >
                  {p}
                </button>
              );
            })}
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              className="rounded-lg border border-border/30 bg-background px-3 py-1.5 text-xs transition hover:bg-secondary/40 disabled:opacity-30 disabled:pointer-events-none"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      <CreateForeshadowingModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={refetch}
        currentChapter={currentChapter}
        bookId={bookId}
      />

      <EditForeshadowingModal
        entry={editingEntry}
        currentChapter={currentChapter}
        isOpen={editingEntry !== null}
        onClose={() => setEditingEntry(null)}
        onSaved={refetch}
      />

      {/* AI Extract Modal */}
      {showAiExtract && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/35 backdrop-blur-[2px] pt-16" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="关闭"
            className="absolute inset-0 cursor-default"
            onClick={() => { setShowAiExtract(false); setAiExtractResult(null); setExtractProgress(null); setRelations(null); }}
          />
          <div className="relative w-full max-w-2xl rounded-xl border border-border/55 bg-card shadow-2xl mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/45 px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">AI 提取伏笔</h2>
              <button
                type="button"
                onClick={() => { setShowAiExtract(false); setAiExtractResult(null); setExtractProgress(null); setRelations(null); }}
                className="p-1 rounded-md text-muted-foreground hover:bg-secondary/60"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-sm font-medium text-foreground shrink-0">章节范围：</label>
                <select
                  value={extractChapterFrom}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setExtractChapterFrom(v);
                    if (v > extractChapterTo) setExtractChapterTo(v);
                  }}
                  className="w-20 rounded-lg border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
                >
                  {chapterOptions.map((ch) => (
                    <option key={ch} value={ch}>第{ch}章</option>
                  ))}
                </select>
                <span className="text-sm text-muted-foreground">至</span>
                <select
                  value={extractChapterTo}
                  onChange={(e) => setExtractChapterTo(Number(e.target.value))}
                  className="w-20 rounded-lg border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
                >
                  {chapterOptions.filter((ch) => ch >= extractChapterFrom).map((ch) => (
                    <option key={ch} value={ch}>第{ch}章</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAiExtract}
                  disabled={aiExtractLoading || hasNoChapters}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
                  title={hasNoChapters ? "暂无章节，无法提取伏笔" : undefined}
                >
                  {aiExtractLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Bot size={14} />
                  )}
                  开始提取
                </button>
                {hasNoChapters && (
                  <span className="text-xs text-muted-foreground">暂无章节，请先创作章节</span>
                )}
              </div>

              {aiExtractError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {aiExtractError}
                </div>
              )}

              {aiExtractLoading && extractProgress && (
                <div className="space-y-3 py-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      第 {extractProgress.current}/{extractProgress.total} 章提取中…
                    </span>
                    <span className="text-muted-foreground">
                      {Math.round((extractProgress.current / extractProgress.total) * 100)}%
                    </span>
                  </div>
                  <div
                    className="h-2 w-full rounded-full bg-muted overflow-hidden"
                    role="progressbar"
                    aria-valuenow={extractProgress.current}
                    aria-valuemin={0}
                    aria-valuemax={extractProgress.total}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${(extractProgress.current / extractProgress.total) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    AI 正在分析章节文本，请稍候…
                  </div>
                </div>
              )}

              {aiExtractLoading && !extractProgress && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-primary" />
                  <span className="ml-3 text-sm text-muted-foreground">AI 正在分析章节文本，请稍候…</span>
                </div>
              )}

              {aiExtractResult !== null && !aiExtractLoading && (
                <div className="space-y-2">
                  {aiExtractResult.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">未识别到伏笔。</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <button
                          type="button"
                          onClick={toggleSelectAllExtract}
                          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <div className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                            selectedCount === aiExtractResult.length
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border/60",
                          )}>
                            {selectedCount === aiExtractResult.length && (
                              <span className="text-[10px] leading-none">✓</span>
                            )}
                          </div>
                          全选
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            共 {aiExtractResult.length} 条，已选 {selectedCount} 条
                          </span>
                          <button
                            type="button"
                            onClick={handleApplyAll}
                            disabled={applyingIndices.size > 0}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
                          >
                            {applyingIndices.size > 0 && <Loader2 size={12} className="animate-spin" />}
                            应用全部
                          </button>
                          <button
                            type="button"
                            onClick={handleApplySelected}
                            disabled={selectedCount === 0 || applyingIndices.size > 0}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm transition hover:bg-primary/10 disabled:opacity-60"
                          >
                            应用
                          </button>
                        </div>
                      </div>
                      {aiExtractResult.map((candidate, idx) => (
                        <div
                          key={idx}
                          id={`candidate-${idx}`}
                          className={cn(
                            "rounded-lg border p-4 space-y-2 transition-colors",
                            selectedExtractIndices.has(idx)
                              ? "border-primary/40 bg-primary/[0.02]"
                              : "border-border/40 bg-background",
                            applyingIndices.has(idx) && "opacity-60 pointer-events-none",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => toggleSelectExtract(idx)}
                              className={cn(
                                "mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                selectedExtractIndices.has(idx)
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-border/60 hover:border-primary/50",
                              )}
                            >
                              {selectedExtractIndices.has(idx) && (
                                <span className="text-[10px] leading-none">✓</span>
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm text-foreground">{candidate.title}</span>
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                    candidate.type === "角色伏笔" ? "bg-[#E88D3A]/10 text-[#E88D3A]" :
                                    candidate.type === "物品伏笔" ? "bg-[#22C55E]/10 text-[#22C55E]" :
                                    candidate.type === "设定伏笔" ? "bg-[#8B5CF6]/10 text-[#8B5CF6]" :
                                    "bg-[#4A90D9]/10 text-[#4A90D9]",
                                  )}>{candidate.type}</span>
                                </div>
                                <span className="text-[11px] text-muted-foreground">
                                  置信度：{Math.round(candidate.confidence * 100)}%
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{candidate.description}</p>
                              <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground/60">
                                {candidate.chapter && (
                                  <span>源自：第 {candidate.chapter} 章</span>
                                )}
                                {candidate.lastMentionedChapter !== undefined && (
                                  <span>最近提及：第 {candidate.lastMentionedChapter} 章</span>
                                )}
                                {candidate.expectedPayoffChapter !== null && candidate.expectedPayoffChapter !== undefined ? (
                                  <span>预期回收：第 {candidate.expectedPayoffChapter} 章</span>
                                ) : (
                                  <span className="text-amber-500/70">预期回收：大纲未指定</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Relations section */}
                  {relationsLoading && (
                    <div className="flex items-center justify-center py-4 gap-2 text-sm text-muted-foreground">
                      <Loader2 size={14} className="animate-spin" />
                      正在分析伏笔关系…
                    </div>
                  )}
                  {relations !== null && relations.length > 0 && (
                    <div className="mt-4 rounded-lg border border-primary/20 bg-primary/[0.02] p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Network size={15} className="text-primary" />
                        <span className="text-sm font-medium text-foreground">跨章节伏笔关系</span>
                        <span className="text-xs text-muted-foreground">（{relations.length} 条）</span>
                      </div>
                      <div className="space-y-2">
                        {relations.map((rel, idx) => {
                          const source = aiExtractResult?.[rel.sourceIdx];
                          const target = aiExtractResult?.[rel.targetIdx];
                          return (
                            <div key={idx} className="flex items-start gap-2 text-xs">
                              <div className={cn(
                                "mt-0.5 w-1.5 h-1.5 rounded-full shrink-0",
                                rel.type === "same_topic" ? "bg-amber-400" : "bg-emerald-400",
                              )} />
                              <div className="flex-1 min-w-0">
                                <p className="text-muted-foreground">{rel.label}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {source && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const el = document.getElementById(`candidate-${rel.sourceIdx}`);
                                        el?.scrollIntoView({ behavior: "smooth", block: "center" });
                                      }}
                                      className="text-primary/70 hover:text-primary underline underline-offset-2"
                                    >
                                      第 {source.chapter} 章 · {source.title}
                                    </button>
                                  )}
                                  <span className="text-muted-foreground/40">→</span>
                                  {target && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const el = document.getElementById(`candidate-${rel.targetIdx}`);
                                        el?.scrollIntoView({ behavior: "smooth", block: "center" });
                                      }}
                                      className="text-primary/70 hover:text-primary underline underline-offset-2"
                                    >
                                      第 {target.chapter} 章 · {target.title}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
