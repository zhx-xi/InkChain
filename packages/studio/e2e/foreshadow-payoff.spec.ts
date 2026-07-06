import { test, expect, Page } from "@playwright/test";
import {
  seedForeshadowing,
  clearForeshadowing,
  E2E_FORES_BOOK_ID,
} from "./fixtures/seed-foreshadowing";

// ── Helpers ───────────────────────────────────────────────────────

function mockAiExtract(page: Page, entries: Array<Record<string, unknown>>) {
  page.route("**/api/extract", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { candidates: entries.map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description,
            type: e.type,
            chapter: e.chapter ?? 1,
            lastMentionedChapter: e.lastMentionedChapter,
            expectedPayoffChapter: e.expectedPayoffChapter,
            confidence: e.confidence ?? 0.8,
          }))},
        }),
      });
    } else {
      await route.continue();
    }
  });
}

// ── Setup ─────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await seedForeshadowing();
});

test.beforeEach(async ({ page }) => {
  await clearForeshadowing();
  await seedForeshadowing();
  await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
  await expect(page.getByRole("heading", { name: "伏笔追踪" })).toBeVisible({ timeout: 15_000 });
});

// ── Tests ─────────────────────────────────────────────────────────

test.describe("伏笔提取 — lastMentionedChapter 与 大纲未指定", () => {
  test("1. 提取结果中 lastMentionedChapter 和 expectedPayoffChapter 正确显示", async ({ page }) => {
    mockAiExtract(page, [
      {
        id: "fs-e2e-both-1",
        title: "暗红信封",
        description: "封蜡上刻着家族徽章",
        type: "情节伏笔",
        chapter: 2,
        lastMentionedChapter: 4,
        expectedPayoffChapter: 10,
        confidence: 0.95,
      },
    ]);

    // Open AI extract
    await page.getByRole("button", { name: /AI 提取/ }).click();
    await expect(page.getByText("AI 提取伏笔")).toBeVisible({ timeout: 3_000 });
    await page.getByRole("button", { name: "开始提取" }).click();

    await expect(page.getByText("暗红信封")).toBeVisible({ timeout: 8_000 });

    // Both fields should display
    await expect(page.getByText("最近提及：第 4 章").first()).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("预期回收：第 10 章").first()).toBeVisible({ timeout: 3_000 });
    // "大纲未指定" should NOT appear in the extraction results (only expected normal)
    // Scope to the extraction modal content area to avoid seed data matches
    const modal = page.getByText("AI 提取伏笔").locator("..");
    await expect(modal.getByText("大纲未指定")).not.toBeVisible({ timeout: 2_000 });
  });

  test("2. 已有伏笔列表中 expectedPayoffChapter=null 显示「大纲未指定」", async ({ page }) => {
    // Create a foreshadowing entry with null expectedPayoffChapter via API
    const createRes = await page.request.post("/api/foreshadowing", {
      data: {
        id: "fs-e2e-existing-null",
        bookId: E2E_FORES_BOOK_ID,
        title: "无名信件",
        description: "一封没有署名的神秘信件",
        type: "情节伏笔",
        status: "active",
        chapter: 3,
        lastMentionedChapter: 5,
        expectedPayoffChapter: null,
      },
    });
    expect([200, 201]).toContain(createRes.status());

    await page.reload();
    await expect(page.getByRole("heading", { name: "伏笔追踪" })).toBeVisible({ timeout: 15_000 });

    // The created entry should show "大纲未指定"
    await expect(page.getByText("无名信件")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("预期回收：大纲未指定").first()).toBeVisible({ timeout: 3_000 });
  });
});
