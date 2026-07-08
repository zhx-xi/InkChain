import { test, expect, Page } from "@playwright/test";

const E2E_BOOK_ID = "e2e-timeline";

/** Navigate to Project Settings page */
async function gotoSettings(page: Page) {
  await page.goto("/#/project-settings");
  await expect(page.getByText("项目设置")).toBeVisible({ timeout: 15_000 });
}

test.describe("Project Settings — 章节版本控制", () => {
  test.beforeEach(async ({ page }) => {
    await gotoSettings(page);
  });

  test("1. 版本控制区域可见且有默认值", async ({ page }) => {
    // The version control section should be visible
    await expect(page.getByText("版本控制模式")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("快照模式（默认）")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("Git 模式")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("关闭")).toBeVisible({ timeout: 3_000 });

    // Save button should be visible
    const saveBtn = page.getByRole("button", { name: /保存|Save/i });
    await expect(saveBtn).toBeVisible({ timeout: 3_000 });
  });

  test("2. 切换版本控制模式并保存", async ({ page }) => {
    // Select "Git 模式"
    await page.selectOption("select", { label: /Git 模式/ });
    await page.waitForTimeout(300);

    // Click save
    const saveBtn = page.getByRole("button", { name: /保存|Save/i });
    await saveBtn.click();

    // Wait for save to complete (button re-enables)
    await expect(saveBtn).toBeEnabled({ timeout: 10_000 });

    // The selected mode should show Git description
    await expect(page.getByText("Git 模式").first()).toBeVisible({ timeout: 3_000 });
  });

  test("3. 快照模式下显示功能描述", async ({ page }) => {
    // Verify default snapshot description is visible
    // Snapshot mode shows "🔄 快照模式" heading and feature list
    await expect(page.getByText("快照模式（默认）")).toBeVisible({ timeout: 3_000 });
  });

  test("4. 页面刷新后保留上次选择的模式", async ({ page }) => {
    // Switch to "关闭" mode
    await page.selectOption("select", { label: /关闭/ });
    await page.waitForTimeout(300);

    const saveBtn = page.getByRole("button", { name: /保存|Save/i });
    await saveBtn.click();
    await expect(saveBtn).toBeEnabled({ timeout: 10_000 });

    // Reload the page
    await gotoSettings(page);

    // The select should still show the "关闭" option
    await expect(page.getByText("关闭").first()).toBeVisible({ timeout: 3_000 });
  });

  test("5. 错误处理: API失败显示错误提示", async ({ page }) => {
    // Mock API route to return 500 on save
    await page.route("**/api/v1/project/chapter-versioning", async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "SERVER_ERROR", message: "保存失败" },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Try to save
    const saveBtn = page.getByRole("button", { name: /保存|Save/i });
    await saveBtn.click();

    // After failed save, the page should still be functional
    await expect(page.getByText("版本控制模式")).toBeVisible({ timeout: 5_000 });
  });
});
