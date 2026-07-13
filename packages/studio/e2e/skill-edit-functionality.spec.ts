import { test, expect } from '@playwright/test';

test.describe('Skill - 编辑功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/skills');
    await expect(page.locator('[data-testid="sk-state-normal"]')).toBeVisible({ timeout: 10000 });
  });
  test('Normal: 编辑按钮打开编辑器并保存', async ({ page }) => {
    await expect(page.locator('[data-testid^="sk-btn-edit-skill-"]').first()).toBeVisible();
    await page.locator('[data-testid^="sk-btn-edit-skill-"]').first().click();
    await expect(page.locator('[data-testid="sk-modal-skill-editor"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="sk-modal-skill-editor"] [data-testid="save-btn"]').click();
    await expect(page.locator('[data-testid="sk-modal-skill-editor"]')).not.toBeVisible({ timeout: 5000 });
  });
  test('Error: API失败显示错误', async ({ page }) => {
    await page.route('**/api/skills/*', route => {
      if (route.request().method() === 'PUT') route.fulfill({ status: 500 });
      else route.continue();
    });
    await page.locator('[data-testid^="sk-btn-edit-skill-"]').first().click();
    await page.locator('[data-testid="sk-modal-skill-editor"] [data-testid="save-btn"]').click();
    await expect(page.locator('[data-testid="sk-state-error"]')).toBeVisible({ timeout: 5000 });
  });
  test('Empty: 无自定义Skill无编辑按钮', async ({ page }) => {
    await page.route('**/api/skills/', route => {
      route.fulfill({ status: 200, body: JSON.stringify({ skills: [] }) });
    });
    await page.goto('/skills');
    await expect(page.locator('[data-testid^="sk-btn-edit-skill-"]')).toHaveCount(0);
  });
  test('Edge: 保存后列表刷新', async ({ page }) => {
    await page.locator('[data-testid^="sk-btn-edit-skill-"]').first().click();
    await page.locator('[data-testid="sk-modal-skill-editor"] [data-testid="save-btn"]').click();
    await expect(page.locator('[data-testid="sk-modal-skill-editor"]')).not.toBeVisible({ timeout: 5000 });
  });
});
