// ── Dynamic Chapter Count E2E (Issue #472) ──
// Validates that the foreshadowing page uses the real chapter count
// instead of the hardcoded 999, and handles the zero-chapter edge case.

import { test, expect } from "@playwright/test";
import {
  seedForeshadowing,
  E2E_FORES_BOOK_ID,
} from "./fixtures/seed-foreshadowing";
import { seedVolumeDnd } from "./fixtures/seed-volume-dnd";

// ── Setup ──────────────────────────────────────────────────────

test.beforeAll(async () => {
  // Seed both book chapters (for chapter count) and foreshadowing data.
  // The book "e2e-volume-dnd" has chapters 1-5, so nextChapter=6,
  // and the dynamic chapter count will be effectiveChapter=5.
  await seedVolumeDnd();
  await seedForeshadowing();
});

test.beforeEach(async ({ page }) => {
  await seedVolumeDnd();
  await seedForeshadowing();
  await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
  await expect(page.getByRole("heading", { name: "伏笔追踪" })).toBeVisible({ timeout: 15_000 });
});

// ── Tests ──────────────────────────────────────────────────────

test("1. AI 提取按钮在正常章节数下可点击", async ({ page }) => {
  // The seed book e2e-volume-dnd has chapters 1-5, so nextChapter = 6.
  // The dynamic chapter code computes effectiveChapter = Math.max(1, 6-1) = 5.
  // The button should be enabled (hasChapters = true).
  const extractBtn = page.getByRole("button", { name: /AI 提取/ }).first();
  await expect(extractBtn).toBeVisible({ timeout: 5_000 });
  await expect(extractBtn).toBeEnabled({ timeout: 3_000 });
});

test("2. 零章节时 AI 提取按钮禁用并显示提示", async ({ page }) => {
  // Mock the book API to return nextChapter=1 (meaning 0 chapters exist).
  // The effectiveChapter = Math.max(1, 1-1) = 0 → Math.max(1, 0) = 1.
  // hasNoChapters = true when nextChapter-1 === 0.
  await page.route("**/api/v1/books/e2e-volume-dnd", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ nextChapter: 1 }),
      });
    } else {
      await route.continue();
    }
  });

  await page.reload();
  await expect(page.getByRole("heading", { name: "伏笔追踪" })).toBeVisible({ timeout: 15_000 });

  // The "开始提取" button inside the AI extract modal should be disabled
  // after clicking the AI 提取 button
  await page.getByRole("button", { name: /AI 提取/ }).first().click();
  await expect(page.getByText("AI 提取伏笔")).toBeVisible({ timeout: 5_000 });

  const startBtn = page.getByRole("button", { name: "开始提取" });
  await expect(startBtn).toBeDisabled({ timeout: 3_000 });

  // A hint message about no chapters should appear
  await expect(page.getByText("暂无章节，请先创作章节")).toBeVisible({ timeout: 3_000 });
});

test("3. Foreshadowing API 使用动态章节数而非 999", async ({ page }) => {
  // Intercept the foreshadowing GET (list) request and capture the URL.
  let capturedUrl: string | null = null;
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes("/api/v1/foreshadowing") && resp.request().method() === "GET",
  );

  // Reload to trigger the foreshadowing list fetch
  await page.reload();
  const response = await responsePromise;
  capturedUrl = response.url();

  await expect(page.getByRole("heading", { name: "伏笔追踪" })).toBeVisible({ timeout: 15_000 });

  // Verify the captured URL uses a dynamic chapter count (nextChapter-1 = 5)
  // The seed book has chapters 1-5, so nextChapter=6, effective=5
  expect(capturedUrl).not.toBeNull();
  expect(capturedUrl).toContain("currentChapter=");
  expect(capturedUrl).not.toContain("currentChapter=999");
  // Verify chapter count is reasonable (not 999 but a number >= 1)
  const match = capturedUrl!.match(/currentChapter=(\d+)/);
  expect(match).not.toBeNull();
  const chapterCount = parseInt(match![1], 10);
  expect(chapterCount).toBeGreaterThan(0);
  expect(chapterCount).toBeLessThan(100); // sanity: not 999
});
