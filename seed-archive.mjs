import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const e2eRoot = resolve(__dirname, "packages/studio/test-project");
console.log("Seeding to:", e2eRoot);

// Also seed sidebar-nav book
const sidebarbookId = "e2e-sidebar-nav";
const sidebarbookDir = join(e2eRoot, "books", sidebarbookId);
const sidebarchaptersDir = join(sidebarbookDir, "chapters");
const now = new Date("2026-07-05T00:00:00.000Z").toISOString();

await mkdir(sidebarbookDir, { recursive: true });
await writeFile(join(sidebarbookDir, "book.json"), JSON.stringify({
  id: sidebarbookId, title: "E2E 侧边栏导航测试", platform: "webnovel",
  genre: "xianxia", status: "active", targetChapters: 10,
  chapterWordCount: 2000, language: "zh", createdAt: now, updatedAt: now,
}, null, 2), "utf-8");
await mkdir(sidebarchaptersDir, { recursive: true });
await writeFile(join(sidebarchaptersDir, "index.json"), JSON.stringify(
  Array.from({ length: 3 }, (_, i) => ({
    number: i + 1, title: `第${String(i + 1).padStart(2, "0")}章`,
    status: "drafted", wordCount: 1000, createdAt: now, updatedAt: now,
    volumeId: null, auditIssues: [], lengthWarnings: [],
  })),
  null, 2,
), "utf-8");

const bookId = "e2e-session-archive";
const bookDir = join(e2eRoot, "books", bookId);
const sessionsDir = join(e2eRoot, ".inkos", "sessions");
const chaptersDir = join(bookDir, "story", "chapters");
const stateDir = join(bookDir, "story", "state");
const chaptersContentDir = join(bookDir, "chapters");

const baseTime = new Date("2026-07-04T00:00:00.000Z").getTime();
const hour = 3_600_000;

await mkdir(bookDir, { recursive: true });
await writeFile(join(bookDir, "book.json"), JSON.stringify({
  id: bookId, title: "E2E 会话归档测试", platform: "webnovel",
  genre: "xianxia", status: "active", targetChapters: 10,
  chapterWordCount: 2000, language: "zh",
  createdAt: new Date(baseTime).toISOString(),
  updatedAt: new Date(baseTime + hour).toISOString(),
}, null, 2), "utf-8");

await mkdir(sessionsDir, { recursive: true });
// API v1 expects .jsonl transcript files in .inkos/sessions/
// Each line is a JSON event with session_created containing title/status/archivedAt metadata
const sessionIndex = [
  { sessionId: "sess-arch-001", title: "修仙世界设定讨论", status: "archived", messageCount: 12, archivedAt: baseTime + 2 * hour, createdAt: baseTime - 48 * hour, updatedAt: baseTime + 2 * hour, kind: "chat" },
  { sessionId: "sess-arch-002", title: "第二章修订建议", status: "archived", messageCount: 8, archivedAt: baseTime + hour, createdAt: baseTime - 24 * hour, updatedAt: baseTime + hour, kind: "chat" },
  { sessionId: "sess-arch-003", title: "角色关系梳理", status: "archived", messageCount: 5, archivedAt: baseTime + 3 * hour, createdAt: baseTime - 72 * hour, updatedAt: baseTime + 3 * hour, kind: "chat" },
  { sessionId: "sess-active-001", title: "大纲设计讨论", status: "active", messageCount: 3, createdAt: baseTime - hour, updatedAt: baseTime, kind: "chat" },
  { sessionId: "sess-arch-004", title: "已弃用的旧设定", status: "archived", messageCount: 15, archivedAt: baseTime + 4 * hour, createdAt: baseTime - 96 * hour, updatedAt: baseTime + 4 * hour, kind: "chat" },
];

for (const s of sessionIndex) {
  const createdAtNumber = s.createdAt;
  const updatedAtNumber = s.updatedAt;
  const archivedAtNumber = s.archivedAt;
  const events = [
    JSON.stringify({
      type: "session_created", version: 1, seq: 1,
      sessionId: s.sessionId, timestamp: createdAtNumber,
      title: s.title, bookId: "e2e-session-archive",
      sessionKind: s.kind, status: s.status,
      createdAt: createdAtNumber,
      updatedAt: updatedAtNumber,
    }),
  ];
  if (s.status === "archived" && archivedAtNumber != null) {
    events.push(JSON.stringify({
      version: 1, type: "session_archived", seq: 2,
      sessionId: s.sessionId, timestamp: archivedAtNumber,
    }));
  }
  await writeFile(join(sessionsDir, `${s.sessionId}.jsonl`), events.join("\n") + "\n", "utf-8");
}

await writeFile(join(bookDir, "story", "session-tags.json"), JSON.stringify({
  tags: {
    "session-arch-001": [{ id: "tag-world", name: "世界设定", color: "#8B5CF6" }, { id: "tag-discussion", name: "讨论", color: "#4A90D9" }],
    "session-arch-002": [{ id: "tag-revision", name: "修订", color: "#E88D3A" }],
    "session-arch-004": [{ id: "tag-deprecated", name: "已弃用", color: "#9CA3AF" }],
  },
}, null, 2), "utf-8");

await mkdir(chaptersDir, { recursive: true });
await writeFile(join(chaptersDir, "index.json"), JSON.stringify({ chapters: [] }, null, 2), "utf-8");
await mkdir(stateDir, { recursive: true });
await writeFile(join(stateDir, "volumes.json"), JSON.stringify({ schemaVersion: "1", volumes: [] }, null, 2), "utf-8");
await mkdir(chaptersContentDir, { recursive: true });
await writeFile(join(chaptersContentDir, "index.json"), JSON.stringify([], null, 2), "utf-8");

console.log("Seed complete!");
