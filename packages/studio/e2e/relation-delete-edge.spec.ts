import { test, expect } from '@playwright/test';

test.describe('Relation - 单独删除关系', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/book/1/relations');
    await expect(page.locator('[data-testid="rg-state-normal"]')).toBeVisible({ timeout: 10000 });
  });
  test('Normal: 选中关系连线可删除', async ({ page }) => {
    await expect(page.locator('[data-testid^="rg-edge-relation-"]').first()).toBeVisible();
    await page.locator('[data-testid^="rg-edge-relation-"]').first().click();
    await page.locator('[data-testid^="rg-btn-delete-relation-"]').click();
    await expect(page.locator('[data-testid="rg-modal-relation-editor"]')).toBeVisible({ timeout: 5000 });
  });
  test('Error: 删除API失败显示错误', async ({ page }) => {
    await page.route('**/api/v1/books/*/relations/**', route => {
      if (route.request().method() === 'DELETE') route.fulfill({ status: 500 });
      else route.continue();
    });
    await page.locator('[data-testid^="rg-edge-relation-"]').first().click();
    await page.locator('[data-testid^="rg-btn-delete-relation-"]').click();
    await expect(page.locator('[data-testid="rg-state-error"]')).toBeVisible({ timeout: 5000 });
  });
  test('Empty: 无关系显示空状态', async ({ page }) => {
    await page.route('**/api/v1/books/*/relations', route => {
      route.fulfill({ status: 200, body: JSON.stringify({ relations: [] }) });
    });
    await page.goto('/book/1/relations');
    await expect(page.locator('[data-testid="rg-state-empty"]')).toBeVisible({ timeout: 5000 });
  });
  test('Edge: 删除后图谱刷新', async ({ page }) => {
    const edges = page.locator('[data-testid^="rg-edge-relation-"]');
    test.skip((await edges.count()) < 1, '需要关系');
    const eid = await edges.first().getAttribute('data-testid');
    await edges.first().click();
    await page.locator('[data-testid^="rg-btn-delete-relation-"]').click();
    await expect(page.locator(`[data-testid="${eid}"]`)).not.toBeVisible({ timeout: 5000 });
  });
});
