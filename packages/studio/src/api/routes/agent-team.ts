// ── Agent Team Config API (Issue #197) ──
//
// Project-level Agent Team configuration. Config is stored as `.inkos/agent-team.json`.
//
// Routes (mounted at /api/project/agent-team):
//   GET  /     — Get current Agent Team config (returns defaults if no file exists)
//   PUT  /     — Save Agent Team config

import { Hono } from "hono";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  AgentTeamConfigSchema,
  type AgentTeamConfig,
} from "@actalk/inkchain-core";
import { ApiError } from "../errors.js";
import { DATA_DIR_NAME } from "../../constants/data-directory.js";

const DEFAULT_AGENT_ROLES = [
  "writer", "architect", "planner", "editor", "auditor", "observer", "reviser",
] as const;

function defaultAgentTeamConfig(): AgentTeamConfig {
  return {
    schemaVersion: "1",
    agents: DEFAULT_AGENT_ROLES.map((role) => ({
      role,
      enabled: true,
    })),
    collaborationMode: "sequential",
  };
}

function agentTeamConfigPath(root: string): string {
  return join(root, DATA_DIR_NAME, "agent-team.json");
}

async function loadAgentTeamConfig(root: string): Promise<AgentTeamConfig> {
  const filePath = agentTeamConfigPath(root);
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const result = AgentTeamConfigSchema.safeParse(parsed);
    if (result.success) return result.data;
    // If validation fails, merge valid data with defaults
    return { ...defaultAgentTeamConfig(), ...result.data };
  } catch (error) {
    if (
      typeof error === "object"
      && error !== null
      && "code" in error
      && (error as { code?: unknown }).code === "ENOENT"
    ) {
      return defaultAgentTeamConfig();
    }
    throw error;
  }
}

async function saveAgentTeamConfig(root: string, config: AgentTeamConfig): Promise<void> {
  await mkdir(join(root, DATA_DIR_NAME), { recursive: true });
  await writeFile(agentTeamConfigPath(root), JSON.stringify(config, null, 2), "utf-8");
}

export function createAgentTeamRouter(root: string) {
  const router = new Hono();

  // GET /api/project/agent-team — get current config
  router.get("/", async (c) => {
    const config = await loadAgentTeamConfig(root);
    return c.json({ config });
  });

  // PUT /api/project/agent-team — save config
  router.put("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const parsed = AgentTeamConfigSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Agent team config validation failed",
          details: parsed.error.flatten(),
        },
      }, 400);
    }

    await saveAgentTeamConfig(root, parsed.data);
    return c.json({ config: parsed.data, ok: true });
  });

  return router;
}
