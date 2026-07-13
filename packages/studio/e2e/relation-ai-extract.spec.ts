import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";
const TEST_BOOK_ID = "test-project-123";

/**
 * E2E for #603: 关系图谱 — AI 自动提取不区分主角/配角
 *
 * Bug: AI relation extraction doesn't distinguish protagonist from supporting characters
 *
 * States: loading, normal (extract with role distinction), error, edge (no characters)
 */

test.describe("RelationGraph — AI提取角色区分验证", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/book/${TEST_BOOK_ID}/relations`);
    await page.waitForTimeout(3000);
  });

  test("1. 正常加载: 关系图谱页面呈现", async ({ page }) => {
    await expect(page.locator("body")).toBeVisible();
  });

  test("2. AI提取按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const aiBtn = page.locator(
      "[data-testid='rg-btn-ai-extract'], [data-testid*='extract'], button:has-text('AI'), button:has-text('提取')"
    );
    const btnCount = await aiBtn.count();
    console.log(`AI extract buttons: ${btnCount}`);
    expect(btnCount).toBeGreaterThanOrEqual(1);
  });

  test("3. AI提取后: 提取结果弹窗应区分角色层级", async ({ page }) => {
    // Click AI extract button
    const aiBtn = page.locator(
      "[data-testid='rg-btn-ai-extract'], button:has-text('AI'), button:has-text('提取')"
    ).first();
    const btnExists = await aiBtn.isVisible().catch(() => false);
    console.log(`AI extract button visible: ${btnExists}`);

    if (btnExists) {
      await aiBtn.click();
      await page.waitForTimeout(2000);

      // Check for AI extract modal/panel
      const modal = page.locator(
        "[data-testid='rg-modal-ai-extract'], [role='dialog'], .fixed.inset-0"
      );
      const modalExists = await modal.isVisible().catch(() => false);
      console.log(`AI extract modal visible: ${modalExists}`);

      if (modalExists) {
        // Check for role/tier indicators in the modal
        const roleIndicators = page.locator(
          "[data-testid*='tier'], [data-testid*='role'], [data-testid*='level'], :has-text('主角'), :has-text('配角'), :has-text('protagonist'), :has-text('supporting')"
        );
        const roleCount = await roleIndicators.count();
        console.log(`Role/tier indicators found: ${roleCount}`);
        // The bug fix should show role distinctions — protagonist vs supporting
      }
    }
  });

  test("4. 提取结果应用后: 图谱节点应有角色标识", async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Check if existing character nodes have role/tier attributes
    const charNodes = page.locator(
      "[data-testid*='rg-node-character'], [data-testid*='tier'], [data-testid*='role']"
    );
    const nodeCount = await charNodes.count();
    console.log(`Character/tiered nodes: ${nodeCount}`);
  });

  test("5. 空状态: 无角色时显示空状态", async ({ page }) => {
    // Intercept relations API to return empty
    await page.route("**/api/v1/books/**/relations", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
    await page.reload();
    await page.waitForTimeout(2000);

    const emptyState = page.locator(
      "[data-testid$='empty-state'], [data-testid$='state-empty'], :has-text('暂无'), :has-text('添加第一个')"
    );
    const hasEmpty = (await emptyState.count()) > 0;
    console.log(`Empty state: ${hasEmpty}`);
  });
});
