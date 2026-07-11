import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
export const E2E_ROOT = resolve(__dirname, "../../", "test-project");
export const E2E_ARCHIVE_BOOK_ID = "e2e-session-archive";

/**
 * Seeds archived and active book sessions for session-archive E2E testing.
 *
 * Uses the same file-based storage that the BookSessionStore reads from.
 * Creates sessions under `books/<bookId>/story/sessions/` and
 * `books/<bookId>/story/session-index.json`.
 *
 * Sessions:
 * - session-arch-001: Archived, "修仙世界设定讨论" (has tags)
 * - session-arch-002: Archived, "第二章修订建议" (has tags)
 * - session-arch-003: Archived, "角色关系梳理" (no tags)
 * - session-active-001: Active (not archived), "大纲设计讨论"
 * - session-arch-004: Archived, "已弃用的旧设定" (for delete test)
 */
export async function seedSessionArchive(): Promise<void> {
  const bookDir = join(E2E_ROOT, "books", E2E_ARCHIVE_BOOK_ID);
  const sessionsDir = join(bookDir, "story", "sessions");
  const chaptersDir = join(bookDir, "story", "chapters");
  const stateDir = join(bookDir, "story", "state");
  const chaptersContentDir = join(bookDir, "chapters");

  const baseTime = new Date("2026-07-04T00:00:00.000Z").getTime();
  const hour = 3_600_000;

  // ── Book Config ──
  await mkdir(bookDir, { recursive: true });
  await writeFile(
    join(bookDir, "book.json"),
    JSON.stringify({
      id: E2E_ARCHIVE_BOOK_ID,
      title: "E2E 会话归档测试",
      platform: "webnovel",
      genre: "xianxia",
      status: "active",
      targetChapters: 10,
      chapterWordCount: 2000,
      language: "zh",
      createdAt: new Date(baseTime).toISOString(),
      updatedAt: new Date(baseTime + hour).toISOString(),
    }, null, 2),
    "utf-8",
  );

  // ── Session Index ──
  await mkdir(sessionsDir, { recursive: true });
  const sessionIndex: Array<{
    sessionId: string;
    title: string | null;
    status: "active" | "archived";
    messageCount: number;
    archivedAt?: number;
    createdAt: number;
    updatedAt: number;
    kind: string;
  }> = [
    {
      sessionId: "session-arch-001",
      title: "修仙世界设定讨论",
      status: "archived",
      messageCount: 12,
      archivedAt: baseTime + 2 * hour,
      createdAt: baseTime - 48 * hour,
      updatedAt: baseTime + 2 * hour,
      kind: "chat",
    },
    {
      sessionId: "session-arch-002",
      title: "第二章修订建议",
      status: "archived",
      messageCount: 8,
      archivedAt: baseTime + hour,
      createdAt: baseTime - 24 * hour,
      updatedAt: baseTime + hour,
      kind: "chat",
    },
    {
      sessionId: "session-arch-003",
      title: "角色关系梳理",
      status: "archived",
      messageCount: 5,
      archivedAt: baseTime + 3 * hour,
      createdAt: baseTime - 72 * hour,
      updatedAt: baseTime + 3 * hour,
      kind: "chat",
    },
    {
      sessionId: "session-active-001",
      title: "大纲设计讨论",
      status: "active",
      messageCount: 3,
      createdAt: baseTime - hour,
      updatedAt: baseTime,
      kind: "chat",
    },
    {
      sessionId: "session-arch-004",
      title: "已弃用的旧设定",
      status: "archived",
      messageCount: 15,
      archivedAt: baseTime + 4 * hour,
      createdAt: baseTime - 96 * hour,
      updatedAt: baseTime + 4 * hour,
      kind: "chat",
    },
  ];

  await writeFile(
    join(sessionsDir, "index.json"),
    JSON.stringify(sessionIndex, null, 2),
    "utf-8",
  );

  // ── Session Transcripts (minimal) ──
  for (const s of sessionIndex) {
    await mkdir(join(sessionsDir, s.sessionId), { recursive: true });
    await writeFile(
      join(sessionsDir, s.sessionId, "transcript.json"),
      JSON.stringify({
        sessionId: s.sessionId,
        title: s.title,
        status: s.status,
        events: [
          { type: "session_created", timestamp: new Date(s.createdAt).toISOString(), data: { title: s.title } },
        ],
      }, null, 2),
      "utf-8",
    );
  }

  // ── Session Tags ──
  await writeFile(
    join(bookDir, "story", "session-tags.json"),
    JSON.stringify({
      tags: {
        "session-arch-001": [
          { id: "tag-world", name: "世界设定", color: "#8B5CF6" },
          { id: "tag-discussion", name: "讨论", color: "#4A90D9" },
        ],
        "session-arch-002": [
          { id: "tag-revision", name: "修订", color: "#E88D3A" },
        ],
        "session-arch-004": [
          { id: "tag-deprecated", name: "已弃用", color: "#9CA3AF" },
        ],
      },
    }, null, 2),
    "utf-8",
  );

  // ── story/chapters/index.json ──
  await mkdir(chaptersDir, { recursive: true });
  await writeFile(
    join(chaptersDir, "index.json"),
    JSON.stringify({ chapters: [] }, null, 2),
    "utf-8",
  );

  // ── story/state/volumes.json ──
  await mkdir(stateDir, { recursive: true });
  await writeFile(
    join(stateDir, "volumes.json"),
    JSON.stringify({ schemaVersion: "1", volumes: [] }, null, 2),
    "utf-8",
  );

  // ── chapters/index.json ──
  await mkdir(chaptersContentDir, { recursive: true });
  await writeFile(
    join(chaptersContentDir, "index.json"),
    JSON.stringify([], null, 2),
    "utf-8",
  );
}
