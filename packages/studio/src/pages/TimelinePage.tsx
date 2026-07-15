import { useMemo, useState, useCallback, useEffect, memo, useRef } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useReactFlow,
  type Node,
  type Edge,
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
import { PlusIcon, PencilIcon, Trash2Icon, XIcon, Bot, Loader2, X, Search, ChevronDown, ChevronRight } from "lucide-react";
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
const ROW_GAP_Y = 76;  // Base row gap; auto-adjusted when nodes overlap
const LEFT_MARGIN = 160;   // Space for character Y-axis labels
const TOP_MARGIN = 80;     // Space for chapter X-axis labels
const HEADER_NODE_WIDTH = 140;
const HEADER_NODE_HEIGHT = 36;
const MAX_VISIBLE_EVENTS_PER_CELL = 3;  // Collapse threshold: show +N more when exceeded

// ── Gap computation helpers (exported for testing) ──

/** Compute the vertical gap between character rows based on max events in any cell */
export function computeDynamicRowGap(maxCellEvents: number): number {
  // Ensure row gap is large enough to accommodate the tallest stack of events in any cell,
  // plus 16px bottom padding, and never below ROW_GAP_Y baseline.
  return Math.max(ROW_GAP_Y, (NODE_HEIGHT + 4) * maxCellEvents + 16);
}

/** Compute the horizontal gap between chapter columns based on max events in any cell */
export function computeColumnGap(maxCellEvents: number): number {
  // Keep column gap in 180-220px range; prevent dynamic widening beyond 220
  return COLUMN_GAP_X;
}

/** Compute the Y offset for no-role events (below all character rows) */
export function computeNoRoleY(
  baseY: number,
  charCount: number,
  charRowGap: number,
  eventIndex: number,
): number {
  return baseY + charCount * charRowGap + eventIndex * (NODE_HEIGHT + 4);
}

// ── FPS Counter (dev-mode only) ──

// ── Zoom Controls (custom buttons with data-testid for E2E) ──

function TimelineZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="absolute bottom-4 right-14 z-10 flex items-center gap-1 rounded-lg border border-border/20 bg-card/90 p-1 shadow-sm">
      <button
        type="button"
        data-testid="tl-btn-zoom-in"
        onClick={() => zoomIn()}
        className="flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        title="放大"
      >
        +
      </button>
      <button
        type="button"
        data-testid="tl-btn-zoom-out"
        onClick={() => zoomOut()}
        className="flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        title="缩小"
      >
        −
      </button>
      <button
        type="button"
        data-testid="tl-btn-fit-view"
        onClick={() => fitView({ padding: 0.3 })}
        className="flex h-7 w-7 items-center justify-center rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        title="适应画布"
      >
        ⊞
      </button>
    </div>
  );
}

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
        data-testid="tl-event-node"
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
      data-testid="tl-event-node"
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

// ── Custom Overflow / Collapse Node ──

interface OverflowNodeData {
  label: string;
  cellKey: string;
  hiddenCount: number;
}

type OverflowNodeType = Node<OverflowNodeData, "overflowIndicator">;

function OverflowIndicatorNode({ data }: NodeProps<OverflowNodeType>) {
  return (
    <div
      data-testid={`tl-cell-overflow-btn-${data.cellKey}`}
      className="flex items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-card/60 text-xs text-muted-foreground cursor-pointer hover:bg-card hover:border-muted-foreground/50 transition-colors"
      style={{ width: NODE_WIDTH, minHeight: 28 }}
      title={`展开其余 ${data.hiddenCount} 个事件`}
    >
      <span className="font-medium">+{data.hiddenCount} 更多</span>
    </div>
  );
}

const MemoOverflowIndicatorNode = memo(OverflowIndicatorNode);

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
  overflowIndicator: MemoOverflowIndicatorNode,
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

interface TimelineExtractEvent {
  title: string;
  eventType: string;
  description: string;
  relatedCharacters: string[];
  importance: number;
  tags: string[];
  chapter?: number;
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

  // Collapse/expand state for event cells: cellKey → expanded (true = show all)
  const [expandedCells, setExpandedCells] = useState<Set<string>>(() => new Set());

  /** Toggle a cell from collapsed to expanded (show all hidden events) */
  const expandCell = useCallback((cellKey: string) => {
    setExpandedCells((prev) => {
      if (prev.has(cellKey)) return prev; // already expanded
      const next = new Set(prev);
      next.add(cellKey);
      return next;
    });
  }, []);

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

  // AI extract state
  const [showAiExtract, setShowAiExtract] = useState(false);
  const [aiExtractResult, setAiExtractResult] = useState<TimelineExtractEvent[] | null>(null);
  const [aiExtractLoading, setAiExtractLoading] = useState(false);
  const [aiExtractChapter, setAiExtractChapter] = useState("1");
  const [aiExtractError, setAiExtractError] = useState<string | null>(null);
  const [checkedEvents, setCheckedEvents] = useState<Set<number>>(new Set());
  const [aiExtractSaving, setAiExtractSaving] = useState(false);

  // ── Collapse/expand state for volume and chapter hierarchy ──
  const [collapsedVolumes, setCollapsedVolumes] = useState<Set<string>>(new Set());
  const [collapsedChapters, setCollapsedChapters] = useState<Set<number>>(new Set());

  const toggleVolumeCollapse = useCallback((volumeId: string) => {
    setCollapsedVolumes(prev => {
      const next = new Set(prev);
      if (next.has(volumeId)) next.delete(volumeId);
      else next.add(volumeId);
      return next;
    });
  }, []);

  const toggleChapterCollapse = useCallback((chapterNum: number) => {
    setCollapsedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterNum)) next.delete(chapterNum);
      else next.add(chapterNum);
      return next;
    });
  }, []);

  // ── Parse chapter range "1-5" → [1,2,3,4,5], "1,2,3" → [1,2,3] ──
  const parseChapterRange = useCallback((input: string): number[] => {
    const trimmed = input.trim();
    if (!trimmed) return [];
    if (trimmed.includes(",")) {
      return trimmed.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
    }
    if (trimmed.includes("-")) {
      const parts = trimmed.split("-").map(s => parseInt(s.trim(), 10));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] > 0 && parts[1] >= parts[0]) {
        const result: number[] = [];
        for (let i = parts[0]; i <= parts[1]; i++) result.push(i);
        return result;
      }
      return [];
    }
    const n = parseInt(trimmed, 10);
    return !isNaN(n) && n > 0 ? [n] : [];
  }, []);

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

  // ── Compute unique chapters and characters (from filtered events, not all events) ──
  const { uniqueChapters, uniqueCharacters } = useMemo(() => {
    const chapters = new Set<number>();
    const characters = new Set<string>();
    for (const e of filteredEvents) {
      chapters.add(e.chapter);
      for (const ch of e.relatedCharacters) {
        characters.add(ch);
      }
    }
    return {
      uniqueChapters: [...chapters].sort((a, b) => a - b),
      uniqueCharacters: [...characters].sort(),
    };
  }, [filteredEvents]);

  // ── Build ReactFlow nodes ──
  const initialNodes = useMemo<Node[]>(() => {
    const nodes: Node[] = [];

    // Apply collapse/expand filtering
    const isVolumeCollapsed = selectedVolumeId !== null && collapsedVolumes.has(selectedVolumeId);
    const isAllCollapsed = selectedVolumeId === null && collapsedVolumes.has('__all__');
    const visibleEvents = (isVolumeCollapsed || isAllCollapsed)
      ? []
      : collapsedChapters.size > 0
        ? filteredEvents.filter(e => !collapsedChapters.has(e.chapter))
        : filteredEvents;

    const chapterIndexMap = new Map<number, number>();
    uniqueChapters.forEach((ch, i) => chapterIndexMap.set(ch, i));

    const characterIndexMap = new Map<string, number>();
    uniqueCharacters.forEach((ch, i) => characterIndexMap.set(ch, i));

    // First pass: count events per (chapter, character) cell (needed for gap computation)
    const cellCounts = new Map<string, number>();
    for (const e of visibleEvents) {
      const chIdx = chapterIndexMap.get(e.chapter);
      if (chIdx === undefined) continue;

      if (e.relatedCharacters.length === 0) {
        const cellKey = `ch-${e.chapter}-norole`;
        cellCounts.set(cellKey, (cellCounts.get(cellKey) ?? 0) + 1);
      } else {
        for (const character of e.relatedCharacters) {
          const charIdx = characterIndexMap.get(character);
          if (charIdx === undefined) continue;
          const cellKey = `ch-${e.chapter}-char-${character}`;
          cellCounts.set(cellKey, (cellCounts.get(cellKey) ?? 0) + 1);
        }
      }
    }

    // Compute dynamic gaps based on max events in any cell
    const maxCellEvents = Math.max(...Array.from(cellCounts.values()), 1);
    const dynamicRowGap = computeDynamicRowGap(maxCellEvents);

    // Dynamic column gap: widen columns when cells are dense (many events stacked vertically)
    const columnGap = COLUMN_GAP_X;

    // Chapter header nodes (X-axis) — use dynamic column gap
    for (const ch of uniqueChapters) {
      const idx = chapterIndexMap.get(ch)!;
      nodes.push({
        id: `chapter-${ch}`,
        type: "chapterHeader",
        position: {
          x: LEFT_MARGIN + idx * columnGap + (columnGap - HEADER_NODE_WIDTH) / 2,
          y: 0,
        },
        data: { label: `第 ${ch} 章` },
        draggable: false,
        deletable: false,
        selectable: false,
      });
    }

    // Character header nodes (Y-axis) — use dynamic row gap
    for (const ch of uniqueCharacters) {
      const idx = characterIndexMap.get(ch)!;
      nodes.push({
        id: `char-${ch}`,
        type: "characterHeader",
        position: {
          x: 0,
          y: TOP_MARGIN + idx * dynamicRowGap + (dynamicRowGap - HEADER_NODE_HEIGHT) / 2,
        },
        data: { label: ch },
        draggable: false,
        deletable: false,
        selectable: false,
      });
    }

    // Event nodes (second pass)
    const eventCellCounts = new Map<string, number>();
    for (const e of visibleEvents) {
      const chIdx = chapterIndexMap.get(e.chapter);
      if (chIdx === undefined) continue;

      const baseX = LEFT_MARGIN + chIdx * columnGap + (columnGap - NODE_WIDTH) / 2;
      const baseY = TOP_MARGIN;

      if (e.relatedCharacters.length === 0) {
        // Events with no character — place at top of the chapter column
        const cellKey = `ch-${e.chapter}-norole`;
        const count = eventCellCounts.get(cellKey) ?? 0;
        eventCellCounts.set(cellKey, count + 1);

        // Collapse check: if collapsed and beyond max visible, skip and add overflow node later
        const totalInCell = cellCounts.get(cellKey) ?? 1;
        const isCollapsed = !expandedCells.has(cellKey) && totalInCell > MAX_VISIBLE_EVENTS_PER_CELL;
        if (isCollapsed && count >= MAX_VISIBLE_EVENTS_PER_CELL) {
          // Skip this event; overflow indicator will be placed after the loop
          continue;
        }

        nodes.push({
          id: e.id,
          type: "timelineEvent",
          position: {
            x: baseX,
            y: baseY + uniqueCharacters.length * dynamicRowGap + count * (NODE_HEIGHT + 4),
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
      } else {
        for (const character of e.relatedCharacters) {
          const charIdx = characterIndexMap.get(character);
          if (charIdx === undefined) continue;

          const cellKey = `ch-${e.chapter}-char-${character}`;
          const count = eventCellCounts.get(cellKey) ?? 0;
          eventCellCounts.set(cellKey, count + 1);

          // Collapse check: if collapsed and beyond max visible, skip
          const totalInCell = cellCounts.get(cellKey) ?? 1;
          const isCollapsed = !expandedCells.has(cellKey) && totalInCell > MAX_VISIBLE_EVENTS_PER_CELL;
          if (isCollapsed && count >= MAX_VISIBLE_EVENTS_PER_CELL) {
            continue;
          }

          nodes.push({
            id: `${e.id}-${character}`,
            type: "timelineEvent",
            position: {
              x: baseX,
              y: baseY + charIdx * dynamicRowGap + count * (NODE_HEIGHT + 4),
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

    // Third pass: add overflow indicators for collapsed cells
    for (const [cellKey, totalCount] of cellCounts) {
      if (totalCount <= MAX_VISIBLE_EVENTS_PER_CELL) continue;
      if (expandedCells.has(cellKey)) continue; // already expanded

      // Determine position: at the end of the visible stack
      const visibleCount = Math.min(totalCount, MAX_VISIBLE_EVENTS_PER_CELL);
      const [prefix, chStr, ...rest] = cellKey.split("-");
      // cellKey format: "ch-{chapter}-char-{character}" or "ch-{chapter}-norole"
      // e.g. "ch-2-char-林夕" → prefix="ch", chStr="2", rest=["char", "林夕"]
      const chapter = parseInt(chStr, 10);
      if (isNaN(chapter)) continue;

      let charIdx = -1;
      if (rest[0] === "char" && rest.length >= 2) {
        const characterName = rest.slice(1).join("-");
        charIdx = characterIndexMap.get(characterName) ?? -1;
        if (charIdx < 0) continue;
      }

      const chIdx = chapterIndexMap.get(chapter);
      if (chIdx === undefined) continue;

      const baseX = LEFT_MARGIN + chIdx * columnGap + (columnGap - NODE_WIDTH) / 2;
      const baseY = TOP_MARGIN;
      const hiddenCount = totalCount - MAX_VISIBLE_EVENTS_PER_CELL;

      let overflowY: number;
      if (charIdx >= 0) {
        // Character-associated cell
        overflowY = baseY + charIdx * dynamicRowGap + visibleCount * (NODE_HEIGHT + 4);
      } else {
        // No-role cell
        overflowY = baseY + uniqueCharacters.length * dynamicRowGap + visibleCount * (NODE_HEIGHT + 4);
      }

      nodes.push({
        id: `overflow-${cellKey}`,
        type: "overflowIndicator",
        position: { x: baseX, y: overflowY },
        data: {
          label: `+${hiddenCount} 更多`,
          cellKey,
          hiddenCount,
        },
        draggable: false,
        deletable: false,
        selectable: false,
      });
    }

    return nodes;
  }, [filteredEvents, uniqueChapters, uniqueCharacters, isLightweightMode, collapsedVolumes, collapsedChapters, selectedVolumeId]);

  // ── Build ReactFlow edges for cross-role connections ──
  const timelineEdges = useMemo(() => {
    const edgeMap = new Map<string, Edge>();
    const byChapter = new Map<number, typeof filteredEvents>();
    for (const e of filteredEvents) {
      const list = byChapter.get(e.chapter) ?? [];
      list.push(e);
      byChapter.set(e.chapter, list);
    }
    for (const [, chapterEvents] of byChapter) {
      if (chapterEvents.length < 2) continue;
      for (let i = 0; i < chapterEvents.length; i++) {
        for (let j = i + 1; j < chapterEvents.length; j++) {
          const a = chapterEvents[i];
          const b = chapterEvents[j];
          if (!a.tags?.length || !b.tags?.length) continue;
          const sharedTags = a.tags.filter((t) => b.tags!.includes(t));
          if (sharedTags.length === 0) continue;
          const aChars = a.relatedCharacters;
          const bChars = b.relatedCharacters;
          const hasCrossRole = aChars.length === 0 || bChars.length === 0 ||
            aChars.some((c) => !bChars.includes(c)) ||
            bChars.some((c) => !aChars.includes(c));
          if (!hasCrossRole) continue;
          const edgeKey = `edge-${a.id}-${b.id}`;
          if (edgeMap.has(edgeKey)) continue;
          const sourceNodeId = aChars.length > 0 ? `${a.id}-${aChars[0]}` : a.id;
          const targetNodeId = bChars.length > 0 ? `${b.id}-${bChars[0]}` : b.id;
          const isCrossCharacter = aChars.length === 0 || bChars.length === 0 ||
            aChars.some((c) => !bChars.includes(c)) ||
            bChars.some((c) => !aChars.includes(c));
          const style = isCrossCharacter ? "dashed" : "solid";
          edgeMap.set(edgeKey, {
            id: edgeKey,
            source: sourceNodeId,
            target: targetNodeId,
            type: "smoothstep",
            animated: false,
            style: {
              stroke: "#8B5CF6",
              strokeWidth: 1.5,
              strokeDasharray: style === "dashed" ? "5 3" : undefined,
              opacity: 0.5,
            },
            label: `关联: ${sharedTags.join(", ")}`,
            labelStyle: { fontSize: 10, fill: "#8B5CF6", opacity: 0.6 },
          });
        }
      }
    }
    return Array.from(edgeMap.values());
  }, [filteredEvents]);

  // ── ReactFlow state ──
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

  // ── Sync nodes when data/filters change ──
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // ── Node click handler: show detail dialog or expand overflow ──
  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === "overflowIndicator") {
        const cellKey = (node.data as OverflowNodeData).cellKey;
        expandCell(cellKey);
        return;
      }
      if (node.type !== "timelineEvent") return;
      const edata = node.data as unknown as TimelineNodeData;
      // Find the original event from the full list
      const event = events.find((e) => e.id === edata.id);
      if (event) {
        setSelectedEvent(event);
      }
    },
    [events, expandCell],
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

  // ── ReactFlow instance for custom controls ──
  const reactFlowInstance = useReactFlow();

  // ── Refs for scroll/viewport preservation ──
  const headerRef = useRef<HTMLDivElement>(null);
  const savedScrollYRef = useRef(0);

  // ── Save scroll position before AI extraction modal opens ──
  const saveScrollPosition = useCallback(() => {
    savedScrollYRef.current = window.scrollY;
  }, []);

  // ── Restore scroll position after AI extraction modal closes ──
  const restoreScrollPosition = useCallback(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollYRef.current, behavior: "instant" as ScrollBehavior });
    });
  }, []);

  // ── AI Extract ──
  const handleAiExtract = useCallback(async () => {
    const chapters = parseChapterRange(aiExtractChapter);
    if (chapters.length === 0) {
      setAiExtractError("请输入有效的章节范围，如 1-5 或 1,2,3");
      return;
    }

    setAiExtractLoading(true);
    setAiExtractError(null);
    setAiExtractResult(null);
    setCheckedEvents(new Set());
    try {
      let allEvents: TimelineExtractEvent[] = [];
      for (const ch of chapters) {
        const result = await postApi<{ success: boolean; data: { events: TimelineExtractEvent[] } }>(
          `/api/extract`,
          { skillId: "extract-timeline", bookId, chapterNumber: ch },
        );
        allEvents = [...allEvents, ...result.data.events.map(ev => ({ ...ev, chapter: ch }))];
      }
      setAiExtractResult(allEvents);
    } catch (err) {
      setAiExtractError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiExtractLoading(false);
    }
  }, [bookId, aiExtractChapter, parseChapterRange]);

  // ── Apply extracted events to timeline ──
  const handleApplyEvents = useCallback(async (indices: number[]) => {
    if (!aiExtractResult || indices.length === 0) return;
    setAiExtractSaving(true);
    setAiExtractError(null);
    try {
      for (const idx of indices) {
        const ev = aiExtractResult[idx];
        if (!ev) continue;
        await postApi<{ event: TimelineEvent }>(
          `/books/${bookId}/timelines`,
          {
            timestamp: new Date().toISOString(),
            eventType: ev.eventType,
            title: ev.title,
            description: ev.description,
            relatedCharacters: ev.relatedCharacters,
            chapter: ev.chapter ?? 1,
            importance: ev.importance,
            ...(ev.tags.length > 0 ? { tags: ev.tags } : {}),
          },
        );
      }
      setAiExtractResult(null);
      setShowAiExtract(false);
      void refetch();
      restoreScrollPosition();
    } catch (err) {
      setAiExtractError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiExtractSaving(false);
    }
  }, [aiExtractResult, bookId, refetch]);

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
      <div data-testid="tl-state-loading tl-loading-spinner" className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
        <div className="flex items-center justify-center min-h-[400px]" data-testid="tl-state-loading">
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
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4" data-testid="tl-state-error">
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
      <><div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3" data-testid="tl-state-empty">
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
          <div className="flex items-center gap-2">
            <Button onClick={handleCreateEvent}>
              <PlusIcon className="size-4" />
              新增事件
            </Button>
            <Button
              variant="outline"
              onClick={() => { saveScrollPosition(); setAiExtractResult(null); setAiExtractError(null); setShowAiExtract(true); }}
            >
              <Bot className="size-4" />
              AI 提取事件
            </Button>
          </div>
        </div>
      </div>
      {showAiExtract && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/35 backdrop-blur-[2px]">
          <button
            type="button"
            aria-label="关闭"
            className="absolute inset-0 cursor-default"
            onClick={() => { setShowAiExtract(false); setAiExtractResult(null); setCheckedEvents(new Set()); }}
          />
          <div className="relative w-full max-w-2xl rounded-xl border border-border/55 bg-card shadow-2xl mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/45 px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">AI 提取时间线事件</h2>
              <button
                type="button"
                onClick={() => { setShowAiExtract(false); setAiExtractResult(null); setCheckedEvents(new Set()); }}
                className="p-1 rounded-md text-muted-foreground hover:bg-secondary/60"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-foreground shrink-0">提取章节：</label>
                <input
                  type="text"
                  placeholder="如 1-5 或 1,2,3"
                  value={aiExtractChapter}
                  onChange={(e) => setAiExtractChapter(e.target.value)}
                  className="w-40 rounded-lg border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
                />
                <button
                  type="button"
                  onClick={handleAiExtract}
                  disabled={aiExtractLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
                >
                  {aiExtractLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Bot size={14} />
                  )}
                  开始提取
                </button>
              </div>
              {aiExtractError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {aiExtractError}
                </div>
              )}
              {aiExtractLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-primary" />
                  <span className="ml-3 text-sm text-muted-foreground">AI 正在分析章节文本，请稍候…</span>
                </div>
              )}
              {aiExtractResult !== null && !aiExtractLoading && (
                <div className="space-y-2">
                  {aiExtractResult.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">未提取到事件。</p>
                  ) : (
                    aiExtractResult.map((ev, idx) => {
                      const color = EVENT_TYPE_COLORS[ev.eventType] ?? DEFAULT_COLOR;
                      const checked = checkedEvents.has(idx);
                      return (
                        <div key={idx} className="rounded-lg border border-border/40 bg-background p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setCheckedEvents(prev => {
                                    const next = new Set(prev);
                                    if (next.has(idx)) next.delete(idx); else next.add(idx);
                                    return next;
                                  });
                                }}
                                className="size-4 accent-primary"
                              />
                              <span className="font-medium text-sm text-foreground">{ev.title}</span>
                              <span
                                className="text-[10px] font-medium rounded px-1.5 py-0.5"
                                style={{ backgroundColor: `${color.border}20`, color: color.text }}
                              >
                                {color.label}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">{ev.description}</p>
                        </div>
                      );
                    })
                  )}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="default" size="sm" onClick={() => handleApplyEvents(aiExtractResult.map((_, i) => i))} disabled={aiExtractSaving || aiExtractResult.length === 0}>
                      {aiExtractSaving ? "保存中…" : "全部应用"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleApplyEvents([...checkedEvents])} disabled={aiExtractSaving || checkedEvents.size === 0}>
                      选择性应用（{checkedEvents.size}）
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setShowAiExtract(false); setAiExtractResult(null); setCheckedEvents(new Set()); }}>
                      关闭
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}</>
    );
  }

  // ── Main timeline view ──
  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header with filters */}
        <div ref={headerRef} className="flex items-center justify-between px-6 py-3 shrink-0 border-b border-border/10 sticky top-0 z-10 bg-background">
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
                <option value="">所有卷</option>
                {volumes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </select>
            )}

            {/* Volume collapse/expand toggle */}
            {volumes.length > 0 && (
              <button
                type="button"
                onClick={() => toggleVolumeCollapse(selectedVolumeId ?? '__all__')}
                data-testid="tl-btn-volume-collapse"
                className="rounded-lg bg-card/60 border border-border/20 px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
                title={collapsedVolumes.has(selectedVolumeId ?? '__all__') ? "展开卷" : "折叠卷"}
              >
                {collapsedVolumes.has(selectedVolumeId ?? '__all__') ? (
                  <ChevronRight size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </button>
            )}

            {/* Character filter */}
            <input
              data-testid="character-filter"
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

            {/* Chapter collapse/expand toggle */}
            {uniqueChapters.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const chapterNum = parseInt(chapterFilter, 10);
                  if (!isNaN(chapterNum)) {
                    toggleChapterCollapse(chapterNum);
                  } else {
                    // Toggle all chapters
                    if (collapsedChapters.size > 0) {
                      setCollapsedChapters(new Set());
                    } else {
                      setCollapsedChapters(new Set(uniqueChapters));
                    }
                  }
                }}
                data-testid="tl-btn-chapter-collapse"
                className="rounded-lg bg-card/60 border border-border/20 px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
                title={collapsedChapters.size > 0 ? "展开章节" : "折叠章节"}
              >
                {collapsedChapters.size > 0 ? (
                  <ChevronRight size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </button>
            )}

            {/* Expand/Collapse All button */}
            <button
              type="button"
              onClick={() => {
                if (collapsedVolumes.size > 0 || collapsedChapters.size > 0) {
                  setCollapsedVolumes(new Set());
                  setCollapsedChapters(new Set());
                } else {
                  setCollapsedVolumes(new Set(['__all__']));
                  setCollapsedChapters(new Set(uniqueChapters));
                }
              }}
              data-testid="tl-btn-expand-all"
              className="rounded-lg bg-card/60 border border-border/20 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {collapsedVolumes.size > 0 || collapsedChapters.size > 0 ? '全部展开' : '全部折叠'}
            </button>

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
              variant="outline"
              size="icon-sm"
              onClick={() => { saveScrollPosition(); setAiExtractResult(null); setAiExtractError(null); setShowAiExtract(true); }}
              title="AI 提取事件"
            >
              <Bot className="size-4" />
            </Button>
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
        <div className="flex-1 min-h-0" data-testid="tl-canvas-reactflow">
          <ReactFlow
            nodes={nodes}
            edges={timelineEdges}
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
            <TimelineZoomControls />
          </ReactFlow>
        </div>

        {/* Custom zoom controls */}
        <div className="absolute bottom-16 right-4 flex gap-1 z-10">
          <button
            type="button"
            data-testid="tl-btn-zoom-in"
            className="rounded-lg bg-card border border-border/30 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => reactFlowInstance.zoomIn()}
          >
            +
          </button>
          <button
            type="button"
            data-testid="tl-btn-zoom-out"
            className="rounded-lg bg-card border border-border/30 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => reactFlowInstance.zoomOut()}
          >
            −
          </button>
          <button
            type="button"
            data-testid="tl-btn-fit-view"
            className="rounded-lg bg-card border border-border/30 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => reactFlowInstance.fitView({ padding: 0.3 })}
          >
            ⊞
          </button>
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
                data-testid="tl-indicator-load-more"
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
            <DialogFooter className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedEvent(null);
                  setEditingEvent(selectedEvent);
                  setEditDialogOpen(true);
                }}
              >
                <PencilIcon className="size-3.5 mr-1" />
                编辑
              </Button>
            </DialogFooter>
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

      {/* AI Extract Modal */}
      {showAiExtract && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/35 backdrop-blur-[2px]">
          <button
            type="button"
            aria-label="关闭"
            className="absolute inset-0 cursor-default"
            onClick={() => { setShowAiExtract(false); setAiExtractResult(null); setCheckedEvents(new Set()); }}
          />
          <div className="relative w-full max-w-2xl rounded-xl border border-border/55 bg-card shadow-2xl mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/45 px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">AI 提取时间线事件</h2>
              <button
                type="button"
                onClick={() => { setShowAiExtract(false); setAiExtractResult(null); setCheckedEvents(new Set()); }}
                className="p-1 rounded-md text-muted-foreground hover:bg-secondary/60"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-foreground shrink-0">提取章节：</label>
                <input
                  type="text"
                  placeholder="如 1-5 或 1,2,3"
                  value={aiExtractChapter}
                  onChange={(e) => setAiExtractChapter(e.target.value)}
                  className="w-40 rounded-lg border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
                />
                <button
                  type="button"
                  onClick={handleAiExtract}
                  disabled={aiExtractLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
                >
                  {aiExtractLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Bot size={14} />
                  )}
                  开始提取
                </button>
              </div>

              {aiExtractError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {aiExtractError}
                </div>
              )}

              {aiExtractLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-primary" />
                  <span className="ml-3 text-sm text-muted-foreground">AI 正在分析章节文本，请稍候…</span>
                </div>
              )}

              {aiExtractResult !== null && !aiExtractLoading && (
                <div className="space-y-2">
                  {aiExtractResult.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">未提取到事件。</p>
                  ) : (
                    aiExtractResult.map((ev, idx) => {
                      const color = EVENT_TYPE_COLORS[ev.eventType] ?? DEFAULT_COLOR;
                      const checked = checkedEvents.has(idx);
                      return (
                        <div key={idx} className="rounded-lg border border-border/40 bg-background p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setCheckedEvents(prev => {
                                    const next = new Set(prev);
                                    if (next.has(idx)) next.delete(idx); else next.add(idx);
                                    return next;
                                  });
                                }}
                                className="size-4 accent-primary"
                              />
                              <span className="font-medium text-sm text-foreground">{ev.title}</span>
                              <span
                                className="text-[10px] font-medium rounded px-1.5 py-0.5"
                                style={{ backgroundColor: `${color.border}20`, color: color.text }}
                              >
                                {color.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span>{"★".repeat(ev.importance)}{"☆".repeat(5 - ev.importance)}</span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">{ev.description}</p>
                          {ev.relatedCharacters.length > 0 && (
                            <p className="text-[11px] text-muted-foreground/60">
                              角色：{ev.relatedCharacters.join("、")}
                            </p>
                          )}
                          {ev.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {ev.tags.map((tag, ti) => (
                                <span key={ti} className="text-[10px] bg-muted/60 text-muted-foreground rounded px-1.5 py-0.5">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="default" size="sm" onClick={() => handleApplyEvents(aiExtractResult.map((_, i) => i))} disabled={aiExtractSaving || aiExtractResult.length === 0}>
                      {aiExtractSaving ? "保存中…" : "全部应用"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleApplyEvents([...checkedEvents])} disabled={aiExtractSaving || checkedEvents.size === 0}>
                      选择性应用（{checkedEvents.size}）
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setShowAiExtract(false); setAiExtractResult(null); setCheckedEvents(new Set()); }}>
                      关闭
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
