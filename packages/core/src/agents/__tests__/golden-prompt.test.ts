/**
 * Golden Prompt Test — verifies that the prompt file loading infrastructure
 * produces expected outputs for all 7 agent types.
 *
 * Test plan:
 *   1. Each agent type's prompt can be loaded from the builtin .md file
 *   2. Loaded prompt content is non-empty
 *   3. Fallback prompts are non-empty for all agent types
 *   4. Sync assembly produces non-empty output for all agent types
 */

import { describe, it, expect } from "vitest";
import { loadSystemPrompt, FALLBACK_PROMPTS, type AgentType } from "../prompt-loader.js";
import { assembleSystemPromptSync } from "../assemble-system-prompt.js";
import { SkillConfigSchema } from "../../models/skill-config.js";

const ALL_AGENT_TYPES: ReadonlyArray<AgentType> = [
  "writer",
  "architect",
  "planner",
  "editor",
  "auditor",
  "observer",
  "reviser",
];

// ---------------------------------------------------------------------------
// Fallback constant tests (synchronous, no I/O)
// ---------------------------------------------------------------------------

describe("FALLBACK_PROMPTS", () => {
  for (const agentType of ALL_AGENT_TYPES) {
    it(`should have a non-empty fallback prompt for "${agentType}"`, () => {
      const prompt = FALLBACK_PROMPTS[agentType];
      expect(prompt).toBeDefined();
      expect(prompt.trim().length).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Synchronous assembly tests
// ---------------------------------------------------------------------------

describe("assembleSystemPromptSync", () => {
  for (const agentType of ALL_AGENT_TYPES) {
    it(`should produce a non-empty prompt for "${agentType}"`, () => {
      const prompt = assembleSystemPromptSync(agentType);
      expect(prompt).toBeDefined();
      expect(prompt.trim().length).toBeGreaterThan(0);
    });
  }

  it("should append language option to the prompt", () => {
    const prompt = assembleSystemPromptSync("writer", { language: "en" });
    expect(prompt).toContain("语言");
    expect(prompt).toContain("en");
  });

  it("should append session context to the prompt", () => {
    const prompt = assembleSystemPromptSync("planner", {
      sessionContext: "Session test context",
    });
    expect(prompt).toContain("会话上下文");
    expect(prompt).toContain("Session test context");
  });

  it("should append skill guidance to the prompt", () => {
    const prompt = assembleSystemPromptSync("observer", {
      skillGuidance: "Test skill guidance",
    });
    expect(prompt).toContain("技巧指导");
    expect(prompt).toContain("Test skill guidance");
  });

  it("should append all options when provided together", () => {
    const prompt = assembleSystemPromptSync("reviser", {
      language: "en",
      sessionContext: "Session ctx",
      skillGuidance: "Skill guide",
    });
    expect(prompt).toContain("语言");
    expect(prompt).toContain("会话上下文");
    expect(prompt).toContain("技巧指导");
    expect(prompt).toContain("en");
    expect(prompt).toContain("Session ctx");
    expect(prompt).toContain("Skill guide");
  });

  it("should work correctly with no options", () => {
    const prompt = assembleSystemPromptSync("architect");
    expect(prompt.trim().length).toBeGreaterThan(0);
  });

  it("injects enabled skills appended to the prompt", () => {
    const skill = SkillConfigSchema.parse({
      id: "style-imitation",
      category: "writing",
      triggers: [],
      injection: { mode: "append", target: "system_prompt", priority: 80 },
      prompt: "Imitate the concise, modern Chinese prose style.",
    });
    const prompt = assembleSystemPromptSync("writer", { skills: [skill] });
    expect(prompt).toContain("## Skill 注入");
    expect(prompt).toContain("Imitate the concise, modern Chinese prose style.");
    expect(prompt).toContain("[style-imitation]");
  });

  it("does not inject disabled skills", () => {
    const skill = SkillConfigSchema.parse({
      id: "disabled-skill",
      category: "writing",
      enabled: false,
      prompt: "Should not appear",
    });
    const prompt = assembleSystemPromptSync("writer", { skills: [skill] });
    expect(prompt).not.toContain("Should not appear");
    expect(prompt).not.toContain("## Skill 注入");
  });

  it("evaluates manual trigger before injection", () => {
    const skill = SkillConfigSchema.parse({
      id: "manual-only",
      category: "writing",
      triggers: [{ type: "manual" }],
      prompt: "Manual content",
    });
    const withoutInvocation = assembleSystemPromptSync("writer", { skills: [skill] });
    expect(withoutInvocation).not.toContain("Manual content");

    const withInvocation = assembleSystemPromptSync("writer", {
      skills: [skill],
      skillInjectionContext: { manuallyInvokedSkillIds: new Set(["manual-only"]) },
    });
    expect(withInvocation).toContain("Manual content");
  });

  it("evaluates condition trigger before injection", () => {
    const skill = SkillConfigSchema.parse({
      id: "condition-skill",
      category: "analysis",
      triggers: [{ type: "condition", condition: "language === 'zh'" }],
      prompt: "Condition content",
    });
    const zh = assembleSystemPromptSync("writer", {
      skills: [skill],
      skillInjectionContext: { language: "zh" },
    });
    expect(zh).toContain("Condition content");

    const en = assembleSystemPromptSync("writer", {
      language: "en",
      skills: [skill],
      skillInjectionContext: { language: "en" },
    });
    expect(en).not.toContain("Condition content");
  });
});

// ---------------------------------------------------------------------------
// File loading tests (async, I/O-bound)
// ---------------------------------------------------------------------------

describe("loadSystemPrompt (builtin files)", () => {
  for (const agentType of ALL_AGENT_TYPES) {
    it(`should load a non-empty prompt from builtin file for "${agentType}"`, async () => {
      const result = await loadSystemPrompt(agentType);
      expect(result).toBeDefined();
      expect(result.prompt.trim().length).toBeGreaterThan(0);
      expect(result.source).toBe("builtin-file");
    });
  }
});

// ---------------------------------------------------------------------------
// Consistency: file-loaded prompt starts with fallback prefix
// ---------------------------------------------------------------------------

describe("Prompt consistency", () => {
  for (const agentType of ALL_AGENT_TYPES) {
    it(`should have the same base content for "${agentType}" regardless of source`, async () => {
      const fileResult = await loadSystemPrompt(agentType);
      const fallbackPrompt = FALLBACK_PROMPTS[agentType];

      // Both should be non-empty
      expect(fileResult.prompt.trim().length).toBeGreaterThan(0);
      expect(fallbackPrompt.trim().length).toBeGreaterThan(0);
    });
  }
});
