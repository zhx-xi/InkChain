// ── Agent Team Templates API (Issue #223, Phase 1) ──
//
// Project-level Agent Team templates — presets that users can save, load, edit, and delete.
// Storage: `.inkos/agent-templates.json`
//
// Routes (mounted at /api/v1/agent-templates):
//   GET    /         — List all templates
//   POST   /         — Create a new template (name, description, config)
//   PUT    /:id      — Update an existing template
//   DELETE /:id      — Delete a template

import { Hono } from "hono";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ApiError } from "../errors.js";
import { DATA_DIR_NAME } from "../../constants/data-directory.js";

// ── Types ──

interface AgentTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly preset: string;
  readonly config: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface CreateTemplatePayload {
  name: string;
  description: string;
  preset: string;
  config: Record<string, unknown>;
}

interface UpdateTemplatePayload {
  name?: string;
  description?: string;
  preset?: string;
  config?: Record<string, unknown>;
}

// ── Validation helpers ──

function validateString(value: unknown, field: string, maxLen = 100): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} must be a non-empty string`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLen) {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} must be at most ${maxLen} characters`);
  }
  return trimmed;
}

function validateOptionalString(value: unknown, maxLen = 500): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "Value must be a string");
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLen) {
    throw new ApiError(400, "VALIDATION_ERROR", `Value must be at most ${maxLen} characters`);
  }
  return trimmed;
}

function validateOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Value must be an object");
  }
  return value as Record<string, unknown>;
}

// ── Storage ──

function templatesFilePath(root: string): string {
  return join(root, DATA_DIR_NAME, "agent-templates.json");
}

async function loadTemplates(root: string): Promise<AgentTemplate[]> {
  const filePath = templatesFilePath(root);
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as AgentTemplate[];
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

async function saveTemplates(root: string, templates: AgentTemplate[]): Promise<void> {
  await mkdir(join(root, DATA_DIR_NAME), { recursive: true });
  await writeFile(templatesFilePath(root), JSON.stringify(templates, null, 2), "utf-8");
}

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `tmpl_${timestamp}_${random}`;
}

function parseCreatePayload(body: unknown): CreateTemplatePayload {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be an object");
  }
  const data = body as Record<string, unknown>;
  return {
    name: validateString(data.name, "name", 100),
    description: validateOptionalString(data.description, 500) ?? "",
    preset: validateString(data.preset, "preset", 50),
    config: validateOptionalRecord(data.config) ?? {},
  };
}

function parseUpdatePayload(body: unknown): UpdateTemplatePayload {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be an object");
  }
  const data = body as Record<string, unknown>;
  const hasAnyField = "name" in data || "description" in data || "preset" in data || "config" in data;
  if (!hasAnyField) {
    throw new ApiError(400, "VALIDATION_ERROR", "At least one field (name, description, preset, config) must be provided");
  }
  return {
    name: "name" in data ? validateString(data.name, "name", 100) : undefined,
    description: validateOptionalString(data.description, 500),
    preset: "preset" in data ? validateString(data.preset, "preset", 50) : undefined,
    config: validateOptionalRecord(data.config),
  };
}

// ── Router ──

export function createAgentTemplatesRouter(root: string) {
  const router = new Hono();

  // GET / — List all templates
  router.get("/", async (c) => {
    const templates = await loadTemplates(root);
    return c.json({ templates });
  });

  // GET /:id — Get a single template
  router.get("/:id", async (c) => {
    const id = c.req.param("id");
    const templates = await loadTemplates(root);
    const template = templates.find((t) => t.id === id);
    if (!template) {
      throw new ApiError(404, "TEMPLATE_NOT_FOUND", `Template "${id}" not found`);
    }
    return c.json({ template });
  });

  // POST / — Create a new template
  router.post("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const payload = parseCreatePayload(body);

    const now = new Date().toISOString();
    const newTemplate: AgentTemplate = {
      id: generateId(),
      name: payload.name,
      description: payload.description,
      preset: payload.preset,
      config: payload.config,
      createdAt: now,
      updatedAt: now,
    };

    const templates = await loadTemplates(root);
    templates.push(newTemplate);
    await saveTemplates(root, templates);

    return c.json({ template: newTemplate }, 201);
  });

  // PUT /:id — Update an existing template
  router.put("/:id", async (c) => {
    const id = c.req.param("id");

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const payload = parseUpdatePayload(body);

    const templates = await loadTemplates(root);
    const index = templates.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new ApiError(404, "TEMPLATE_NOT_FOUND", `Template "${id}" not found`);
    }

    const existing = templates[index];
    const now = new Date().toISOString();
    const updated: AgentTemplate = {
      ...existing,
      name: (payload.name ?? existing.name) as string,
      description: payload.description ?? existing.description,
      preset: (payload.preset ?? existing.preset) as string,
      config: (payload.config ?? existing.config) as Record<string, unknown>,
      updatedAt: now,
    };
    templates[index] = updated;
    await saveTemplates(root, templates);

    return c.json({ template: updated });
  });

  // DELETE /:id — Delete a template
  router.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const templates = await loadTemplates(root);
    const index = templates.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new ApiError(404, "TEMPLATE_NOT_FOUND", `Template "${id}" not found`);
    }

    templates.splice(index, 1);
    await saveTemplates(root, templates);

    return c.json({ ok: true });
  });

  return router;
}
