import { describe, expect, it } from "vitest";
import { checkConsistency } from "../consistency-checker.js";
import { createEmptyReport, calculateScore } from "../consistency-report.js";
import { WorldConfigSchema } from "../../models/world-config.js";
import type { WorldConfig } from "../../models/world-config.js";

function minimalWorld(overrides?: Partial<WorldConfig>): WorldConfig {
  return WorldConfigSchema.parse({
    id: "test-world",
    name: "Test World",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  });
}

describe("ConsistencyReport (AI-3)", () => {
  it("creates empty report with perfect score", () => {
    const report = createEmptyReport();
    expect(report.issues).toHaveLength(0);
    expect(report.score).toBe(100);
  });

  it("calculates score correctly", () => {
    const score = calculateScore([
      { type: "character_contradiction", severity: "high", description: "", sources: [] },
      { type: "setting_conflict", severity: "medium", description: "", sources: [] },
      { type: "timeline_paradox", severity: "low", description: "", sources: [] },
    ] as any);
    expect(score).toBe(74); // 100 - 15 - 8 - 3
  });
});

describe("checkConsistency (AI-3)", () => {
  it("returns clean report for consistent chapter with no world", () => {
    const world = minimalWorld();
    const report = checkConsistency({
      world,
      chapter: { id: "ch1", title: "Chapter 1", text: "这是一个普通的章节。", characters: [] },
    });
    expect(report.score).toBe(100);
    expect(report.issues).toHaveLength(0);
  });

  it("detects character contradiction", () => {
    const world = minimalWorld({
      roles: [{ id: "hero", name: "英雄", role: "主角", description: "A brave warrior", significance: 5, sortIndex: 0, institutionIds: [], regionIds: [] }],
    });
    const report = checkConsistency({
      world,
      chapter: { id: "ch1", title: "Chapter 1", text: "英雄感到很害怕，他退缩了。", characters: ["hero"] },
      characterProfiles: [{ id: "hero", name: "英雄", traits: ["勇敢"], role: "主角", description: "" }],
    });
    expect(report.issues.length).toBeGreaterThanOrEqual(1);
    expect(report.issues[0].type).toBe("character_contradiction");
  });

  it("detects relationship break", () => {
    const world = minimalWorld({
      roles: [
        { id: "a", name: "Alice", role: "主角", description: "", significance: 3, sortIndex: 0, institutionIds: [], regionIds: [] },
        { id: "b", name: "Bob", role: "配角", description: "", significance: 3, sortIndex: 1, institutionIds: [], regionIds: [] },
      ],
      relations: [{ id: "r1", sourceId: "a", targetId: "b", type: "师徒", description: "Master and student", sortIndex: 0 }],
    });
    const report = checkConsistency({
      world,
      chapter: { id: "ch1", title: "Chapter 1", text: "Alice walked into the room.\n\nBob was sitting in the corner.\n\nThey didn't talk.", characters: ["a", "b"] },
    });
    expect(report.issues.some((i) => i.type === "relationship_break")).toBe(true);
  });

  it("detects setting conflict from rules", () => {
    const world = minimalWorld({
      rules: [{ id: "rule1", name: "飞行术", type: "魔法", description: "Magic flight spell", constraints: ["飞行术"], sortIndex: 0 }],
    });
    const report = checkConsistency({
      world,
      chapter: { id: "ch1", title: "Chapter 1", text: "他用飞行术在天空中飞翔。", characters: [] },
    });
    expect(report.issues.some((i) => i.type === "setting_conflict")).toBe(true);
  });

  it("detects timeline paradox (unknown character)", () => {
    const world = minimalWorld();
    const report = checkConsistency({
      world,
      chapter: { id: "ch2", title: "Chapter 2", text: "Some text.", characters: ["unknown-char"] },
      previousChapters: [{ id: "ch1", title: "Chapter 1", text: "First chapter.", characters: ["known-char"] }],
    });
    expect(report.issues.some((i) => i.type === "timeline_paradox")).toBe(true);
  });

  it("generates a summary with issue counts", () => {
    const report = checkConsistency({
      world: minimalWorld({
        roles: [{ id: "x", name: "X", role: "主角", description: "", significance: 3, sortIndex: 0, institutionIds: [], regionIds: [] }],
      }),
      chapter: { id: "ch1", title: "Chapter 1", text: "X text.", characters: ["y"] },
    });
    expect(report.summary).toContain("一致性问题");
    expect(report.checkedAt).toBeDefined();
  });
});
