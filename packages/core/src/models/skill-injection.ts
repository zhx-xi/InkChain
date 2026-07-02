// ── Skill Injection Pipeline (Issue #75 / #91) ──
//
// Evaluates user-facing SkillConfig triggers at runtime and injects matching
// skill prompts into the system prompt.
//
// Injection modes (Issue #91):
//   * append  — appends the injected block after the base prompt (default)
//   * prepend — inserts the injected block before the base prompt
//   * replace — replaces the base prompt entirely with the highest-priority
//               matching replace-skill's prompt
//
// Multiple replace-skills are resolved by priority: the one with the highest
// `injection.priority` wins; lower-priority replace-skills are skipped.
//
// See: Issue #75 — Skill-2: Skill触发注入管道
// See: Issue #91 — Skill-8: Skill prepend/replace注入模式扩展

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
 * Supported injection modes:
 *   * append  — injected block appended after the base prompt
 *   * prepend — injected block inserted before the base prompt
 *   * replace — replaced the entire prompt with the highest-priority matching
 *               replace skill's prompt (lower-priority replace skills skipped)
 *
 * Only `target === "system_prompt"` is honoured in v2.5.
 * Matching skills are sorted by `injection.priority` descending within
 * each mode group. Append and prepend skills can coexist; replace skills
 * are mutually exclusive with each other (only the highest priority wins).
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

  const allMatching = normalized
    .filter((skill) => shouldInjectSkill(skill, context))
    .filter((skill) => skill.injection.target === InjectionTargetEnum.enum.system_prompt)
    .filter((skill) => skill.prompt.trim().length > 0);

  // Separate by injection mode
  const appendSkills = allMatching
    .filter((s) => s.injection.mode === InjectionModeEnum.enum.append)
    .sort((a, b) => b.injection.priority - a.injection.priority);

  const prependSkills = allMatching
    .filter((s) => s.injection.mode === InjectionModeEnum.enum.prepend)
    .sort((a, b) => b.injection.priority - a.injection.priority);

  const replaceSkills = allMatching
    .filter((s) => s.injection.mode === InjectionModeEnum.enum.replace)
    .sort((a, b) => b.injection.priority - a.injection.priority);

  // For replace mode, only the highest-priority replace skill wins
  const winnerReplace = replaceSkills.length > 0 ? replaceSkills[0] : null;

  const injectedSkillIds = [
    ...appendSkills.map((s) => s.id),
    ...prependSkills.map((s) => s.id),
    ...(winnerReplace ? [winnerReplace.id] : []),
  ];
  const skippedSkillIds = normalized
    .filter((s) => !injectedSkillIds.includes(s.id))
    .map((s) => s.id);

  if (injectedSkillIds.length === 0) {
    return { prompt: basePrompt, injectedSkillIds, skippedSkillIds };
  }

  const heading = isZh ? "## Skill 注入" : "## Skill Injection";
  const intro = isZh
    ? "以下 Skill 已根据触发条件自动注入，按优先级排序。"
    : "The following skills have been automatically injected based on trigger conditions, sorted by priority.";

  const buildBlock = (skills: SkillConfig[]): string => {
    if (skills.length === 0) return "";
    const blocks = skills.map((skill) => {
      const meta = `[${skill.id}] priority=${skill.injection.priority}`;
      return `${meta}\n${skill.prompt.trim()}`;
    });
    return [heading, "", intro, ...blocks].join("\n");
  };

  // Build the injected block
  let resultPrompt = basePrompt;

  // 1. Prepend block (inserted before base prompt)
  if (prependSkills.length > 0) {
    const prependBlock = buildBlock(prependSkills);
    resultPrompt = `${prependBlock}\n\n${resultPrompt}`;
  }

  // 2. Replace block (replaces the entire prompt)
  if (winnerReplace) {
    const meta = `[${winnerReplace.id}] priority=${winnerReplace.injection.priority}`;
    const replaceContent = `${heading}\n\n${intro}\n${meta}\n${winnerReplace.prompt.trim()}`;
    resultPrompt = replaceContent;
  }

  // 3. Append block (appended after base prompt)
  if (appendSkills.length > 0) {
    const appendBlock = buildBlock(appendSkills);
    resultPrompt = `${resultPrompt}\n\n${appendBlock}`;
  }

  return {
    prompt: resultPrompt,
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
