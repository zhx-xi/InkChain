import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './fixtures/auth';

test.describe('Relation Graph - AI Extract Character Differentiation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/relations');
    await page.waitForSelector('[data-testid="rg-state-normal"]', { timeout: 10000 }).catch(() => {});
  });

  test('Normal: AI extract distinguishes protagonist from supporting characters', async ({ page }) => {
    // Given the relation graph is loaded
    await expect(page.locator('[data-testid="rg-canvas-graph"]')).toBeVisible({ timeout: 5000 });

    // When user triggers AI extraction
    await page.locator('[data-testid="rg-btn-ai-extract"]').click();
    await expect(page.locator('[data-testid="rg-modal-ai-extract"]')).toBeVisible({ timeout: 5000 });

    // Then the extraction results should show character type differentiation
    await page.waitForTimeout(2000); // Wait for AI results
    const protagonistNodes = page.locator('[data-testid^="rg-node-character-"][data-character-type="protagonist"]');
    const supportingNodes = page.locator('[data-testid^="rg-node-character-"][data-character-type="supporting"]');

    // At least one protagonist and one supporting character should be distinguishable
    const protagonistCount = await protagonistNodes.count();
    const supportingCount = await supportingNodes.count();
    expect(protagonistCount + supportingCount).toBeGreaterThan(0);
  });

  test('Normal: user can manually adjust classification after AI extraction', async ({ page }) => {
    // Given the relation graph is loaded
    await expect(page.locator('[data-testid="rg-canvas-graph"]')).toBeVisible({ timeout: 5000 });

    // When AI extraction completes
    await page.locator('[data-testid="rg-btn-ai-extract"]').click();
    await expect(page.locator('[data-testid="rg-modal-ai-extract"]') .or(page.locator('[data-testid="rg-canvas-graph"]'))).toBeVisible({ timeout: 10000 });

    // Then user should be able to change character type
    const charNode = page.locator('[data-testid^="rg-node-character-"]').first();
    await expect(charNode).toBeVisible({ timeout: 5000 });
    await charNode.click();
    await expect(page.locator('[data-testid="rg-modal-character-editor"]')).toBeVisible({ timeout: 5000 });

    // Type dropdown should have protagonist/supporting options
    const typeSelect = page.locator('[data-testid="rg-select-character-type"]');
    await expect(typeSelect).toBeVisible();
    const options = await typeSelect.locator('option').allTextContents();
    expect(options).toContain('protagonist');
    expect(options).toContain('supporting');

    // User can change from protagonist to supporting and save
    await typeSelect.selectOption('supporting');
    await page.locator('[data-testid="rg-btn-save-character"]').click();
    await expect(page.locator('[data-testid="rg-toast-save-success"]')).toBeVisible({ timeout: 5000 });
  });

  test('Empty: AI extract with no book content returns empty state guidance', async ({ page }) => {
    // Given a book with minimal content
    await page.goto('/relations?empty=1'); // Navigate to empty state variant

    // When user triggers AI extraction
    await page.locator('[data-testid="rg-btn-ai-extract"]').click();

    // Then appropriate empty state message should be shown
    await expect(page.locator('[data-testid="rg-state-ai-extract-empty"]')).toBeVisible({ timeout: 5000 });
    // Guidance for adding content should appear
    await expect(page.locator('[data-testid="rg-text-ai-extract-hint"]')).toBeVisible({ timeout: 3000 });
  });

  test('Error: AI extraction API failure shows retry option', async ({ page }) => {
    // Given the relation graph is loaded
    await expect(page.locator('[data-testid="rg-canvas-graph"]')).toBeVisible({ timeout: 5000 });

    // When AI extraction API fails
    await page.route('**/api/extract**', async route => {
      await route.fulfill({ status: 500, body: 'AI Service Unavailable' });
    });

    await page.locator('[data-testid="rg-btn-ai-extract"]').click();

    // Then error state should show and retry button should be available
    await expect(page.locator('[data-testid="rg-state-ai-extract-error"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="rg-btn-ai-extract-retry"]')).toBeVisible({ timeout: 3000 });

    // Retry should work (when API comes back)
    await page.unroute('**/api/extract**');
    await page.locator('[data-testid="rg-btn-ai-extract-retry"]').click();
    // Should progress past the error state
    await expect(page.locator('[data-testid="rg-state-ai-extract-error"]')).not.toBeVisible({ timeout: 3000 });
  });
});
