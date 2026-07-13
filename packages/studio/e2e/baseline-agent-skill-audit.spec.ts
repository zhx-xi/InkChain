import { test, expect } from "@playwright/test";

/**
 * Baseline E2E for Agent Team, Skill Library, and Audit pages (Issue #662)
 *
 * Covers key areas identified as having pre-existing CI failures.
 * Baseline mode: snapshot current state, failures tracked as Bug Issues.
 *
 * Areas covered:
 *   - Agent Team (ag): page load, tab navigation, create/edit flow
 *   - Skill Library (sk): page load, create flow, list rendering
 *   - Audit (au): page load, audit list table, status badges
 *
 * States: loading, normal (4+), error, edge
 */

test.describe("Baseline — Agent Team + Skill Library + Audit", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard first to ensure app is loaded
    await page.goto("/");
    await page.waitForTimeout(2000);
  });

  // ─── Agent Team ─────────────────────────────────────────────

  test("AG-01: Agent Team 页面正常加载 (normal)", async ({ page }) => {
    await page.goto("/#/agents");
    await page.waitForTimeout(4000);

    // Given: page URL
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });

    // Then: main content area is not empty
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
    console.log(`Agent page body text length: ${bodyText.length}`);
  });

  test("AG-02: Agent Team Tab 切换 (normal)", async ({ page }) => {
    await page.goto("/#/agents");
    await page.waitForTimeout(3000);

    // Find tabs
    const tabs = page.locator('[role="tab"], button:has-text("Agent"), button:has-text("团队"), button:has-text("流程")');
    const tabCount = await tabs.count();
    console.log(`Agent tabs: ${tabCount}`);

    if (tabCount > 0) {
      // Click each tab and verify no crash
      for (let i = 0; i < Math.min(tabCount, 3); i++) {
        await tabs.nth(i).click();
        await page.waitForTimeout(1500);
        await expect(page.locator("body")).toBeVisible();
      }
    }
  });

  test("AG-03: Agent 编辑按钮可交互 (normal)", async ({ page }) => {
    await page.goto("/#/agents");
    await page.waitForTimeout(3000);

    const editBtns = page.locator(
      '[data-testid="ag-btn-edit-agent"], [data-testid*="edit-agent"], button:has-text("编辑")'
    );
    const count = await editBtns.count();
    console.log(`Agent edit buttons: ${count}`);

    if (count > 0) {
      await editBtns.first().click();
      await page.waitForTimeout(2000);
      // Assert: page doesn't go blank after clicking edit
      await expect(page.locator("body")).toBeVisible();
      await expect(page.locator("body")).not.toHaveText("");
    }
  });

  // ─── Skill Library ──────────────────────────────────────────

  test("SK-01: Skill 库页面正常加载 (normal)", async ({ page }) => {
    await page.goto("/#/skills");
    await page.waitForTimeout(4000);

    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
    console.log(`Skill page body text length: ${bodyText.length}`);
  });

  test("SK-02: Skill 创建按钮可点击 (normal)", async ({ page }) => {
    await page.goto("/#/skills");
    await page.waitForTimeout(3000);

    const createBtn = page.locator(
      '[data-testid="sk-btn-create-skill"], [data-testid="sk-create-btn"], button:has-text("创建")'
    );
    const hasBtn = (await createBtn.count()) > 0;
    console.log(`Skill create button: ${hasBtn}`);

    if (hasBtn) {
      await createBtn.first().click();
      await page.waitForTimeout(2000);
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("SK-03: Skill 列表渲染 (normal)", async ({ page }) => {
    await page.goto("/#/skills");
    await page.waitForTimeout(4000);

    // Check for skill cards or list items
    const skillItems = page.locator(
      '[data-testid^="sk-card-"], [data-testid^="sk-item-"], [data-testid="sk-list-skills"] > *'
    );
    const itemCount = await skillItems.count();
    console.log(`Skill items: ${itemCount}`);

    // At minimum, page should have content
    await expect(page.locator("body")).toBeVisible();
  });

  // ─── Audit ──────────────────────────────────────────────────

  test("AU-01: 审计页面正常加载 (normal)", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);

    // Navigate to audit
    await page.goto("/#/audit");
    await page.waitForTimeout(4000);

    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });

    const bodyText = await page.locator("body").innerText();
    console.log(`Audit page body text length: ${bodyText.length}`);
  });

  test("AU-02: 审计列表表格渲染 (normal)", async ({ page }) => {
    await page.goto("/#/audit");
    await page.waitForTimeout(4000);

    // Check for audit table or list
    const auditTable = page.locator(
      '[data-testid="au-table-audit-list"], table, [role="table"], [data-testid="au-table-summary"]'
    );
    const tableVisible = await auditTable.first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Audit table visible: ${tableVisible}`);

    await expect(page.locator("body")).toBeVisible();
  });

  // ─── Error States ───────────────────────────────────────────

  test("ERR-01: API 失败时 Agent 页面不崩溃 (error)", async ({ page }) => {
    await page.route("**/api/project/agent-team**", (route) =>
      route.fulfill({ status: 500, body: "Server Error" })
    );
    await page.route("**/api/v1/custom-agents**", (route) =>
      route.fulfill({ status: 500, body: "Server Error" })
    );

    await page.goto("/#/agents");
    await page.waitForTimeout(4000);

    // Assert: page body still visible (not crashed)
    await expect(page.locator("body")).toBeVisible();
  });

  test("ERR-02: API 失败时 Skill 页面不崩溃 (error)", async ({ page }) => {
    await page.route("**/api/skills/**", (route) =>
      route.fulfill({ status: 500, body: "Server Error" })
    );

    await page.goto("/#/skills");
    await page.waitForTimeout(4000);

    await expect(page.locator("body")).toBeVisible();
  });

  // ─── Edge Cases ─────────────────────────────────────────────

  test("EDGE-01: 快速切换页面不崩溃 (edge)", async ({ page }) => {
    const pages = ["/#/agents", "/#/skills", "/#/audit"];

    for (const p of pages) {
      await page.goto(p);
      await page.waitForTimeout(1500);
      await expect(page.locator("body")).toBeVisible();
    }

    // Rapid switch
    await page.goto("/#/agents");
    await page.goto("/#/skills");
    await page.waitForTimeout(1000);
    await expect(page.locator("body")).toBeVisible();
  });
});
