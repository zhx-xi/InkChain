// ── WorldConfigSchema bookIds Test (Issue #601) ──
//
// Verifies that the WorldConfigSchema correctly accepts bookIds,
// and that the world creation flow works without "World validation failed".

import { describe, it, expect } from "vitest";
import { WorldConfigSchema, type WorldConfig } from "../models/world-config.js";
import { createWorld } from "../models/world-store.js";

describe("WorldConfigSchema bookIds", () => {
  // -----------------------------------------------------------------------
  // Schema validation
  // -----------------------------------------------------------------------

  it("accepts bookIds in the schema", () => {
    const now = new Date().toISOString();
    const result = WorldConfigSchema.safeParse({
      id: "test-world",
      name: "Test World",
      description: "A test world",
      createdAt: now,
      updatedAt: now,
      settings: [],
      roles: [],
      relations: [],
      regions: [],
      institutions: [],
      history: [],
      rules: [],
      references: [],
      bookIds: ["book-1", "book-2"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bookIds).toEqual(["book-1", "book-2"]);
    }
  });

  it("defaults bookIds to empty array when omitted", () => {
    const result = WorldConfigSchema.safeParse({
      id: "test-world",
      name: "Test World",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: [],
      roles: [],
      relations: [],
      regions: [],
      institutions: [],
      history: [],
      rules: [],
      references: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bookIds).toEqual([]);
    }
  });

  it("accepts empty bookIds array", () => {
    const result = WorldConfigSchema.safeParse({
      id: "test-world",
      name: "Test World",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: [],
      roles: [],
      relations: [],
      regions: [],
      institutions: [],
      history: [],
      rules: [],
      references: [],
      bookIds: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bookIds).toEqual([]);
    }
  });

  it("accepts a single bookId in the array", () => {
    const result = WorldConfigSchema.safeParse({
      id: "test-world",
      name: "Test World",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: [],
      roles: [],
      relations: [],
      regions: [],
      institutions: [],
      history: [],
      rules: [],
      references: [],
      bookIds: ["single-book"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bookIds).toEqual(["single-book"]);
    }
  });

  it("rejects non-array bookIds", () => {
    const result = WorldConfigSchema.safeParse({
      id: "test-world",
      name: "Test World",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: [],
      roles: [],
      relations: [],
      regions: [],
      institutions: [],
      history: [],
      rules: [],
      references: [],
      bookIds: "not-an-array",
    });
    expect(result.success).toBe(false);
  });

  it("rejects bookIds with non-string elements", () => {
    const result = WorldConfigSchema.safeParse({
      id: "test-world",
      name: "Test World",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: [],
      roles: [],
      relations: [],
      regions: [],
      institutions: [],
      history: [],
      rules: [],
      references: [],
      bookIds: [42],
    });
    expect(result.success).toBe(false);
  });

  // -----------------------------------------------------------------------
  // createWorld helper
  // -----------------------------------------------------------------------

  it("createWorld includes empty bookIds array", () => {
    const world = createWorld("new-world", "New World");
    expect(world.bookIds).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Round-trip: full payload that matches the frontend handleSave
  // -----------------------------------------------------------------------

  it("handles the exact payload from frontend handleSave (create mode)", () => {
    const now = new Date().toISOString();
    const payload = {
      id: "world-create-test",
      name: "Create Test World",
      description: "",
      createdAt: now,
      updatedAt: now,
      settings: [],
      roles: [],
      relations: [],
      regions: [],
      institutions: [],
      history: [],
      rules: [],
      references: [],
      bookIds: ["assoc-book-1"],
    };
    const result = WorldConfigSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bookIds).toEqual(["assoc-book-1"]);
    }
  });
});
