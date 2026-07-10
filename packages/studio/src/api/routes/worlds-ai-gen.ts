// ── World AI Generation Route (Issue #102 — P3-1) ──
//
// AI-assisted generation of world-building content based on WorldConfig.
//
// Routes:
//   POST /api/worlds/:id/generate — Generate content (chapter/character/event)
//   POST /api/worlds/:id/generate/confirm — Confirm and save generated content
//
// The route factory wraps the core world-generator prompt builders and
// response parsers, adding LLM integration and persistence logic.

import { Hono } from "hono";
import {
  createLLMClient,
  chatCompletion,
  loadProjectConfig,
  loadWorld,
  saveWorld,
  buildChapterGeneratePrompt,
  buildCharacterGeneratePrompt,
  buildEventGeneratePrompt,
  parseChapterResponse,
  parseCharacterResponse,
  parseEventResponse,
  generateEntityId,
  applyWorldUpdate,
} from "@actalk/inkchain-core";

// ── Request body types ──

type GenerateType = "chapter" | "character" | "event";
const VALID_TYPES: readonly GenerateType[] = ["chapter", "character", "event"];

interface GenerateBody {
  type: GenerateType;
  creativity?: number;
  length?: number;
  style?: string;
  referenceDimensions?: string[];
}

interface ConfirmBody {
  type: GenerateType;
  confirmedItems: Record<string, unknown>[];
}

// ── Simple validators ──

function isValidType(v: unknown): v is GenerateType {
  return typeof v === "string" && (VALID_TYPES as readonly string[]).includes(v);
}

function isNumberInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && !Number.isNaN(v) && v >= min && v <= max && Number.isInteger(v);
}

function parseGenerateBody(raw: unknown): { ok: true; data: GenerateBody } | { ok: false; message: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, message: "请求体必须是 JSON 对象" };
  }
  const body = raw as Record<string, unknown>;

  if (!isValidType(body.type)) {
    return { ok: false, message: "type 必须是 chapter/character/event" };
  }

  if (body.creativity !== undefined && !isNumberInRange(body.creativity, 1, 10)) {
    return { ok: false, message: "creativity 必须是 1-10 的整数" };
  }

  if (body.length !== undefined && !isNumberInRange(body.length, 100, 10000)) {
    return { ok: false, message: "length 必须是 100-10000 的整数" };
  }

  if (body.style !== undefined && typeof body.style !== "string") {
    return { ok: false, message: "style 必须是字符串" };
  }

  if (body.referenceDimensions !== undefined) {
    if (!Array.isArray(body.referenceDimensions)) {
      return { ok: false, message: "referenceDimensions 必须是数组" };
    }
    for (const dim of body.referenceDimensions) {
      if (typeof dim !== "string") {
        return { ok: false, message: "referenceDimensions 中的元素必须是字符串" };
      }
    }
  }

  return {
    ok: true,
    data: {
      type: body.type as GenerateType,
      creativity: isNumberInRange(body.creativity, 1, 10) ? body.creativity : 5,
      length: isNumberInRange(body.length, 100, 10000) ? body.length : 2000,
      style: typeof body.style === "string" ? body.style : "",
      referenceDimensions: Array.isArray(body.referenceDimensions)
        ? body.referenceDimensions.filter((d): d is string => typeof d === "string")
        : undefined,
    },
  };
}

// ── Route factory ──

export function createWorldsAIGenRouter(root: string): Hono {
  const app = new Hono();

  // POST /:id/generate — Generate content from world settings
  app.post("/:id/generate", async (c) => {
    const worldId = c.req.param("id");

    // Validate request body
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    const parsed = parseGenerateBody(body);
    if (!parsed.ok) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: parsed.message } }, 400);
    }

    const { type } = parsed.data;
    const creativity = parsed.data.creativity ?? 5;
    const length = parsed.data.length ?? 2000;
    const style = parsed.data.style ?? "";
    const referenceDimensions = parsed.data.referenceDimensions ?? ["settings", "roles", "relations", "regions", "institutions", "history", "rules"];

    // Load world
    const world = await loadWorld(root, worldId);
    if (!world) {
      return c.json({ error: { code: "NOT_FOUND", message: "世界观不存在" } }, 404);
    }

    // Load LLM config
    const config = await loadProjectConfig(root, { consumer: "studio", requireApiKey: false });

    // Build generation params
    const genParams = {
      creativity,
      length,
      style,
      referenceDimensions,
    };

    try {
      // Build prompt based on type
      let systemPrompt: string;
      let userPrompt: string;

      if (type === "chapter") {
        const result = buildChapterGeneratePrompt(world, genParams);
        systemPrompt = result.system;
        userPrompt = result.user;
      } else if (type === "character") {
        const result = buildCharacterGeneratePrompt(world, genParams);
        systemPrompt = result.system;
        userPrompt = result.user;
      } else {
        const result = buildEventGeneratePrompt(world, genParams);
        systemPrompt = result.system;
        userPrompt = result.user;
      }

      const client = createLLMClient(config.llm);
      const response = await chatCompletion(client, config.llm.model, [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ], { temperature: creativity / 10, maxTokens: Math.max(8192, length * 4) });

      const text = response.content.trim();

      // Parse response based on type
      let candidates: unknown[];
      if (type === "chapter") {
        candidates = parseChapterResponse(text, text);
      } else if (type === "character") {
        candidates = parseCharacterResponse(text, text);
      } else {
        candidates = parseEventResponse(text, text);
      }

      if (candidates.length === 0) {
        return c.json({
          error: { code: "PARSE_ERROR", message: "AI 返回的格式无法解析" },
          raw: text.substring(0, 2000),
        }, 422);
      }

      return c.json({
        candidates,
        worldId: world.id,
        worldName: world.name,
        type,
        raw: text.substring(0, 500),
      });
    } catch (err) {
      return c.json({
        error: { code: "LLM_ERROR", message: err instanceof Error ? err.message : String(err) },
      }, 500);
    }
  });

  // POST /:id/generate/confirm — Confirm AI-generated content and save to world
  app.post("/:id/generate/confirm", async (c) => {
    const worldId = c.req.param("id");

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    if (typeof body !== "object" || body === null) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "请求体必须是 JSON 对象" } }, 400);
    }

    const raw = body as Record<string, unknown>;
    if (!isValidType(raw.type)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "type 必须是 chapter/character/event" } }, 400);
    }
    if (!Array.isArray(raw.confirmedItems)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "confirmedItems 必须是数组" } }, 400);
    }

    const type = raw.type as GenerateType;
    const confirmedItems = raw.confirmedItems as Record<string, unknown>[];

    const world = await loadWorld(root, worldId);
    if (!world) {
      return c.json({ error: { code: "NOT_FOUND", message: "世界观不存在" } }, 404);
    }

    try {
      if (type === "character") {
        type WorldRoleKind = "主角" | "配角" | "反派" | "中立";
        const VALID_ROLES: readonly WorldRoleKind[] = ["主角", "配角", "反派", "中立"];
        const newRoles = confirmedItems.map((item: Record<string, unknown>) => {
          const rawRole = String(item.role ?? "配角");
          const role: WorldRoleKind = (VALID_ROLES as readonly string[]).includes(rawRole) ? rawRole as WorldRoleKind : "配角";
          return {
            id: generateEntityId("role"),
            name: String(item.name ?? "未命名"),
            role,
            description: String(item.description ?? ""),
            significance: Math.min(5, Math.max(1, Number(item.significance ?? 3))),
            sortIndex: world.roles.length + 1,
            institutionIds: [] as string[],
            regionIds: [] as string[],
          };
        });
        const updated = applyWorldUpdate(world, {
          ...world,
          roles: [...world.roles, ...newRoles],
        });
        await saveWorld(root, updated);
        return c.json({ saved: newRoles.length, items: newRoles });
      }

      if (type === "event") {
        const newEvents = confirmedItems.map((item: Record<string, unknown>) => ({
          id: generateEntityId("evt"),
          title: String(item.title ?? "未命名事件"),
          timestamp: String(item.timestamp ?? ""),
          description: String(item.description ?? ""),
          significance: Math.min(5, Math.max(1, Number(item.significance ?? 3))),
          sortIndex: world.history.length + 1,
          affectedRegions: Array.isArray(item.affectedRegions) ? item.affectedRegions.map(String) : [],
        }));
        const updated = applyWorldUpdate(world, {
          ...world,
          history: [...world.history, ...newEvents],
        });
        await saveWorld(root, updated);
        return c.json({ saved: newEvents.length, items: newEvents });
      }

      // type === "chapter"
      return c.json({
        saved: confirmedItems.length,
        message: "章节候选已记录，请使用写作面板继续完善",
        items: confirmedItems,
      });
    } catch (err) {
      return c.json({
        error: { code: "SAVE_ERROR", message: err instanceof Error ? err.message : String(err) },
      }, 500);
    }
  });

  return app;
}
