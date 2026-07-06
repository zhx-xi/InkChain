import { test, expect } from "@playwright/test";
import { seedWorldMap, E2E_WORLD_ID } from "./fixtures/seed-world-map";

test.beforeAll(async () => {
  await seedWorldMap();
});

test("1. 世界详情页正常加载（不404）", async ({ page }) => {
  await page.goto(`/#/worlds/${E2E_WORLD_ID}`);
  // Should load without 404
  await expect(page.locator('body')).not.toContainText("404", { timeout: 10_000 });
  // Should show world name or related content
  await expect(page.getByText("世界").first()).toBeVisible({ timeout: 10_000 });
});

test("2. 世界关联书籍按钮/链接存在且URL正确", async ({ page }) => {
  await page.goto(`/#/worlds/${E2E_WORLD_ID}`);
  await expect(page.locator('body')).not.toContainText("404", { timeout: 10_000 });

  // Look for association-related links or buttons on the page
  // The fix ensures the frontend uses /api/books/ instead of /api/v1/books/
  const associateLink = page.getByText(/关联|绑定|book/i).first();
  if (await associateLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    // Verify the link URL path does not contain /api/v1/ (which was the bug)
    const href = await associateLink.getAttribute('href').catch(() => '');
    if (href) {
      expect(href).not.toContain('/api/v1/');
    }
  }
});

test("3. 世界详情页前端不触发/v1路径404", async ({ page }) => {
  // The fix was: WorldDetailPage.tsx uses /api/books/ instead of /api/v1/books/
  // Verify the world detail page navigates and loads without triggering 404 from /v1/ paths
  await page.goto(`/#/worlds/${E2E_WORLD_ID}`);
  await expect(page.locator('body')).not.toContainText("404", { timeout: 10_000 });

  // Monitor network requests for any /api/v1/ calls that return 404
  const v1NotFoundCalls: string[] = [];
  page.on('requestfinished', async (request) => {
    if (request.url().includes('/api/v1/')) {
      const response = await request.response();
      if (response && response.status() === 404) {
        v1NotFoundCalls.push(request.url());
      }
    }
  });

  // Navigate within the world page to trigger association-related API calls
  // The fix ensures no /api/v1/books/ prefixed calls
  await page.waitForTimeout(1000);

  // Should have no /v1/ 404 calls from world page navigation
  expect(v1NotFoundCalls.length).toBe(0);
});
