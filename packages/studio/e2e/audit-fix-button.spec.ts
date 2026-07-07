import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
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

/**
 * Mock the book detail API so the frontend loads "E2E 审计仪表板测试" book.
 */
async function mockBookApi(page: Page): Promise<void> {
  await page.route("**/api/v1/books/e2e-volume-dnd**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        book: {
          id: "e2e-volume-dnd",
          title: "E2E 审计仪表板测试",
          platform: "webnovel",
          genre: "xianxia",
          status: "active",
          targetChapters: 10,
          chapterWordCount: 2000,
          language: "zh",
        },
        chapters: [
          {
            number: 1,
            title: "第一章 初入修仙",
            status: "approved",
            wordCount: 2100,
            auditIssues: [],
            lengthWarnings: [],
          },
          {
            number: 2,
            title: "第二章 灵根测试",
            status: "audit-failed",
            wordCount: 1800,
            auditIssues: [
              { severity: "high", category: "逻辑矛盾", description: "灵根测试结果前后不一致" },
              { severity: "medium", category: "节奏问题", description: "第二章节奏偏慢，缺乏冲突" },
            ],
            lengthWarnings: [],
          },
          {
            number: 4,
            title: "第四章 秘境探索",
            status: "audit-failed",
            wordCount: 1950,
            auditIssues: [
              { severity: "high", category: "设定冲突", description: "秘境规则与第三章描述不符" },
              { severity: "high", category: "角色OOC", description: "主角行为与性格设定不符" },
            ],
            lengthWarnings: [],
          },
        ],
        nextChapter: 6,
      }),
    });
  });
}

/**
 * Mock the audit/fix endpoint.
 */
async function mockFixApi(page: Page): Promise<void> {
  await page.route("**/audit/fix**", (route) => {
    if (route.request().method() === "POST") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          chapterNumber: 2,
          suggestions: [
            {
              type: "逻辑矛盾",
              severity: "high",
              description: "灵根测试结果前后不一致",
              suggestion: "修复逻辑矛盾：统一灵根测试结果描述",
              original: "（@ 测试段）",
              replacement: "[已修复] 灵根测试结果前后不一致 —— 根据审计建议自动修正",
            },
            {
              type: "节奏问题",
              severity: "medium",
              description: "第二章节奏偏慢，缺乏冲突",
              suggestion: "优化节奏：添加冲突场景",
              original: "（@ 中间段）",
              replacement: "[已修复] 第二章节奏偏慢 —— 根据审计建议自动修正",
            },
          ],
          originalContent: "灵根测试开始。检测结果出乎意料。长老们面面相觑。",
        }),
      });
    } else {
      route.fulfill({ status: 405, body: "Method Not Allowed" });
    }
  });

  await page.route("**/audit/fix/apply**", (route) => {
    if (route.request().method() === "POST") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          chapterNumber: 2,
          message: "已对第 2 章应用 2 项修复",
          fixCount: 2,
        }),
      });
    } else {
      route.fulfill({ status: 405, body: "Method Not Allowed" });
    }
  });
}

test.beforeAll(async () => {
  await seedChapterAudit();
  await seedChapterFile(2, "灵根测试开始。检测结果出乎意料。长老们面面相觑。");
  await seedChapterFile(4, "秘境之门缓缓打开。一股古老的气息扑面而来。");
});

test("1. 带审计问题的章节→修复按钮可见", async ({ page }) => {
  await mockBookApi(page);
  await mockFixApi(page);

  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await expect(page.getByText("E2E 审计仪表板测试")).toBeVisible({ timeout: 20_000 });

  // Click chapter 2 (which has audit issues)
  const chapterRow = page.locator('text=第二章 灵根测试').first();
  await chapterRow.click();
  await page.waitForTimeout(1_500);

  // Look for "修复" buttons
  const fixButtons = page.getByRole("button", { name: /修复/ });
  const fixCount = await fixButtons.count();
  expect(fixCount).toBeGreaterThanOrEqual(1);
});

test("2. 点击修复按钮→显示修复建议对话框", async ({ page }) => {
  await mockBookApi(page);
  await mockFixApi(page);

  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await expect(page.getByText("E2E 审计仪表板测试")).toBeVisible({ timeout: 20_000 });

  // Click chapter 2
  const chapterRow = page.locator('text=第二章 灵根测试').first();
  await chapterRow.click();
  await page.waitForTimeout(1_500);

  // Click the first fix button
  const fixBtn = page.getByRole("button", { name: "修复" }).first();
  await fixBtn.click();
  await page.waitForTimeout(2_000);

  // Should show the fix dialog with suggestions
  const dialogContent = page.locator("text=修复建议");
  await expect(dialogContent).toBeVisible({ timeout: 5_000 });
});

test("3. 无审计问题的章节→无修复按钮", async ({ page }) => {
  await mockBookApi(page);
  await mockFixApi(page);

  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await expect(page.getByText("E2E 审计仪表板测试")).toBeVisible({ timeout: 20_000 });

  // Click chapter 1 (approved, no issues)
  const chapterRow = page.locator('text=第一章 初入修仙').first();
  await chapterRow.click();
  await page.waitForTimeout(1_500);

  // No "修复" buttons should appear for a clean chapter
  const fixButtons = page.getByRole("button", { name: "修复" });
  const fixCount = await fixButtons.count();
  expect(fixCount).toBe(0);
});

test("4. 应用修复→调用API成功→对话框关闭", async ({ page }) => {
  await mockBookApi(page);
  await mockFixApi(page);

  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await expect(page.getByText("E2E 审计仪表板测试")).toBeVisible({ timeout: 20_000 });

  // Click chapter 2
  const chapterRow = page.locator('text=第二章 灵根测试').first();
  await chapterRow.click();
  await page.waitForTimeout(1_500);

  // Click fix button
  const fixBtn = page.getByRole("button", { name: "修复" }).first();
  await fixBtn.click();
  await page.waitForTimeout(2_000);

  // Dialog should show with suggestions
  await expect(page.getByText("修复建议")).toBeVisible({ timeout: 5_000 });

  // Click "应用修复" button
  const applyBtn = page.getByRole("button", { name: "应用修复" });
  await applyBtn.click();
  await page.waitForTimeout(2_000);

  // Dialog should close
  const dialog = page.locator("text=修复建议");
  const dialogVisible = await dialog.isVisible({ timeout: 3_000 }).catch(() => false);
  expect(dialogVisible).toBe(false);
});

test("5. 关闭按钮→取消修复→对话框消失", async ({ page }) => {
  await mockBookApi(page);
  await mockFixApi(page);

  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await expect(page.getByText("E2E 审计仪表板测试")).toBeVisible({ timeout: 20_000 });

  // Click chapter 2
  const chapterRow = page.locator('text=第二章 灵根测试').first();
  await chapterRow.click();
  await page.waitForTimeout(1_500);

  // Click fix button
  const fixBtn = page.getByRole("button", { name: "修复" }).first();
  await fixBtn.click();
  await page.waitForTimeout(2_000);

  // Dialog should show
  await expect(page.getByText("修复建议")).toBeVisible({ timeout: 5_000 });

  // Click "取消" button
  const cancelBtn = page.getByRole("button", { name: "取消" });
  await cancelBtn.click();
  await page.waitForTimeout(1_000);

  // Dialog should close
  const fixDialog = page.locator("text=修复建议").first();
  const isVisible = await fixDialog.isVisible({ timeout: 2_000 }).catch(() => false);
  expect(isVisible).toBe(false);
});
