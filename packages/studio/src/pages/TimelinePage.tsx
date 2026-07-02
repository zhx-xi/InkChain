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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
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
          <p className="text-xs text-muted-foreground/60">在写作过程中事件将自动生成</p>
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
    </div>
  );
}
