import { test, expect } from '@playwright/test';

test.describe('Foreshadowing - 单独删除伏笔', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/book/1/foreshadowing');
    await expect(page.locator('[data-testid="fs-state-normal"]')).toBeVisible({ timeout: 10000 });
  });

  test('Normal: 单条伏笔可删除并刷新列表', async ({ page }) => {
    const firstItem = page.locator('[data-testid^="fs-item-"]').first();
    await expect(firstItem).toBeVisible();
    const itemId = await firstItem.getAttribute('data-testid');
    await page.locator(`[data-testid="fs-btn-delete-${itemId}"]`).click();
    await expect(page.locator('[data-testid="fs-modal-confirm-delete"]')).toBeVisible();
    await page.locator('[data-testid="fs-modal-confirm-delete"] [data-testid="confirm-btn"]').click();
    await expect(page.locator(`[data-testid="${itemId}"]`)).not.toBeVisible({ timeout: 5000 });
  });

  test('Error: API 删除失败显示错误提示', async ({ page }) => {
    const firstItem = page.locator('[data-testid^="fs-item-"]').first();
    await expect(firstItem).toBeVisible();
    const itemId = await firstItem.getAttribute('data-testid');
    await page.route('**/api/foreshadowing/**', route => {
      if (route.request().method() === 'DELETE') route.fulfill({ status: 500 });
      else route.continue();
    });
    await page.locator(`[data-testid="fs-btn-delete-${itemId}"]`).click();
    await page.locator('[data-testid="fs-modal-confirm-delete"] [data-testid="confirm-btn"]').click();
    await expect(page.locator('[data-testid="fs-state-error"]')).toBeVisible({ timeout: 5000 });
  });

  test('Empty: 全部删除后显示空状态', async ({ page }) => {
    await page.route('**/api/foreshadowing/?', route => {
      route.fulfill({ status: 200, body: JSON.stringify({ foreshadowings: [], total: 0 }) });
    });
    await page.locator('[data-testid="fs-btn-refresh"]').click();
    await expect(page.locator('[data-testid="fs-state-empty"]')).toBeVisible({ timeout: 5000 });
  });

  test('Edge: 连续快速删除无崩溃', async ({ page }) => {
    const items = page.locator('[data-testid^="fs-item-"]');
    const count = await items.count();
    test.skip(count < 2, '至少 2 条伏笔');
    for (let i = 0; i < Math.min(count, 3); i++) {
      const id = await items.nth(0).getAttribute('data-testid');
      await page.locator(`[data-testid="fs-btn-delete-${id}"]`).click();
      await page.locator('[data-testid="fs-modal-confirm-delete"] [data-testid="confirm-btn"]').click();
      await page.waitForTimeout(300);
    }
    await expect(page.locator('[data-testid="fs-state-normal"]')).toBeVisible({ timeout: 5000 });
  });
});
