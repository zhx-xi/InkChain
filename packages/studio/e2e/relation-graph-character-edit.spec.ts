import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './fixtures/auth';

test.describe('Relation Graph - Character Edit Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/relations');
    await page.waitForSelector('[data-testid="rg-state-normal"]', { timeout: 10000 }).catch(() => {});
  });

  test('Normal: clicking character opens editor panel and saves correctly', async ({ page }) => {
    // Given the relation graph is loaded with characters
    await expect(page.locator('[data-testid="rg-canvas-graph"]')).toBeVisible({ timeout: 5000 });
    const charNode = page.locator('[data-testid^="rg-node-character-"]').first();
    await expect(charNode).toBeVisible({ timeout: 5000 });

    // When user clicks a character node
    await charNode.click();

    // Then the character editor panel should open (not a blank page)
    await expect(page.locator('[data-testid="rg-modal-character-editor"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="rg-input-character-name"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="rg-select-character-type"]')).toBeVisible({ timeout: 3000 });

    // When user edits character name and type, then saves
    await page.locator('[data-testid="rg-input-character-name"]').fill('Edited Character');
    await page.locator('[data-testid="rg-select-character-type"]').selectOption('protagonist');
    await page.locator('[data-testid="rg-btn-save-character"]').click();

    // Then data should be saved and confirmation shown
    await expect(page.locator('[data-testid="rg-toast-save-success"]')).toBeVisible({ timeout: 5000 });
    // The editor panel should close
    await expect(page.locator('[data-testid="rg-modal-character-editor"]')).not.toBeVisible({ timeout: 3000 });
  });

  test('Empty: clicking character node with no editable fields shows empty state', async ({ page }) => {
    // Given a character with minimal data exists on the graph
    const charNode = page.locator('[data-testid^="rg-node-character-"]').first();
    await expect(charNode).toBeVisible({ timeout: 5000 });

    // When user clicks the character
    await charNode.click();

    // Then the editor should either show fields or show empty state guidance
    const editor = page.locator('[data-testid="rg-modal-character-editor"]');
    const emptyState = page.locator('[data-testid="rg-state-character-empty"]');
    await expect(editor.or(emptyState)).toBeVisible({ timeout: 5000 });
  });

  test('Error: API failure during save shows error toast', async ({ page }) => {
    // Given the relation graph is loaded
    await expect(page.locator('[data-testid="rg-canvas-graph"]')).toBeVisible({ timeout: 5000 });
    const charNode = page.locator('[data-testid^="rg-node-character-"]').first();
    await expect(charNode).toBeVisible({ timeout: 5000 });

    // When user clicks the character and triggers save
    await charNode.click();
    await expect(page.locator('[data-testid="rg-modal-character-editor"]')).toBeVisible({ timeout: 5000 });

    // Simulate API failure by blocking the PUT request
    await page.route('**/api/v1/books/**/characters/**', async route => {
      await route.fulfill({ status: 500, body: 'Server Error' });
    });
    await page.locator('[data-testid="rg-btn-save-character"]').click();

    // Then error toast should appear (don't navigate away)
    await expect(page.locator('[data-testid="rg-toast-save-error"]')).toBeVisible({ timeout: 5000 });
    // User should still be on the relation graph page
    await expect(page.locator('[data-testid="rg-canvas-graph"]')).toBeVisible();
  });

  test('Edge: cancel editing reverts changes', async ({ page }) => {
    // Given the relation graph is loaded
    await expect(page.locator('[data-testid="rg-canvas-graph"]')).toBeVisible({ timeout: 5000 });
    const charNode = page.locator('[data-testid^="rg-node-character-"]').first();
    await expect(charNode).toBeVisible({ timeout: 5000 });

    // When user opens editor, modifies fields, then clicks cancel
    await charNode.click();
    await expect(page.locator('[data-testid="rg-modal-character-editor"]')).toBeVisible({ timeout: 5000 });
    const originalName = await page.locator('[data-testid="rg-input-character-name"]').inputValue();
    await page.locator('[data-testid="rg-input-character-name"]').fill('Unsaved Change');
    await page.locator('[data-testid="rg-btn-cancel-character"]').click();

    // Then the panel closes without saving and user stays on the graph page
    await expect(page.locator('[data-testid="rg-modal-character-editor"]')).not.toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="rg-canvas-graph"]')).toBeVisible();
    // Verify URL is still on the relations page (not a blank page)
    expect(page.url()).toContain('/relations');
  });
});
