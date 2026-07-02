import { useMemo, useState, useCallback, useEffect, memo, useRef } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  type Node,
  type NodeProps,
  type NodeTypes,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { postApi, putApi, fetchJson } from "../hooks/use-api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { PlusIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { useTimelineSegments, type TimelineEvent } from "../hooks/use-timeline-segments";

// ── Types ──

interface TimelineNodeData {
  id: string;
  title: string;
  eventType: string;
  description: string;
  relatedCharacters: readonly string[];
  chapter: number;
  importance: number;
  tags?: readonly string[];
  timestamp: string;
  [key: string]: unknown;
}

type TimelineEventNodeType = Node<TimelineNodeData, "timelineEvent">;
type ChapterHeaderNodeType = Node<{ label: string }, "chapterHeader">;
type CharacterHeaderNodeType = Node<{ label: string }, "characterHeader">;

// ── Event type color mapping ──

const EVENT_TYPE_COLORS: Record<string, { border: string; bg: string; text: string; label: string }> = {
  plot:     { border: "#3b82f6", bg: "rgba(59,130,246,0.10)", text: "#3b82f6", label: "剧情" },
  character:{ border: "#22c55e", bg: "rgba(34,197,94,0.10)",  text: "#22c55e", label: "角色" },
  world:    { border: "#f59e0b", bg: "rgba(245,158,11,0.10)", text: "#f59e0b", label: "世界观" },
};

const DEFAULT_COLOR = { border: "#6b7280", bg: "rgba(107,114,128,0.10)", text: "#6b7280", label: "其他" };

const EVENT_TYPE_OPTIONS = [
  { value: "plot", label: "剧情" },
  { value: "character", label: "角色" },
  { value: "world", label: "世界观" },
];

// ── Layout constants ──

const NODE_WIDTH = 160;
const NODE_HEIGHT = 52;
const COLUMN_GAP_X = 220;
const ROW_GAP_Y = 76;
const LEFT_MARGIN = 160;   // Space for character Y-axis labels
const TOP_MARGIN = 80;     // Space for chapter X-axis labels
const HEADER_NODE_WIDTH = 140;
const HEADER_NODE_HEIGHT = 36;

// ── FPS Counter (dev-mode only) ──

function FpsCounter() {
  const [fps, setFps] = useState(0);
  const lastTimeRef = useRef(performance.now());
  const framesRef = useRef(0);

  useEffect(() => {
    let rafId: number;

    function tick(now: number) {
      framesRef.current += 1;
      const elapsed = now - lastTimeRef.current;
      if (elapsed >= 1000) {
        setFps(Math.round((framesRef.current * 1000) / elapsed));
        framesRef.current = 0;
        lastTimeRef.current = now;
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <span className="text-[10px] font-mono tabular-nums text-muted-foreground/40" title="FPS (开发模式)">
      {fps} FPS
    </span>
  );
}

// ── Custom Timeline Event Node ──

function TimelineEventNode({ data, selected }: NodeProps<TimelineEventNodeType>) {
  const color = EVENT_TYPE_COLORS[data.eventType] ?? DEFAULT_COLOR;
  const isLightweight = (data as TimelineNodeData & { lightweight?: boolean }).lightweight === true;

  if (isLightweight) {
    // Lightweight mode: minimal rendering for 500+ events
    return (
      <div
        className="relative flex flex-col gap-0.5 px-2 py-1.5 rounded border transition-colors duration-100 cursor-pointer"
        style={{
          backgroundColor: color.bg,
          borderColor: selected ? color.border : `${color.border}44`,
          borderWidth: selected ? 2 : 1,
          width: NODE_WIDTH,
          minHeight: 28,
        }}
        title={data.title}
      >
        <span className="text-[11px] font-medium leading-tight text-foreground truncate">
          {data.title}
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[9px] font-medium rounded px-1 py-0 leading-tight"
            style={{ backgroundColor: `${color.border}20`, color: color.text }}
          >
            {color.label}
          </span>
          <span className="text-[8px] text-muted-foreground/50">
            {"★".repeat(data.importance)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col gap-1 px-3 py-2 rounded-lg border transition-all duration-200 cursor-pointer min-w-[140px] shadow-sm hover:shadow-md"
      style={{
        backgroundColor: color.bg,
        borderColor: selected ? color.border : `${color.border}55`,
        borderWidth: selected ? 2 : 1.2,
        width: NODE_WIDTH,
        ...(selected ? { boxShadow: `0 0 0 2px ${color.border}40` } : {}),
      }}
      title={data.title}
    >
      {/* Title */}
      <span className="text-sm font-medium leading-tight text-foreground truncate">
        {data.title}
      </span>

      {/* Bottom row: event type badge + importance */}
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-medium leading-tight rounded-full px-1.5 py-0.5"
          style={{ backgroundColor: `${color.border}20`, color: color.text }}
        >
          {color.label}
        </span>
        <span className="text-[10px] text-muted-foreground/60">
          {"★".repeat(data.importance)}{"☆".repeat(5 - data.importance)}
        </span>
      </div>

      {/* Connected characters hint */}
      {data.relatedCharacters.length > 0 && (
        <span className="text-[9px] text-muted-foreground/40 truncate">
          {data.relatedCharacters.join(", ")}
        </span>
      )}
    </div>
  );
}

const MemoTimelineEventNode = memo(TimelineEventNode);

// ── Custom Chapter Header Node ──

function ChapterHeaderNode({ data }: NodeProps<ChapterHeaderNodeType>) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-border/30 bg-card/80 text-sm font-semibold text-foreground"
      style={{ width: HEADER_NODE_WIDTH, height: HEADER_NODE_HEIGHT }}
    >
      {data.label}
    </div>
  );
}

const MemoChapterHeaderNode = memo(ChapterHeaderNode);

// ── Custom Character Header Node ──

function CharacterHeaderNode({ data }: NodeProps<CharacterHeaderNodeType>) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground truncate"
      style={{ width: HEADER_NODE_WIDTH, height: HEADER_NODE_HEIGHT }}
    >
      <span className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />
      <span className="truncate">{data.label}</span>
    </div>
  );
}

const MemoCharacterHeaderNode = memo(CharacterHeaderNode);

// ── Node types registration ──

const nodeTypes: NodeTypes = {
  timelineEvent: MemoTimelineEventNode,
  chapterHeader: MemoChapterHeaderNode,
  characterHeader: MemoCharacterHeaderNode,
};

// ── EventEditDialog ──

interface EventFormData {
  title: string;
  description: string;
  eventType: string;
  relatedCharacters: string;
  chapter: number;
  importance: number;
  tags: string;
}

interface EventEditDialogProps {
  open: boolean;
  event: TimelineEvent | null; // null = create mode
  existingCharacters: string[];
  onSave: (form: EventFormData, eventId: string | null) => Promise<void>;
  onCancel: () => void;
}

function EventEditDialog({ open, event, existingCharacters, onSave, onCancel }: EventEditDialogProps) {
  const isCreate = event === null;

  const defaultFormData: EventFormData = {
    title: "",
    description: "",
    eventType: "plot",
    relatedCharacters: "",
    chapter: 1,
    importance: 3,
    tags: "",
  };

  const [form, setForm] = useState<EventFormData>(() => {
    if (event) {
      return {
        title: event.title,
        description: event.description,
        eventType: event.eventType,
        relatedCharacters: event.relatedCharacters.join(", "),
        chapter: event.chapter,
        importance: event.importance,
        tags: (event.tags ?? []).join(", "),
      };
    }
    return defaultFormData;
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/closes or event changes
  useEffect(() => {
    if (!open) return;
    if (event) {
      setForm({
        title: event.title,
        description: event.description,
        eventType: event.eventType,
        relatedCharacters: event.relatedCharacters.join(", "),
        chapter: event.chapter,
        importance: event.importance,
        tags: (event.tags ?? []).join(", "),
      });
    } else {
      setForm(defaultFormData);
    }
    setError(null);
    setSaving(false);
  }, [open, event]);

  const updateField = useCallback(<K extends keyof EventFormData>(field: K, value: EventFormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    // Validate
    if (!form.title.trim()) {
      setError("请输入事件标题");
      return;
    }
    if (form.chapter < 1) {
      setError("章节号必须大于 0");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(form, event?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }, [form, event, onSave]);

  const quickAddCharacter = useCallback((ch: string) => {
    setForm((prev) => {
      const existing = prev.relatedCharacters
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (existing.includes(ch)) return prev;
      const next = [...existing, ch].join(", ");
      return { ...prev, relatedCharacters: next };
    });
  }, []);

  const removeCharacter = useCallback((ch: string) => {
    setForm((prev) => {
      const filtered = prev.relatedCharacters
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== ch);
      return { ...prev, relatedCharacters: filtered.join(", ") };
    });
  }, []);

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-[520px]" showCloseButton>
        <DialogHeader>
          <DialogTitle className="text-base">
            {isCreate ? "新增事件" : "编辑事件"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground/80">标题</label>
            <Input
              placeholder="事件标题"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground/80">描述</label>
            <Textarea
              placeholder="事件描述"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
            />
          </div>

          {/* Event type + chapter row */}
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground/80">事件类型</label>
              <Select
                value={form.eventType}
                onValueChange={(v) => updateField("eventType", v ?? "plot")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: EVENT_TYPE_COLORS[opt.value]?.border ?? DEFAULT_COLOR.border }}
                        />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[100px] space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground/80">章节</label>
              <Input
                type="number"
                min={1}
                placeholder="章节"
                value={form.chapter}
                onChange={(e) => updateField("chapter", Math.max(1, parseInt(e.target.value, 10) || 1))}
              />
            </div>
          </div>

          {/* Importance (star rating) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground/80">重要性</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => updateField("importance", star)}
                  className={`text-lg transition-colors hover:scale-110 active:scale-95 ${
                    star <= form.importance
                      ? "text-amber-400"
                      : "text-muted-foreground/20"
                  }`}
                  title={`${star} 星`}
                >
                  {star <= form.importance ? "★" : "☆"}
                </button>
              ))}
              <span className="text-xs text-muted-foreground/50 ml-2">
                {["", "微不足道", "次要", "普通", "重要", "核心"][form.importance] ?? ""}
              </span>
            </div>
          </div>

          {/* Related characters */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground/80">关联角色</label>
            <Input
              placeholder="用逗号分隔多个角色名"
              value={form.relatedCharacters}
              onChange={(e) => updateField("relatedCharacters", e.target.value)}
            />
            {/* Quick-add existing characters */}
            {existingCharacters.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {existingCharacters.map((ch) => {
                  const alreadyAdded = form.relatedCharacters
                    .split(",")
                    .map((s) => s.trim())
                    .includes(ch);
                  return alreadyAdded ? (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => removeCharacter(ch)}
                      className="inline-flex items-center gap-0.5 text-[11px] bg-primary/10 text-primary/80 px-1.5 py-0.5 rounded-full hover:bg-primary/20 transition-colors"
                    >
                      {ch}
                      <XIcon className="size-2.5" />
                    </button>
                  ) : (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => quickAddCharacter(ch)}
                      className="text-[11px] bg-secondary/50 text-muted-foreground px-1.5 py-0.5 rounded-full hover:bg-secondary/80 transition-colors"
                    >
                      + {ch}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground/80">标签</label>
            <Input
              placeholder="用逗号分隔多个标签"
              value={form.tags}
              onChange={(e) => updateField("tags", e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "保存中…" : isCreate ? "创建" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Props ──

interface TimelinePageProps {
  readonly bookId: string;
}

// ── Component ──

export function TimelinePage({ bookId }: TimelinePageProps) {
  // ── Segmented / paginated data ──
  const {
    volumes,
    selectedVolumeId,
    setSelectedVolumeId,
    events: paginatedEvents,
    allEvents,
    totalFilteredCount,
    loadedCount,
    totalCount,
    hasMore,
    loadMore,
    loading,
    error,
    refetch,
    isLightweightMode,
  } = useTimelineSegments(bookId);

  // All events (full list used for computing chapters/characters and detail dialog)
  const events = allEvents;

  // Filters
  const [characterFilter, setCharacterFilter] = useState<string>("");
  const [chapterFilter, setChapterFilter] = useState<string>("");

  // Detail dialog state
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    event: TimelineEvent;
    x: number;
    y: number;
  } | null>(null);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);

  // Delete confirmation state
  const [deleteConfirmEvent, setDeleteConfirmEvent] = useState<TimelineEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Compute unique chapters and characters (from ALL events, not paginated) ──
  const { uniqueChapters, uniqueCharacters } = useMemo(() => {
    const chapters = new Set<number>();
    const characters = new Set<string>();
    for (const e of events) {
      chapters.add(e.chapter);
      for (const ch of e.relatedCharacters) {
        characters.add(ch);
      }
    }
    return {
      uniqueChapters: [...chapters].sort((a, b) => a - b),
      uniqueCharacters: [...characters].sort(),
    };
  }, [events]);

  // ── Filtered events (applied on top of paginated slice) ──
  const filteredEvents = useMemo(() => {
    let result = paginatedEvents;
    if (characterFilter) {
      const lower = characterFilter.toLowerCase();
      result = result.filter((e) =>
        e.relatedCharacters.some((ch) => ch.toLowerCase().includes(lower)),
      );
    }
    if (chapterFilter) {
      const chNum = parseInt(chapterFilter, 10);
      if (!isNaN(chNum)) {
        result = result.filter((e) => e.chapter === chNum);
      }
    }
    return result;
  }, [paginatedEvents, characterFilter, chapterFilter]);

  // ── Build ReactFlow nodes ──
  const initialNodes = useMemo<Node[]>(() => {
    const nodes: Node[] = [];

    const chapterIndexMap = new Map<number, number>();
    uniqueChapters.forEach((ch, i) => chapterIndexMap.set(ch, i));

    const characterIndexMap = new Map<string, number>();
    uniqueCharacters.forEach((ch, i) => characterIndexMap.set(ch, i));

    // Chapter header nodes (X-axis)
    for (const ch of uniqueChapters) {
      const idx = chapterIndexMap.get(ch)!;
      nodes.push({
        id: `chapter-${ch}`,
        type: "chapterHeader",
        position: {
          x: LEFT_MARGIN + idx * COLUMN_GAP_X + (COLUMN_GAP_X - HEADER_NODE_WIDTH) / 2,
          y: 0,
        },
        data: { label: `第 ${ch} 章` },
        draggable: false,
        deletable: false,
        selectable: false,
      });
    }

    // Character header nodes (Y-axis)
    for (const ch of uniqueCharacters) {
      const idx = characterIndexMap.get(ch)!;
      nodes.push({
        id: `char-${ch}`,
        type: "characterHeader",
        position: {
          x: 0,
          y: TOP_MARGIN + idx * ROW_GAP_Y + (ROW_GAP_Y - HEADER_NODE_HEIGHT) / 2,
        },
        data: { label: ch },
        draggable: false,
        deletable: false,
        selectable: false,
      });
    }

    // Event nodes
    // Track (chapter, character) counts for staggering
    const cellCounts = new Map<string, number>();

    for (const e of filteredEvents) {
      const chIdx = chapterIndexMap.get(e.chapter);
      if (chIdx === undefined) continue;

      const baseX = LEFT_MARGIN + chIdx * COLUMN_GAP_X + (COLUMN_GAP_X - NODE_WIDTH) / 2;
      const baseY = TOP_MARGIN;

      if (e.relatedCharacters.length === 0) {
        // Events with no character — place at top of the chapter column
        const cellKey = `ch-${e.chapter}-norole`;
        const count = cellCounts.get(cellKey) ?? 0;
        cellCounts.set(cellKey, count + 1);
        nodes.push({
          id: e.id,
          type: "timelineEvent",
          position: { x: baseX, y: baseY + count * (NODE_HEIGHT + 4) },
          data: {
            id: e.id,
            title: e.title,
            eventType: e.eventType,
            description: e.description,
            relatedCharacters: e.relatedCharacters,
            chapter: e.chapter,
            importance: e.importance,
            tags: e.tags,
            timestamp: e.timestamp,
            lightweight: isLightweightMode,
          },
          draggable: false,
        } satisfies Node);
      } else {
        for (const character of e.relatedCharacters) {
          const charIdx = characterIndexMap.get(character);
          if (charIdx === undefined) continue;

          const cellKey = `ch-${e.chapter}-char-${character}`;
          const count = cellCounts.get(cellKey) ?? 0;
          cellCounts.set(cellKey, count + 1);

          nodes.push({
            id: `${e.id}-${character}`,
            type: "timelineEvent",
            position: {
              x: baseX,
              y: baseY + charIdx * ROW_GAP_Y + count * (NODE_HEIGHT + 4),
            },
            data: {
              id: e.id,
              title: e.title,
              eventType: e.eventType,
              description: e.description,
              relatedCharacters: e.relatedCharacters,
              chapter: e.chapter,
              importance: e.importance,
              tags: e.tags,
              timestamp: e.timestamp,
              lightweight: isLightweightMode,
            },
            draggable: false,
          } satisfies Node);
        }
      }
    }

    return nodes;
  }, [filteredEvents, uniqueChapters, uniqueCharacters, isLightweightMode]);

  // ── ReactFlow state ──
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

  // ── Sync nodes when data/filters change ──
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // ── Node click handler: show detail dialog ──
  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type !== "timelineEvent") return;
      const edata = node.data as unknown as TimelineNodeData;
      // Find the original event from the full list
      const event = events.find((e) => e.id === edata.id);
      if (event) {
        setSelectedEvent(event);
      }
    },
    [events],
  );

  // ── Node double-click handler: open edit dialog ──
  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type !== "timelineEvent") return;
      const edata = node.data as unknown as TimelineNodeData;
      const event = events.find((e) => e.id === edata.id);
      if (event) {
        setContextMenu(null);
        setEditingEvent(event);
        setEditDialogOpen(true);
      }
    },
    [events],
  );

  // ── Node right-click handler: show context menu ──
  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      if (node.type !== "timelineEvent") return;
      event.preventDefault();
      const edata = node.data as unknown as TimelineNodeData;
      const ev = events.find((e) => e.id === edata.id);
      if (ev) {
        setContextMenu({
          event: ev,
          x: event.clientX,
          y: event.clientY,
        });
      }
    },
    [events],
  );

  // ── Close context menu ──
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // ── Open edit dialog from context menu ──
  const handleContextMenuEdit = useCallback(() => {
    if (!contextMenu) return;
    setEditingEvent(contextMenu.event);
    setEditDialogOpen(true);
    closeContextMenu();
  }, [contextMenu, closeContextMenu]);

  // ── Open create dialog ──
  const handleCreateEvent = useCallback(() => {
    setEditingEvent(null);
    setEditDialogOpen(true);
  }, []);

  // ── Handle delete from context menu ──
  const handleContextMenuDelete = useCallback(() => {
    if (!contextMenu) return;
    setDeleteConfirmEvent(contextMenu.event);
    closeContextMenu();
  }, [contextMenu, closeContextMenu]);

  // ── Confirm delete ──
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirmEvent) return;
    setDeleting(true);
    try {
      await fetchJson<{ deleted: boolean }>(
        `/books/${bookId}/timelines/${deleteConfirmEvent.id}`,
        { method: "DELETE" },
      );
      setDeleteConfirmEvent(null);
      void refetch();
    } catch (e) {
      // Silently handle — the refetch will surface any issues
      setDeleteConfirmEvent(null);
      void refetch();
    } finally {
      setDeleting(false);
    }
  }, [deleteConfirmEvent, bookId, refetch]);

  // ── Handle save (create or update) ──
  const handleSaveEvent = useCallback(
    async (form: EventFormData, eventId: string | null) => {
      // Parse relatedCharacters and tags from comma-separated strings
      const relatedCharacters = form.relatedCharacters
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const tags = form.tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const body = {
        timestamp: new Date().toISOString(),
        eventType: form.eventType,
        title: form.title.trim(),
        description: form.description.trim(),
        relatedCharacters,
        chapter: form.chapter,
        importance: form.importance,
        ...(tags.length > 0 ? { tags } : {}),
      };

      if (eventId === null) {
        // Create
        await postApi<{ event: TimelineEvent }>(
          `/books/${bookId}/timelines`,
          body,
        );
      } else {
        // Update — send full body (PUT uses partial merge)
        await putApi<{ event: TimelineEvent }>(
          `/books/${bookId}/timelines/${eventId}`,
          body,
        );
      }

      setEditDialogOpen(false);
      setEditingEvent(null);
      void refetch();
    },
    [bookId, refetch],
  );

  // ── Cancel edit ──
  const handleCancelEdit = useCallback(() => {
    setEditDialogOpen(false);
    setEditingEvent(null);
  }, []);

  const closeDialog = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  // ── Format timestamp ──
  function formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">加载时间线…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <div className="rounded-full bg-destructive/10 p-3">
            <svg
              className="w-6 h-6 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-sm text-destructive font-medium">无法加载时间线数据</p>
          <p className="text-xs text-muted-foreground max-w-md text-center">{error}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (events.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <svg
            className="w-12 h-12 text-muted-foreground/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-muted-foreground">暂无时间线事件</p>
          <p className="text-xs text-muted-foreground/60 mb-2">开始添加第一个事件吧</p>
          <Button onClick={handleCreateEvent}>
            <PlusIcon className="size-4" />
            新增事件
          </Button>
        </div>
      </div>
    );
  }

  // ── Main timeline view ──
  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with filters */}
        <div className="flex items-center justify-between px-6 py-3 shrink-0 border-b border-border/10">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-foreground">时间线</h2>
            <span className="text-xs text-muted-foreground/60">
              {totalFilteredCount} 个事件 · {uniqueChapters.length} 章 · {uniqueCharacters.length} 个角色
              {(characterFilter || chapterFilter) && ` · 筛选`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Volume selector */}
            {volumes.length > 0 && (
              <select
                value={selectedVolumeId ?? ""}
                onChange={(e) => setSelectedVolumeId(e.target.value || null)}
                className="rounded-lg bg-card/80 border border-border/30 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer max-w-[130px] truncate"
                title="按分卷筛选"
              >
                {volumes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </select>
            )}

            {/* Character filter */}
            <input
              type="text"
              placeholder="筛选角色…"
              value={characterFilter}
              onChange={(e) => setCharacterFilter(e.target.value)}
              className="rounded-lg bg-card/80 border border-border/30 px-2.5 py-1.5 text-xs text-muted-foreground placeholder:text-muted-foreground/40 hover:text-foreground transition-colors w-[120px]"
            />

            {/* Chapter filter */}
            <select
              value={chapterFilter}
              onChange={(e) => setChapterFilter(e.target.value)}
              className="rounded-lg bg-card/80 border border-border/30 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer max-w-[100px] truncate"
            >
              <option value="">所有章节</option>
              {uniqueChapters.map((ch) => (
                <option key={ch} value={ch}>第 {ch} 章</option>
              ))}
            </select>

            {/* Legend */}
            <div className="flex items-center gap-2 rounded-lg bg-card/50 border border-border/20 px-2.5 py-1.5">
              {Object.entries(EVENT_TYPE_COLORS).map(([key, c]) => (
                <div key={key} className="flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: c.border }}
                  />
                  <span className="text-[10px] text-muted-foreground">{c.label}</span>
                </div>
              ))}
            </div>

            {/* Add event button */}
            <Button
              variant="default"
              size="icon-sm"
              onClick={handleCreateEvent}
              title="新增事件"
            >
              <PlusIcon className="size-4" />
            </Button>

            {/* FPS counter (dev mode) */}
            {import.meta.env.DEV && <FpsCounter />}

            {/* Lightweight mode indicator */}
            {isLightweightMode && (
              <span
                className="text-[10px] text-amber-500/70 font-medium"
                title="事件数超过 500，已启用轻量模式以提升性能"
              >
                轻量
              </span>
            )}
          </div>
        </div>

        {/* ReactFlow canvas */}
        <div className="flex-1 min-h-0">
          <ReactFlow
            nodes={nodes}
            edges={[]}
            onNodesChange={onNodesChange}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeContextMenu={onNodeContextMenu}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            nodesDraggable={false}
            nodesConnectable={false}
            panOnDrag
            zoomOnScroll
            zoomOnDoubleClick={false}
            panActivationKeyCode="Space"
            maxZoom={2}
            minZoom={0.3}
            elevateNodesOnSelect
            deleteKeyCode={null}
            className="bg-background/50"
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="currentColor"
              style={{ opacity: 0.08 }}
            />
            <Controls
              showInteractive={false}
              className="!shadow-sm !border !border-border/20 !rounded-lg"
            />
          </ReactFlow>
        </div>

        {/* Bottom bar: event count + load more */}
        <div className="flex items-center justify-between shrink-0 px-6 py-2 border-t border-border/10">
          <span className="text-[11px] text-muted-foreground/50 tabular-nums">
            共 {totalFilteredCount} 个事件，已加载 {loadedCount} 个
            {totalCount !== totalFilteredCount && (
              <span className="ml-1.5 text-muted-foreground/30">
                （全部事件: {totalCount}）
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                className="rounded-lg bg-card/60 border border-border/20 px-3 py-1 text-[11px] text-muted-foreground/70 hover:text-foreground hover:bg-card transition-colors"
              >
                加载更多（+100）
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Event detail dialog */}
      <Dialog open={selectedEvent !== null} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        {selectedEvent && (
          <DialogContent className="sm:max-w-[480px]" showCloseButton>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: (EVENT_TYPE_COLORS[selectedEvent.eventType] ?? DEFAULT_COLOR).border,
                  }}
                />
                {selectedEvent.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              {/* Event type + importance */}
              <div className="flex items-center gap-3">
                <span
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${(EVENT_TYPE_COLORS[selectedEvent.eventType] ?? DEFAULT_COLOR).border}20`,
                    color: (EVENT_TYPE_COLORS[selectedEvent.eventType] ?? DEFAULT_COLOR).text,
                  }}
                >
                  {(EVENT_TYPE_COLORS[selectedEvent.eventType] ?? DEFAULT_COLOR).label}
                </span>
                <span className="text-xs text-muted-foreground/60">
                  {"★".repeat(selectedEvent.importance)}{"☆".repeat(5 - selectedEvent.importance)}
                </span>
                <span className="text-xs text-muted-foreground/40">
                  第 {selectedEvent.chapter} 章
                </span>
              </div>

              {/* Timestamp */}
              <p className="text-xs text-muted-foreground/50">
                {formatTime(selectedEvent.timestamp)}
              </p>

              {/* Description */}
              {selectedEvent.description && (
                <DialogDescription className="text-sm leading-relaxed">
                  {selectedEvent.description}
                </DialogDescription>
              )}

              {/* Related characters */}
              {selectedEvent.relatedCharacters.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground/70 mb-1.5">
                    关联角色
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEvent.relatedCharacters.map((ch) => (
                      <span
                        key={ch}
                        className="text-xs bg-secondary/50 px-2 py-0.5 rounded-full text-muted-foreground"
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedEvent.tags && selectedEvent.tags.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground/70 mb-1.5">
                    标签
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEvent.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-primary/10 text-primary/80 px-2 py-0.5 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Event edit dialog */}
      <EventEditDialog
        open={editDialogOpen}
        event={editingEvent}
        existingCharacters={uniqueCharacters}
        onSave={handleSaveEvent}
        onCancel={handleCancelEdit}
      />

      {/* Context menu overlay */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={closeContextMenu}
          onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
        >
          <div
            className="absolute min-w-[140px] bg-popover rounded-lg shadow-lg ring-1 ring-foreground/10 p-1 animate-in fade-in zoom-in-95 origin-top-left"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Edit */}
            <button
              type="button"
              onClick={handleContextMenuEdit}
              className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <PencilIcon className="size-3.5 text-muted-foreground" />
              编辑
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={handleContextMenuDelete}
              className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2Icon className="size-3.5" />
              删除
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirmEvent !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfirmEvent(null); }}
      >
        {deleteConfirmEvent && (
          <DialogContent className="sm:max-w-[380px]" showCloseButton>
            <DialogHeader>
              <DialogTitle className="text-base">确认删除</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              确认删除事件「{deleteConfirmEvent.title}」？此操作不可撤销。
            </p>
            <DialogFooter className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmEvent(null)}
                disabled={deleting}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? "删除中…" : "确认删除"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
