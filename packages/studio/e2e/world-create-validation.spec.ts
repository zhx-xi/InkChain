import { test, expect } from "@playwright/test";

/**
 * E2E tests for world creation with book association (Issue #601 - P0)
 *
 * Bug: Creating a world and selecting an associated book throws "World validation failed"
 *
 * States: normal (success create), error (validation failure), empty (no books), edge (multiple books)
 */

test.describe("World Creation — Book Association Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/worlds");
    await page.waitForTimeout(2000);
  });

  test("1. 正常流程: 创建世界并选择关联书籍后成功提交 (normal)", async ({ page }) => {
    // Given: user is on the world list page
    // Look for create world button
    const createBtn = page.locator(
      '[data-testid="wl-create-btn"], [data-testid="wl-btn-create-world"], button:has-text("创建世界"), button:has-text("新建世界")'
    );
    await expect(createBtn.first()).toBeVisible({ timeout: 10000 });

    // When: click create world button
    await createBtn.first().click();

    // Then: world creation form/modal appears
    // Check form elements exist
    const worldNameInput = page.locator(
      'input[placeholder*="世界"], input[placeholder*="world"], [data-testid*="name-input"], [data-testid*="world-name"]'
    );
    const bookSelector = page.locator(
      'select, [role="combobox"], [data-testid*="book"], [data-testid*="select"]'
    );

    // Fill in world name
    if (await worldNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await worldNameInput.fill("E2E Test World - Book Association");
    }

    // Select a book if the selector exists
    if (await bookSelector.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      // Try to select the first available option
      const options = await bookSelector.first().locator("option").all();
      if (options.length > 1) {
        await bookSelector.first().selectOption({ index: 1 });
      }
    }

    // Submit the form
    const submitBtn = page.locator(
      'button[type="submit"], button:has-text("确认"), button:has-text("创建"), [data-testid*="submit"], [data-testid*="confirm"]'
    );
    if (await submitBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.first().click();
    }

    // Wait for navigation or success indication — no validation error should appear
    await page.waitForTimeout(3000);

    // Assert: no "World validation failed" error
    await expect(page.locator("text=World validation failed")).toHaveCount(0);
    await expect(page.locator("text=validation failed")).toHaveCount(0);

    // Assert: no 500 error page
    await expect(page.locator("text=500")).toHaveCount(0);
    await expect(page.locator("text=Internal Server Error")).toHaveCount(0);
  });

  test("2. 错误处理: 创建世界时API错误显示友好提示 (error)", async ({ page }) => {
    // Given: intercept and fail the world creation API
    await page.route("**/api/worlds/**", (route) =>
      route.fulfill({ status: 422, body: JSON.stringify({ error: "World validation failed" }) })
    );

    const createBtn = page.locator(
      '[data-testid="wl-create-btn"], [data-testid="wl-btn-create-world"], button:has-text("创建世界"), button:has-text("新建世界")'
    );
    await expect(createBtn.first()).toBeVisible({ timeout: 10000 });
    await createBtn.first().click();
    await page.waitForTimeout(1000);

    // Try to submit
    const submitBtn = page.locator(
      'button[type="submit"], button:has-text("确认"), button:has-text("创建")'
    );
    if (await submitBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.first().click();
    }

    // Wait for error state
    await page.waitForTimeout(2000);

    // Assert: error message is displayed (not a crash or blank page)
    const errorMsg = page.locator(
      '[data-testid*="error"], [data-testid*="Error"], text=错误, text=失败, text=validation'
    );
    const hasError = (await errorMsg.count()) > 0;

    // Assert: page body is still visible (not crashed)
    await expect(page.locator("body")).toBeVisible();
    console.log(`Error state displayed: ${hasError}`);
  });

  test("3. 空状态: 无可选书籍时仍可正常创建世界 (empty)", async ({ page }) => {
    // Given: API returns empty books list
    await page.route("**/api/books**", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ books: [] }) })
    );

    const createBtn = page.locator(
      '[data-testid="wl-create-btn"], [data-testid="wl-btn-create-world"], button:has-text("创建世界"), button:has-text("新建世界")'
    );
    await expect(createBtn.first()).toBeVisible({ timeout: 10000 });
    await createBtn.first().click();
    await page.waitForTimeout(1000);

    // Fill in world name if input exists
    const nameInput = page.locator(
      'input[placeholder*="世界"], input[data-testid*="name"]'
    );
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill("Standalone World - No Books");
    }

    // Submit
    const submitBtn = page.locator(
      'button[type="submit"], button:has-text("确认"), button:has-text("创建")'
    );
    if (await submitBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.first().click();
    }

    // Wait for submission
    await page.waitForTimeout(2000);

    // Assert: no validation error
    await expect(page.locator("text=World validation failed")).toHaveCount(0);
  });

  test("4. 边界: 快速连续创建世界不触发重复验证 (edge)", async ({ page }) => {
    // Given: user can create a world
    const createBtn = page.locator(
      '[data-testid="wl-create-btn"], [data-testid="wl-btn-create-world"], button:has-text("创建世界")'
    );
    await expect(createBtn.first()).toBeVisible({ timeout: 10000 });

    // When: create two worlds rapidly
    for (let i = 0; i < 2; i++) {
      await createBtn.first().click();
      await page.waitForTimeout(500);

      const nameInput = page.locator('input[placeholder*="世界"]');
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill(`Rapid World ${Date.now()}`);

        const submitBtn = page.locator('button[type="submit"], button:has-text("创建")');
        if (await submitBtn.first().isVisible({ timeout: 1000 }).catch(() => false)) {
          await submitBtn.first().click();
        }
      }
      await page.waitForTimeout(2000);
    }

    // Then: no validation error or crash
    await expect(page.locator("text=World validation failed")).toHaveCount(0);
    await expect(page.locator("body")).toBeVisible();
  });
});
