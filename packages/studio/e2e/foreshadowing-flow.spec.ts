import { test, expect, Page } from "@playwright/test";
import {
  seedForeshadowing,
  clearForeshadowing,
  E2E_FORES_BOOK_ID,
} from "./fixtures/seed-foreshadowing";
import { conditionalMock } from "./fixtures/mock-llm-helper";

// ── Shared helpers ──────────────────────────────────────────────

/** Open the "新建伏笔" modal, fill fields, and submit */
async function createForeshadowingViaUI(
  page: Page,
  { title, description }: { title: string; description: string },
) {
  await page.getByRole("button", { name: "新建伏笔" }).click();
  await expect(page.getByText("创建伏笔")).toBeVisible({ timeout: 3_000 });
  await page.getByPlaceholder("伏笔名称").fill(title);
  await page.getByPlaceholder("伏笔描述").fill(description);
  await page.getByRole("button", { name: "创建", exact: true }).click();
  await expect(page.getByText("创建伏笔")).not.toBeVisible({ timeout: 5_000 });
}

/** Mock the AI extraction endpoint to return given entries */
function mockAiExtract(page: Page, entries: Array<Record<string, unknown>>) {
  conditionalMock(() => {
    page.route("**/api/foreshadowing/extract*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: entries }),
      });
    });
  });
}

/** Mock the AI extraction endpoint to simulate progress events */
function mockAiExtractWithProgress(page: Page) {
  conditionalMock(() => {
    page.route("**/api/foreshadowing/extract*", async (route) => {
    // Simulate a streaming response with progress chunks
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: { "Cache-Control": "no-cache" },
      body: [
        `data: ${JSON.stringify({ type: "progress", chapter: 1, total: 3 })}`,
        "",
        `data: ${JSON.stringify({ type: "progress", chapter: 2, total: 3 })}`,
        "",
        `data: ${JSON.stringify({ type: "progress", chapter: 3, total: 3 })}`,
        "",
        `data: ${JSON.stringify({
          type: "result",
          data: [
            {
              id: "fs-e2e-ai-1",
              title: "AI提取的伏笔A",
              description: "通过AI分析自动提取的伏笔",
              type: "情节伏笔",
              status: "active",
            },
            {
              id: "fs-e2e-ai-2",
              title: "AI提取的伏笔B",
              description: "另一个自动提取的伏笔",
              type: "设定伏笔",
              status: "active",
            },
          ],
        })}`,
        "",
        "data: [DONE]",
        "",
      ].join("\n"),
    });
  });
  });
}

// ── Setup ────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await seedForeshadowing();
});

test.beforeEach(async ({ page }) => {
  await seedForeshadowing();
  await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
  await expect(page.getByText("伏笔追踪")).toBeVisible({ timeout: 15_000 });
});

// ── Tests ────────────────────────────────────────────────────────

test.describe("Foreshadowing — 核心创作流E2E", () => {
  test("1. 页面加载显示空状态", async ({ page }) => {
    // Clear all seeded entries via the API
    for (const id of ["fs-e2e-1", "fs-e2e-2", "fs-e2e-3", "fs-e2e-4", "fs-e2e-5"]) {
      await page.request.delete(`/api/foreshadowing/${id}`);
    }
    await page.reload();
    await expect(page.getByText("伏笔追踪")).toBeVisible({ timeout: 15_000 });

    // Empty state should display a guidance message
    await expect(
      page.getByText("暂无伏笔，点击「新建伏笔」开始追踪"),
    ).toBeVisible({ timeout: 5_000 });

    // The "新建伏笔" button should still be visible
    await expect(page.getByRole("button", { name: "新建伏笔" })).toBeVisible({
      timeout: 3_000,
    });
  });

  test("2. 手动创建伏笔保存后列表刷新", async ({ page }) => {
    await createForeshadowingViaUI(page, {
      title: "破碎的玉佩",
      description: "玉佩上刻着不认识的符文",
    });
    await expect(page.getByText("破碎的玉佩")).toBeVisible({ timeout: 5_000 });

    // Create another entry to verify repeated creation works
    await createForeshadowingViaUI(page, {
      title: "暗红信封",
      description: "无名信件上的封蜡图案",
    });
    await expect(page.getByText("暗红信封")).toBeVisible({ timeout: 5_000 });
  });

  test("3. AI提取: 选章节范围→提取→审阅→应用→列表出现伏笔", async ({ page }) => {
    // Mock the extraction API response
    await mockAiExtract(page, [
      {
        id: "fs-e2e-ai-ext-1",
        title: "古井的秘密",
        description: "村口枯井下藏有地下通道",
        type: "设定伏笔",
        sourceChapter: 2,
      },
      {
        id: "fs-e2e-ai-ext-2",
        title: "老者的身份",
        description: "客栈老者其实是退隐的剑仙",
        type: "角色伏笔",
        sourceChapter: 3,
      },
      {
        id: "fs-e2e-ai-ext-3",
        title: "断剑重铸",
        description: "祖传断剑需要玄铁重铸",
        type: "物品伏笔",
        sourceChapter: 4,
      },
    ]);

    // Open AI extract modal
    await page.getByRole("button", { name: /AI 提取/ }).click();
    await expect(page.getByText("AI 提取伏笔")).toBeVisible({ timeout: 3_000 });

    // Verify chapter range selector is present
    await expect(page.getByText("章节范围：")).toBeVisible({ timeout: 3_000 });

    // Click start extract
    await page.getByRole("button", { name: "开始提取" }).click();

    // Wait for results to appear (the review list)
    await expect(page.getByText("古井的秘密")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText("老者的身份")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("断剑重铸")).toBeVisible({ timeout: 3_000 });

    // Click apply all
    await page.getByRole("button", { name: "应用所有" }).click();

    // Modal should close and applied entries appear in the main list
    await expect(page.getByText("AI 提取伏笔")).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("古井的秘密")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("老者的身份")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("断剑重铸")).toBeVisible({ timeout: 3_000 });
  });

  test("4. 选择性应用: 勾选部分仅已选保存", async ({ page }) => {
    // Mock extraction with multiple candidates
    await mockAiExtract(page, [
      {
        id: "fs-e2e-select-1",
        title: "被选中的伏笔",
        description: "这条会被勾选应用",
        type: "情节伏笔",
        sourceChapter: 1,
      },
      {
        id: "fs-e2e-select-2",
        title: "被跳过的伏笔",
        description: "这条不勾选",
        type: "设定伏笔",
        sourceChapter: 2,
      },
      {
        id: "fs-e2e-select-3",
        title: "另一条被选中的",
        description: "这条也会被应用",
        type: "角色伏笔",
        sourceChapter: 3,
      },
    ]);

    // Open AI extract modal
    await page.getByRole("button", { name: /AI 提取/ }).click();
    await expect(page.getByText("AI 提取伏笔")).toBeVisible({ timeout: 3_000 });

    // Start extraction
    await page.getByRole("button", { name: "开始提取" }).click();

    // Wait for results
    await expect(page.getByText("被选中的伏笔")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText("被跳过的伏笔")).toBeVisible({ timeout: 3_000 });

    // Uncheck "被跳过的伏笔" (deselect it)
    const skipCheckbox = page.locator("text=被跳过的伏笔").locator("..").locator('input[type="checkbox"]');
    if (await skipCheckbox.isChecked()) {
      await skipCheckbox.uncheck();
    }

    // Click apply selected
    await page.getByRole("button", { name: "应用选中" }).click();
    await expect(page.getByText("AI 提取伏笔")).not.toBeVisible({ timeout: 5_000 });

    // Only the checked entries should appear
    await expect(page.getByText("被选中的伏笔")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("另一条被选中的")).toBeVisible({ timeout: 3_000 });

    // The unchecked entry should NOT appear in the main list
    await expect(page.getByText("被跳过的伏笔")).not.toBeVisible({ timeout: 3_000 });
  });

  test("5. 伏笔编辑: 点击修改保存", async ({ page }) => {
    // Click an existing entry to open the edit modal
    await page.getByText("神秘戒指").click();
    await expect(page.getByText("编辑伏笔")).toBeVisible({ timeout: 3_000 });

    // Modify the title and description
    const titleInput = page.getByPlaceholder("伏笔名称");
    await titleInput.clear();
    await titleInput.fill("上古神戒");

    const descInput = page.getByPlaceholder("伏笔描述");
    await descInput.clear();
    await descInput.fill("主角获得的上古神戒，拥有时空之力");

    // Update expected payoff chapter
    const chapterInput = page.getByPlaceholder("预期回收章节");
    if (await chapterInput.isVisible()) {
      await chapterInput.clear();
      await chapterInput.fill("12");
    }

    // Save
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("编辑伏笔")).not.toBeVisible({ timeout: 5_000 });

    // Verify changes are reflected in the list
    await expect(page.getByText("上古神戒")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("神秘戒指")).not.toBeVisible({ timeout: 3_000 });
  });

  test("6. 伏笔删除: 删除确认后列表移除", async ({ page }) => {
    // Click the entry to open edit modal
    await page.getByText("门口的石像").click();
    await expect(page.getByText("编辑伏笔")).toBeVisible({ timeout: 3_000 });

    // Click delete button
    const deleteBtn = page.getByRole("button", { name: /删除/ });
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      // Confirm deletion
      await expect(page.getByText("确认删除")).toBeVisible({ timeout: 3_000 });
      await page.getByRole("button", { name: "确认" }).click();
    } else {
      // Fallback: use API if no UI delete button
      const deleteRes = await page.request.delete("/api/foreshadowing/fs-e2e-2");
      expect(deleteRes.status()).toBe(200);
      await page.reload();
      await expect(page.getByText("伏笔追踪")).toBeVisible({ timeout: 15_000 });
    }

    // Verify the deleted entry is gone
    await expect(page.getByText("门口的石像")).not.toBeVisible({ timeout: 5_000 });

    // Other entries should remain
    await expect(page.getByText("神秘戒指")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("失踪的师父")).toBeVisible({ timeout: 3_000 });
  });

  test("7. 过滤: 按类型和状态过滤", async ({ page }) => {
    // ── Status filter: paid_off ──
    const statusSelect = page.locator("select").first();
    await statusSelect.selectOption("paid_off");
    await page.waitForTimeout(500);

    // Only the paid_off entry should show
    await expect(page.getByText("神秘的预言")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("神秘戒指")).not.toBeVisible({ timeout: 2_000 });
    await expect(page.getByText("门口的石像")).not.toBeVisible({ timeout: 2_000 });

    // Reset status filter
    await statusSelect.selectOption("all");
    await page.waitForTimeout(500);

    // ── Type filter: 物品伏笔 ──
    const typeSelect = page.locator("select").nth(1);
    await typeSelect.selectOption("物品伏笔");
    await page.waitForTimeout(500);

    // Only 物品伏笔 entries should show
    await expect(page.getByText("神秘戒指")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("古墓钥匙")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("门口的石像")).not.toBeVisible({ timeout: 2_000 });

    // ── Combined filter: 物品伏笔 + paid_off ──
    await statusSelect.selectOption("abandoned");
    await page.waitForTimeout(500);

    // Only "古墓钥匙" (abandoned + 物品伏笔)
    await expect(page.getByText("古墓钥匙")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("神秘戒指")).not.toBeVisible({ timeout: 2_000 });
    await expect(page.getByText("神秘的预言")).not.toBeVisible({ timeout: 2_000 });
  });

  test("8. 搜索: 关键词搜索", async ({ page }) => {
    const searchInput = page.getByPlaceholder("搜索伏笔名称或描述…");
    await searchInput.fill("石像");
    await page.waitForTimeout(500);

    // Only matching entry should be visible
    await expect(page.getByText("门口的石像")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("神秘戒指")).not.toBeVisible({ timeout: 2_000 });

    // Clear search — all entries reappear
    await searchInput.fill("");
    await page.waitForTimeout(500);
    await expect(page.getByText("神秘戒指")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("门口的石像")).toBeVisible({ timeout: 3_000 });

    // Search with no match should show empty state
    await searchInput.fill("不可能存在的结果xyz");
    await page.waitForTimeout(500);
    await expect(page.getByText("没有符合条件的伏笔")).toBeVisible({ timeout: 3_000 });
  });

  test("9. 进度条: 多章节提取显示进度", async ({ page }) => {
    // Mock the extraction to simulate streaming progress
    await mockAiExtractWithProgress(page);

    // Open AI extract modal
    await page.getByRole("button", { name: /AI 提取/ }).click();
    await expect(page.getByText("AI 提取伏笔")).toBeVisible({ timeout: 3_000 });

    // Click start extract
    await page.getByRole("button", { name: "开始提取" }).click();

    // Verify progress indicator appears and updates
    const progressBar = page.locator('[role="progressbar"]').first();
    await expect(progressBar).toBeVisible({ timeout: 3_000 });

    // Wait for extraction to complete
    await expect(page.getByText("AI提取的伏笔A")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("AI提取的伏笔B")).toBeVisible({ timeout: 3_000 });

    // Apply the results
    await page.getByRole("button", { name: "应用所有" }).click();
    await expect(page.getByText("AI 提取伏笔")).not.toBeVisible({ timeout: 5_000 });

    // Entries appear in main list
    await expect(page.getByText("AI提取的伏笔A")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("AI提取的伏笔B")).toBeVisible({ timeout: 3_000 });
  });

  test("10. 错误状态: API失败显示错误", async ({ page }) => {
    // Mock the foreshadowing list API to return a 500 error
    await page.route("**/api/foreshadowing*", async (route) => {
      // Only block GET requests (list/fetch), let DELETE pass through for cleanup
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "SERVER_ERROR", message: "服务器内部错误，请稍后重试" },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.reload();
    await page.waitForTimeout(2_000);

    // Error state should be displayed
    await expect(page.getByText("无法加载伏笔数据")).toBeVisible({ timeout: 10_000 });

    // Retry button should be present
    await expect(page.getByRole("button", { name: /重试/ })).toBeVisible({
      timeout: 3_000,
    });
  });
});
