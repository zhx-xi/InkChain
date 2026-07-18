import { test, expect, Page } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────────────

/** Navigate to WorldInheritancePage via hash route */
async function navigateToWorldInheritance(page: Page, worldId: string = "e2e-test-world") {
  await page.goto(`/#/worlds/${worldId}/inherit`, { waitUntil: "load" });
  await page.waitForTimeout(2000);
}

/** Mock /api/worlds/:worldId to return a world with entities */
function mockWorldData(page: Page, worldData: Record<string, unknown>) {
  return page.route("**/api/v1/worlds/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ world: worldData }),
    });
  });
}

/** Mock /api/worlds/:worldId to return error */
function mockWorldError(page: Page) {
  return page.route("**/api/v1/worlds/**", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Internal server error" }),
    });
  });
}

// ── Test Fixtures ────────────────────────────────────────────────

const WORLD_WITH_ENTITIES = {
  id: "source-world-1",
  name: "测试源世界",
  description: "用于E2E测试的源世界",
  settings: [
    { id: "s1", name: "魔法体系", description: "元素魔法" },
    { id: "s2", name: "社会结构", description: "封建制度" },
  ],
  regions: [
    { id: "r1", name: "龙脊山脉", description: "北方山脉" },
  ],
  roles: [
    { id: "ro1", name: "勇者", description: "主角" },
    { id: "ro2", name: "贤者", description: "导师" },
    { id: "ro3", name: "魔王", description: "反派" },
  ],
  institutions: [] as string[],
  relations: [] as string[],
  history: [
    { id: "h1", title: "创世战争", description: "远古的创世战争" },
  ],
  rules: [] as string[],
};

const WORLD_WITH_CONFLICTS = {
  id: "source-world-2",
  name: "冲突测试世界",
  description: "用于冲突测试",
  settings: [
    { id: "s1", name: "魔法体系", description: "已有名称冲突" },
    { id: "s2", name: "魔法体系", description: "同名冲突 - 不同实体" },
  ],
  roles: [] as string[],
  regions: [] as string[],
  institutions: [] as string[],
  relations: [] as string[],
  history: [] as string[],
  rules: [] as string[],
};

const WORLD_EMPTY = {
  id: "empty-world",
  name: "空世界",
  description: "没有任何实体的世界",
  settings: [] as string[],
  regions: [] as string[],
  roles: [] as string[],
  institutions: [] as string[],
  relations: [] as string[],
  history: [] as string[],
  rules: [] as string[],
};

// ── Tests ────────────────────────────────────────────────────────

test.describe("WorldInheritancePage", () => {
  test("1. Page renders with tree selector and dimension stats", async ({ page }) => {
    // Given the API returns a world with entities across multiple dimensions
    await mockWorldData(page, WORLD_WITH_ENTITIES);

    // When navigating to world inheritance page
    await navigateToWorldInheritance(page);

    // Then the page title should be visible
    await expect(page.getByText("选择性继承 World", { exact: false }).first()).toBeVisible({ timeout: 10_000 });

    // Then the source world badge should show the world name
    await expect(page.getByText("测试源世界", { exact: false }).first()).toBeVisible();

    // Then the stats summary should show entity counts
    await expect(page.getByText("个实体将被继承").first()).toBeVisible();

    // Then dimension badges should render for non-empty dimensions
    await expect(page.getByText("世界观设定").first()).toBeVisible();
    await expect(page.getByText("地理区域").first()).toBeVisible();
    await expect(page.getByText("角色").first()).toBeVisible();
    await expect(page.getByText("历史事件").first()).toBeVisible();

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("2. Error state shows when API fails", async ({ page }) => {
    // Given the API returns an error
    await mockWorldError(page);

    // When navigating to world inheritance page
    await navigateToWorldInheritance(page);

    // Then the error container should be visible
    await expect(page.getByText("返回世界列表").first()).toBeVisible({ timeout: 10_000 });

    // Then error text should show
    await expect(page.getByText("Internal server error", { exact: false }).first()).toBeVisible();

    // Then the page should not crash entirely
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("3. Empty world shows no dimensions and zero stats", async ({ page }) => {
    // Given the API returns a world with no entities
    await mockWorldData(page, WORLD_EMPTY);

    // When navigating to world inheritance page
    await navigateToWorldInheritance(page);

    // Then the page should render without crash
    await expect(page.getByText("选择性继承 World", { exact: false }).first()).toBeVisible({ timeout: 10_000 });

    // Then stats should show 0 selected
    await expect(page.getByText("0").first()).toBeVisible();
    await expect(page.getByText("个实体将被继承").first()).toBeVisible();

    // Then the confirm button should be disabled (nothing selected)
    const confirmButton = page.getByText("确认创建新 World", { exact: false });
    await expect(confirmButton).toBeVisible();
    await expect(confirmButton).toBeDisabled();

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("4. Conflict detection shows conflict badge and modal", async ({ page }) => {
    // Given the API returns a world with name conflicts (same name in same dimension)
    await mockWorldData(page, WORLD_WITH_CONFLICTS);

    // When navigating to world inheritance page
    await navigateToWorldInheritance(page);

    // Then the page should render
    await expect(page.getByText("选择性继承 World", { exact: false }).first()).toBeVisible({ timeout: 10_000 });

    // Then conflict count should show in the action bar
    await expect(page.getByText("检测到", { exact: false }).first()).toBeVisible();

    // Then conflict badge icons should be visible (AlertTriangle)
    // Click one of the conflict badges to open the modal
    const conflictTriggers = page.locator('[title="存在命名冲突"]');
    const conflictCount = await conflictTriggers.count();
    if (conflictCount > 0) {
      await conflictTriggers.first().click();
      await page.waitForTimeout(500);

      // Then the conflict resolution modal should appear
      await expect(page.getByText("覆盖").first()).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText("保留本地").first()).toBeVisible();
      await expect(page.getByText("重命名继承").first()).toBeVisible();
    }

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
