import { useState } from "react";
import { fetchJson, useApi, postApi } from "../hooks/use-api";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import { Wand2, Upload, BarChart3, AlertTriangle } from "lucide-react";
import { calculateStats, runPrescreen } from "../api/utils/style-prescreen";
import type { PrescreenStats, ChapterPrescreenResult } from "../api/utils/style-prescreen";

interface StyleProfile {
  readonly sourceName: string;
  readonly avgSentenceLength: number;
  readonly sentenceLengthStdDev: number;
  readonly avgParagraphLength: number;
  readonly vocabularyDiversity: number;
  readonly topPatterns: ReadonlyArray<string>;
  readonly rhetoricalFeatures: ReadonlyArray<string>;
}

interface BookSummary {
  readonly id: string;
  readonly title: string;
}

interface Nav { toDashboard: () => void }

export interface StyleStatusNotice {
  readonly tone: "error" | "success" | "info";
  readonly message: string;
}

export function buildStyleStatusNotice(analyzeStatus: string, importStatus: string): StyleStatusNotice | null {
  const message = analyzeStatus.trim() || importStatus.trim();
  if (!message) return null;
  if (message.startsWith("Error:")) {
    return { tone: "error", message };
  }
  if (message.endsWith("...")) {
    return { tone: "info", message };
  }
  return { tone: "success", message };
}

// calculateStats and runPrescreen moved to api/utils/style-prescreen.ts (Issue #414)

export function StyleManager({ nav, theme, t }: { nav: Nav; theme: Theme; t: TFunction }) {
  const c = useColors(theme);
  const [text, setText] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState("");
  const [importBookId, setImportBookId] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const { data: booksData } = useApi<{ books: ReadonlyArray<BookSummary> }>("/books");
  const statusNotice = buildStyleStatusNotice(analyzeStatus, importStatus);

  const [prescreenResults, setPrescreenResults] = useState<ChapterPrescreenResult[] | null>(null);
  const [prescreenGlobalStats, setPrescreenGlobalStats] = useState<PrescreenStats | null>(null);
  const [showPrescreen, setShowPrescreen] = useState(false);
  const [aiDeepCheckLoading, setAiDeepCheckLoading] = useState(false);
  const [aiDeepCheckResults, setAiDeepCheckResults] = useState<Record<number, string> | null>(null);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setProfile(null);
    setAnalyzeStatus("");
    try {
      const response = await postApi<{ success: boolean; data: { profile: StyleProfile; summary: string } }>(
        `/api/extract`,
        {
          skillId: "extract-style",
          params: {
            texts: [text],
            id: sourceName || "sample",
          },
        },
      );
      setProfile(response.data.profile);
    } catch (e) {
      setAnalyzeStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    setLoading(false);
  };

  const handleImport = async () => {
    if (!importBookId || !text.trim()) return;
    setImportStatus("Importing...");
    try {
      await postApi(`/books/${importBookId}/style/import`, { text, sourceName: sourceName || "sample" });
      setImportStatus("Style guide imported successfully!");
    } catch (e) {
      setImportStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handlePrescreen = () => {
    if (!text.trim()) return;
    const { results, globalStats } = runPrescreen(text);
    setPrescreenResults(results);
    setPrescreenGlobalStats(globalStats);
    setShowPrescreen(true);
  };

  const handleAiDeepCheck = async () => {
    if (!text.trim() || !prescreenResults) return;
    setAiDeepCheckLoading(true);
    setAiDeepCheckResults(null);
    try {
      // 只对异常章节调用AI
      const anomalousChapters = prescreenResults.filter(r => r.isAnomalous);
      const results: Record<number, string> = {};

      for (const chapter of anomalousChapters) {
        let chapterText = text;
        // 如果有章节号，提取对应的章节文本
        if (chapter.chapterNumber !== null) {
          const chapterRegex = new RegExp(`---\\s*第${chapter.chapterNumber}章\\s*---([^]*?)(?=---\\s*第\\d+章\\s*---|$)`, '');
          const match = text.match(chapterRegex);
          if (match) chapterText = match[1].trim();
        }

        const response = await postApi<{ success: boolean; data: { profile: StyleProfile; summary: string } }>(
          `/api/extract`,
          {
            skillId: "extract-style",
            params: {
              texts: [chapterText],
              id: chapter.chapterNumber ? `chapter-${chapter.chapterNumber}` : "sample",
            },
          },
        );

        const anomalies = chapter.anomalyReasons.join("；");
        results[chapter.chapterNumber ?? 0] = `AI深度检测\n\n异常原因：${anomalies}\n\nAI分析：${response.data.summary}`;
      }

      setAiDeepCheckResults(results);
    } catch (err) {
      setAnalyzeStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAiDeepCheckLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={nav.toDashboard} className={c.link}>{t("bread.home")}</button>
        <span className="text-border">/</span>
        <span>{t("nav.style")}</span>
      </div>

      <h1 className="font-serif text-3xl flex items-center gap-3">
        <Wand2 size={28} className="text-primary" />
        {t("style.title")}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">{t("style.sourceName")}</label>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder={t("style.sourceExample")}
              className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">{t("style.textSample")}</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              placeholder={t("style.pasteHint")}
              className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border text-sm focus:outline-none focus:border-primary resize-none font-mono"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleAnalyze}
              disabled={!text.trim() || loading}
              className={`px-4 py-2 text-sm rounded-lg ${c.btnPrimary} disabled:opacity-30 flex items-center gap-2`}
            >
              <BarChart3 size={14} />
              {loading ? t("style.analyzing") : t("style.analyze")}
            </button>
            <button
              onClick={handlePrescreen}
              disabled={!text.trim()}
              className={`px-4 py-2 text-sm rounded-lg ${c.btnSecondary} disabled:opacity-30 flex items-center gap-2`}
            >
              <BarChart3 size={14} />
              代码初筛
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {profile && (
            <div className={`border ${c.cardStatic} rounded-lg p-5 space-y-4`}>
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">{t("style.results")}</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-secondary/30 rounded-lg p-3">
                  <div className="text-muted-foreground text-xs">{t("style.avgSentence")}</div>
                  <div className="text-xl font-bold">{profile.avgSentenceLength.toFixed(1)}</div>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3">
                  <div className="text-muted-foreground text-xs">{t("style.vocabDiversity")}</div>
                  <div className="text-xl font-bold">{(profile.vocabularyDiversity * 100).toFixed(0)}%</div>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3">
                  <div className="text-muted-foreground text-xs">{t("style.avgParagraph")}</div>
                  <div className="text-xl font-bold">{profile.avgParagraphLength.toFixed(0)}</div>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3">
                  <div className="text-muted-foreground text-xs">{t("style.sentenceStdDev")}</div>
                  <div className="text-xl font-bold">{profile.sentenceLengthStdDev.toFixed(1)}</div>
                </div>
              </div>
              {profile.topPatterns.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{t("style.topPatterns")}</div>
                  <div className="flex gap-2 flex-wrap">
                    {profile.topPatterns.map((p) => (
                      <span key={p} className="px-2 py-1 text-xs bg-secondary rounded">{p}</span>
                    ))}
                  </div>
                </div>
              )}
              {profile.rhetoricalFeatures.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{t("style.rhetoricalFeatures")}</div>
                  <div className="flex gap-2 flex-wrap">
                    {profile.rhetoricalFeatures.map((f) => (
                      <span key={f} className="px-2 py-1 text-xs bg-primary/10 text-primary rounded">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Import to book */}
              <div className="border-t border-border pt-4 mt-4 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Upload size={14} />
                  {t("style.importToBook")}
                </h4>
                <select
                  value={importBookId}
                  onChange={(e) => setImportBookId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border text-sm"
                >
                  <option value="">{t("style.selectBook")}</option>
                  {booksData?.books.map((b) => (
                    <option key={b.id} value={b.id}>{b.title}</option>
                  ))}
                </select>
                <button
                  onClick={handleImport}
                  disabled={!importBookId}
                  className={`px-4 py-2 text-sm rounded-lg ${c.btnSecondary} disabled:opacity-30`}
                >
                  {t("style.importGuide")}
                </button>
                {importStatus && <div className="text-xs text-muted-foreground">{importStatus}</div>}
              </div>
            </div>
          )}
          {!profile && !loading && (
            <div className={`border border-dashed ${c.cardStatic} rounded-lg p-8 text-center text-muted-foreground text-sm italic`}>
              {t("style.emptyHint")}
            </div>
          )}

          {showPrescreen && prescreenResults && prescreenResults.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  代码初筛结果
                </h3>
                {prescreenResults.some(r => r.isAnomalous) && (
                  <button
                    onClick={handleAiDeepCheck}
                    disabled={aiDeepCheckLoading}
                    className={`px-3 py-1.5 text-xs rounded-lg ${c.btnPrimary} disabled:opacity-30 flex items-center gap-1.5`}
                  >
                    <Wand2 size={12} />
                    {aiDeepCheckLoading ? "AI检测中..." : "AI深度检测异常章节"}
                  </button>
                )}
              </div>

              {/* 全局统计 */}
              {prescreenGlobalStats && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-secondary/30 rounded-lg p-2.5">
                    <div className="text-muted-foreground">平均句长</div>
                    <div className="text-lg font-bold text-foreground">{prescreenGlobalStats.avgSentenceLength.toFixed(1)}</div>
                    <div className="text-[10px] text-muted-foreground">标准差 {prescreenGlobalStats.sentenceLengthStdDev.toFixed(1)}</div>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-2.5">
                    <div className="text-muted-foreground">词汇丰富度</div>
                    <div className="text-lg font-bold text-foreground">{(prescreenGlobalStats.vocabularyDiversity * 100).toFixed(0)}%</div>
                    <div className="text-[10px] text-muted-foreground">{prescreenGlobalStats.totalWords} 词</div>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-2.5">
                    <div className="text-muted-foreground">平均段落长</div>
                    <div className="text-lg font-bold text-foreground">{prescreenGlobalStats.avgParagraphLength.toFixed(0)}</div>
                    <div className="text-[10px] text-muted-foreground">{prescreenGlobalStats.totalSentences} 句</div>
                  </div>
                </div>
              )}

              {/* 各章节详情 */}
              <div className="space-y-2">
                {prescreenResults.map((result, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border p-3 ${
                      result.isAnomalous
                        ? "border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/20"
                        : "border-border/40 bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-foreground">
                        {result.chapterNumber ? `第${result.chapterNumber}章` : "全文"}
                      </span>
                      {result.isAnomalous && (
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                          异常
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                      <span>句长: {result.stats.avgSentenceLength.toFixed(1)}</span>
                      <span>词汇: {(result.stats.vocabularyDiversity * 100).toFixed(0)}%</span>
                      <span>段落: {result.stats.avgParagraphLength.toFixed(0)}</span>
                    </div>
                    {result.anomalyReasons.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {result.anomalyReasons.map((reason, ri) => (
                          <p key={ri} className="text-[10px] text-amber-600 dark:text-amber-400 flex items-start gap-1">
                            <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                            {reason}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* AI 深度检测结果 */}
              {aiDeepCheckResults && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    AI 深度检测结果
                  </h4>
                  {Object.entries(aiDeepCheckResults).map(([chapterStr, result]) => (
                    <div key={chapterStr} className="rounded-lg border border-primary/30 bg-primary/[0.02] p-3">
                      <p className="text-xs font-medium text-foreground mb-1">
                        {chapterStr === "0" ? "全文" : `第${chapterStr}章`}
                      </p>
                      <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-mono">
                        {result}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {statusNotice && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${
            statusNotice.tone === "error"
              ? "bg-destructive/10 text-destructive"
              : statusNotice.tone === "info"
                ? "bg-secondary text-muted-foreground"
                : "bg-emerald-500/10 text-emerald-600"
          }`}
        >
          {statusNotice.message}
        </div>
      )}
    </div>
  );
}
