import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Command, Search, FileText, BarChart3, BookOpen, LogOut, Home, Download } from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: typeof Command;
  action: () => void;
}

interface CommandPaletteProps {
  readonly bookId?: string;
  readonly onClose?: () => void;
}

export function CommandPalette({ bookId }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    { id: "dashboard", label: "返回仪表盘", description: "回到书籍列表", icon: Home, action: () => navigate("/") },
    { id: "new-chapter", label: "写新章节", description: "开始撰写下一章", icon: FileText, action: () => bookId && navigate(`/books/${bookId}/write`) },
    { id: "stats", label: "写作统计", description: "查看字数趋势和统计", icon: BarChart3, action: () => bookId && navigate(`/books/${bookId}/stats`) },
    { id: "relation-graph", label: "关系图谱", description: "查看角色关系图谱", icon: BookOpen, action: () => bookId && navigate(`/books/${bookId}/relations`) },
    { id: "export", label: "导出作品", description: "导出为 TXT/MD/EPUB", icon: Download, action: () => bookId && navigate(`/books/${bookId}/publish`) },
    { id: "worlds", label: "世界观管理", description: "管理世界观设定", icon: BookOpen, action: () => navigate("/worlds") },
  ];

  // Filter items by query
  const filtered = query.trim()
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.description.toLowerCase().includes(query.toLowerCase()),
      )
    : commands;

  // Global keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setSelectedIdx(0);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Execute selected command
  const execute = useCallback(
    (item: CommandItem) => {
      setOpen(false);
      item.action();
    },
    [],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIdx]) {
        e.preventDefault();
        execute(filtered[selectedIdx]);
      }
    },
    [filtered, selectedIdx, execute],
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
        onClick={() => setOpen(false)}
      />

      {/* Command palette */}
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg">
        <div className="rounded-xl border border-border/20 bg-card shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/10">
            <Search size={16} className="text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIdx(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="搜索命令..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none border-none"
            />
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
              <kbd className="rounded border border-border/20 px-1.5 py-0.5 font-mono">
                <Command size={10} className="inline" />
              </kbd>
              <span>K</span>
            </div>
          </div>

          {/* Results */}
          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                未找到匹配命令
              </p>
            ) : (
              filtered.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => execute(item)}
                  className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors ${
                    idx === selectedIdx
                      ? "bg-accent/50 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                  }`}
                >
                  <item.icon size={16} className="shrink-0 opacity-60" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-[11px] opacity-60">{item.description}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
