import { useState, useCallback } from "react";
import { useApi } from "../hooks/use-api";
import { ProgressWidget } from "../components/dashboard/ProgressWidget";
import { CharacterWidget } from "../components/dashboard/CharacterWidget";
import { RelationWidget } from "../components/dashboard/RelationWidget";
import { TimelineWidget } from "../components/dashboard/TimelineWidget";
import { WorldWidget } from "../components/dashboard/WorldWidget";
import { RefreshCw, Layout, GripVertical } from "lucide-react";

// ── Widget config schema (local to dashboard) ──

interface WidgetConfig {
  type: "progress" | "character" | "relation" | "timeline" | "world";
  position: { x: number; y: number; w: number; h: number };
}

interface DashboardConfig {
  widgets: WidgetConfig[];
}

const DEFAULT_CONFIG: DashboardConfig = {
  widgets: [
    { type: "progress", position: { x: 0, y: 0, w: 2, h: 1 } },
    { type: "character", position: { x: 2, y: 0, w: 2, h: 2 } },
    { type: "relation", position: { x: 0, y: 1, w: 2, h: 1 } },
    { type: "timeline", position: { x: 0, y: 2, w: 2, h: 1 } },
    { type: "world", position: { x: 2, y: 2, w: 2, h: 1 } },
  ],
};

function widgetLabel(type: string): string {
  const labels: Record<string, string> = {
    progress: "写作进度",
    character: "角色总览",
    relation: "关系图谱",
    timeline: "时间线",
    world: "世界观",
  };
  return labels[type] ?? type;
}

function WidgetCard({
  widget,
  children,
}: {
  widget: WidgetConfig;
  children: React.ReactNode;
}) {
  const colSpan = widget.position.w === 2 ? "md:col-span-2" : "md:col-span-1";
  const rowSpan = widget.position.h === 2 ? "md:row-span-2" : "";

  return (
    <div
      className={`${colSpan} ${rowSpan} bg-card border border-border/50 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col`}
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <GripVertical size={14} className="text-muted-foreground/40" />
          <span>{widgetLabel(widget.type)}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
        {children}
      </div>
    </div>
  );
}

// ── Dashboard layout grid ──

function DashboardGrid({
  config,
  bookId,
  onRefresh,
}: {
  config: DashboardConfig;
  bookId: string;
  onRefresh: () => void;
}) {
  const renderWidget = (widget: WidgetConfig) => {
    const key = `${widget.type}-${widget.position.x}-${widget.position.y}`;
    switch (widget.type) {
      case "progress":
        return (
          <WidgetCard key={key} widget={widget}>
            <ProgressWidget bookId={bookId} />
          </WidgetCard>
        );
      case "character":
        return (
          <WidgetCard key={key} widget={widget}>
            <CharacterWidget bookId={bookId} />
          </WidgetCard>
        );
      case "relation":
        return (
          <WidgetCard key={key} widget={widget}>
            <RelationWidget bookId={bookId} />
          </WidgetCard>
        );
      case "timeline":
        return (
          <WidgetCard key={key} widget={widget}>
            <TimelineWidget bookId={bookId} />
          </WidgetCard>
        );
      case "world":
        return (
          <WidgetCard key={key} widget={widget}>
            <WorldWidget bookId={bookId} />
          </WidgetCard>
        );
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 auto-rows-auto">
      {config.widgets.map(renderWidget)}
    </div>
  );
}

// ── Main Export ──

interface BookSummary {
  readonly id: string;
  readonly title: string;
  readonly genre: string;
  readonly status: string;
  readonly chaptersWritten: number;
}

interface Nav {
  toBook: (id: string) => void;
}

export function EditDashboard({ bookId, nav }: { bookId?: string; nav: Nav }) {
  const [config] = useState<DashboardConfig>(DEFAULT_CONFIG);
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: booksData, loading } = useApi<{ books: ReadonlyArray<BookSummary> }>("/books");

  const selectedBookId = bookId ?? booksData?.books[0]?.id ?? null;

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  if (!bookId && loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!selectedBookId) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Layout size={40} className="text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold text-muted-foreground">请先创建一本书</h2>
        <p className="text-sm text-muted-foreground/60 mt-1">创建项目后即可查看编辑仪表盘</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-6">
        <div>
          <h1 className="font-serif text-3xl mb-1">编辑仪表盘</h1>
          <p className="text-sm text-muted-foreground">
            作品 &mdash; {booksData?.books.find((b) => b.id === selectedBookId)?.title ?? selectedBookId}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
        >
          <RefreshCw size={16} />
          刷新
        </button>
      </div>

      {/* Widget Grid */}
      <DashboardGrid
        key={refreshKey}
        config={config}
        bookId={selectedBookId}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
