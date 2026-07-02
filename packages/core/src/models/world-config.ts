// ── WorldConfigSchema (Issue #77 — World-1) ──
//
// Defines the data model for an open-world (World) configuration. Worlds are
// stored as JSON files under `.inkos/worlds/<id>.json` and provide the
// foundational setting, characters, factions, geography, history and rules that
// multiple books can reference via `worldId` (see Issue #78).
//
// See: Issue #77 — World-1: WorldConfigSchema + CRUD API

import { z } from "zod";

// ── 1. WorldSettingEntry — 世界观设定

export const WorldSettingTypeEnum = z.enum([
  "物理规则",
  "魔法体系",
  "科技水平",
  "社会结构",
  "文化习俗",
]);
export type WorldSettingType = z.infer<typeof WorldSettingTypeEnum>;

export const WorldSettingEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: WorldSettingTypeEnum,
  description: z.string().default(""),
  constraints: z.array(z.string()).default([]),
});
export type WorldSettingEntry = z.infer<typeof WorldSettingEntrySchema>;

// ── 2. WorldRole — 世界角色

export const WorldRoleKindEnum = z.enum(["主角", "配角", "反派", "中立"]);
export type WorldRoleKind = z.infer<typeof WorldRoleKindEnum>;

export const WorldRoleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: WorldRoleKindEnum,
  description: z.string().default(""),
  significance: z.number().int().min(1).max(5).default(3),
});
export type WorldRole = z.infer<typeof WorldRoleSchema>;

// ── 3. WorldRelation — 世界关系

export const WorldRelationSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  type: z.string().min(1),
  description: z.string().default(""),
});
export type WorldRelation = z.infer<typeof WorldRelationSchema>;

// ── 4. WorldRegion — 地理区域

export const WorldRegionTypeEnum = z.enum(["大陆", "国家", "城市", "地点"]);
export type WorldRegionType = z.infer<typeof WorldRegionTypeEnum>;

export const WorldRegionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  parentId: z.string().nullable().default(null),
  type: WorldRegionTypeEnum,
  description: z.string().default(""),
});
export type WorldRegion = z.infer<typeof WorldRegionSchema>;

// ── 5. WorldInstitution — 组织势力

export const WorldInstitutionTypeEnum = z.enum(["宗门", "国家", "组织", "家族"]);
export type WorldInstitutionType = z.infer<typeof WorldInstitutionTypeEnum>;

export const WorldInstitutionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: WorldInstitutionTypeEnum,
  leaderId: z.string().nullable().default(null),
  members: z.array(z.string()).default([]),
  description: z.string().default(""),
});
export type WorldInstitution = z.infer<typeof WorldInstitutionSchema>;

// ── 6. WorldHistoryEvent — 历史事件

export const WorldHistoryEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  timestamp: z.string().min(1),
  description: z.string().default(""),
  affectedRegions: z.array(z.string()).default([]),
  significance: z.number().int().min(1).max(5).default(3),
});
export type WorldHistoryEvent = z.infer<typeof WorldHistoryEventSchema>;

// ── 7. WorldRule — 世界规则

export const WorldRuleTypeEnum = z.enum(["物理", "魔法", "社会", "叙事"]);
export type WorldRuleType = z.infer<typeof WorldRuleTypeEnum>;

export const WorldRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: WorldRuleTypeEnum,
  description: z.string().default(""),
  constraints: z.array(z.string()).default([]),
});
export type WorldRule = z.infer<typeof WorldRuleSchema>;

// ── Root WorldConfig ──

export const WorldConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  settings: z.array(WorldSettingEntrySchema).default([]),
  roles: z.array(WorldRoleSchema).default([]),
  relations: z.array(WorldRelationSchema).default([]),
  regions: z.array(WorldRegionSchema).default([]),
  institutions: z.array(WorldInstitutionSchema).default([]),
  history: z.array(WorldHistoryEventSchema).default([]),
  rules: z.array(WorldRuleSchema).default([]),
});
export type WorldConfig = z.infer<typeof WorldConfigSchema>;

export const WorldConfigUpdateSchema = WorldConfigSchema.partial().omit({ id: true, createdAt: true });
export type WorldConfigUpdate = z.infer<typeof WorldConfigUpdateSchema>;

export const WORLD_DIMENSION_KEYS = [
  "settings",
  "roles",
  "relations",
  "regions",
  "institutions",
  "history",
  "rules",
] as const;
export type WorldDimensionKey = (typeof WORLD_DIMENSION_KEYS)[number];
