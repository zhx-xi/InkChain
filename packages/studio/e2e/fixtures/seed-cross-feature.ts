import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
export const E2E_ROOT = resolve(__dirname, "../../", "test-project");
export const E2E_BOOK_ID = "e2e-volume-dnd";

/** Book-B ID for multi-book isolation tests */
export const E2E_BOOK_B_ID = "e2e-cross-feature-book-b";

export async function seedCrossFeature(): Promise<void> {
  const now = new Date("2026-07-05T00:00:00.000Z").toISOString();

  // ── Book-A: chapters + roles + relations ──
  const bookDir = join(E2E_ROOT, "books", E2E_BOOK_ID);
  await mkdir(join(bookDir, "story", "state"), { recursive: true });
  await mkdir(join(bookDir, "chapters"), { recursive: true });
  await mkdir(join(bookDir, "story", "chapters"), { recursive: true });
  await mkdir(join(bookDir, "roles"), { recursive: true });

  // book.json
  await writeFile(
    join(bookDir, "book.json"),
    JSON.stringify({
      id: E2E_BOOK_ID,
      title: "E2E 跨功能测试书",
      platform: "webnovel",
      genre: "xianxia",
      status: "active",
      targetChapters: 20,
      chapterWordCount: 2000,
      language: "zh",
      createdAt: now,
      updatedAt: now,
    }),
    "utf-8",
  );

  // chapters/index.json
  const chapters = [
    { number: 1, title: "第一章 初入修仙", status: "drafted", wordCount: 1200, volumeId: null, auditIssues: [], lengthWarnings: [] },
    { number: 2, title: "第二章 灵根测试", status: "drafted", wordCount: 1500, volumeId: null, auditIssues: [], lengthWarnings: [] },
    { number: 3, title: "第三章 拜师", status: "active", wordCount: 1800, volumeId: null, auditIssues: [], lengthWarnings: [] },
    { number: 4, title: "第四章 秘境探索", status: "drafted", wordCount: 2000, volumeId: null, auditIssues: [], lengthWarnings: [] },
    { number: 5, title: "第五章 回归", status: "drafted", wordCount: 900, volumeId: null, auditIssues: [], lengthWarnings: [] },
  ];
  await writeFile(join(bookDir, "chapters", "index.json"), JSON.stringify(chapters, null, 2), "utf-8");
  await writeFile(
    join(bookDir, "story", "chapters", "index.json"),
    JSON.stringify({ chapters: chapters.map(({ auditIssues, lengthWarnings, ...c }) => c) }, null, 2),
    "utf-8",
  );

  // Roles
  await mkdir(join(bookDir, "roles", "major"), { recursive: true });
  for (const role of [
    { name: "叶辰", description: "主角", tier: "major", traits: ["勇敢", "坚毅"] },
    { name: "青云真人", description: "师父", tier: "major", traits: ["智慧", "慈祥"] },
    { name: "魔子", description: "反派", tier: "major", traits: ["野心", "冷酷"] },
  ]) {
    await writeFile(
      join(bookDir, "roles", role.tier, `${role.name}.md`),
      `# ${role.name}\n\n${role.description}\n\n特质: ${role.traits.join(", ")}`,
      "utf-8",
    );
  }

  // Relations
  await writeFile(
    join(bookDir, "story", "state", "relations.json"),
    JSON.stringify({
      schemaVersion: "1",
      relations: [
        { id: "cf-rel-1", sourceRoleId: "char-1", targetRoleId: "char-2", relationType: "师徒", label: "师父", intensity: 5, bidirectional: false, isForgotten: false, description: "叶辰拜青云真人师", validFromChapter: 1, validToChapter: null, createdAt: now, updatedAt: now },
        { id: "cf-rel-2", sourceRoleId: "char-1", targetRoleId: "char-3", relationType: "敌对", label: "宿敌", intensity: 4, bidirectional: true, isForgotten: false, description: "叶辰与魔子宿敌", validFromChapter: 3, validToChapter: null, createdAt: now, updatedAt: now },
      ],
    }, null, 2),
    "utf-8",
  );

  // Foreshadowing
  await mkdir(join(E2E_ROOT, ".inkos", "foreshadowing"), { recursive: true });
  for (const fs of [
    { id: "cf-fs-1", bookId: E2E_BOOK_ID, title: "神秘戒指", description: "隐藏上古力量", type: "物品伏笔", status: "active", createdChapter: 1, lastMentionedChapter: 3, expectedPayoffChapter: 10, payoffChapter: null, notes: "", createdAt: now, updatedAt: now },
    { id: "cf-fs-2", bookId: E2E_BOOK_ID, title: "青云秘境", description: "秘境隐藏秘密", type: "设定伏笔", status: "active", createdChapter: 4, lastMentionedChapter: 4, expectedPayoffChapter: null, payoffChapter: null, notes: "", createdAt: now, updatedAt: now },
  ]) {
    await writeFile(join(E2E_ROOT, ".inkos", "foreshadowing", `${fs.id}.json`), JSON.stringify(fs, null, 2), "utf-8");
  }

  // Timeline events
  const timelineDir = join(bookDir, "story", "state");
  await writeFile(
    join(timelineDir, "timelines.json"),
    JSON.stringify({
      schemaVersion: "1",
      events: [
        { id: "cf-tl-1", bookId: E2E_BOOK_ID, title: "主角入门", eventType: "plot", description: "叶辰拜入青云门", chapter: 1, importance: 4, characters: ["叶辰", "青云真人"], tags: ["入门", "关键事件"], createdAt: now, updatedAt: now },
        { id: "cf-tl-2", bookId: E2E_BOOK_ID, title: "发现秘境", eventType: "world", description: "后山秘境入口", chapter: 4, importance: 3, characters: ["叶辰"], tags: ["探索"], createdAt: now, updatedAt: now },
      ],
    }, null, 2),
    "utf-8",
  );

  // ── Book-B: minimal book for multi-book isolation test ──
  const bookBDir = join(E2E_ROOT, "books", E2E_BOOK_B_ID);
  await mkdir(join(bookBDir, "chapters"), { recursive: true });
  await mkdir(join(bookBDir, "story", "chapters"), { recursive: true });
  await mkdir(join(bookBDir, "roles"), { recursive: true });

  await writeFile(
    join(bookBDir, "book.json"),
    JSON.stringify({
      id: E2E_BOOK_B_ID,
      title: "E2E 跨功能测试书-B",
      platform: "webnovel",
      genre: "yanqing",
      status: "active",
      targetChapters: 5,
      chapterWordCount: 1500,
      language: "zh",
      createdAt: now,
      updatedAt: now,
    }),
    "utf-8",
  );

  await writeFile(
    join(bookBDir, "chapters", "index.json"),
    JSON.stringify([
      { number: 1, title: "第一章 相遇", status: "drafted", wordCount: 1000, volumeId: null, auditIssues: [], lengthWarnings: [] },
    ]),
    "utf-8",
  );

  await writeFile(
    join(bookBDir, "story", "chapters", "index.json"),
    JSON.stringify({ chapters: [{ number: 1, title: "第一章 相遇", status: "drafted", wordCount: 1000 }] }),
    "utf-8",
  );

  // Book-B has a character with the same name as Book-A but NO relations/foreshadowing — to check isolation
  await mkdir(join(bookBDir, "roles", "major"), { recursive: true });
  await writeFile(join(bookBDir, "roles", "major", "叶辰.md"), `# 叶辰\n\n另一个书的叶辰`, "utf-8");
}
