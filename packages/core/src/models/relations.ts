import { z } from "zod";

// ── Relation types ──

export const RelationType = z.enum([
  "close_friend",   // 挚友
  "rival",          // 敌对
  "alliance",       // 联盟
  "mentor",         // 师徒
  "blood",          // 血缘
  "secret_crush",   // 暗恋
]);
export type RelationType = z.infer<typeof RelationType>;

// Relation preset Chinese label mapping.
export const RELATION_LABELS: Record<RelationType, string> = {
  close_friend: "挚友",
  rival: "敌对",
  alliance: "联盟",
  mentor: "师徒",
  blood: "血缘",
  secret_crush: "暗恋",
};

// ── Character relation schema ──
// Enhanced with customType (for user-defined relation labels) and weight (1-5 stars).

export const CharacterRelationSchema = z.object({
  id: z.string().uuid(),
  sourceRoleId: z.string().min(1, "源角色ID不能为空"),
  targetRoleId: z.string().min(1, "目标角色ID不能为空"),
  relationType: RelationType,
  /** User-defined custom relation label (overrides preset label) */
  customLabel: z.string().optional(),
  description: z.string().optional(),
  validFromChapter: z.number().int().min(1),
  validUntilChapter: z.number().int().optional(),
  /** Formerly called intensity — now used as weight (1-5 stars) */
  intensity: z.number().int().min(1).max(5),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CharacterRelation = z.infer<typeof CharacterRelationSchema>;

// Create input — id, createdAt, updatedAt are auto-generated.
export const CreateRelationSchema = CharacterRelationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateRelation = z.infer<typeof CreateRelationSchema>;

// Update input — all fields optional (partial update).
export const UpdateRelationSchema = CharacterRelationSchema.partial();
export type UpdateRelation = z.infer<typeof UpdateRelationSchema>;

// File structure for relations.json
export const RelationsFileSchema = z.object({
  schemaVersion: z.literal("1"),
  relations: z.array(CharacterRelationSchema),
});
export type RelationsFile = z.infer<typeof RelationsFileSchema>;

/**
 * Resolve the display label for a relation edge.
 * Priority: customLabel > preset label > relationType raw value.
 */
export function getRelationDisplayLabel(
  relationType: string,
  customLabel?: string | null,
): string {
  if (customLabel) return customLabel;
  return RELATION_LABELS[relationType as RelationType] ?? relationType;
}
