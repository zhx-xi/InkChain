import { test, expect } from '@playwright/test';

async function navigateSkills(page: import('@playwright/test').Page) {
  await page.goto('/#/skills');
  await expect(page.locator('[data-testid="sk-btn-create-skill"]')).toBeVisible({ timeout: 15_000 });
}

test('Normal: 完整创建Skill流程', async ({ page }) => {
  await navigateSkills(page);
  await page.locator('[data-testid="sk-btn-create-skill"]').click();
  await expect(page.locator('[data-testid="sk-modal-skill-editor"]')).toBeVisible();
  await page.locator('[data-testid="sk-input-skill-name"]').fill('Test Skill E2E');
  await page.locator('[data-testid="sk-modal-skill-editor"] [data-testid="save-btn"]').click();
  await expect(page.locator('[data-testid="sk-modal-skill-editor"]')).not.toBeVisible({ timeout: 5000 });
});

test('Error: 必填项为空显示校验提示', async ({ page }) => {
  await navigateSkills(page);
  await page.locator('[data-testid="sk-btn-create-skill"]').click();
  await expect(page.locator('[data-testid="sk-modal-skill-editor"]')).toBeVisible({ timeout: 10_000 });
  await page.locator('[data-testid="sk-modal-skill-editor"] [data-testid="save-btn"]').click();
  await expect(page.locator('[data-testid="sk-input-skill-name"]')).toBeVisible();
});

test('Empty: 创建后列表更新', async ({ page }) => {
  await navigateSkills(page);
  const initial = await page.locator('[data-testid^="sk-card-"]').count();
  await page.locator('[data-testid="sk-btn-create-skill"]').click();
  await expect(page.locator('[data-testid="sk-modal-skill-editor"]')).toBeVisible({ timeout: 10_000 });
  await page.locator('[data-testid="sk-input-skill-name"]').fill('New E2E');
  await page.locator('[data-testid="sk-modal-skill-editor"] [data-testid="save-btn"]').click();
  await page.waitForTimeout(1000);
  const current = await page.locator('[data-testid^="sk-card-"]').count();
  expect(current).toBeGreaterThan(initial);
});

test('Edge: 取消关闭弹窗不保存', async ({ page }) => {
  await navigateSkills(page);
  await page.locator('[data-testid="sk-btn-create-skill"]').click();
  await expect(page.locator('[data-testid="sk-modal-skill-editor"]')).toBeVisible({ timeout: 10_000 });
  await page.locator('[data-testid="sk-modal-skill-editor"] [data-testid="cancel-btn"]').click();
  await expect(page.locator('[data-testid="sk-modal-skill-editor"]')).not.toBeVisible({ timeout: 5000 });
});
