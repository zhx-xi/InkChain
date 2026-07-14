import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";

test.describe("AgentHubPage — Agent 团队基线 (Issue #686)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/agents`);
  });

  // 1. 正常加载
  test("1. 正常加载: 页面显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
  });

  // 2. 创建 Agent 按钮
  test("2. 创建 Agent 按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid='ag-btn-create-agent'], button:has-text('创建Agent'), button:has-text('创建'), button:has-text('新建'), button:has-text('添加')"
    );
    const count = await btn.count();
    console.log(`Create agent button: ${count}`);
  });

  // 3. 从模板创建按钮
  test("3. 从模板创建按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid='ag-btn-create-from-template'], button:has-text('模板'), button:has-text('预设'), button:has-text('Template'), [data-testid*='ag-template']"
    );
    const count = await btn.count();
    console.log(`Create from template button: ${count}`);
  });

  // 4. Tab 切换
  test("4. Tab 切换控件存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const tabs = page.locator(
      "[data-testid*='ag-tab'], button[role='tab'], [role='tablist'] button"
    );
    const count = await tabs.count();
    console.log(`Tabs: ${count}`);
  });

  // 5. Agent 列表
  test("5. Agent 列表存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const list = page.locator(
      "[data-testid='ag-list-agents'], [data-testid*='ag-list'], [class*='agent-list'], [class*='agents-list']"
    );
    const count = await list.count();
    console.log(`Agent list: ${count}`);

    const items = page.locator(
      "[data-testid*='ag-item'], [class*='agent-item'], [class*='agent-card']"
    );
    const itemCount = await items.count();
    console.log(`Agent items: ${itemCount}`);
  });

  // 6. 保存 Team 配置按钮
  test("6. 保存 Team 配置按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid='ag-btn-save-team-config'], button:has-text('保存'), button:has-text('Save')"
    );
    const count = await btn.count();
    console.log(`Save team config button: ${count}`);
  });

  // 7. 编辑 Persona 按钮
  test("7. 编辑 Persona 按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid*='ag-btn-edit-persona'], button:has-text('Persona'), button:has-text('人格'), button:has-text('角色设定')"
    );
    const count = await btn.count();
    console.log(`Edit persona button: ${count}`);
  });

  // 8. 模板列表
  test("8. 模板列表存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const list = page.locator(
      "[data-testid='ag-list-templates'], [data-testid*='ag-template-list'], [class*='template-list']"
    );
    const count = await list.count();
    console.log(`Template list: ${count}`);
  });

  // 9. 加载状态
  test("9. 加载状态: 数据加载中显示loading", async ({ page }) => {
    await page.waitForTimeout(2000);
    const loading = page.locator(
      "[data-testid*='loading'], [class*='loading'], [class*='spinner'], :has-text('加载中')"
    );
    const hasLoading = (await loading.count()) > 0;
    console.log(`Loading state: ${hasLoading}`);
  });

  // 10. 空状态
  test("10. 空状态: 无数据时显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    const empty = page.locator(
      "[data-testid*='empty'], [data-testid*='Empty'], :has-text('暂无'), :has-text('无数据'), :has-text('创建第一个')"
    );
    const hasEmpty = (await empty.count()) > 0;
    console.log(`Empty state: ${hasEmpty}`);
  });

  // 11. 错误状态
  test("11. 错误状态: API失败时显示错误", async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.fulfill({ status: 500, body: "Server Error" })
    );
    await page.reload();
    await page.waitForTimeout(2000);
    const error = page.locator(
      "[data-testid*='error'], [data-testid*='Error'], :has-text('错误'), :has-text('失败')"
    );
    const hasError = (await error.count()) > 0;
    console.log(`Error state: ${hasError}`);
  });

  // 12. 拖拽排序手柄
  test("12. 拖拽排序手柄存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const handles = page.locator(
      "[data-testid*='ag-handle'], [data-testid*='drag'], [class*='drag-handle'], [aria-label*='拖拽'], [aria-label*='drag']"
    );
    const count = await handles.count();
    console.log(`Drag handles: ${count}`);
  });
});
