// ── Generation Constraints (Issue #92 — AI-2) ──
//
// Converts StyleProfile features into system prompt instructions
// that guide AI generation to match the reference style.

import type { StyleProfile } from "../models/style-profile.js";
import type { EnhancedStyleProfile } from "./style-learner.js";

// ── Constraint Model ──

export type ConstraintSeverity = "strict" | "suggest" | "optional";

export interface GenerationConstraint {
  /** Description of the constraint */
  readonly description: string;
  /** The actual system prompt instruction */
  readonly instruction: string;
  /** Severity */
  readonly severity: ConstraintSeverity;
  /** Source data that generated this constraint */
  readonly source: string;
}

// ── Constraint builders ──

function sentenceLengthConstraint(
  avgLen: number,
  stdDev: number,
  language: "zh" | "en",
): GenerationConstraint {
  const unit = language === "zh" ? "字" : " words";
  let instruction: string;
  if (avgLen < 10) {
    instruction = language === "zh"
      ? "使用短句写作，平均句子长度控制在 10 字以内。大量使用逗号分割短句，营造急促节奏。"
      : "Keep sentences short, averaging under 10 words per sentence. Use frequent commas to create a quick rhythm.";
  } else if (avgLen > 30) {
    instruction = language === "zh"
      ? "使用长句写作，平均句子长度在 30 字以上。多用复杂句式，营造绵长叙事感。"
      : "Use longer sentences, averaging over 30 words. Employ complex sentence structures for a flowing narrative feel.";
  } else {
    instruction = language === "zh"
      ? `维持句子长度在 ${Math.round(avgLen - stdDev)}-${Math.round(avgLen + stdDev)} 字之间。`
      : `Maintain sentence length between ${Math.round(avgLen - stdDev)}-${Math.round(avgLen + stdDev)} words.`;
  }

  return {
    description: `句子长度约束 (avg=${avgLen}${unit}, σ=${stdDev})`,
    instruction,
    severity: avgLen < 10 || avgLen > 30 ? "strict" : "suggest",
    source: `avgSentenceLength=${avgLen}, stdDev=${stdDev}`,
  };
}

function paragraphLengthConstraint(
  avgLen: number,
  range: { min: number; max: number },
  language: "zh" | "en",
): GenerationConstraint {
  const unit = language === "zh" ? "字" : " words";
  let instruction: string;
  if (avgLen < 50) {
    instruction = language === "zh"
      ? "使用短段落写作，每段控制在 50 字以内。频繁换段，分段清晰。"
      : "Use short paragraphs, keeping each under 50 words. Break frequently for clear sections.";
  } else if (avgLen > 200) {
    instruction = language === "zh"
      ? "使用长段落写作，每段常在 200 字以上。段落内密集叙事，少换段。"
      : "Use long paragraphs, often over 200 words. Dense narrative within paragraphs, few breaks.";
  } else {
    instruction = language === "zh"
      ? `段落长度维持在 ${Math.round(range.min)}-${Math.round(range.max)} ${unit} 之间。`
      : `Maintain paragraph length between ${Math.round(range.min)}-${Math.round(range.max)} ${unit}.`;
  }

  return {
    description: `段落长度约束 (avg=${avgLen}${unit})`,
    instruction,
    severity: avgLen < 50 || avgLen > 200 ? "suggest" : "optional",
    source: `avgParagraphLength=${avgLen}`,
  };
}

function vocabularyConstraint(
  diversity: number,
  language: "zh" | "en",
): GenerationConstraint {
  let instruction: string;
  if (diversity > 0.6) {
    instruction = language === "zh"
      ? "词汇丰富，避免重复使用同一个词。注意用词多样性，同样含义使用不同表达。"
      : "Use rich vocabulary. Avoid repeating the same word. Vary expressions for the same meaning.";
  } else if (diversity < 0.3) {
    instruction = language === "zh"
      ? "用词相对集中，维持一定的词汇重复度，保持统一的语言风格。"
      : "Use relatively focused vocabulary. Maintain some word repetition for stylistic consistency.";
  } else {
    instruction = language === "zh"
      ? "保持适度的词汇多样性。"
      : "Maintain moderate vocabulary diversity.";
  }

  return {
    description: `词汇多样性约束 (TTR=${diversity})`,
    instruction,
    severity: diversity > 0.6 ? "suggest" : "optional",
    source: `vocabularyDiversity=${diversity}`,
  };
}

function topPatternsConstraint(
  patterns: readonly string[],
  language: "zh" | "en",
): GenerationConstraint | null {
  if (patterns.length === 0) return null;

  const instruction = language === "zh"
    ? `参考以下句子开头模式（频率从高到低）：${patterns.slice(0, 3).join("、")}`
    : `Reference these sentence opening patterns (highest frequency first): ${patterns.slice(0, 3).join(", ")}`;

  return {
    description: `句子开头模式：${patterns.slice(0, 3).join(", ")}`,
    instruction,
    severity: "optional",
    source: `topPatterns=${patterns.join("|")}`,
  };
}

function rhetoricalConstraint(
  features: readonly string[],
  language: "zh" | "en",
): GenerationConstraint | null {
  if (features.length === 0) return null;

  const instruction = language === "zh"
    ? `在适当位置运用以下修辞手法：${features.slice(0, 3).join("、")}`
    : `Use these rhetorical devices where appropriate: ${features.slice(0, 3).join(", ")}`;

  return {
    description: `修辞手法参考：${features.slice(0, 3).join(", ")}`,
    instruction,
    severity: "optional",
    source: `rhetoricalFeatures=${features.join("|")}`,
  };
}

function dialogueConstraint(
  dialogueRatio: number,
  language: "zh" | "en",
): GenerationConstraint {
  let instruction: string;
  if (dialogueRatio > 0.4) {
    instruction = language === "zh"
      ? "大量使用对话推动叙事。对话占比 40% 以上，多用直接引语表达角色互动。"
      : "Use extensive dialogue to drive the narrative. Dialogue should be over 40% of content. Use direct speech for character interaction.";
  } else if (dialogueRatio < 0.15) {
    instruction = language === "zh"
      ? "以叙事为主，对话占比控制在 15% 以下。侧重描述和内心独白。"
      : "Focus on narration. Keep dialogue under 15% of content. Emphasize description and internal monologue.";
  } else {
    instruction = language === "zh"
      ? `对话占比保持在 ${Math.round(dialogueRatio * 100)}% 左右，叙事与对话均衡。`
      : `Maintain dialogue around ${Math.round(dialogueRatio * 100)}%. Balance between narration and dialogue.`;
  }

  return {
    description: `对话比例约束 (${Math.round(dialogueRatio * 100)}%)`,
    instruction,
    severity: dialogueRatio > 0.4 || dialogueRatio < 0.15 ? "suggest" : "optional",
    source: `dialogueRatio=${dialogueRatio}`,
  };
}

function sentimentConstraint(
  sentimentScore: number,
  language: "zh" | "en",
): GenerationConstraint {
  let instruction: string;
  if (sentimentScore > 0.2) {
    instruction = language === "zh"
      ? "整体情感偏向积极、温暖。多使用正面词汇和明亮意象。"
      : "Overall tone should be positive and warm. Use positive vocabulary and bright imagery.";
  } else if (sentimentScore < -0.2) {
    instruction = language === "zh"
      ? "整体情感偏向阴暗、沉重。多使用负面词汇和阴郁意象。"
      : "Overall tone should be dark and heavy. Use negative vocabulary and somber imagery.";
  } else {
    instruction = language === "zh"
      ? "保持情感中性，不带明显的情感偏向。"
      : "Maintain a neutral emotional tone without clear bias.";
  }

  return {
    description: `情感基调 (score=${sentimentScore})`,
    instruction,
    severity: Math.abs(sentimentScore) > 0.5 ? "strict" : "suggest",
    source: `sentimentScore=${sentimentScore}`,
  };
}

export function profileToConstraints(
  profile: Partial<EnhancedStyleProfile>,
): GenerationConstraint[] {
  const language = profile.language ?? "zh";
  const constraints: GenerationConstraint[] = [];

  if (profile.avgSentenceLength !== undefined) {
    constraints.push(sentenceLengthConstraint(
      profile.avgSentenceLength,
      profile.sentenceLengthStdDev ?? 5,
      language,
    ));
  }

  if (profile.avgParagraphLength !== undefined) {
    constraints.push(paragraphLengthConstraint(
      profile.avgParagraphLength,
      profile.paragraphLengthRange ?? { min: 1, max: 500 },
      language,
    ));
  }

  if (profile.vocabularyDiversity !== undefined) {
    constraints.push(vocabularyConstraint(profile.vocabularyDiversity, language));
  }

  if (profile.topPatterns && profile.topPatterns.length > 0) {
    const c = topPatternsConstraint(profile.topPatterns, language);
    if (c) constraints.push(c);
  }

  if (profile.rhetoricalFeatures && profile.rhetoricalFeatures.length > 0) {
    const c = rhetoricalConstraint(profile.rhetoricalFeatures, language);
    if (c) constraints.push(c);
  }

  if (profile.dialogue?.dialogueRatio !== undefined) {
    constraints.push(dialogueConstraint(profile.dialogue.dialogueRatio, language));
  }

  if (profile.tone?.sentimentScore !== undefined) {
    constraints.push(sentimentConstraint(profile.tone.sentimentScore, language));
  }

  return constraints;
}

/**
 * Build a full system prompt section from style constraints.
 */
export function formatStyleConstraintsSection(
  constraints: GenerationConstraint[],
  language: "zh" | "en" = "zh",
): string {
  if (constraints.length === 0) return "";

  const strict = constraints.filter((c) => c.severity === "strict");
  const suggest = constraints.filter((c) => c.severity === "suggest");

  const lines: string[] = [];

  if (language === "zh") {
    if (strict.length > 0) {
      lines.push("【风格约束 — 必须遵守】");
      strict.forEach((c) => lines.push(`- ${c.instruction}`));
    }
    if (suggest.length > 0) {
      lines.push("【风格建议 — 尽量遵循】");
      suggest.forEach((c) => lines.push(`- ${c.instruction}`));
    }
    lines.push("");
  } else {
    if (strict.length > 0) {
      lines.push("[Style Constraints — Mandatory]");
      strict.forEach((c) => lines.push(`- ${c.instruction}`));
    }
    if (suggest.length > 0) {
      lines.push("[Style Suggestions — Recommended]");
      suggest.forEach((c) => lines.push(`- ${c.instruction}`));
    }
    lines.push("");
  }

  return lines.join("\n");
}
