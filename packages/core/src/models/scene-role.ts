// ── Scene role (场景角色) schema ──
// A simplified character type bound to specific chapters, not shown in the
// global character list. Stored as YAML frontmatter in roles/scene/<name>.md.

import { z } from "zod";

// ── Zod schemas ──

export const SceneRoleSchema = z.object({
  /** Name of the scene role. Used as the filename (roles/scene/<name>.md). */
  name: z.string().min(1, "角色名称不能为空"),
  /** Optional description / personality notes. */
  description: z.string().default(""),
  /** Chapter numbers this role is associated with. */
  relatedChapters: z.array(z.number().int().min(1)).default([]),
  /** ISO-8601 creation timestamp. */
  createdAt: z.string().datetime(),
  /** ISO-8601 last-updated timestamp. */
  updatedAt: z.string().datetime(),
});

export type SceneRole = z.infer<typeof SceneRoleSchema>;

/** Payload for creating a new scene role. */
export const CreateSceneRoleSchema = SceneRoleSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export type CreateSceneRole = z.infer<typeof CreateSceneRoleSchema>;

/** Payload for updating an existing scene role (all fields optional). */
export const UpdateSceneRoleSchema = CreateSceneRoleSchema.partial().extend({
  name: z.string().min(1).optional(),
});

export type UpdateSceneRole = z.infer<typeof UpdateSceneRoleSchema>;

/** File-level container for scene roles in state storage. */
export const SceneRolesFileSchema = z.object({
  schemaVersion: z.literal("1"),
  sceneRoles: z.array(SceneRoleSchema),
});

export type SceneRolesFile = z.infer<typeof SceneRolesFileSchema>;
