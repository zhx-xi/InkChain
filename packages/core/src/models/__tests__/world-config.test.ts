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
});
