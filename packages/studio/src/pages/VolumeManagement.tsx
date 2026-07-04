import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Check, FileText } from "lucide-react";
import { fetchJson } from "../hooks/use-api";
import { useChatStore } from "../store/chat";
import { cn } from "../lib/utils";

// ── Types ──

interface Volume {
  id: string;
  title: string;
  description: string;
  status: "draft" | "active" | "completed";
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface ChapterMeta {
  number: number;
  title: string;
  status: string;
  wordCount: number;
  volumeId: string | null;
}

// ── Status helpers ──

interface BadgeStyle {
  label: string;
  className: string;
}

const CHAPTER_BADGE: Record<string, BadgeStyle> = {
  published: { label: "已完成", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  approved: { label: "已完成", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  "ready-for-review": { label: "进行中", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  active: { label: "进行中", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  drafted: { label: "草稿", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  draft: { label: "草稿", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  "needs-revision": { label: "待修改", className: "bg-red-500/10 text-red-600 dark:text-red-400" },
  imported: { label: "已导入", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
};

function getChapterBadge(status: string): BadgeStyle {
  return CHAPTER_BADGE[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
}

function getVolumeStatusBadge(volume: Volume, chapters: ReadonlyArray<ChapterMeta>): { label: string; className: string } | null {
  if (volume.status === "draft" && chapters.length === 0) {
    return { label: "未开始", className: "bg-muted/50 text-muted-foreground" };
  }
  return null;
}

// ── Progress helpers ──

function calcProgress(chapters: ReadonlyArray<ChapterMeta>): { done: number; total: number; percent: number } {
  const total = chapters.length;
  const done = chapters.filter((ch) => ch.status === "approved" || ch.status === "published").length;
  return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
}

function getProgressColor(percent: number): string {
  if (percent >= 100) return "bg-emerald-500";
  if (percent >= 50) return "bg-amber-500";
  return "bg-primary";
}

function formatWordCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString();
}

// ── Create Volume Form ──

function CreateVolumeForm({
  onSubmit,
  onCancel,
}: {
  readonly onSubmit: (title: string) => void;
  readonly onCancel: () => void;
}) {
  const [title, setTitle] = useState("");

  return (
    <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim()) onSubmit(title.trim());
          if (e.key === "Escape") onCancel();
        }}
        placeholder="输入分卷名称..."
        className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40"
      />
      <button
        onClick={() => title.trim() && onSubmit(title.trim())}
        disabled={!title.trim()}
        className="w-6 h-6 rounded flex items-center justify-center text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-30 shrink-0"
      >
        <Check size={14} />
      </button>
      <button
        onClick={onCancel}
        className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Chapter Row ──

function ChapterRow({
  chapter,
  onDragStart,
  onDragEnd,
  showVolumeLabel,
}: {
  readonly chapter: ChapterMeta;
  readonly onDragStart: (e: React.DragEvent, number: number) => void;
  readonly onDragEnd: (e: React.DragEvent) => void;
  readonly showVolumeLabel?: boolean;
}) {
  const badge = getChapterBadge(chapter.status);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, chapter.number)}
      onDragEnd={onDragEnd}
      className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted/40 transition-colors cursor-default group"
    >
      <span className="text-muted-foreground/40 cursor-grab active:cursor-grabbing select-none group-hover:text-muted-foreground/70 transition-colors text-sm leading-none">
        ≡
      </span>
      <span className="text-muted-foreground w-10 shrink-0 tabular-nums">
        {String(chapter.number).padStart(2, "0")}
      </span>
      <span className="flex-1 truncate text-foreground/80">
        {chapter.title || `第${chapter.number}章`}
      </span>
      <span className="text-muted-foreground/50 tabular-nums shrink-0">
        {chapter.wordCount > 0 ? `${formatWordCount(chapter.wordCount)}字` : "—"}
      </span>
      <span className={cn("text-[10px] px-1.5 py-0.5 rounded shrink-0 font-medium", badge.className)}>
        {badge.label}
      </span>
    </div>
  );
}

// ── Volume Card ──

function VolumeCard({
  volume,
  chapters,
  isActive,
  isDragOver,
  onEdit,
  onDelete,
  onDrop,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onChapterDragStart,
  onChapterDragEnd,
}: {
  readonly volume: Volume;
  readonly chapters: ReadonlyArray<ChapterMeta>;
  readonly isActive: boolean;
  readonly isDragOver: boolean;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onDrop: (e: React.DragEvent) => void;
  readonly onDragOver: (e: React.DragEvent) => void;
  readonly onDragEnter: (e: React.DragEvent) => void;
  readonly onDragLeave: (e: React.DragEvent) => void;
  readonly onChapterDragStart: (e: React.DragEvent, number: number) => void;
  readonly onChapterDragEnd: (e: React.DragEvent) => void;
}) {
  const progress = calcProgress(chapters);
  const statusBadge = getVolumeStatusBadge(volume, chapters);
  const isPlanned = volume.status === "draft" && chapters.length === 0;

  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-200",
        isActive
          ? "border-primary/30 bg-primary/[0.03]"
          : "border-border/60 hover:border-border",
        isDragOver && "border-primary/50 bg-primary/5 ring-2 ring-primary/10",
        isPlanned && "opacity-60",
      )}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
    >
      {/* Volume Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-serif italic text-sm text-primary truncate">
            {volume.title}
          </span>
          {statusBadge && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", statusBadge.className)}>
              {statusBadge.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn(
            "text-xs font-bold tabular-nums",
            progress.percent >= 100 && "text-emerald-600 dark:text-emerald-400",
            progress.percent >= 50 && progress.percent < 100 && "text-amber-600 dark:text-amber-400",
            progress.percent > 0 && progress.percent < 50 && "text-primary",
          )}>
            {chapters.length > 0 ? `${progress.percent}%` : "—"}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-secondary/50 transition-colors"
            title="编辑"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="删除"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {chapters.length > 0 && (
        <div className="px-4 pb-0.5">
          <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-300", getProgressColor(progress.percent))}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Chapter List */}
      {chapters.length > 0 && (
        <div className="px-3 pb-2 pt-1 space-y-0.5">
          {chapters.map((ch) => (
            <ChapterRow
              key={ch.number}
              chapter={ch}
              onDragStart={onChapterDragStart}
              onDragEnd={onChapterDragEnd}
            />
          ))}
        </div>
      )}

      {/* Empty state for planned volumes */}
      {isPlanned && volume.description && (
        <div className="px-4 pb-3 text-xs text-muted-foreground/60 italic">
          {volume.description}
        </div>
      )}

      {/* Drop hint */}
      {chapters.length === 0 && !isPlanned && (
        <div className="px-4 pb-3 text-xs text-muted-foreground/40 italic">
          拖拽章节到此卷
        </div>
      )}
    </div>
  );
}

// ── Main Component ──

interface VolumeManagementProps {
  readonly bookId: string;
  readonly nav?: {
    toEditDashboard?: (bookId: string) => void;
    toBook?: (bookId: string) => void;
  };
}

export function VolumeManagement({ bookId, nav }: VolumeManagementProps) {
  const [volumes, setVolumes] = useState<ReadonlyArray<Volume>>([]);
  const [allChapters, setAllChapters] = useState<ReadonlyArray<ChapterMeta>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeVolumeId, setActiveVolumeId] = useState<string | null>(null);
  const [dragOverVolumeId, setDragOverVolumeId] = useState<string | null>(null);
  const [editingVolumeId, setEditingVolumeId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const bookDataVersion = useChatStore((s) => s.bookDataVersion);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [volData, bookData] = await Promise.all([
        fetchJson<{ volumes: Volume[] }>(`/books/${bookId}/volumes`),
        fetchJson<{ chapters: ChapterMeta[] }>(`/books/${bookId}`),
      ]);
      setVolumes(volData.volumes);
      setAllChapters(bookData.chapters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData, bookDataVersion]);

  // Create volume
  const handleCreate = useCallback(async (title: string) => {
    try {
      const { volume } = await fetchJson<{ volume: Volume }>(`/books/${bookId}/volumes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setVolumes((prev) => [...prev, volume]);
      setCreating(false);
    } catch (err) {
      console.error("Failed to create volume:", err);
    }
  }, [bookId]);

  // Delete volume
  const handleDelete = useCallback(async (volumeId: string) => {
    try {
      await fetchJson(`/books/${bookId}/volumes/${volumeId}`, { method: "DELETE" });
      setVolumes((prev) => prev.filter((v) => v.id !== volumeId));
    } catch (err) {
      console.error("Failed to delete volume:", err);
    }
  }, [bookId]);

  // Update volume title
  const handleRename = useCallback(async (volumeId: string, title: string) => {
    try {
      const { volume } = await fetchJson<{ volume: Volume }>(`/books/${bookId}/volumes/${volumeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setVolumes((prev) => prev.map((v) => (v.id === volumeId ? volume : v)));
      setEditingVolumeId(null);
    } catch (err) {
      console.error("Failed to rename volume:", err);
    }
  }, [bookId]);

  // Drag handlers for chapters
  const handleChapterDragStart = useCallback((e: React.DragEvent, chapterNumber: number) => {
    e.dataTransfer.setData("application/x-chapter-number", String(chapterNumber));
    e.dataTransfer.effectAllowed = "move";
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  }, []);

  const handleChapterDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  }, []);

  // Drop assignment
  const handleDrop = useCallback(async (volumeId: string | null, chapterNumber: number) => {
    setDragOverVolumeId(null);
    try {
      await fetchJson(`/books/${bookId}/chapters/${chapterNumber}/volume`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volumeId }),
      });
      useChatStore.getState().bumpBookDataVersion();
    } catch (err) {
      console.error("Failed to assign chapter to volume:", err);
    }
  }, [bookId]);

  const handleDropOnVolume = useCallback((e: React.DragEvent, volumeId: string) => {
    e.preventDefault();
    const chapterNum = e.dataTransfer.getData("application/x-chapter-number");
    if (chapterNum) {
      void handleDrop(volumeId, parseInt(chapterNum, 10));
    }
  }, [handleDrop]);

  const handleDropOnUnassigned = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverVolumeId(null);
    const chapterNum = e.dataTransfer.getData("application/x-chapter-number");
    if (chapterNum) {
      void handleDrop(null, parseInt(chapterNum, 10));
    }
  }, [handleDrop]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDragEnter = useCallback((_e: React.DragEvent, volumeId: string) => {
    setDragOverVolumeId(volumeId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverVolumeId(null);
  }, []);

  const unassignedChapters = allChapters.filter((ch) => !ch.volumeId);

  // Compute stats
  const totalChapters = allChapters.length;
  const totalWords = allChapters.reduce((sum, ch) => sum + (ch.wordCount ?? 0), 0);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 py-8">
        <p className="text-sm text-destructive/70">{error}</p>
        <button
          onClick={() => void fetchData()}
          className="text-xs text-primary hover:underline"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif italic text-xl text-primary">分卷管理</h1>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            {volumes.length} 卷 · {totalChapters} 章 · {totalWords.toLocaleString()} 字
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => nav?.toEditDashboard?.(bookId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-foreground/80 hover:bg-secondary/50 transition-colors"
          >
            <FileText size={13} />
            卷纲编辑
          </button>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} />
            新建卷
          </button>
        </div>
      </div>

      {/* Create Volume Form */}
      {creating && (
        <CreateVolumeForm
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}

      {/* Volume List */}
      {volumes.length === 0 && !creating ? (
        <div className="py-12 text-center text-sm text-muted-foreground/50 italic">
          暂无分卷，点击"新建卷"开始创建
        </div>
      ) : (
        <div className="space-y-3">
          {volumes.map((volume) => {
            const volumeChapters = allChapters.filter((ch) => ch.volumeId === volume.id);
            const isActive = activeVolumeId === volume.id;

            return (
              <div
                key={volume.id}
                onClick={() => setActiveVolumeId(isActive ? null : volume.id)}
                className="cursor-pointer"
              >
                {editingVolumeId === volume.id ? (
                  <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-3">
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editTitle.trim()) {
                          void handleRename(volume.id, editTitle.trim());
                        }
                        if (e.key === "Escape") setEditingVolumeId(null);
                      }}
                      className="flex-1 text-sm font-serif italic bg-transparent outline-none"
                    />
                    <button
                      onClick={() => editTitle.trim() && void handleRename(volume.id, editTitle.trim())}
                      disabled={!editTitle.trim()}
                      className="w-6 h-6 rounded flex items-center justify-center text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-30"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingVolumeId(null)}
                      className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <VolumeCard
                    volume={volume}
                    chapters={volumeChapters}
                    isActive={isActive}
                    isDragOver={dragOverVolumeId === volume.id}
                    onEdit={() => {
                      setEditingVolumeId(volume.id);
                      setEditTitle(volume.title);
                    }}
                    onDelete={() => {
                      if (confirm(`确定删除分卷「${volume.title}」？`)) {
                        void handleDelete(volume.id);
                      }
                    }}
                    onDrop={(e) => handleDropOnVolume(e, volume.id)}
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => handleDragEnter(e, volume.id)}
                    onDragLeave={handleDragLeave}
                    onChapterDragStart={handleChapterDragStart}
                    onChapterDragEnd={handleChapterDragEnd}
                  />
                )}
              </div>
            );
          })}

          {/* Unassigned chapters drop zone */}
          {(unassignedChapters.length > 0 || dragOverVolumeId === "__unassigned__") && (
            <div
              className={cn(
                "rounded-xl border-2 border-dashed transition-all duration-200 px-4 py-3",
                dragOverVolumeId === "__unassigned__"
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/30",
              )}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
              onDragEnter={() => setDragOverVolumeId("__unassigned__")}
              onDragLeave={() => setDragOverVolumeId(null)}
              onDrop={handleDropOnUnassigned}
            >
              <p className={cn(
                "text-xs",
                dragOverVolumeId === "__unassigned__" ? "text-primary font-medium" : "text-muted-foreground/50",
              )}>
                {dragOverVolumeId === "__unassigned__"
                  ? "释放以移出分卷"
                  : `未分配章节: ${unassignedChapters.length}`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stats Summary */}
      {volumes.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 pt-4 border-t border-border/60">
          <span className="text-xs text-muted-foreground">
            总章数: <strong className="text-foreground">{totalChapters}</strong>
          </span>
          <span className="text-xs text-muted-foreground">
            总字数: <strong className="text-foreground">{totalWords.toLocaleString()}</strong>
          </span>
          {volumes.map((volume) => {
            const volumeChapters = allChapters.filter((ch) => ch.volumeId === volume.id);
            const progress = calcProgress(volumeChapters);
            return (
              <span key={volume.id} className="text-xs text-muted-foreground">
                {volume.title.replace(/^第[^·]*·\s*/, "")}:
                <strong className="text-foreground"> {volumeChapters.length > 0 ? `${progress.percent}%` : "—"}</strong>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
