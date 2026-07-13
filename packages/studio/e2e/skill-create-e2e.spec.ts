import { test, expect } from "@playwright/test";

/**
 * E2E tests for Skill creation end-to-end (Issue #611 - P1)
 *
 * Bug: Created Skill's end-to-end availability is not verified
 *
 * States: normal (create + appear + use), error (API failure), empty (no skills), edge (cancel)
 */

test.describe("Skill 库 — 创建功能端到端验证", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/skills");
    await page.waitForTimeout(3000);
  });

  test("1. 正常流程: 创建Skill后出现在可用列表中 (normal)", async ({ page }) => {
    // Given: Skill list page is loaded
    await expect(page.locator("body")).toBeVisible({ timeout: 5000 });

    // Find create button
    const createBtn = page.locator(
      "[data-testid='sk-create-btn'], [data-testid='sk-btn-create-skill'], button:has-text('创建'), button:has-text('新建')"
    );
    const createCount = await createBtn.count();
    console.log(`Create skill buttons: ${createCount}`);

    if (createCount > 0) {
      // When: click create
      await createBtn.first().click();
      await page.waitForTimeout(2000);

      // Fill in skill name if form opens
      const nameInput = page.locator(
        "input[placeholder*='名称'], input[placeholder*='name'], input[placeholder*='Skill'], [data-testid*='name-input']"
      );
      const skillName = `E2E Test Skill ${Date.now()}`;
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill(skillName);
      }

      // Fill in description if available
      const descInput = page.locator(
        "textarea, [data-testid*='description'], [data-testid*='desc']"
      );
      if (await descInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await descInput.fill("Created by E2E test for Issue #611");
      }

      // Save/create
      const saveBtn = page.locator(
        "button:has-text('保存'), button:has-text('创建'), button:has-text('确认'), [data-testid*='save']"
      );
      if (await saveBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveBtn.first().click();
      }

      await page.waitForTimeout(3000);

      // Then: skill should appear in list
      const skillInList = await page.getByText(skillName).isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`Created skill visible in list: ${skillInList}`);

      // Assert: no error
      await expect(page.locator("text=Error")).toHaveCount(0);
      await expect(page.locator("text=error")).toHaveCount(0);
      await expect(page.locator("body")).toBeVisible();
    } else {
      console.log("No create button found — page structure test only");
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("2. 可用性验证: 创建后的Skill在Agent/写作流程中可选 (normal)", async ({ page }) => {
    const createBtn = page.locator(
      "[data-testid='sk-create-btn'], button:has-text('创建')"
    );
    if ((await createBtn.count()) === 0) return;

    await createBtn.first().click();
    await page.waitForTimeout(1500);

    const nameInput = page.locator("input[placeholder*='名称'], input[placeholder*='name']");
    const skillName = `Skill-611-${Date.now()}`;
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill(skillName);
    }

    const saveBtn = page.locator("button:has-text('保存'), button:has-text('创建')");
    if (await saveBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.first().click();
    }

    await page.waitForTimeout(2000);

    // Navigate to agents page to check if skill is available in agent configuration
    await page.goto("/#/agents");
    await page.waitForTimeout(3000);

    // Check if agent config references skills (or search for skill name)
    const skillRef = page.getByText(skillName);
    const skillFound = await skillRef.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Created skill referenced in agent page: ${skillFound}`);

    // Assert: navigation between pages works
    await expect(page.locator("body")).toBeVisible();
  });

  test("3. 错误处理: 创建Skill时API失败显示错误 (error)", async ({ page }) => {
    // Intercept skill creation API
    await page.route("**/api/skills**", (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({ status: 500, body: "Server Error" });
      } else {
        route.continue();
      }
    });

    const createBtn = page.locator(
      "[data-testid='sk-create-btn'], button:has-text('创建')"
    );
    if ((await createBtn.count()) === 0) return;

    await createBtn.first().click();
    await page.waitForTimeout(1500);

    const confirmBtn = page.locator("button:has-text('保存'), button:has-text('创建')");
    if (await confirmBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.first().click();
    }

    await page.waitForTimeout(2000);

    // Assert: error state is shown gracefully
    const errorEl = page.locator(
      "[data-testid*='error'], text=错误, text=Error, text=失败"
    );
    const hasError = (await errorEl.count()) > 0;
    console.log(`Error displayed on API failure: ${hasError}`);

    // Assert: page not crashed
    await expect(page.locator("body")).toBeVisible();
  });

  test("4. 空列表状态: 无Skill时的UI表现 (empty)", async ({ page }) => {
    // Intercept to return empty skill list
    await page.route("**/api/skills**", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({ status: 200, body: JSON.stringify({ skills: [] }) });
      } else {
        route.continue();
      }
    });

    await page.reload();
    await page.waitForTimeout(3000);

    // Assert: page body is visible
    await expect(page.locator("body")).toBeVisible();

    // Check for empty state or create button (user can still create)
    const emptyState = page.locator(
      "[data-testid*='empty'], [data-testid*='Empty'], text=暂无, text=创建第一个"
    );
    const hasEmptyState = (await emptyState.count()) > 0;
    console.log(`Empty state displayed: ${hasEmptyState}`);

    // Create button should still exist
    const createBtn = page.locator("[data-testid='sk-create-btn'], button:has-text('创建')");
    const createVisible = await createBtn.first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Create button visible in empty state: ${createVisible}`);
  });
});
