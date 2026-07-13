import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DATA_DIR_NAME } from "../../constants/data-directory.js";
import { createStudioServer } from "../server.js";

function sampleWorld(id: string) {
  return {
    id,
    name: `${id} Name`,
    description: "A sample world.",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    settings: [],
    roles: [],
    relations: [],
    regions: [],
    institutions: [],
    history: [],
    rules: [],
  };
}

async function writeWorld(root: string, id: string): Promise<void> {
  const dir = join(root, DATA_DIR_NAME, "worlds");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${id}.json`), JSON.stringify(sampleWorld(id)), "utf-8");
}

describe("World CRUD API (Issue #77)", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "inkos-worlds-crud-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("GET /api/worlds lists worlds", async () => {
    await writeWorld(root, "alpha");
    await writeWorld(root, "beta");
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/worlds");
    expect(res.status).toBe(200);
    const json = await res.json() as { worlds: Array<{ id: string; name: string }> };
    expect(json.worlds).toHaveLength(2);
    expect(json.worlds.map((w) => w.id).sort()).toEqual(["alpha", "beta"]);
  });

  it("GET /api/worlds/:id returns world details", async () => {
    await writeWorld(root, "alpha");
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/worlds/alpha");
    expect(res.status).toBe(200);
    const json = await res.json() as { world: { id: string; name: string } };
    expect(json.world.id).toBe("alpha");
  });

  it("GET /api/worlds/:id returns 404 for unknown world", async () => {
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/worlds/unknown");
    expect(res.status).toBe(404);
  });

  it("POST /api/worlds creates a world", async () => {
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/worlds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleWorld("new-world")),
    });
    expect(res.status).toBe(201);
    const json = await res.json() as { world: { id: string } };
    expect(json.world.id).toBe("new-world");
  });

  it("POST /api/worlds rejects duplicate id", async () => {
    await writeWorld(root, "alpha");
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/worlds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleWorld("alpha")),
    });
    expect(res.status).toBe(409);
  });

  it("PUT /api/worlds/:id updates a world", async () => {
    await writeWorld(root, "alpha");
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/worlds/alpha", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Name" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { world: { name: string } };
    expect(json.world.name).toBe("Updated Name");
  });

  it("DELETE /api/worlds/:id removes a world", async () => {
    await writeWorld(root, "alpha");
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/worlds/alpha", { method: "DELETE" });
    expect(res.status).toBe(200);
    const list = await app.request("/api/worlds");
    const json = await list.json() as { worlds: Array<{ id: string }> };
    expect(json.worlds.map((w) => w.id)).not.toContain("alpha");
  });
});
