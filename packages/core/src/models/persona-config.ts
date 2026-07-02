// ── PersonaConfig Schema (R-17.1) ──
// Defines the data model for Agent Persona configuration.
// Persona files are stored as YAML frontmatter + Markdown body,
// shared with the Genre Profile loading mechanism.
//
// Built-in:  packages/core/src/personas/<agent>.md
// Project-level: .inkos/personas/<agent>.md
//
// See: PRD prd-skill-persona-ui-2026-07-01.md §R-17.1

import { z } from "zod";
import yaml from "js-yaml";

// ── Agent Role Enum ──

/**
 * The 7 InkOS Agent roles in the collaborative writing team.
 *
 * Each role has a distinct responsibility in the novel creation pipeline:
 * - writer:     Generates chapter prose from outline and context
 * - auditor:    Checks for continuity errors and consistency issues
 * - editor:     Reviews and polishes written chapters
 * - architect:  Designs book structure, outlines, and character arcs
 * - planner:    Plans chapter-level beats and pacing
 * - observer:   Tracks narrative state, character development, and subplots
 * - reviser:    Revises chapters based on audit feedback
 */
export const AgentRoleEnum = z.enum([
  "writer",
  "auditor",
  "editor",
  "architect",
  "planner",
  "observer",
  "reviser",
]);

export type AgentRole = z.infer<typeof AgentRoleEnum>;

export const AGENT_ROLE_LABELS: Record<AgentRole, string> = {
  writer: "Writer",
  auditor: "Auditor",
  editor: "Editor",
  architect: "Architect",
  planner: "Planner",
  observer: "Observer",
  reviser: "Reviser",
};

export const AGENT_ROLE_COLORS: Record<AgentRole, string> = {
  writer: "#E88D3A",    // creative orange
  auditor: "#4A90D9",   // audit blue
  editor: "#5CB85C",    // editor green
  architect: "#8B5CF6", // architecture purple
  planner: "#9CA3AF",   // planner gray
  observer: "#0EA5E9",  // observer cyan
  reviser: "#EF4444",   // reviser red
};

// ── Behavior Constraint Schema ──

export const BehaviorStyleEnum = z.enum(["Always", "Never", "When"]);
export type BehaviorStyle = z.infer<typeof BehaviorStyleEnum>;

export const BEHAVIOR_STYLE_COLORS: Record<BehaviorStyle, string> = {
  Always: "#22C55E", // green
  Never: "#EF4444",  // red
  When: "#EAB308",   // yellow
};

export const BehaviorConstraintSchema = z.object({
  /** The rule content, e.g. "用诗意化手法处理战斗场面" */
  rule: z.string().min(1, "规则内容不能为空"),
  /** Behavioral style: Always (always follow), Never (never do), When (conditional) */
  style: BehaviorStyleEnum,
  /** Priority order (lower = higher priority). Defaults to 10. */
  priority: z.number().int().min(1).max(100).default(10),
  /** Whether this constraint is enabled */
  enabled: z.boolean().default(true),
  /** Condition expression for "When" style rules (e.g. "包含古风关键词") */
  condition: z.string().optional(),
});

export type BehaviorConstraint = z.infer<typeof BehaviorConstraintSchema>;

// ── Dialogue Style Schema ──

export const DialogueStyleSchema = z.object({
  /** Speaking tone, e.g. "沉稳大气", "活泼俏皮" */
  tone: z.string().optional(),
  /** Speech rhythm, e.g. "短句密集", "长句舒缓" */
  rhythm: z.string().optional(),
  /** Vocabulary preference, e.g. "武侠术语优先", "现代口语为主" */
  vocabulary: z.string().optional(),
});

export type DialogueStyle = z.infer<typeof DialogueStyleSchema>;

// ── Persona Config Schema ──

export const PersonaConfigSchema = z.object({
  /** The agent role this persona configuration targets */
  agentRole: AgentRoleEnum,
  /** Human-readable display name for this persona (e.g. "热血 Writer") */
  displayName: z.string().min(1, "角色名不能为空"),
  /** Quick personality trait tags (short text labels) */
  personalityTraits: z.array(z.string()).default([]),
  /** Dialogue style configuration */
  dialogueStyle: DialogueStyleSchema.default({}),
  /** Behavioral constraints (Always / Never / When rules) */
  behaviorConstraints: z.array(BehaviorConstraintSchema).default([]),
  /** Free-form rich text details (supports Markdown) */
  freeTextDetails: z.string().default(""),
  /**
   * The fully assembled system prompt (read-only preview).
   * This is the final prompt after resolving structured fields + free text + skill injections.
   * Stored for inspection, not for direct editing.
   */
  systemPrompt: z.string().optional(),
  /** Per-agent LLM model override. Reuses AgentLLMOverrideSchema from project.ts. */
  modelOverride: z
    .object({
      provider: z.enum(["anthropic", "openai", "custom"]).optional(),
      service: z.string().optional(),
      model: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
    })
    .optional(),
  /** List of Skill IDs bound to this persona */
  boundSkills: z.array(z.string()).default([]),
  /** Version marker for tracking changes */
  version: z.number().int().min(1).default(1),
});

export type PersonaConfig = z.infer<typeof PersonaConfigSchema>;

// ── Partial Update Schema ──

export const PersonaConfigUpdateSchema = PersonaConfigSchema.partial().omit({
  agentRole: true,
});

export type PersonaConfigUpdate = z.infer<typeof PersonaConfigUpdateSchema>;

// ── Preset Schema ──

export const PersonaPresetSchema = z.object({
  /** Unique preset identifier */
  id: z.string().min(1),
  /** Human-readable preset name (e.g. "热血玄幻") */
  name: z.string().min(1),
  /** Preset description */
  description: z.string().default(""),
  /** The 7-agent persona configurations */
  personas: z.record(AgentRoleEnum, PersonaConfigSchema),
  /** Preset version */
  version: z.number().int().min(1).default(1),
  /** Creation timestamp */
  createdAt: z.string().optional(),
  /** Last updated timestamp */
  updatedAt: z.string().optional(),
});

export type PersonaPreset = z.infer<typeof PersonaPresetSchema>;

// ── Parsed Persona File ──

export interface ParsedPersonaConfig {
  readonly config: PersonaConfig;
  readonly body: string;
}

/**
 * Parse a persona config file in YAML frontmatter + Markdown body format.
 * The frontmatter contains structured fields; the body contains free-text system prompt content.
 *
 * Format:
 * ```yaml
 * ---
 * agentRole: writer
 * displayName: 热血 Writer
 * personalityTraits:
 *   - 热血
 *   - 直白
 * behaviorConstraints:
 *   - rule: 用诗意化手法处理战斗场面
 *     style: Always
 *     priority: 5
 *     enabled: true
 * ---
 * Free-text details and system prompt body...
 * ```
 *
 * @throws If the frontmatter is missing or invalid.
 */
export function parsePersonaConfig(raw: string): ParsedPersonaConfig {
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!fmMatch) {
    throw new Error("Persona config missing YAML frontmatter (--- ... ---)");
  }

  const frontmatter = yaml.load(fmMatch[1]) as Record<string, unknown>;
  const config = PersonaConfigSchema.parse(frontmatter);
  const body = fmMatch[2].trim();

  return { config, body };
}

/**
 * Serialize a PersonaConfig to YAML frontmatter + Markdown body format.
 */
export function serializePersonaConfig(config: PersonaConfig, body: string): string {
  const yamlStr = yaml.dump(config, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });
  return `---\n${yamlStr}---\n\n${body}`;
}

/**
 * Summary of an available persona configuration.
 * Used for listing personas without loading the full config.
 */
export interface PersonaSummary {
  readonly agentRole: AgentRole;
  readonly displayName: string;
  readonly source: "project" | "builtin" | "default";
}
