// ── AI Relation Extraction Route (AI-1) ──
// Provides AI-assisted relationship extraction from prose text.
//
// Routes:
//   POST /:id/relation-extraction              — Submit prose for AI analysis
//   POST /:id/relation-extraction/accept        — Accept one/multiple proposals
//   POST /:id/relation-extraction/reject        — Reject one/multiple proposals

import { Hono } from "hono";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import {
  extractRelationsFromProse,
  type RelationProposal,
  type ExtractionResult,
} from "@actalk/inkchain-core";
import {
  CharacterRelationSchema,
  RelationsFileSchema,
  RelationType,
  type CharacterRelation,
  type RelationsFile,
  type RelationType as RelationTypeEnum,
} from "@actalk/inkchain-core";

// ── Constants ──

const RELATIONS_FILE = "story/state/relations.json";

// ── Helpers ──

async function loadRelations(bookDir: string): Promise<RelationsFile> {
  try {
    const raw = await readFile(join(bookDir, RELATIONS_FILE), "utf-8");
    return RelationsFileSchema.parse(JSON.parse(raw));
  } catch {
    // File doesn't exist or is corrupt — return empty state
    return { schemaVersion: "1", relations: [] };
  }
}

async function saveRelations(bookDir: string, data: RelationsFile): Promise<void> {
  const dir = join(bookDir, "story", "state");
  await mkdir(dir, { recursive: true });
  await writeFile(join(bookDir, RELATIONS_FILE), JSON.stringify(data, null, 2), "utf-8");
}

// ── Route factory ──

export function createRelationExtractionRouter(
  bookDir: (id: string) => string,
  getProjectRoot: () => string,
): Hono {
  const router = new Hono();

  // ── POST /:id/relation-extraction — Submit prose for AI analysis ──

  router.post("/:id/relation-extraction", async (c) => {
    const id = c.req.param("id");
    const dir = bookDir(id);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    const bodyRecord = body as Record<string, unknown>;
    const extractMode = String(bodyRecord.extractMode ?? "text") as "text" | "chapters" | "combined";

    let prose =
      typeof bodyRecord.prose === "string"
        ? (bodyRecord.prose as string).trim()
        : "";

    const rawChapterNumbers = bodyRecord.chapterNumbers;
    const chapterNumbers: number[] = Array.isArray(rawChapterNumbers)
      ? rawChapterNumbers.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n > 0)
      : [];

    // Auto-load chapter content when prose is not provided but chapters are specified
    if (!prose && chapterNumbers.length > 0 && (extractMode === "chapters" || extractMode === "combined")) {
      const chapterParts: string[] = [];
      for (const ch of chapterNumbers) {
        try {
          const chContent = await readFile(join(dir, "chapters", `${ch}.md`), "utf-8");
          chapterParts.push(`# 第${ch}章\n\n${chContent.trim()}`);
        } catch {
          // Skip missing chapter files
        }
      }
      if (chapterParts.length > 0) {
        prose = chapterParts.join("\n\n");
      }
    }

    if (!prose) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "prose 文本不能为空" } }, 400);
    }

    // Load existing relations for context
    const relationsFile = await loadRelations(dir);

    // Determine LLM config from the project
    const { loadProjectConfig } = await import("@actalk/inkchain-core");
    let llmConfig;
    try {
      const config = await loadProjectConfig(getProjectRoot(), {
        consumer: "studio",
        requireApiKey: false,
      });
      llmConfig = config.llm;
    } catch (err) {
      return c.json({
        error: {
          code: "CONFIG_ERROR",
          message: `无法加载项目 LLM 配置: ${err instanceof Error ? err.message : String(err)}`,
        },
      }, 500);
    }

    if (!llmConfig || !llmConfig.model) {
      return c.json({
        error: {
          code: "LLM_CONFIG_MISSING",
          message: "LLM 配置不完整，请在设置中配置模型后再试",
        },
      }, 400);
    }

    // Try to load character names from book.json for context
    let characterNames: string[] = [];
    try {
      const bookConfigPath = join(dir, "book.json");
      const bookConfigRaw = await readFile(bookConfigPath, "utf-8");
      const bookConfig = JSON.parse(bookConfigRaw) as Record<string, unknown>;
      const characters = bookConfig.characters;
      if (Array.isArray(characters)) {
        characterNames = characters
          .filter((c): c is string | Record<string, unknown> => typeof c === "string" || (typeof c === "object" && c !== null))
          .map((c) => (typeof c === "string" ? c : String((c as Record<string, unknown>).name ?? "")))
          .filter((name) => name.length > 0);
      }
    } catch {
      // Character names are optional context — proceed without them
    }

    try {
      const result = await extractRelationsFromProse(prose, relationsFile.relations, {
        llmConfig,
        characterNames,
        chapterNumbers,
      });

      return c.json({
        proposals: result.proposals,
        sourceChapters: result.sourceChapters,
        sourceCharacters: result.sourceCharacters,
        existingRelationsCount: relationsFile.relations.length,
      });
    } catch (err) {
      return c.json({
        error: {
          code: "EXTRACTION_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      }, 500);
    }
  });

  // ── POST /:id/relation-extraction/accept — Accept proposals ──

  router.post("/:id/relation-extraction/accept", async (c) => {
    const id = c.req.param("id");
    const dir = bookDir(id);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    const rawProposals = (body as Record<string, unknown>).proposals;
    const rawProposalIds = (body as Record<string, unknown>).proposalIds;

    let proposalsToAccept: RelationProposal[] = [];

    if (Array.isArray(rawProposals)) {
      // Accept with full proposal objects (with optional modifications)
      proposalsToAccept = rawProposals
        .filter((p): p is Record<string, unknown> => p !== null && typeof p === "object")
        .map((p) => ({
          id: String(p.id ?? randomUUID()),
          sourceId: String(p.sourceId ?? ""),
          targetId: String(p.targetId ?? ""),
          relationshipType: (p.relationshipType as RelationTypeEnum) ?? "close_friend",
          confidence: typeof p.confidence === "number" ? p.confidence : 0.5,
          evidence: String(p.evidence ?? ""),
          suggestedAttributes: p.suggestedAttributes && typeof p.suggestedAttributes === "object"
            ? {
                ...(typeof (p.suggestedAttributes as Record<string, unknown>).closeness === "number"
                  ? { closeness: (p.suggestedAttributes as Record<string, unknown>).closeness as number }
                  : {}),
                ...(typeof (p.suggestedAttributes as Record<string, unknown>).trust === "number"
                  ? { trust: (p.suggestedAttributes as Record<string, unknown>).trust as number }
                  : {}),
                ...(typeof (p.suggestedAttributes as Record<string, unknown>).intensity === "number"
                  ? { intensity: (p.suggestedAttributes as Record<string, unknown>).intensity as number }
                  : {}),
              }
            : undefined,
        }))
        .filter((p) => p.sourceId && p.targetId && p.relationshipType);
    } else if (Array.isArray(rawProposalIds)) {
      // Accept by proposal IDs only — need proposals stored in request context
      // Since we don't persist proposals server-side, the client must re-send them
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "请提供完整的 proposals 数据（proposalIds 仅支持服务端暂存场景，当前需提交 proposals 数组）",
        },
      }, 400);
    }

    if (proposalsToAccept.length === 0) {
      return c.json({
        error: { code: "VALIDATION_ERROR", message: "没有有效的 proposals 需要接受" },
      }, 400);
    }

    const now = new Date().toISOString();
    const data = await loadRelations(dir);

    const acceptedRelations: CharacterRelation[] = [];
    for (const proposal of proposalsToAccept) {
      // Validate relationship type
      const typeResult = RelationType.safeParse(proposal.relationshipType);
      if (!typeResult.success) continue;

      const intensity = proposal.suggestedAttributes?.intensity ?? 3;

      const relation: CharacterRelation = {
        id: proposal.id,
        sourceRoleId: proposal.sourceId,
        targetRoleId: proposal.targetId,
        relationType: typeResult.data,
        description: `[AI 提取] ${proposal.evidence.slice(0, 200)}${proposal.evidence.length > 200 ? "…" : ""}`,
        validFromChapter: 1,
        intensity: Math.max(1, Math.min(5, intensity)),
        createdAt: now,
        updatedAt: now,
      };

      // Validate against schema
      const parsed = CharacterRelationSchema.safeParse(relation);
      if (parsed.success) {
        data.relations.push(parsed.data);
        acceptedRelations.push(parsed.data);
      }
    }

    if (acceptedRelations.length === 0) {
      return c.json({
        error: { code: "VALIDATION_ERROR", message: "所有 proposals 校验失败，未能接受任何关系" },
      }, 400);
    }

    await saveRelations(dir, data);

    return c.json({
      accepted: acceptedRelations.length,
      relations: acceptedRelations,
      totalRelations: data.relations.length,
    });
  });

  // ── POST /:id/relation-extraction/reject — Reject proposals ──

  router.post("/:id/relation-extraction/reject", async (c) => {
    const id = c.req.param("id");
    const dir = bookDir(id);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    const rawProposalIds = (body as Record<string, unknown>).proposalIds;

    if (!Array.isArray(rawProposalIds) || rawProposalIds.length === 0) {
      return c.json({
        error: { code: "VALIDATION_ERROR", message: "proposalIds 不能为空" },
      }, 400);
    }

    // Currently proposals are not persisted server-side, so rejection is a no-op
    // that acknowledges the user's rejection. The client manages proposal state.
    return c.json({
      rejected: rawProposalIds.length,
      proposalIds: rawProposalIds,
    });
  });

  return router;
}
