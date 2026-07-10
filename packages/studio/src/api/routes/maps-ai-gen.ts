// ── Map AI Generation Route (Issue #269 — P3-2) ──
//
// AI-assisted generation and image-recognition of map regions.
//
// Routes:
//   POST /api/worlds/:id/map/generate — AI generate regions from world config
//   POST /api/worlds/:id/map/confirm  — Confirm and save generated regions
//
// The route factory wraps the core map-generator prompt builders and
// response parsers, adding LLM integration and persistence logic.

import { Hono } from "hono";
import {
  createLLMClient,
  chatCompletion,
  loadProjectConfig,
  loadWorld,
  saveWorld,
  buildMapGeneratePrompt,
  parseMapGenerateResponse,
  generateRegionId,
  applyWorldUpdate,
} from "@actalk/inkchain-core";
import type { MapRegionCandidate } from "@actalk/inkchain-core";
import type { WorldRegion } from "@actalk/inkchain-core/models/world-config.js";

// ── Request Body Types ──

interface GenerateBody {
  /** Optional creativity override (1-10) */
  creativity?: number;
}

interface ConfirmBody {
  regions: MapRegionCandidate[];
}

// ── Validators ──

function parseGenerateBody(raw: unknown):
  | { ok: true; data: GenerateBody }
  | { ok: false; message: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, message: "请求体必须是 JSON 对象" };
  }
  const body = raw as Record<string, unknown>;

  if (body.creativity !== undefined) {
    if (typeof body.creativity !== "number" || Number.isNaN(body.creativity) || body.creativity < 1 || body.creativity > 10) {
      return { ok: false, message: "creativity 必须是 1-10 的数字" };
    }
  }

  return {
    ok: true,
    data: {
      creativity: typeof body.creativity === "number" ? body.creativity : 5,
    },
  };
}

function isValidRegion(r: unknown): r is MapRegionCandidate {
  if (typeof r !== "object" || r === null) return false;
  const region = r as Record<string, unknown>;
  return (
    typeof region.name === "string" &&
    region.name.length > 0 &&
    ["大陆", "国家", "城市", "地点"].includes(String(region.type))
  );
}

// ── Route Factory ──

export function createMapsAIGenRouter(root: string): Hono {
  const app = new Hono();

  // POST /:id/map/generate — AI generate map regions from world config
  app.post("/:id/map/generate", async (c) => {
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

    const creativity = parsed.data.creativity;

    // Load world
    const world = await loadWorld(root, worldId);
    if (!world) {
      return c.json({ error: { code: "NOT_FOUND", message: "世界观不存在" } }, 404);
    }

    // Load LLM config
    const config = await loadProjectConfig(root, { consumer: "studio", requireApiKey: false });

    try {
      // Build prompt
      const { system, user } = buildMapGeneratePrompt(world);

      const client = createLLMClient(config.llm);
      const response = await chatCompletion(client, config.llm.model, [
        { role: "system", content: system },
        { role: "user", content: user },
      ], { temperature: creativity / 10, maxTokens: 4096 });

      const text = response.content.trim();

      // Parse response
      const candidates = parseMapGenerateResponse(text, text);

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
        raw: text.substring(0, 500),
      });
    } catch (err) {
      return c.json({
        error: { code: "LLM_ERROR", message: err instanceof Error ? err.message : String(err) },
      }, 500);
    }
  });

  // POST /:id/map/confirm — Confirm AI-generated regions and save to world
  app.post("/:id/map/confirm", async (c) => {
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
    if (!Array.isArray(raw.regions)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "regions 必须是数组" } }, 400);
    }

    const regions = raw.regions as MapRegionCandidate[];
    const invalid = regions.find((r) => !isValidRegion(r));
    if (invalid) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: `区域 "${String((invalid as Record<string, unknown>).name)}" 数据不完整` } }, 400);
    }

    const world = await loadWorld(root, worldId);
    if (!world) {
      return c.json({ error: { code: "NOT_FOUND", message: "世界观不存在" } }, 404);
    }

    // Build name → id map for existing regions
    const nameToId = new Map<string, string>();
    for (const r of world.regions) {
      nameToId.set(r.name, r.id);
    }

    try {
      // First pass: create regions with existing parent references
      const nameToNewId = new Map<string, string>();
      const pendingParent: Array<{ region: WorldRegion; parentName: string }> = [];
      const newRegions: WorldRegion[] = regions.map((r) => {
        let parentId: string | null = null;
        if (r.parentName) {
          // Check existing regions first
          parentId = nameToId.get(r.parentName) ?? null;
          if (!parentId) {
            // Will resolve in second pass
            pendingParent.push({ region: null as unknown as WorldRegion, parentName: r.parentName });
          }
        }

        const newRegion: WorldRegion = {
          id: generateRegionId(),
          name: r.name,
          type: r.type,
          parentId,
          description: r.description,
          sortIndex: world.regions.length + 1,
          x: r.x,
          y: r.y,
        };
        nameToNewId.set(r.name, newRegion.id);
        return newRegion;
      });

      // Second pass: resolve parentId from newly created regions
      for (const nr of newRegions) {
        if (!nr.parentId) {
          const candidate = regions.find((br) => br.name === nr.name);
          if (candidate?.parentName) {
            nr.parentId = nameToNewId.get(candidate.parentName) ?? nameToId.get(candidate.parentName) ?? null;
          }
        }
      }

      const updated = applyWorldUpdate(world, {
        ...world,
        regions: [...world.regions, ...newRegions],
      });
      await saveWorld(root, updated);

      return c.json({ saved: newRegions.length, items: newRegions });
    } catch (err) {
      return c.json({
        error: { code: "SAVE_ERROR", message: err instanceof Error ? err.message : String(err) },
      }, 500);
    }
  });

  // POST /:id/map/image-analyze — Analyze an uploaded map image (requires image URL/description)
  // This is a simplified MVP version - accepts text description of the image
  app.post("/:id/map/image-analyze", async (c) => {
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
    const description = String(raw.description ?? "");
    if (!description.trim()) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "description 不能为空" } }, 400);
    }

    const world = await loadWorld(root, worldId);
    if (!world) {
      return c.json({ error: { code: "NOT_FOUND", message: "世界观不存在" } }, 404);
    }

    const config = await loadProjectConfig(root, { consumer: "studio", requireApiKey: false });

    try {
      const system = `你是一位地图分析专家。基于用户提供的地图文字描述，识别其中的地理区域。

要求：
- 识别地图上的所有区域
- 推断区域类型（大陆、国家、城市、地点）
- 估算每个区域在地图上的位置百分比 (0-100)
- 如果存在层级关系，通过 parentName 表示

请严格按照以下 JSON 格式返回：
\`\`\`json
[
  {
    "name": "区域名称",
    "type": "大陆|国家|城市|地点",
    "parentName": null,
    "description": "区域描述",
    "x": 50,
    "y": 50
  }
]
\`\`\`

返回纯 JSON，不要 markdown 包装`;

      const user = `地图描述：${description}`;

      const client = createLLMClient(config.llm);
      const response = await chatCompletion(client, config.llm.model, [
        { role: "system", content: system },
        { role: "user", content: user },
      ], { temperature: 0.3, maxTokens: 4096 });

      const text = response.content.trim();
      const candidates = parseMapGenerateResponse(text, text);

      if (candidates.length === 0) {
        return c.json({
          error: { code: "PARSE_ERROR", message: "AI 无法从描述中识别区域" },
          raw: text.substring(0, 2000),
        }, 422);
      }

      return c.json({
        candidates,
        worldId: world.id,
        worldName: world.name,
        raw: text.substring(0, 500),
      });
    } catch (err) {
      return c.json({
        error: { code: "LLM_ERROR", message: err instanceof Error ? err.message : String(err) },
      }, 500);
    }
  });

  return app;
}
