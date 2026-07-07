import { test, expect } from "@playwright/test";
import { seedStyleDetection, E2E_STYLE_BOOK_ID } from "./fixtures/seed-style-detection";

/**
 * Helper: navigate to the Style Manager page via sidebar.
 * Uses a precise locator to find the sidebar "文风" button (not inside project cards).
 */
async function navigateToStyle(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/#/");
  await expect(page.getByText("InkOS Studio").first()).toBeVisible({ timeout: 15_000 });
  // Find sidebar "文风" button — use the one adjacent to "Skill 库" in the tool section
  // The sidebar has multiple "文风" buttons (one per book project), so pick any of them
  // by finding a button with label "文风" in the sidebar area
  await page.locator("nav button").filter({ hasText: "文风" }).first().click();
  await expect(page.getByText("文风检测").first()).toBeVisible({ timeout: 10_000 });
}

test.beforeAll(async () => {
  await seedStyleDetection();
});

test("1. 加载文风检测页面显示按章节分析区域", async ({ page }) => {
  await navigateToStyle(page);

  // The "按章节分析" section should be visible
  await expect(page.getByText("按章节分析")).toBeVisible({ timeout: 5_000 });
});

test("2. 选择书籍后章节范围选择器可用", async ({ page }) => {
  await navigateToStyle(page);

  // Select a book from the dropdown
  const bookSelect = page.locator("select").first();
  await bookSelect.selectOption(E2E_STYLE_BOOK_ID);

  // After selecting a book, the chapter range selectors should be enabled
  const selects = page.locator("select");
  const selectCount = await selects.count();
  expect(selectCount).toBeGreaterThanOrEqual(2);

  // The "起始章节" and "结束章节" labels should be visible
  await expect(page.getByText("起始章节")).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText("结束章节")).toBeVisible({ timeout: 3_000 });
});

test("3. 分卷筛选下拉列表可用", async ({ page }) => {
  await navigateToStyle(page);

  // Select a book
  const bookSelect = page.locator("select").first();
  await bookSelect.selectOption(E2E_STYLE_BOOK_ID);

  // Verify volume filter dropdown exists (should show "全部章节" option)
  const volumeSelect = page.locator("select").nth(1);
  await expect(volumeSelect).toBeVisible({ timeout: 3_000 });
  await expect(volumeSelect).not.toBeDisabled();
  await expect(volumeSelect.locator("option").first()).toHaveText("全部章节");
});

test("4. 章节范围可选择", async ({ page }) => {
  await navigateToStyle(page);

  // Select a book
  const bookSelect = page.locator("select").first();
  await bookSelect.selectOption(E2E_STYLE_BOOK_ID);

  // Chapter range selectors should have chapter options
  const selects = page.locator("select");
  // The 3rd and 4th selects are chapter range (if no volume filter)
  // or after the volume select
  // Let's find by checking for "起始章节" label
  const fromSelect = page.getByText("起始章节").locator("..").locator("select");
  await expect(fromSelect).toBeVisible({ timeout: 3_000 });
  await expect(fromSelect.locator("option")).toHaveCount(3); // 第1章, 第2章, 第3章

  const toSelect = page.getByText("结束章节").locator("..").locator("select");
  await expect(toSelect).toBeVisible({ timeout: 3_000 });

  // Select chapter 1→2
  await fromSelect.selectOption("1");
  await toSelect.selectOption("2");
});

test("5. 提取章节内容按钮可点击", async ({ page }) => {
  await navigateToStyle(page);

  // Select a book
  const bookSelect = page.locator("select").first();
  await bookSelect.selectOption(E2E_STYLE_BOOK_ID);

  // Click extract button
  const extractBtn = page.getByText("提取章节内容");
  await expect(extractBtn).toBeVisible({ timeout: 3_000 });
  await expect(extractBtn).not.toBeDisabled();

  // Click and verify loading state appears
  await extractBtn.click();
  await expect(page.getByText("提取中...").or(page.getByText("已加载"))).toBeVisible({ timeout: 10_000 });
});

test("6. 提取后内容填入文本框可分析", async ({ page }) => {
  await navigateToStyle(page);

  // Select a book and extract content
  const bookSelect = page.locator("select").first();
  await bookSelect.selectOption(E2E_STYLE_BOOK_ID);

  await page.getByText("提取章节内容").click();

  // Wait for extraction to complete
  await page.waitForTimeout(3_000);

  // Textarea should now have content
  const textarea = page.locator("textarea").first();
  const textContent = await textarea.inputValue();
  expect(textContent.length).toBeGreaterThan(0);
  expect(textContent).toContain("第1章");
});
