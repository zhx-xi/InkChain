// ── World Generator (Issue #102 — P3-1) ──
//
// AI-assisted generation of world-building content: chapters, characters,
// and events based on an existing WorldConfig. Uses LLM prompt templates
// to produce structured output that can be reviewed and confirmed by the user.
//
// Architecture:
//   buildGeneratePrompt()  → returns system+user messages (caller sends to LLM)
//   parseGenerateResponse() → parses LLM JSON output into structured candidates
//
// The caller (API route) is responsible for the actual chatCompletion call.
// This module focuses on prompt construction and response parsing.

import type { WorldConfig, WorldRole, WorldHistoryEvent } from "../models/world-config.js";
export type { WorldConfig };

// ── Public Types ──

export type GenerateType = "chapter" | "character" | "event";

export interface GenerationParams {
  /** Creativity level: 1 (conservative) to 10 (wild) */
  creativity: number;
  /** Target output length in Chinese characters */
  length: number;
  /** Style guidance (e.g. "悬疑", "热血", "细腻描写") */
  style: string;
  /** Selected reference dimensions to use as context */
  referenceDimensions: string[];
}

export const DEFAULT_GENERATION_PARAMS: GenerationParams = {
  creativity: 5,
  length: 2000,
  style: "",
  referenceDimensions: ["settings", "roles", "relations", "regions", "institutions", "history", "rules"],
};

// ── Generated Candidates ──

export interface ChapterCandidate {
  title: string;
  content: string;
  /** Suggested chapter number (0 = new / standalone) */
  suggestedChapterNumber: number;
}

export interface CharacterCandidate {
  name: string;
  role: "主角" | "配角" | "反派" | "中立";
  description: string;
  significance: number;
  traits: string[];
}

export interface EventCandidate {
  title: string;
  timestamp: string;
  description: string;
  significance: number;
  affectedRegions: string[];
}

export interface GenerateCandidates<T> {
  candidates: T[];
  /** Raw AI response text (for debugging) */
  raw: string;
}

// ── Prompt builders ──

function formatWorldContext(world: WorldConfig, dimensions: string[]): string {
  const parts: string[] = [];

  if (world.description) {
    parts.push(`## 世界观简介\n${world.description}\n`);
  }

  for (const dim of dimensions) {
    const entities = (world as unknown as Record<string, unknown[]>)[dim];
    if (!entities || entities.length === 0) continue;

    switch (dim) {
      case "settings": {
        const items = entities as WorldConfig["settings"];
        parts.push(`## 世界观设定\n${items.map((s) => `- ${s.name}（${s.type}）: ${s.description}${s.constraints.length ? ` [约束: ${s.constraints.join("; ")}]` : ""}`).join("\n")}\n`);
        break;
      }
      case "roles": {
        const items = entities as WorldConfig["roles"];
        parts.push(`## 角色\n${items.map((r) => `- ${r.name}（${r.role}, 重要性${r.significance}/5）: ${r.description}`).join("\n")}\n`);
        break;
      }
      case "relations": {
        const items = entities as WorldConfig["relations"];
        parts.push(`## 关系\n${items.map((r) => `- ${r.sourceId} → ${r.targetId}: ${r.type}（${r.description}）`).join("\n")}\n`);
        break;
      }
      case "regions": {
        const items = entities as WorldConfig["regions"];
        parts.push(`## 地理区域\n${items.map((r) => `- ${r.name}（${r.type}）: ${r.description}`).join("\n")}\n`);
        break;
      }
      case "institutions": {
        const items = entities as WorldConfig["institutions"];
        parts.push(`## 组织势力\n${items.map((i) => `- ${i.name}（${i.type}）: ${i.description}${i.leaderId ? ` [领袖: ${i.leaderId}]` : ""}`).join("\n")}\n`);
        break;
      }
      case "history": {
        const items = entities as WorldConfig["history"];
        parts.push(`## 历史事件\n${items.map((h) => `- [${h.timestamp}] ${h.title}: ${h.description}（重要性${h.significance}/5）`).join("\n")}\n`);
        break;
      }
      case "rules": {
        const items = entities as WorldConfig["rules"];
        parts.push(`## 世界规则\n${items.map((r) => `- ${r.name}（${r.type}）: ${r.description}${r.constraints.length ? ` [约束: ${r.constraints.join("; ")}]` : ""}`).join("\n")}\n`);
        break;
      }
    }
  }

  return parts.join("\n");
}

function buildParamsSection(params: GenerationParams): string {
  const lines: string[] = ["## 生成参数", `- 创意度: ${params.creativity}/10`];
  if (params.length) lines.push(`- 目标长度: ${params.length} 字`);
  if (params.style) lines.push(`- 风格: ${params.style}`);
  lines.push(`- 参考维度: ${params.referenceDimensions.join(", ")}`);
  return lines.join("\n");
}

/**
 * Build system and user prompt messages for chapter generation.
 */
export function buildChapterGeneratePrompt(
  world: WorldConfig,
  params: GenerationParams,
): { system: string; user: string } {
  const system = `你是一位资深小说创作者和世界观设定专家。你的任务是基于给定的世界观设定，生成符合设定的章节内容。

要求：
- 章节内容必须严格遵循世界观设定（物理规则、魔法体系、社会结构等）
- 角色行为必须符合其设定描述和性格
- 时间线必须与已有历史事件一致
- 如果有世界规则约束，不能违反
- 输出格式为 JSON 数组，每项包含 title 和 content

请严格按照以下 JSON 格式返回：
\`\`\`json
[
  {
    "title": "章节标题",
    "content": "章节正文内容",
    "suggestedChapterNumber": 0
  }
]
\`\`\`

注意：
- content 应包含完整的章节正文（不少于 ${params.length} 字）
- 可以从多个角度生成不同的候选章节（如不同视角、不同切入点）
- 返回纯 JSON，不要 markdown 包装`;

  const user = `## 世界观: ${world.name}\n\n${formatWorldContext(world, params.referenceDimensions)}\n${buildParamsSection(params)}\n\n请基于以上世界观设定，生成 2-3 个不同的章节候选。`;

  return { system, user };
}

/**
 * Build system and user prompt messages for character generation.
 */
export function buildCharacterGeneratePrompt(
  world: WorldConfig,
  params: GenerationParams,
): { system: string; user: string } {
  const system = `你是一位资深小说创作者和角色设计师。你的任务是基于给定的世界观设定，生成符合世界观的新角色。

要求：
- 新角色必须符合世界观设定，不能与已有设定冲突
- 角色的能力、身份、背景要贴合世界观
- 角色类型包括：主角、配角、反派、中立
- 重要性 1-5 分
- 输出格式为 JSON 数组

请严格按照以下 JSON 格式返回：
\`\`\`json
[
  {
    "name": "角色名",
    "role": "主角|配角|反派|中立",
    "description": "角色描述（包括外貌、性格、背景、能力等）",
    "significance": 3,
    "traits": ["特质1", "特质2", "特质3"]
  }
]
\`\`\`

注意：
- name 应该是一个有特色的名字
- description 应详细描述角色（不少于 100 字）
- traits 用 2-4 个标签描述核心性格特质
- 返回纯 JSON，不要 markdown 包装`;

  const user = `## 世界观: ${world.name}\n\n${formatWorldContext(world, params.referenceDimensions)}\n${buildParamsSection(params)}\n\n请基于以上世界观设定，生成 2-3 个不同的新角色候选。`;

  return { system, user };
}

/**
 * Build system and user prompt messages for event generation.
 */
export function buildEventGeneratePrompt(
  world: WorldConfig,
  params: GenerationParams,
): { system: string; user: string } {
  const system = `你是一位资深小说创作者和历史事件设计师。你的任务是基于给定的世界观设定和历史背景，生成合理的新的历史或叙事事件。

要求：
- 新事件必须与已有历史事件时间线兼容
- 事件要合理利用已有的地理区域、组织势力、角色关系
- 重要性 1-5 分
- 输出格式为 JSON 数组

请严格按照以下 JSON 格式返回：
\`\`\`json
[
  {
    "title": "事件标题",
    "timestamp": "时间标记（如：光明历1300年）",
    "description": "事件详细描述",
    "significance": 3,
    "affectedRegions": ["受影响区域ID"]
  }
]
\`\`\`

注意：
- timestamp 应与世界观已有历史事件的时间格式一致
- description 应详细描述事件的起因、经过、结果（不少于 100 字）
- affectedRegions 引用已有地理区域的 ID
- 返回纯 JSON，不要 markdown 包装`;

  const user = `## 世界观: ${world.name}\n\n${formatWorldContext(world, params.referenceDimensions)}\n${buildParamsSection(params)}\n\n请基于以上世界观设定和历史，生成 2-3 个不同的新事件候选。`;

  return { system, user };
}

// ── Response Parsers ──

/**
 * Extract and parse JSON from LLM response text.
 * Tries: direct parse → markdown code block → bare JSON object → JSON array
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

/**
 * Parse LLM response into chapter candidates.
 */
export function parseChapterResponse(text: string, raw: string): ChapterCandidate[] {
  const extracted = extractJson(text);
  if (!extracted) return [];

  if (Array.isArray(extracted)) {
    return extracted.map((item: Record<string, unknown>) => ({
      title: String(item.title ?? "未命名章节"),
      content: String(item.content ?? ""),
      suggestedChapterNumber: Number(item.suggestedChapterNumber ?? 0),
    }));
  }

  // If it's a wrapped object with a candidates key
  if (typeof extracted === "object" && extracted !== null) {
    const obj = extracted as Record<string, unknown>;
    if (Array.isArray(obj.candidates)) {
      return obj.candidates.map((item: Record<string, unknown>) => ({
        title: String(item.title ?? "未命名章节"),
        content: String(item.content ?? ""),
        suggestedChapterNumber: Number(item.suggestedChapterNumber ?? 0),
      }));
    }
  }

  return [];
}

/**
 * Parse LLM response into character candidates.
 */
export function parseCharacterResponse(text: string, raw: string): CharacterCandidate[] {
  const extracted = extractJson(text);
  if (!extracted) return [];

  if (Array.isArray(extracted)) {
    return extracted.map((item: Record<string, unknown>) => ({
      name: String(item.name ?? "未命名角色"),
      role: String(item.role ?? "配角") as CharacterCandidate["role"],
      description: String(item.description ?? ""),
      significance: Math.min(5, Math.max(1, Number(item.significance ?? 3))),
      traits: Array.isArray(item.traits) ? item.traits.map(String) : [],
    }));
  }

  if (typeof extracted === "object" && extracted !== null) {
    const obj = extracted as Record<string, unknown>;
    if (Array.isArray(obj.candidates)) {
      return obj.candidates.map((item: Record<string, unknown>) => ({
        name: String(item.name ?? "未命名角色"),
        role: String(item.role ?? "配角") as CharacterCandidate["role"],
        description: String(item.description ?? ""),
        significance: Math.min(5, Math.max(1, Number(item.significance ?? 3))),
        traits: Array.isArray(item.traits) ? item.traits.map(String) : [],
      }));
    }
  }

  return [];
}

/**
 * Parse LLM response into event candidates.
 */
export function parseEventResponse(text: string, raw: string): EventCandidate[] {
  const extracted = extractJson(text);
  if (!extracted) return [];

  if (Array.isArray(extracted)) {
    return extracted.map((item: Record<string, unknown>) => ({
      title: String(item.title ?? "未命名事件"),
      timestamp: String(item.timestamp ?? ""),
      description: String(item.description ?? ""),
      significance: Math.min(5, Math.max(1, Number(item.significance ?? 3))),
      affectedRegions: Array.isArray(item.affectedRegions) ? item.affectedRegions.map(String) : [],
    }));
  }

  if (typeof extracted === "object" && extracted !== null) {
    const obj = extracted as Record<string, unknown>;
    if (Array.isArray(obj.candidates)) {
      return obj.candidates.map((item: Record<string, unknown>) => ({
        title: String(item.title ?? "未命名事件"),
        timestamp: String(item.timestamp ?? ""),
        description: String(item.description ?? ""),
        significance: Math.min(5, Math.max(1, Number(item.significance ?? 3))),
        affectedRegions: Array.isArray(item.affectedRegions) ? item.affectedRegions.map(String) : [],
      }));
    }
  }

  return [];
}

/**
 * Generate a unique ID for new world entities.
 */
export function generateEntityId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${ts}_${rand}`;
}
