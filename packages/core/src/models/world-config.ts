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
  sortIndex: z.number().int().min(0).default(0),
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
  sortIndex: z.number().int().min(0).default(0),
  institutionIds: z.array(z.string()).default([]),
  regionIds: z.array(z.string()).default([]),
  /** Current/primary region where this character is located */
  currentRegionId: z.string().optional(),
});
export type WorldRole = z.infer<typeof WorldRoleSchema>;

// ── 3. WorldRelation — 世界关系

export const WorldRelationSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  type: z.string().min(1),
  description: z.string().default(""),
  sortIndex: z.number().int().min(0).default(0),
});
export type WorldRelation = z.infer<typeof WorldRelationSchema>;

// ── Cross-entity Reference (Wrld-5) ──

export const WorldReferenceTargetTypeEnum = z.enum(["role", "region", "institution", "event"]);
export type WorldReferenceTargetType = z.infer<typeof WorldReferenceTargetTypeEnum>;

export const WorldReferenceSchema = z.object({
  id: z.string().min(1),
  sourceDimension: z.string().min(1),
  sourceId: z.string().min(1),
  targetDimension: z.string().min(1),
  targetId: z.string().min(1),
  label: z.string().default(""),
});
export type WorldReference = z.infer<typeof WorldReferenceSchema>;

export const WorldReferenceCreateSchema = z.object({
  sourceDimension: z.string().min(1),
  sourceId: z.string().min(1),
  targetDimension: z.string().min(1),
  targetId: z.string().min(1),
  label: z.string().default(""),
});
export type WorldReferenceCreate = z.infer<typeof WorldReferenceCreateSchema>;

// ── 4. WorldRegion — 地理区域

export const WorldRegionTypeEnum = z.enum(["大陆", "国家", "城市", "地点"]);
export type WorldRegionType = z.infer<typeof WorldRegionTypeEnum>;

/** English region level type for frontend map layout */
export const WorldRegionLevelEnum = z.enum(["continent", "country", "city", "location"]);
export type WorldRegionLevel = z.infer<typeof WorldRegionLevelEnum>;

/** 2D coordinates for map layout */
export const CoordinatesSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type Coordinates = z.infer<typeof CoordinatesSchema>;

export const WorldRegionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  parentId: z.string().nullable().default(null),
  type: WorldRegionTypeEnum,
  description: z.string().default(""),
  sortIndex: z.number().int().min(0).default(0),
  /** Map coordinate X (percentage 0-100) */
  x: z.number().min(0).max(100).nullable().default(null),
  /** Map coordinate Y (percentage 0-100) */
  y: z.number().min(0).max(100).nullable().default(null),
  /** Frontend layout coordinates (undefined/null = auto-layout) */
  coordinates: CoordinatesSchema.optional(),
  /** English region level for frontend map hierarchy */
  regionType: WorldRegionLevelEnum.optional(),
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
  sortIndex: z.number().int().min(0).default(0),
  regionId: z.string().nullable().default(null),
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
  sortIndex: z.number().int().min(0).default(0),
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
  sortIndex: z.number().int().min(0).default(0),
});
export type WorldRule = z.infer<typeof WorldRuleSchema>;

// ── Search Result ──

export interface WorldSearchResult {
  dimension: string;
  entityId: string;
  entityName: string;
  snippet: string;
  field: string;
}

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
  references: z.array(WorldReferenceSchema).default([]),
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

// ── Search helpers (Wrld-5) ──

const DIMENSION_NAME_MAP: Record<string, string> = {
  settings: "name",
  roles: "name",
  relations: "type",
  regions: "name",
  institutions: "name",
  history: "title",
  rules: "name",
};

function getEntityName(dimension: string, entity: Record<string, unknown>): string {
  if (dimension === "history") return String(entity.title ?? "");
  if (dimension === "relations") return String(entity.type ?? "");
  return String(entity.name ?? "");
}

function getSearchableText(dimension: string, entity: Record<string, unknown>): string {
  const textParts: string[] = [];
  for (const [key, val] of Object.entries(entity)) {
    if (key === "id" || key === "sortIndex") continue;
    if (typeof val === "string") textParts.push(val);
    if (Array.isArray(val)) textParts.push(...val.filter((v): v is string => typeof v === "string"));
  }
  return textParts.join(" ");
}

export function worldSearch(
  world: WorldConfig,
  query: string,
  dimension?: string,
): WorldSearchResult[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: WorldSearchResult[] = [];
  const dims = dimension ? [dimension] : WORLD_DIMENSION_KEYS;

  for (const dim of dims) {
    const entities = (world as Record<string, unknown[]>)[dim] ?? [];
    for (const entity of entities) {
      const e = entity as Record<string, unknown>;
      const text = getSearchableText(dim, e).toLowerCase();
      if (text.includes(q)) {
        const name = getEntityName(dim, e);
        const snippet = text.length > 120
          ? "..." + text.substring(Math.max(0, text.indexOf(q) - 40), text.indexOf(q) + 80) + "..."
          : text;
        results.push({
          dimension: dim,
          entityId: String(e.id ?? ""),
          entityName: name,
          snippet: snippet.substring(0, 200),
          field: dim === "history" ? "title" : "name",
        });
      }
    }
  }

  return results;
}

export function resolveReferences(
  world: WorldConfig,
): { ref: WorldReference; sourceName: string; targetName: string }[] {
  const nameMap = new Map<string, string>();
  const idToDim = new Map<string, string>();

  for (const dim of WORLD_DIMENSION_KEYS) {
    const entities = (world as Record<string, unknown[]>)[dim] ?? [];
    for (const entity of entities) {
      const e = entity as Record<string, unknown>;
      const eid = String(e.id ?? "");
      nameMap.set(eid, getEntityName(dim, e));
      idToDim.set(eid, dim);
    }
  }

  return (world.references ?? []).map((ref) => ({
    ref,
    sourceName: nameMap.get(ref.sourceId) ?? ref.sourceId,
    targetName: nameMap.get(ref.targetId) ?? ref.targetId,
  }));
}

export function checkReferenceBeforeDelete(
  world: WorldConfig,
  dimension: string,
  entityId: string,
): WorldReference[] {
  return (world.references ?? []).filter(
    (ref) =>
      (ref.sourceDimension === dimension && ref.sourceId === entityId) ||
      (ref.targetDimension === dimension && ref.targetId === entityId),
  );
}
