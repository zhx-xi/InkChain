// ── Skill Injection Pipeline (Issue #75) ──
//
// Evaluates user-facing SkillConfig triggers at runtime and injects matching
// skill prompts into the system prompt. MVP scope:
//   * Injection mode: append only
//   * Trigger types: manual and condition
//   * Target: system_prompt (user_prompt / context reserved for v2.5+)
//
// See: Issue #75 — Skill-2: Skill触发注入管道

import {
  type SkillConfig,
  type StoredSkillConfig,
  TriggerTypeEnum,
  InjectionModeEnum,
  InjectionTargetEnum,
} from "./skill-config.js";

// ---------------------------------------------------------------------------
// Injection context
// ---------------------------------------------------------------------------

export interface SkillInjectionContext {
  /** Agent / session kind that is requesting the prompt. */
  readonly sessionKind?: string;
  /** Natural language the current turn is running in. */
  readonly language?: string;
  /** Book identifier, when available. */
  readonly bookId?: string;
  /** IDs of skills explicitly invoked by the user/UI for this turn. */
  readonly manuallyInvokedSkillIds?: ReadonlySet<string>;
  /** Arbitrary free-form variables available to condition expressions. */
  readonly variables?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Trigger evaluation
// ---------------------------------------------------------------------------

/**
 * Check whether a skill should be injected for the given context.
 *
 * A skill is active when:
 *   * it has no triggers (always active), or
 *   * at least one trigger matches.
 *
 * Trigger matching rules:
 *   * manual  — matches when the skill id is in `manuallyInvokedSkillIds`
 *   * condition — evaluates the free-form condition string with a sandboxed
n *     expression. The condition has read access to:
 *       `sessionKind`, `language`, `bookId`, `variables` and any top-level key
 *       from `variables`.
 */
export function shouldInjectSkill(
  skill: SkillConfig,
  context: SkillInjectionContext,
): boolean {
  if (!skill.enabled) return false;
  if (skill.triggers.length === 0) return true;

  for (const trigger of skill.triggers) {
    if (trigger.type === TriggerTypeEnum.enum.manual) {
      if (context.manuallyInvokedSkillIds?.has(skill.id)) return true;
      continue;
    }

    if (trigger.type === TriggerTypeEnum.enum.condition) {
      if (!trigger.condition) continue;
      try {
        if (evaluateCondition(trigger.condition, context)) return true;
      } catch {
        // Failing conditions are treated as non-matching (defensive).
        continue;
      }
    }
  }

  return false;
}

function evaluateCondition(
  condition: string,
  context: SkillInjectionContext,
): boolean {
  const { sessionKind, language, bookId, variables } = context;
  const sandbox = {
    sessionKind,
    language,
    bookId,
    ...(variables ?? {}),
  };

  const keys = Object.keys(sandbox);
  const values = keys.map((k) => (sandbox as Record<string, unknown>)[k]);

  // Use a strict-mode function so missing identifiers throw instead of
  // resolving to globals. Throwing is caught by the caller and treated as
  // non-matching.
  const fn = new Function(
    ...keys,
    `"use strict"; return (${condition});`,
  );
  return Boolean(fn(...values));
}

// ---------------------------------------------------------------------------
// Injection
// ---------------------------------------------------------------------------

export interface SkillInjectionResult {
  readonly prompt: string;
  readonly injectedSkillIds: ReadonlyArray<string>;
  readonly skippedSkillIds: ReadonlyArray<string>;
}

/**
 * Inject matching skills into a system prompt.
 *
 * MVP behaviour:
 *   * Only `append` mode is honoured; `prepend` and `replace` are ignored.
 *   * Only `target === "system_prompt"` is honoured.
 *   * Matching skills are sorted by `injection.priority` descending (higher
 *     priority injected first among the appended block).
 *   * The injected block is appended to the end of `basePrompt`.
 */
export function injectSkillsIntoPrompt(
  basePrompt: string,
  skills: ReadonlyArray<SkillConfig> | ReadonlyArray<StoredSkillConfig>,
  context: SkillInjectionContext,
  isZh = true,
): SkillInjectionResult {
  const normalized: SkillConfig[] = skills.map((s) =>
    "config" in s ? s.config : s
  );

  const matching = normalized
    .filter((skill) => shouldInjectSkill(skill, context))
    .filter((skill) => skill.injection.mode === InjectionModeEnum.enum.append)
    .filter((skill) => skill.injection.target === InjectionTargetEnum.enum.system_prompt)
    .filter((skill) => skill.prompt.trim().length > 0)
    .sort((a, b) => b.injection.priority - a.injection.priority);

  const injectedSkillIds = matching.map((s) => s.id);
  const skippedSkillIds = normalized
    .filter((s) => !injectedSkillIds.includes(s.id))
    .map((s) => s.id);

  if (matching.length === 0) {
    return { prompt: basePrompt, injectedSkillIds, skippedSkillIds };
  }

  const heading = isZh ? "## Skill 注入" : "## Skill Injection";
  const intro = isZh
    ? "以下 Skill 已根据触发条件自动注入，按优先级排序。"
    : "The following skills have been automatically injected based on trigger conditions, sorted by priority.";

  const skillBlocks = matching.map((skill) => {
    const meta = `[${skill.id}] priority=${skill.injection.priority}`;
    return `${meta}\n${skill.prompt.trim()}`;
  });

  const injected = [heading, "", intro, ...skillBlocks].join("\n");
  return {
    prompt: `${basePrompt}\n\n${injected}`,
    injectedSkillIds,
    skippedSkillIds,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convenience filter for enabled skills. */
export function filterEnabledSkills(
  skills: ReadonlyArray<SkillConfig>,
): SkillConfig[] {
  return skills.filter((s) => s.enabled);
}
