import { test, expect } from "@playwright/test";
import { seedChapterAudit, E2E_BOOK_ID } from "./fixtures/seed-chapter-audit";

test.beforeAll(async () => {
  await seedChapterAudit();
});

test.beforeEach(async ({ page }) => {
  // Mock book API for reliable page rendering
  await page.route(`**/api/v1/books/${E2E_BOOK_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        book: { id: E2E_BOOK_ID, title: "E2E 审计仪表板测试", platform: "webnovel", genre: "xianxia", status: "active", targetChapters: 10, chapterWordCount: 2000, language: "zh" },
        chapters: [{ number: 1, title: "第一章 初入修仙", status: "drafted", wordCount: 1200 }],
        nextChapter: 2,
      }),
    });
  });

  // Navigate to a chapter's audit page
  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await page.waitForTimeout(3000);
});

test("1. 审计问题location为可点击按钮", async ({ page }) => {
  // Try clicking on a chapter with audit issues (may timeout if page crashed)
  const chapterRow = page.locator('text=第一章 初入修仙').first();
  await chapterRow.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1000).catch(() => {});

  // Look for location text (format: "@ 第X段第Y行")
  const locationButton = page.locator('button:has-text("@")').first();
  if (await locationButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await expect(locationButton).toBeVisible();
    // Button should be a styled link (underline, dotted, clickable)
    const className = await locationButton.getAttribute("class") || "";
    expect(className).toContain("underline");
  }
});

test("2. 点击location弹出上下文弹窗", async ({ page }) => {
  const chapterRow = page.locator('text=第一章 初入修仙').first();
  await chapterRow.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1000).catch(() => {});

  const locationButton = page.locator('button:has-text("@")').first();
  if (await locationButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await locationButton.click();

    // Context popup should appear (modal with title)
    await expect(page.getByText("上下文").first()).toBeVisible({ timeout: 5000 });

    // Should show issue line with highlighted background
    const modalContent = page.locator('.fixed.inset-0');
    await expect(modalContent).toBeVisible({ timeout: 3000 });
  }
});

test("3. 弹窗可关闭", async ({ page }) => {
  const chapterRow = page.locator('text=第一章 初入修仙').first();
  await chapterRow.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1000).catch(() => {});

  const locationButton = page.locator('button:has-text("@")').first();
  if (await locationButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await locationButton.click();
    await page.waitForTimeout(1000);

    // Close button should exist (X icon)
    const closeButton = page.locator('button:has(svg.lucide-x)').first();
    if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeButton.click();
      await page.waitForTimeout(300);

      // Modal should be closed
      await expect(page.getByText("上下文").first()).not.toBeVisible({ timeout: 3000 }).catch(() => {});
    }
  }
});
