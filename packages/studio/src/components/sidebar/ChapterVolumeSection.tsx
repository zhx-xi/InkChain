import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  FileSearch,
} from "lucide-react";
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

const CHAPTER_STATUS_INDICATOR: Record<string, { symbol: string; color: string }> = {
  approved: { symbol: "\u2713", color: "text-emerald-500" },
  "ready-for-review": { symbol: "\u25C6", color: "text-amber-500" },
  drafted: { symbol: "\u25CB", color: "text-muted-foreground" },
  "needs-revision": { symbol: "\u2715", color: "text-destructive" },
  imported: { symbol: "\u25C7", color: "text-blue-500" },
};

const PAGE_SIZES = [10, 20, 50] as const;

// ── Sub-components ──

function CreateVolumeForm({
  onSubmit,
  onCancel,
}: {
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
}: {
  readonly volume: Volume;
  readonly chapters: ReadonlyArray<ChapterMeta>;
  readonly isActive: boolean;
  readonly isDragOver: boolean;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onDeleteChapter: (chapterNumber: number) => void;
  readonly onAuditChapter: (chapterNumber: number) => void;
  readonly onDrop: (e: React.DragEvent) => void;
  readonly onDragOver: (e: React.DragEvent) => void;
  readonly onDragEnter: (e: React.DragEvent) => void;
  readonly onDragLeave: (e: React.DragEvent) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const dragStarted = useRef(false);
  const doneChapters = chapters.filter(
    (ch) => ch.status === "approved" || ch.status === "published",
  ).length;
  const totalChapters = chapters.length;

  const handleClick = useCallback((chapterNumber: number) => {
    if (!dragStarted.current) {
      useChatStore.getState().openChapterArtifact(chapterNumber);
    }
    dragStarted.current = false;
  }, []);

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
          <GripVertical
            size={14}
            className="shrink-0 text-muted-foreground/30"
          />
          <span className="text-[14px] leading-5 font-medium truncate">
            {volume.title}
          </span>
          <span
            className={cn(
              "text-[11px] leading-4 font-medium shrink-0",
              STATUS_COLORS[volume.status],
            )}
          >
            {STATUS_LABELS[volume.status] ?? volume.status}
          </span>
        </button>

        {/* Progress bar */}
        {totalChapters > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-12 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500/60 transition-all"
                style={{
                  width: `${Math.round((doneChapters / totalChapters) * 100)}%`,
                }}
              />
            </div>
            <span className="text-[11px] leading-4 text-muted-foreground/60 tabular-nums">
              {doneChapters}/{totalChapters}
            </span>
          </div>
        )}

        {/* Actions */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-secondary/50 transition-colors shrink-0"
          title="编辑"
        >
          <Pencil size={11} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
          title="删除"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Chapter list */}
      {expanded && chapters.length > 0 && (
        <ul className="pb-2 px-2.5 space-y-0.5">
          {chapters.map((ch) => {
            const ind =
              CHAPTER_STATUS_INDICATOR[ch.status] ?? {
                symbol: "\u25CB",
                color: "text-muted-foreground",
              };
            return (
              <li
                key={ch.number}
                draggable
                onDragStart={(e) => {
                  dragStarted.current = true;
                  e.dataTransfer.setData(
                    "application/x-chapter-number",
                    String(ch.number),
                  );
                  e.dataTransfer.effectAllowed = "move";
                  if (e.currentTarget instanceof HTMLElement) {
                    e.currentTarget.style.opacity = "0.5";
                  }
                }}
                onDragEnd={(e) => {
                  if (e.currentTarget instanceof HTMLElement) {
                    e.currentTarget.style.opacity = "1";
                  }
                }}
                onClick={() => handleClick(ch.number)}
                className="flex items-center gap-2 px-2 py-1 rounded text-[12px] leading-5 text-muted-foreground/70 hover:bg-secondary/30 cursor-pointer transition-colors"
              >
                <GripVertical
                  size={12}
                  className="shrink-0 text-muted-foreground/20 cursor-grab active:cursor-grabbing hover:text-muted-foreground/50"
                  onMouseDown={() => {
                    dragStarted.current = false;
                  }}
                />
                <span
                  className={cn(
                    "text-[11px] shrink-0",
                    ind.color,
                  )}
                >
                  {ind.symbol}
                </span>
                <span className="tabular-nums shrink-0">
                  {String(ch.number).padStart(2, "0")}
                </span>
                <span className="truncate flex-1">
                  {ch.title || `第${ch.number}章`}
                </span>
                <span className="tabular-nums text-[11px] text-muted-foreground/40 shrink-0">
                  {(ch.wordCount ?? 0).toLocaleString()}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAuditChapter(ch.number);
                  }}
                  className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/30 hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                  title="审计"
                >
                  <FileSearch size={11} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChapter(ch.number);
                  }}
                  className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  title="删除"
                >
                  <Trash2 size={11} />
                </button>
              </li>
            );
          })}
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

function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (size: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center gap-2 pt-2 mt-1 border-t border-border/20">
      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        className="text-[12px] bg-transparent border border-border/30 rounded px-1.5 py-0.5 outline-none text-muted-foreground/70 font-medium"
      >
        {PAGE_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <span className="text-[12px] text-muted-foreground/60 flex-1 tabular-nums font-medium">
        {total > 0 ? `显示 ${start}-${end} / ${total}` : "0 个章节"}
      </span>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-20 disabled:cursor-not-allowed border border-border/20"
      >
        <ChevronLeft size={14} />
      </button>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-20 disabled:cursor-not-allowed border border-border/20"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ── Main component ──

interface ChapterVolumeSectionProps {
  readonly bookId: string;
}

export function ChapterVolumeSection({ bookId }: ChapterVolumeSectionProps) {
  const [volumes, setVolumes] = useState<ReadonlyArray<Volume>>([]);
  const [allChapters, setAllChapters] = useState<ReadonlyArray<ChapterMeta>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeVolumeId, setActiveVolumeId] = useState<string | null>(null);
  const [dragOverVolumeId, setDragOverVolumeId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const bookDataVersion = useChatStore((s) => s.bookDataVersion);

  // Fetch volumes + chapters
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
  const handleCreate = useCallback(
    async (title: string) => {
      try {
        const { volume } = await fetchJson<{ volume: Volume }>(
          `/books/${bookId}/volumes`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
          },
        );
        setVolumes((prev) => [...prev, volume]);
        setCreating(false);
      } catch (err) {
        console.error("Failed to create volume:", err);
      }
    },
    [bookId],
  );

  // Delete volume
  const handleDelete = useCallback(
    async (volumeId: string) => {
      try {
        await fetchJson(`/books/${bookId}/volumes/${volumeId}`, {
          method: "DELETE",
        });
        setVolumes((prev) => prev.filter((v) => v.id !== volumeId));
      } catch (err) {
        console.error("Failed to delete volume:", err);
      }
    },
    [bookId],
  );

  // Rename volume
  const handleRename = useCallback(
    async (volumeId: string, title: string) => {
      try {
        const { volume } = await fetchJson<{ volume: Volume }>(
          `/books/${bookId}/volumes/${volumeId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
          },
        );
        setVolumes((prev) => prev.map((v) => (v.id === volumeId ? volume : v)));
      } catch (err) {
        console.error("Failed to rename volume:", err);
      }
    },
    [bookId],
  );

  // Delete chapter
  const handleDeleteChapter = useCallback(
    async (chapterNumber: number) => {
      if (!confirm(`确定删除第 ${chapterNumber} 章？删除后不可恢复。`)) return;
      try {
        await fetchJson(`/books/${bookId}/chapters/${chapterNumber}`, {
          method: "DELETE",
        });
        useChatStore.getState().bumpBookDataVersion();
      } catch (err) {
        console.error("Failed to delete chapter:", err);
      }
    },
    [bookId],
  );

  // Handle chapter drop
  const handleDrop = useCallback(
    async (volumeId: string | null, chapterNumber: number) => {
      setDragOverVolumeId(null);
      try {
        await fetchJson(
          `/books/${bookId}/chapters/${chapterNumber}/volume`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ volumeId }),
          },
        );
        useChatStore.getState().bumpBookDataVersion();
      } catch (err) {
        console.error("Failed to assign chapter to volume:", err);
      }
    },
    [bookId],
  );

  // Drag event handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDragEnter = useCallback(
    (_e: React.DragEvent, volumeId: string) => {
      setDragOverVolumeId(volumeId);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverVolumeId(null);
  }, []);

  const handleDropOnVolume = useCallback(
    (e: React.DragEvent, volumeId: string) => {
      e.preventDefault();
      const chapterNum = e.dataTransfer.getData(
        "application/x-chapter-number",
      );
      if (chapterNum) {
        void handleDrop(volumeId, parseInt(chapterNum, 10));
      }
    },
    [handleDrop],
  );

  // Group chapters by volumeId
  const unassignedChapters = allChapters.filter((ch) => !ch.volumeId);

  // Pagination for unassigned chapters
  const totalPages = Math.max(1, Math.ceil(unassignedChapters.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedUnassigned = unassignedChapters.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  }, []);

  if (loading) {
    return (
      <SidebarCard title="章节">
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
      <SidebarCard title="章节">
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
    <SidebarCard title="章节" actions={sidebarActions}>
      <div className="min-h-[200px]">
      {creating && (
        <div className="mb-2">
          <CreateVolumeForm
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      {/* Volumes list */}
      {volumes.length > 0 && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto overflow-x-hidden">
          {volumes.map((volume) => {
            const volumeChapters = allChapters.filter(
              (ch) => ch.volumeId === volume.id,
            );
            return (
              <VolumeCard
                key={volume.id}
                volume={volume}
                chapters={volumeChapters}
                isActive={activeVolumeId === volume.id}
                isDragOver={dragOverVolumeId === volume.id}
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
                onDeleteChapter={handleDeleteChapter}
                onAuditChapter={(chapterNumber) => {
                  useChatStore.getState().openChapterArtifact(chapterNumber);
                }}
                onDrop={(e) => handleDropOnVolume(e, volume.id)}
                onDragOver={handleDragOver}
                onDragEnter={(e) => handleDragEnter(e, volume.id)}
                onDragLeave={handleDragLeave}
              />
            );
          })}
        </div>
      )}

      {/* No volumes state */}
      {volumes.length === 0 && !creating && (
        <p className="text-[13px] leading-5 text-muted-foreground/50 italic mb-2">
          暂无分卷
        </p>
      )}

      {/* Ungrouped chapters — also a drop zone to unassign chapters from volumes */}
      <div
        className={cn(
          unassignedChapters.length > 0 || volumes.length > 0 ? "mt-2 pt-2 border-t border-border/20" : "",
          dragOverVolumeId === "__unassigned__" &&
            "bg-blue-50/30 dark:bg-blue-900/10 rounded-lg -mx-1 px-1 pt-2 pb-1 border border-blue-300/50",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDragEnter={() => setDragOverVolumeId("__unassigned__")}
        onDragLeave={() => setDragOverVolumeId(null)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverVolumeId(null);
          const chapterNum = e.dataTransfer.getData(
            "application/x-chapter-number",
          );
          if (chapterNum) {
            void handleDrop(null, parseInt(chapterNum, 10));
          }
        }}
      >
        {unassignedChapters.length > 0 && (
          <p
            className={cn(
              "text-[11px] leading-4 px-1 mb-1",
              dragOverVolumeId === "__unassigned__"
                ? "text-blue-500 font-medium"
                : "text-muted-foreground/50",
            )}
          >
            {dragOverVolumeId === "__unassigned__"
              ? "释放以移出分卷"
              : `未分配章节: ${unassignedChapters.length}`}
          </p>
        )}

        {unassignedChapters.length > 0 && (
          <ul className="space-y-0.5">
            {paginatedUnassigned.map((ch) => {
              const ind =
                CHAPTER_STATUS_INDICATOR[ch.status] ?? {
                  symbol: "\u25CB",
                  color: "text-muted-foreground",
                };
              return (
                <li
                  key={ch.number}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/x-chapter-number",
                      String(ch.number),
                    );
                    e.dataTransfer.effectAllowed = "move";
                    if (e.currentTarget instanceof HTMLElement) {
                      e.currentTarget.style.opacity = "0.5";
                    }
                  }}
                  onDragEnd={(e) => {
                    if (e.currentTarget instanceof HTMLElement) {
                      e.currentTarget.style.opacity = "1";
                    }
                  }}
                  onClick={() => {
                    useChatStore.getState().openChapterArtifact(ch.number);
                  }}
                  className="flex items-center gap-2 px-2 py-1 rounded text-[13px] leading-5 text-muted-foreground hover:text-foreground hover:bg-secondary/30 cursor-pointer transition-colors"
                >
                  <GripVertical
                    size={13}
                    className="shrink-0 text-muted-foreground/30 cursor-grab active:cursor-grabbing hover:text-muted-foreground/60"
                    onMouseDown={() => {
                      /* prevent click from firing on drag start */
                    }}
                  />
                  <span
                    className={cn("text-[12px] shrink-0", ind.color)}
                  >
                    {ind.symbol}
                  </span>
                  <span className="tabular-nums shrink-0 text-[12px]">
                    {String(ch.number).padStart(2, "0")}
                  </span>
                  <span className="truncate flex-1">
                    {ch.title || `第${ch.number}章`}
                  </span>
                  <span className="tabular-nums text-[12px] text-muted-foreground/50 shrink-0">
                    {(ch.wordCount ?? 0).toLocaleString()}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      useChatStore.getState().openChapterArtifact(ch.number);
                    }}
                    className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/30 hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                    title="审计"
                  >
                    <FileSearch size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteChapter(ch.number);
                    }}
                    className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                    title="删除"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination for ungrouped chapters */}
        {unassignedChapters.length > 0 && (
          <PaginationBar
            page={safePage}
            pageSize={pageSize}
            total={unassignedChapters.length}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>
      </div>
    </SidebarCard>
  );
}
