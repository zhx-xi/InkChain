// ── Writing Continue (Issue #103 — P3-2) ──
//
// AI-assisted chapter continuation with full context integration:
// World, Relations, Timeline, and Foreshadowing constraints.
//
// Architecture (following world-generator pattern):
//   buildContextPrompt()  → returns system+user messages (caller sends to LLM)
//   parseContinueResponse() → parses LLM JSON output into structured candidates
//   checkConflict() → validates generated content against known constraints
//
// The caller (API route) is responsible for the actual chatCompletion call.
// This module focuses on context building and response handling.

import type { WorldConfig } from "../models/world-config.js";
import type { CharacterRelation } from "../models/relations.js";
import type { TimelineEvent } from "../models/character-timeline.js";
import type { Foreshadowing } from "../models/foreshadowing.js";
import type { CurrentStateFact } from "../models/runtime-state.js";

// ── Public Types ──

export interface ContinueWritingParams {
  /** Creativity level: 1 (conservative) to 10 (wild) */
  creativity: number;
  /** Target output length in Chinese characters */
  length: number;
  /** Style guidance (e.g. "悬疑", "热血", "细腻描写") */
  style: string;
  /** The previous chapter's content (for immediate context) */
  previousChapterContent: string;
  /** Optional user direction for the continuation */
  userDirection?: string;
}

export const DEFAULT_CONTINUE_PARAMS: ContinueWritingParams = {
  creativity: 5,
  length: 2000,
  style: "",
  previousChapterContent: "",
};

// ── Context Sources ──

export interface WorldContext {
  config: WorldConfig | null;
  /** Selected reference dimensions to use */
  referenceDimensions: string[];
}

export interface RelationContext {
  relations: CharacterRelation[];
  /** Active relations (valid for current chapter range) */
  activeRelations: CharacterRelation[];
}

export interface TimelineContext {
  events: TimelineEvent[];
  /** Events up to the current chapter */
  relevantEvents: TimelineEvent[];
}

export interface ForeshadowingContext {
  foreshadowing: Foreshadowing[];
  /** Active foreshadowing (not yet paid off or abandoned) */
  activeForeshadowing: Foreshadowing[];
}

export interface FullWritingContext {
  world: WorldContext;
  relation: RelationContext;
  timeline: TimelineContext;
  foreshadowing: ForeshadowingContext;
  /** Current chapter number */
  currentChapter: number;
  /** Chapter summary up to current point */
  chapterSummaries: string;
  /** Runtime state facts (temporal) */
  runtimeFacts: CurrentStateFact[];
}

// ── Continue Candidates ──

export interface ContinueCandidate {
  /** The continuation text */
  content: string;
  /** Brief summary of what this candidate covers */
  summary: string;
  /** Estimated word count */
  estimatedWords: number;
  /** Which narrative dimensions are addressed */
  addressedDimensions: string[];
  /** Suggested continuation direction (e.g. "expand_dialogue", "advance_plot", "deepen_character") */
  direction: string;
}

// ── Conflict Detection ──

export interface ConflictIssue {
  /** Constraint dimension violated */
  dimension: "world" | "character" | "plot" | "timeline" | "foreshadowing";
  /** Severity: error (blocking) vs warning (advisory) */
  severity: "error" | "warning";
  /** Human-readable description of the issue */
  description: string;
  /** Suggestion for resolution */
  suggestion: string;
}

// ── Context Builders ──

/**
 * Format world context into a prompt-friendly Markdown string.
 */
function formatWorldForPrompt(context: WorldContext): string {
  const { config, referenceDimensions } = context;
  if (!config) return "";

  const parts: string[] = [];

  if (config.description) {
    parts.push(`## 世界观简介\n${config.description}\n`);
  }

  const dimSet = new Set(referenceDimensions);

  for (const dim of dimSet) {
    const entities = (config as unknown as Record<string, unknown[]>)[dim];
    if (!entities || entities.length === 0) continue;

    switch (dim) {
      case "settings": {
        const items = entities as WorldConfig["settings"];
        if (!items.length) break;
        parts.push(
          `## 世界观设定\n${items.map((s) =>
            `- ${s.name}（${s.type}）: ${s.description}${s.constraints.length ? ` [约束: ${s.constraints.join("; ")}]` : ""}`
          ).join("\n")}\n`
        );
        break;
      }
      case "roles": {
        const items = entities as WorldConfig["roles"];
        if (!items.length) break;
        parts.push(
          `## 角色\n${items.map((r) =>
            `- ${r.name}（${r.role}, 重要性${r.significance}/5）: ${r.description}`
          ).join("\n")}\n`
        );
        break;
      }
      case "rules": {
        const items = entities as WorldConfig["rules"];
        if (!items.length) break;
        parts.push(
          `## 世界规则\n${items.map((r) =>
            `- ${r.name}（${r.type}）: ${r.description}${r.constraints.length ? ` [约束: ${r.constraints.join("; ")}]` : ""}`
          ).join("\n")}\n`
        );
        break;
      }
    }
  }

  return parts.join("\n");
}

/**
 * Format relation context into prompt-friendly text.
 */
function formatRelationsForPrompt(context: RelationContext): string {
  const { activeRelations } = context;
  if (!activeRelations.length) return "";

  const lines = activeRelations.map((r) =>
    `- ${r.sourceRoleId} → ${r.targetRoleId}: ${r.relationType}（${r.customLabel ?? ""}）强度${r.intensity}/5`
  );

  return `## 活跃角色关系\n${lines.join("\n")}\n`;
}

/**
 * Format timeline context into prompt-friendly text.
 */
function formatTimelineForPrompt(context: TimelineContext): string {
  const { relevantEvents } = context;
  if (!relevantEvents.length) return "";

  const lines = relevantEvents.map((e) =>
    `- [${e.timestamp}] ${e.title}: ${e.description}（重要性${e.importance}/5）`
  );

  return `## 时间线事件\n${lines.join("\n")}\n`;
}

/**
 * Format foreshadowing context into prompt-friendly text.
 */
function formatForeshadowingForPrompt(context: ForeshadowingContext): string {
  const { activeForeshadowing } = context;
  if (!activeForeshadowing.length) return "";

  const lines = activeForeshadowing.map((f) =>
    `- ${f.title}（类型: ${f.type}, 创建于第${f.createdChapter}章, 状态: ${f.status}）: ${f.description}`
  );

  return `## 活跃伏笔\n${lines.join("\n")}\n`;
}

/**
 * Format runtime state facts into prompt-friendly text.
 */
function formatRuntimeFactsForPrompt(facts: CurrentStateFact[], currentChapter: number): string {
  if (!facts.length) return "";

  const active = facts.filter(
    (f) => f.validFromChapter <= currentChapter &&
      (f.validUntilChapter === undefined || f.validUntilChapter === null || f.validUntilChapter >= currentChapter)
  );

  if (!active.length) return "";

  const lines = active.map((f) =>
    `- ${f.subject} → ${f.predicate}: ${f.object}`
  );

  return `## 运行时状态\n${lines.join("\n")}\n`;
}

// ── Prompt Builders ──

/**
 * Build the system prompt for writing continuation.
 * Injects all available context dimensions as constraints.
 */
export function buildContinueSystemPrompt(context: FullWritingContext): string {
  const parts: string[] = [
    `你是一位资深小说创作者。当前是第 ${context.currentChapter} 章，你的任务是基于已有上下文，生成高质量的续写内容。`,
    "",
    "## 约束条件",
  ];

  parts.push(formatWorldForPrompt(context.world));
  parts.push(formatRelationsForPrompt(context.relation));
  parts.push(formatTimelineForPrompt(context.timeline));
  parts.push(formatForeshadowingForPrompt(context.foreshadowing));
  parts.push(formatRuntimeFactsForPrompt(context.runtimeFacts, context.currentChapter));

  parts.push(`
## 续写要求

请严格按照以下规则：

1. **世界观一致性** — 续写内容不能违反世界设定、规则和物理约束
2. **角色一致性** — 角色行为必须符合其设定描述和性格，考虑活跃关系的影响
3. **叙事连贯性** — 续写需要与已有时间线和伏笔保持因果一致
4. **多条候选** — 从不同角度生成 2-3 个续写候选项（如不同视角、不同情节走向）

输出格式为 JSON 数组，每项包含：
- content: 续写正文内容
- summary: 续写摘要（一句话）
- estimatedWords: 预估字数
- addressedDimensions: 涉及到的叙事维度数组
- direction: 续写方向标识（expand_dialogue | advance_plot | deepen_character | world_building | tension_build）

请严格按照以下 JSON 格式返回：
\`\`\`json
[
  {
    "content": "续写正文内容",
    "summary": "摘要",
    "estimatedWords": 500,
    "addressedDimensions": ["world", "character", "plot"],
    "direction": "advance_plot"
  }
]
\`\`\`

注意：
- content 应包含完整的续写段落（不少于指定字数）
- 候选之间应有足够差异，覆盖不同的叙事维度
- 返回纯 JSON，不要 markdown 包装`);

  return parts.join("\n");
}

/**
 * Build the user prompt for writing continuation.
 */
export function buildContinueUserPrompt(
  params: ContinueWritingParams,
  context: FullWritingContext,
): string {
  const parts: string[] = [];

  parts.push(`## 前一章内容\n\n${params.previousChapterContent}\n`);

  if (context.chapterSummaries) {
    parts.push(`## 章节摘要\n${context.chapterSummaries}\n`);
  }

  const paramLines = [
    `## 续写参数`,
    `- 创意度: ${params.creativity}/10`,
    `- 目标长度: ${params.length} 字`,
  ];
  if (params.style) paramLines.push(`- 风格: ${params.style}`);
  if (params.userDirection) paramLines.push(`- 用户指示: ${params.userDirection}`);
  parts.push(paramLines.join("\n"));

  parts.push(`\n请基于以上上下文，生成 ${params.creativity >= 7 ? "3" : "2"} 个不同的续写候选。`);

  return parts.join("\n");
}

// ── JSON Extraction ──

/**
 * Extract and parse JSON from LLM response text.
 * Tries: direct parse → markdown code block → bare JSON array → wrapped object
 */
function extractJson(text: string): unknown {
  const trimmed = text.trim();

  // Try direct parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  // Try extracting from markdown code blocks
  const mdMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (mdMatch) {
    try {
      return JSON.parse(mdMatch[1].trim());
    } catch {
      // continue
    }
  }

  // Try finding JSON array
  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch {
      // continue
    }
  }

  // Try finding JSON object
  const objMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch {
      // continue
    }
  }

  return null;
}

// ── Response Parsers ──

/**
 * Parse LLM response into continue candidates.
 */
export function parseContinueResponse(text: string, raw: string): ContinueCandidate[] {
  const extracted = extractJson(text);
  if (!extracted) return [];

  if (Array.isArray(extracted)) {
    return extracted.map((item: Record<string, unknown>) => ({
      content: String(item.content ?? ""),
      summary: String(item.summary ?? ""),
      estimatedWords: Number(item.estimatedWords ?? 0),
      addressedDimensions: Array.isArray(item.addressedDimensions)
        ? item.addressedDimensions.map(String)
        : [],
      direction: String(item.direction ?? ""),
    })).filter((c) => c.content.length > 0);
  }

  // If it's a wrapped object with a candidates key
  if (typeof extracted === "object" && extracted !== null) {
    const obj = extracted as Record<string, unknown>;
    if (Array.isArray(obj.candidates)) {
      return obj.candidates.map((item: Record<string, unknown>) => ({
        content: String(item.content ?? ""),
        summary: String(item.summary ?? ""),
        estimatedWords: Number(item.estimatedWords ?? 0),
        addressedDimensions: Array.isArray(item.addressedDimensions)
          ? item.addressedDimensions.map(String)
          : [],
        direction: String(item.direction ?? ""),
      })).filter((c) => c.content.length > 0);
    }
  }

  return [];
}

// ── Conflict Detector ──

/**
 * Check generated content for potential constraint conflicts.
 * Uses pattern-based checks (no LLM cost).
 */
export function checkConflict(
  content: string,
  context: FullWritingContext,
): ConflictIssue[] {
  const issues: ConflictIssue[] = [];

  // Check runtime state facts for temporal consistency
  if (context.runtimeFacts.length > 0) {
    const activeFacts = context.runtimeFacts.filter(
      (f) => f.validFromChapter <= context.currentChapter &&
        (f.validUntilChapter === undefined || f.validUntilChapter >= context.currentChapter)
    );

    // Check if location facts contradict content
    const locationFacts = activeFacts.filter((f) => f.predicate === "currentLocation" || f.predicate === "位于");
    for (const fact of locationFacts) {
      const locationName = String(fact.object);
      const contentLower = content.toLowerCase();
      const contradictingLocations = [
        ...context.world.config?.settings?.map((s) => s.name) ?? [],
        ...context.world.config?.regions?.map((r) => r.name) ?? [],
      ].filter(
        (name) =>
          name.toLowerCase() !== locationName.toLowerCase() &&
          contentLower.includes(name.toLowerCase()) &&
          !contentLower.includes(`${locationName.toLowerCase()}`)
      );
      for (const contradictory of contradictingLocations.slice(0, 2)) {
        issues.push({
          dimension: "world",
          severity: "warning",
          description: `当前角色位于「${locationName}」，但续写中提到了「${contradictory}」作为主要场景位置。`,
          suggestion: `请确认续写内容中场景是否从「${locationName}」切换到了「${contradictory}」，如果是合理移动则忽略此警告。`,
        });
      }
    }
  }

  // Check foreshadowing consistency
  if (context.foreshadowing.activeForeshadowing.length > 0) {
    const activeHooks = context.foreshadowing.activeForeshadowing;
    for (const hook of activeHooks) {
      const hookName = hook.title;
      const contentLower = content.toLowerCase();
      if (!contentLower.includes(hookName.toLowerCase())) {
        // Only warn for high-importance hooks that should be addressed
        if (hook.type === "情节伏笔" && hook.status === "active") {
          issues.push({
            dimension: "foreshadowing",
            severity: "warning",
            description: `活跃伏笔「${hookName}」（创建于第${hook.createdChapter}章）在当前续写中未被提及。`,
            suggestion: `考虑在续写中稍微提到「${hookName}」相关的线索或发展，以维持伏笔的连贯性。如果不是当前章节应处理的伏笔则忽略。`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Filter conflict issues by severity.
 */
export function filterConflicts(issues: ConflictIssue[], minSeverity: "error" | "warning" = "warning"): ConflictIssue[] {
  if (minSeverity === "error") {
    return issues.filter((i) => i.severity === "error");
  }
  return issues;
}

/**
 * Check if there are any blocking conflicts.
 */
export function hasBlockingConflicts(issues: ConflictIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
