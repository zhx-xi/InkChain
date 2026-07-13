// ── Search Index Tests ──

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createSearchIndex,
  addToIndex,
  removeFromIndex,
  search,
  highlightSnippet,
  tokenize,
  loadSearchIndex,
  persistSearchIndex,
  buildIndexFromSessions,
  rebuildSearchIndex,
  searchSessions,
  type SearchDoc,
  type SearchIndex,
} from "../search-index.js";

// ── Helpers ──

function makeDoc(overrides: Partial<SearchDoc> & { id: string }): SearchDoc {
  return {
    title: overrides.title ?? "",
    content: overrides.content ?? "",
    tags: overrides.tags ?? [],
    scope: overrides.scope ?? "session",
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
    ...overrides,
  };
}

// ── Tokenization ──

describe("tokenize", () => {
  it("tokenizes English text by whitespace", () => {
    const tokens = tokenize("hello world test");
    expect(tokens).toContain("hello");
    expect(tokens).toContain("world");
    expect(tokens).toContain("test");
  });

  it("tokenizes Chinese text by character", () => {
    const tokens = tokenize("你好世界");
    expect(tokens).toEqual(["你", "好", "世", "界"]);
  });

  it("handles mixed Chinese and English", () => {
    const tokens = tokenize("Hello 世界 test 测试");
    expect(tokens).toContain("hello");
    expect(tokens).toContain("世");
    expect(tokens).toContain("界");
    expect(tokens).toContain("test");
    expect(tokens).toContain("测");
    expect(tokens).toContain("试");
  });

  it("lowercases English tokens", () => {
    const tokens = tokenize("Hello WORLD");
    expect(tokens).toContain("hello");
    expect(tokens).toContain("world");
  });

  it("discards empty tokens", () => {
    const tokens = tokenize("   ");
    expect(tokens).toEqual([]);
  });

  it("handles punctuation by skipping it", () => {
    const tokens = tokenize("hello, world! how-are you?");
    expect(tokens).toContain("hello");
    expect(tokens).toContain("world");
    expect(tokens).toContain("how");
    expect(tokens).toContain("are");
    expect(tokens).toContain("you");
  });

  it("caps token length at 40 characters", () => {
    const long = "a".repeat(100);
    const tokens = tokenize(long);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toBe("a".repeat(40));
  });
});

// ── createSearchIndex ──

describe("createSearchIndex", () => {
  it("returns an empty index", () => {
    const index = createSearchIndex();
    expect(index.version).toBe(1);
    expect(index.docs).toEqual({});
    expect(index.index).toEqual({});
  });
});

// ── addToIndex ──

describe("addToIndex", () => {
  it("adds a document to the index", () => {
    const index = createSearchIndex();
    const doc = makeDoc({ id: "1", title: "test title", content: "hello world" });
    const updated = addToIndex(index, doc);

    expect(updated.docs["1"]).toEqual(doc);
    // Should have indexed terms from title + content
    expect(updated.index["test"]).toBeDefined();
    expect(updated.index["title"]).toBeDefined();
    expect(updated.index["hello"]).toBeDefined();
    expect(updated.index["world"]).toBeDefined();
  });

  it("replaces an existing document", () => {
    let index = createSearchIndex();
    const doc1 = makeDoc({ id: "1", title: "old title", content: "old content" });
    const doc2 = makeDoc({ id: "1", title: "new title", content: "new content" });

    index = addToIndex(index, doc1);
    index = addToIndex(index, doc2);

    expect(index.docs["1"]!.title).toBe("new title");
    // Old terms should no longer be present (or at least doc 1 should only link to new terms)
    // "old" should not appear in the index for doc "1"
    const oldTermEntry = index.index["old"];
    if (oldTermEntry) {
      expect(oldTermEntry["1"]).toBeUndefined();
    }
  });

  it("indexes tags as well", () => {
    const index = createSearchIndex();
    const doc = makeDoc({ id: "1", title: "test", content: "hello", tags: ["important", "urgent"] });
    const updated = addToIndex(index, doc);

    expect(updated.index["important"]).toBeDefined();
    expect(updated.index["urgent"]).toBeDefined();
  });

  it("handles Chinese content", () => {
    const index = createSearchIndex();
    const doc = makeDoc({ id: "1", title: "测试标题", content: "这是一个测试内容" });
    const updated = addToIndex(index, doc);

    expect(updated.index["测"]).toBeDefined();
    expect(updated.index["试"]).toBeDefined();
    expect(updated.index["标"]).toBeDefined();
    expect(updated.index["题"]).toBeDefined();
  });
});

// ── removeFromIndex ──

describe("removeFromIndex", () => {
  it("removes a document from the index", () => {
    let index = createSearchIndex();
    const doc = makeDoc({ id: "1", title: "test", content: "hello" });
    index = addToIndex(index, doc);
    index = removeFromIndex(index, "1");

    expect(index.docs["1"]).toBeUndefined();
    // The term "test" should no longer have doc "1"
    const termEntry = index.index["test"];
    if (termEntry) {
      expect(termEntry["1"]).toBeUndefined();
    }
  });

  it("returns the same index when doc does not exist", () => {
    const index = createSearchIndex();
    const result = removeFromIndex(index, "nonexistent");
    expect(result).toBe(index);
  });

  it("preserves other documents when removing one", () => {
    let index = createSearchIndex();
    index = addToIndex(index, makeDoc({ id: "1", title: "first", content: "hello" }));
    index = addToIndex(index, makeDoc({ id: "2", title: "second", content: "world" }));
    index = removeFromIndex(index, "1");

    expect(index.docs["2"]).toBeDefined();
    expect(index.index["second"]).toBeDefined();
  });
});

// ── search ──

describe("search", () => {
  it("returns empty array for empty query", () => {
    const index = createSearchIndex();
    const results = search(index, "");
    expect(results).toEqual([]);
  });

  it("finds documents by content", () => {
    let index = createSearchIndex();
    index = addToIndex(index, makeDoc({ id: "1", title: "test", content: "hello world" }));
    index = addToIndex(index, makeDoc({ id: "2", title: "other", content: "something else" }));

    const results = search(index, "hello");
    expect(results).toHaveLength(1);
    expect(results[0]!.doc.id).toBe("1");
  });

  it("finds documents by title with higher score", () => {
    let index = createSearchIndex();
    index = addToIndex(index, makeDoc({ id: "1", title: "hello world", content: "foo bar" }));
    index = addToIndex(index, makeDoc({ id: "2", title: "foo bar", content: "hello world hello" }));

    const results = search(index, "hello");
    expect(results.length).toBeGreaterThanOrEqual(2);
    // Doc 1 should score higher because "hello" is in the title
    expect(results[0]!.doc.id).toBe("1");
  });

  it("filters by scope", () => {
    let index = createSearchIndex();
    index = addToIndex(index, makeDoc({ id: "1", title: "test", content: "hello", scope: "session" }));
    index = addToIndex(index, makeDoc({ id: "2", title: "test", content: "hello", scope: "chapter" }));

    const results = search(index, "hello", "session");
    expect(results).toHaveLength(1);
    expect(results[0]!.doc.id).toBe("1");
  });

  it("finds documents by tags", () => {
    let index = createSearchIndex();
    index = addToIndex(index, makeDoc({ id: "1", title: "test", content: "content", tags: ["important"] }));
    index = addToIndex(index, makeDoc({ id: "2", title: "other", content: "content", tags: ["minor"] }));

    const results = search(index, "important");
    expect(results).toHaveLength(1);
    expect(results[0]!.doc.id).toBe("1");
  });

  it("limits results to top 50", () => {
    let index = createSearchIndex();
    for (let i = 0; i < 60; i++) {
      index = addToIndex(index, makeDoc({ id: String(i), title: "test", content: "hello world" }));
    }
    const results = search(index, "hello");
    expect(results.length).toBeLessThanOrEqual(50);
  });

  it("returns match positions in results", () => {
    let index = createSearchIndex();
    index = addToIndex(index, makeDoc({ id: "1", title: "hello world", content: "test content" }));
    const results = search(index, "hello");

    expect(results[0]!.matches.length).toBeGreaterThan(0);
    const titleMatch = results[0]!.matches.find((m) => m.field === "title");
    expect(titleMatch).toBeDefined();
    expect(titleMatch!.positions.length).toBeGreaterThan(0);
  });

  it("handles Chinese queries", () => {
    let index = createSearchIndex();
    index = addToIndex(index, makeDoc({ id: "1", title: "测试", content: "这是一个测试内容" }));
    index = addToIndex(index, makeDoc({ id: "2", title: "其他", content: "不相关内容" }));

    const results = search(index, "测试");
    expect(results).toHaveLength(1);
    expect(results[0]!.doc.id).toBe("1");
  });
});

// ── highlightSnippet ──

describe("highlightSnippet", () => {
  it("returns full text with positions when within maxLength", () => {
    const result = highlightSnippet("hello world test", "world");
    expect(result.text).toBe("hello world test");
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0]).toEqual({ start: 6, end: 11 });
  });

  it("returns empty positions for no match", () => {
    const result = highlightSnippet("hello world", "xyz");
    expect(result.positions).toEqual([]);
  });

  it("truncates long text around first match", () => {
    const longText = "a".repeat(50) + "hello" + "b".repeat(500);
    const result = highlightSnippet(longText, "hello", 100);
    expect(result.text.length).toBeLessThanOrEqual(100);
    expect(result.positions.length).toBeGreaterThan(0);
    expect(result.text).toContain("hello");
  });

  it("handles Chinese text", () => {
    const result = highlightSnippet("这是一个测试用的文本", "测试", 200);
    expect(result.text).toContain("测试");
    expect(result.positions.length).toBeGreaterThan(0);
  });

  it("returns empty text for empty input", () => {
    const result = highlightSnippet("", "test");
    expect(result.text).toBe("");
    expect(result.positions).toEqual([]);
  });

  it("merges overlapping positions", () => {
    const result = highlightSnippet("abcTESTxyzTESTdef", "test");
    // Should find one merged range or two separate ones depending on proximity
    expect(result.positions.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Persistence ──

describe("persistSearchIndex / loadSearchIndex", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "inkos-search-test-"));
    await mkdir(join(tempDir, ".inkos"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("round-trips an index", async () => {
    let index = createSearchIndex();
    index = addToIndex(index, makeDoc({ id: "1", title: "test", content: "hello" }));
    await persistSearchIndex(tempDir, index);

    const loaded = await loadSearchIndex(tempDir);
    expect(loaded.docs["1"]).toBeDefined();
    expect(loaded.docs["1"]!.title).toBe("test");
    expect(loaded.index["hello"]).toBeDefined();
  });

  it("returns empty index when no file exists", async () => {
    const loaded = await loadSearchIndex(tempDir);
    expect(loaded.docs).toEqual({});
    expect(loaded.index).toEqual({});
  });

  it("returns empty index for corrupted file", async () => {
    await writeFile(join(tempDir, ".inkos", "search_index.json"), "not valid json", "utf-8");
    const loaded = await loadSearchIndex(tempDir);
    expect(loaded.docs).toEqual({});
  });
});

// ── buildIndexFromSessions ──

describe("buildIndexFromSessions", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "inkos-session-search-"));
    await mkdir(join(tempDir, ".inkos", "sessions"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function writeSession(sessionId: string, events: unknown[]) {
    const lines = events.map((e) => JSON.stringify(e)).join("\n");
    return writeFile(join(tempDir, ".inkos", "sessions", `${sessionId}.jsonl`), lines + "\n", "utf-8");
  }

  it("indexes a session from JSONL events", async () => {
    await writeSession("session-1", [
      {
        type: "session_created",
        version: 1,
        sessionId: "session-1",
        seq: 1,
        timestamp: 1000,
        bookId: "book-1",
        title: "My Test Session",
        status: "active",
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        type: "request_started",
        version: 1,
        sessionId: "session-1",
        seq: 2,
        timestamp: 1001,
        requestId: "req-1",
        input: "Hello world",
      },
      {
        type: "message",
        version: 1,
        sessionId: "session-1",
        seq: 3,
        timestamp: 1002,
        requestId: "req-1",
        uuid: "uuid-1",
        parentUuid: null,
        role: "user",
        message: { role: "user", content: "Hello world test content" },
      },
      {
        type: "request_committed",
        version: 1,
        sessionId: "session-1",
        seq: 4,
        timestamp: 1003,
        requestId: "req-1",
      },
    ]);

    const sessionsDir = join(tempDir, ".inkos", "sessions");
    const index = await buildIndexFromSessions(tempDir, sessionsDir);

    expect(index.docs["session-1"]).toBeDefined();
    expect(index.docs["session-1"]!.title).toBe("My Test Session");
    expect(index.docs["session-1"]!.content).toContain("Hello world test content");
  });

  it("handles empty sessions dir", async () => {
    const sessionsDir = join(tempDir, ".inkos", "sessions");
    const index = await buildIndexFromSessions(tempDir, sessionsDir);
    expect(Object.keys(index.docs)).toHaveLength(0);
  });

  it("includes tags when provided", async () => {
    await writeSession("session-1", [
      {
        type: "session_created",
        version: 1,
        sessionId: "session-1",
        seq: 1,
        timestamp: 1000,
        bookId: "book-1",
        title: "Test",
        status: "active",
        createdAt: 1000,
        updatedAt: 1000,
      },
    ]);

    const sessionsDir = join(tempDir, ".inkos", "sessions");
    const tagsById: Record<string, string[]> = {
      "session-1": ["important", "writing"],
    };
    const index = await buildIndexFromSessions(tempDir, sessionsDir, tagsById);
    expect(index.docs["session-1"]!.tags).toEqual(["important", "writing"]);
  });

  it("handles non-existent sessions dir gracefully", async () => {
    const index = await buildIndexFromSessions(tempDir, join(tempDir, "nonexistent"));
    expect(Object.keys(index.docs)).toHaveLength(0);
  });
});

// ── rebuildSearchIndex & searchSessions (integration) ──

describe("rebuildSearchIndex / searchSessions", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "inkos-search-int-"));
    await mkdir(join(tempDir, ".inkos", "sessions"), { recursive: true });

    // Write a couple sessions
    const session1 = [
      JSON.stringify({
        type: "session_created",
        version: 1,
        sessionId: "s1",
        seq: 1,
        timestamp: 1000,
        bookId: "book-1",
        title: "Character Brainstorming",
        status: "active",
        createdAt: 1000,
        updatedAt: 1000,
      }),
      JSON.stringify({
        type: "message",
        version: 1,
        sessionId: "s1",
        seq: 2,
        timestamp: 1001,
        requestId: "req-1",
        uuid: "u1",
        parentUuid: null,
        role: "user",
        message: { role: "user", content: "Let's create a brave knight character" },
      }),
      "",
    ].join("\n");
    await writeFile(join(tempDir, ".inkos", "sessions", "s1.jsonl"), session1, "utf-8");

    const session2 = [
      JSON.stringify({
        type: "session_created",
        version: 1,
        sessionId: "s2",
        seq: 1,
        timestamp: 2000,
        bookId: "book-1",
        title: "Plot Planning",
        status: "active",
        createdAt: 2000,
        updatedAt: 2000,
      }),
      JSON.stringify({
        type: "message",
        version: 1,
        sessionId: "s2",
        seq: 2,
        timestamp: 2001,
        requestId: "req-2",
        uuid: "u2",
        parentUuid: null,
        role: "user",
        message: { role: "user", content: "Outline the main plot twists" },
      }),
      "",
    ].join("\n");
    await writeFile(join(tempDir, ".inkos", "sessions", "s2.jsonl"), session2, "utf-8");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("rebuildSearchIndex indexes all sessions", async () => {
    const index = await rebuildSearchIndex(tempDir);
    expect(Object.keys(index.docs)).toHaveLength(2);
    expect(index.docs["s1"]!.title).toBe("Character Brainstorming");
    expect(index.docs["s2"]!.title).toBe("Plot Planning");
  });

  it("searchSessions finds sessions by query", async () => {
    const results = await searchSessions(tempDir, "knight");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.doc.id === "s1")).toBe(true);
  });

  it("searchSessions finds sessions by title", async () => {
    const results = await searchSessions(tempDir, "Plot");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]!.doc.id).toBe("s2");
  });

  it("searchSessions returns empty for no match", async () => {
    const results = await searchSessions(tempDir, "zzzznonexistent");
    expect(results).toHaveLength(0);
  });
});
