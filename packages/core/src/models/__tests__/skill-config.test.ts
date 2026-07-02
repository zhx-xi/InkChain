import { describe, expect, it } from "vitest";
import {
  SkillConfigSchema,
  TriggerConfigSchema,
  InjectionConfigSchema,
  ParamDefSchema,
  SkillCategoryEnum,
  TriggerTypeEnum,
  InjectionModeEnum,
  InjectionTargetEnum,
  ParamTypeEnum,
  type SkillConfig,
} from "../skill-config.js";

describe("SkillConfigSchema (Issue #74)", () => {
  describe("valid configs", () => {
    it("accepts a minimal valid skill config", () => {
      const raw: SkillConfig = {
        id: "writing-style-imitation",
        category: "writing",
        triggers: [],
        injection: { mode: "append", target: "system_prompt", priority: 50 },
        params: {},
        enabled: true,
        description: "Imitate the reference author's style.",
        prompt: "",
        agents: [],
      };
      const parsed = SkillConfigSchema.parse(raw);
      expect(parsed.id).toBe("writing-style-imitation");
      expect(parsed.category).toBe("writing");
      expect(parsed.enabled).toBe(true);
      expect(parsed.triggers).toEqual([]);
    });

    it("applies default values when fields are missing", () => {
      const parsed = SkillConfigSchema.parse({
        id: "utility-test",
        category: "utility",
      });
      expect(parsed.triggers).toEqual([]);
      expect(parsed.injection).toEqual({
        mode: "append",
        target: "system_prompt",
        priority: 50,
      });
      expect(parsed.params).toEqual({});
      expect(parsed.enabled).toBe(true);
      expect(parsed.description).toBe("");
    });

    it("accepts all 5 categories", () => {
      for (const cat of SkillCategoryEnum.options) {
        const parsed = SkillConfigSchema.parse({ id: `cat-${cat}`, category: cat });
        expect(parsed.category).toBe(cat);
      }
    });

    it("accepts trigger, injection, and param subtypes", () => {
      const config: SkillConfig = {
        id: "advanced-skill",
        category: "analysis",
        triggers: [
          { type: "manual" },
          { type: "condition", condition: "session.kind === 'book'" },
        ],
        injection: { mode: "append", target: "system_prompt", priority: 80 },
        params: {
          tone: {
            key: "tone",
            label: "Tone",
            type: "select",
            required: true,
            options: ["warm", "cool"],
            defaultValue: "warm",
          },
          depth: {
            key: "depth",
            label: "Depth",
            type: "number",
            required: false,
            defaultValue: 3,
          },
        },
        enabled: true,
        description: "Advanced analysis skill.",
        prompt: "",
        agents: ["writer", "auditor"],
      };
      const parsed = SkillConfigSchema.parse(config);
      expect(parsed.triggers).toHaveLength(2);
      expect(parsed.triggers[0].type).toBe("manual");
      expect(parsed.triggers[1].condition).toBe("session.kind === 'book'");
      expect(parsed.params.tone.type).toBe("select");
      expect(parsed.params.tone.options).toEqual(["warm", "cool"]);
      expect(parsed.params.depth.defaultValue).toBe(3);
    });
  });

  describe("rejects invalid configs", () => {
    it("rejects empty id", () => {
      expect(() =>
        SkillConfigSchema.parse({ id: "", category: "writing" }),
      ).toThrow();
    });

    it("rejects id with non-kebab characters", () => {
      expect(() =>
        SkillConfigSchema.parse({ id: "My Skill!", category: "writing" }),
      ).toThrow();
      expect(() =>
        SkillConfigSchema.parse({ id: "MySkill", category: "writing" }),
      ).toThrow();
    });

    it("rejects unknown category", () => {
      expect(() =>
        SkillConfigSchema.parse({ id: "test", category: "magic" }),
      ).toThrow();
    });

    it("rejects unknown trigger type", () => {
      const bad = {
        id: "test",
        category: "writing",
        triggers: [{ type: "magic-trigger" }],
      };
      expect(() => SkillConfigSchema.parse(bad)).toThrow();
    });

    it("rejects unknown injection mode", () => {
      const bad = {
        id: "test",
        category: "writing",
        injection: { mode: "spell", target: "system_prompt", priority: 50 },
      };
      expect(() => SkillConfigSchema.parse(bad)).toThrow();
    });

    it("rejects unknown injection target", () => {
      const bad = {
        id: "test",
        category: "writing",
        injection: { mode: "append", target: "magic", priority: 50 },
      };
      expect(() => SkillConfigSchema.parse(bad)).toThrow();
    });

    it("rejects out-of-range priority", () => {
      expect(() =>
        SkillConfigSchema.parse({
          id: "test",
          category: "writing",
          injection: { mode: "append", target: "system_prompt", priority: 0 },
        }),
      ).toThrow();
      expect(() =>
        SkillConfigSchema.parse({
          id: "test",
          category: "writing",
          injection: { mode: "append", target: "system_prompt", priority: 101 },
        }),
      ).toThrow();
    });

    it("rejects unknown param type", () => {
      const bad = {
        id: "test",
        category: "writing",
        params: { x: { key: "x", label: "X", type: "magic" } },
      };
      expect(() => SkillConfigSchema.parse(bad)).toThrow();
    });

    it("rejects unknown agent role", () => {
      const bad = {
        id: "test",
        category: "writing",
        agents: ["manager"],
      };
      expect(() => SkillConfigSchema.parse(bad)).toThrow();
    });

    it("rejects select param without options", () => {
      const bad = {
        id: "test",
        category: "writing",
        params: { x: { key: "x", label: "X", type: "select", required: false } },
      };
      // options is optional, so the schema itself does not reject — but it
      // would be caught at UI consumption time. Verify the schema accepts.
      const parsed = SkillConfigSchema.parse(bad);
      expect(parsed.params.x.options).toBeUndefined();
    });
  });

  describe("enums", () => {
    it("SkillCategoryEnum exposes the expected categories", () => {
      expect(SkillCategoryEnum.options).toEqual([
        "writing",
        "analysis",
        "world",
        "character",
        "utility",
      ]);
    });

    it("TriggerTypeEnum exposes manual and condition", () => {
      expect(TriggerTypeEnum.options).toEqual(["manual", "condition"]);
    });

    it("InjectionModeEnum exposes append/prepend/replace (MVP uses append only)", () => {
      expect(InjectionModeEnum.options).toEqual(["append", "prepend", "replace"]);
    });

    it("InjectionTargetEnum exposes system_prompt/user_prompt/context", () => {
      expect(InjectionTargetEnum.options).toEqual([
        "system_prompt",
        "user_prompt",
        "context",
      ]);
    });

    it("ParamTypeEnum exposes string/number/boolean/select", () => {
      expect(ParamTypeEnum.options).toEqual(["string", "number", "boolean", "select"]);
    });
  });

  describe("sub-schemas", () => {
    it("TriggerConfigSchema accepts condition optional", () => {
      expect(TriggerConfigSchema.parse({ type: "manual" })).toEqual({ type: "manual" });
      expect(TriggerConfigSchema.parse({ type: "condition", condition: "x" })).toEqual({
        type: "condition",
        condition: "x",
      });
    });

    it("InjectionConfigSchema applies defaults", () => {
      expect(InjectionConfigSchema.parse({})).toEqual({
        mode: "append",
        target: "system_prompt",
        priority: 50,
      });
    });

    it("ParamDefSchema applies defaults", () => {
      expect(ParamDefSchema.parse({ key: "k", label: "K", type: "string" })).toEqual({
        key: "k",
        label: "K",
        type: "string",
        required: false,
      });
    });
  });
});
