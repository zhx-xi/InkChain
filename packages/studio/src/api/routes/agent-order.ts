// ── Agent Order API (Issue #233, Phase 2) ──
//
// Stores the display order of all agents (built-in + custom) as an ordered array
// of agent IDs (roles for built-in, IDs for custom).
// Storage: `.inkos/agent-order.json`
//
// Routes (mounted at /api/v1/agent-order):
//   GET  /     — Get current agent order
//   PUT  /     — Save agent order

import { Hono } from "hono";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ApiError } from "../errors.js";
import { DATA_DIR_NAME } from "../../constants/data-directory.js";

// ── Storage ──

function orderFilePath(root: string): string {
  return join(root, DATA_DIR_NAME, "agent-order.json");
}

async function loadOrder(root: string): Promise<readonly string[]> {
  const filePath = orderFilePath(root);
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch (error) {
    if (
      typeof error === "object"
      && error !== null
      && "code" in error
      && (error as { code?: unknown }).code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }
}

async function saveOrder(root: string, order: readonly string[]): Promise<void> {
  await mkdir(join(root, DATA_DIR_NAME), { recursive: true });
  await writeFile(orderFilePath(root), JSON.stringify(order, null, 2), "utf-8");
}

// ── Router ──

export function createAgentOrderRouter(root: string) {
  const router = new Hono();

  // GET / — Get current order
  router.get("/", async (c) => {
    const order = await loadOrder(root);
    return c.json({ order });
  });

  // PUT / — Save order
  router.put("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    if (typeof body !== "object" || body === null) {
      throw new ApiError(400, "VALIDATION_ERROR", "Body must be an object");
    }

    const data = body as Record<string, unknown>;
    const order = data.order;

    if (!Array.isArray(order)) {
      throw new ApiError(400, "VALIDATION_ERROR", "order must be an array of strings");
    }

    for (const item of order) {
      if (typeof item !== "string" || !item.trim()) {
        throw new ApiError(400, "VALIDATION_ERROR", "Each item in order must be a non-empty string");
      }
    }

    const cleanOrder = order.map((s: string) => s.trim());
    await saveOrder(root, cleanOrder);

    return c.json({ order: cleanOrder, ok: true });
  });

  return router;
}
