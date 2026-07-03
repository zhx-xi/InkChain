// ── Foreshadowing Schema (Issue #84 — E2-1) ──
//
// Defines the data model for foreshadowing (伏笔) tracking in long-form
// novel creation. Foreshadowing records are stored as JSON files in:
//
//   <projectRoot>/.inkos/foreshadowing/<id>.json
//
// Schema validation uses Zod.

import { z } from "zod";

// ── Foreshadowing Type ──

export const ForeshadowingTypeEnum = z.enum([
  "情节伏笔",
  "角色伏笔",
  "物品伏笔",
  "设定伏笔",
]);
export type ForeshadowingType = z.infer<typeof ForeshadowingTypeEnum>;

export const FORESHADOWING_TYPE_LABELS: Readonly<Record<ForeshadowingType, string>> = {
  "情节伏笔": "情节伏笔",
  "角色伏笔": "角色伏笔",
  "物品伏笔": "物品伏笔",
  "设定伏笔": "设定伏笔",
};

// ── Foreshadowing Status ──

export const ForeshadowingStatusEnum = z.enum(["active", "paid_off", "abandoned"]);
export type ForeshadowingStatus = z.infer<typeof ForeshadowingStatusEnum>;

export const FORESHADOWING_STATUS_LABELS: Readonly<Record<ForeshadowingStatus, string>> = {
  active: "活跃",
  paid_off: "已回收",
  abandoned: "已废弃",
};

// ── Foreshadowing Schema ──

export const ForeshadowingSchema = z.object({
  id: z.string().min(1, "伏笔 ID 不能为空"),
  bookId: z.string().min(1, "书籍ID不能为空"),
  title: z.string().min(1, "伏笔标题不能为空"),
  description: z.string().default(""),
  type: ForeshadowingTypeEnum.default("情节伏笔"),
  createdChapter: z.number().int().min(0).default(0),
  expectedPayoffChapter: z.number().int().min(0).nullable().default(null),
  status: ForeshadowingStatusEnum.default("active"),
  payoffChapter: z.number().int().min(0).nullable().default(null),
  lastMentionedChapter: z.number().int().min(0).default(0),
  relatedElements: z.array(z.string()).default([]),
  notes: z.string().default(""),
});
export type Foreshadowing = z.infer<typeof ForeshadowingSchema>;

// ── Update Schema (omits id, which is immutable) ──

export const ForeshadowingUpdateSchema = ForeshadowingSchema.partial().omit({
  id: true,
});
export type ForeshadowingUpdate = z.infer<typeof ForeshadowingUpdateSchema>;

// ── Create Schema (requires id and title, others optional) ──

export const ForeshadowingCreateSchema = ForeshadowingSchema.required({
  id: true,
  title: true,
});
export type ForeshadowingCreate = z.infer<typeof ForeshadowingCreateSchema>;

// ── Forget Detection Result ──

export interface ForeshadowingForgetCheck {
  readonly foreshadowingId: string;
  readonly title: string;
  readonly lastMentionedChapter: number;
  readonly currentChapter: number;
  readonly chaptersSinceMention: number;
  readonly threshold: number;
  readonly isForgotten: boolean;
}

/**
 * Check if a foreshadowing entry has been "forgotten" (not mentioned for N chapters).
 *
 * @param entry - The foreshadowing entry to check
 * @param currentChapter - The current chapter number
 * @param threshold - Number of chapters without mention before considered "forgotten" (default 10)
 * @returns A check result with isForgotten flag
 */
export function checkForeshadowingForget(
  entry: Foreshadowing,
  currentChapter: number,
  threshold = 10,
): ForeshadowingForgetCheck {
  const chaptersSinceMention = currentChapter - entry.lastMentionedChapter;
  return {
    foreshadowingId: entry.id,
    title: entry.title,
    lastMentionedChapter: entry.lastMentionedChapter,
    currentChapter,
    chaptersSinceMention,
    threshold,
    isForgotten: entry.status === "active" && chaptersSinceMention >= threshold,
  };
}

/**
 * Filter a list of foreshadowing entries to find those that are "forgotten".
 *
 * @param entries - The list of foreshadowing entries
 * @param currentChapter - The current chapter number
 * @param threshold - Number of chapters without mention before considered "forgotten" (default 10)
 * @returns Array of forget check results for entries that are forgotten
 */
export function findForgottenForeshadowing(
  entries: ReadonlyArray<Foreshadowing>,
  currentChapter: number,
  threshold = 10,
): ForeshadowingForgetCheck[] {
  return entries
    .filter((e) => e.status === "active")
    .map((e) => checkForeshadowingForget(e, currentChapter, threshold))
    .filter((c) => c.isForgotten);
}
