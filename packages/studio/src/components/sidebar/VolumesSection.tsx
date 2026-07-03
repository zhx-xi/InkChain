import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Check, GripVertical } from "lucide-react";
import { fetchJson } from "../../hooks/use-api";
import { useChatStore } from "../../store/chat";
import { SidebarCard } from "./SidebarCard";
import { cn } from "../../lib/utils";

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

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  active: "进行中",
  completed: "已完成",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "text-muted-foreground/50",
  active: "text-blue-500",
  completed: "text-emerald-500",
};

// ── Sub-components ──

function VolumeCard({
  volume,
  chapters,
  isActive,
  isDragOver,
  onSelect,
  onEdit,
  onDelete,
  onDrop,
  onDragOver,
  onDragEnter,
  onDragLeave,
}: {
  readonly volume: Volume;
  readonly chapters: ReadonlyArray<ChapterMeta>;
  readonly isActive: boolean;
  readonly isDragOver: boolean;
  readonly onSelect: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onDrop: (e: React.DragEvent) => void;
  readonly onDragOver: (e: React.DragEvent) => void;
  readonly onDragEnter: (e: React.DragEvent) => void;
  readonly onDragLeave: (e: React.DragEvent) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const doneChapters = chapters.filter((ch) => ch.status === "approved" || ch.status === "published").length;
  const totalChapters = chapters.length;

  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-200",
        isActive
          ? "border-primary/30 bg-primary/5"
          : "border-border/20 hover:border-border/40",
        isDragOver && "border-primary/50 bg-primary/10 ring-2 ring-primary/20",
      )}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
    >
      {/* Volume header */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center gap-2 min-w-0"
        >
          <GripVertical size={14} className="shrink-0 text-muted-foreground/30" />
          <span className="text-[14px] leading-5 font-medium truncate">{volume.title}</span>
          <span className={cn("text-[11px] leading-4 font-medium shrink-0", STATUS_COLORS[volume.status])}>
            {STATUS_LABELS[volume.status] ?? volume.status}
          </span>
        </button>

        {/* Progress bar */}
        {totalChapters > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-12 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500/60 transition-all"
                style={{ width: `${Math.round((doneChapters / totalChapters) * 100)}%` }}
              />
            </div>
            <span className="text-[11px] leading-4 text-muted-foreground/60 tabular-nums">
              {doneChapters}/{totalChapters}
            </span>
          </div>
        )}

        {/* Actions */}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-secondary/50 transition-colors shrink-0"
          title="编辑"
        >
          <Pencil size={11} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
          title="删除"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Chapter list */}
      {expanded && chapters.length > 0 && (
        <ul className="pb-2 px-2.5 space-y-0.5">
          {chapters.map((ch) => (
            <li
              key={ch.number}
              className="flex items-center gap-2 px-2 py-1 rounded text-[12px] leading-5 text-muted-foreground/70"
            >
              <span className="tabular-nums shrink-0">{String(ch.number).padStart(2, "0")}</span>
              <span className="truncate flex-1">{ch.title || `第${ch.number}章`}</span>
              <span className="tabular-nums text-[11px] text-muted-foreground/40 shrink-0">
                {(ch.wordCount ?? 0).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}

      {expanded && chapters.length === 0 && (
        <p className="pb-2 px-3 text-[12px] leading-5 text-muted-foreground/40 italic">
          拖拽章节到此卷
        </p>
      )}
    </div>
  );
}

function CreateVolumeForm({ onSubmit, onCancel }: {
  readonly onSubmit: (title: string) => void;
  readonly onCancel: () => void;
}) {
  const [title, setTitle] = useState("");

  return (
    <div className="flex items-center gap-2 px-1">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim()) onSubmit(title.trim());
          if (e.key === "Escape") onCancel();
        }}
        placeholder="输入分卷名称..."
        className="flex-1 text-[13px] leading-5 bg-transparent border-b border-border/30 outline-none py-1 placeholder:text-muted-foreground/30"
      />
      <button
        onClick={() => title.trim() && onSubmit(title.trim())}
        disabled={!title.trim()}
        className="w-5 h-5 rounded flex items-center justify-center text-emerald-500 hover:bg-emerald-500/10 transition-colors shrink-0 disabled:opacity-30"
      >
        <Check size={12} />
      </button>
      <button
        onClick={onCancel}
        className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-secondary/50 transition-colors shrink-0"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ── Main component ──

interface VolumesSectionProps {
  readonly bookId: string;
}

export function VolumesSection({ bookId }: VolumesSectionProps) {
  const [volumes, setVolumes] = useState<ReadonlyArray<Volume>>([]);
  const [allChapters, setAllChapters] = useState<ReadonlyArray<ChapterMeta>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeVolumeId, setActiveVolumeId] = useState<string | null>(null);
  const [dragOverVolumeId, setDragOverVolumeId] = useState<string | null>(null);
  const bookDataVersion = useChatStore((s) => s.bookDataVersion);

  // Fetch volumes
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

  // Update volume title (inline edit)
  const handleRename = useCallback(async (volumeId: string, title: string) => {
    try {
      const { volume } = await fetchJson<{ volume: Volume }>(`/books/${bookId}/volumes/${volumeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setVolumes((prev) => prev.map((v) => (v.id === volumeId ? volume : v)));
    } catch (err) {
      console.error("Failed to rename volume:", err);
    }
  }, [bookId]);

  // Handle chapter drop
  const handleDrop = useCallback(async (volumeId: string, chapterNumber: number) => {
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

  // Drag event handlers
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

  const handleDropOnVolume = useCallback((e: React.DragEvent, volumeId: string) => {
    e.preventDefault();
    const chapterNum = e.dataTransfer.getData("application/x-chapter-number");
    if (chapterNum) {
      void handleDrop(volumeId, parseInt(chapterNum, 10));
    }
  }, [handleDrop]);

  // Group chapters by volumeId
  const unassignedChapters = allChapters.filter((ch) => !ch.volumeId);

  if (loading) {
    return (
      <SidebarCard title="分卷">
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-secondary/30 animate-pulse" />
          ))}
        </div>
      </SidebarCard>
    );
  }

  if (error) {
    return (
      <SidebarCard title="分卷">
        <div className="flex items-center gap-2">
          <p className="text-[13px] leading-5 text-destructive/70">{error}</p>
          <button
            onClick={() => void fetchData()}
            className="text-[12px] text-primary hover:underline shrink-0"
          >
            重试
          </button>
        </div>
      </SidebarCard>
    );
  }

  const sidebarActions = (
    <button
      onClick={() => setCreating(true)}
      className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-secondary/50 transition-colors"
      title="新建分卷"
    >
      <Plus size={14} />
    </button>
  );

  return (
    <SidebarCard title="分卷" actions={sidebarActions}>
      {creating && (
        <div className="mb-2">
          <CreateVolumeForm
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      {volumes.length === 0 && !creating ? (
        <p className="text-[15px] leading-6 text-muted-foreground/50 italic">
          暂无分卷
        </p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto overflow-x-hidden">
          {volumes.map((volume) => {
            const volumeChapters = allChapters.filter((ch) => ch.volumeId === volume.id);
            return (
              <VolumeCard
                key={volume.id}
                volume={volume}
                chapters={volumeChapters}
                isActive={activeVolumeId === volume.id}
                isDragOver={dragOverVolumeId === volume.id}
                onSelect={() => setActiveVolumeId(volume.id === activeVolumeId ? null : volume.id)}
                onEdit={() => {
                  const newTitle = prompt("编辑分卷名称:", volume.title);
                  if (newTitle && newTitle.trim() !== volume.title) {
                    void handleRename(volume.id, newTitle.trim());
                  }
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
              />
            );
          })}

          {/* Unassigned chapters indicator */}
          {unassignedChapters.length > 0 && (
            <div className="pt-1 mt-1 border-t border-border/20">
              <p className="text-[11px] leading-4 text-muted-foreground/40 px-2">
                未分配章节: {unassignedChapters.length}
              </p>
            </div>
          )}
        </div>
      )}
    </SidebarCard>
  );
}
