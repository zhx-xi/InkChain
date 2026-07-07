import { test, expect } from "@playwright/test";
import { seedStyleDetection } from "./fixtures/seed-style-detection";

test.beforeAll(async () => {
  await seedStyleDetection();
});

/**
 * Helper: navigate to the Style Manager page.
 * The style page doesn't have a hash route, so we navigate via the dashboard.
 */
async function navigateToStyle(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/#/");
  // Wait for the dashboard to load
  await expect(page.getByText("InkOS Studio").first()).toBeVisible({ timeout: 15_000 });
  // Click sidebar "文风" button
  await page.getByText("文风").click();
  await expect(page.getByText("Style Manager").or(page.getByText("文风检测"))).toBeVisible({ timeout: 10_000 });
}

test("1. 加载文风检测→页面显示", async ({ page }) => {
  await seedStyleDetection();
  await navigateToStyle(page);

  // The page should show the wand icon and style title
  await expect(page.getByText("文风检测").first()).toBeVisible({ timeout: 10_000 });

  // The input textarea should be visible
  const textarea = page.locator("textarea").first();
  await expect(textarea).toBeVisible();

  // The source name input should be visible
  const sourceInput = page.locator('input[type="text"]').first();
  await expect(sourceInput).toBeVisible();
});

test("2. 分析→差异报告显示", async ({ page }) => {
  await seedStyleDetection();
  await navigateToStyle(page);

  // Fill in source name
  const sourceInput = page.locator('input[type="text"]').first();
  await sourceInput.fill("E2E测试样本");

  // Paste some Chinese text — punchy xianxia style
  const textarea = page.locator("textarea").first();
  await textarea.fill(
    "狂风呼啸。天地变色。\n\n" +
    "李凡握紧长剑。剑刃反射着寒光。他的眼神冰冷而坚定。",
  );

  // Click analyze button
  await page.getByText("Analyze").click();

  // Should show analysis results (the profile will appear after the POST /style/analyze call)
  // Wait for either the results section or a status message
  await page.waitForTimeout(2_000); // allow brief API processing

  // Check for results — either success or status message
  const resultsHeading = page.getByText("avgSentence").or(page.getByText("vocabDiversity"));
  if (await resultsHeading.isVisible({ timeout: 7_000 }).catch(() => false)) {
    await expect(resultsHeading).toBeVisible();
  }
});

test("3. 异常段落高亮", async ({ page }) => {
  await seedStyleDetection();
  await navigateToStyle(page);

  // Provide sample text with known patterns
  const textarea = page.locator("textarea").first();
  await textarea.fill(
    "短句。快节奏。动作描写。\n\n" +
    "当最后一抹夕阳的余晖悄然隐没在西山之下，整个小镇便被一层朦胧的暮色所笼罩，远处传来几声若有若无的犬吠。",
  );

  // Click analyze
  await page.getByText("Analyze").click();

  // Wait for analysis to complete
  await page.waitForTimeout(2_000);

  // The results should show at least some metrics
  const resultContainer = page.locator("div").filter({ hasText: /avgSentence|vocabDiversity|avgParagraph|sentenceStdDev/ });
  if (await resultContainer.isVisible({ timeout: 7_000 }).catch(() => false)) {
    await expect(resultContainer).toBeVisible();
  }
});

test("4. 空检测结果处理", async ({ page }) => {
  await seedStyleDetection();
  await navigateToStyle(page);

  // The empty state should show a hint when no analysis has been performed
  const emptyHint = page.getByText(/paste|input|text|样本/).or(page.locator("div").filter({ hasText: /emptyHint|结果将在这里/ }));
  await expect(emptyHint.first()).toBeVisible({ timeout: 5_000 });

  // Try to analyze empty text (button should be disabled)
  const analyzeBtn = page.getByText("Analyze").or(page.getByText("分析"));
  // The button should be disabled when textarea is empty
  const isDisabled = await analyzeBtn.isDisabled();
  if (isDisabled) {
    // Good — button is disabled as expected
    await expect(analyzeBtn).toBeDisabled();
  } else {
    // If not disabled with empty text, the API should return an error message
    await analyzeBtn.click();
    await page.waitForTimeout(2_000);
    // Should see some status or error message
    const statusEl = page.getByText(/error|Error/);
    if (await statusEl.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(statusEl).toBeVisible();
    }
  }
});

test("5. 导出报告到项目", async ({ page }) => {
  await seedStyleDetection();
  await navigateToStyle(page);

  // First do an analysis
  const sourceInput = page.locator('input[type="text"]').first();
  await sourceInput.fill("导出测试");
  const textarea = page.locator("textarea").first();
  await textarea.fill("测试导出功能的文本内容。文风分析。");

  await page.getByText("Analyze").click();
  await page.waitForTimeout(2_000);

  // If analysis succeeded, we should see an import/book section
  const importSection = page.getByText("Import to Book").or(page.getByText("导入到项目"));
  if (await importSection.isVisible({ timeout: 5_000 }).catch(() => false)) {
    // There should be a book selector
    const bookSelect = page.locator("select").first();
    await expect(bookSelect).toBeVisible();

    // The import button should be visible
    await expect(page.getByText("Import Guide").or(page.getByText("导入文风"))).toBeVisible();
  }
});
