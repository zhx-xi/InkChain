import { useEffect, useState, useCallback, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Save,
  Filter,
  GitBranch,
  X,
  GripVertical,
} from "lucide-react";
import { fetchJson } from "../hooks/use-api";
import { cn } from "../lib/utils";
import type {
  ChapterOutline,
  OutlineFile,
  PlotLine,
  KeyEvent,
} from "@inkchain/inkchain-core";

// ── Constants ──

const PLOT_LINE_CONFIG: Record<PlotLine, { label: string; color: string; bg: string }> = {
  main:    { label: "主线",     color: "text-amber-600",        bg: "bg-amber-100 dark:bg-amber-900/30" },
  "sub-a": { label: "支线 A",   color: "text-blue-600",         bg: "bg-blue-100 dark:bg-blue-900/30" },
  "sub-b": { label: "支线 B",   color: "text-emerald-600",      bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  "sub-c": { label: "支线 C",   color: "text-purple-600",       bg: "bg-purple-100 dark:bg-purple-900/30" },
};

const KEY_EVENT_CONFIG: Record<KeyEvent, { label: string; emoji: string; color: string }> = {
  climax:     { label: "高潮",   emoji: "🔴", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  twist:      { label: "反转",   emoji: "🟣", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  foreshadow: { label: "伏笔",   emoji: "🔵", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  reveal:     { label: "揭晓",   emoji: "🟢", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
};

const ALL_PLOT_LINES: PlotLine[] = ["main", "sub-a", "sub-b", "sub-c"];
const ALL_KEY_EVENTS: KeyEvent[] = ["climax", "twist", "foreshadow", "reveal"];
const DEBOUNCE_MS = 800;

// ── Props ──

interface OutlineEditorProps {
  bookId: string;
}

// ── Component ──

export function OutlineEditor({ bookId }: OutlineEditorProps) {
  const [outline, setOutline] = useState<OutlineFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedMap, setExpandedMap] = useState<Record<number, boolean>>({});
  const [plotLineFilter, setPlotLineFilter] = useState<PlotLine | "all">("all");
  const [showTreeView, setShowTreeView] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outlineRef = useRef<OutlineFile | null>(null);

  // Keep ref in sync for debounce
  useEffect(() => {
    outlineRef.current = outline;
  }, [outline]);

  // ── Load outline on mount ──

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchJson<{ outline: OutlineFile }>(`/books/${bookId}/outline`)
      .then((data) => {
        if (!cancelled) {
          setOutline(data.outline);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载大纲失败");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  // ── Autosave with debounce ──

  const saveOutline = useCallback(async (outlineToSave: OutlineFile) => {
    setSaving(true);
    try {
      const data = await fetchJson<{ outline: OutlineFile }>(`/books/${bookId}/outline`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapters: outlineToSave.chapters }),
      });
      setOutline(data.outline);
      setDirty(false);
    } catch (err) {
      console.error("保存大纲失败:", err);
    } finally {
      setSaving(false);
    }
  }, [bookId]);

  const scheduleSave = useCallback(() => {
    setDirty(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const current = outlineRef.current;
      if (current) {
        saveOutline(current);
      }
    }, DEBOUNCE_MS);
  }, [saveOutline]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Chapter mutations ──

  const updateChapter = useCallback((number: number, patch: Partial<ChapterOutline>) => {
    setOutline((prev) => {
      if (!prev) return prev;
      const chapters = prev.chapters.map((ch) =>
        ch.number === number ? { ...ch, ...patch } as ChapterOutline : ch,
      );
      return { ...prev, chapters };
    });
    scheduleSave();
  }, [scheduleSave]);

  const addChapter = useCallback(() => {
    setOutline((prev) => {
      if (!prev) return prev;
      const maxNumber = prev.chapters.reduce((max, ch) => Math.max(max, ch.number), 0);
      const newChapter: ChapterOutline = {
        number: maxNumber + 1,
        title: `第 ${maxNumber + 1} 章`,
        summary: "",
        wordTarget: 0,
        plotLine: "main",
        keyEvents: [],
      };
      return {
        ...prev,
        chapters: [...prev.chapters, newChapter].sort((a, b) => a.number - b.number),
        version: prev.version + 1,
      };
    });
    scheduleSave();
  }, [scheduleSave]);

  const removeChapter = useCallback((number: number) => {
    setOutline((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        chapters: prev.chapters.filter((ch) => ch.number !== number),
        version: prev.version + 1,
      };
    });
    setExpandedMap((prev) => {
      const next = { ...prev };
      delete next[number];
      return next;
    });
    scheduleSave();
  }, [scheduleSave]);

  const toggleKeyEvent = useCallback((chapterNumber: number, event: KeyEvent) => {
    setOutline((prev) => {
      if (!prev) return prev;
      const chapters = prev.chapters.map((ch) => {
        if (ch.number !== chapterNumber) return ch;
        const has = ch.keyEvents.includes(event);
        return {
          ...ch,
          keyEvents: has
            ? ch.keyEvents.filter((e) => e !== event)
            : [...ch.keyEvents, event],
        } as ChapterOutline;
      });
      return { ...prev, chapters };
    });
    scheduleSave();
  }, [scheduleSave]);

  // ── Derived data ──

  const filteredChapters = outline
    ? plotLineFilter === "all"
      ? outline.chapters
      : outline.chapters.filter((ch) => ch.plotLine === plotLineFilter)
    : [];

  // Build sub-plot tree: chapters with parentChapter defined
  const treeChapters = outline
    ? outline.chapters.filter((ch) => ch.parentChapter !== undefined)
    : [];

  // ── Render helpers ──

  const renderKeyEventBadges = (chapter: ChapterOutline) => (
    <div className="flex flex-wrap gap-1 mt-1">
      {ALL_KEY_EVENTS.map((event) => {
        const cfg = KEY_EVENT_CONFIG[event];
        const active = chapter.keyEvents.includes(event);
        return (
          <button
            key={event}
            type="button"
            onClick={() => toggleKeyEvent(chapter.number, event)}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors",
              active
                ? cfg.color
                : "bg-muted text-muted-foreground/50 hover:bg-muted/80",
            )}
            title={cfg.label}
          >
            <span>{cfg.emoji}</span>
            <span className="hidden sm:inline">{cfg.label}</span>
          </button>
        );
      })}
    </div>
  );

  const renderPlotLineTag = (plotLine: PlotLine) => {
    const cfg = PLOT_LINE_CONFIG[plotLine];
    return (
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold",
          cfg.color,
          cfg.bg,
        )}
      >
        {cfg.label}
      </span>
    );
  };

  // ── Loading / Error states ──

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>加载大纲中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-destructive">
        <p className="text-sm font-medium">加载失败</p>
        <p className="text-xs text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-3 py-1 text-xs font-medium border rounded-md hover:bg-muted transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  if (!outline) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <p className="text-sm">暂无大纲数据</p>
      </div>
    );
  }

  // ── Main render ──

  return (
    <div className="flex flex-col gap-4">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">大纲编辑器</h2>
          <span className="text-xs text-muted-foreground">
            {outline.chapters.length} 章
          </span>
          {dirty && (
            <span className="text-xs text-amber-500 font-medium">未保存</span>
          )}
          {saving && (
            <span className="text-xs text-blue-500 font-medium">保存中...</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Plot line filter */}
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPlotLineFilter("all")}
                className={cn(
                  "px-2 py-1 text-xs rounded transition-colors",
                  plotLineFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground",
                )}
              >
                全部
              </button>
              {ALL_PLOT_LINES.map((line) => (
                <button
                  key={line}
                  type="button"
                  onClick={() => setPlotLineFilter(line)}
                  className={cn(
                    "px-2 py-1 text-xs rounded transition-colors",
                    plotLineFilter === line
                      ? "bg-primary text-primary-foreground"
                      : PLOT_LINE_CONFIG[line].bg + " " + PLOT_LINE_CONFIG[line].color,
                  )}
                >
                  {PLOT_LINE_CONFIG[line].label}
                </button>
              ))}
            </div>
          </div>

          {/* Tree view toggle */}
          <button
            type="button"
            onClick={() => setShowTreeView((v) => !v)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
              showTreeView
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground",
            )}
          >
            <GitBranch className="w-3.5 h-3.5" />
            树形视图
          </button>

          {/* Add chapter */}
          <button
            type="button"
            onClick={addChapter}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            添加章节
          </button>

          {/* Manual save */}
          <button
            type="button"
            onClick={() => saveOutline(outline)}
            disabled={!dirty || saving}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors",
              dirty
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            <Save className="w-3.5 h-3.5" />
            保存
          </button>
        </div>
      </div>

      {/* ── Chapter list ── */}
      <div className="flex flex-col gap-2">
        {filteredChapters.length === 0 && (
          <div className="flex items-center justify-center h-20 text-sm text-muted-foreground border border-dashed rounded-lg">
            {plotLineFilter !== "all" ? "该主线/支线暂无章节" : "暂无章节，点击「添加章节」开始"}
          </div>
        )}

        {filteredChapters.map((chapter) => {
          const isExpanded = expandedMap[chapter.number] !== false; // default expanded
          return (
            <div
              key={chapter.number}
              className={cn(
                "border rounded-lg overflow-hidden transition-colors",
                chapter.plotLine === "main"
                  ? "border-amber-200 dark:border-amber-800"
                  : "border-border",
              )}
            >
              {/* ── Chapter header (collapsible) ── */}
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 cursor-pointer select-none transition-colors hover:bg-muted/50",
                  chapter.plotLine === "main"
                    ? "bg-amber-50/50 dark:bg-amber-950/10"
                    : "bg-card",
                )}
                onClick={() =>
                  setExpandedMap((prev) => ({
                    ...prev,
                    [chapter.number]: !prev[chapter.number],
                  }))
                }
              >
                <button
                  type="button"
                  className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                {/* Chapter number — bold for main plot */}
                <span
                  className={cn(
                    "text-sm font-mono min-w-[2rem]",
                    chapter.plotLine === "main"
                      ? "font-bold text-amber-700 dark:text-amber-400"
                      : "text-muted-foreground",
                  )}
                >
                  #{chapter.number}
                </span>

                {/* Editable title */}
                <input
                  type="text"
                  value={chapter.title}
                  onChange={(e) =>
                    updateChapter(chapter.number, { title: e.target.value })
                  }
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "flex-1 text-sm bg-transparent border-none outline-none px-1 py-0.5 rounded",
                    "focus:ring-1 focus:ring-primary/30 focus:bg-accent/30",
                    chapter.plotLine === "main"
                      ? "font-semibold"
                      : "font-normal",
                  )}
                  placeholder="章节标题"
                />

                {/* Plot line tag */}
                {renderPlotLineTag(chapter.plotLine)}

                {/* Key events summary (collapsed) */}
                {!isExpanded && chapter.keyEvents.length > 0 && (
                  <div className="flex gap-0.5">
                    {chapter.keyEvents.map((event) => (
                      <span key={event} title={KEY_EVENT_CONFIG[event].label}>
                        {KEY_EVENT_CONFIG[event].emoji}
                      </span>
                    ))}
                  </div>
                )}

                {/* Word target */}
                {chapter.wordTarget > 0 && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {chapter.wordTarget.toLocaleString()} 字
                  </span>
                )}

                {/* Delete button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeChapter(chapter.number);
                  }}
                  className="p-1 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                  title="删除章节"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* ── Chapter body (expanded) ── */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 space-y-3 bg-card">
                  {/* Summary textarea */}
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      摘要
                    </label>
                    <textarea
                      value={chapter.summary}
                      onChange={(e) =>
                        updateChapter(chapter.number, { summary: e.target.value })
                      }
                      rows={3}
                      className="w-full text-sm bg-muted/30 border border-border rounded-md px-2 py-1.5 resize-y focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-colors"
                      placeholder="章节内容摘要..."
                    />
                  </div>

                  {/* Word target */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">
                      字数目标
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={chapter.wordTarget}
                      onChange={(e) =>
                        updateChapter(chapter.number, {
                          wordTarget: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className="w-28 text-sm bg-muted/30 border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                    <span className="text-xs text-muted-foreground">字</span>
                  </div>

                  {/* Plot line selector */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">
                      主线/支线
                    </label>
                    <div className="flex gap-1">
                      {ALL_PLOT_LINES.map((line) => (
                        <button
                          key={line}
                          type="button"
                          onClick={() =>
                            updateChapter(chapter.number, { plotLine: line })
                          }
                          className={cn(
                            "px-2 py-0.5 text-xs rounded transition-colors",
                            chapter.plotLine === line
                              ? PLOT_LINE_CONFIG[line].bg +
                                  " " +
                                  PLOT_LINE_CONFIG[line].color +
                                  " ring-1 ring-current"
                              : "bg-muted text-muted-foreground hover:bg-muted/80",
                          )}
                        >
                          {PLOT_LINE_CONFIG[line].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Key events */}
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      关键事件标记
                    </label>
                    {renderKeyEventBadges(chapter)}
                  </div>

                  {/* Parent chapter (sub-plot tree) */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">
                      父章节（支线归属）
                    </label>
                    <select
                      value={chapter.parentChapter ?? ""}
                      onChange={(e) =>
                        updateChapter(chapter.number, {
                          parentChapter: e.target.value
                            ? parseInt(e.target.value)
                            : undefined,
                        })
                      }
                      className="text-sm bg-muted/30 border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    >
                      <option value="">无（独立章节）</option>
                      {outline.chapters
                        .filter((ch) => ch.number !== chapter.number)
                        .map((ch) => (
                          <option key={ch.number} value={ch.number}>
                            #{ch.number} {ch.title}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Sub-plot tree view ── */}
      {showTreeView && (
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            子章节树形视图
          </h3>
          {treeChapters.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              暂无子章节。在章节编辑中设置「父章节」即可在此显示。
            </p>
          ) : (
            <div className="space-y-1 pl-2 border-l-2 border-muted">
              {outline.chapters
                .filter((ch) => ch.parentChapter === undefined)
                .map((parent) => {
                  const children = outline.chapters.filter(
                    (ch) => ch.parentChapter === parent.number,
                  );
                  if (children.length === 0) return null;
                  return (
                    <div key={parent.number} className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-xs text-muted-foreground">
                          #{parent.number}
                        </span>
                        <span className="font-medium">{parent.title}</span>
                        {renderPlotLineTag(parent.plotLine)}
                      </div>
                      <div className="ml-6 pl-3 border-l border-muted space-y-1">
                        {children.map((child) => (
                          <div
                            key={child.number}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span className="font-mono text-xs text-muted-foreground">
                              #{child.number}
                            </span>
                            <span>{child.title}</span>
                            {renderPlotLineTag(child.plotLine)}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
