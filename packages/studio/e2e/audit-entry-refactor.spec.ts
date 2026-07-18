import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";
const BOOK_ID = "test-project-123";

/**
 * E2E tests for #733 — 章节审计功能入口重构 + 规则/AI接入评估
 *
 * These tests MUST FAIL in Phase A (code not yet implemented).
 * Strong assertions: getByText, getByRole, toBeVisible with specific content.
 */
test.describe("章节审计 — 入口重构与状态同步", () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/#/audit/${BOOK_ID}`);
    await page.waitForURL(/#\/audit\//, { timeout: 15000 });
    await page.waitForTimeout(2000);
  });

  // ── Audit page core (must fail if page doesn't render) ─────

  test("1. 审计页面标题可见 — '章节审计' heading 出现", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /章节审计|章节 审计|Audit|审计/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("2. 审计表格有内容 — 至少有一个章节行或状态标识", async ({ page }) => {
    // Table or list should render chapter items
    const chapterItem = page.locator(
      '[data-testid*="au-row"], [data-testid*="au-item"], table tr, [class*="audit"] [class*="row"]'
    );
    await expect(chapterItem.first()).toBeVisible({ timeout: 10000 });

    // Verify at least one chapter name appears (e.g. "第一章", "第1章")
    const chapterName = page.locator(':has-text("第")').first();
    await expect(chapterName).toBeVisible({ timeout: 5000 });
  });

  // ── Approve button ─────────────────────────────────────────

  test("3. 批准按钮可见 — 至少存在一个'批准'或'通过'按钮", async ({ page }) => {
    const approveBtn = page.locator(
      '[data-testid="au-btn-approve"], [data-testid*="approve"], button:has-text("批准"), button:has-text("通过")'
    );
    await expect(approveBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test("4. 批量审计按钮可见 — '批量审计'按钮存在", async ({ page }) => {
    const batchBtn = page.locator(
      '[data-testid="au-btn-batch-audit"], [data-testid="au-batch-audit-btn"], button:has-text("批量审计"), button:has-text("批量")'
    );
    await expect(batchBtn.first()).toBeVisible({ timeout: 5000 });
  });

  // ── Audit dialog ───────────────────────────────────────────

  test("5. 点击审计按钮弹出详情弹窗", async ({ page }) => {
    // Find an audit/detail button and click it
    const detailBtn = page.locator(
      '[data-testid*="au-detail"], [data-testid*="au-info"], button:has-text("审计"), button:has-text("详情")'
    ).first();
    await expect(detailBtn).toBeVisible({ timeout: 5000 });
    await detailBtn.click();
    await page.waitForTimeout(1000);

    // A dialog must appear
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Dialog must have content (not empty)
    const dialogText = await dialog.innerText();
    expect(dialogText.length).toBeGreaterThan(10);
  });

  // ── Fix button ─────────────────────────────────────────────

  test("6. 一键修复按钮可见", async ({ page }) => {
    const fixBtn = page.locator(
      '[data-testid="au-auto-fix-btn"], [data-testid="au-btn-apply-fix"], button:has-text("修复"), button:has-text("一键修复")'
    );
    await expect(fixBtn.first()).toBeVisible({ timeout: 5000 });
  });

  // ── State coverage ─────────────────────────────────────────

  test("7. 加载中状态 — 刷新后出现 spinner 或 loading 指示", async ({ page }) => {
    await page.reload();
    // Should show a loading indicator briefly
    const loadingEl = page.locator(
      '[data-testid="au-state-loading"], [class*="spinner"], [class*="loading"]'
    );
    await expect(loadingEl.first()).toBeVisible({ timeout: 3000 });
  });

  test("8. 错误状态 — API 500 后显示错误提示", async ({ page }) => {
    await page.route("**/api/books/**/audit**", (route) =>
      route.fulfill({ status: 500, body: "Server Error" })
    );
    await page.reload();
    await page.waitForTimeout(2000);

    // Error UI must appear (toast, inline error, or error text)
    const errorEl = page.locator(
      '[data-testid="au-error-state"], [data-testid="au-state-error"], [class*="toast"], :has-text("错误")'
    );
    await expect(errorEl.first()).toBeVisible({ timeout: 5000 });
  });

  // ── Persistence ────────────────────────────────────────────

  test("9. 刷新后页面标题仍然存在 — 持久化验证", async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(
      page.getByRole("heading", { name: /章节审计|审计/i })
    ).toBeVisible({ timeout: 10000 });

    await page.reload();
    await page.waitForURL(/#\/audit\//, { timeout: 15000 });
    await page.waitForTimeout(2000);

    await expect(
      page.getByRole("heading", { name: /章节审计|审计/i })
    ).toBeVisible({ timeout: 10000 });
  });
});
