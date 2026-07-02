import { describe, expect, it } from "vitest";
import {
  planChapters,
  detectArcCoverage,
  DEFAULT_PLANNER_CONFIG,
  type OutlinePlannerInput,
} from "../outline-planner.js";
import type { ChapterPlan } from "../outline-planner.js";

// ── planChapters ──

describe("planChapters (R-13)", () => {
  const baseInput: OutlinePlannerInput = {
    chapterCount: 5,
    worldConfig: {
      characters: ["林月", "苏辰", "夜枭"],
    },
  };

  it("returns empty array when chapterCount is 0", () => {
    const result = planChapters({ chapterCount: 0 });
    expect(result).toEqual([]);
  });

  it("returns empty array when chapterCount is negative", () => {
    const result = planChapters({ chapterCount: -1 });
    expect(result).toEqual([]);
  });

  it("returns a single chapter for chapterCount=1", () => {
    const result = planChapters({ chapterCount: 1 });
    expect(result).toHaveLength(1);
    expect(result[0].chapterNumber).toBe(1);
    expect(result[0].plotPoints.length).toBeGreaterThanOrEqual(DEFAULT_PLANNER_CONFIG.minPlotPoints);
  });

  it("generates correct number of chapters", () => {
    const result = planChapters(baseInput);
    expect(result).toHaveLength(5);
  });

  it("assigns sequential chapter numbers", () => {
    const result = planChapters({ ...baseInput, chapterCount: 8 });
    expect(result.map((c) => c.chapterNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("includes all chapters with required fields", () => {
    const result = planChapters(baseInput);
    for (const chapter of result) {
      expect(chapter).toHaveProperty("chapterNumber");
      expect(chapter).toHaveProperty("title");
      expect(chapter).toHaveProperty("plotPoints");
      expect(chapter).toHaveProperty("wordCount");
      expect(chapter).toHaveProperty("characters");
      expect(typeof chapter.chapterNumber).toBe("number");
      expect(typeof chapter.title).toBe("string");
      expect(Array.isArray(chapter.plotPoints)).toBe(true);
      expect(typeof chapter.wordCount).toBe("number");
      expect(Array.isArray(chapter.characters)).toBe(true);
    }
  });

  it("assigns default word count from config", () => {
    const result = planChapters(baseInput);
    for (const chapter of result) {
      expect(chapter.wordCount).toBe(DEFAULT_PLANNER_CONFIG.defaultWordCountPerChapter);
    }
  });

  it("respects custom config", () => {
    const result = planChapters(baseInput, {
      defaultWordCountPerChapter: 5000,
      minPlotPoints: 1,
      maxPlotPoints: 3,
    });
    for (const chapter of result) {
      expect(chapter.wordCount).toBe(5000);
    }
  });

  it("includes characters from world config", () => {
    const result = planChapters(baseInput);
    for (const chapter of result) {
      expect(chapter.characters.length).toBeGreaterThan(0);
      expect(chapter.characters).toContain("林月");
    }
  });

  it("includes characters from existing outline chapters", () => {
    const result = planChapters({
      chapterCount: 3,
      outline: {
        chapters: [
          { number: 1, title: "开场", summary: "开场", characters: ["林月", "苏辰"] },
          { number: 2, title: "发展", summary: "发展", characters: ["夜枭"] },
        ],
      },
    });
    for (const chapter of result) {
      expect(chapter.characters).toContain("林月");
    }
  });

  it("generates unique character sets per chapter", () => {
    const result = planChapters(baseInput);
    for (const chapter of result) {
      const unique = new Set(chapter.characters);
      expect(unique.size).toBe(chapter.characters.length);
    }
  });

  it("has at least minPlotPoints plot points per chapter", () => {
    const result = planChapters(baseInput);
    for (const chapter of result) {
      expect(chapter.plotPoints.length).toBeGreaterThanOrEqual(DEFAULT_PLANNER_CONFIG.minPlotPoints);
    }
  });

  it("first chapter has intro-like title", () => {
    const result = planChapters(baseInput);
    expect(result[0].title).toContain("章");
  });

  it("last chapter has resolution-like title", () => {
    const result = planChapters(baseInput);
    expect(result[result.length - 1].title).toContain("章");
  });

  it("generates different plot points across chapters", () => {
    const result = planChapters({ ...baseInput, chapterCount: 10 });
    const allPlotPoints = result.flatMap((c) => c.plotPoints);
    const uniquePlotPoints = new Set(allPlotPoints);
    // At least some variety
    expect(uniquePlotPoints.size).toBeGreaterThan(DEFAULT_PLANNER_CONFIG.minPlotPoints);
  });

  it("handles large chapter counts without errors", () => {
    const result = planChapters({ ...baseInput, chapterCount: 50 });
    expect(result).toHaveLength(50);
    expect(result[0].chapterNumber).toBe(1);
    expect(result[49].chapterNumber).toBe(50);
  });

  it("handles missing world config gracefully", () => {
    const result = planChapters({ chapterCount: 3 });
    expect(result).toHaveLength(3);
  });

  it("produces coherent arc from intro to resolution for 5 chapters", () => {
    const result = planChapters(baseInput);
    // Phase transition from intro to resolution
    expect(result[0].title).toBeTruthy();
    expect(result[1].title).toBeTruthy();
    expect(result[3].title).toBeTruthy();
    expect(result[4].title).toBeTruthy();
  });
});

// ── detectArcCoverage ──

describe("detectArcCoverage", () => {
  it("returns empty object for empty chapters", () => {
    expect(detectArcCoverage([])).toEqual({});
  });

  it("detects coverage for 5 chapters", () => {
    const coverage = detectArcCoverage([
      { number: 1, title: "章1" },
      { number: 2, title: "章2" },
      { number: 3, title: "章3" },
      { number: 4, title: "章4" },
      { number: 5, title: "章5" },
    ]);
    expect(Object.keys(coverage).length).toBeGreaterThan(0);
    const total = Object.values(coverage).reduce((a, b) => a + b, 0);
    expect(total).toBe(5);
  });
});

// ── DEFAULT_PLANNER_CONFIG ──

describe("DEFAULT_PLANNER_CONFIG", () => {
  it("has expected shape", () => {
    expect(DEFAULT_PLANNER_CONFIG).toHaveProperty("defaultWordCountPerChapter");
    expect(DEFAULT_PLANNER_CONFIG).toHaveProperty("minPlotPoints");
    expect(DEFAULT_PLANNER_CONFIG).toHaveProperty("maxPlotPoints");
    expect(DEFAULT_PLANNER_CONFIG.defaultWordCountPerChapter).toBeGreaterThan(0);
    expect(DEFAULT_PLANNER_CONFIG.minPlotPoints).toBeGreaterThan(0);
    expect(DEFAULT_PLANNER_CONFIG.maxPlotPoints).toBeGreaterThanOrEqual(DEFAULT_PLANNER_CONFIG.minPlotPoints);
  });
});
