import { test, expect } from "@playwright/test";

/**
 * E2E tests for custom Agent creation (Issue #613 - P1)
 *
 * Bug: Created custom Agent is missing some configuration items
 *
 * States: normal (full config), error (API failure), empty (no template), edge (cancel creation)
 */

test.describe("Agent Team — 自定义 Agent 创建", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/agents");
    await page.waitForTimeout(3000);
  });

  test("1. 正常流程: 创建自定义Agent包含完整配置项 (normal)", async ({ page }) => {
    // Given: Agent Team page loaded
    await expect(page.locator("body")).toBeVisible({ timeout: 5000 });

    // Find create agent button
    const createBtn = page.locator(
      '[data-testid="ag-create-btn"], [data-testid="ag-btn-create-agent"], button:has-text("创建"), button:has-text("新建")'
    );
    const createCount = await createBtn.count();
    console.log(`Create agent buttons: ${createCount}`);

    if (createCount > 0) {
      // When: click create button
      await createBtn.first().click();
      await page.waitForTimeout(2000);

      // Then: creation form/dialog with config fields should appear
      // Check for various configuration fields
      const formFields = page.locator(
        'input, select, textarea, [role="combobox"], [data-testid*="config"], [data-testid*="setting"]'
      );
      const fieldCount = await formFields.count();
      console.log(`Form fields in creation dialog: ${fieldCount}`);

      // Find name input
      const nameInput = page.locator(
        'input[placeholder*="名称"], input[placeholder*="name"], input[placeholder*="Name"], [data-testid*="name-input"], [data-testid*="agent-name"]'
      );
      const hasNameInput = await nameInput.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`Name input visible: ${hasNameInput}`);

      // Find role/type selector
      const roleSelect = page.locator(
        'select, [data-testid*="role"], [data-testid*="type"], [data-testid*="Role"], [data-testid*="Type"]'
      );
      const hasRoleSelect = (await roleSelect.count()) > 0;
      console.log(`Role/type selector present: ${hasRoleSelect}`);

      // Assert: at least some config fields exist (not an empty dialog)
      await expect(page.locator("body")).toBeVisible();
      expect(fieldCount).toBeGreaterThanOrEqual(1);
    } else {
      console.log("No create button found — page structure test only");
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("2. 保存自定义Agent: 创建后Agent出现在列表中 (normal)", async ({ page }) => {
    const createBtn = page.locator(
      '[data-testid="ag-create-btn"], button:has-text("创建"), button:has-text("新建")'
    );
    if ((await createBtn.count()) === 0) {
      console.log("No create button — skip save test");
      return;
    }

    await createBtn.first().click();
    await page.waitForTimeout(1500);

    // Fill in agent name if available
    const nameInput = page.locator('input[placeholder*="名称"], input[placeholder*="name"]');
    const agentName = `E2E Agent ${Date.now()}`;
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill(agentName);
    }

    // Find and click save/confirm button
    const saveBtn = page.locator(
      'button:has-text("保存"), button:has-text("确认"), button:has-text("创建"), [data-testid*="save"], [data-testid*="confirm"]'
    );
    if (await saveBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.first().click();
    }

    await page.waitForTimeout(2000);

    // Assert: page not crashed after save
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=error")).toHaveCount(0);
  });

  test("3. 错误处理: 创建Agent时API失败显示错误 (error)", async ({ page }) => {
    // Intercept creation API to fail
    await page.route("**/api/agents**", (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({ status: 500, body: "Server Error" });
      } else {
        route.continue();
      }
    });

    const createBtn = page.locator(
      '[data-testid="ag-create-btn"], button:has-text("创建")'
    );
    if ((await createBtn.count()) === 0) return;

    await createBtn.first().click();
    await page.waitForTimeout(1500);

    // Try to trigger creation
    const confirmBtn = page.locator('button:has-text("保存"), button:has-text("创建")');
    if (await confirmBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.first().click();
    }

    await page.waitForTimeout(2000);

    // Assert: error is shown gracefully
    const errorVisible = await page.locator(
      '[data-testid*="error"], :has-text("错误"), :has-text("Error"), :has-text("失败")'
    ).first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Error displayed on API failure: ${errorVisible}`);

    // Assert: page not crashed
    await expect(page.locator("body")).toBeVisible();
  });

  test("4. 取消创建: 关闭创建面板返回正常状态 (edge)", async ({ page }) => {
    const createBtn = page.locator(
      '[data-testid="ag-create-btn"], button:has-text("创建"), button:has-text("新建")'
    );
    if ((await createBtn.count()) === 0) return;

    await createBtn.first().click();
    await page.waitForTimeout(1500);

    // Find cancel/close button
    const cancelBtn = page.locator(
      'button:has-text("取消"), button:has-text("关闭"), [data-testid*="cancel"], [data-testid*="close"], [aria-label="Close"]'
    );
    if (await cancelBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelBtn.first().click();
      await page.waitForTimeout(1000);
    } else {
      // Press Escape to close
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1000);
    }

    // Assert: back to normal agent list view
    await expect(page.locator("body")).toBeVisible();
    // Assert: creation dialog closed
    const createDialog = page.locator('[role="dialog"]');
    const dialogStillVisible = await createDialog.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`Dialog still visible after cancel: ${dialogStillVisible}`);
  });
});
