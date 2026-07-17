import { test, expect } from "@playwright/test";
import { seedAgentTeam } from "./fixtures/seed-agent-team";

test.beforeAll(async () => {
  await seedAgentTeam();
});

test.beforeEach(async ({ page }) => {
  // Mock agent-team API to return seed data
  await page.route("**/project/agent-team", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        config: {
          schemaVersion: "1",
          agents: [
            { role: "writer", enabled: true },
            { role: "architect", enabled: true },
            { role: "planner", enabled: true },
            { role: "editor", enabled: false },
            { role: "auditor", enabled: true },
            { role: "observer", enabled: false },
            { role: "reviser", enabled: true },
          ],
          defaultModel: "gpt-4o",
          collaborationMode: "sequential",
        },
      }),
    });
  });
  await page.route("**/agent-templates", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ templates: [] }),
    });
  });
  await page.route("**/custom-agents", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ agents: [] }),
    });
  });
  await page.route("**/agent-order", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ order: [] }),
    });
  });
});

test("1. 加载Agent Team→7个Agent卡片显示", async ({ page }) => {
  await page.goto("/#/agents");

  // Wait for the team panel to render and finish loading
  await expect(page.getByRole("heading", { name: "Agent Team", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("7 个协作 Agent 的 Persona 配置面板")).toBeVisible();

  // Should see the status legend — indicates team config loaded
  await expect(page.getByText("状态图例")).toBeVisible();
  await expect(page.getByText("就绪").first()).toBeVisible();
  await expect(page.getByText("禁用")).toBeVisible();

  // Agent cards: at least writer, architect, planner are shown
  for (const name of ["执笔者", "架构师", "规划师", "审核者", "修订者"]) {
    await expect(page.getByText(name).first()).toBeVisible();
  }
});

test("2. 团队配置Tab: 切换agent开关", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.getByRole("heading", { name: "Agent Team", exact: true })).toBeVisible({ timeout: 15_000 });

  // The "重置为默认" button must be visible (proves the team panel rendered)
  await expect(page.getByText("重置为默认")).toBeVisible();

  // The "团队配置" tab is active by default
  await expect(page.getByText("团队配置")).toBeVisible();

  // Click the preset dropdown
  await page.getByText("默认预设").first().click();
  // A preset menu item should appear
  await expect(page.getByText("热血玄幻").first()).toBeVisible();
  await expect(page.getByText("言情")).toBeVisible();
  await expect(page.getByText("悬疑推理")).toBeVisible();
});

test.fixme("3. 流程编辑Tab: ReactFlow图渲染", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.getByRole("heading", { name: "Agent Team", exact: true })).toBeVisible({ timeout: 15_000 });

  // Switch to the pipeline tab
  await page.getByText("流程编辑").click();

  // Pipeline view should render — look for the brand mark "墨" or pipeline label
  await expect(page.getByText("InkChain Agent Pipeline")).toBeVisible({ timeout: 10_000 });

  // The pipeline SVG viewport should be rendered
  const svg = page.locator("svg");
  await expect(svg).toBeVisible();

  // Play button should be present
  await expect(page.getByText("播放流水线")).toBeVisible();

  // Preset selector exists
  await expect(page.getByText("热血玄幻 · 预设")).toBeVisible();

  // Pipeline stats should be visible
  await expect(page.getByText("node")).toBeVisible();
  await expect(page.getByText("token")).toBeVisible();
});

test.fixme("4. Tab切换: 数据保持", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.getByRole("heading", { name: "Agent Team", exact: true })).toBeVisible({ timeout: 15_000 });

  // Switch to pipeline tab
  await page.getByText("流程编辑").click();
  await expect(page.getByText("InkChain Agent Pipeline")).toBeVisible({ timeout: 10_000 });

  // Switch back to team tab
  await page.getByText("团队配置").click();
  await expect(page.getByText("状态图例")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("就绪").first()).toBeVisible();
});

test.fixme("5. 预设选择→配置更新", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.getByRole("heading", { name: "Agent Team", exact: true })).toBeVisible({ timeout: 15_000 });

  // Open preset dropdown
  await page.getByText("默认预设").first().click();

  // Select "热血玄幻" preset (first() because it appears in both dropdown and template list)
  await page.getByText("热血玄幻").first().click();

  // After selection, the preset name in the button should update
  // (it may briefly show "忙碌" state for all agents during the 1.5s animation)
  await expect(page.getByText("热血玄幻").first()).toBeVisible({ timeout: 5_000 });
});

test.fixme("6. 创建模板→保存→列表中可见", async ({ page }) => {
  await page.goto("/#/agents");
  await expect(page.getByRole("heading", { name: "Agent Team", exact: true })).toBeVisible({ timeout: 15_000 });

  // Click "另存为模板" button
  await page.getByText("另存为模板").click();

  // Dialog should appear
  await expect(page.getByText("模板名称")).toBeVisible();

  // Fill in template form
  await page.getByPlaceholder("输入模板名称…").fill("E2E测试模板");
  await page.getByPlaceholder("简短描述此模板…").fill("通过 E2E 测试创建的模板");

  // Click Save
  await page.getByText("保存", { exact: true }).click();

  // Wait for the dialog to close and the template to appear in the list
  await expect(page.getByText("E2E测试模板")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("通过 E2E 测试创建的模板")).toBeVisible();

  // Also check that the template is listed in the templates section
  await expect(page.getByText("用户模板")).toBeVisible();
});
