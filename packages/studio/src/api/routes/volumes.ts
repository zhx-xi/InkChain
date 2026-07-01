import { Hono } from "hono";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// ── Inline type definitions ──
// Schema validation is handled by @actalk/inkos-core VolumeSchema after PR #106 is merged.
// For now, use simple runtime type checks.

type VolumeStatus = "draft" | "active" | "completed";

interface Volume {
  id: string;
  title: string;
  description: string;
  status: VolumeStatus;
  order: number;
  createdAt: string;
  updatedAt: string;
}

const VALID_STATUSES: VolumeStatus[] = ["draft", "active", "completed"];

function isValidStatus(s: unknown): s is VolumeStatus {
  return typeof s === "string" && VALID_STATUSES.includes(s as VolumeStatus);
}

function isString(s: unknown): s is string {
  return typeof s === "string";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseVolumes(raw: unknown): Volume[] {
  if (!Array.isArray(raw)) return [];
  const volumes: Volume[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = item.id;
    const title = item.title;
    const description = item.description ?? "";
    const status = item.status;
    const order = item.order;
    if (isString(id) && isString(title) && typeof order === "number") {
      volumes.push({
        id,
        title,
        description: isString(description) ? description : "",
        status: isValidStatus(status) ? status : "draft",
        order: Math.max(0, Math.floor(order)),
        createdAt: isString(item.createdAt) ? item.createdAt : new Date().toISOString(),
        updatedAt: isString(item.updatedAt) ? item.updatedAt : new Date().toISOString(),
      });
    }
  }
  volumes.sort((a, b) => a.order - b.order);
  return volumes;
}

interface PartialVolumeInput {
  title?: string;
  description?: string;
  status?: string;
  order?: number;
}

function parsePartialVolumeInput(body: Record<string, unknown>): PartialVolumeInput | null {
  const title = body.title;
  const description = body.description;
  const status = body.status;
  const order = body.order;

  // At least one field must be valid
  if (
    (title !== undefined && !isString(title)) ||
    (description !== undefined && !isString(description)) ||
    (status !== undefined && !isValidStatus(status)) ||
    (order !== undefined && typeof order !== "number")
  ) {
    return null;
  }

  return {
    title: isString(title) ? title : undefined,
    description: isString(description) ? description : undefined,
    status: isValidStatus(status) ? status : undefined,
    order: typeof order === "number" ? Math.max(0, Math.floor(order)) : undefined,
  };
}

interface VolumesFile {
  schemaVersion: string;
  volumes: Volume[];
}

const VOLUMES_FILE = "story/state/volumes.json";

async function loadVolumes(bookDir: string): Promise<VolumesFile> {
  try {
    const raw = await readFile(join(bookDir, VOLUMES_FILE), "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const volumes = parseVolumes(parsed.volumes);
    return { schemaVersion: isString(parsed.schemaVersion) ? parsed.schemaVersion : "1", volumes };
  } catch {
    return { schemaVersion: "1", volumes: [] };
  }
}

async function saveVolumes(bookDir: string, data: VolumesFile): Promise<void> {
  const dir = join(bookDir, "story", "state");
  await mkdir(dir, { recursive: true });
  await writeFile(join(bookDir, VOLUMES_FILE), JSON.stringify(data, null, 2), "utf-8");
}

// ── Route factory ──

export function createVolumesRouter(bookDir: (id: string) => string) {
  const router = new Hono();

  // GET /:id/volumes — list all volumes
  router.get("/:id/volumes", async (c) => {
    const id = c.req.param("id");
    const dir = bookDir(id);
    const data = await loadVolumes(dir);
    return c.json({ volumes: data.volumes });
  });

  // POST /:id/volumes — create a new volume
  router.post("/:id/volumes", async (c) => {
    const id = c.req.param("id");
    const dir = bookDir(id);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    if (!isRecord(body)) {
      return c.json({ error: { code: "INVALID_BODY", message: "请求体必须是对象" } }, 400);
    }

    const input = parsePartialVolumeInput(body);
    if (!input) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "校验失败：title 必须是字符串" } }, 400);
    }

    const now = new Date().toISOString();
    const data = await loadVolumes(dir);
    const maxOrder = data.volumes.reduce((max, v) => Math.max(max, v.order), -1);

    const volume: Volume = {
      id: randomUUID(),
      title: input.title ?? "新建分卷",
      description: input.description ?? "",
      status: (input.status as VolumeStatus) ?? "draft",
      order: input.order ?? maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };

    data.volumes.push(volume);
    await saveVolumes(dir, data);
    return c.json({ volume }, 201);
  });

  // PUT /:id/volumes/:volumeId — update a volume
  router.put("/:id/volumes/:volumeId", async (c) => {
    const id = c.req.param("id");
    const volumeId = c.req.param("volumeId");
    const dir = bookDir(id);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    if (!isRecord(body)) {
      return c.json({ error: { code: "INVALID_BODY", message: "请求体必须是对象" } }, 400);
    }

    const input = parsePartialVolumeInput(body);
    if (!input) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "校验失败" } }, 400);
    }

    const data = await loadVolumes(dir);
    const idx = data.volumes.findIndex((v) => v.id === volumeId);
    if (idx === -1) {
      return c.json({ error: { code: "NOT_FOUND", message: `分卷 ${volumeId} 不存在` } }, 404);
    }

    data.volumes[idx] = {
      ...data.volumes[idx],
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status as VolumeStatus } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
      id: volumeId,
      updatedAt: new Date().toISOString(),
    };
    await saveVolumes(dir, data);
    return c.json({ volume: data.volumes[idx] });
  });

  // DELETE /:id/volumes/:volumeId — delete a volume
  router.delete("/:id/volumes/:volumeId", async (c) => {
    const id = c.req.param("id");
    const volumeId = c.req.param("volumeId");
    const dir = bookDir(id);

    const data = await loadVolumes(dir);
    const idx = data.volumes.findIndex((v) => v.id === volumeId);
    if (idx === -1) {
      return c.json({ error: { code: "NOT_FOUND", message: `分卷 ${volumeId} 不存在` } }, 404);
    }

    data.volumes.splice(idx, 1);
    await saveVolumes(dir, data);
    return c.json({ deleted: true });
  });

  // PATCH /:id/volumes/reorder — reorder volumes
  router.patch("/:id/volumes/reorder", async (c) => {
    const id = c.req.param("id");
    const dir = bookDir(id);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    if (!isRecord(body) || !Array.isArray(body.volumeIds) || body.volumeIds.some((v: unknown) => !isString(v))) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "校验失败，需要提供 volumeIds: string[]" } }, 400);
    }

    const volumeIds = body.volumeIds as string[];
    const data = await loadVolumes(dir);
    const existingIds = new Set(data.volumes.map((v) => v.id));
    for (const vid of volumeIds) {
      if (!existingIds.has(vid)) {
        return c.json({ error: { code: "NOT_FOUND", message: `分卷 ${vid} 不存在` } }, 404);
      }
    }

    const volumeMap = new Map(data.volumes.map((v) => [v.id, v]));
    const reordered: Volume[] = volumeIds.map((vid, order) => ({
      ...volumeMap.get(vid)!,
      order,
      updatedAt: new Date().toISOString(),
    }));

    for (const v of data.volumes) {
      if (!volumeIds.includes(v.id)) {
        reordered.push(v);
      }
    }

    await saveVolumes(dir, { schemaVersion: data.schemaVersion, volumes: reordered });
    return c.json({ volumes: reordered });
  });

  // PATCH /:id/chapters/:num/volume — update a chapter's volumeId
  router.patch("/:id/chapters/:num/volume", async (c) => {
    const id = c.req.param("id");
    const num = parseInt(c.req.param("num"), 10);
    const dir = bookDir(id);
    const chaptersDir = join(dir, "story", "chapters");
    const indexPath = join(chaptersDir, "index.json");

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    if (!isRecord(body)) {
      return c.json({ error: { code: "INVALID_BODY", message: "请求体必须是对象" } }, 400);
    }

    const volumeId = body.volumeId;
    if (volumeId !== null && !isString(volumeId)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "volumeId 必须是字符串或 null" } }, 400);
    }

    // Validate volume exists (if volumeId is not null)
    if (volumeId !== null) {
      const volData = await loadVolumes(dir);
      if (!volData.volumes.some((v) => v.id === volumeId)) {
        return c.json({ error: { code: "NOT_FOUND", message: `分卷 ${volumeId} 不存在` } }, 404);
      }
    }

    // Load chapter index
    let chapterIndex: { chapters: Array<Record<string, unknown>> };
    try {
      const raw = await readFile(indexPath, "utf-8");
      chapterIndex = JSON.parse(raw) as { chapters: Array<Record<string, unknown>> };
    } catch {
      return c.json({ error: { code: "NOT_FOUND", message: "章节索引文件不存在" } }, 404);
    }

    const chIdx = chapterIndex.chapters.findIndex(
      (ch) => typeof ch.number === "number" && ch.number === num,
    );
    if (chIdx === -1) {
      return c.json({ error: { code: "NOT_FOUND", message: `章节 ${num} 不存在` } }, 404);
    }

    // Update volumeId
    chapterIndex.chapters[chIdx] = {
      ...chapterIndex.chapters[chIdx],
      volumeId: volumeId as string | null,
      updatedAt: new Date().toISOString(),
    };

    await mkdir(chaptersDir, { recursive: true });
    await writeFile(indexPath, JSON.stringify(chapterIndex, null, 2), "utf-8");

    return c.json({
      ok: true,
      chapterNumber: num,
      volumeId,
    });
  });

  // GET /:id/volumes/:volumeId/chapters — list chapters in a volume
  router.get("/:id/volumes/:volumeId/chapters", async (c) => {
    const id = c.req.param("id");
    const volumeId = c.req.param("volumeId");
    const dir = bookDir(id);

    const data = await loadVolumes(dir);
    if (!data.volumes.some((v) => v.id === volumeId)) {
      return c.json({ error: { code: "NOT_FOUND", message: `分卷 ${volumeId} 不存在` } }, 404);
    }

    let chapters: Array<{ number: number; title: string; status: string; wordCount: number; volumeId: string | null }> = [];
    try {
      const raw = await readFile(join(dir, "story", "chapters", "index.json"), "utf-8");
      const allChapters = JSON.parse(raw) as Record<string, unknown>;
      chapters = (Array.isArray(allChapters.chapters) ? allChapters.chapters : []).filter(
        (ch: unknown) => isRecord(ch) && (ch.volumeId ?? null) === volumeId,
      ) as typeof chapters;
    } catch {
      // Chapters index doesn't exist
    }

    return c.json({ volumeId, chapters });
  });

  return router;
}
