import { z } from "zod";
import { PlayModeSchema, SessionKindSchema, type PlayMode, type SessionKind } from "./session.js";
export type { SessionKind };
export type { PlayMode };

export const TranscriptRoleSchema = z.enum(["user", "assistant", "toolResult", "system"]);
export type TranscriptRole = z.infer<typeof TranscriptRoleSchema>;

const BaseEventSchema = z.object({
  version: z.literal(1),
  sessionId: z.string().min(1),
  seq: z.number().int().nonnegative(),
  timestamp: z.number().int().nonnegative(),
});

export const SessionCreatedEventSchema = BaseEventSchema.extend({
  type: z.literal("session_created"),
  bookId: z.string().nullable(),
  sessionKind: SessionKindSchema.optional(),
  playMode: PlayModeSchema.optional(),
  title: z.string().nullable().default(null),
  status: z.enum(["active", "archived"]).default("active"),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const SessionMetadataUpdatedEventSchema = BaseEventSchema.extend({
  type: z.literal("session_metadata_updated"),
  bookId: z.string().nullable().optional(),
  sessionKind: SessionKindSchema.optional(),
  playMode: PlayModeSchema.optional(),
  title: z.string().nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
  archivedAt: z.number().int().nonnegative().optional(),
  archiveReason: z.string().optional(),
  updatedAt: z.number().int().nonnegative(),
});

export const RequestStartedEventSchema = BaseEventSchema.extend({
  type: z.literal("request_started"),
  requestId: z.string().min(1),
  sessionKind: SessionKindSchema.optional(),
  input: z.string(),
});

export const RequestCommittedEventSchema = BaseEventSchema.extend({
  type: z.literal("request_committed"),
  requestId: z.string().min(1),
});

export const RequestFailedEventSchema = BaseEventSchema.extend({
  type: z.literal("request_failed"),
  requestId: z.string().min(1),
  error: z.string(),
});

export const MessageEventSchema = BaseEventSchema.extend({
  type: z.literal("message"),
  requestId: z.string().min(1),
  uuid: z.string().min(1),
  parentUuid: z.string().min(1).nullable(),
  role: TranscriptRoleSchema,
  piTurnIndex: z.number().int().nonnegative().optional(),
  toolCallId: z.string().min(1).optional(),
  sourceToolAssistantUuid: z.string().min(1).optional(),
  legacyDisplay: z.object({
    thinking: z.string().optional(),
    toolExecutions: z.array(z.unknown()).optional(),
  }).optional(),
  message: z.unknown(),
});

export const SessionArchivedEventSchema = BaseEventSchema.extend({
  type: z.literal("session_archived"),
  reason: z.string().optional(),
});

export const SessionUnarchivedEventSchema = BaseEventSchema.extend({
  type: z.literal("session_unarchived"),
});

export type SessionArchivedEvent = z.infer<typeof SessionArchivedEventSchema>;
export type SessionUnarchivedEvent = z.infer<typeof SessionUnarchivedEventSchema>;

export const TranscriptEventSchema = z.discriminatedUnion("type", [
  SessionCreatedEventSchema,
  SessionMetadataUpdatedEventSchema,
  SessionArchivedEventSchema,
  SessionUnarchivedEventSchema,
  RequestStartedEventSchema,
  RequestCommittedEventSchema,
  RequestFailedEventSchema,
  MessageEventSchema,
]);

export type SessionCreatedEvent = z.infer<typeof SessionCreatedEventSchema>;
export type SessionMetadataUpdatedEvent = z.infer<typeof SessionMetadataUpdatedEventSchema>;
export type RequestStartedEvent = z.infer<typeof RequestStartedEventSchema>;
export type RequestCommittedEvent = z.infer<typeof RequestCommittedEventSchema>;
export type RequestFailedEvent = z.infer<typeof RequestFailedEventSchema>;
export type MessageEvent = z.infer<typeof MessageEventSchema>;
export type TranscriptEvent = z.infer<typeof TranscriptEventSchema>;
