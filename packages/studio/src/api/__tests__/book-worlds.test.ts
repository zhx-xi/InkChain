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

async function writeBook(
  root: string,
  bookId: string,
  worldIds: string[],
): Promise<void> {
  const bookDir = join(root, "books", bookId);
  await mkdir(bookDir, { recursive: true });
  const book = {
    id: bookId,
    title: "Test Book",
    genre: "fantasy",
    status: "active",
    targetChapters: 20,
    chapterWordCount: 3000,
    worldId: worldIds[0] ?? null,
    worldIds,
  };
  await writeFile(join(bookDir, "book.json"), JSON.stringify(book), "utf-8");
}

describe("Book Worlds API (Issue #195 — GET /api/books/:bookId/worlds)", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "inkos-book-worlds-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("GET /:bookId/worlds returns worlds associated with a book", async () => {
    await writeWorld(root, "alpha");
    await writeWorld(root, "beta");
    await writeBook(root, "test-book", ["alpha", "beta"]);

    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/books/test-book/worlds");
    expect(res.status).toBe(200);
    const json = await res.json() as { worlds: Array<{ id: string; name: string }> };
    expect(json.worlds).toHaveLength(2);
    expect(json.worlds.map((w) => w.id).sort()).toEqual(["alpha", "beta"]);
  });

  it("GET /:bookId/worlds returns empty array when book has no associated worlds", async () => {
    await writeBook(root, "empty-book", []);

    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/books/empty-book/worlds");
    expect(res.status).toBe(200);
    const json = await res.json() as { worlds: unknown[] };
    expect(json.worlds).toEqual([]);
  });

  it("GET /:bookId/worlds returns empty array when book has null worldId and no worldIds", async () => {
    const bookDir = join(root, "books", "no-worlds");
    await mkdir(bookDir, { recursive: true });
    await writeFile(
      join(bookDir, "book.json"),
      JSON.stringify({ id: "no-worlds", title: "No Worlds", worldId: null }),
      "utf-8",
    );

    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/books/no-worlds/worlds");
    expect(res.status).toBe(200);
    const json = await res.json() as { worlds: unknown[] };
    expect(json.worlds).toEqual([]);
  });

  it("GET /:bookId/worlds returns 404 when book is not found", async () => {
    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/books/unknown-book/worlds");
    expect(res.status).toBe(404);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe("BOOK_NOT_FOUND");
  });

  it("GET /:bookId/worlds returns 400 for invalid book id (contains unsafe chars)", async () => {
    const app = createStudioServer({} as never, root);
    // `../` in the path gets normalized by Hono before route matching,
    // so use a URL-encoded unsafe char (colon) that passes Hono but fails isSafeBookId.
    const res = await app.request("/api/books/evil%3Abook/worlds");
    expect(res.status).toBe(400);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe("INVALID_BOOK_ID");
  });


  it("GET /:bookId/worlds deduplicates worldIds", async () => {
    await writeWorld(root, "alpha");
    await writeBook(root, "dedup-book", ["alpha", "alpha"]);

    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/books/dedup-book/worlds");
    expect(res.status).toBe(200);
    const json = await res.json() as { worlds: Array<{ id: string }> };
    expect(json.worlds).toHaveLength(1);
    expect(json.worlds[0].id).toBe("alpha");
  });

  it("GET /:bookId/worlds only returns existing worlds (skips missing)", async () => {
    await writeWorld(root, "alpha");
    // beta world file does not exist
    await writeBook(root, "partial-book", ["alpha", "beta"]);

    const app = createStudioServer({} as never, root);
    const res = await app.request("/api/books/partial-book/worlds");
    expect(res.status).toBe(200);
    const json = await res.json() as { worlds: Array<{ id: string }> };
    expect(json.worlds).toHaveLength(1);
    expect(json.worlds[0].id).toBe("alpha");
  });

  it("GET /:bookId/worlds supports encoded bookId", async () => {
    await writeWorld(root, "alpha");
    await writeBook(root, "中文书籍", ["alpha"]);

    const app = createStudioServer({} as never, root);
    const encodedId = encodeURIComponent("中文书籍");
    const res = await app.request(`/api/books/${encodedId}/worlds`);
    expect(res.status).toBe(200);
    const json = await res.json() as { worlds: Array<{ id: string }> };
    expect(json.worlds).toHaveLength(1);
    expect(json.worlds[0].id).toBe("alpha");
  });

  it("GET /:bookId/worlds returns 400 for encoded bookId that fails isSafeBookId", async () => {
    const app = createStudioServer({} as never, root);
    const encodedId = encodeURIComponent("../malicious");
    const res = await app.request(`/api/books/${encodedId}/worlds`);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe("INVALID_BOOK_ID");
  });
});
