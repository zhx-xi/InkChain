import { useMemo, useState, useCallback, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useHashRoute } from "../hooks/use-hash-route";
import {
  Search, X, Sparkles, Plus, AlertTriangle, CheckCircle2, Clock,
  XCircle, Eye, EyeOff, Loader2, Bot,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useApi, fetchJson } from "../hooks/use-api";
import type { Foreshadowing, ForeshadowingType, ForeshadowingStatus } from "@actalk/inkos-core/models/foreshadowing.js";
import {
  FORESHADOWING_TYPE_LABELS,
  FORESHADOWING_STATUS_LABELS,
  ForeshadowingTypeEnum,
  ForeshadowingStatusEnum,
} from "@actalk/inkos-core/models/foreshadowing.js";

interface ForeshadowingResponseItem extends Foreshadowing {
  _forgotten?: boolean;
}

interface ForeshadowingListResponse {
  readonly foreshadowing: ReadonlyArray<ForeshadowingResponseItem>;
  readonly total: number;
  readonly currentChapter: number | null;
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/35 backdrop-blur-[2px]">
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/35 backdrop-blur-[2px]">
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
  const { data, loading, error, refetch } = useApi<ForeshadowingListResponse>(
    `/api/foreshadowing?bookId=${encodeURIComponent(bookId)}&currentChapter=999`,
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ForeshadowingStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | ForeshadowingType>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Foreshadowing | null>(null);

  const currentChapter = data?.currentChapter ?? 0;

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
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          <Plus size={15} />
          新建伏笔
        </button>
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
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          加载失败：{error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
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
        <div className="flex flex-col items-center justify-center py-16 text-center">
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

      {/* List */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((f) => (
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
                    {f.expectedPayoffChapter && (
                      <span className="flex items-center gap-1">
                        预期回收：第 {f.expectedPayoffChapter} 章
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
    </div>
  );
}
