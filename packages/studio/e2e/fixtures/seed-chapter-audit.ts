import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
export const E2E_ROOT = resolve(__dirname, "../../", "test-project");
export const E2E_BOOK_ID = "e2e-volume-dnd";

export async function seedChapterAudit(): Promise<void> {
  const bookDir = join(E2E_ROOT, "books", E2E_BOOK_ID);
  const chaptersDir = join(bookDir, "chapters");
  const stateDir = join(bookDir, "story", "state");

  const now = new Date("2026-07-04T00:00:00.000Z").toISOString();

  // Ensure book.json exists
  await mkdir(bookDir, { recursive: true });
  const bookJsonPath = join(bookDir, "book.json");
  try {
    await writeFile(
      bookJsonPath,
      JSON.stringify({
        id: E2E_BOOK_ID,
        title: "E2E 审计仪表板测试",
        platform: "webnovel",
        genre: "xianxia",
        status: "active",
        targetChapters: 10,
        chapterWordCount: 2000,
        language: "zh",
        createdAt: now,
        updatedAt: now,
      }, null, 2),
      "utf-8",
    );
  } catch {
    // File may already exist from another fixture
  }

  // Chapter index with some chapters having audit-failed status and issues
  await mkdir(chaptersDir, { recursive: true });
  await writeFile(
    join(chaptersDir, "index.json"),
    JSON.stringify([
      {
        number: 1, title: "第一章 初入修仙",
        status: "approved", wordCount: 2100,
        createdAt: now, updatedAt: now, volumeId: null,
        auditIssues: [], lengthWarnings: [],
      },
      {
        number: 2, title: "第二章 灵根测试",
        status: "audit-failed", wordCount: 1800,
        createdAt: now, updatedAt: now, volumeId: null,
        auditIssues: [
          { severity: "high", category: "逻辑矛盾", description: "灵根测试结果前后不一致" },
          { severity: "medium", category: "节奏问题", description: "第二章节奏偏慢，缺乏冲突" },
        ],
        lengthWarnings: [],
      },
      {
        number: 3, title: "第三章 初次历练",
        status: "drafted", wordCount: 2200,
        createdAt: now, updatedAt: now, volumeId: null,
        auditIssues: [
          { severity: "low", category: "用词", description: "重复使用'突然'一词多次" },
        ],
        lengthWarnings: [],
      },
      {
        number: 4, title: "第四章 秘境探索",
        status: "audit-failed", wordCount: 1950,
        createdAt: now, updatedAt: now, volumeId: null,
        auditIssues: [
          { severity: "high", category: "设定冲突", description: "秘境规则与第三章描述不符" },
          { severity: "high", category: "角色OOC", description: "主角行为与性格设定不符" },
          { severity: "medium", category: "时间线错误", description: "时间线跳跃不合理" },
        ],
        lengthWarnings: [],
      },
      {
        number: 5, title: "第五章 回归",
        status: "drafted", wordCount: 1500,
        createdAt: now, updatedAt: now, volumeId: null,
        auditIssues: [], lengthWarnings: [],
      },
    ], null, 2),
    "utf-8",
  );

  // Also seed story/chapters/index.json for volume-based routes
  await mkdir(join(bookDir, "story", "chapters"), { recursive: true });
  await writeFile(
    join(bookDir, "story", "chapters", "index.json"),
    JSON.stringify({ chapters: [
      { number: 1, title: "第一章 初入修仙", status: "approved", wordCount: 2100, createdAt: now, updatedAt: now, volumeId: null },
      { number: 2, title: "第二章 灵根测试", status: "audit-failed", wordCount: 1800, createdAt: now, updatedAt: now, volumeId: null },
      { number: 3, title: "第三章 初次历练", status: "drafted", wordCount: 2200, createdAt: now, updatedAt: now, volumeId: null },
      { number: 4, title: "第四章 秘境探索", status: "audit-failed", wordCount: 1950, createdAt: now, updatedAt: now, volumeId: null },
      { number: 5, title: "第五章 回归", status: "drafted", wordCount: 1500, createdAt: now, updatedAt: now, volumeId: null },
    ]}, null, 2),
    "utf-8",
  );

  // story/state/volumes.json
  await mkdir(stateDir, { recursive: true });
  await writeFile(
    join(stateDir, "volumes.json"),
    JSON.stringify({
      schemaVersion: "1",
      volumes: [],
    }, null, 2),
    "utf-8",
  );

  // ── Sidebar component Mock data ──
  // BookDetail page renders BookSidebar + ChatPage; these components
  // call additional APIs that need Mock data to avoid page crashes.

  // story/truth/index.json — FoundationSection + CharacterSection
  const truthDir = join(bookDir, "story", "truth");
  await mkdir(truthDir, { recursive: true });
  await writeFile(
    join(truthDir, "index.json"),
    JSON.stringify({}),
    "utf-8",
  );

  // story/truth/outline/story_frame.md — SummarySection
  const outlineDir = join(truthDir, "outline");
  await mkdir(outlineDir, { recursive: true });
  await writeFile(
    join(outlineDir, "story_frame.md"),
    "# Outline\n\nChapter 1: 初入修仙\nChapter 2: 灵根测试\n",
    "utf-8",
  );

  // sessions/<bookId>/index.json — ChatPage
  const sessionsDir = join(E2E_ROOT, "sessions", E2E_BOOK_ID);
  await mkdir(sessionsDir, { recursive: true });
  await writeFile(
    join(sessionsDir, "index.json"),
    JSON.stringify({ sessions: [] }),
    "utf-8",
  );
}
