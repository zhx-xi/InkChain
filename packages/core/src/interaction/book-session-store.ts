import { readdir, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { createBookSession } from "./session.js";
import type { BookSession, PlayMode, SessionKind } from "./session.js";
import {
  appendTranscriptEvents,
  appendTranscriptEvent,
  legacyBookSessionPath,
  readTranscriptEvents,
  sessionsDir,
  transcriptPath,
} from "./session-transcript.js";
import {
  migrateLegacyBookSessionToTranscript,
  readLegacyBookSession,
} from "./session-transcript-legacy.js";
import { deriveBookSessionFromTranscript } from "./session-transcript-restore.js";

/**
 * 从 messages 数组里取第一条 user 消息，裁剪成 ≤20 字的单行字符串。
 * 用于把用户首条提问作为会话标题。
 */
export function extractFirstUserMessageTitle(messages: unknown): string | null {
  if (!Array.isArray(messages)) return null;
  for (const message of messages) {
    if (!message || typeof message !== "object") continue;
    if ((message as { role?: unknown }).role !== "user") continue;
    const content = (message as { content?: unknown }).content;
    if (typeof content !== "string") return null;
    const oneLine = content.trim().replace(/\s+/g, " ");
    if (oneLine.length === 0) return null;
    return oneLine.length > 20 ? `${oneLine.slice(0, 20)}…` : oneLine;
  }
  return null;
}

export class SessionAlreadyMigratedError extends Error {
  constructor(sessionId: string, currentBookId: string) {
    super(`Session "${sessionId}" is already bound to book "${currentBookId}"`);
    this.name = "SessionAlreadyMigratedError";
  }
}

export async function loadBookSession(
  projectRoot: string,
  sessionId: string,
): Promise<BookSession | null> {
  const transcriptSession = await deriveBookSessionFromTranscript(projectRoot, sessionId);
  if (transcriptSession) return transcriptSession;

  const legacySession = await readLegacyBookSession(projectRoot, sessionId);
  if (!legacySession) return null;

  await migrateLegacyBookSessionToTranscript(projectRoot, legacySession);
  return await deriveBookSessionFromTranscript(projectRoot, sessionId) ?? legacySession;
}

async function appendSessionCreatedEvent(
  projectRoot: string,
  session: BookSession,
): Promise<void> {
  await appendTranscriptEvents(projectRoot, session.sessionId, ({ events, nextSeq }) => {
    if (events.some((event) => event.type === "session_created")) return [];
    return [{
      type: "session_created",
      version: 1,
      sessionId: session.sessionId,
      seq: nextSeq,
      timestamp: session.createdAt,
      bookId: session.bookId,
      ...(session.sessionKind ? { sessionKind: session.sessionKind } : {}),
      ...(session.playMode ? { playMode: session.playMode } : {}),
      title: session.title,
      status: session.status ?? "active",
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }];
  });
}

async function appendSessionMetadataUpdatedEvent(
  projectRoot: string,
  sessionId: string,
  metadata: {
    readonly bookId?: string | null;
    readonly sessionKind?: SessionKind;
    readonly playMode?: PlayMode;
    readonly title?: string | null;
    readonly status?: "active" | "archived";
    readonly archivedAt?: number;
    readonly archiveReason?: string;
    readonly updatedAt: number;
  },
): Promise<void> {
  await appendTranscriptEvents(projectRoot, sessionId, ({ nextSeq }) => [{
    type: "session_metadata_updated",
    version: 1,
    sessionId,
    seq: nextSeq,
    timestamp: metadata.updatedAt,
    updatedAt: metadata.updatedAt,
    ...("bookId" in metadata ? { bookId: metadata.bookId } : {}),
    ...(metadata.sessionKind ? { sessionKind: metadata.sessionKind } : {}),
    ...(metadata.playMode ? { playMode: metadata.playMode } : {}),
    ...("title" in metadata ? { title: metadata.title } : {}),
    ...("status" in metadata ? { status: metadata.status } : {}),
    ...("archivedAt" in metadata ? { archivedAt: metadata.archivedAt } : {}),
    ...("archiveReason" in metadata ? { archiveReason: metadata.archiveReason } : {}),
  }]);
}

export async function persistBookSession(
  projectRoot: string,
  session: BookSession,
): Promise<void> {
  const events = await readTranscriptEvents(projectRoot, session.sessionId);
  if (events.length === 0) {
    if (session.messages.length === 0) {
      await appendSessionCreatedEvent(projectRoot, session);
      return;
    }
    await migrateLegacyBookSessionToTranscript(projectRoot, session);
    return;
  }

  await appendSessionMetadataUpdatedEvent(projectRoot, session.sessionId, {
    bookId: session.bookId,
    ...(session.sessionKind ? { sessionKind: session.sessionKind } : {}),
    ...(session.playMode ? { playMode: session.playMode } : {}),
    title: session.title,
    updatedAt: session.updatedAt,
  });
}

export interface BookSessionSummary {
  readonly sessionId: string;
  readonly bookId: string | null;
  readonly sessionKind?: SessionKind;
  readonly playMode?: PlayMode;
  readonly title: string | null;
  readonly status: "active" | "archived";
  readonly messageCount: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export async function listBookSessions(
  projectRoot: string,
  bookId: string | null | undefined,
  status?: "active" | "archived",
): Promise<ReadonlyArray<BookSessionSummary>> {
  const dir = sessionsDir(projectRoot);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const sessionIds = new Set<string>();
  for (const file of files) {
    if (file.endsWith(".jsonl")) {
      sessionIds.add(file.slice(0, -".jsonl".length));
    } else if (file.endsWith(".json")) {
      sessionIds.add(file.slice(0, -".json".length));
    }
  }

  const summaries = await Promise.all(
    [...sessionIds].map(async (sessionId): Promise<BookSessionSummary | null> => {
      try {
        const session = await loadBookSession(projectRoot, sessionId);
        if (!session) return null;
        if (bookId !== undefined && session.bookId !== bookId) return null;
        if (status !== undefined && session.status !== status) return null;

        return {
          sessionId: session.sessionId,
          bookId: session.bookId,
          sessionKind: session.sessionKind,
          playMode: session.playMode,
          title: session.title,
          status: session.status,
          messageCount: session.messages.length,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        };
      } catch {
        return null;
      }
    }),
  );

  return summaries
    .filter((summary): summary is BookSessionSummary => summary !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function renameBookSession(
  projectRoot: string,
  sessionId: string,
  title: string,
): Promise<BookSession | null> {
  const session = await loadBookSession(projectRoot, sessionId);
  if (!session) return null;
  const updatedAt = Date.now();
  await appendSessionMetadataUpdatedEvent(projectRoot, sessionId, { title, updatedAt });
  return loadBookSession(projectRoot, sessionId);
}

export async function deleteBookSession(
  projectRoot: string,
  sessionId: string,
): Promise<void> {
  await Promise.all([
    unlink(transcriptPath(projectRoot, sessionId)).catch(() => undefined),
    unlink(legacyBookSessionPath(projectRoot, sessionId)).catch(() => undefined),
  ]);
}

export async function migrateBookSession(
  projectRoot: string,
  sessionId: string,
  newBookId: string,
): Promise<BookSession | null> {
  const session = await loadBookSession(projectRoot, sessionId);
  if (!session) return null;
  if (session.bookId !== null) {
    throw new SessionAlreadyMigratedError(sessionId, session.bookId);
  }

  await appendSessionMetadataUpdatedEvent(projectRoot, sessionId, {
    bookId: newBookId,
    sessionKind: "book",
    updatedAt: Date.now(),
  });
  return loadBookSession(projectRoot, sessionId);
}

export async function createAndPersistBookSession(
  projectRoot: string,
  bookId: string | null,
  sessionId?: string,
  sessionKind?: SessionKind,
  options?: { readonly playMode?: PlayMode },
): Promise<BookSession> {
  // 如果指定了 sessionId 且对应文件已存在，视为幂等操作直接返回（支持"用户发消息时才持久化 draft"流程）
  if (sessionId) {
    const existing = await loadBookSession(projectRoot, sessionId);
    if (existing) {
      if ((sessionKind && existing.sessionKind !== sessionKind) || (options?.playMode && existing.playMode !== options.playMode)) {
        await appendSessionMetadataUpdatedEvent(projectRoot, sessionId, {
          ...(sessionKind ? { sessionKind } : {}),
          ...(options?.playMode ? { playMode: options.playMode } : {}),
          updatedAt: Date.now(),
        });
        return await loadBookSession(projectRoot, sessionId) ?? existing;
      }
      return existing;
    }
  }
  const session = createBookSession(bookId, sessionId, sessionKind, options);
  await appendSessionCreatedEvent(projectRoot, session);
  return session;
}

// ── Archive / Unarchive ──

export async function archiveBookSession(
  projectRoot: string,
  sessionId: string,
  reason?: string,
): Promise<BookSession | null> {
  const session = await loadBookSession(projectRoot, sessionId);
  if (!session) return null;
  if (session.status === "archived") return session;

  const now = Date.now();
  await appendTranscriptEvents(projectRoot, sessionId, ({ nextSeq }) => [{
    type: "session_archived",
    version: 1,
    sessionId,
    seq: nextSeq,
    timestamp: now,
    ...(reason ? { reason } : {}),
  }]);

  await appendSessionMetadataUpdatedEvent(projectRoot, sessionId, {
    status: "archived",
    archivedAt: now,
    ...(reason ? { archiveReason: reason } : {}),
    updatedAt: now,
  });

  return loadBookSession(projectRoot, sessionId);
}

export async function unarchiveBookSession(
  projectRoot: string,
  sessionId: string,
): Promise<BookSession | null> {
  const session = await loadBookSession(projectRoot, sessionId);
  if (!session) return null;
  if (session.status === "active") return session;

  const now = Date.now();
  await appendTranscriptEvents(projectRoot, sessionId, ({ nextSeq }) => [{
    type: "session_unarchived",
    version: 1,
    sessionId,
    seq: nextSeq,
    timestamp: now,
  }]);

  await appendSessionMetadataUpdatedEvent(projectRoot, sessionId, {
    status: "active",
    archivedAt: undefined,
    archiveReason: undefined,
    updatedAt: now,
  });

  return loadBookSession(projectRoot, sessionId);
}

export async function batchArchiveBookSessions(
  projectRoot: string,
  sessionIds: string[],
): Promise<number> {
  let count = 0;
  for (const sessionId of sessionIds) {
    const result = await archiveBookSession(projectRoot, sessionId);
    if (result) count += 1;
  }
  return count;
}

export async function mergeBookSessions(
  projectRoot: string,
  targetId: string,
  sourceId: string,
): Promise<BookSession | null> {
  const target = await loadBookSession(projectRoot, targetId);
  const source = await loadBookSession(projectRoot, sourceId);
  if (!target || !source) return null;

  // Merge messages sorted by timestamp
  const mergedMessages = [...target.messages, ...source.messages].sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  // Delete source session files
  await Promise.all([
    unlink(transcriptPath(projectRoot, sourceId)).catch(() => undefined),
    unlink(legacyBookSessionPath(projectRoot, sourceId)).catch(() => undefined),
  ]);

  // For each source message, append as a transcript event to the target session
  for (const msg of source.messages) {
    await appendTranscriptEvents(projectRoot, targetId, ({ nextSeq }) => [{
      type: "message",
      version: 1 as const,
      sessionId: targetId,
      requestId: `merge-${sourceId}-${nextSeq}`,
      uuid: `merge-${sourceId}-${msg.timestamp}-${nextSeq}`,
      parentUuid: null,
      seq: nextSeq,
      role: msg.role === "user" ? "user" as const : msg.role === "assistant" ? "assistant" as const : "system" as const,
      timestamp: msg.timestamp,
      message: {
        role: msg.role,
        content: [{ type: "text", text: msg.content }],
        timestamp: msg.timestamp,
      },
    }]);
  }

  // Persist target with merged messages
  const now = Date.now();
  await appendSessionMetadataUpdatedEvent(projectRoot, targetId, {
    updatedAt: now,
  });

  const updated = await loadBookSession(projectRoot, targetId);
  if (!updated) return null;

  return {
    ...updated,
    messages: mergedMessages,
    updatedAt: now,
  };
}

export async function autoArchiveStaleSessions(
  projectRoot: string,
  maxAgeDays: number = 30,
): Promise<number> {
  const dir = sessionsDir(projectRoot);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return 0;
  }

  const sessionIds = new Set<string>();
  for (const file of files) {
    if (file.endsWith(".jsonl")) {
      sessionIds.add(file.slice(0, -".jsonl".length));
    } else if (file.endsWith(".json")) {
      sessionIds.add(file.slice(0, -".json".length));
    }
  }

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let count = 0;

  for (const sessionId of sessionIds) {
    try {
      const session = await loadBookSession(projectRoot, sessionId);
      if (!session || session.status !== "active") continue;
      if (session.updatedAt > cutoff) continue;

      const result = await archiveBookSession(projectRoot, sessionId, "auto-archived (stale)");
      if (result) count += 1;
    } catch {
      // Skip sessions that fail to load
      continue;
    }
  }

  return count;
}
