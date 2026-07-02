import { z } from "zod";

// ── Plot line type ──

export const PlotLineSchema = z.enum(["main", "sub-a", "sub-b", "sub-c"]);
export type PlotLine = z.infer<typeof PlotLineSchema>;

// ── Key event marker ──

export const KeyEventSchema = z.enum(["climax", "twist", "foreshadow", "reveal"]);
export type KeyEvent = z.infer<typeof KeyEventSchema>;

// ── Chapter outline ──

export const ChapterOutlineSchema = z.object({
  number: z.number().int().min(1),
  title: z.string().min(1),
  summary: z.string().default(""),
  wordTarget: z.number().int().min(0).default(0),
  plotLine: PlotLineSchema.default("main"),
  keyEvents: z.array(KeyEventSchema).default([]),
  parentChapter: z.number().int().min(1).optional(),
});

export type ChapterOutline = z.infer<typeof ChapterOutlineSchema>;

// ── Outline file ──

export const OutlineFileSchema = z.object({
  bookId: z.string().min(1),
  chapters: z.array(ChapterOutlineSchema).default([]),
  version: z.number().default(1),
  updatedAt: z.number().int().nonnegative(),
});

export type OutlineFile = z.infer<typeof OutlineFileSchema>;
