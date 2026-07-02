import { describe, expect, it } from "vitest";
import { extractWorldFromBook } from "../book-world-extraction.js";
import type { BookConfig } from "../book.js";

function makeBook(overrides: Partial<BookConfig> = {}): BookConfig {
  return {
    id: "test-book",
    title: "Test Novel",
    platform: "tomato",
    genre: "xuanhuan",
    status: "active",
    targetChapters: 100,
    chapterWordCount: 3000,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("extractWorldFromBook (Issue #78)", () => {
  it("creates a minimal world from book metadata", () => {
    const world = extractWorldFromBook({ book: makeBook() });
    expect(world.id).toBe("test-book");
    expect(world.name).toBe("Test Novel");
    expect(world.description).toBe('Imported from book "Test Novel"');
    expect(world.settings).toHaveLength(2);
    expect(world.settings[0].id).toBe("genre");
    expect(world.settings[1].id).toBe("platform");
    expect(world.rules).toHaveLength(0);
  });

  it("sanitizes book ids with special characters", () => {
    const world = extractWorldFromBook({
      book: makeBook({ id: "My Book!!!", title: "My Book" }),
    });
    expect(world.id).toBe("my-book");
  });

  it("extracts rules from narrative text heuristically", () => {
    const world = extractWorldFromBook({
      book: makeBook(),
      narrativeText: "规则：凡人不可直视神明。\n定律：魔力守恒。\n无关的散文段落。",
    });
    expect(world.rules).toHaveLength(2);
    expect(world.rules[0].name).toBe("凡人不可直视神明。");
    expect(world.rules[0].type).toBe("叙事");
    expect(world.rules[1].name).toBe("魔力守恒。");
  });

  it("ignores narrative text without rule markers", () => {
    const world = extractWorldFromBook({
      book: makeBook(),
      narrativeText: "这是一个普通的描述段落，没有任何规则或定律。",
    });
    expect(world.rules).toHaveLength(0);
  });

  it("produces a valid WorldConfig with all 7 dimensions initialized", () => {
    const world = extractWorldFromBook({ book: makeBook() });
    expect(Array.isArray(world.settings)).toBe(true);
    expect(Array.isArray(world.roles)).toBe(true);
    expect(Array.isArray(world.relations)).toBe(true);
    expect(Array.isArray(world.regions)).toBe(true);
    expect(Array.isArray(world.institutions)).toBe(true);
    expect(Array.isArray(world.history)).toBe(true);
    expect(Array.isArray(world.rules)).toBe(true);
  });
});
