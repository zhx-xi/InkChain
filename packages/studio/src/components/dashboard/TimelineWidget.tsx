import { useApi } from "../../hooks/use-api";
import { Clock, Calendar } from "lucide-react";

interface TimelineEvent {
  readonly id: string;
  readonly chapter: number;
  readonly description: string;
  readonly date?: string;
}

interface DashboardData {
  readonly recentEvents?: ReadonlyArray<TimelineEvent>;
}

export function TimelineWidget({ bookId }: { bookId: string }) {
  const { data, loading } = useApi<DashboardData>(`/books/${bookId}/dashboard`);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const events = data?.recentEvents ?? [];

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock size={32} className="text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">暂无时间线事件</p>
        <p className="text-xs text-muted-foreground/60 mt-1">写作时将自动记录关键事件</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock size={16} className="text-primary" />
        <span>最近 {events.length} 个事件</span>
      </div>

      {/* Timeline list */}
      <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-thin">
        {events.map((event, i) => (
          <div key={event.id} className="relative pl-6 pb-3">
            {/* Timeline line */}
            {i < events.length - 1 && (
              <div className="absolute left-[7px] top-4 bottom-0 w-px bg-border" />
            )}
            {/* Dot */}
            <div className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 border-primary bg-background flex items-center justify-center">
              <div className="w-[5px] h-[5px] rounded-full bg-primary" />
            </div>
            {/* Content */}
            <div className="text-sm">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-medium text-primary">
                  第{event.chapter}章
                </span>
                {event.date && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar size={10} />
                    {event.date}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {event.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
