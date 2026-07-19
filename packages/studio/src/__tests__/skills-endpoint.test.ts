import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DATA_DIR_NAME } from "../constants/data-directory.js";
import { createStudioServer } from "../api/server.js";

describe("Studio skill endpoints", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "inkos-studio-skills-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("lists project skills as JSON files", async () => {
    await mkdir(join(root, DATA_DIR_NAME, "skills"), { recursive: true });
    await writeFile(
      join(root, DATA_DIR_NAME, "skills", "detective-play.json"),
      JSON.stringify({
        id: "detective-play",
        category: "utility",
        description: "Evidence-chain play skill.",
        triggers: [{ type: "condition", condition: "true" }],
        injection: { mode: "append", target: "system_prompt", priority: 50 },
        params: {},
        enabled: true,
        prompt: "Track evidence before twists.",
      }),
    );

    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/v1/skills");
    const json = await res.json() as { skills: Array<{ config: { id: string }; source: string }> };

    expect(res.status).toBe(200);
    expect(json.skills.map((skill) => skill.config.id)).toContainEqual("detective-play");
    expect(json.skills).toContainEqual(expect.objectContaining({
      config: expect.objectContaining({ id: "detective-play" }),
      source: "project",
    }));
  });

  it("creates, updates, and deletes project skills as JSON files", async () => {
    const app = createStudioServer({} as never, root);

    const createRes = await app.request("/api/v1/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "romance-play",
        category: "writing",
        description: "Relationship-focused play skill.",
        triggers: [{ type: "condition", condition: "true" }],
        injection: { mode: "append", target: "system_prompt", priority: 50 },
        params: {},
        enabled: true,
        prompt: "Keep emotional continuity visible.",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json() as { skill: { config: { id: string }; source: string } };
    expect(created.skill.config.id).toBe("romance-play");
    expect(created.skill.source).toBe("project");
    const filePath = join(root, DATA_DIR_NAME, "skills", "romance-play.json");
    const fileContent = await readFile(filePath, "utf-8");
    expect(fileContent).toContain("Keep emotional continuity visible.");

    const updateRes = await app.request("/api/v1/skills/romance-play", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "romance-play",
        category: "writing",
        description: "Updated description",
        triggers: [{ type: "condition", condition: "true" }],
        injection: { mode: "append", target: "system_prompt", priority: 50 },
        params: {},
        enabled: true,
        prompt: "Track longing, avoidance, and revealed care.",
      }),
    });
    expect(updateRes.status).toBe(200);
    expect(await readFile(filePath, "utf-8")).toContain("Track longing, avoidance, and revealed care.");

    const deleteRes = await app.request("/api/v1/skills/romance-play", { method: "DELETE" });
    expect(deleteRes.status).toBe(200);
    const list = await (await app.request("/api/v1/skills")).json() as { skills: Array<{ config: { id: string } }> };
    expect(list.skills.map((skill) => skill.config.id)).not.toContain("romance-play");
  });

  it("defaults optional skill config fields when omitted", async () => {
    const app = createStudioServer({} as never, root);

    const res = await app.request("/api/v1/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "quick-skill",
        category: "utility",
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json() as { skill: { config: { id: string; description: string; enabled: boolean; prompt: string } } };
    expect(json.skill.config).toMatchObject({
      id: "quick-skill",
      description: "",
      enabled: true,
      prompt: "",
    });
  });
});
