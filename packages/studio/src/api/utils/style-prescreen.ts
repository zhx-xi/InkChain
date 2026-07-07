// ── 文风代码初筛（Prescreen）引擎 — Issue #414 ──
// Extracted from StyleManager.tsx for API/UI separation.
// @todo AI integration: replace mock with real AI-powered style analysis

export interface PrescreenStats {
  avgSentenceLength: number;
  sentenceLengthStdDev: number;
  vocabularyDiversity: number;
  /** N-gram based vocabulary diversity (more accurate for Chinese text) */
  vocabNgramDiversity: number;
  punctuationFrequency: Record<string, number>;
  avgParagraphLength: number;
  totalSentences: number;
  totalWords: number;
}

export interface ChapterPrescreenResult {
  chapterNumber: number | null;
  stats: PrescreenStats;
  isAnomalous: boolean;
  anomalyReasons: string[];
}

/** Default Z-score threshold for anomaly detection */
export const DEFAULT_ANOMALY_Z_THRESHOLD = 2;

/**
 * Calculate text statistics including n-gram based vocabulary diversity.
 * Uses character-level n-grams for more accurate Chinese text analysis.
 */
export function calculateStats(text: string): PrescreenStats {
  const sentences = text.split(/[。！？.!?]+/).filter((s) => s.trim().length > 0);
  // Split by whitespace, commas, semicolons, colons, and Chinese punctuation
  const words = text.split(/[\s,，、。；;：:]+/).filter((w) => w.trim().length > 0);
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  // ── Sentence length ──
  const sentenceLengths = sentences.map((s) => [...s].length);
  const avgSentenceLength =
    sentenceLengths.reduce((a, b) => a + b, 0) / (sentenceLengths.length || 1);
  const variance =
    sentenceLengths.reduce((a, b) => a + (b - avgSentenceLength) ** 2, 0) /
    (sentenceLengths.length || 1);
  const sentenceLengthStdDev = Math.sqrt(variance);

  // ── Vocabulary diversity (word-level) ──
  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  const vocabularyDiversity = uniqueWords.size / (words.length || 1);

  // ── Character-level bigram diversity (better for Chinese text) ──
  const chars = [...text.replace(/\s+/g, "")];
  const bigrams = new Set<string>();
  for (let i = 0; i < chars.length - 1; i++) {
    bigrams.add(chars[i] + chars[i + 1]);
  }
  const vocabNgramDiversity = chars.length > 1 ? bigrams.size / (chars.length - 1) : 0;

  // ── Punctuation frequency ──
  const allChars = [...text];
  const punctuationFrequency: Record<string, number> = {};
  for (const ch of allChars) {
    if (/[，。！？、；：""''（）《》【】…—·,.;:!?'"()\[\]{}]/.test(ch)) {
      punctuationFrequency[ch] = (punctuationFrequency[ch] || 0) + 1;
    }
  }

  // ── Paragraph length ──
  const avgParagraphLength =
    paragraphs.reduce((a, p) => a + [...p].length, 0) / (paragraphs.length || 1);

  return {
    avgSentenceLength,
    sentenceLengthStdDev,
    vocabularyDiversity,
    vocabNgramDiversity,
    punctuationFrequency,
    avgParagraphLength,
    totalSentences: sentences.length,
    totalWords: words.length,
  };
}

/**
 * Run prescreen analysis on text split by chapter markers.
 * @param text Full text with "---第N章---" chapter markers
 * @param anomalyZThreshold Z-score threshold for anomaly detection (default: 2)
 */
export function runPrescreen(
  text: string,
  anomalyZThreshold: number = DEFAULT_ANOMALY_Z_THRESHOLD,
): { results: ChapterPrescreenResult[]; globalStats: PrescreenStats } {
  // Split text by chapter markers
  const chapterRegex = /---\s*第(\d+)章\s*---/g;
  const sections: Array<{ num: number | null; text: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let lastNum: number | null = null;

  while ((match = chapterRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      sections.push({ num: lastNum, text: text.slice(lastIndex, match.index).trim() });
    }
    lastNum = Number(match[1]);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    sections.push({ num: lastNum, text: text.slice(lastIndex).trim() });
  }
  if (sections.length === 0 && text.trim()) {
    sections.push({ num: null, text: text.trim() });
  }

  // Calculate stats per chapter
  const results: ChapterPrescreenResult[] = [];
  const allStats: PrescreenStats[] = [];

  for (const section of sections) {
    if (!section.text) continue;
    const stats = calculateStats(section.text);
    allStats.push(stats);
    results.push({
      chapterNumber: section.num,
      stats,
      isAnomalous: false,
      anomalyReasons: [],
    });
  }

  // Global stats (all chapters combined)
  const globalText = sections.map((s) => s.text).join("\n");
  const globalStats = calculateStats(globalText);

  // Mark anomalous chapters using Z-score with configurable threshold
  if (results.length > 1) {
    // Sentence length anomaly
    const avgSentenceLengths = results.map((r) => r.stats.avgSentenceLength);
    const mean = avgSentenceLengths.reduce((a, b) => a + b, 0) / avgSentenceLengths.length;
    const sVariance =
      avgSentenceLengths.reduce((a, b) => a + (b - mean) ** 2, 0) / avgSentenceLengths.length;
    const sStdDev = Math.sqrt(sVariance);

    // Vocabulary diversity anomaly (using n-gram based metric)
    const ngramScores = results.map((r) => r.stats.vocabNgramDiversity);
    const nMean = ngramScores.reduce((a, b) => a + b, 0) / ngramScores.length;
    const nVariance =
      ngramScores.reduce((a, b) => a + (b - nMean) ** 2, 0) / ngramScores.length;
    const nStdDev = Math.sqrt(nVariance);

    for (const result of results) {
      // Sentence length Z-score
      const sZScore = Math.abs(result.stats.avgSentenceLength - mean) / (sStdDev || 1);
      if (sZScore > anomalyZThreshold) {
        result.isAnomalous = true;
        result.anomalyReasons.push(
          `句子长度异常（${result.stats.avgSentenceLength.toFixed(1)} 字/句，均值 ${mean.toFixed(1)}）`,
        );
      }

      // N-gram diversity Z-score (more accurate for Chinese)
      const nZScore = Math.abs(result.stats.vocabNgramDiversity - nMean) / (nStdDev || 1);
      if (nZScore > anomalyZThreshold) {
        result.isAnomalous = true;
        result.anomalyReasons.push(
          `词汇丰富度异常（bigram=${(result.stats.vocabNgramDiversity * 100).toFixed(0)}%，均值 ${(nMean * 100).toFixed(0)}%）`,
        );
      }
    }
  }

  return { results, globalStats };
}
