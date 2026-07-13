import { describe, expect, it } from "vitest";
import {
  WorldConfigSchema,
  WorldConfigUpdateSchema,
  WorldHistoryEventSchema,
  WorldInstitutionSchema,
  WorldRegionSchema,
  WorldRelationSchema,
  WorldRoleSchema,
  WorldRuleSchema,
  WorldSettingEntrySchema,
  WorldReferenceSchema,
  worldSearch,
  resolveReferences,
  checkReferenceBeforeDelete,
} from "../world-config.js";

function minimalWorld() {
  return {
    id: "test-world",
    name: "Test World",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  };
}

describe("WorldConfig schemas (Issue #77)", () => {
  it("parses a minimal world config", () => {
    const parsed = WorldConfigSchema.parse(minimalWorld());
    expect(parsed.id).toBe("test-world");
    expect(parsed.name).toBe("Test World");
    expect(parsed.settings).toEqual([]);
    expect(parsed.roles).toEqual([]);
    expect(parsed.bookIds).toEqual([]);
  });

  it("parses world config with bookIds (Issue #601)", () => {
    const parsed = WorldConfigSchema.parse({
      ...minimalWorld(),
      bookIds: ["book-1", "book-2"],
    });
    expect(parsed.bookIds).toEqual(["book-1", "book-2"]);
  });

  it("parses all 7 dimensions", () => {
    const parsed = WorldConfigSchema.parse({
      ...minimalWorld(),
      settings: [{
        id: "magic",
        name: "Magic System",
        type: "魔法体系",
        description: "Mana based.",
        constraints: ["No necromancy"],
      }],
      roles: [{
        id: "hero",
        name: "Hero",
        role: "主角",
        description: "Main character.",
        significance: 5,
      }],
      relations: [{
        id: "rivalry",
        sourceId: "hero",
        targetId: "villain",
        type: "敌对",
        description: "Long rivalry.",
      }],
      regions: [{
        id: "capital",
        name: "Capital",
        parentId: null,
        type: "城市",
        description: "Imperial capital.",
      }],
      institutions: [{
        id: "guild",
        name: "Mages Guild",
        type: "组织",
        leaderId: null,
        members: [],
        description: "Spellcasters union.",
      }],
      history: [{
        id: "fall",
        title: "Fall of Empire",
        timestamp: "Year 0",
        description: "The empire fell.",
        affectedRegions: ["capital"],
        significance: 5,
      }],
      rules: [{
        id: "gravity",
        name: "Gravity",
        type: "物理",
        description: "Standard gravity.",
        constraints: ["Cannot fly without magic"],
      }],
    });
    expect(parsed.settings).toHaveLength(1);
    expect(parsed.roles).toHaveLength(1);
    expect(parsed.relations).toHaveLength(1);
    expect(parsed.regions).toHaveLength(1);
    expect(parsed.institutions).toHaveLength(1);
    expect(parsed.history).toHaveLength(1);
    expect(parsed.rules).toHaveLength(1);
  });

  it("rejects invalid setting type", () => {
    expect(() =>
      WorldSettingEntrySchema.parse({
        id: "x",
        name: "X",
        type: "invalid",
        description: "",
        constraints: [],
      })
    ).toThrow();
  });

  it("rejects invalid role significance range", () => {
    expect(() =>
      WorldRoleSchema.parse({
        id: "x",
        name: "X",
        role: "主角",
        description: "",
        significance: 10,
      })
    ).toThrow();
  });

  it("update schema omits id and createdAt", () => {
    const parsed = WorldConfigUpdateSchema.parse({ name: "Updated" });
    expect(parsed).toEqual({ name: "Updated" });
  });

  it("parses world with references (Wrld-5)", () => {
    const parsed = WorldConfigSchema.parse({
      ...minimalWorld(),
      references: [{
        id: "ref1",
        sourceDimension: "roles",
        sourceId: "hero",
        targetDimension: "institutions",
        targetId: "guild",
        label: "member of",
      }],
    });
    expect(parsed.references).toHaveLength(1);
    expect(parsed.references[0].label).toBe("member of");
  });

  it("parses world role with sortIndex and reference fields (Wrld-5)", () => {
    const parsed = WorldRoleSchema.parse({
      id: "hero",
      name: "Hero",
      role: "主角",
      description: "Main character.",
      significance: 5,
      sortIndex: 0,
      institutionIds: ["guild"],
      regionIds: [],
    });
    expect(parsed.sortIndex).toBe(0);
    expect(parsed.institutionIds).toEqual(["guild"]);
  });

  it("parses world region with sortIndex (Wrld-5)", () => {
    const parsed = WorldRegionSchema.parse({
      id: "capital",
      name: "Capital",
      parentId: null,
      type: "城市",
      description: "Imperial capital.",
      sortIndex: 1,
    });
    expect(parsed.sortIndex).toBe(1);
  });

  it("parses world institution with sortIndex and regionId (Wrld-5)", () => {
    const parsed = WorldInstitutionSchema.parse({
      id: "guild",
      name: "Mages Guild",
      type: "组织",
      leaderId: null,
      members: [],
      description: "Spellcasters union.",
      sortIndex: 2,
      regionId: "capital",
    });
    expect(parsed.sortIndex).toBe(2);
    expect(parsed.regionId).toBe("capital");
  });
});

describe("worldSearch (Wrld-5)", () => {
  const world = WorldConfigSchema.parse({
    id: "test",
    name: "Test",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    settings: [{ id: "s1", name: "魔法体系", type: "魔法体系", description: "Mana based magic", constraints: [], sortIndex: 0 }],
    roles: [{ id: "r1", name: "英雄", role: "主角", description: "A brave hero", significance: 5, sortIndex: 0, institutionIds: [], regionIds: [] }],
    regions: [{ id: "reg1", name: "龙之国", type: "国家", description: "Dragon kingdom", parentId: null, sortIndex: 0 }],
    rules: [{ id: "rule1", name: "重力", type: "物理", description: "Standard gravity", constraints: [], sortIndex: 0 }],
  });

  it("finds results matching query across dimensions", () => {
    const results = worldSearch(world, "magic");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.dimension === "settings")).toBe(true);
  });

  it("returns empty for unmatched query", () => {
    const results = worldSearch(world, "zzzznotfound");
    expect(results).toHaveLength(0);
  });

  it("filters by dimension", () => {
    const results = worldSearch(world, "hero", "roles");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((r) => r.dimension === "roles")).toBe(true);
  });

  it("returns empty for empty query", () => {
    expect(worldSearch(world, "")).toHaveLength(0);
    expect(worldSearch(world, "   ")).toHaveLength(0);
  });
});

describe("resolveReferences (Wrld-5)", () => {
  const world = WorldConfigSchema.parse({
    id: "test",
    name: "Test",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    roles: [{ id: "r1", name: "英雄", role: "主角", description: "", significance: 3, sortIndex: 0, institutionIds: [], regionIds: [] }],
    institutions: [{ id: "i1", name: "冒险者公会", type: "组织", leaderId: null, members: [], description: "", sortIndex: 0, regionId: null }],
    references: [{
      id: "ref1",
      sourceDimension: "roles",
      sourceId: "r1",
      targetDimension: "institutions",
      targetId: "i1",
      label: "member",
    }],
  });

  it("resolves reference names", () => {
    const resolved = resolveReferences(world);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].sourceName).toBe("英雄");
    expect(resolved[0].targetName).toBe("冒险者公会");
  });
});

describe("checkReferenceBeforeDelete (Wrld-5)", () => {
  const world = WorldConfigSchema.parse({
    id: "test",
    name: "Test",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    references: [
      { id: "r1", sourceDimension: "roles", sourceId: "hero", targetDimension: "institutions", targetId: "guild", label: "" },
      { id: "r2", sourceDimension: "settings", sourceId: "magic", targetDimension: "roles", targetId: "hero", label: "" },
    ],
  });

  it("finds references for entity as source", () => {
    const refs = checkReferenceBeforeDelete(world, "roles", "hero");
    expect(refs).toHaveLength(2);
  });

  it("finds references for entity as target", () => {
    const refs = checkReferenceBeforeDelete(world, "institutions", "guild");
    expect(refs).toHaveLength(1);
    expect(refs[0].id).toBe("r1");
  });

  it("returns empty for entity with no references", () => {
    const refs = checkReferenceBeforeDelete(world, "regions", "nonexistent");
    expect(refs).toHaveLength(0);
  });
});
