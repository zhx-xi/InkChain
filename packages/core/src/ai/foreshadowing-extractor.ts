// ── AI Foreshadowing Extractor (Issue #211 — AI自动导入提取) ──
//
// LLM-based extraction of foreshadowing candidates from chapter text.
// Uses the same `chatCompletion()` pattern as worlds-ai-gen.ts.

import { createLLMClient, chatCompletion } from "../llm/provider.js";
import type { LLMConfig } from "../models/project.js";

// ── Types ──

export interface ForeshadowingExtractCandidate {
  title: string;
  type: "情节伏笔" | "角色伏笔" | "物品伏笔" | "设定伏笔";
  description: string;
  expectedPayoffChapter: number | null;
  confidence: number;
}

export interface ForeshadowingExtractResult {
  candidates: ForeshadowingExtractCandidate[];
  raw: string;
}

// ── System Prompt ──

const SYSTEM_PROMPT = `你是一个专业的小说伏笔分析助手。你的任务是分析给定章节的文本，从中识别出作者可能有意埋设的伏笔（foreshadowing）。

请从以下 4 个维度识别伏笔：

1. **情节伏笔** — 对后续情节走向的暗示、铺垫或预告
2. **角色伏笔** — 关于角色身份、关系、命运或秘密的暗示
3. **物品伏笔** — 特殊物品、道具或线索的引入和暗示
4. **设定伏笔** — 世界观、规则、历史背景中埋设的暗示

对于每个识别的伏笔，请用 JSON 数组格式返回，每个对象包含：
- title: 伏笔标题（简短概括）
- type: 类型（"情节伏笔" | "角色伏笔" | "物品伏笔" | "设定伏笔"）
- description: 伏笔描述（2-3句话说明伏笔内容和可能的回收方向）
- expectedPayoffChapter: 预期回收章节（根据故事进展推测，如果不确定则填 null）
- confidence: 置信度（0.0-1.0 之间的数字，越高表示越确信这是伏笔）

只返回 JSON 数组，不要包含其他说明文字。如果没有识别到伏笔，返回空数组 []。`;

// ── Extractor ──

export async function extractForeshadowings(
  text: string,
  currentChapter: number,
  config: { llm: LLMConfig },
): Promise<ForeshadowingExtractResult> {
  const userPrompt = `请分析第 ${currentChapter} 章的以下文本，识别其中的伏笔：\n\n${text}`;

  const client = createLLMClient(config.llm);
  const response = await chatCompletion(client, config.llm.model, [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ], { temperature: 0.3, maxTokens: 4096 });

  const raw = response.content.trim();
  const candidates = parseForeshadowingResponse(raw);

  return { candidates, raw };
}

// ── Response Parser ──

function parseForeshadowingResponse(raw: string): ForeshadowingExtractCandidate[] {
  // Try to extract JSON array from the response
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item: unknown): item is Record<string, unknown> =>
        item !== null && typeof item === "object"
      )
      .map((item: Record<string, unknown>): ForeshadowingExtractCandidate => ({
        title: String(item.title ?? ""),
        type: validateType(String(item.type ?? "情节伏笔")),
        description: String(item.description ?? ""),
        expectedPayoffChapter: typeof item.expectedPayoffChapter === "number"
          ? item.expectedPayoffChapter
          : null,
        confidence: typeof item.confidence === "number"
          ? Math.max(0, Math.min(1, item.confidence))
          : 0.5,
      }))
      .filter((c) => c.title.trim().length > 0 && c.confidence >= 0.3);
  } catch {
    return [];
  }
}

const VALID_TYPES = ["情节伏笔", "角色伏笔", "物品伏笔", "设定伏笔"] as const;

function validateType(type: string): ForeshadowingExtractCandidate["type"] {
  return (VALID_TYPES as readonly string[]).includes(type)
    ? type as ForeshadowingExtractCandidate["type"]
    : "情节伏笔";
}
