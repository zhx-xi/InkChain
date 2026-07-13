import { mkdir, mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStudioServer } from "../server.js";

describe("Agent Team Config API (Issue #197 — GET/PUT /api/v1/project/agent-team)", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "inkos-agent-team-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("GET returns default config when no file exists", async () => {
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/v1/project/agent-team");
    expect(res.status).toBe(200);
    const json = await res.json() as { config: { agents: Array<{ role: string; enabled: boolean }>; collaborationMode: string; schemaVersion: string } };
    expect(json.config.agents).toHaveLength(7);
    expect(json.config.agents.every((a) => a.enabled)).toBe(true);
    expect(json.config.collaborationMode).toBe("sequential");
    expect(json.config.schemaVersion).toBe("1");
  });

  it("GET returns 7 agents with correct roles", async () => {
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/v1/project/agent-team");
    const json = await res.json() as { config: { agents: Array<{ role: string }> } };
    const roles = json.config.agents.map((a) => a.role).sort();
    expect(roles).toEqual([
      "architect", "auditor", "editor", "observer", "planner", "reviser", "writer",
    ]);
  });

  it("GET returns saved config from file", async () => {
    const configDir = join(root, ".inkos");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "agent-team.json"),
      JSON.stringify({
        schemaVersion: "1",
        agents: [
          { role: "writer", enabled: true },
          { role: "architect", enabled: false },
        ],
        collaborationMode: "parallel",
      }),
      "utf-8",
    );

    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/v1/project/agent-team");
    expect(res.status).toBe(200);
    const json = await res.json() as { config: { agents: Array<{ role: string; enabled: boolean }>; collaborationMode: string } };
    expect(json.config.agents.find((a) => a.role === "writer")?.enabled).toBe(true);
    expect(json.config.agents.find((a) => a.role === "architect")?.enabled).toBe(false);
    expect(json.config.collaborationMode).toBe("parallel");
  });

  it("PUT saves config and returns it", async () => {
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/v1/project/agent-team", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schemaVersion: "1",
        agents: [
          { role: "writer", enabled: true },
          { role: "architect", enabled: false },
          { role: "planner", enabled: true },
          { role: "editor", enabled: true },
          { role: "auditor", enabled: true },
          { role: "observer", enabled: false },
          { role: "reviser", enabled: true },
        ],
        collaborationMode: "hybrid",
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { config: { agents: Array<{ role: string; enabled: boolean }>; ok?: boolean } };
    expect(json.config).toBeDefined();
    expect(json.ok).toBe(true);
  });

  it("PUT persists config to disk — GET returns saved values", async () => {
    const app = createStudioServer({} as never, root);

    await app.request("/api/v1/project/agent-team", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schemaVersion: "1",
        agents: [
          { role: "writer", enabled: false },
          { role: "architect", enabled: false },
          { role: "planner", enabled: false },
          { role: "editor", enabled: false },
          { role: "auditor", enabled: false },
          { role: "observer", enabled: false },
          { role: "reviser", enabled: false },
        ],
        collaborationMode: "sequential",
      }),
    });

    const res = await app.request("/api/v1/project/agent-team");
    const json = await res.json() as { config: { agents: Array<{ role: string; enabled: boolean }> } };
    expect(json.config.agents.every((a) => a.enabled === false)).toBe(true);
  });

  it("PUT validates config — missing required fields return 400", async () => {
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/v1/project/agent-team", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: true }),
    });
    expect(res.status).toBe(400);
  });

  it("PUT 400 on invalid JSON body", async () => {
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/v1/project/agent-team", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    expect(res.status).toBe(400);
  });

  it("PUT creates .inkos/agent-team.json on disk", async () => {
    const app = createStudioServer({} as never, root);

    await app.request("/api/v1/project/agent-team", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schemaVersion: "1",
        agents: [
          { role: "writer", enabled: true },
          { role: "architect", enabled: true },
          { role: "planner", enabled: true },
          { role: "editor", enabled: false },
          { role: "auditor", enabled: true },
          { role: "observer", enabled: false },
          { role: "reviser", enabled: true },
        ],
        collaborationMode: "sequential",
      }),
    });

    const filePath = join(root, ".inkos", "agent-team.json");
    const content = JSON.parse(await readFile(filePath, "utf-8"));
    expect(content.schemaVersion).toBe("1");
    expect(content.collaborationMode).toBe("sequential");
    expect(content.agents).toHaveLength(7);
  });
});
