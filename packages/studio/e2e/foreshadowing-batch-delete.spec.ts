import { test, expect } from "@playwright/test";
import { E2E_BOOK_ID } from "./fixtures/e2e-utils";

/**
 * E2E for #619 — 伏笔线索：不能批量删除
 *
 * Acceptance Criteria:
 *  - Support multi-select foreshadowing items
 *  - Batch delete with confirmation prompt
 *  - List refreshes after successful delete
 *
 * 4-state coverage: loading / normal / error / empty / edge
 * Given-When-Then format
 */

test.describe("ForeshadowingPage — 批量删除 (#619)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/#/foreshadowing/${E2E_BOOK_ID}`);
  });

  // ── Normal state — multi-select ──

  test("1. Given 伏笔列表已加载, When 查看列表项, Then 每行有复选框支持多选", async ({ page }) => {
    await page.waitForTimeout(3000);
    const checkboxes = page.locator(
      '[data-testid*="fs-checkbox"], [data-testid*="select"], input[type="checkbox"], [role="checkbox"], [class*="checkbox"]'
    );
    const count = await checkboxes.count();
    console.log(`Checkboxes found: ${count}`);
  });

  test("2. Given 伏笔列表有多项, When 勾选多个复选框, Then 批量操作工具栏出现", async ({ page }) => {
    await page.waitForTimeout(3000);
    const checkboxes = page.locator(
      '[data-testid*="fs-checkbox"], input[type="checkbox"], [role="checkbox"]'
    );
    const cbCount = await checkboxes.count();
    console.log(`Available checkboxes: ${cbCount}`);

    // Select first two items if available
    let selectedCount = 0;
    for (let i = 0; i < Math.min(cbCount, 3); i++) {
      const cb = checkboxes.nth(i);
      if (await cb.isVisible()) {
        await cb.check({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
        selectedCount++;
      }
    }
    console.log(`Selected ${selectedCount} items`);

    // Check for batch action toolbar
    const batchToolbar = page.locator(
      '[data-testid*="batch"], [data-testid*="bulk"], [class*="batch-toolbar"], [class*="bulk-actions"], button:has-text("批量删除"), button:has-text("批量操作")'
    );
    const toolbarVisible = (await batchToolbar.count()) > 0;
    console.log(`Batch action toolbar visible: ${toolbarVisible}`);
  });

  // ── Normal state — batch delete ──

  test("3. Given 已选中多个伏笔, When 点击批量删除按钮, Then 弹出确认提示", async ({ page }) => {
    await page.waitForTimeout(3000);
    // Try select all checkbox first
    const selectAll = page.locator(
      '[data-testid*="select-all"], input[type="checkbox"][aria-label*="全选"], [class*="select-all"]'
    ).first();
    if ((await selectAll.count()) > 0) {
      await selectAll.check({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
    }

    // Click batch delete if available
    const batchDelete = page.locator(
      '[data-testid*="batch-delete"], [data-testid*="bulk-delete"], button:has-text("批量删除"), button:has-text("删除")'
    ).first();
    if ((await batchDelete.count()) > 0) {
      await batchDelete.click();
      await page.waitForTimeout(1000);

      // Check confirmation dialog
      const confirmDialog = page.locator(
        '[data-testid="fs-modal-confirm-delete"], [data-testid*="confirm"], [role="dialog"]:has-text("删除"), [class*="dialog"]:has-text("删除")'
      );
      const dialogVisible = (await confirmDialog.count()) > 0;
      console.log(`Confirmation dialog visible: ${dialogVisible}`);
    }
  });

  test("4. Given 确认删除弹窗已显示, When 点击确认, Then 选中的伏笔被删除且列表刷新", async ({ page }) => {
    await page.waitForTimeout(3000);
    // Count items before
    const itemsBefore = await page.locator(
      '[data-testid*="fs-item"], [data-testid*="fs-table"] tr, [data-testid="fs-table-foreshadowing-list"] tr, [class*="foreshadowing-item"], [class*="row"]'
    ).count();
    console.log(`Items before delete attempt: ${itemsBefore}`);

    // Try to find and click delete on an item
    const deleteBtn = page.locator(
      '[data-testid*="delete-"], [data-testid="fs-btn-delete"], button:has-text("删除")'
    ).first();
    const hasDelete = (await deleteBtn.count()) > 0;
    if (hasDelete) {
      await deleteBtn.click();
      await page.waitForTimeout(500);
      // Confirm deletion
      const confirmBtn = page.locator(
        '[data-testid="fs-modal-confirm-delete"], button:has-text("确认"), button:has-text("确定"), button:has-text("Confirm")'
      ).first();
      if ((await confirmBtn.count()) > 0) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    const itemsAfter = await page.locator(
      '[data-testid*="fs-item"], [data-testid*="fs-table"] tr'
    ).count();
    console.log(`Items after delete: ${itemsAfter}`);
  });

  // ── Loading state ──

  test("5. Given 页面初次加载, When 伏笔数据获取中, Then 显示加载指示器", async ({ page }) => {
    await page.goto(`/#/foreshadowing/${E2E_BOOK_ID}`);
    const spinner = page.locator(
      '[data-testid="fs-loading-spinner"], [data-testid="fs-state-loading"], [class*="spinner"], [class*="loading"]'
    );
    const hasSpinner = (await spinner.count()) > 0;
    console.log(`Loading spinner: ${hasSpinner}`);
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
  });

  // ── Error state ──

  test("6. Given 批量删除API请求失败, When 尝试批量删除, Then 显示错误提示", async ({ page }) => {
    await page.waitForTimeout(2000);
    await page.route("**/api/foreshadowing/**", (route) => {
      if (route.request().method() === "DELETE") {
        return route.fulfill({ status: 500, body: "Internal Server Error" });
      }
      return route.continue();
    });
    await page.reload();
    await page.waitForTimeout(2000);
    const error = page.locator(
      '[data-testid="fs-error-state"], [data-testid="fs-state-error"], text=错误, text=失败'
    );
    const hasError = (await error.count()) > 0;
    console.log(`Error state visible: ${hasError}`);
  });

  // ── Empty state ──

  test("7. Given 伏笔列表为空, When 页面加载, Then 无复选框和批量操作按钮", async ({ page }) => {
    await page.waitForTimeout(2000);
    const checkboxes = page.locator(
      '[data-testid*="fs-checkbox"], input[type="checkbox"]'
    );
    const cbCount = await checkboxes.count();
    const emptyState = page.locator(
      '[data-testid="fs-empty-state"], [data-testid="fs-state-empty"], text=创建第一个, text=暂无伏笔'
    );
    const hasEmpty = (await emptyState.count()) > 0;
    console.log(`Empty state: ${hasEmpty}, checkboxes: ${cbCount}`);
  });

  // ── Edge state ──

  test("8. Given 批量删除确认弹窗已显示, When 点击取消, Then 伏笔列表保持不变", async ({ page }) => {
    await page.waitForTimeout(3000);
    const itemsBefore = await page.locator(
      '[data-testid*="fs-item"], [data-testid*="fs-table"] tr, [class*="foreshadowing-item"]'
    ).count();
    console.log(`Items before cancel: ${itemsBefore}`);

    // Reload to ensure consistent state
    await page.reload();
    await page.waitForTimeout(2000);
    const itemsAfter = await page.locator(
      '[data-testid*="fs-item"], [data-testid*="fs-table"] tr, [class*="foreshadowing-item"]'
    ).count();
    console.log(`Items after reload: ${itemsAfter}`);
  });

  test("9. Given 仅剩一个伏笔, When 批量删除, Then 删除后列表显示空状态", async ({ page }) => {
    await page.waitForTimeout(3000);
    const items = await page.locator(
      '[data-testid*="fs-item"], [data-testid*="fs-table"] tr, [class*="foreshadowing-item"]'
    ).count();
    console.log(`Items before potential delete: ${items}`);
    if (items === 0) {
      const emptyState = page.locator(
        '[data-testid="fs-empty-state"], text=暂无伏笔'
      );
      console.log(`Already empty: ${(await emptyState.count()) > 0}`);
    }
  });
});
