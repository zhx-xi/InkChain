import { useApi } from "../../hooks/use-api";
import { BookOpen, FileText, Target } from "lucide-react";

interface BookData {
  readonly book?: { readonly title?: string; readonly targetChapters?: number; readonly genre?: string; readonly status?: string };
  readonly nextChapter?: number;
  readonly chapters?: ReadonlyArray<{ readonly wordCount?: number; readonly number?: number; readonly status?: string }>;
}

interface DashboardData {
  readonly stats?: {
    readonly totalChapters: number;
    readonly targetChapters: number;
    readonly totalWords: number;
    readonly chaptersWritten: number;
  };
  readonly book?: { readonly title?: string; readonly genre?: string; readonly status?: string };
}

export function ProgressWidget({ bookId }: { bookId: string }) {
  const { data: dashData, loading: dashLoading } = useApi<DashboardData>(`/books/${bookId}/dashboard`);
  const { data: bookData, loading: bookLoading } = useApi<BookData>(`/books/${bookId}`);

  const loading = dashLoading && bookLoading;
  const stats = dashData?.stats;
  const targetChapters = stats?.targetChapters ?? (bookData?.book as any)?.targetChapters ?? 0;
  const chaptersWritten = stats?.chaptersWritten ?? (bookData?.nextChapter ?? 1) - 1;
  const totalWords = stats?.totalWords ?? 0;

  const progress = targetChapters > 0 ? Math.min(chaptersWritten / targetChapters, 1) : 0;
  const progressPercent = Math.round(progress * 100);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Circular progress */}
      <div className="flex items-center justify-center">
        <div className="relative w-28 h-28">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              stroke="hsl(var(--secondary))"
              strokeWidth="10"
            />
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 52}`}
              strokeDashoffset={`${2 * Math.PI * 52 * (1 - progress)}`}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <span className="text-2xl font-bold">{progressPercent}</span>
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-secondary/30 rounded-xl p-3 text-center">
          <FileText size={16} className="mx-auto mb-1 text-primary" />
          <div className="text-lg font-semibold">{chaptersWritten}</div>
          <div className="text-[11px] text-muted-foreground">已写章节</div>
        </div>
        <div className="bg-secondary/30 rounded-xl p-3 text-center">
          <Target size={16} className="mx-auto mb-1 text-primary" />
          <div className="text-lg font-semibold">{targetChapters}</div>
          <div className="text-[11px] text-muted-foreground">目标章节</div>
        </div>
        <div className="bg-secondary/30 rounded-xl p-3 text-center">
          <BookOpen size={16} className="mx-auto mb-1 text-primary" />
          <div className="text-lg font-semibold">{totalWords.toLocaleString()}</div>
          <div className="text-[11px] text-muted-foreground">总字数</div>
        </div>
      </div>
    </div>
  );
}
