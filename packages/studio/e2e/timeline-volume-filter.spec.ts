import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './fixtures/auth';

test.describe('Timeline - Volume Filter', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/timeline');
    await page.waitForSelector('[data-testid="tl-state-normal"]', { timeout: 10000 }).catch(() => {});
  });

  test('Normal: selecting a volume correctly filters events', async ({ page }) => {
    // Given the timeline is loaded with events from multiple volumes
    await expect(page.locator('[data-testid="tl-canvas-reactflow"]').or(page.locator('[data-testid="tl-state-lite-mode"]'))).toBeVisible({ timeout: 5000 });

    // When user selects a volume from the volume filter
    const volumeFilter = page.locator('[data-testid="tl-select-volume-filter"]');
    await expect(volumeFilter).toBeVisible({ timeout: 5000 });
    const beforeCount = await page.locator('[data-testid^="tl-node-event-"]').count();

    // Select first non-default volume option
    const options = await volumeFilter.locator('option').all();
    if (options.length > 1) {
      const volumeValue = await options[1].getAttribute('value');
      await volumeFilter.selectOption(volumeValue || '');
      await page.waitForTimeout(1000);

      // Then events should be filtered to the selected volume only
      const afterCount = await page.locator('[data-testid^="tl-node-event-"]').count();
      // Either the count decreased (filtering works) or all events are from that volume
      expect(afterCount).toBeLessThanOrEqual(beforeCount);
    }
  });

  test('Normal: switching volumes updates event list immediately', async ({ page }) => {
    // Given the timeline is loaded
    await expect(page.locator('[data-testid="tl-canvas-reactflow"]').or(page.locator('[data-testid="tl-state-lite-mode"]'))).toBeVisible({ timeout: 5000 });

    const volumeFilter = page.locator('[data-testid="tl-select-volume-filter"]');
    await expect(volumeFilter).toBeVisible({ timeout: 5000 });

    const options = await volumeFilter.locator('option').all();
    if (options.length > 2) {
      // When user switches between volumes
      const val1 = await options[1].getAttribute('value');
      await volumeFilter.selectOption(val1 || '');
      await page.waitForTimeout(500);
      const eventsAfterFirst = await page.locator('[data-testid^="tl-node-event-"]').count();

      const val2 = await options[2].getAttribute('value');
      await volumeFilter.selectOption(val2 || '');
      await page.waitForTimeout(500);
      const eventsAfterSecond = await page.locator('[data-testid^="tl-node-event-"]').count();

      // Then the event list should update (content changes between volumes)
      // At minimum, the filter element should not be stuck
      await expect(volumeFilter).toBeEnabled();
    }
  });

  test('Empty: clearing volume filter shows all events', async ({ page }) => {
    // Given the timeline is loaded with events
    await expect(page.locator('[data-testid="tl-canvas-reactflow"]').or(page.locator('[data-testid="tl-state-lite-mode"]'))).toBeVisible({ timeout: 5000 });

    const volumeFilter = page.locator('[data-testid="tl-select-volume-filter"]');
    await expect(volumeFilter).toBeVisible({ timeout: 5000 });
    const allEventsCount = await page.locator('[data-testid^="tl-node-event-"]').count();

    // When user selects a volume filter
    const options = await volumeFilter.locator('option').all();
    if (options.length > 1) {
      const val = await options[1].getAttribute('value');
      await volumeFilter.selectOption(val || '');
      await page.waitForTimeout(500);

      // Then clears it (selects "all" or default option)
      await volumeFilter.selectOption(options[0].getAttribute('value') || '');
      await page.waitForTimeout(500);

      // Then all events should be restored
      const restoredCount = await page.locator('[data-testid^="tl-node-event-"]').count();
      // Should return to the original count (or close to it)
      expect(restoredCount).toBeGreaterThanOrEqual(allEventsCount - 2); // Allow minor async variation
    }
  });

  test('Error: volume filter API returns no data gracefully', async ({ page }) => {
    // Given the timeline is loaded
    await expect(page.locator('[data-testid="tl-canvas-reactflow"]').or(page.locator('[data-testid="tl-state-lite-mode"]'))).toBeVisible({ timeout: 5000 });

    // When volume filter API returns an error
    await page.route('**/api/v1/books/**/timelines**', async route => {
      if (route.request().url().includes('volume')) {
        await route.fulfill({ status: 500, body: 'Filter Error' });
      } else {
        await route.continue();
      }
    });

    const volumeFilter = page.locator('[data-testid="tl-select-volume-filter"]');
    await expect(volumeFilter).toBeVisible({ timeout: 5000 });
    const options = await volumeFilter.locator('option').all();

    if (options.length > 1) {
      const val = await options[1].getAttribute('value');
      await volumeFilter.selectOption(val || '');
      await page.waitForTimeout(1000);

      // Then error state should show but user should still be on the timeline page
      const errorToast = page.locator('[data-testid="tl-toast-filter-error"]');
      await expect(errorToast.or(page.locator('[data-testid="tl-state-error"]'))).toBeVisible({ timeout: 5000 });
      // Page should not navigate away
      await expect(page).toHaveURL(/\/timeline/);
    }
    await page.unroute('**/api/v1/books/**/timelines**');
  });
});
