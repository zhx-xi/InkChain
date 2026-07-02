/**
 * System Prompt Assembly — combines a loaded base prompt with optional
 * runtime-context additions (language, session context, skill guidance).
 *
 * This is the canonical entry point for resolving an agent's system prompt.
 * Consumers should call `assembleSystemPrompt()` rather than using
 * `loadSystemPrompt()` directly, unless they need the raw load result.
 */

import { loadSystemPrompt, FALLBACK_PROMPTS, type AgentType, type PromptLoadResult } from "./prompt-loader.js";
import {
  injectSkillsIntoPrompt,
  type SkillInjectionContext,
} from "../models/skill-injection.js";
import type { SkillConfig, StoredSkillConfig } from "../models/skill-config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssembleOptions {
  /** Override the default language (appended as a suffix instruction). */
  readonly language?: string;
  /** Session-level context block appended to the prompt. */
  readonly sessionContext?: string;
  /** Skill/domain guidance block appended to the prompt. */
  readonly skillGuidance?: string;
  /** Optional book directory for project-level prompt override. */
  readonly bookDir?: string;
  /** Skills to evaluate and inject into the system prompt. */
  readonly skills?: ReadonlyArray<SkillConfig> | ReadonlyArray<StoredSkillConfig>;
  /** Context used to evaluate skill triggers. */
  readonly skillInjectionContext?: SkillInjectionContext;
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/**
 * Resolve and assemble the complete system prompt for a given agent type.
 *
 * The base prompt is loaded via the resolution chain (project-file →
 * builtin-file → fallback). Optional context blocks are appended as
 * additional sections when provided.
 *
 * @param agentType - The agent type whose system prompt to assemble.
 * @param options   - Optional configuration for language, context, etc.
 * @returns The assembled system prompt string.
 */
export async function assembleSystemPrompt(
  agentType: AgentType,
  options?: AssembleOptions,
): Promise<string> {
  const isZh = !options?.language?.toLowerCase().startsWith("en");
  const { prompt: basePrompt } = await loadSystemPrompt(agentType, options?.bookDir);
  const parts: string[] = [basePrompt];

  if (options?.language) {
    parts.push(`## 语言\n${options.language}`);
  }

  if (options?.sessionContext) {
    parts.push(`## 会话上下文\n${options.sessionContext}`);
  }

  if (options?.skillGuidance) {
    parts.push(`## 技巧指导\n${options.skillGuidance}`);
  }

  const assembled = parts.join("\n\n");

  if (options?.skills && options.skills.length > 0) {
    const { prompt: injected } = injectSkillsIntoPrompt(
      assembled,
      options.skills,
      options.skillInjectionContext ?? {},
      isZh,
    );
    return injected;
  }

  return assembled;
}

/**
 * Synchronous variant of assembleSystemPrompt that resolves the base prompt
 * from fallback constants only (no file I/O).
 *
 * Useful for tests or contexts where async loading is not available.
 */
export function assembleSystemPromptSync(
  agentType: AgentType,
  options?: Omit<AssembleOptions, "bookDir">,
): string {
  const isZh = !options?.language?.toLowerCase().startsWith("en");
  const basePrompt = FALLBACK_PROMPTS[agentType];
  const parts: string[] = [basePrompt];

  if (options?.language) {
    parts.push(`## 语言\n${options.language}`);
  }

  if (options?.sessionContext) {
    parts.push(`## 会话上下文\n${options.sessionContext}`);
  }

  if (options?.skillGuidance) {
    parts.push(`## 技巧指导\n${options.skillGuidance}`);
  }

  const assembled = parts.join("\n\n");

  if (options?.skills && options.skills.length > 0) {
    const { prompt: injected } = injectSkillsIntoPrompt(
      assembled,
      options.skills,
      options.skillInjectionContext ?? {},
      isZh,
    );
    return injected;
  }

  return assembled;
}

// Re-export types for convenience
export type { AgentType, PromptLoadResult } from "./prompt-loader.js";
