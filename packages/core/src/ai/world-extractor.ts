// ── WorldExtractor (Wrld-7: AI导入提取MVP) ──
//
// Rule-based world extraction service that parses raw TXT/MD text into the
// 7 world dimensions: settings, roles, relations, regions, institutions,
// history, rules.
//
// No LLM call — uses section header detection, keyword matching, and entity
// extraction heuristics.

import { createLLMClient, chatCompletion } from "../llm/provider.js";
import type { LLMConfig } from "../models/project.js";

// ── Types ──

/** The extracted world data — one free-form text field per dimension. */
export interface ExtractedWorld {
  settings: string;
  roles: string;
  relations: string;
  regions: string;
  institutions: string;
  history: string;
  rules: string;
}

/** A single extracted entity with its source location info. */
export interface ExtractedEntity {
  dimension: string;
  name: string;
  description: string;
  sourceLine: number;
}

/** Full result from extraction */
export interface ExtractResult {
  world: ExtractedWorld;
  entities: ExtractedEntity[];
  sections: ExtractedSection[];
}

/** Mapped section found in the source text */
export interface ExtractedSection {
  dimension: string;
  heading: string;
  content: string;
  lineStart: number;
  lineEnd: number;
}

// ── Configuration ──

/** Mapping of section heading keywords to dimension keys. */
const HEADING_DIMENSION_MAP: Record<string, string> = {
  // Chinese
  设定: "settings",
  世界观: "settings",
  世界设定: "settings",
  世界观设定: "settings",
  魔法体系: "settings",
  科技水平: "settings",
  社会结构: "settings",
  文化习俗: "settings",
  角色: "roles",
  人物: "roles",
  主要角色: "roles",
  配角: "roles",
  反派: "roles",
  人物介绍: "roles",
  角色介绍: "roles",
  关系: "relations",
  人物关系: "relations",
  角色关系: "relations",
  势力关系: "relations",
  地理: "regions",
  区域: "regions",
  地区: "regions",
  地点: "regions",
  地图: "regions",
  地理区域: "regions",
  组织: "institutions",
  势力: "institutions",
  组织势力: "institutions",
  宗门: "institutions",
  国家: "institutions",
  家族: "institutions",
  历史: "history",
  大事记: "history",
  历史事件: "history",
  事件: "history",
  年表: "history",
  规则: "rules",
  世界规则: "rules",
  物理规则: "rules",
  法则: "rules",
  限制: "rules",
  约束: "rules",
  // English
  settings: "settings",
  "world settings": "settings",
  "world-building": "settings",
  roles: "roles",
  characters: "roles",
  "character list": "roles",
  relations: "relations",
  relationships: "relations",
  "character relations": "relations",
  regions: "regions",
  geography: "regions",
  "geographic regions": "regions",
  locations: "regions",
  institutions: "institutions",
  factions: "institutions",
  organizations: "institutions",
  history: "history",
  timeline: "history",
  "historical events": "history",
  events: "history",
  rules: "rules",
  "world rules": "rules",
  laws: "rules",
  constraints: "rules",
};

/** Lines matching these patterns are treated as entity definitions (name + description). */
const ENTITY_PATTERNS = [
  // "名字：描述" or "名字: 描述"
  /^[-*]\s*(.+?)[：:]\s*(.+)$/,
  // "名字（描述）" or "名字(描述)" — commonly used in Chinese world-building docs
  /^[-*]\s*(.+?)[（(]\s*(.+?)\s*[）)]\s*$/,
  // "名字 —— 描述" or "名字 - 描述"
  /^[-*]\s*(.+?)\s*[-—]{1,2}\s*(.+)$/,
];

/** Keywords that hint at the dimension of a text fragment. */
const DIMENSION_KEYWORDS: Record<string, string[]> = {
  settings: ["世界观", "设定", "背景", "世界", "时代", "朝代", "文明", "种族", "world", "setting", "background"],
  roles: ["角色", "人物", "主角", "配角", "反派", "英雄", "少女", "少年", "魔王", "勇者", "character", "hero", "villain"],
  relations: ["关系", "盟友", "敌人", "对立", "联盟", "友谊", "仇恨", "relationship", "ally", "enemy"],
  regions: ["区域", "地区", "大陆", "国家", "城市", "村庄", "地形", "地点", "region", "city", "village", "continent"],
  institutions: ["组织", "势力", "宗门", "教派", "公会", "帝国", "王国", "家族", "集团", "organization", "faction", "guild"],
  history: ["历史", "事件", "战争", "战役", "革命", "建立", "灭亡", "时期", "history", "event", "war", "battle"],
  rules: ["规则", "法则", "限制", "约束", "定律", "规律", "规则系统", "rule", "law", "constraint", "system"],
};

/** Minimum keyword score required for a dimension match. */
const MIN_SCORE_THRESHOLD = 1;

// ── Section Header Detection ──

const HEADING_RE = /^(#{1,6})\s+(.+)$/m;

// Match lines like "世界设定：" or "角色：" as pseudo-headings
const COLON_HEADING_RE = /^([^\n]{1,20})[：:]\s*$/;

/**
 * Split text into sections based on markdown headings.
 */
export function splitSections(text: string): ExtractedSection[] {
  const lines = text.split("\n");
  const sections: ExtractedSection[] = [];
  let currentHeading = "";
  let currentContent: string[] = [];
  let currentLineStart = 0;
  let currentDimension = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = HEADING_RE.exec(line);
    if (match) {
      // Save previous section
      if (currentHeading) {
        sections.push({
          dimension: currentDimension,
          heading: currentHeading,
          content: currentContent.join("\n").trim(),
          lineStart: currentLineStart,
          lineEnd: i - 1,
        });
      }
      currentHeading = match[2].trim();
      currentContent = [];
      currentLineStart = i;
      currentDimension = mapHeadingToDimension(currentHeading);
    } else {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentHeading) {
    sections.push({
      dimension: currentDimension,
      heading: currentHeading,
      content: currentContent.join("\n").trim(),
      lineStart: currentLineStart,
      lineEnd: lines.length - 1,
    });
  }

  return sections;
}

/**
 * Split text into sections based on colon-style headings (e.g. "角色：" on its own line).
 * Only applies when no markdown headings are found.
 */
export function splitColonSections(text: string): ExtractedSection[] {
  const lines = text.split("\n");
  const sections: ExtractedSection[] = [];
  let currentHeading = "";
  let currentContent: string[] = [];
  let currentLineStart = 0;
  let currentDimension = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = COLON_HEADING_RE.exec(line);
    if (match && !line.startsWith("-") && !line.startsWith("*") && !line.startsWith("1.")) {
      // Save previous section
      if (currentHeading) {
        sections.push({
          dimension: currentDimension,
          heading: currentHeading,
          content: currentContent.join("\n").trim(),
          lineStart: currentLineStart,
          lineEnd: i - 1,
        });
      }
      currentHeading = match[1].trim();
      currentContent = [];
      currentLineStart = i;
      currentDimension = mapHeadingToDimension(currentHeading);
    } else {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentHeading) {
    sections.push({
      dimension: currentDimension,
      heading: currentHeading,
      content: currentContent.join("\n").trim(),
      lineStart: currentLineStart,
      lineEnd: lines.length - 1,
    });
  }

  return sections;
}

/**
 * Split text into paragraphs for content-level analysis.
 */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Map a section heading to a dimension key using HEADING_DIMENSION_MAP.
 * Performs case-insensitive matching and also checks if the heading contains
 * any of the map keys as a substring.
 */
function mapHeadingToDimension(heading: string): string {
  const lower = heading.toLowerCase().trim();

  // Exact match
  if (HEADING_DIMENSION_MAP[lower]) {
    return HEADING_DIMENSION_MAP[lower];
  }

  // Substring match — check if any key is contained in the heading
  for (const [key, dim] of Object.entries(HEADING_DIMENSION_MAP)) {
    if (lower.includes(key)) {
      return dim;
    }
  }

  return "";
}

// ── Keyword Scoring ──

/**
 * Score text against all dimensions and return the best-matched dimension key,
 * or empty string if no dimension scores above threshold.
 */
function scoreDimension(text: string): string {
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {
    settings: 0,
    roles: 0,
    relations: 0,
    regions: 0,
    institutions: 0,
    history: 0,
    rules: 0,
  };

  for (const [dim, keywords] of Object.entries(DIMENSION_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      // Count occurrences of each keyword
      let idx = 0;
      let count = 0;
      while ((idx = lower.indexOf(kw, idx)) !== -1) {
        count++;
        idx += kw.length;
      }
      score += count;
    }
    scores[dim] = score;
  }

  let bestDim = "";
  let bestScore = 0;
  for (const [dim, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestDim = dim;
    }
  }

  return bestScore >= MIN_SCORE_THRESHOLD ? bestDim : "";
}

/**
 * Get dimension scores for all dimensions — used for distributing paragraphs.
 */
function scoreAllDimensions(text: string): Record<string, number> {
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {
    settings: 0,
    roles: 0,
    relations: 0,
    regions: 0,
    institutions: 0,
    history: 0,
    rules: 0,
  };

  for (const [dim, keywords] of Object.entries(DIMENSION_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      let idx = 0;
      let count = 0;
      while ((idx = lower.indexOf(kw, idx)) !== -1) {
        count++;
        idx += kw.length;
      }
      score += count;
    }
    scores[dim] = score;
  }

  return scores;
}

/**
 * Best dimension for text, returning the key with the highest score.
 * Returns "roles" as default fallback when nothing scores above threshold.
 */
function bestDimension(text: string): string {
  const scores = scoreAllDimensions(text);
  let bestDim = "roles";
  let bestScore = 0;
  for (const [dim, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestDim = dim;
    }
  }
  return bestDim;
}

// ── Entity Extraction ──

/**
 * Extract named entities from a block of text using ENTITY_PATTERNS.
 */
export function extractEntities(text: string, dimension: string): ExtractedEntity[] {
  const lines = text.split("\n");
  const entities: ExtractedEntity[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    for (const pattern of ENTITY_PATTERNS) {
      const match = pattern.exec(line);
      if (match) {
        entities.push({
          dimension,
          name: match[1].trim(),
          description: match[2].trim(),
          sourceLine: i,
        });
        break;
      }
    }
  }

  return entities;
}

// ── Main Extraction ──

/**
 * Extract world data from raw text using rule-based methods (no LLM).
 *
 * The function:
 * 1. Splits text into sections based on markdown headings (or colon headings as fallback)
 * 2. Maps headings to dimensions
 * 3. For unmapped content, uses keyword scoring on each paragraph
 * 4. Extracts named entities from each section
 * 5. Aggregates results into the 7 dimension text fields
 *
 * @param text - Raw TXT or MD text to extract from
 * @returns Extracted world data with entities and section info
 */
export function extractWorldFromText(text: string): ExtractResult {
  // Try markdown headings first, then colon headings, then treat entire text as one block
  let sections = splitSections(text);
  if (sections.length === 0) {
    sections = splitColonSections(text);
  }

  // Build dimension content from mapped sections
  const dimensionContent: Record<string, string[]> = {
    settings: [],
    roles: [],
    relations: [],
    regions: [],
    institutions: [],
    history: [],
    rules: [],
  };

  const allEntities: ExtractedEntity[] = [];
  const unmappedContent: string[] = [];

  for (const section of sections) {
    if (section.dimension && dimensionContent[section.dimension] !== undefined) {
      dimensionContent[section.dimension].push(section.content);
      const entities = extractEntities(section.content, section.dimension);
      allEntities.push(...entities);
    } else {
      unmappedContent.push(section.content);
    }
  }

  // If no sections at all (no headings found), treat the whole text as unmapped
  if (sections.length === 0 && text.trim()) {
    unmappedContent.push(text.trim());
  }

  // Try to categorize unmapped content using keyword scoring
  for (const content of unmappedContent) {
    const paragraphs = splitParagraphs(content);
    if (paragraphs.length <= 1) {
      // Single block — try scoring the whole thing
      const dim = scoreDimension(content);
      if (dim && dimensionContent[dim] !== undefined) {
        dimensionContent[dim].push(content);
        const entities = extractEntities(content, dim);
        allEntities.push(...entities);
      } else {
        // Distribute line-by-line based on best-guess dimension
        const lines = content.split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          const lineDim = bestDimension(line);
          dimensionContent[lineDim].push(line.trim());
          const entities = extractEntities(line, lineDim);
          allEntities.push(...entities);
        }
      }
    } else {
      // Multiple paragraphs — distribute each to its best-matching dimension
      for (const para of paragraphs) {
        const dim = scoreDimension(para) || bestDimension(para);
        dimensionContent[dim].push(para);
        const entities = extractEntities(para, dim);
        allEntities.push(...entities);
      }
    }
  }

  // Deduplicate entities by name within each dimension
  const seen = new Set<string>();
  const uniqueEntities = allEntities.filter((e) => {
    const key = `${e.dimension}:${e.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const world: ExtractedWorld = {
    settings: dimensionContent.settings.join("\n\n").trim(),
    roles: dimensionContent.roles.join("\n\n").trim(),
    relations: dimensionContent.relations.join("\n\n").trim(),
    regions: dimensionContent.regions.join("\n\n").trim(),
    institutions: dimensionContent.institutions.join("\n\n").trim(),
    history: dimensionContent.history.join("\n\n").trim(),
    rules: dimensionContent.rules.join("\n\n").trim(),
  };

  return { world, entities: uniqueEntities, sections };
}

/**
 * Generate a human-readable report summarizing what was extracted.
 */
export function summarizeExtraction(result: ExtractResult): string {
  const { world, entities, sections } = result;
  const lines: string[] = [
    "=== 提取报告 ===",
    "",
    `发现 ${sections.length} 个章节，提取 ${entities.length} 个实体`,
    "",
    "各维度内容量：",
  ];

  for (const [dim, content] of Object.entries(world)) {
    const charCount = content.length;
    const entityCount = entities.filter((e) => e.dimension === dim).length;
    if (charCount > 0) {
      lines.push(`  ${dim}: ${charCount} 字，${entityCount} 个实体`);
    }
  }

  return lines.join("\n");
}

// ── LLM-based World Extraction (Issue #471) ──

const WORLD_LLM_SYSTEM_PROMPT = `你是一个专业的小说世界设定提取助手。你的任务是从给定的章节文本中提取结构化的世界设定信息。

请从以下 7 个维度提取世界设定内容：

1. **settings（世界观设定）** — 魔法体系、科技水平、社会结构、文化习俗、种族等
2. **roles（世界角色）** — 重要角色及其身份、能力、背景
3. **relations（世界关系）** — 势力关系、角色关系、国家关系
4. **regions（地理区域）** — 大陆、国家、城市、地点、地形特征
5. **institutions（组织势力）** — 政治体系、势力组织、权力结构
6. **history（历史事件）** — 历史事件、重大变故、纪元划分
7. **rules（世界规则）** — 世界运行规则、物理/魔法/社会定律

对于每个维度，请提取出相关的实体信息。每个实体包含：
- dimension: 所属维度（上述 7 个之一）
- name: 实体名称
- description: 详细描述（提取自原文或合理推断）
- confidence: 置信度（0.0-1.0，从原文直接引用的为 1.0）

只返回 JSON 对象，不要包含其他说明文字。JSON 格式：
{
  "entities": [{ "dimension": "settings", "name": "...", "description": "...", "confidence": 1.0 }]
}

如果没有提取到实体，返回 {"entities": []}。`;

/**
 * Extract world data from text using LLM.
 * Covers the 7 world dimensions with structured entity extraction.
 */
export async function extractWorldWithLLM(
  text: string,
  config: { llm: LLMConfig },
): Promise<ExtractResult> {
  const maxChars = 60000;
  const truncated = text.length > maxChars ? text.substring(0, maxChars) + "\n\n[文本过长，已截断]" : text;

  const userPrompt = `请从以下小说章节文本中提取结构化的世界设定信息：\n\n${truncated}`;

  const client = createLLMClient(config.llm);
  const response = await chatCompletion(client, config.llm.model, [
    { role: "system", content: WORLD_LLM_SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ], { temperature: 0.3, maxTokens: 8192 });

  const raw = response.content.trim();
  const parsed = parseWorldLLMResponse(raw);

  // Build ExtractResult from parsed entities
  const dimensionContent: Record<string, string[]> = {
    settings: [], roles: [], relations: [], regions: [],
    institutions: [], history: [], rules: [],
  };

  const entities: ExtractedEntity[] = [];

  for (const entity of parsed.entities) {
    const dim = entity.dimension;
    if (dimensionContent[dim] !== undefined) {
      dimensionContent[dim].push(`${entity.name}: ${entity.description}`);
      entities.push({
        dimension: dim,
        name: entity.name,
        description: entity.description,
        sourceLine: 0,
      });
    }
  }

  const world: ExtractedWorld = {
    settings: dimensionContent.settings.join("\n\n").trim(),
    roles: dimensionContent.roles.join("\n\n").trim(),
    relations: dimensionContent.relations.join("\n\n").trim(),
    regions: dimensionContent.regions.join("\n\n").trim(),
    institutions: dimensionContent.institutions.join("\n\n").trim(),
    history: dimensionContent.history.join("\n\n").trim(),
    rules: dimensionContent.rules.join("\n\n").trim(),
  };

  return { world, entities, sections: [] };
}

interface LLMWorldEntity {
  dimension: string;
  name: string;
  description: string;
  confidence: number;
}

interface LLMWorldResponse {
  entities: LLMWorldEntity[];
}

function parseWorldLLMResponse(raw: string): LLMWorldResponse {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { entities: [] };

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed || typeof parsed !== "object") return { entities: [] };
    const entities = Array.isArray(parsed.entities) ? parsed.entities : [];
    return {
      entities: entities
        .filter((e: unknown): e is Record<string, unknown> =>
          e !== null && typeof e === "object"
        )
        .map((e: Record<string, unknown>): LLMWorldEntity => ({
          dimension: validateDimension(String(e.dimension ?? "settings")),
          name: String(e.name ?? ""),
          description: String(e.description ?? ""),
          confidence: typeof e.confidence === "number"
            ? Math.max(0, Math.min(1, e.confidence))
            : 0.5,
        }))
        .filter((e: LLMWorldEntity) => e.name.trim().length > 0),
    };
  } catch {
    return { entities: [] };
  }
}

const VALID_DIMENSIONS = [
  "settings", "roles", "relations", "regions",
  "institutions", "history", "rules",
];

function validateDimension(dim: string): string {
  return VALID_DIMENSIONS.includes(dim) ? dim : "settings";
}
