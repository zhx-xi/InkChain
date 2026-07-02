// ── Tests: Relation Labeler (Issue #99 — R-15) ──

import { describe, expect, it } from "vitest";
import {
  suggestRelations,
  filterSuggestionsByConfidence,
  findSuggestionForPair,
  toExistingRelationType,
  type CharacterProfileForLabeling,
  type RelationSuggestion,
} from "../relation-labeler.js";

function makeChar(overrides: Partial<CharacterProfileForLabeling>): CharacterProfileForLabeling {
  return {
    id: `char-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: "测试角色",
    description: "",
    dialogues: [],
    ...overrides,
  };
}

describe("suggestRelations (R-15)", () => {
  it("detects family relation from description keywords", () => {
    const a = makeChar({ id: "a1", name: "张三", description: "张三是一个普通的少年，父亲早逝。" });
    const b = makeChar({ id: "b1", name: "李四", description: "李四是张三的兄弟，两人一起长大。" });
    const result = suggestRelations({ characters: [a, b] });
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(result.suggestions[0].suggestedRelation).toBe("family");
    expect(result.suggestions[0].confidence).toBeGreaterThan(0.3);
  });

  it("detects mentor relation", () => {
    const a = makeChar({ id: "a2", name: "王五", description: "王五是剑术大师，收了很多徒弟。" });
    const b = makeChar({ id: "b2", name: "陈六", description: "陈六拜王五为师，学习剑术。" });
    const result = suggestRelations({ characters: [a, b] });
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(result.suggestions[0].suggestedRelation).toBe("mentor");
  });

  it("detects love relation from dialogue", () => {
    const a = makeChar({ id: "a3", name: "小美", description: "小美是个温柔的女孩。", dialogues: ["我喜欢你，阿强。"] });
    const b = makeChar({ id: "b3", name: "阿强", description: "阿强一直暗恋小美。" });
    const result = suggestRelations({ characters: [a, b] });
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(result.suggestions[0].suggestedRelation).toBe("love");
  });

  it("detects enemy relation", () => {
    const a = makeChar({ id: "a4", name: "正派", description: "正派与邪教不共戴天，誓要报仇。" });
    const b = makeChar({ id: "b4", name: "邪派", description: "邪派是正派的死对头。" });
    const result = suggestRelations({ characters: [a, b] });
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(["enemy", "rival"]).toContain(result.suggestions[0].suggestedRelation);
  });

  it("skips existing relations", () => {
    const a = makeChar({ id: "a5", name: "甲" });
    const b = makeChar({ id: "b5", name: "乙" });
    const existing = [
      {
        id: "rel-existing",
        sourceRoleId: "a5",
        targetRoleId: "b5",
        relationType: "close_friend" as const,
        description: "朋友",
        validFromChapter: 1,
        intensity: 3,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];
    const result = suggestRelations({ characters: [a, b], existingRelations: existing });
    // Should not suggest neutral for existing pairs
    const pairSuggestions = result.suggestions.filter((s) =>
      [s.sourceId, s.targetId].sort().join("::") === ["a5", "b5"].sort().join("::"),
    );
    expect(pairSuggestions.length).toBe(0);
  });

  it("returns results sorted by confidence descending", () => {
    const chars: CharacterProfileForLabeling[] = [
      makeChar({ id: "c1", name: "父亲", description: "父亲是个严厉的人，对儿子要求很高。" }),
      makeChar({ id: "c2", name: "儿子", description: "儿子很怕父亲，但也敬爱他。" }),
      makeChar({ id: "c3", name: "老师", description: "老师是儿子的授业恩师。" }),
    ];
    const result = suggestRelations({ characters: chars });
    for (let i = 1; i < result.suggestions.length; i++) {
      expect(result.suggestions[i].confidence).toBeLessThanOrEqual(
        result.suggestions[i - 1].confidence,
      );
    }
  });

  it("returns neutral for unrelated characters", () => {
    const a = makeChar({ id: "d1", name: "路人甲", description: "一个无关的路人。" });
    const b = makeChar({ id: "d2", name: "路人乙", description: "另一个无关的路人。" });
    const result = suggestRelations({ characters: [a, b] });
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(result.suggestions[0].suggestedRelation).toBe("neutral");
  });
});

describe("filterSuggestionsByConfidence", () => {
  it("filters low-confidence suggestions", () => {
    const suggestions: RelationSuggestion[] = [
      { sourceId: "a", targetId: "b", suggestedRelation: "ally", confidence: 0.8, evidence: ["x"] },
      { sourceId: "c", targetId: "d", suggestedRelation: "neutral", confidence: 0.15, evidence: ["y"] },
    ];
    const filtered = filterSuggestionsByConfidence(suggestions, 0.3);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].confidence).toBe(0.8);
  });
});

describe("findSuggestionForPair", () => {
  it("finds the best suggestion for a specific character pair", () => {
    const suggestions: RelationSuggestion[] = [
      { sourceId: "a", targetId: "b", suggestedRelation: "ally", confidence: 0.5, evidence: ["x"] },
      { sourceId: "a", targetId: "b", suggestedRelation: "family", confidence: 0.7, evidence: ["y"] },
    ];
    const found = findSuggestionForPair(suggestions, "a", "b");
    expect(found).toBeDefined();
    expect(found!.suggestedRelation).toBe("family");
    expect(found!.confidence).toBe(0.7);
  });
});

describe("toExistingRelationType", () => {
  it("maps ally to alliance", () => {
    expect(toExistingRelationType("ally")).toBe("alliance");
  });
  it("maps enemy to rival", () => {
    expect(toExistingRelationType("enemy")).toBe("rival");
  });
  it("maps family to blood", () => {
    expect(toExistingRelationType("family")).toBe("blood");
  });
  it("maps love to secret_crush", () => {
    expect(toExistingRelationType("love")).toBe("secret_crush");
  });
  it("maps mentor to mentor", () => {
    expect(toExistingRelationType("mentor")).toBe("mentor");
  });
  it("maps rival to rival", () => {
    expect(toExistingRelationType("rival")).toBe("rival");
  });
});
