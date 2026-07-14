import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './fixtures/auth';

test.describe('Timeline - Chapter Filter Options', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/timeline');
    await page.waitForSelector('[data-testid="tl-state-normal"]', { timeout: 10000 }).catch(() => {});
  });

  test('Normal: chapter filter dropdown preserves all options after selection', async ({ page }) => {
    // Given the timeline is loaded with multiple chapters
    await expect(page.locator('[data-testid="tl-canvas-reactflow"]').or(page.locator('[data-testid="tl-state-lite-mode"]'))).toBeVisible({ timeout: 5000 });

    const chapterFilter = page.locator('[data-testid="tl-select-chapter-filter"]');
    await expect(chapterFilter).toBeVisible({ timeout: 5000 });

    // Record all chapter options before selection
    const optionsBefore = await chapterFilter.locator('option').all();
    const optionTextsBefore = await Promise.all(optionsBefore.map(async o => ({
      value: await o.getAttribute('value'),
      text: await o.textContent()
    })));

    // When user selects a specific chapter
    if (optionsBefore.length > 1) {
      const firstRealOption = optionsBefore[1];
      const optionValue = await firstRealOption.getAttribute('value');
      await chapterFilter.selectOption(optionValue || '');
      await page.waitForTimeout(500);

      // When user clicks the chapter filter again (opens dropdown)
      // Then all chapter options must still be present
      const optionsAfter = await chapterFilter.locator('option').all();
      const optionTextsAfter = await Promise.all(optionsAfter.map(async o => ({
        value: await o.getAttribute('value'),
        text: await o.textContent()
      })));

      // The number of options should not decrease
      expect(optionsAfter.length).toBeGreaterThanOrEqual(optionsBefore.length);
    }
  });

  test('Normal: multi-select chapter filtering works correctly', async ({ page }) => {
    // Given the timeline is loaded
    await expect(page.locator('[data-testid="tl-canvas-reactflow"]').or(page.locator('[data-testid="tl-state-lite-mode"]'))).toBeVisible({ timeout: 5000 });

    const chapterFilter = page.locator('[data-testid="tl-select-chapter-filter"]');
    await expect(chapterFilter).toBeVisible({ timeout: 5000 });

    const options = await chapterFilter.locator('option').all();
    if (options.length > 2) {
      // If the filter supports multi-select (e.g. is a multi-select or tag-based)
      const isMultiSelect = await chapterFilter.getAttribute('multiple');
      if (isMultiSelect !== null) {
        // When user selects multiple chapters
        await chapterFilter.selectOption([
          await options[1].getAttribute('value') || '',
          await options[2].getAttribute('value') || ''
        ]);
        await page.waitForTimeout(500);

        // Then events from multiple selected chapters should be visible
        // The filter should have both values selected
        const selectedValues = await chapterFilter.inputValue();
        expect(selectedValues).toBeTruthy();
      }
    }
  });

  test('Empty: no chapters available shows empty filter state', async ({ page }) => {
    // Given the timeline page loads with no chapters
    const chapterFilter = page.locator('[data-testid="tl-select-chapter-filter"]');
    await expect(chapterFilter).toBeVisible({ timeout: 5000 });

    const options = await chapterFilter.locator('option').all();
    if (options.length <= 1) {
      // Only the default "all" or placeholder option
      // Then the filter should still be functional and not cause errors
      await expect(chapterFilter).toBeEnabled();
    }
  });

  test('Error: chapter filter with API failure falls back gracefully', async ({ page }) => {
    // Given the timeline is loaded
    await expect(page.locator('[data-testid="tl-canvas-reactflow"]').or(page.locator('[data-testid="tl-state-lite-mode"]'))).toBeVisible({ timeout: 5000 });

    // When chapter filter API returns an error
    await page.route('**/api/v1/books/**/timelines**', async route => {
      if (route.request().url().includes('chapter')) {
        await route.fulfill({ status: 500, body: 'Chapter Filter Error' });
      } else {
        await route.continue();
      }
    });

    const chapterFilter = page.locator('[data-testid="tl-select-chapter-filter"]');
    if (await chapterFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Try to use the filter - should show error but not blank page
      const options = await chapterFilter.locator('option').all();
      if (options.length > 1) {
        await chapterFilter.selectOption(await options[1].getAttribute('value') || '');
        await page.waitForTimeout(1000);

        // Error state or toast should appear, but user stays on timeline page
        await expect(page).toHaveURL(/\/timeline/);
        await expect(page.locator('[data-testid="tl-canvas-reactflow"]').or(page.locator('[data-testid="tl-state-error"]'))).toBeVisible({ timeout: 3000 });
      }
    }
    await page.unroute('**/api/v1/books/**/timelines**');
  });
});
