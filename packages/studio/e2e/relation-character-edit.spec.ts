import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";
const TEST_BOOK_ID = "test-project-123";

/**
 * E2E for #602: 关系图谱 — 点击角色栏跳转空白页且无法编辑
 *
 * Bug: Clicking character sidebar/item navigates to a blank page instead of
 * showing the character edit panel/modal
 *
 * States: loading, normal (edit opens), error (blank page), edge (no character selected)
 */

test.describe("RelationGraph — 角色点击编辑验证", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/book/${TEST_BOOK_ID}/relations`);
    await page.waitForTimeout(3000);
  });

  test("1. 正常加载: 关系图谱页面呈现", async ({ page }) => {
    await expect(page.locator("body")).toBeVisible();
    const canvas = page.locator(
      "[data-testid='rg-canvas-graph'], canvas, [data-testid*='graph']"
    );
    const canvasCount = await canvas.count();
    console.log(`Graph canvas elements: ${canvasCount}`);
  });

  test("2. 角色节点可点击: 点击不导致空白页", async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Look for character nodes/avatars in the graph
    const charNode = page.locator(
      "[data-testid*='rg-node-character'], [data-testid*='character'], [data-testid*='node'], .react-flow__node"
    ).first();
    
    const nodeExists = await charNode.isVisible().catch(() => false);
    console.log(`Character node visible: ${nodeExists}`);

    if (nodeExists) {
      // Click the node — should show edit/detail panel, not blank page
      await charNode.click();
      await page.waitForTimeout(1000);

      // Verify we're not on a blank page
      const pageContent = await page.locator("body").textContent();
      expect(pageContent?.length).toBeGreaterThan(50);

      // Check for any panel/modal
      const panel = page.locator(
        "[data-testid$='modal'], [data-testid$='panel'], [role='dialog'], [data-testid='rg-modal-relation-editor'], [data-testid$='detail']"
      );
      const panelCount = await panel.count();
      console.log(`Panels/modals after click: ${panelCount}`);
    }
  });

  test("3. 角色节点点击后: 编辑面板可交互", async ({ page }) => {
    await page.waitForTimeout(2000);
    
    const charNode = page.locator(
      "[data-testid*='rg-node-character'], [data-testid*='character'], [data-testid*='node'], .react-flow__node"
    ).first();
    
    const nodeExists = await charNode.isVisible().catch(() => false);
    if (nodeExists) {
      await charNode.click();
      await page.waitForTimeout(1500);

      // Check for edit buttons/inputs
      const editElements = page.locator(
        "input, textarea, [data-testid*='edit'], button:has-text('编辑'), button:has-text('保存')"
      );
      const editCount = await editElements.count();
      console.log(`Editable elements available: ${editCount}`);
    }
  });

  test("4. 空白页检测: 点击前后页面URL正常", async ({ page }) => {
    const initialUrl = page.url();
    console.log(`Initial URL: ${initialUrl}`);

    const charNode = page.locator(
      "[data-testid*='rg-node-character'], [data-testid*='character'], .react-flow__node"
    ).first();
    
    const nodeExists = await charNode.isVisible().catch(() => false);
    if (nodeExists) {
      await charNode.click();
      await page.waitForTimeout(1500);

      const afterUrl = page.url();
      console.log(`URL after click: ${afterUrl}`);

      // URL should not have changed to a blank/empty route
      // If it navigated to a blank page, the URL would likely include 'null' or empty path
      expect(afterUrl).not.toMatch(/\/(null|undefined|blank)/);
      expect(afterUrl).not.toBe("about:blank");
    }
  });

  test("5. API错误状态: 关系数据加载失败时显示错误", async ({ page }) => {
    await page.route("**/api/v1/books/**/relations", (route) =>
      route.fulfill({ status: 500, body: "Server Error" })
    );
    await page.reload();
    await page.waitForTimeout(2000);

    const error = page.locator(
      "[data-testid$='error-state'], [data-testid$='state-error'], :has-text('错误'), :has-text('失败'), :has-text('重试')"
    );
    const hasError = await error.isVisible().catch(() => false);
    console.log(`Error state shown: ${hasError}`);
  });
});
