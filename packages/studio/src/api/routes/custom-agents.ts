// ── Custom Agents API (Issue #233, Phase 1) ──
//
// Custom agents that users can add, edit, and delete beyond the 7 hardcoded agents.
// Storage: `.inkos/custom-agents.json`
//
// Routes (mounted at /api/v1/custom-agents):
//   GET    /         — List all custom agents
//   POST   /         — Create a new custom agent
//   PUT    /:id      — Update an existing custom agent
//   DELETE /:id      — Delete a custom agent

import { Hono } from "hono";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ApiError } from "../errors.js";

// ── Types ──

export interface CustomAgent {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly description: string;
  readonly modelRouter?: string;
  readonly persona?: string;
  readonly skills?: ReadonlyArray<string>;
  readonly color: string;
  readonly icon: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface CreateCustomAgentPayload {
  name: string;
  role: string;
  description: string;
  modelRouter?: string;
  persona?: string;
  skills?: ReadonlyArray<string>;
  color: string;
  icon: string;
}

interface UpdateCustomAgentPayload {
  name?: string;
  role?: string;
  description?: string;
  modelRouter?: string;
  persona?: string;
  skills?: ReadonlyArray<string>;
  color?: string;
  icon?: string;
}

// ── Validation ──

const VALID_COLORS = [
  "#E88D3A", "#4A90D9", "#5CB85C", "#8B5CF6",
  "#9CA3AF", "#0EA5E9", "#EF4444", "#F59E0B",
  "#10B981", "#6366F1", "#EC4899", "#14B8A6",
] as const;

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

function validateOptionalString(value: unknown, maxLen = 200): string | undefined {
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

function validateOptionalColor(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "Color must be a string");
  }
  if (!VALID_COLORS.includes(value as typeof VALID_COLORS[number])) {
    throw new ApiError(400, "VALIDATION_ERROR", `Color must be one of: ${VALID_COLORS.join(", ")}`);
  }
  return value;
}

function validateOptionalIcon(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, "VALIDATION_ERROR", "Icon must be a non-empty string");
  }
  // Ensure icon is a single emoji or short text (1-4 chars)
  const trimmed = value.trim();
  if ([...trimmed].length > 4) {
    throw new ApiError(400, "VALIDATION_ERROR", "Icon must be at most 4 characters");
  }
  return trimmed;
}

function validateOptionalStringArray(value: unknown): ReadonlyArray<string> | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Skills must be an array");
  }
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "Each skill must be a non-empty string");
    }
  }
  return value.map((s: string) => s.trim());
}

// ── Storage ──

function customAgentsFilePath(root: string): string {
  return join(root, ".inkos", "custom-agents.json");
}

async function loadCustomAgents(root: string): Promise<CustomAgent[]> {
  const filePath = customAgentsFilePath(root);
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as CustomAgent[];
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

async function saveCustomAgents(root: string, agents: CustomAgent[]): Promise<void> {
  const dir = join(root, ".inkos");
  await mkdir(dir, { recursive: true });
  await writeFile(customAgentsFilePath(root), JSON.stringify(agents, null, 2), "utf-8");
}

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `agent_${timestamp}_${random}`;
}

function parseCreatePayload(body: unknown): CreateCustomAgentPayload {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be an object");
  }
  const data = body as Record<string, unknown>;
  return {
    name: validateString(data.name, "name", 100),
    role: validateString(data.role, "role", 50),
    description: validateOptionalString(data.description, 500) ?? "",
    modelRouter: validateOptionalString(data.modelRouter, 200),
    persona: validateOptionalString(data.persona, 500),
    skills: validateOptionalStringArray(data.skills),
    color: validateOptionalColor(data.color) ?? "#6366F1",
    icon: validateOptionalIcon(data.icon) ?? "🤖",
  };
}

function parseUpdatePayload(body: unknown): UpdateCustomAgentPayload {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be an object");
  }
  const data = body as Record<string, unknown>;
  const hasAnyField = "name" in data || "role" in data || "description" in data
    || "modelRouter" in data || "persona" in data || "skills" in data
    || "color" in data || "icon" in data;
  if (!hasAnyField) {
    throw new ApiError(400, "VALIDATION_ERROR", "At least one field must be provided for update");
  }
  return {
    name: "name" in data ? validateString(data.name, "name", 100) : undefined,
    role: "role" in data ? validateString(data.role, "role", 50) : undefined,
    description: validateOptionalString(data.description, 500),
    modelRouter: validateOptionalString(data.modelRouter, 200),
    persona: validateOptionalString(data.persona, 500),
    skills: validateOptionalStringArray(data.skills),
    color: validateOptionalColor(data.color),
    icon: validateOptionalIcon(data.icon),
  };
}

// ── Router ──

export function createCustomAgentsRouter(root: string) {
  const router = new Hono();

  // GET / — List all custom agents
  router.get("/", async (c) => {
    const agents = await loadCustomAgents(root);
    return c.json({ agents });
  });

  // GET /:id — Get a single custom agent
  router.get("/:id", async (c) => {
    const id = c.req.param("id");
    const agents = await loadCustomAgents(root);
    const agent = agents.find((a) => a.id === id);
    if (!agent) {
      throw new ApiError(404, "AGENT_NOT_FOUND", `Custom agent "${id}" not found`);
    }
    return c.json({ agent });
  });

  // POST / — Create a new custom agent
  router.post("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const payload = parseCreatePayload(body);

    const now = new Date().toISOString();
    const newAgent: CustomAgent = {
      id: generateId(),
      name: payload.name,
      role: payload.role,
      description: payload.description,
      modelRouter: payload.modelRouter,
      persona: payload.persona,
      skills: payload.skills,
      color: payload.color,
      icon: payload.icon,
      createdAt: now,
      updatedAt: now,
    };

    const agents = await loadCustomAgents(root);
    agents.push(newAgent);
    await saveCustomAgents(root, agents);

    return c.json({ agent: newAgent }, 201);
  });

  // PUT /:id — Update an existing custom agent
  router.put("/:id", async (c) => {
    const id = c.req.param("id");

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const payload = parseUpdatePayload(body);

    const agents = await loadCustomAgents(root);
    const index = agents.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new ApiError(404, "AGENT_NOT_FOUND", `Custom agent "${id}" not found`);
    }

    const existing = agents[index];
    const now = new Date().toISOString();
    const updated: CustomAgent = {
      ...existing,
      name: (payload.name ?? existing.name) as string,
      role: (payload.role ?? existing.role) as string,
      description: payload.description ?? existing.description,
      modelRouter: ("modelRouter" in payload ? payload.modelRouter : existing.modelRouter) as string | undefined,
      persona: ("persona" in payload ? payload.persona : existing.persona) as string | undefined,
      skills: ("skills" in payload ? payload.skills : existing.skills) as ReadonlyArray<string> | undefined,
      color: (payload.color ?? existing.color) as string,
      icon: (payload.icon ?? existing.icon) as string,
      updatedAt: now,
    };
    agents[index] = updated;
    await saveCustomAgents(root, agents);

    return c.json({ agent: updated });
  });

  // DELETE /:id — Delete a custom agent
  router.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const agents = await loadCustomAgents(root);
    const index = agents.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new ApiError(404, "AGENT_NOT_FOUND", `Custom agent "${id}" not found`);
    }

    agents.splice(index, 1);
    await saveCustomAgents(root, agents);

    return c.json({ ok: true });
  });

  return router;
}
