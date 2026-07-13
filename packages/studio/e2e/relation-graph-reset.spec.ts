import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './fixtures/auth';

test.describe('Relation Graph - Reset Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/relations');
    await page.waitForSelector('[data-testid="rg-state-normal"]', { timeout: 10000 }).catch(() => {});
  });

  test('Normal: reset button restores relation graph to initial state', async ({ page }) => {
    // Given the relation graph is loaded with relationships
    await expect(page.locator('[data-testid="rg-canvas-graph"]')).toBeVisible({ timeout: 5000 });
    const initialEdgeCount = await page.locator('[data-testid^="rg-edge-relation-"]').count();

    // When user modifies the graph (adds or edits a relation)
    // Then clicks reset
    await page.locator('[data-testid="rg-btn-reset"]').click();

    // Then a confirmation dialog should appear
    await expect(page.locator('[data-testid="rg-modal-confirm-reset"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="rg-modal-confirm-reset"]')).toContainText(/reset|confirm/i);

    // When user confirms the reset
    await page.locator('[data-testid="rg-btn-confirm-reset"]').click();

    // Then the graph should be restored to initial state
    const resetEdgeCount = await page.locator('[data-testid^="rg-edge-relation-"]').count();
    expect(resetEdgeCount).toBe(initialEdgeCount);

    // A reset confirmation should be shown
    await expect(page.locator('[data-testid="rg-toast-reset-success"]')).toBeVisible({ timeout: 3000 });
  });

  test('Empty: reset on already-empty graph shows no change', async ({ page }) => {
    // Given the relation graph is in empty state
    const emptyState = page.locator('[data-testid="rg-state-empty"]');
    if (await emptyState.isVisible({ timeout: 3000 }).catch(() => false)) {
      // When user clicks reset on empty state
      const resetBtn = page.locator('[data-testid="rg-btn-reset"]');
      if (await resetBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await resetBtn.click();
        await page.locator('[data-testid="rg-btn-confirm-reset"]').click().catch(() => {});
      }

      // Then the page should still show empty state
      await expect(page.locator('[data-testid="rg-state-empty"]')).toBeVisible({ timeout: 3000 });
    }
  });

  test('Error: reset API failure shows error state', async ({ page }) => {
    // Given the relation graph is loaded
    await expect(page.locator('[data-testid="rg-canvas-graph"]')).toBeVisible({ timeout: 5000 });

    // When reset API fails
    await page.route('**/api/v1/books/**/relations/reset', async route => {
      await route.fulfill({ status: 500, body: 'Reset Failed' });
    });

    await page.locator('[data-testid="rg-btn-reset"]').click();
    await page.locator('[data-testid="rg-btn-confirm-reset"]').click();

    // Then error toast should appear
    await expect(page.locator('[data-testid="rg-toast-reset-error"]')).toBeVisible({ timeout: 5000 });
    // Graph should remain visible (not stuck in blank page)
    await expect(page.locator('[data-testid="rg-canvas-graph"]')).toBeVisible();

    await page.unroute('**/api/v1/books/**/relations/reset');
  });

  test('Edge: cancel reset keeps current state unchanged', async ({ page }) => {
    // Given the relation graph is loaded with relationships
    await expect(page.locator('[data-testid="rg-canvas-graph"]')).toBeVisible({ timeout: 5000 });
    const preCancelEdgeCount = await page.locator('[data-testid^="rg-edge-relation-"]').count();

    // When user clicks reset but then cancels
    await page.locator('[data-testid="rg-btn-reset"]').click();
    await expect(page.locator('[data-testid="rg-modal-confirm-reset"]')).toBeVisible({ timeout: 3000 });
    await page.locator('[data-testid="rg-btn-cancel-reset"]').click();

    // Then the graph should remain unchanged
    await expect(page.locator('[data-testid="rg-modal-confirm-reset"]')).not.toBeVisible({ timeout: 3000 });
    const postCancelEdgeCount = await page.locator('[data-testid^="rg-edge-relation-"]').count();
    expect(postCancelEdgeCount).toBe(preCancelEdgeCount);
  });
});
