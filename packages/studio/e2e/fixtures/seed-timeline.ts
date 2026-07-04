import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export const E2E_ROOT = resolve(__dirname, "../../../..", "test-project");
export const E2E_TIMELINE_BOOK_ID = "e2e-timeline";

export async function seedTimeline(): Promise<void> {
  const bookDir = join(E2E_ROOT, "books", E2E_TIMELINE_BOOK_ID);
  const stateDir = join(bookDir, "story", "state");

  const now = new Date("2026-07-04T00:00:00.000Z").toISOString();

  // Minimal book config
  await mkdir(bookDir, { recursive: true });
  await writeFile(
    join(bookDir, "book.json"),
    JSON.stringify(
      {
        id: E2E_TIMELINE_BOOK_ID,
        title: "E2E 时间线测试",
        platform: "webnovel",
        genre: "xianxia",
        status: "active",
        targetChapters: 10,
        chapterWordCount: 2000,
        language: "zh",
        createdAt: now,
        updatedAt: now,
      },
      null,
      2,
    ),
    "utf-8",
  );

  // Timeline events
  await mkdir(stateDir, { recursive: true });
  await writeFile(
    join(stateDir, "character_timelines.json"),
    JSON.stringify(
      {
        version: 1,
        events: [
          {
            id: "tl-e2e-1",
            title: "主角入门",
            eventType: "plot",
            description: "主角拜入青云门",
            relatedCharacters: ["叶云", "掌门"],
            chapter: 1,
            importance: 5,
            tags: ["入门", "关键事件"],
            timestamp: now,
          },
          {
            id: "tl-e2e-2",
            title: "结识好友",
            eventType: "character",
            description: "主角在练功场认识了林月",
            relatedCharacters: ["叶云", "林月"],
            chapter: 2,
            importance: 3,
            tags: ["友情"],
            timestamp: now,
          },
          {
            id: "tl-e2e-3",
            title: "发现秘境",
            eventType: "world",
            description: "后山出现远古秘境入口",
            relatedCharacters: ["叶云"],
            chapter: 3,
            importance: 4,
            tags: ["秘境", "探险"],
            timestamp: now,
          },
          {
            id: "tl-e2e-4",
            title: "获得传承",
            eventType: "plot",
            description: "主角在秘境中获得上古传承",
            relatedCharacters: ["叶云", "上古大能"],
            chapter: 5,
            importance: 5,
            tags: ["传承", "关键事件", "力量提升"],
            timestamp: now,
          },
        ],
      },
      null,
      2,
    ),
    "utf-8",
  );
}

/** Reset the timeline state to an empty array */
export async function clearTimeline(): Promise<void> {
  const stateDir = join(E2E_ROOT, "books", E2E_TIMELINE_BOOK_ID, "story", "state");
  await mkdir(stateDir, { recursive: true });
  await writeFile(
    join(stateDir, "character_timelines.json"),
    JSON.stringify({ version: 1, events: [] }, null, 2),
    "utf-8",
  );
}
