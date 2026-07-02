import { z } from "zod";

/**
 * Preset color palette for session tags.
 * Each color has an id (machine key), hex value, and a human-readable Chinese label.
 */
export const TAG_COLORS = [
  { id: "red", hex: "#FF6B6B", label: "重要" },
  { id: "cyan", hex: "#4ECDC4", label: "创作" },
  { id: "blue", hex: "#45B7D1", label: "规划" },
  { id: "orange", hex: "#FFA07A", label: "修改" },
  { id: "green", hex: "#98D8C8", label: "完成" },
  { id: "gray", hex: "#D4A5A5", label: "参考" },
] as const;

export type TagColorId = (typeof TAG_COLORS)[number]["id"];
export type TagColorHex = (typeof TAG_COLORS)[number]["hex"];

/**
 * Schema for an individual session tag.
 */
export const SessionTagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(20),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export type SessionTag = z.infer<typeof SessionTagSchema>;

/**
 * Schema for the on-disk session tags file.
 * Maps sessionId -> tags[] for quick lookups.
 */
export const SessionTagsFileSchema = z.object({
  tags: z.record(z.string(), z.array(SessionTagSchema)),
  version: z.number().default(1),
});

export type SessionTagsFile = z.infer<typeof SessionTagsFileSchema>;
