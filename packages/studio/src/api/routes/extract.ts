// ── Unified Extraction API (Issue #335) ──
//
// Single endpoint for all AI extraction skills:
//   POST /api/extract
//
// Dispatches to the correct extraction function based on skillId.
// Error responses follow the unified { code: string, message: string } format.

import { Hono } from "hono";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  extractForeshadowings,
  extractTimelineEvents,
  extractWorldFromText,
  extractWorldWithLLM,
  extractRelationsFromProse,
  learnStyle,
  loadProjectConfig,
  RelationsFileSchema,
  summarizeExtraction,
  type CharacterRelation,
  type LLMConfig,
} from "@actalk/inkchain-core";
import { ApiError } from "../errors.js";

// ── Types ──

interface ExtractRequestBody {
  skillId: string;
  bookId?: string;
  chapterNumber?: number;
  text?: string;
  params?: Record<string, unknown>;
}

// ── Route factory ──

export function createExtractRouter(
  bookDir: (id: string) => string,
  getProjectRoot: () => string,
): Hono {
  const router = new Hono();

  // POST /api/extract — unified extraction endpoint
  router.post("/", async (c) => {
    try {
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        throw new ApiError(400, "INVALID_JSON", "请求体不是有效的 JSON");
      }

      const { skillId, bookId, chapterNumber, text, params } = body as ExtractRequestBody;

      if (!skillId || typeof skillId !== "string") {
        throw new ApiError(400, "MISSING_SKILL_ID", "缺少 skillId 参数");
      }

      const root = getProjectRoot();
      let llmConfig: LLMConfig | undefined;

      // For LLM-based extractions, load project config
      if (["extract-foreshadowing", "extract-timeline", "extract-relation", "extract-world"].includes(skillId)) {
        try {
          const config = await loadProjectConfig(root, {
            consumer: "studio",
            requireApiKey: false,
          });
          llmConfig = config.llm;
        } catch (err) {
          throw new ApiError(500, "CONFIG_ERROR", `无法加载 LLM 配置: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      switch (skillId) {
        // ── Foreshadowing Extraction ──
        case "extract-foreshadowing": {
          if (!bookId) throw new ApiError(400, "MISSING_BOOK_ID", "foreshadowing 提取需要 bookId");
          if (!chapterNumber || chapterNumber < 0) {
            throw new ApiError(400, "MISSING_CHAPTER", "foreshadowing 提取需要有效的 chapterNumber");
          }

          const dir = bookDir(bookId);
          const padded = String(chapterNumber).padStart(4, "0");
          const chaptersDir = join(dir, "chapters");

          let files: string[];
          try {
            files = await readdir(chaptersDir);
          } catch {
            throw new ApiError(404, "CHAPTERS_DIR_NOT_FOUND", "章节目录不存在");
          }

          const chapterFile = files.find(
            (f) => f.startsWith(`${padded}_`) && f.endsWith(".md"),
          );
          if (!chapterFile) {
            throw new ApiError(404, "CHAPTER_NOT_FOUND", `第 ${chapterNumber} 章文件未找到`);
          }

          const chapterText = await readFile(join(chaptersDir, chapterFile), "utf-8");
          const result = await extractForeshadowings(chapterText, chapterNumber, {
            llm: llmConfig!,
          });

          return c.json({
            success: true,
            data: {
              candidates: result.candidates,
              raw: result.raw.substring(0, 500),
              chapter: chapterNumber,
            },
          });
        }

        // ── Timeline Extraction ──
        case "extract-timeline": {
          if (!bookId) throw new ApiError(400, "MISSING_BOOK_ID", "timeline 提取需要 bookId");
          if (!chapterNumber || chapterNumber < 0) {
            throw new ApiError(400, "MISSING_CHAPTER", "timeline 提取需要有效的 chapterNumber");
          }

          const dir = bookDir(bookId);
          const padded = String(chapterNumber).padStart(4, "0");
          const chaptersDir = join(dir, "chapters");

          let files: string[];
          try {
            files = await readdir(chaptersDir);
          } catch {
            throw new ApiError(404, "CHAPTERS_DIR_NOT_FOUND", "章节目录不存在");
          }

          const chapterFile = files.find(
            (f) => f.startsWith(`${padded}_`) && f.endsWith(".md"),
          );
          if (!chapterFile) {
            throw new ApiError(404, "CHAPTER_NOT_FOUND", `第 ${chapterNumber} 章文件未找到`);
          }

          const chapterText = await readFile(join(chaptersDir, chapterFile), "utf-8");
          const result = await extractTimelineEvents(chapterText, chapterNumber, {
            llm: llmConfig!,
          });

          return c.json({
            success: true,
            data: {
              events: result.events,
              raw: result.raw.substring(0, 500),
              chapter: chapterNumber,
            },
          });
        }

        // ── World Extraction ──
        case "extract-world": {
          if (!llmConfig || !llmConfig.model) {
            throw new ApiError(400, "LLM_CONFIG_MISSING", "LLM 配置不完整，请在设置中配置模型后再试");
          }

          let worldText: string;
          let textLength = 0;
          let chaptersRead = 0;

          if (text && typeof text === "string" && text.trim()) {
            worldText = text;
            textLength = worldText.length;
          } else if (bookId) {
            // Read from book: settings files + first few chapters
            const dir = bookDir(bookId);
            const { access } = await import("node:fs/promises");
            const textParts: string[] = [];
            let fileCount = 0;

            // 1. Read setting files
            const settingsDir = join(dir, "settings");
            try {
              await access(settingsDir);
              const settingsFiles = await readdir(settingsDir);
              const mdFiles = settingsFiles.filter(
                (f) => f.endsWith(".md") && !f.startsWith("."),
              );
              for (const file of mdFiles) {
                const content = await readFile(join(settingsDir, file), "utf-8");
                textParts.push(`## ${file}\n\n${content}`);
                fileCount++;
              }
            } catch {
              // No settings directory — fine
            }

            // 2. Supplement with chapter text
            const maxChapters = 5;
            const chaptersDir = join(dir, "chapters");
            try {
              const chapterFiles = await readdir(chaptersDir);
              const sortedChapters = chapterFiles
                .filter((f) => f.endsWith(".md") && /^\d{4}/.test(f))
                .sort();

              const toRead = Math.min(sortedChapters.length, maxChapters);
              for (let i = 0; i < toRead; i++) {
                const content = await readFile(
                  join(chaptersDir, sortedChapters[i]),
                  "utf-8",
                );
                textParts.push(`## 第 ${i + 1} 章\n\n${content}`);
                fileCount++;
              }
            } catch {
              // No chapters directory — continue with settings files only
            }

            worldText = textParts.join("\n\n---\n\n");
            chaptersRead = fileCount;
            textLength = worldText.length;

            if (!worldText.trim()) {
              throw new ApiError(400, "NO_CONTENT", "本书暂无章节或设定文件可提取");
            }
          } else {
            throw new ApiError(400, "MISSING_TEXT", "world 提取需要 text 或 bookId 参数");
          }

          // Use LLM-based extraction instead of rule-based
          const result = await extractWorldWithLLM(worldText, { llm: llmConfig });
          const summary = summarizeExtraction(result);

          return c.json({
            success: true,
            data: {
              world: result.world,
              entities: result.entities,
              sections: result.sections,
              summary,
              textLength,
              chaptersRead,
            },
          });
        }

        // ── Relation Extraction ──
        case "extract-relation": {
          if (!bookId) throw new ApiError(400, "MISSING_BOOK_ID", "relation 提取需要 bookId");
          if (!llmConfig || !llmConfig.model) {
            throw new ApiError(400, "LLM_CONFIG_MISSING", "LLM 配置不完整，请在设置中配置模型后再试");
          }

          const dir = bookDir(bookId);
          const p = (params ?? {}) as Record<string, unknown>;

          // Resolve prose text
          let prose =
            typeof p.prose === "string" && p.prose.trim()
              ? p.prose.trim()
              : (text ?? "").trim();

          const rawChapterNumbers = p.chapterNumbers;
          const chapterNumbers: number[] = Array.isArray(rawChapterNumbers)
            ? rawChapterNumbers.filter(
                (n): n is number => typeof n === "number" && Number.isInteger(n) && n > 0,
              )
            : [];

          // Auto-load chapter content when prose is not provided but chapters are specified
          if (!prose && chapterNumbers.length > 0) {
            const chaptersDir = join(dir, "chapters");
            let files: string[];
            try {
              files = await readdir(chaptersDir);
            } catch {
              files = [];
            }
            const chapterParts: string[] = [];
            for (const ch of chapterNumbers) {
              const padded = String(ch).padStart(4, "0");
              const chapterFile = files.find(
                (f) => f.startsWith(`${padded}_`) && f.endsWith(".md"),
              );
              if (chapterFile) {
                try {
                  const chContent = await readFile(
                    join(chaptersDir, chapterFile),
                    "utf-8",
                  );
                  chapterParts.push(`# 第${ch}章\n\n${chContent.trim()}`);
                } catch {
                  // Skip unreadable chapter files
                }
              }
            }
            if (chapterParts.length > 0) {
              prose = chapterParts.join("\n\n");
            }
          }

          if (!prose) {
            throw new ApiError(400, "VALIDATION_ERROR", "prose 文本不能为空");
          }

          // Load existing relations for context
          const RELATIONS_FILE = "story/state/relations.json";
          let existingRelations: CharacterRelation[] = [];
          try {
            const raw = await readFile(join(dir, RELATIONS_FILE), "utf-8");
            const parsed = RelationsFileSchema.parse(JSON.parse(raw));
            existingRelations = parsed.relations;
          } catch {
            // File doesn't exist or is corrupt — use empty state
          }

          // Load character names from book.json
          const bookConfigPath = join(dir, "book.json");
          let characterNames: string[] = [];
          try {
            const bookConfigRaw = await readFile(bookConfigPath, "utf-8");
            const bookConfig = JSON.parse(bookConfigRaw) as Record<string, unknown>;
            const characters = bookConfig.characters;
            if (Array.isArray(characters)) {
              characterNames = characters
                .filter(
                  (c): c is string | Record<string, unknown> =>
                    typeof c === "string" || (typeof c === "object" && c !== null),
                )
                .map((c) =>
                  typeof c === "string"
                    ? c
                    : String((c as Record<string, unknown>).name ?? ""),
                )
                .filter((name) => name.length > 0);
            }
          } catch {
            // Character names are optional context
          }

          const result = await extractRelationsFromProse(prose, existingRelations, {
            llmConfig,
            characterNames,
            chapterNumbers,
          });

          return c.json({
            success: true,
            data: {
              proposals: result.proposals,
              sourceChapters: result.sourceChapters,
              sourceCharacters: result.sourceCharacters,
              existingRelationsCount: existingRelations.length,
            },
          });
        }

        // ── Style Analysis ──
        case "extract-style": {
          const p = (params ?? {}) as Record<string, unknown>;
          const texts: string[] = Array.isArray(p.texts)
            ? (p.texts as string[]).filter((t): t is string => typeof t === "string" && t.trim().length > 0)
            : [];

          if (texts.length === 0 && text && typeof text === "string" && text.trim()) {
            texts.push(text);
          }

          if (texts.length === 0) {
            throw new ApiError(400, "MISSING_TEXT", "style 分析需要 texts 数组或 text 字符串");
          }

          const language =
            typeof p.language === "string" && (p.language === "en" || p.language === "zh")
              ? p.language
              : "zh";

          const profile = learnStyle(texts, language);
          const { serializeStyleProfile, summarizeStyleProfile } = await import("@actalk/inkchain-core");

          return c.json({
            success: true,
            data: {
              profile: {
                ...serializeStyleProfile(profile),
                id: p.id ?? `profile-${Date.now()}`,
                autoAnalyzed: true,
                language,
              },
              summary: summarizeStyleProfile(profile),
            },
          });
        }

        default:
          throw new ApiError(400, "UNKNOWN_SKILL", `未知的 skillId: "${skillId}"`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        return c.json(
          {
            success: false,
            data: null,
            error: { code: err.code, message: err.message },
          },
          err.status,
        );
      }
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: "EXTRACT_ERROR",
            message: err instanceof Error ? err.message : String(err),
          },
        },
        500,
      );
    }
  });

  return router;
}
