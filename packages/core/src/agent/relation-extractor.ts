// ── AI Relation Extraction from Prose (AI-1) ──
// Uses LLM to analyze character interactions from prose text
// and extracts structured relation proposals for review.

import { randomUUID } from "node:crypto";
import type { LLMConfig } from "../models/project.js";
import type { CharacterRelation } from "../models/relations.js";
import { RelationType } from "../models/relations.js";
import { createLLMClient, chatCompletion } from "../llm/provider.js";

// ── Types ──

export interface RelationProposal {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: RelationType;
  confidence: number; // 0-1
  evidence: string; // quoted text from prose
  suggestedAttributes?: {
    closeness?: number;
    trust?: number;
    intensity?: number;
  };
}

export interface ExtractionResult {
  proposals: RelationProposal[];
  sourceChapters: number[];
  sourceCharacters: string[];
}

interface ExtractionPromptContext {
  existingRelations: CharacterRelation[];
  characterNames: string[];
}

// ── Prompt Templates ──

function buildSystemPrompt(): string {
  return `你是一位资深文学分析专家，擅长从小说叙事文本中分析角色之间的关系。

你的任务是从给定的叙事文本中，识别出角色之间的互动，并推断他们之间的关系类型。

## 关系类型定义

- close_friend（挚友）：亲密的朋友关系，彼此信任、支持
- rival（敌对）：竞争或敌对关系，存在冲突、对抗
- alliance（联盟）：基于共同目标的合作关系
- mentor（师徒）：教导与被教导的关系，一方传授知识/技能
- blood（血缘）：有血缘关系的家庭成员
- secret_crush（暗恋）：一方对另一方有单向的爱慕之情（未表露或未确认）

## 输出格式

请严格按照以下 JSON 格式返回分析结果，不要添加任何额外的说明文字：

\`\`\`json
{
  "proposals": [
    {
      "sourceId": "角色A的ID",
      "targetId": "角色B的ID",
      "relationshipType": "close_friend | rival | alliance | mentor | blood | secret_crush",
      "confidence": 0.95,
      "evidence": "从文本中摘录的原文片段...",
      "suggestedAttributes": {
        "closeness": 4,
        "trust": 3,
        "intensity": 4
      }
    }
  ],
  "sourceCharacters": ["角色A", "角色B"]
}
\`\`\`

## 要求

1. confidence 取值范围 0-1，表示你对这个关系判断的确信程度
2. evidence 必须是文本中直接出现的内容摘录，不要概括或改写
3. suggestedAttributes 是可选的：
   - closeness（亲密度）：1-5 的整数
   - trust（信任度）：1-5 的整数
   - intensity（强度）：1-5 的整数
4. 只输出 JSON，不要 markdown 代码块包裹（除非整个响应被代码块包裹，我会从中提取）
5. 如果没有发现任何角色关系，返回 { "proposals": [], "sourceCharacters": [] }`;
}

function buildUserPrompt(
  prose: string,
  context: ExtractionPromptContext,
  chapterNumbers: number[],
): string {
  const existingRelationsText = context.existingRelations.length > 0
    ? context.existingRelations
        .map(
          (r) =>
            `- ${r.sourceRoleId} ↔ ${r.targetRoleId}: ${r.relationType}（强度 ${r.intensity}）`,
        )
        .join("\n")
    : "暂无已有关系";

  const characterNamesText =
    context.characterNames.length > 0
      ? context.characterNames.join("、")
      : "（未提供角色列表，请从文本中识别）";

  return `## 章节信息

分析以下叙事文本${chapterNumbers.length > 0 ? `（来自第 ${chapterNumbers.join("、")} 章）` : ""}。

## 已有角色关系

${existingRelationsText}

## 已知角色

${characterNamesText}

## 叙事文本

${prose}

请分析以上文本中角色之间的互动，识别并提取关系。`;
}

// ── LLM Response Parser ──

function parseProposalsFromLLMResponse(
  text: string,
): { proposals: Omit<RelationProposal, "id">[]; sourceCharacters: string[] } | null {
  const trimmed = text.trim();

  // Try parsing as-is
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      return normalizeParsedResult(parsed);
    }
  } catch {
    // fall through to extraction strategies
  }

  // Try extracting from markdown code blocks
  const jsonMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1].trim());
      return normalizeParsedResult(parsed);
    } catch {
      // fall through
    }
  }

  // Try finding any JSON object
  const objMatch = trimmed.match(/\{[\s\S]*"proposals"[\s\S]*\}/);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]);
      return normalizeParsedResult(parsed);
    } catch {
      // fall through
    }
  }

  // Last resort: find any JSON object
  const fallbackMatch = trimmed.match(/\{[\s\S]*\}/);
  if (fallbackMatch) {
    try {
      const parsed = JSON.parse(fallbackMatch[0]);
      return normalizeParsedResult(parsed);
    } catch {
      // fall through
    }
  }

  return null;
}

function normalizeParsedResult(
  parsed: Record<string, unknown>,
): { proposals: Omit<RelationProposal, "id">[]; sourceCharacters: string[] } | null {
  const proposalsRaw = parsed.proposals ?? parsed;
  const proposals = Array.isArray(proposalsRaw) ? proposalsRaw : [];
  const sourceCharacters = Array.isArray(parsed.sourceCharacters)
    ? parsed.sourceCharacters.map(String)
    : [];

  if (proposals.length === 0) {
    return { proposals: [], sourceCharacters };
  }

  const validProposals: Omit<RelationProposal, "id">[] = [];
  for (const raw of proposals) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const sourceId = String(item.sourceId ?? "");
    const targetId = String(item.targetId ?? "");
    const relationshipType = String(item.relationshipType ?? "");

    if (!sourceId || !targetId || !relationshipType) continue;

    // Validate relationshipType against the enum
    const typeResult = RelationType.safeParse(relationshipType);
    if (!typeResult.success) continue;

    const confidence = typeof item.confidence === "number" ? item.confidence : 0.5;
    const evidence = String(item.evidence ?? "");

    const suggestedAttributes =
      item.suggestedAttributes && typeof item.suggestedAttributes === "object"
        ? {
            ...(typeof (item.suggestedAttributes as Record<string, unknown>).closeness === "number"
              ? { closeness: (item.suggestedAttributes as Record<string, unknown>).closeness as number }
              : {}),
            ...(typeof (item.suggestedAttributes as Record<string, unknown>).trust === "number"
              ? { trust: (item.suggestedAttributes as Record<string, unknown>).trust as number }
              : {}),
            ...(typeof (item.suggestedAttributes as Record<string, unknown>).intensity === "number"
              ? { intensity: (item.suggestedAttributes as Record<string, unknown>).intensity as number }
              : {}),
          }
        : undefined;

    validProposals.push({
      sourceId,
      targetId,
      relationshipType: typeResult.data,
      confidence: Math.max(0, Math.min(1, confidence)),
      evidence,
      suggestedAttributes,
    });
  }

  return { proposals: validProposals, sourceCharacters };
}

// ── Main Extraction Function ──

/**
 * Analyzes prose text using LLM to extract character relationship proposals.
 *
 * @param prose - The narrative prose text to analyze
 * @param existingRelations - Current known relations for context
 * @param options - Optional configuration including LLM config, character names, chapter numbers
 * @returns ExtractionResult with proposals and metadata
 */
export async function extractRelationsFromProse(
  prose: string,
  existingRelations: CharacterRelation[],
  options?: {
    llmConfig?: LLMConfig;
    characterNames?: string[];
    chapterNumbers?: number[];
  },
): Promise<ExtractionResult> {
  if (!prose || prose.trim().length === 0) {
    return { proposals: [], sourceChapters: [], sourceCharacters: [] };
  }

  const chapterNumbers = options?.chapterNumbers ?? [];
  const context: ExtractionPromptContext = {
    existingRelations,
    characterNames: options?.characterNames ?? [],
  };

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(prose, context, chapterNumbers);

  // Use the provided LLM config or throw a meaningful error
  if (!options?.llmConfig) {
    throw new Error(
      "LLM config is required for relation extraction. Pass llmConfig in options.",
    );
  }

  const client = createLLMClient(options.llmConfig);

  let response;
  try {
    response = await chatCompletion(client, options.llmConfig.model, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], {
      temperature: 0.3, // Lower temperature for more consistent structured output
      maxTokens: 4096,
    });
  } catch (err) {
    throw new Error(
      `LLM relation extraction failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const parsed = parseProposalsFromLLMResponse(response.content);
  if (!parsed) {
    // Return empty result rather than throwing — caller can surface the raw text
    return {
      proposals: [],
      sourceChapters: chapterNumbers,
      sourceCharacters: [],
    };
  }

  // Assign UUIDs to each proposal
  const proposals: RelationProposal[] = parsed.proposals.map((p) => ({
    ...p,
    id: randomUUID(),
  }));

  return {
    proposals,
    sourceChapters: chapterNumbers,
    sourceCharacters: parsed.sourceCharacters,
  };
}
