// ── AI Timeline Extractor (Issue #211 — AI自动导入提取) ──
//
// LLM-based extraction of timeline events from chapter text.
// Uses the same `chatCompletion()` pattern as worlds-ai-gen.ts.

import { createLLMClient, chatCompletion } from "../llm/provider.js";
import type { LLMConfig } from "../models/project.js";

// ── Types ──

export interface TimelineExtractEvent {
  title: string;
  eventType: string;
  description: string;
  relatedCharacters: string[];
  importance: number;
  tags: string[];
}

export interface TimelineExtractResult {
  events: TimelineExtractEvent[];
  raw: string;
}

// ── System Prompt ──

const SYSTEM_PROMPT = `你是一个专业的小说时间线/事件分析助手。你的任务是分析给定章节的文本，从中提取关键事件和重要情节节点。

请识别以下类型的事件：
- plot: 剧情推进事件（重要转折、冲突、发现、决定等）
- character: 角色相关事件（登场、成长、关系变化、重要对话等）
- world: 世界观事件（地点变化、势力变动、规则揭示等）

对于每个事件，请用 JSON 数组格式返回，每个对象包含：
- title: 事件标题（简短概括，10字以内）
- eventType: 事件类型（"plot" | "character" | "world"）
- description: 事件描述（1-2句话说明事件内容和影响）
- relatedCharacters: 涉及的角色名称数组（中文全名，如 ["小明", "小红"]）
- importance: 重要性（1-5 的整数，5 表示最关键的事件）
- tags: 标签数组（如 ["战斗", "情感", "揭露", "转折"]）

只返回 JSON 数组，不要包含其他说明文字。从每个章节中提取 2-8 个最重要的事件。`;

// ── Extractor ──

export async function extractTimelineEvents(
  text: string,
  chapter: number,
  config: { llm: LLMConfig },
): Promise<TimelineExtractResult> {
  const userPrompt = `请从第 ${chapter} 章的以下文本中提取关键事件：\n\n${text}`;

  const client = createLLMClient(config.llm);
  const response = await chatCompletion(client, config.llm.model, [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ], { temperature: 0.3, maxTokens: 4096 });

  const raw = response.content.trim();
  const events = parseTimelineResponse(raw);

  return { events, raw };
}

// ── Response Parser ──

function parseTimelineResponse(raw: string): TimelineExtractEvent[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item: unknown): item is Record<string, unknown> =>
        item !== null && typeof item === "object"
      )
      .map((item: Record<string, unknown>): TimelineExtractEvent => ({
        title: String(item.title ?? ""),
        eventType: validateEventType(String(item.eventType ?? "plot")),
        description: String(item.description ?? ""),
        relatedCharacters: Array.isArray(item.relatedCharacters)
          ? item.relatedCharacters.map(String).filter((n) => n.trim().length > 0)
          : [],
        importance: typeof item.importance === "number"
          ? Math.max(1, Math.min(5, Math.round(item.importance)))
          : 3,
        tags: Array.isArray(item.tags)
          ? item.tags.map(String).filter((t) => t.trim().length > 0)
          : [],
      }))
      .filter((e) => e.title.trim().length > 0);
  } catch {
    return [];
  }
}

const VALID_EVENT_TYPES = ["plot", "character", "world"] as const;

function validateEventType(type: string): string {
  return (VALID_EVENT_TYPES as readonly string[]).includes(type) ? type : "plot";
}
