// ── AI Relation Labeler (Issue #99 — R-15) ──
//
// AI-powered relation type inference engine.
// Analyzes character descriptions, dialogue excerpts, and story events
// to suggest relationship types between characters, with confidence scores
// and supporting evidence text.

import type { CharacterRelation, RelationType } from "../models/relations.js";

// ── Constants ──

/** AI-suggested relation categories for labeling */
export const SUGGESTED_RELATION_TYPES = [
  "ally",
  "enemy",
  "family",
  "love",
  "mentor",
  "rival",
  "neutral",
] as const;
export type SuggestedRelationType = (typeof SUGGESTED_RELATION_TYPES)[number];

export const SUGGESTED_RELATION_LABELS: Record<SuggestedRelationType, string> = {
  ally: "盟友",
  enemy: "仇敌",
  family: "血缘",
  love: "爱恋",
  mentor: "师徒",
  rival: "对手",
  neutral: "中立",
};

/** Maps AI categories to existing CharacterRelation types for auto-confirm */
export function toExistingRelationType(suggested: SuggestedRelationType): RelationType {
  const map: Record<SuggestedRelationType, RelationType> = {
    ally: "alliance",
    enemy: "rival",
    family: "blood",
    love: "secret_crush",
    mentor: "mentor",
    rival: "rival",
    neutral: "close_friend",
  };
  return map[suggested];
}

// ── Data Types ──

export interface RelationSuggestion {
  /** Source character ID */
  sourceId: string;
  /** Target character ID */
  targetId: string;
  /** Suggested relation type */
  suggestedRelation: SuggestedRelationType;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  /** Text evidence snippets supporting the suggestion */
  evidence: string[];
}

export interface CharacterProfileForLabeling {
  id: string;
  name: string;
  description: string;
  dialogues: string[];
}

export interface RelationLabelerInput {
  characters: CharacterProfileForLabeling[];
  /** Existing relations to avoid re-suggesting */
  existingRelations?: CharacterRelation[];
}

export interface RelationLabelerResult {
  suggestions: RelationSuggestion[];
}

// ── Keyword Patterns for Rule-Based Classification ──

interface RelationPatterns {
  type: SuggestedRelationType;
  keywords: string[];
  descriptionKeywords: string[];
  dialoguePatterns: RegExp[];
}

const RELATION_PATTERNS: RelationPatterns[] = [
  {
    type: "family",
    keywords: ["父亲", "母亲", "儿子", "女儿", "兄弟", "姐妹", "兄妹", "姐弟", "父母", "孩子", "家族", "血缘"],
    descriptionKeywords: ["父亲", "母亲", "儿子", "女儿", "兄弟", "姐妹", "兄妹", "父母"],
    dialoguePatterns: [/爸爸|妈妈|爹|娘|哥|姐|弟|妹/],
  },
  {
    type: "love",
    keywords: ["爱人", "恋人", "妻子", "丈夫", "情侣", "相爱", "暗恋", "喜欢", "爱", "恋人"],
    descriptionKeywords: ["爱人", "恋人", "妻子", "丈夫", "情侣", "相爱", "暗恋", "青梅竹马"],
    dialoguePatterns: [/喜欢|爱|想念|思念|亲爱的/],
  },
  {
    type: "mentor",
    keywords: ["师父", "师傅", "徒弟", "弟子", "学生", "老师", "教导", "传授", "学艺"],
    descriptionKeywords: ["师父", "师傅", "徒弟", "学生", "教导", "传授", "学艺", "指点"],
    dialoguePatterns: [/师父|师傅|徒弟|弟子|老师/],
  },
  {
    type: "rival",
    keywords: ["对手", "竞争", "较量", "争锋", "对决", "比试"],
    descriptionKeywords: ["对手", "竞争", "较量", "争锋", "宿敌"],
    dialoguePatterns: [/较量|比拼|胜负|比试/],
  },
  {
    type: "enemy",
    keywords: ["敌人", "仇人", "仇恨", "敌对", "死对头", "恩怨", "仇敌"],
    descriptionKeywords: ["敌人", "仇人", "仇敌", "死对头", "宿怨", "仇恨"],
    dialoguePatterns: [/杀了你|报仇|仇恨|死敌|决不罢休/],
  },
  {
    type: "ally",
    keywords: ["盟友", "合作", "伙伴", "同伴", "战友", "联合", "同盟"],
    descriptionKeywords: ["盟友", "伙伴", "战友", "联合", "同盟", "合作"],
    dialoguePatterns: [/一起|联手|合作|伙伴|互相帮助/],
  },
];

// ── Core Logic ──

/**
 * Analyze character descriptions and dialogues to suggest relation types
 * between character pairs.
 */
export function suggestRelations(input: RelationLabelerInput): RelationLabelerResult {
  const { characters, existingRelations = [] } = input;
  const suggestions: RelationSuggestion[] = [];
  const existingPairs = new Set<string>();

  // Track existing pairs to avoid re-suggestion
  for (const rel of existingRelations) {
    const key = [rel.sourceRoleId, rel.targetRoleId].sort().join("::");
    existingPairs.add(key);
  }

  // Analyze each character pair
  for (let i = 0; i < characters.length; i++) {
    for (let j = i + 1; j < characters.length; j++) {
      const a = characters[i];
      const b = characters[j];
      const pairKey = [a.id, b.id].sort().join("::");

      // Skip if relation already exists
      if (existingPairs.has(pairKey)) continue;

      const suggestion = analyzePair(a, b);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }
  }

  // Sort by confidence descending
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return { suggestions };
}

/**
 * Analyze a pair of characters and return a relation suggestion if confident enough.
 */
function analyzePair(
  a: CharacterProfileForLabeling,
  b: CharacterProfileForLabeling,
): RelationSuggestion | null {
  const combinedText = `${a.description} ${b.description} ${a.dialogues.join(" ")} ${b.dialogues.join(" ")}`;
  const combinedDescriptionOnly = `${a.description} ${b.description}`;
  const combinedDialogues = `${a.dialogues.join(" ") + " " + b.dialogues.join(" ")}`;
  const textLower = combinedText.toLowerCase();
  const descLower = combinedDescriptionOnly.toLowerCase();
  const dialogueLower = combinedDialogues.toLowerCase();

  const scored: Array<{ type: SuggestedRelationType; score: number; evidence: string[] }> = [];

  for (const pattern of RELATION_PATTERNS) {
    let score = 0;
    const evidence: string[] = [];

    // Check keywords in descriptions
    for (const kw of pattern.descriptionKeywords) {
      if (descLower.includes(kw)) {
        score += 3; // strong signal from description
        evidence.push(`${kw}`);
      }
    }

    // Check keywords in general text
    for (const kw of pattern.keywords) {
      if (textLower.includes(kw) && !descLower.includes(kw)) {
        score += 1; // weaker signal from general text
      }
    }

    // Check dialogue patterns
    for (const regex of pattern.dialoguePatterns) {
      const match = dialogueLower.match(regex);
      if (match) {
        score += 2;
        evidence.push(`对话中提到"${match[0]}"`);
      }
    }

    if (score >= 3) {
      scored.push({
        type: pattern.type,
        score,
        evidence: evidence.length > 0 ? evidence : [`${a.name}与${b.name}的关系描述`],
      });
    }
  }

  if (scored.length === 0) {
    // No strong signal — suggest neutral with low confidence
    return {
      sourceId: a.id,
      targetId: b.id,
      suggestedRelation: "neutral",
      confidence: 0.15,
      evidence: ["未检测到明显关联"],
    };
  }

  // Pick the highest scored type
  const best = scored.reduce((max, s) => (s.score > max.score ? s : max));

  // Normalize score to confidence (0.3 - 0.95)
  const confidence = Math.min(0.95, Math.max(0.3, best.score / 10));

  return {
    sourceId: a.id,
    targetId: b.id,
    suggestedRelation: best.type,
    confidence,
    evidence: best.evidence,
  };
}

/**
 * Filter suggestions by minimum confidence threshold.
 */
export function filterSuggestionsByConfidence(
  suggestions: RelationSuggestion[],
  minConfidence = 0.3,
): RelationSuggestion[] {
  return suggestions.filter((s) => s.confidence >= minConfidence);
}

/**
 * Get the highest-confidence suggestion for a specific character pair.
 */
export function findSuggestionForPair(
  suggestions: RelationSuggestion[],
  sourceId: string,
  targetId: string,
): RelationSuggestion | undefined {
  const key = [sourceId, targetId].sort().join("::");
  return suggestions
    .filter((s) => [s.sourceId, s.targetId].sort().join("::") === key)
    .sort((a, b) => b.confidence - a.confidence)[0];
}
