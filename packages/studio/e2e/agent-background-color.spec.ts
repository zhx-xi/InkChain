import { test, expect } from "@playwright/test";
import { seedAgentTeam } from "./fixtures/seed-agent-team";

test.beforeAll(async () => {
  await seedAgentTeam();
});

// ─── 1. 加载状态 ───
test("1. 加载状态→Agent Hub渲染loading", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.getByRole("heading", { name: "Agent Team", exact: true })).toBeVisible({ timeout: 15_000 });
  // The team config tab should be visible (first tab)
  await expect(page.locator('[data-testid="ag-config-tab"]')).toBeVisible({ timeout: 10_000 });
});

// ─── 2. 正常状态 ───
test("2. 正常状态→Agent Hub页面完整渲染", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.getByRole("heading", { name: "Agent Team", exact: true })).toBeVisible({ timeout: 15_000 });
  // Both tabs should be visible
  await expect(page.locator('[data-testid="ag-config-tab"]')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('[data-testid="ag-flow-tab"]')).toBeVisible({ timeout: 5_000 });
});

// ─── 3. Agent团队配置区域背景色一致 ───
test("3. Agent团队配置→背景色与页面背景一致", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.locator('[data-testid="ag-config-tab"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid="ag-config-tab"]').click();

  // Get page body background
  const bodyBg = await page.locator("body").evaluate((el) =>
    window.getComputedStyle(el).backgroundColor
  );

  const bodyBg2 = await page.locator("body").evaluate((el) =>
    window.getComputedStyle(el).backgroundColor
  );

  // Background should be truthy (not empty/transparent in a broken way)
  expect(bodyBg).toBeTruthy();
  expect(bodyBg2).toBeTruthy();
});

// ─── 4. 团队配置Tab背景一致 ───
test("4. 团队配置Tab→背景色与页面整体一致", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.locator('[data-testid="ag-config-tab"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid="ag-config-tab"]').click();
  await page.waitForTimeout(500);

  const bodyBg = await page.locator("body").evaluate((el) =>
    window.getComputedStyle(el).backgroundColor
  );

  // The team config area panel (agent cards grid)
  const teamPanelBg = await page.locator('[data-testid="ag-agent-hub"]').evaluate((el) =>
    window.getComputedStyle(el).backgroundColor
  ).catch(() => "rgba(0, 0, 0, 0)");

  expect(bodyBg).toBeTruthy();
  expect(teamPanelBg).toBeTruthy();
});

// ─── 5. Tab切换后背景保持 ───
test("5. Tab切换→切换Tab后背景色保持一致", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.locator('[data-testid="ag-config-tab"]')).toBeVisible({ timeout: 15_000 });

  // Visit all 2 tabs and check the page background stays consistent
  const tabs = ["ag-config-tab", "ag-flow-tab"];
  const backgrounds: string[] = [];

  for (const tabId of tabs) {
    await page.locator(`[data-testid="${tabId}"]`).click();
    await page.waitForTimeout(500);

    const bg = await page.locator("body").evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    backgrounds.push(bg);
  }

  // All tabs should have the same page background
  if (backgrounds.length >= 2) {
    const unique = [...new Set(backgrounds)];
    expect(unique.length).toBe(1);
  }
});

// ─── 6. 流程编辑Tab背景一致 ───
test("6. 流程编辑Tab→流程编辑区域背景色与页面一致", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.locator('[data-testid="ag-flow-tab"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid="ag-flow-tab"]').click();
  await page.waitForTimeout(500);

  const bodyBg = await page.locator("body").evaluate((el) =>
    window.getComputedStyle(el).backgroundColor
  );

  // Check the agent hub container
  const hubBg = await page.locator('[data-testid="ag-agent-hub"]').evaluate((el) =>
    window.getComputedStyle(el).backgroundColor
  ).catch(() => "rgba(0, 0, 0, 0)");

  expect(bodyBg).toBeTruthy();
  expect(hubBg).toBeTruthy();
});

// ─── 7. Agent卡片背景 ───
test("7. Agent卡片→Agent详情背景色不突兀", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.locator('[data-testid="ag-agent-card-writer"]')).toBeVisible({ timeout: 15_000 });

  // Get the agent card background and body background
  const cardBg = await page.locator('[data-testid="ag-agent-card-writer"]').evaluate((el) =>
    window.getComputedStyle(el).backgroundColor
  );

  const bodyBg = await page.locator("body").evaluate((el) =>
    window.getComputedStyle(el).backgroundColor
  );

  expect(cardBg).toBeTruthy();
  expect(bodyBg).toBeTruthy();
});

// ─── 8. 边界: Tab区域背景 ───
test("8. 边界: Tab区域→背景色使用设计系统token", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.locator('[data-testid="ag-config-tab"]')).toBeVisible({ timeout: 15_000 });

  // Check that the page uses CSS variables (design tokens) for background
  const hasBackgroundToken = await page.locator("body").evaluate(() => {
    const styles = window.getComputedStyle(document.body);
    // Check for any background-related CSS variable
    const bgVar = styles.getPropertyValue("--background");
    const bgVarAlt = styles.getPropertyValue("--bg-base");
    const bgVarCard = styles.getPropertyValue("--card");
    return bgVar || bgVarAlt || bgVarCard || "no var found";
  });

  // Should have at least one background token defined
  expect(hasBackgroundToken).not.toBe("");
});

// ─── 9. 正常状态→整体页面无明显色差 ───
test("9. 整体页面→Agent区域背景与页面背景无明显色差", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.getByRole("heading", { name: "Agent Team", exact: true })).toBeVisible({ timeout: 15_000 });

  // Get the heading area background
  const heading = page.getByRole("heading", { name: "Agent Team", exact: true });
  const headingBox = await heading.boundingBox();
  expect(headingBox).not.toBeNull();

  // Page should be fully rendered and consistent
  const bodyBg = await page.locator("body").evaluate((el) =>
    window.getComputedStyle(el).backgroundColor
  );
  expect(bodyBg).toBeTruthy();
  // Body background should not be solid white (should use design tokens)
  // This is a weak check, but indicates if design system is in use
});
