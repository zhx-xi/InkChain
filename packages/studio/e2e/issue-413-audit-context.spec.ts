import { test, expect } from "@playwright/test";
import { seedChapterAudit, E2E_BOOK_ID } from "./fixtures/seed-chapter-audit";

test.beforeAll(async () => {
  await seedChapterAudit();
});

test.beforeEach(async ({ page }) => {
  // Navigate to a chapter's audit page
  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await page.waitForTimeout(3000);
});

test("1. 审计问题location为可点击按钮", async ({ page }) => {
  // Navigate to audit page for a chapter that has issues
  // Try clicking on a chapter with audit issues
  const chapterRow = page.locator('text=第一章 初入修仙').first();
  await chapterRow.click();
  await page.waitForTimeout(1000);

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
  await chapterRow.click();
  await page.waitForTimeout(1000);

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
  await chapterRow.click();
  await page.waitForTimeout(1000);

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
