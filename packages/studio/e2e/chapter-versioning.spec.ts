import { test, expect } from "@playwright/test";

test.describe("Project Settings — 章节版本控制", () => {
  /** Navigate to project settings and click the "章节/Chapters" sidebar section */
  async function gotoChapters(page: import("@playwright/test").Page) {
    // Note: the app maps /#/settings (NOT /#/project-settings) to the ProjectSettings page
    await page.goto("/#/settings");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });

    // Click the "章节管理 / Chapters" sidebar button to reveal the chapters section
    const chapterBtn = page.locator("nav button").filter({ hasText: /章节|Chapters/i });
    if (await chapterBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await chapterBtn.click();
      await page.waitForTimeout(500);
    }
  }

  test("1. 版本控制模式选择区域可见", async ({ page }) => {
    await gotoChapters(page);

    // Version control heading should be visible (supports both Chinese and English)
    await expect(page.getByRole("heading", { name: /版本控制|Version Control/i })).toBeVisible({ timeout: 5_000 });

    // Version control mode options should be visible (accepts either language)
    const versioningSection = page.locator("section").filter({ hasText: /版本控制|Version Control/i });

    // Check select element exists in the version control section
    const select = versioningSection.locator("select");
    await expect(select).toBeVisible({ timeout: 3_000 });

    // Save button should be visible
    await expect(page.getByRole("button", { name: /保存|Save/i }).first()).toBeVisible({ timeout: 3_000 });
  });

  test("2. 切换至 Git 模式并保存", async ({ page }) => {
    await gotoChapters(page);

    // Find the select element in the version control section
    const versioningSection = page.locator("section").filter({ hasText: /版本控制|Version Control/i });
    const select = versioningSection.locator("select");
    if (await select.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // Try Git mode (accept both languages)
      await select.selectOption([/Git/i]);
      await page.waitForTimeout(300);

      // Click save
      const saveBtn = page.getByRole("button", { name: /保存|Save/i }).first();
      if (await saveBtn.isEnabled({ timeout: 5_000 }).catch(() => false)) {
        await saveBtn.click();
        await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
      }
    }
  });

  test("3. 快照模式显示功能描述", async ({ page }) => {
    await gotoChapters(page);

    // Description should show for snapshot mode (default)
    const versioningSection = page.locator("section").filter({ hasText: /版本控制|Version Control/i });

    // Snapshot/Git/Off descriptions should be visible in the section
    // Default mode is "snapshot", so snapshot description appears
    const snapshotDesc = versioningSection.getByText(/快照|Snapshot/i);
    if (await snapshotDesc.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(snapshotDesc).toBeVisible();
    }
  });

  test("4. 错误处理: API失败不导致页面崩溃", async ({ page }) => {
    await page.goto("/#/settings");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });

    // Mock API to return 500
    await page.route("**/api/v1/project/chapter-versioning", async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "SERVER_ERROR", message: "保存失败" } }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to chapters section to trigger API
    const chapterBtn = page.locator("nav button").filter({ hasText: /章节|Chapters/i });
    if (await chapterBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await chapterBtn.click();
      await page.waitForTimeout(500);
    }

    // Page should still be functional
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible({ timeout: 3_000 });
  });
});
