import { test, expect } from '@playwright/test';

test.describe('Audit - AI审计验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/book/1/audit');
    await expect(page.locator('[data-testid="au-state-normal"]')).toBeVisible({ timeout: 10000 });
  });
  test('Normal: AI审计返回分析内容', async ({ page }) => {
    await expect(page.locator('[data-testid^="au-btn-ai-audit-"]').first()).toBeVisible();
    await page.locator('[data-testid^="au-btn-ai-audit-"]').first().click();
    await expect(page.locator('[data-testid="au-modal-audit-detail"]')).toBeVisible({ timeout: 8000 });
  });
  test('Error: AI不可用时降级提示', async ({ page }) => {
    await page.route('**/api/books/*/chapters/*/audit*', route => {
      if (route.request().method() === 'POST') route.fulfill({ status: 503 });
      else route.continue();
    });
    await page.locator('[data-testid^="au-btn-ai-audit-"]').first().click();
    await expect(page.locator('[data-testid="au-state-error"]')).toBeVisible({ timeout: 5000 });
  });
  test('Empty: 无可审计章节显示提示', async ({ page }) => {
    await page.goto('/book/1/audit');
    await expect(page.locator('[data-testid="au-state-empty"]')).toBeVisible({ timeout: 10000 });
  });
  test('Edge: 批量审计无卡死', async ({ page }) => {
    await page.locator('[data-testid="au-btn-batch-audit"]').click();
    await expect(page.locator('[data-testid="au-modal-batch-confirm"]')).toBeVisible({ timeout: 5000 });
  });
});
