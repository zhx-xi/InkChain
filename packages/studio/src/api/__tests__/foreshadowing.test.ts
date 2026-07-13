import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DATA_DIR_NAME } from "../../constants/data-directory.js";
import { createStudioServer } from "../server.js";

async function writeForeshadowing(
  root: string,
  data: Record<string, unknown>,
): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const dir = join(root, DATA_DIR_NAME, "foreshadowing");
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, `${data.id}.json`),
    JSON.stringify(data, null, 2),
    "utf-8",
  );
}

describe("Foreshadowing CRUD API (Issue #84)", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "inkos-fs-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("GET /api/foreshadowing returns empty list", async () => {
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/foreshadowing");
    expect(res.status).toBe(200);
    const json = await res.json() as { foreshadowing: unknown[]; total: number };
    expect(json.foreshadowing).toEqual([]);
    expect(json.total).toBe(0);
  });

  it("GET /api/foreshadowing lists project foreshadowing", async () => {
    await writeForeshadowing(root, { id: "f-001", title: "神秘戒指", createdChapter: 1 });
    await writeForeshadowing(root, { id: "f-002", title: "钥匙之谜", createdChapter: 2 });

    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/foreshadowing");
    expect(res.status).toBe(200);
    const json = await res.json() as { foreshadowing: Array<{ id: string; title: string }> };
    expect(json.foreshadowing).toHaveLength(2);
    expect(json.foreshadowing.map((f) => f.id)).toEqual(["f-001", "f-002"]);
  });

  it("GET /api/foreshadowing filters by status", async () => {
    await writeForeshadowing(root, { id: "f1", title: "Active", status: "active" });
    await writeForeshadowing(root, { id: "f2", title: "Paid", status: "paid_off" });

    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/foreshadowing?status=active");
    const json = await res.json() as { foreshadowing: Array<{ id: string }> };
    expect(json.foreshadowing).toHaveLength(1);
    expect(json.foreshadowing[0].id).toBe("f1");
  });

  it("GET /api/foreshadowing/:id returns a single entry", async () => {
    await writeForeshadowing(root, { id: "f-001", title: "神秘戒指" });

    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/foreshadowing/f-001");
    expect(res.status).toBe(200);
    const json = await res.json() as { foreshadowing: { id: string; title: string } };
    expect(json.foreshadowing.id).toBe("f-001");
    expect(json.foreshadowing.title).toBe("神秘戒指");
  });

  it("GET /api/foreshadowing/:id returns 404 for unknown", async () => {
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/foreshadowing/unknown");
    expect(res.status).toBe(404);
  });

  it("POST /api/foreshadowing creates a new entry", async () => {
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/foreshadowing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "f-new",
        title: "新伏笔",
        type: "角色伏笔",
        createdChapter: 3,
      }),
    });
    expect(res.status).toBe(201);
    const json = await res.json() as { foreshadowing: { id: string; title: string } };
    expect(json.foreshadowing.id).toBe("f-new");
    expect(json.foreshadowing.title).toBe("新伏笔");
  });

  it("POST /api/foreshadowing rejects duplicate id", async () => {
    await writeForeshadowing(root, { id: "dup", title: "Existing" });

    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/foreshadowing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "dup", title: "Duplicate" }),
    });
    expect(res.status).toBe(409);
  });

  it("PUT /api/foreshadowing/:id updates an entry", async () => {
    await writeForeshadowing(root, { id: "f-upd", title: "Before", status: "active" });

    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/foreshadowing/f-upd", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "After", description: "Updated" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { foreshadowing: { title: string; description: string } };
    expect(json.foreshadowing.title).toBe("After");
    expect(json.foreshadowing.description).toBe("Updated");
  });

  it("POST /api/foreshadowing/:id/payoff marks paid off", async () => {
    await writeForeshadowing(root, { id: "f-po", title: "Payoff", status: "active" });

    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/foreshadowing/f-po/payoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payoffChapter: 10 }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { foreshadowing: { status: string; payoffChapter: number } };
    expect(json.foreshadowing.status).toBe("paid_off");
    expect(json.foreshadowing.payoffChapter).toBe(10);
  });

  it("DELETE /api/foreshadowing/:id deletes an entry", async () => {
    await writeForeshadowing(root, { id: "f-del", title: "Delete me" });

    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/foreshadowing/f-del", { method: "DELETE" });
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; id: string };
    expect(json.ok).toBe(true);

    // Verify deletion
    const getRes = await app.request("/api/foreshadowing/f-del");
    expect(getRes.status).toBe(404);
  });
});
