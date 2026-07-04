import { z } from "zod";

/**
 * A single timeline event within a book's character timeline.
 */
export const TimelineEventSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().datetime(),
  eventType: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  relatedCharacters: z.array(z.string()).default([]),
  /** Associated world region ID for map visualization */
  regionId: z.string().optional(),
  chapter: z.number().int().min(0),
  importance: z.number().int().min(1).max(5),
  tags: z.array(z.string()).optional(),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

/**
 * The on-disk file format for character timelines.
 */
export const CharacterTimelineFileSchema = z.object({
  events: z.array(TimelineEventSchema).default([]),
  version: z.number().int().min(1).default(1),
});
export type CharacterTimelineFile = z.infer<typeof CharacterTimelineFileSchema>;
