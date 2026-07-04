import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStudioServer } from "../server.js";

/** Creates minimal project config so loadProjectConfig doesn't fail. */
async function setupProject(root: string): Promise<void> {
  await writeFile(join(root, "inkos.json"), JSON.stringify({ name: "test-project", version: "0.1.0" }), "utf-8");
}

/**
 * Creates a minimal book structure so that bookDir(id) resolves.
 * The actual route handlers use state.bookDir(id) to find the book directory.
 */
async function setupBook(root: string, bookId: string): Promise<void> {
  await setupProject(root);
  const bookDir = join(root, "books", bookId);
  await mkdir(bookDir, { recursive: true });
  await writeFile(join(bookDir, "book.json"), JSON.stringify({ id: bookId, title: "Test Book" }), "utf-8");
}

/**
 * Creates a chapter file that the extract route expects.
 */
async function setupChapter(root: string, bookId: string, chapterNum: number, content: string): Promise<void> {
  const chaptersDir = join(root, "books", bookId, "chapters");
  await mkdir(chaptersDir, { recursive: true });
  const padded = String(chapterNum).padStart(4, "0");
  await writeFile(join(chaptersDir, `${padded}_chapter-${chapterNum}.md`), content, "utf-8");
}

describe("AI Extraction Routes (Issue #211 — POST /api/v1/books/:id/chapters/:n/extract)", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "inkos-ai-extract-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  // ── Foreshadowing Extract ──

  describe("Foreshadowing Extract", () => {
    it("POST extract/foreshadowing returns 400 for invalid bookId", async () => {
      const app = createStudioServer({} as never, root);
      const res = await app.request(
        "/api/v1/books/%3Ainvalid/chapters/1/extract/foreshadowing",
        { method: "POST" },
      );
      expect(res.status).toBe(400);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("INVALID_BOOK_ID");
    });

    it("POST extract/foreshadowing returns 400 for non-integer chapter", async () => {
      await setupBook(root, "test-book");
      const app = createStudioServer({} as never, root);
      const res = await app.request(
        "/api/v1/books/test-book/chapters/abc/extract/foreshadowing",
        { method: "POST" },
      );
      expect(res.status).toBe(400);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("INVALID_CHAPTER");
    });

    it("POST extract/foreshadowing returns 400 for negative chapter", async () => {
      await setupBook(root, "test-book");
      const app = createStudioServer({} as never, root);
      const res = await app.request(
        "/api/v1/books/test-book/chapters/-1/extract/foreshadowing",
        { method: "POST" },
      );
      expect(res.status).toBe(400);
    });

    it("POST extract/foreshadowing returns 404 when chapters dir missing", async () => {
      await setupBook(root, "test-book");
      const app = createStudioServer({} as never, root);
      const res = await app.request(
        "/api/v1/books/test-book/chapters/1/extract/foreshadowing",
        { method: "POST" },
      );
      expect(res.status).toBe(404);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("CHAPTERS_DIR_NOT_FOUND");
    });

    it("POST extract/foreshadowing returns 404 when chapter file not found", async () => {
      await setupBook(root, "test-book");
      const chaptersDir = join(root, "books", "test-book", "chapters");
      await mkdir(chaptersDir, { recursive: true });
      const app = createStudioServer({} as never, root);
      const res = await app.request(
        "/api/v1/books/test-book/chapters/99/extract/foreshadowing",
        { method: "POST" },
      );
      expect(res.status).toBe(404);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("CHAPTER_NOT_FOUND");
    });

    it("POST extract/foreshadowing returns 500 with valid input (LLM needed)", async () => {
      await setupBook(root, "test-book");
      await setupChapter(root, "test-book", 1, "This is chapter 1 content for testing.");
      const app = createStudioServer({} as never, root);
      const res = await app.request(
        "/api/v1/books/test-book/chapters/1/extract/foreshadowing",
        { method: "POST" },
      );
      // The route needs an LLM API key, so it returns an error
      expect([400, 500]).toContain(res.status);
    });

    it("POST extract/foreshadowing response contains error.code when failing", async () => {
      await setupBook(root, "test-book");
      await setupChapter(root, "test-book", 1, "Chapter content.");
      const app = createStudioServer({} as never, root);
      const res = await app.request(
        "/api/v1/books/test-book/chapters/1/extract/foreshadowing",
        { method: "POST" },
      );
      const json = await res.json() as { error?: { code: string } };
      expect(json.error).toBeDefined();
    });
  });

  // ── Timeline Extract ──

  describe("Timeline Extract", () => {
    it("POST extract/timeline returns 400 for invalid bookId", async () => {
      const app = createStudioServer({} as never, root);
      const res = await app.request(
        "/api/v1/books/%00/chapters/1/extract/timeline",
        { method: "POST" },
      );
      expect(res.status).toBe(400);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("INVALID_BOOK_ID");
    });

    it("POST extract/timeline returns 400 for non-integer chapter", async () => {
      await setupBook(root, "test-book");
      const app = createStudioServer({} as never, root);
      const res = await app.request(
        "/api/v1/books/test-book/chapters/one/extract/timeline",
        { method: "POST" },
      );
      expect(res.status).toBe(400);
    });

    it("POST extract/timeline returns 404 when chapters dir missing", async () => {
      await setupBook(root, "test-book");
      const app = createStudioServer({} as never, root);
      const res = await app.request(
        "/api/v1/books/test-book/chapters/1/extract/timeline",
        { method: "POST" },
      );
      expect(res.status).toBe(404);
    });

    it("POST extract/timeline returns 404 when chapter file not found", async () => {
      await setupBook(root, "test-book");
      const chaptersDir = join(root, "books", "test-book", "chapters");
      await mkdir(chaptersDir, { recursive: true });
      const app = createStudioServer({} as never, root);
      const res = await app.request(
        "/api/v1/books/test-book/chapters/5/extract/timeline",
        { method: "POST" },
      );
      expect(res.status).toBe(404);
    });

    it("POST extract/timeline returns 500 with valid input (LLM needed)", async () => {
      await setupBook(root, "test-book");
      await setupChapter(root, "test-book", 1, "Chapter content for timeline.");
      const app = createStudioServer({} as never, root);
      const res = await app.request(
        "/api/v1/books/test-book/chapters/1/extract/timeline",
        { method: "POST" },
      );
      expect([400, 500]).toContain(res.status);
    });

    it("POST extract/timeline returns error.code when failing", async () => {
      await setupBook(root, "test-book");
      await setupChapter(root, "test-book", 1, "Timeline test content.");
      const app = createStudioServer({} as never, root);
      const res = await app.request(
        "/api/v1/books/test-book/chapters/1/extract/timeline",
        { method: "POST" },
      );
      const json = await res.json() as { error?: { code: string } };
      expect(json.error).toBeDefined();
    });
  });
});
