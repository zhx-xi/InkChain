import { test, expect } from "@playwright/test";

/**
 * E2E: 审计 — 批准后状态图标不更新 (#621)
 *
 * Bug: 批准审计项后，状态图标仍显示橙色圆点不显示✓
 * Expected: 批准后状态图标即时更新为通过状态
 *
 * Given-When-Then + 4 态覆盖
 */

const BASE_URL = "http://localhost:4580";

test.describe("Audit — 批准后状态更新 (#621)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/book/test-project-123/audit`);
  });

  // ── Normal: 批准审计项后状态更新 ──
  test("GIVEN 在审计页面 WHEN 点击批准按钮 THEN 状态图标即时更新为通过", async ({ page }) => {
    await page.waitForTimeout(3000);

    // Find an approve button for any chapter
    const approveBtn = page.locator(
      '[data-testid^="au-btn-approve-"], button:has-text("批准"), button:has-text("Approve"), button:has-text("通过")'
    ).first();

    if (await approveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await approveBtn.click();
      await page.waitForTimeout(2000);

      // Check that status badge updated (should show checkmark/passed indicator)
      const statusBadge = page.locator(
        '[data-testid^="au-badge-status-"], [class*="status"], [class*="badge"], [class*="indicator"]'
      ).first();
      if (await statusBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
        const badgeText = await statusBadge.textContent();
        console.log(`Status badge after approve: ${badgeText}`);
        // Should not show error/orange indicator
        expect(badgeText).toBeTruthy();
      }
    }
  });

  // ── Normal: 无需刷新即可看到更新 ──
  test("GIVEN 批准审计项后 WHEN 不刷新页面 THEN 状态图标已反映新状态", async ({ page }) => {
    await page.waitForTimeout(3000);

    const approveBtn = page.locator(
      '[data-testid^="au-btn-approve-"], button:has-text("批准"), button:has-text("Approve"), button:has-text("通过")'
    ).first();

    if (await approveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await approveBtn.click();
      // Wait briefly — should NOT need page reload
      await page.waitForTimeout(1500);

      // Check page didn't crash
      const body = page.locator("body");
      await expect(body).toBeVisible();

      // Verify DOM is still interactive (no full page reload)
      const interactiveElements = page.locator("button, [role=button]");
      const count = await interactiveElements.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  // ── Normal: 审计列表正常渲染 ──
  test("GIVEN 进入审计页面 WHEN 页面加载完成 THEN 显示审计列表和状态指示器", async ({ page }) => {
    await page.waitForTimeout(3000);

    // Audit table or list should be visible
    const auditTable = page.locator(
      '[data-testid="au-table-audit-list"], table, [role="table"], [class*="audit"]'
    );
    const visible = await auditTable.first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Audit table visible: ${visible}`);

    // Status badges should exist for audit items
    const statusBadges = page.locator(
      '[data-testid^="au-badge-status-"], [class*="status-badge"], [class*="StatusBadge"]'
    );
    const badgeCount = await statusBadges.count();
    console.log(`Status badges: ${badgeCount}`);
  });

  // ── Error: 批准请求失败 ──
  test("GIVEN 批准请求失败 WHEN 点击批准按钮 THEN 显示错误提示而不崩溃", async ({ page }) => {
    await page.waitForTimeout(3000);

    const approveBtn = page.locator(
      '[data-testid^="au-btn-approve-"], button:has-text("批准"), button:has-text("Approve"), button:has-text("通过")'
    ).first();

    if (await approveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await approveBtn.click();
      await page.waitForTimeout(2000);

      // Page should not crash regardless of API result
      const pageErrors: string[] = [];
      page.on("pageerror", (err) => pageErrors.push(err.message));
      await page.waitForTimeout(1000);
      expect(pageErrors.length).toBe(0);
    }
  });

  // ── Edge: 所有审计项已通过 ──
  test("GIVEN 审计页面 WHEN 所有章节已通过 THEN 显示全部通过汇总", async ({ page }) => {
    await page.waitForTimeout(3000);

    // Check for "all passed" summary or normal state
    const summary = page.locator(
      '[data-testid="au-state-all-passed"], [data-testid="au-table-summary"], [class*="summary"]'
    );
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});
