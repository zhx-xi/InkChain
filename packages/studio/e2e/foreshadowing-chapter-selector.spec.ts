import { test, expect } from "@playwright/test";
import {
  seedForeshadowing,
  E2E_FORES_BOOK_ID,
} from "./fixtures/seed-foreshadowing";
import { seedVolumeDnd } from "./fixtures/seed-volume-dnd";

test.beforeAll(async () => {
  await seedVolumeDnd();
  await seedForeshadowing();
});

test.beforeEach(async ({ page }) => {
  await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
  await expect(page.getByRole("heading", { name: "伏笔追踪" })).toBeVisible({ timeout: 15_000 });
});

test.describe("Foreshadowing — 章节选择器范围 (PR #472 fix)", () => {
  test("1. 章节范围下拉框显示正确的范围 (1-5 共5章)", async ({ page }) => {
    // Open AI extract modal
    await page.getByRole("button", { name: /AI 提取/ }).click();
    await expect(page.getByText("AI 提取伏笔")).toBeVisible({ timeout: 5_000 });

    // Find selects by locating the "章节范围：" label, then the following selects
    const label = page.getByText("章节范围：");
    await expect(label).toBeVisible({ timeout: 3_000 });

    // The two chapter selects are siblings after the label
    // Both are within the flex container with label
    const container = label.locator("..");
    const selects = container.locator("select");
    const count = await selects.count();
    expect(count).toBe(2);

    // Check the options of the first chapter selector (起始章节)
    const fromOptions = await selects.nth(0).locator("option").allTextContents();
    expect(fromOptions.length).toBe(5);
    expect(fromOptions[0].trim()).toBe("第1章");
    expect(fromOptions[4].trim()).toBe("第5章");

    // Check the options of the second chapter selector (结束章节)
    const toOptions = await selects.nth(1).locator("option").allTextContents();
    expect(toOptions.length).toBe(5);
    expect(toOptions[0].trim()).toBe("第1章");
    expect(toOptions[4].trim()).toBe("第5章");
  });

  test("2. 默认选中值应为第1章和第1章", async ({ page }) => {
    await page.getByRole("button", { name: /AI 提取/ }).click();
    await expect(page.getByText("AI 提取伏笔")).toBeVisible({ timeout: 5_000 });

    // Find selects by their position - both are inside the visible modal
    // The second select's options depend on the first select's value
    const label = page.getByText("章节范围：");
    const container = label.locator("..");
    const selects = container.locator("select");

    const fromVal = await selects.nth(0).inputValue();
    expect(fromVal).toBe("1");
    const toVal = await selects.nth(1).inputValue();
    expect(toVal).toBe("1");
  });

  test("3. 章节范围选第2-4章后可正常开始提取", async ({ page }) => {
    await page.getByRole("button", { name: /AI 提取/ }).click();
    await expect(page.getByText("AI 提取伏笔")).toBeVisible({ timeout: 5_000 });

    // Open both select menus by changing their values via JavaScript evaluation
    // to avoid Playwright visibility/interaction issues
    const label = page.getByText("章节范围：");
    const container = label.locator("..");
    const selects = container.locator("select");

    // Set chapter range to 2-4
    await selects.nth(0).selectOption("2");
    await selects.nth(1).selectOption("4");

    // Verify the selection took effect
    const fromVal = await selects.nth(0).inputValue();
    expect(fromVal).toBe("2");
    const toVal = await selects.nth(1).inputValue();
    expect(toVal).toBe("4");

    // The "开始提取" button should be present and enabled
    const extractBtn = page.getByRole("button", { name: "开始提取" });
    await expect(extractBtn).toBeVisible({ timeout: 3_000 });
    await expect(extractBtn).toBeEnabled();
  });
});
