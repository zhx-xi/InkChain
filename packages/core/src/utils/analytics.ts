/** Per-chapter word count snapshot for trend charting. */
export interface ChapterWordTrend {
  readonly chapter: number;
  readonly wordCount: number;
  readonly status: string;
}

/** Per-chapter writing speed record. */
export interface WritingSpeedRecord {
  readonly chapter: number;
  readonly durationMinutes: number;
  readonly wordCount: number;
  readonly wpm: number;
}

/** Extended stats for the writing stats dashboard. */
export interface WritingStats {
  readonly bookId: string;
  readonly totalChapters: number;
  readonly totalWords: number;
  readonly avgWordsPerChapter: number;
  readonly wordTrend: ReadonlyArray<ChapterWordTrend>;
  readonly statusDistribution: Record<string, number>;
  readonly topCharacters: ReadonlyArray<{ readonly role: string; readonly count: number }>;
  readonly writingSpeed?: ReadonlyArray<WritingSpeedRecord>;
  readonly avgWpm?: number;
}

/** Compute word count trend and writing stats. */
export function computeWritingStats(
  bookId: string,
  chapters: ReadonlyArray<{
    readonly number: number;
    readonly status: string;
    readonly wordCount: number;
    readonly durationMinutes?: number;
  }>,
  sessionLogs?: ReadonlyArray<{
    readonly durationMinutes?: number;
    readonly wordCount?: number;
  }>,
): WritingStats {
  const totalChapters = chapters.length;
  const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
  const avgWordsPerChapter = totalChapters > 0 ? Math.round(totalWords / totalChapters) : 0;

  const wordTrend: ChapterWordTrend[] = [...chapters]
    .sort((a, b) => a.number - b.number)
    .map((ch) => ({ chapter: ch.number, wordCount: ch.wordCount, status: ch.status }));

  const statusDistribution: Record<string, number> = {};
  for (const ch of chapters) {
    statusDistribution[ch.status] = (statusDistribution[ch.status] ?? 0) + 1;
  }

  // Compute top characters from chapter title patterns (simplified)
  const topCharacters: Array<{ role: string; count: number }> = [];

  // Writing speed from session logs
  if (sessionLogs && sessionLogs.length > 0) {
    const totalDuration = sessionLogs.reduce((s, l) => s + (l.durationMinutes ?? 0), 0);
    const totalSessionWords = sessionLogs.reduce((s, l) => s + (l.wordCount ?? 0), 0);
    const avgWpm = totalDuration > 0 ? Math.round(totalSessionWords / totalDuration) : 0;
    const writingSpeed: WritingSpeedRecord[] = [];
    return { bookId, totalChapters, totalWords, avgWordsPerChapter, wordTrend, statusDistribution, topCharacters, writingSpeed, avgWpm };
  }

  return { bookId, totalChapters, totalWords, avgWordsPerChapter, wordTrend, statusDistribution, topCharacters };
}

export interface TokenStats {
  readonly totalPromptTokens: number;
  readonly totalCompletionTokens: number;
  readonly totalTokens: number;
  readonly avgTokensPerChapter: number;
  readonly recentTrend: ReadonlyArray<{ readonly chapter: number; readonly totalTokens: number }>;
}

export interface AnalyticsData {
  readonly bookId: string;
  readonly totalChapters: number;
  readonly totalWords: number;
  readonly avgWordsPerChapter: number;
  readonly auditPassRate: number;
  readonly topIssueCategories: ReadonlyArray<{ readonly category: string; readonly count: number }>;
  readonly chaptersWithMostIssues: ReadonlyArray<{ readonly chapter: number; readonly issueCount: number }>;
  readonly statusDistribution: Record<string, number>;
  readonly tokenStats?: TokenStats;
}

export function computeAnalytics(
  bookId: string,
  chapters: ReadonlyArray<{
    readonly number: number;
    readonly status: string;
    readonly wordCount: number;
    readonly auditIssues: ReadonlyArray<string>;
    readonly tokenUsage?: {
      readonly promptTokens: number;
      readonly completionTokens: number;
      readonly totalTokens: number;
    };
  }>,
): AnalyticsData {
  const totalChapters = chapters.length;
  const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
  const avgWordsPerChapter = totalChapters > 0 ? Math.round(totalWords / totalChapters) : 0;

  const passedStatuses = new Set(["ready-for-review", "approved", "published"]);
  const auditedChapters = chapters.filter(
    (ch) => ch.status !== "drafted" && ch.status !== "drafting" && ch.status !== "card-generated",
  );
  const passedChapters = auditedChapters.filter((ch) => passedStatuses.has(ch.status));
  const auditPassRate = auditedChapters.length > 0
    ? Math.round((passedChapters.length / auditedChapters.length) * 100)
    : 100;

  const categoryCounts = new Map<string, number>();
  for (const ch of chapters) {
    for (const issue of ch.auditIssues) {
      const catMatch = issue.match(/\[(?:critical|warning|info)\]\s*(.+?)[:：]/);
      const category = catMatch?.[1] ?? "未分类";
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }
  const topIssueCategories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([category, count]) => ({ category, count }));

  const chaptersWithMostIssues = [...chapters]
    .filter((ch) => ch.auditIssues.length > 0)
    .sort((a, b) => b.auditIssues.length - a.auditIssues.length)
    .slice(0, 5)
    .map((ch) => ({ chapter: ch.number, issueCount: ch.auditIssues.length }));

  const statusDistribution: Record<string, number> = {};
  for (const ch of chapters) {
    statusDistribution[ch.status] = (statusDistribution[ch.status] ?? 0) + 1;
  }

  const chaptersWithUsage = chapters.filter((ch) => ch.tokenUsage);
  let tokenStats: TokenStats | undefined;
  if (chaptersWithUsage.length > 0) {
    const totalPromptTokens = chaptersWithUsage.reduce((sum, ch) => sum + (ch.tokenUsage?.promptTokens ?? 0), 0);
    const totalCompletionTokens = chaptersWithUsage.reduce((sum, ch) => sum + (ch.tokenUsage?.completionTokens ?? 0), 0);
    const totalTokens = chaptersWithUsage.reduce((sum, ch) => sum + (ch.tokenUsage?.totalTokens ?? 0), 0);
    const avgTokensPerChapter = Math.round(totalTokens / chaptersWithUsage.length);

    const recentTrend = [...chaptersWithUsage]
      .sort((a, b) => a.number - b.number)
      .slice(-5)
      .map((ch) => ({ chapter: ch.number, totalTokens: ch.tokenUsage?.totalTokens ?? 0 }));

    tokenStats = { totalPromptTokens, totalCompletionTokens, totalTokens, avgTokensPerChapter, recentTrend };
  }

  return {
    bookId, totalChapters, totalWords, avgWordsPerChapter, auditPassRate,
    topIssueCategories, chaptersWithMostIssues, statusDistribution, tokenStats,
  };
}
