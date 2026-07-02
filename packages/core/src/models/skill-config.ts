// ── SkillConfigSchema (Issue #74 — Skill MVP) ──
//
// Defines the user-facing Skill configuration format. Skills are stored as
// JSON files in two locations:
//
//   Project level:  <projectRoot>/.inkos/skills/<id>.json
//   Builtin level:  packages/defaults/skills/<id>.json
//
// The project level takes precedence; the builtin level provides defaults.
// Schema validation uses Zod, and the resulting SkillConfig objects are
// loaded into the SkillRegistry for the trigger/injection pipeline
// (see #75) and the CRUD API (see #76).
//
// See: Issue #74 — Skill-1: SkillConfigSchema Zod 定义 + Skill 注册机制

import { z } from "zod";

// ── Skill Category ──

export const SkillCategoryEnum = z.enum([
  "writing",
  "analysis",
  "world",
  "character",
  "utility",
]);
export type SkillCategory = z.infer<typeof SkillCategoryEnum>;

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  writing: "Writing",
  analysis: "Analysis",
  world: "World",
  character: "Character",
  utility: "Utility",
};

// ── Trigger Config (placeholder for v2.5) ──
//
// MVP only supports "manual" and "condition" triggers. "condition" uses a
// free-form condition string (e.g. "session.kind === 'book'") that the
// injection pipeline (Issue #75) evaluates at runtime.

export const TriggerTypeEnum = z.enum(["manual", "condition"]);
export type TriggerType = z.infer<typeof TriggerTypeEnum>;

export const TriggerConfigSchema = z.object({
  type: TriggerTypeEnum,
  condition: z.string().optional(),
});
export type TriggerConfig = z.infer<typeof TriggerConfigSchema>;

// ── Injection Config ──
//
// MVP only supports "append" mode (per Issue #75). The schema reserves
// "prepend" and "replace" for future versions.

export const InjectionModeEnum = z.enum(["append", "prepend", "replace"]);
export type InjectionMode = z.infer<typeof InjectionModeEnum>;

export const InjectionTargetEnum = z.enum([
  "system_prompt",
  "user_prompt",
  "context",
]);
export type InjectionTarget = z.infer<typeof InjectionTargetEnum>;

export const InjectionConfigSchema = z.object({
  mode: InjectionModeEnum.default("append"),
  target: InjectionTargetEnum.default("system_prompt"),
  priority: z.number().int().min(1).max(100).default(50),
});
export type InjectionConfig = z.infer<typeof InjectionConfigSchema>;

// ── Param Definition ──

export const ParamTypeEnum = z.enum(["string", "number", "boolean", "select"]);
export type ParamType = z.infer<typeof ParamTypeEnum>;

export const ParamDefSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: ParamTypeEnum,
  required: z.boolean().default(false),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  options: z.array(z.string()).optional(),
});
export type ParamDef = z.infer<typeof ParamDefSchema>;

// ── Skill Source ──

export const SkillSourceEnum = z.enum(["builtin", "project"]);
export type SkillSource = z.infer<typeof SkillSourceEnum>;

// ── Skill Config Schema (the root schema) ──

export const SkillConfigSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Skill id must be kebab-case"),
  category: SkillCategoryEnum,
  triggers: z.array(TriggerConfigSchema).default([]),
  injection: InjectionConfigSchema.default({
    mode: "append",
    target: "system_prompt",
    priority: 50,
  }),
  params: z.record(z.string(), ParamDefSchema).default({}),
  enabled: z.boolean().default(true),
  description: z.string().default(""),
  prompt: z.string().default(""),
});
export type SkillConfig = z.infer<typeof SkillConfigSchema>;

// ── Stored Skill (with source attribution) ──

export interface StoredSkillConfig {
  readonly config: SkillConfig;
  readonly source: SkillSource;
  readonly path: string;
}

// ── Update Schema (omits id, which is immutable) ──

export const SkillConfigUpdateSchema = SkillConfigSchema.partial().omit({
  id: true,
});
export type SkillConfigUpdate = z.infer<typeof SkillConfigUpdateSchema>;
