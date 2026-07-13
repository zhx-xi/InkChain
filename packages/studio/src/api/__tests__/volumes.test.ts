import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createVolumesRouter } from "../routes/volumes.js";

// ── Helpers ──

async function createTempBook(): Promise<{ root: string; bookDir: string; bookId: string }> {
  const root = await mkdtemp(join(tmpdir(), "volumes-test-"));
  const bookId = "test-book";
  const dir = join(root, "books", bookId);
  await mkdir(dir, { recursive: true });
  await mkdir(join(dir, "story", "state"), { recursive: true });
  await mkdir(join(dir, "chapters"), { recursive: true });
  return { root, bookDir: dir, bookId };
}

async function createVolume(router: ReturnType<typeof createVolumesRouter>, id: string, title: string) {
  const res = await router.request(`/${id}/volumes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  expect(res.status).toBe(201);
  const json = await res.json() as { volume: { id: string; title: string } };
  return json.volume;
}

async function createChapter(bookDir: string, number: number, volumeId: string | null, custom?: Record<string, unknown>) {
  const indexPath = join(bookDir, "chapters", "index.json");
  let chapters: Array<Record<string, unknown>> = [];
  try {
    const raw = await readFile(indexPath, "utf-8");
    chapters = JSON.parse(raw);
  } catch {
    // start empty
  }
  chapters.push({
    number,
    title: `第${number}章`,
    status: "draft",
    wordCount: 0,
    volumeId,
    ...custom,
  });
  await writeFile(indexPath, JSON.stringify(chapters, null, 2), "utf-8");
}

// ── Tests ──

describe("Volumes CRUD", () => {
  let root: string;
  let bookDir: string;
  let bookId: string;
  let router: ReturnType<typeof createVolumesRouter>;

  beforeEach(async () => {
    const ctx = await createTempBook();
    root = ctx.root;
    bookDir = ctx.bookDir;
    bookId = ctx.bookId;
    router = createVolumesRouter((id: string) => join(root, "books", id));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("creates and lists volumes", async () => {
    const v1 = await createVolume(router, bookId, "卷一");
    const v2 = await createVolume(router, bookId, "卷二");

    const list = await router.request(`/${bookId}/volumes`);
    expect(list.status).toBe(200);
    const json = await list.json() as { volumes: Array<{ id: string; title: string }> };
    expect(json.volumes).toHaveLength(2);
    expect(json.volumes[0].title).toBe("卷一");
    expect(json.volumes[1].title).toBe("卷二");
  });

  it("deletes a volume with no chapters", async () => {
    const v = await createVolume(router, bookId, "空卷");

    const res = await router.request(`/${bookId}/volumes/${v.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const json = await res.json() as { deleted: boolean; cascade: boolean };
    expect(json.deleted).toBe(true);

    // Verify removed from list
    const list = await router.request(`/${bookId}/volumes`);
    const listJson = await list.json() as { volumes: Array<{ id: string }> };
    expect(listJson.volumes).toHaveLength(0);
  });

  it("returns 404 for non-existent volume", async () => {
    const res = await router.request(`/${bookId}/volumes/non-existent-id`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

describe("GET /:id/volumes/:volumeId/chapters", () => {
  let root: string;
  let bookDir: string;
  let bookId: string;
  let router: ReturnType<typeof createVolumesRouter>;

  beforeEach(async () => {
    const ctx = await createTempBook();
    root = ctx.root;
    bookDir = ctx.bookDir;
    bookId = ctx.bookId;
    router = createVolumesRouter((id: string) => join(root, "books", id));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("returns chapters for a volume when index is a plain array (StateManager format)", async () => {
    const v = await createVolume(router, bookId, "卷一");
    // Write chapters index as plain array (StateManager format)
    await writeFile(join(bookDir, "chapters", "index.json"), JSON.stringify([
      { number: 1, title: "第一章", status: "draft", wordCount: 500, volumeId: v.id },
      { number: 2, title: "第二章", status: "draft", wordCount: 600, volumeId: v.id },
      { number: 3, title: "第三章", status: "draft", wordCount: 700, volumeId: null },
    ], null, 2), "utf-8");

    const res = await router.request(`/${bookId}/volumes/${v.id}/chapters`);
    expect(res.status).toBe(200);
    const json = await res.json() as { volumeId: string; chapters: Array<{ number: number; title: string }> };
    expect(json.volumeId).toBe(v.id);
    expect(json.chapters).toHaveLength(2);
    expect(json.chapters[0].number).toBe(1);
    expect(json.chapters[1].number).toBe(2);
  });

  it("returns chapters for a volume when index is wrapped {chapters:[...]} format", async () => {
    const v = await createVolume(router, bookId, "卷一");
    // Write chapters index as wrapped format
    await writeFile(join(bookDir, "chapters", "index.json"), JSON.stringify({
      chapters: [
        { number: 5, title: "第五章", status: "draft", wordCount: 800, volumeId: v.id },
      ],
    }, null, 2), "utf-8");

    const res = await router.request(`/${bookId}/volumes/${v.id}/chapters`);
    expect(res.status).toBe(200);
    const json = await res.json() as { volumeId: string; chapters: Array<{ number: number; title: string }> };
    expect(json.chapters).toHaveLength(1);
    expect(json.chapters[0].number).toBe(5);
  });

  it("returns empty chapters when volume has no chapters assigned", async () => {
    const v = await createVolume(router, bookId, "空卷");
    await writeFile(join(bookDir, "chapters", "index.json"), JSON.stringify([
      { number: 1, title: "第一章", status: "draft", wordCount: 500, volumeId: null },
    ], null, 2), "utf-8");

    const res = await router.request(`/${bookId}/volumes/${v.id}/chapters`);
    expect(res.status).toBe(200);
    const json = await res.json() as { volumeId: string; chapters: Array<unknown> };
    expect(json.chapters).toHaveLength(0);
  });

  it("returns 404 for non-existent volume", async () => {
    const res = await router.request(`/${bookId}/volumes/non-existent/chapters`);
    expect(res.status).toBe(404);
  });

  it("returns empty chapters when chapters index does not exist", async () => {
    const v = await createVolume(router, bookId, "无索引");
    const res = await router.request(`/${bookId}/volumes/${v.id}/chapters`);
    expect(res.status).toBe(200);
    const json = await res.json() as { volumeId: string; chapters: Array<unknown> };
    expect(json.chapters).toHaveLength(0);
  });
});

describe("Volume deletion - cascade behavior", () => {
  let root: string;
  let bookDir: string;
  let bookId: string;
  let router: ReturnType<typeof createVolumesRouter>;

  beforeEach(async () => {
    const ctx = await createTempBook();
    root = ctx.root;
    bookDir = ctx.bookDir;
    bookId = ctx.bookId;
    router = createVolumesRouter((id: string) => join(root, "books", id));

    // Create a volume and some chapters in it
    const v = await createVolume(router, bookId, "测试分卷");
    await createChapter(bookDir, 1, v.id);
    await createChapter(bookDir, 2, v.id);
    await createChapter(bookDir, 3, v.id);
    // Also create an unassigned chapter
    await createChapter(bookDir, 4, null);
    // Store volume id for tests
    (globalThis as Record<string, unknown>).__volumeId = v.id;
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    delete (globalThis as Record<string, unknown>).__volumeId;
  });

  it("default delete (no cascade) sets volumeId=null on chapters", async () => {
    const volumeId = (globalThis as Record<string, unknown>).__volumeId as string;

    // Delete without cascade (default)
    const res = await router.request(`/${bookId}/volumes/${volumeId}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const json = await res.json() as { deleted: boolean; cascade: boolean };
    expect(json.deleted).toBe(true);
    expect(json.cascade).toBe(false);

    // Verify chapters index — volumeId should be null for former members
    const raw = await readFile(join(bookDir, "chapters", "index.json"), "utf-8");
    const chapters = JSON.parse(raw) as Array<Record<string, unknown>>;
    expect(chapters).toHaveLength(4); // all chapters preserved
    for (const ch of chapters) {
      expect(ch.volumeId).toBeNull();
    }
  });

  it("cascade delete removes chapters from index", async () => {
    const volumeId = (globalThis as Record<string, unknown>).__volumeId as string;

    // Delete with cascade
    const res = await router.request(`/${bookId}/volumes/${volumeId}?cascade=true`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const json = await res.json() as { deleted: boolean; cascade: boolean };
    expect(json.deleted).toBe(true);
    expect(json.cascade).toBe(true);

    // Verify chapters index — cascade-deleted chapters removed
    const raw = await readFile(join(bookDir, "chapters", "index.json"), "utf-8");
    const chapters = JSON.parse(raw) as Array<Record<string, unknown>>;
    expect(chapters).toHaveLength(1); // only the unassigned chapter remains
    expect(chapters[0].number).toBe(4);
  });

  it("cascade delete removes chapter markdown files from disk", async () => {
    const volumeId = (globalThis as Record<string, unknown>).__volumeId as string;

    // Create chapter markdown files
    for (const n of [1, 2, 3, 4]) {
      await writeFile(join(bookDir, "chapters", `chapter-${n}.md`), `# Chapter ${n}\n\ncontent`, "utf-8");
    }

    // Delete with cascade
    const res = await router.request(`/${bookId}/volumes/${volumeId}?cascade=true`, { method: "DELETE" });
    expect(res.status).toBe(200);

    // Verify files: 1,2,3 should be gone; 4 (unassigned) should remain
    for (const n of [1, 2, 3]) {
      await expect(readFile(join(bookDir, "chapters", `chapter-${n}.md`), "utf-8")).rejects.toThrow();
    }
    const ch4 = await readFile(join(bookDir, "chapters", "chapter-4.md"), "utf-8");
    expect(ch4).toContain("Chapter 4");
  });

  it("handles chapters index with {chapters:[...]} format", async () => {
    const v = await createVolume(router, bookId, "格式测试");
    const volumeId = v.id;

    // Write index in {chapters:[...]} format
    const indexPath = join(bookDir, "chapters", "index.json");
    await writeFile(indexPath, JSON.stringify({
      chapters: [
        { number: 10, title: "第十章", status: "draft", wordCount: 0, volumeId },
      ],
    }, null, 2), "utf-8");

    const res = await router.request(`/${bookId}/volumes/${volumeId}`, { method: "DELETE" });
    expect(res.status).toBe(200);

    const raw = await readFile(indexPath, "utf-8");
    const parsed = JSON.parse(raw) as { chapters: Array<Record<string, unknown>> };
    expect(parsed.chapters[0].volumeId).toBeNull();
  });

  it("cascade delete with {chapters:[...]} format works", async () => {
    const v = await createVolume(router, bookId, "格式测试级联");
    const volumeId = v.id;

    const indexPath = join(bookDir, "chapters", "index.json");
    await writeFile(indexPath, JSON.stringify({
      chapters: [
        { number: 10, title: "第十章", status: "draft", wordCount: 0, volumeId },
        { number: 11, title: "第十一章", status: "draft", wordCount: 0, volumeId: null },
      ],
    }, null, 2), "utf-8");

    await writeFile(join(bookDir, "chapters", `chapter-10.md`), "content", "utf-8");

    const res = await router.request(`/${bookId}/volumes/${volumeId}?cascade=true`, { method: "DELETE" });
    expect(res.status).toBe(200);

    const raw = await readFile(indexPath, "utf-8");
    const parsed = JSON.parse(raw) as { chapters: Array<Record<string, unknown>> };
    expect(parsed.chapters).toHaveLength(1);
    expect(parsed.chapters[0].number).toBe(11);
  });

  it("works when chapters index does not exist", async () => {
    // Remove chapters index
    await rm(join(bookDir, "chapters", "index.json"), { force: true });

    const v = await createVolume(router, bookId, "无索引");
    const res = await router.request(`/${bookId}/volumes/${v.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const json = await res.json() as { deleted: boolean };
    expect(json.deleted).toBe(true);
  });
});
