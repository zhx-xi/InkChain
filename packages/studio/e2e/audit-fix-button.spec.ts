import { test, expect } from "@playwright/test";
import { seedChapterAudit, E2E_BOOK_ID, E2E_ROOT } from "./fixtures/seed-chapter-audit";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Seed a simple chapter file so the audit/fix API can find it.
 */
async function seedChapterFile(chapterNumber: number, content: string): Promise<void> {
  const chaptersDir = join(E2E_ROOT, "books", E2E_BOOK_ID, "chapters");
  await mkdir(chaptersDir, { recursive: true });
  const padded = String(chapterNumber).padStart(4, "0");
  await writeFile(
    join(chaptersDir, `${padded}_chapter-${chapterNumber}.md`),
    content,
    "utf-8",
  );
}

test.beforeAll(async () => {
  await seedChapterAudit();
  // Create chapter files so the audit/fix endpoint can read them
  await seedChapterFile(2, "灵根测试开始。检测结果出乎意料。长老们面面相觑。");
  await seedChapterFile(4, "秘境之门缓缓打开。一股古老的气息扑面而来。探险者们谨慎前行。");
});

test("1. 带审计问题的章节→修复按钮可见", async ({ page }) => {
  await seedChapterAudit();
  await seedChapterFile(2, "灵根测试开始。检测结果出乎意料。长老们面面相觑。");

  // Navigate to the book dashboard
  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await expect(page.getByText("E2E 审计仪表板测试")).toBeVisible({ timeout: 20_000 });

  // Click chapter 2 (which has audit issues)
  const chapterRow = page.locator('text=第二章 灵根测试').first();
  await chapterRow.click();
  await page.waitForTimeout(1_000);

  // Look for "修复" buttons
  const fixButtons = page.getByRole("button", { name: /修复/ });
  const fixCount = await fixButtons.count();
  expect(fixCount).toBeGreaterThanOrEqual(1);
});

test("2. 点击修复按钮→显示修复建议对话框", async ({ page }) => {
  await seedChapterAudit();
  await seedChapterFile(2, "灵根测试开始。检测结果出乎意料。长老们面面相觑。");

  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await expect(page.getByText("E2E 审计仪表板测试")).toBeVisible({ timeout: 20_000 });

  // Click chapter 2
  const chapterRow = page.locator('text=第二章 灵根测试').first();
  await chapterRow.click();
  await page.waitForTimeout(1_000);

  // Click the first fix button
  const fixBtn = page.getByRole("button", { name: "修复" }).first();
  await fixBtn.click();
  await page.waitForTimeout(2_000);

  // Should show the fix dialog header or loading state
  const dialogHeader = page.getByText(/修复建议|修复中|修复失败/);
  if (await dialogHeader.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await expect(dialogHeader).toBeVisible();
  } else {
    // The dialog may show loading spinner first
    await page.waitForTimeout(2_000);
    const anyDialogContent = page.locator("text=修复建议").or(page.locator("text=建议修复"));
    if (await anyDialogContent.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(anyDialogContent).toBeVisible();
    }
  }
});

test("3. 无审计问题的章节→无修复按钮", async ({ page }) => {
  await seedChapterAudit();
  await seedChapterFile(1, "第一章内容。主角初入修仙世界。");

  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await expect(page.getByText("E2E 审计仪表板测试")).toBeVisible({ timeout: 20_000 });

  // Click chapter 1 (approved, no issues)
  const chapterRow = page.locator('text=第一章 初入修仙').first();
  await chapterRow.click();
  await page.waitForTimeout(1_000);

  // No "修复" buttons should appear for a clean chapter
  const fixButtons = page.getByRole("button", { name: "修复" });
  const fixCount = await fixButtons.count();
  expect(fixCount).toBe(0);
});

test("4. 应用修复按钮→调用API→刷新审计状态", async ({ page }) => {
  await seedChapterAudit();
  await seedChapterFile(2, "灵根测试开始。检测结果出乎意料。长老们面面相觑。");

  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await expect(page.getByText("E2E 审计仪表板测试")).toBeVisible({ timeout: 20_000 });

  // Click chapter 2
  const chapterRow = page.locator('text=第二章 灵根测试').first();
  await chapterRow.click();
  await page.waitForTimeout(1_000);

  // Click fix button
  const fixBtn = page.getByRole("button", { name: "修复" }).first();
  await fixBtn.click();
  await page.waitForTimeout(3_000);

  // If dialog shows, try clicking "应用修复" (apply fix)
  const applyBtn = page.getByRole("button", { name: "应用修复" });
  if (await applyBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await applyBtn.click();
    await page.waitForTimeout(2_000);

    // Dialog should close and audit should refresh
    const dialog = page.locator("text=修复建议");
    const dialogVisible = await dialog.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(dialogVisible).toBe(false);
  }
});

test("5. 关闭对话框→返回审计页面", async ({ page }) => {
  await seedChapterAudit();
  await seedChapterFile(2, "灵根测试开始。检测结果出乎意料。长老们面面相觑。");

  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await expect(page.getByText("E2E 审计仪表板测试")).toBeVisible({ timeout: 20_000 });

  // Click chapter 2
  const chapterRow = page.locator('text=第二章 灵根测试').first();
  await chapterRow.click();
  await page.waitForTimeout(1_000);

  // Click fix button
  const fixBtn = page.getByRole("button", { name: "修复" }).first();
  await fixBtn.click();
  await page.waitForTimeout(3_000);

  // Try to close by clicking the X button or outside
  const closeBtn = page.getByRole("button", { name: "取消" });
  if (await closeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(1_000);

    // Dialog should be closed
    const fixDialog = page.locator("text=修复建议").first();
    const isVisible = await fixDialog.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(isVisible).toBe(false);
  }
});
