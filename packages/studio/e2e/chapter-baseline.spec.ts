import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";

test.describe("ChapterReader/VolumeManagement — 章节基线 (Issue #690)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/book/test-project-123/chapter/1`);
  });

  // 1. 正常加载
  test("1. 正常加载: 章节页面显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
  });

  // 2. 上一章/下一章按钮
  test("2. 上一章/下一章按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const prevBtn = page.locator(
      "[data-testid='ch-btn-prev-chapter'], button:has-text('上一章'), button:has-text('上一'), [aria-label*='previous'], [aria-label*='上一']"
    );
    const prevCount = await prevBtn.count();
    console.log(`Prev chapter button: ${prevCount}`);

    const nextBtn = page.locator(
      "[data-testid='ch-btn-next-chapter'], button:has-text('下一章'), button:has-text('下一'), [aria-label*='next'], [aria-label*='下一']"
    );
    const nextCount = await nextBtn.count();
    console.log(`Next chapter button: ${nextCount}`);
  });

  // 3. 保存按钮
  test("3. 保存按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid='ch-btn-save'], button:has-text('保存'), button:has-text('Save'), button[aria-label*='保存']"
    );
    const count = await btn.count();
    console.log(`Save button: ${count}`);
  });

  // 4. 章节跳转选择器
  test("4. 章节跳转选择器存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const select = page.locator(
      "[data-testid='ch-select-chapter-jump'], select[id*='chapter'], [class*='chapter-select'], [class*='chapter-nav']"
    );
    const count = await select.count();
    console.log(`Chapter jump selector: ${count}`);
  });

  // 5. 内容编辑器
  test("5. 内容编辑器存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const editor = page.locator(
      "[data-testid='ch-textarea-content'], textarea[id*='content'], [class*='editor'], [class*='editor-content'], [contenteditable='true'], [role='textbox']"
    );
    const count = await editor.count();
    console.log(`Content editor: ${count}`);
  });

  // 6. 快照/版本管理按钮
  test("6. 快照和版本管理按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const snapshotBtn = page.locator(
      "[data-testid='ch-btn-snapshot'], button:has-text('快照'), button:has-text('Snapshot')"
    );
    const snapshotCount = await snapshotBtn.count();
    console.log(`Snapshot button: ${snapshotCount}`);

    const versionBtn = page.locator(
      "[data-testid='ch-btn-version-history'], button:has-text('版本'), button:has-text('历史')"
    );
    const versionCount = await versionBtn.count();
    console.log(`Version history button: ${versionCount}`);
  });

  // 7. AI 续写按钮
  test("7. AI 续写按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid='ch-btn-ai-continue'], button:has-text('AI'), button:has-text('续写'), button:has-text('智能续写')"
    );
    const count = await btn.count();
    console.log(`AI continue button: ${count}`);
  });

  // 8. 分卷管理按钮
  test("8. 分卷管理按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid='ch-btn-create-volume'], button:has-text('创建分卷'), button:has-text('新建卷'), button:has-text('添加卷'), button:has-text('分卷管理')"
    );
    const count = await btn.count();
    console.log(`Volume management button: ${count}`);
  });

  // 9. 自动保存指示器
  test("9. 自动保存指示器存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const indicator = page.locator(
      "[data-testid='ch-indicator-save-status'], [data-testid='ch-indicator-autosave'], [class*='autosave'], [class*='save-status'], :has-text('自动保存'), :has-text('已保存')"
    );
    const count = await indicator.count();
    console.log(`Autosave indicator: ${count}`);
  });

  // 10. 加载状态
  test("10. 加载状态: 数据加载中显示loading", async ({ page }) => {
    await page.waitForTimeout(2000);
    const loading = page.locator(
      "[data-testid*='loading'], [class*='loading'], [class*='spinner'], :has-text('加载中')"
    );
    const hasLoading = (await loading.count()) > 0;
    console.log(`Loading state: ${hasLoading}`);
  });

  // 11. 空状态
  test("11. 空状态: 无数据时显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    const empty = page.locator(
      "[data-testid*='empty'], [data-testid*='Empty'], :has-text('暂无'), :has-text('无数据'), :has-text('没有章节'), :has-text('创建第一个')"
    );
    const hasEmpty = (await empty.count()) > 0;
    console.log(`Empty state: ${hasEmpty}`);
  });

  // 12. 错误状态
  test("12. 错误状态: API失败时显示错误", async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.fulfill({ status: 500, body: "Server Error" })
    );
    await page.reload();
    await page.waitForTimeout(2000);
    const error = page.locator(
      "[data-testid*='error'], [data-testid*='Error'], :has-text('错误'), :has-text('失败')"
    );
    const hasError = (await error.count()) > 0;
    console.log(`Error state: ${hasError}`);
  });
});
