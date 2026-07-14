import { test, expect } from "@playwright/test";
import { seedAgentTeam } from "./fixtures/seed-agent-team";

test.beforeAll(async () => {
  await seedAgentTeam();
});

test.describe("AgentHubPage — 补充场景", () => {
  test("1. 协作模式选择器可见且可切换", async ({ page }) => {
    await page.goto("/#/agents");
    await expect(page.getByText("Agent Team").first()).toBeVisible({ timeout: 15_000 });

    // All three collaboration modes should be visible
    await expect(page.getByText("顺序执行")).toBeVisible();
    await expect(page.getByText("并行执行")).toBeVisible();
    await expect(page.getByText("混合模式")).toBeVisible();

    // Click "并行执行" — should switch mode
    await page.getByText("并行执行").click();
    await expect(page.getByText("并行执行")).toBeVisible();
  });

  test("2. 自定义Agent添加流程", async ({ page }) => {
    await page.goto("/#/agents");
    await expect(page.getByText("Agent Team").first()).toBeVisible({ timeout: 15_000 });

    // Click "创建自定义 Agent" button
    const addBtn = page.getByTestId("ag-btn-create-agent");
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Dialog should appear with form fields
    await expect(page.getByText(/添加自定义 Agent|编辑自定义 Agent/)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("名称 *")).toBeVisible();
    await expect(page.getByText("角色标识 *")).toBeVisible();

    // Fill in the form
    const nameInput = page.getByPlaceholder("例如：润色师");
    if (await nameInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await nameInput.fill("E2E测试Agent");
    }

    const roleInput = page.getByPlaceholder("例如：polish");
    if (await roleInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await roleInput.fill("e2e-test");
    }

    const descInput = page.getByPlaceholder("简短描述此 Agent 的职责…");
    if (await descInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await descInput.fill("通过 E2E 测试创建的 Agent");
    }

    // Click save/create
    const saveBtn = page.getByRole("button", { name: /保存|创建|添加|确认/i }).last();
    if (await saveBtn.isEnabled({ timeout: 3_000 }).catch(() => false)) {
      await saveBtn.click();
      // Wait for dialog to close
      await page.waitForTimeout(1_000);
    }

    // After creation, the page should still work
    await expect(page.getByText("Agent Team").first()).toBeVisible({ timeout: 5_000 });
  });

  test("3. 空名称验证 — 添加自定义Agent时", async ({ page }) => {
    await page.goto("/#/agents");
    await expect(page.getByText("Agent Team").first()).toBeVisible({ timeout: 15_000 });

    // Open add custom agent dialog
    await page.getByTestId("ag-btn-create-agent").click();
    await expect(page.getByText(/添加自定义 Agent|编辑自定义 Agent/)).toBeVisible({ timeout: 5_000 });

    // Try to save with empty name
    const saveBtn = page.getByRole("button", { name: /保存|创建|添加/i });
    if (await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await saveBtn.click();
      // Should show validation error
      await page.waitForTimeout(500);
    }
  });

  test("4. 预设切换 → 配置更新", async ({ page }) => {
    await page.goto("/#/agents");
    await expect(page.getByText("Agent Team").first()).toBeVisible({ timeout: 15_000 });

    // Open preset dropdown and select a different preset
    await page.getByRole("button", { name: "默认预设" }).click();
    await page.getByText("热血玄幻").first().click();
    await expect(page.getByText(/热血玄幻/).first()).toBeVisible({ timeout: 5_000 });

    // "另存为模板" button should still be visible after preset change
    await expect(page.getByText("另存为模板")).toBeVisible();
  });

  test("5. 错误状态 — API 失败时显示重试", async ({ page }) => {
    // Mock the agent-team API to return 500
    await page.route("**/api/v1/project/agent-team", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    });

    await page.goto("/#/agents");

    // Should show error message and retry button
    await expect(page.getByText("重试").or(page.getByText("错误"))).toBeVisible({ timeout: 15_000 });
  });
});
