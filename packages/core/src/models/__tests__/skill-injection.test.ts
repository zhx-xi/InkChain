import { describe, expect, it } from "vitest";
import {
  shouldInjectSkill,
  injectSkillsIntoPrompt,
  filterEnabledSkills,
} from "../skill-injection.js";
import { SkillConfigSchema, TriggerTypeEnum, InjectionModeEnum, InjectionTargetEnum } from "../skill-config.js";
import type { SkillConfig } from "../skill-config.js";

function makeSkill(overrides: Partial<SkillConfig> = {}): SkillConfig {
  return SkillConfigSchema.parse({
    id: "test-skill",
    category: "writing",
    ...overrides,
  });
}

describe("shouldInjectSkill", () => {
  it("returns true for enabled skills with no triggers", () => {
    const skill = makeSkill({ enabled: true, triggers: [] });
    expect(shouldInjectSkill(skill, {})).toBe(true);
  });

  it("returns false for disabled skills", () => {
    const skill = makeSkill({ enabled: false, triggers: [] });
    expect(shouldInjectSkill(skill, {})).toBe(false);
  });

  it("returns false for manual trigger when not invoked", () => {
    const skill = makeSkill({
      triggers: [{ type: TriggerTypeEnum.enum.manual }],
    });
    expect(shouldInjectSkill(skill, {})).toBe(false);
  });

  it("returns true for manual trigger when invoked", () => {
    const skill = makeSkill({
      id: "manual-skill",
      triggers: [{ type: TriggerTypeEnum.enum.manual }],
    });
    expect(shouldInjectSkill(skill, { manuallyInvokedSkillIds: new Set(["manual-skill"]) })).toBe(true);
  });

  it("evaluates condition trigger against sessionKind", () => {
    const skill = makeSkill({
      triggers: [{ type: TriggerTypeEnum.enum.condition, condition: "sessionKind === 'book'" }],
    });
    expect(shouldInjectSkill(skill, { sessionKind: "book" })).toBe(true);
    expect(shouldInjectSkill(skill, { sessionKind: "chat" })).toBe(false);
  });

  it("evaluates condition trigger against language", () => {
    const skill = makeSkill({
      triggers: [{ type: TriggerTypeEnum.enum.condition, condition: "language === 'zh'" }],
    });
    expect(shouldInjectSkill(skill, { language: "zh" })).toBe(true);
    expect(shouldInjectSkill(skill, { language: "en" })).toBe(false);
  });

  it("evaluates condition trigger against custom variables", () => {
    const skill = makeSkill({
      triggers: [{ type: TriggerTypeEnum.enum.condition, condition: "genre === 'fantasy'" }],
    });
    expect(shouldInjectSkill(skill, { variables: { genre: "fantasy" } })).toBe(true);
    expect(shouldInjectSkill(skill, { variables: { genre: "sci-fi" } })).toBe(false);
  });

  it("treats failing condition as non-matching", () => {
    const skill = makeSkill({
      triggers: [{ type: TriggerTypeEnum.enum.condition, condition: "unknownVar === 1" }],
    });
    expect(shouldInjectSkill(skill, {})).toBe(false);
  });

  it("matches any trigger in a multi-trigger skill", () => {
    const skill = makeSkill({
      id: "multi-skill",
      triggers: [
        { type: TriggerTypeEnum.enum.manual },
        { type: TriggerTypeEnum.enum.condition, condition: "sessionKind === 'book'" },
      ],
    });
    expect(shouldInjectSkill(skill, { sessionKind: "book" })).toBe(true);
    expect(shouldInjectSkill(skill, { manuallyInvokedSkillIds: new Set(["multi-skill"]) })).toBe(true);
    expect(shouldInjectSkill(skill, {})).toBe(false);
  });
});

describe("injectSkillsIntoPrompt", () => {
  it("returns the base prompt when no skills match", () => {
    const base = "Base prompt";
    const skill = makeSkill({ enabled: false, prompt: "Should not appear" });
    const result = injectSkillsIntoPrompt(base, [skill], {});
    expect(result.prompt).toBe(base);
    expect(result.injectedSkillIds).toEqual([]);
    expect(result.skippedSkillIds).toEqual(["test-skill"]);
  });

  it("appends matching enabled skills by priority descending", () => {
    const base = "Base prompt";
    const skills = [
      makeSkill({ id: "low", prompt: "Low priority", injection: { mode: "append", target: "system_prompt", priority: 10 } }),
      makeSkill({ id: "high", prompt: "High priority", injection: { mode: "append", target: "system_prompt", priority: 90 } }),
      makeSkill({ id: "mid", prompt: "Mid priority", injection: { mode: "append", target: "system_prompt", priority: 50 } }),
    ];
    const result = injectSkillsIntoPrompt(base, skills, {});
    expect(result.injectedSkillIds).toEqual(["high", "mid", "low"]);
    const lines = result.prompt.split("\n");
    const highIndex = lines.findIndex((l) => l.includes("[high]"));
    const midIndex = lines.findIndex((l) => l.includes("[mid]"));
    const lowIndex = lines.findIndex((l) => l.includes("[low]"));
    expect(highIndex).toBeLessThan(midIndex);
    expect(midIndex).toBeLessThan(lowIndex);
  });

  it("prepends matching prepend-mode skills before base prompt", () => {
    const base = "Base prompt";
    const skill = makeSkill({
      id: "prep",
      prompt: "Prepend content",
      injection: { mode: InjectionModeEnum.enum.prepend, target: "system_prompt", priority: 99 },
    });
    const result = injectSkillsIntoPrompt(base, [skill], {});
    expect(result.injectedSkillIds).toEqual(["prep"]);
    expect(result.prompt).toContain("Prepend content");
    expect(result.prompt.indexOf("Prepend content")).toBeLessThan(result.prompt.indexOf("Base prompt"));
  });

  it("replaces base prompt with highest-priority replace-mode skill", () => {
    const base = "Base prompt";
    const low = makeSkill({
      id: "replace-low",
      prompt: "Low priority replace",
      injection: { mode: InjectionModeEnum.enum.replace, target: "system_prompt", priority: 30 },
    });
    const high = makeSkill({
      id: "replace-high",
      prompt: "High priority replace",
      injection: { mode: InjectionModeEnum.enum.replace, target: "system_prompt", priority: 90 },
    });
    const result = injectSkillsIntoPrompt(base, [low, high], {});
    expect(result.injectedSkillIds).toEqual(["replace-high"]);
    expect(result.prompt).toContain("High priority replace");
    expect(result.prompt).not.toContain("Base prompt");
    expect(result.prompt).not.toContain("Low priority replace");
  });

  it("combines prepend + append skills together", () => {
    const base = "Core prompt";
    const prep = makeSkill({
      id: "prep",
      prompt: "Prepend",
      injection: { mode: InjectionModeEnum.enum.prepend, target: "system_prompt", priority: 50 },
    });
    const app = makeSkill({
      id: "app",
      prompt: "Append",
      injection: { mode: "append", target: "system_prompt", priority: 50 },
    });
    const result = injectSkillsIntoPrompt(base, [prep, app], {});
    expect(result.injectedSkillIds).toEqual(["app", "prep"]); // append listed first, then prepend
    const prompt = result.prompt;
    expect(prompt).toContain("Prepend");
    expect(prompt).toContain("Core prompt");
    expect(prompt).toContain("Append");
    // Order: prepend block → base prompt → append block
    expect(prompt.indexOf("Prepend")).toBeLessThan(prompt.indexOf("Core prompt"));
    expect(prompt.indexOf("Core prompt")).toBeLessThan(prompt.indexOf("Append"));
  });

  it("ignores skills targeting non-system_prompt targets", () => {
    const base = "Base prompt";
    const skill = makeSkill({
      id: "user-target",
      prompt: "Ignored",
      injection: { mode: "append", target: InjectionTargetEnum.enum.user_prompt, priority: 99 },
    });
    const result = injectSkillsIntoPrompt(base, [skill], {});
    expect(result.prompt).toBe(base);
    expect(result.injectedSkillIds).toEqual([]);
  });

  it("ignores empty prompts", () => {
    const base = "Base prompt";
    const skill = makeSkill({ id: "empty", prompt: "   " });
    const result = injectSkillsIntoPrompt(base, [skill], {});
    expect(result.prompt).toBe(base);
    expect(result.injectedSkillIds).toEqual([]);
  });

  it("respects manual triggers only when invoked", () => {
    const base = "Base";
    const skill = makeSkill({
      id: "manual",
      prompt: "Manual skill",
      triggers: [{ type: TriggerTypeEnum.enum.manual }],
    });
    const notInvoked = injectSkillsIntoPrompt(base, [skill], {});
    expect(notInvoked.injectedSkillIds).toEqual([]);

    const invoked = injectSkillsIntoPrompt(base, [skill], { manuallyInvokedSkillIds: new Set(["manual"]) });
    expect(invoked.injectedSkillIds).toEqual(["manual"]);
    expect(invoked.prompt).toContain("Manual skill");
  });

  it("produces English output when requested", () => {
    const base = "Base prompt";
    const skill = makeSkill({ id: "s1", prompt: "Body" });
    const result = injectSkillsIntoPrompt(base, [skill], {}, false);
    expect(result.prompt).toContain("## Skill Injection");
    expect(result.prompt).toContain("automatically injected");
  });
});

describe("filterEnabledSkills", () => {
  it("keeps only enabled skills", () => {
    const skills = [
      makeSkill({ id: "a", enabled: true }),
      makeSkill({ id: "b", enabled: false }),
      makeSkill({ id: "c", enabled: true }),
    ];
    expect(filterEnabledSkills(skills).map((s) => s.id)).toEqual(["a", "c"]);
  });
});
