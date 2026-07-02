// ── Style Learner Engine (Issue #92 — AI-2) ──
//
// Analyzes reference text from the user's recent chapters to extract style
// features, then generates prompt constraints to guide AI generation.

import { analyzeStyle } from "../agents/style-analyzer.js";
import type { StyleProfile } from "../models/style-profile.js";
import type { GenerationConstraint } from "./generation-constraints.js";
import { profileToConstraints } from "./generation-constraints.js";

// ── Style Sample Config ──

export interface StyleLearningConfig {
  /** Number of recent chapters to sample */
  readonly sampleSize: number;
  /** Whether to include dialogue ratio analysis */
  readonly includeDialogue: boolean;
  /** Whether to include tone/keyword analysis */
  readonly includeTone: boolean;
}

export const DEFAULT_LEARNING_CONFIG: StyleLearningConfig = {
  sampleSize: 3,
  includeDialogue: true,
  includeTone: true,
};

// ── Dialogue Analysis ──

export interface DialogueStats {
  /** Percentage of text that is dialogue */
  dialogueRatio: number;
  /** Average number of consecutive dialogue lines */
  avgDialogueRun: number;
  /** Dialogue tag usage: "said" frequency vs action beats */
  tagDensity: number;
}

/**
 * Analyze dialogue patterns in text.
 */
export function analyzeDialogue(text: string, language: "zh" | "en" = "zh"): DialogueStats {
  const isEn = language === "en";

  // Chinese dialogue: 「...」 or "..." or '...'
  const zhDialogueRegex = /「[^」]*」|"[^"]*"|'[^']*'/g;
  // English dialogue: "..." 
  const enDialogueRegex = /"[^"]*"/g;

  const regex = isEn ? enDialogueRegex : zhDialogueRegex;
  const dialogues = text.match(regex) ?? [];
  const dialogueChars = dialogues.reduce((sum, d) => sum + d.length, 0);
  const totalChars = text.replace(/\s/g, "").length;

  const dialogueRatio = totalChars > 0 ? dialogueChars / totalChars : 0;

  // Dialogue run analysis: split by paragraphs, count consecutive dialogue-only lines
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  let runCount = 0;
  let totalRuns = 0;
  let inRun = false;
  for (const p of paragraphs) {
    const hasDialogue = regex.test(p);
    if (hasDialogue) {
      if (!inRun) { inRun = true; runCount = 1; }
      else { runCount++; }
    } else {
      if (inRun) { totalRuns += runCount; runCount = 0; inRun = false; }
    }
  }
  if (inRun) totalRuns += runCount;

  // Count instances of dialogue with a tag vs without
  const tagRegex = isEn ? /"[^"]*"\s+(?:said|whispered|shouted|murmured|replied|asked|answered|cried|yelled|called|breathed|muttered|growled|snapped|hissed)/gi : /「[^」]*」[。，、：；]?[\u4e00-\u9fff]{1,4}[着了过]?/g;
  const withTag = (text.match(tagRegex) ?? []).length;
  const tagDensity = dialogues.length > 0 ? withTag / dialogues.length : 0;

  return {
    dialogueRatio: Math.round(dialogueRatio * 1000) / 1000,
    avgDialogueRun: totalRuns > 0 ? Math.round((dialogues.length / totalRuns) * 10) / 10 : 0,
    tagDensity: Math.round(tagDensity * 100) / 100,
  };
}

// ── Tone Analysis ──

export interface ToneKeyword {
  keyword: string;
  frequency: number;
}

export interface ToneProfile {
  /** Dominant tone descriptions */
  dominantTone: string[];
  /** High-frequency adjectives/adverbs */
  keywords: ToneKeyword[];
  /** Overall sentiment polarity (-1 to 1) */
  sentimentScore: number;
}

// Basic sentiment word lists for Chinese
const ZH_POSITIVE_WORDS = new Set([
  "美好", "温暖", "温柔", "温柔", "善良", "勇敢", "坚强", "希望",
  "光明", "灿烂", "幸福", "快乐", "感动", "激动", "开心", "美丽",
  "明亮", "明媚", "欢快", "愉悦", "喜悦", "欣喜", "高兴", "灿烂",
]);

const ZH_NEGATIVE_WORDS = new Set([
  "黑暗", "绝望", "痛苦", "悲伤", "哀伤", "忧郁", "恐惧", "愤怒",
  "怨恨", "冷漠", "孤独", "寂寞", "凄凉", "阴森", "恐怖", "残酷",
  "悲惨", "可怜", "可悲", "悲哀", "难过", "伤心", "心碎", "撕裂",
]);

/**
 * Analyze tone from text.
 */
export function analyzeTone(text: string, language: "zh" | "en" = "zh"): ToneProfile {
  const isEn = language === "en";

  const dominantTone: string[] = [];
  const keywords: ToneKeyword[] = [];
  const wordFreq = new Map<string, number>();
  let sentimentScore = 0;

  if (isEn) {
    // English tone analysis — use word frequency
    const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
    // Filter out common stop words
    const stopWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
      "of", "with", "by", "from", "is", "was", "were", "be", "been", "being", "have", "has", "had",
      "do", "does", "did", "will", "would", "can", "could", "shall", "should", "may", "might",
      "it", "its", "this", "that", "these", "those", "i", "he", "she", "they", "we", "you", "me",
      "him", "her", "them", "us", "my", "your", "his", "their", "our", "not", "no", "nor",
    ]);
    for (const w of words) {
      if (!stopWords.has(w) && w.length > 3) {
        wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
      }
    }

    // Top 10 keywords
    const sorted = [...wordFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [word, count] of sorted) {
      keywords.push({ keyword: word, frequency: count });
    }
  } else {
    // Chinese tone analysis
    for (let i = 0; i < text.length - 1; i++) {
      const bigram = text.slice(i, i + 2);
      if (ZH_POSITIVE_WORDS.has(bigram)) sentimentScore += 0.1;
      if (ZH_NEGATIVE_WORDS.has(bigram)) sentimentScore -= 0.1;
    }

    // Extract adjectives/descriptive patterns (words following 很/非常/太/这么/多么/如此)
    const descPattern = /[很非太这多如]{1,3}([\u4e00-\u9fff]{2,4})/g;
    let m: RegExpExecArray | null;
    while ((m = descPattern.exec(text)) !== null) {
      const word = m[1];
      wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
    }

    const sorted = [...wordFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [word, count] of sorted) {
      keywords.push({ keyword: word, frequency: count });
    }
  }

  // Determine dominant tones
  if (sentimentScore > 0.3) dominantTone.push("positive");
  else if (sentimentScore < -0.3) dominantTone.push("negative");
  else dominantTone.push("neutral");

  if (keywords.some((k) => k.frequency > 5)) dominantTone.push("descriptive");

  return {
    dominantTone,
    keywords,
    sentimentScore: Math.round(Math.max(-1, Math.min(1, sentimentScore)) * 100) / 100,
  };
}

// ── Enhanced StyleProfile ──

export interface EnhancedStyleProfile extends StyleProfile {
  /** Dialogue statistics */
  dialogue?: DialogueStats;
  /** Tone profile */
  tone?: ToneProfile;
  /** Whether this was auto-analyzed */
  autoAnalyzed: boolean;
  /** Language */
  language: "zh" | "en";
}

/**
 * Full style learning pipeline: text → EnhancedStyleProfile → GenerationConstraint[]
 */
export function learnStyle(
  texts: string[],
  language: "zh" | "en" = "zh",
  config: StyleLearningConfig = DEFAULT_LEARNING_CONFIG,
): EnhancedStyleProfile {
  const combined = texts.join("\n\n");

  const baseProfile = analyzeStyle(combined, `chapters_${texts.length}`, language);

  let dialogue: DialogueStats | undefined;
  let tone: ToneProfile | undefined;

  if (config.includeDialogue) {
    dialogue = analyzeDialogue(combined, language);
  }

  if (config.includeTone) {
    tone = analyzeTone(combined, language);
  }

  return {
    ...baseProfile,
    dialogue,
    tone,
    autoAnalyzed: true,
    language,
  };
}

/**
 * Build system prompt constraints from an EnhancedStyleProfile.
 */
export function buildStyleConstraints(profile: EnhancedStyleProfile): GenerationConstraint[] {
  return profileToConstraints(profile);
}

/**
 * Serialize an EnhancedStyleProfile to a JSON-serializable object.
 */
export function serializeStyleProfile(profile: EnhancedStyleProfile): Record<string, unknown> {
  return {
    ...profile,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Generate a human-readable summary of the style profile.
 */
export function summarizeStyleProfile(profile: EnhancedStyleProfile): string {
  const lines: string[] = [];
  lines.push(`📏 平均句子长度: ${profile.avgSentenceLength} 字`);
  lines.push(`📊 句子长度标准差: ${profile.sentenceLengthStdDev}`);
  lines.push(`📐 平均段落长度: ${profile.avgParagraphLength} 字`);
  lines.push(`🎨 词汇多样性(TTR): ${profile.vocabularyDiversity}`);

  if (profile.dialogue) {
    lines.push(`💬 对话比例: ${(profile.dialogue.dialogueRatio * 100).toFixed(1)}%`);
    lines.push(`🔄 平均对话轮次: ${profile.dialogue.avgDialogueRun}`);
  }

  if (profile.tone) {
    lines.push(`🎭 情感倾向: ${profile.tone.sentimentScore.toFixed(2)}`);
    if (profile.tone.keywords.length > 0) {
      lines.push(`🔑 高频词: ${profile.tone.keywords.slice(0, 5).map((k) => k.keyword).join(", ")}`);
    }
  }

  return lines.join("\n");
}
