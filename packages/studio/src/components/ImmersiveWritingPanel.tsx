import { useEffect, useRef, useState, useCallback } from "react";
import { Maximize2, Minimize2, BookOpen, FileText, List, Clock, Type } from "lucide-react";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";

const CHAPTER_TITLES = [
  "天剑宗",
  "山门相遇",
  "入门试炼",
  "石阶剑图",
  "归一剑式",
  "掌门召见",
];

interface Props {
  isOpen: boolean;
  content: string;
  chapterTitle: string;
  chapterNumber: number;
  onClose: () => void;
  onContentChange: (content: string) => void;
  theme: Theme;
  t: TFunction;
}

export function ImmersiveWritingPanel({
  isOpen,
  content,
  chapterTitle,
  chapterNumber,
  onClose,
  onContentChange,
  theme,
  t,
}: Props) {
  const c = useColors(theme);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [editContent, setEditContent] = useState(content);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [activeOutline, setActiveOutline] = useState(chapterTitle);
  const sidebarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync content from parent
  useEffect(() => {
    setEditContent(content);
  }, [content, isOpen]);

  // Focus editor when opened
  useEffect(() => {
    if (isOpen && editorRef.current) {
      setTimeout(() => editorRef.current?.focus(), 400);
    }
  }, [isOpen]);

  // Handle Esc to exit
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Enter fullscreen when opened
  useEffect(() => {
    if (!isOpen) return;
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
    setIsFullscreen(!!document.fullscreenElement);
  }, [isOpen]);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    } else {
      await document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    }
  }, []);

  const handleContentChange = useCallback(
    (value: string) => {
      setEditContent(value);
      onContentChange(value);
    },
    [onContentChange],
  );

  // Auto-hide toolbar after 3s of inactivity
  const resetToolbarTimer = useCallback(() => {
    setShowToolbar(true);
    if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
    toolbarTimerRef.current = setTimeout(() => {
      if (document.activeElement !== editorRef.current) return;
      setShowToolbar(false);
    }, 3000);
  }, []);

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const charCount = content.length;
  const estimatedReadMin = Math.max(1, Math.ceil(charCount / 500));

  const paragraphs = content.split(/\n\n+/).filter(Boolean);
  const lineCount = content.split("\n").length;

  // Outline items derived from headings in content
  const outlineItems = (() => {
    const items: Array<{ label: string; depth: number }> = [];
    // Derive headings by looking at # markers
    const lines = content.split("\n");
    for (const line of lines) {
      const h1 = line.match(/^#\s+(.+)/);
      if (h1) items.push({ label: h1[1], depth: 1 });
      const h2 = line.match(/^##\s+(.+)/);
      if (h2) items.push({ label: h2[1], depth: 2 });
      const h3 = line.match(/^###\s+(.+)/);
      if (h3) items.push({ label: h3[1], depth: 3 });
    }
    return items;
  })();

  if (!isOpen) return null;

  const bodyClass = `
    fixed inset-0 z-50 flex flex-col items-center
    transition-all duration-500 ease-out
    ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
    bg-background
  `;

  return (
    <div
      ref={containerRef}
      className={bodyClass}
      onMouseMove={resetToolbarTimer}
    >
      {/* Edge Hotzone — left edge area to trigger sidebar */}
      <div
        className="fixed left-0 top-0 w-4 h-full z-40"
        onMouseEnter={() => {
          if (sidebarTimerRef.current) clearTimeout(sidebarTimerRef.current);
          setSidebarVisible(true);
        }}
        onMouseLeave={() => {
          sidebarTimerRef.current = setTimeout(() => setSidebarVisible(false), 200);
        }}
      />

      {/* Floating Glass Sidebar — document outline */}
      <aside
        className={`
          fixed left-0 top-0 h-full w-64 z-50
          backdrop-blur-xl bg-card/70
          border-r border-border/40 shadow-2xl
          flex flex-col p-6
          transition-transform duration-350 ease-out
          ${sidebarVisible ? "translate-x-0" : "-translate-x-full"}
        `}
        onMouseEnter={() => {
          if (sidebarTimerRef.current) clearTimeout(sidebarTimerRef.current);
          setSidebarVisible(true);
        }}
        onMouseLeave={() => {
          sidebarTimerRef.current = setTimeout(() => setSidebarVisible(false), 200);
        }}
      >
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 pb-3 mb-4 border-b border-border/30">
          <FileText size={14} className="inline mr-2" />
          {t("reader.chapter")} {chapterNumber}
        </div>

        {/* Outline list */}
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {outlineItems.length > 0 ? (
            <>
              {/* Current chapter as root item */}
              <button
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeOutline === chapterTitle
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                }`}
                onClick={() => setActiveOutline(chapterTitle)}
              >
                {chapterTitle}
              </button>
              {outlineItems.map((item, i) => (
                <button
                  key={i}
                  className={`w-full text-left px-3 py-1.5 rounded-md transition-colors ${
                    item.depth === 1
                      ? "text-sm text-muted-foreground hover:bg-primary/5 hover:text-foreground pl-3"
                      : item.depth === 2
                        ? "text-[13px] text-muted-foreground/70 hover:bg-primary/5 hover:text-foreground pl-7"
                        : "text-[12px] text-muted-foreground/50 hover:bg-primary/5 hover:text-foreground pl-11"
                  }`}
                  onClick={() => setActiveOutline(item.label)}
                >
                  {item.label}
                </button>
              ))}
            </>
          ) : (
            <div className="text-xs text-muted-foreground/40 text-center py-8 italic">
              {t("reader.noOutline") || "无大纲"}
            </div>
          )}
        </div>

        {/* Sidebar hint */}
        <div className="mt-auto pt-4 border-t border-border/30 text-[10px] text-muted-foreground/40 text-center tracking-wider uppercase">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary/50 text-[9px] font-mono">
            Esc
          </span>{" "}
          {t("reader.exit") || "退出"} ·{" "}
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary/50 text-[9px] font-mono">
            F11
          </span>{" "}
          {t("reader.fullscreen") || "全屏"}
        </div>
      </aside>

      {/* Top Toolbar */}
      <div
        className={`
          fixed top-0 left-0 right-0 z-30
          flex items-center justify-between px-6 py-4
          transition-opacity duration-300 ease-out
          ${showToolbar ? "opacity-100" : "opacity-0 pointer-events-none"}
        `}
      >
        <div className="flex items-center gap-3">
          <BookOpen size={16} className="text-primary/60" />
          <span className="text-[13px] font-medium text-muted-foreground/70 tracking-wide font-serif">
            InkChain · {t("reader.immersiveWriting") || "沉浸写作"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border/30 bg-card/60 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all text-xs"
            title={isFullscreen ? t("reader.exitFullscreen") || "退出全屏" : t("reader.fullscreen") || "全屏"}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span className="hidden sm:inline">
              {isFullscreen ? (t("reader.exitFullscreen") || "退出全屏") : (t("reader.fullscreen") || "全屏")}
            </span>
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border/30 bg-card/60 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all text-xs"
          >
            <Minimize2 size={13} />
            {t("reader.exitImmersive") || "退出沉浸模式"}
            <kbd className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded bg-secondary/70 text-[9px] font-mono text-muted-foreground/70 border border-border/30">
              Esc
            </kbd>
          </button>
        </div>
      </div>

      {/* Immersive Editor */}
      <div className="flex-1 flex items-center justify-center w-full px-4 sm:px-10">
        <div className="w-full max-w-[820px] flex flex-col justify-center transform transition-transform duration-600 ease-out translate-y-0 scale-100">
          {/* Editor Header */}
          <div className="mb-6 text-center">
            <h2 className="text-3xl md:text-4xl font-serif italic text-foreground tracking-tight leading-tight">
              {chapterTitle}
            </h2>
            <div className="mt-3 flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
              <span>{t("reader.chapter")} {chapterNumber.toString().padStart(2, "0")}</span>
              <span className="w-1 h-1 rounded-full bg-border/40" />
              <span>{wordCount.toLocaleString()} {t("reader.words") || "字"}</span>
            </div>
          </div>

          {/* Editor Body */}
          <textarea
            ref={editorRef}
            value={editContent}
            onChange={(e) => handleContentChange(e.target.value)}
            className="
              w-full min-h-[55vh] max-h-[75vh]
              bg-transparent
              font-[Georgia,'Times New Roman','Songti SC','SimSun',serif]
              text-[17px] md:text-[19px] lg:text-[20px]
              leading-[1.8] tracking-[0.01em]
              text-foreground/90
              focus:outline-none resize-none
              px-0 py-4
              placeholder:text-muted-foreground/20
              scrollbar-thin
            "
            placeholder={t("reader.startWriting") || "开始写作..."}
            spellCheck={false}
          />

          {/* Status Bar */}
          <div className="mt-6 pt-4 border-t border-border/20">
            <div className="flex items-center justify-center gap-6 text-[11px] text-muted-foreground/50 font-mono tabular-nums">
              <span className="flex items-center gap-1.5">
                <Type size={12} />
                {charCount.toLocaleString()} {t("reader.chars") || "字符"}
              </span>
              <span className="flex items-center gap-1.5">
                <FileText size={12} />
                {wordCount.toLocaleString()} {t("reader.words") || "词"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono">{lineCount}</span>
                <span>{t("reader.lines") || "行"}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={12} />
                {estimatedReadMin} {t("reader.minRead")}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-3 flex items-center justify-center gap-3">
              <div className="w-32 h-1 rounded-full bg-border/30 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/40 transition-all duration-300"
                  style={{ width: `${Math.min(100, (charCount / 5000) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground/40 font-mono">
                {Math.min(100, Math.round((charCount / 5000) * 100))}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
