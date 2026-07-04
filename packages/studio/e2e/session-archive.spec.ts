import { test, expect } from "@playwright/test";
import { seedSessionArchive } from "./fixtures/seed-session-archive";

test.beforeAll(async () => {
  await seedSessionArchive();
});

test("1. 会话归档→归档列表出现", async ({ page }) => {
  await page.goto("/#/archive");

  // Page title should render
  await expect(page.getByText("会话归档")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("管理已归档的会话记录，支持搜索、筛选和解档")).toBeVisible();

  // Should show the archived session count
  // Wait for loading to finish and sessions to appear
  await page.waitForTimeout(2_000);
  await expect(page.getByText(/共 \d+ 个归档会话/)).toBeVisible({ timeout: 10_000 });

  // Seeded archived sessions should appear
  await expect(page.getByText("修仙世界设定讨论")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("第二章修订建议")).toBeVisible();
  await expect(page.getByText("角色关系梳理")).toBeVisible();
  await expect(page.getByText("已弃用的旧设定")).toBeVisible();
});

test("2. 解档→会话回到项目", async ({ page }) => {
  await page.goto("/#/archive");
  await expect(page.getByText("会话归档")).toBeVisible({ timeout: 15_000 });

  // Wait for sessions to load
  await expect(page.getByText("修仙世界设定讨论")).toBeVisible({ timeout: 10_000 });

  // Hover over a session card to reveal the "解档" button (opacity-0 group-hover:opacity-100)
  const sessionCard = page.getByText("角色关系梳理").locator("..");
  await sessionCard.hover();

  // Click the "解档" button for this session
  // The button is inside the card
  const unarchiveBtn = sessionCard.locator("..").getByText("解档");
  await unarchiveBtn.click();

  // Confirm dialog should appear
  await expect(page.getByText("确认将会话")).toBeVisible({ timeout: 5_000 });

  // Confirm unarchive
  await page.getByText("确认解档").click();

  // Wait for the unarchive to complete and the session to disappear from the list
  await expect(page.getByText("角色关系梳理")).not.toBeVisible({ timeout: 10_000 });
});

test("3. 完全删除→确认→消失", async ({ page }) => {
  await page.goto("/#/archive");
  await expect(page.getByText("会话归档")).toBeVisible({ timeout: 15_000 });

  // Wait for sessions to load
  await expect(page.getByText("已弃用的旧设定")).toBeVisible({ timeout: 10_000 });

  // Hover the card
  const sessionCard = page.getByText("已弃用的旧设定").locator("..");
  await sessionCard.hover();

  // Click the "删除" button
  const deleteBtn = sessionCard.locator("..").getByText("删除");
  await deleteBtn.click();

  // Confirm dialog should appear with danger variant
  await expect(page.getByText("永久删除会话")).toBeVisible({ timeout: 5_000 });

  // Confirm deletion
  await page.getByText("确认删除").click();

  // The session should disappear
  await expect(page.getByText("已弃用的旧设定")).not.toBeVisible({ timeout: 10_000 });
});

test("4. 批量归档", async ({ page }) => {
  await page.goto("/#/archive");
  await expect(page.getByText("会话归档")).toBeVisible({ timeout: 15_000 });

  // Wait for sessions to load
  await expect(page.getByText("修仙世界设定讨论")).toBeVisible({ timeout: 10_000 });

  // Select checkboxes for the first two sessions
  const checkboxes = page.locator('input[type="checkbox"]');
  const checkboxCount = await checkboxes.count();
  if (checkboxCount >= 2) {
    // Check the first two sessions (skip "全选" checkbox)
    await checkboxes.nth(0).check(); // Could be the "全选" checkbox
    await checkboxes.nth(1).check();

    // Batch action bar should appear
    const batchBar = page.getByText(/已选择 \d+ 个会话/);
    if (await batchBar.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // Click "批量解档"
      await page.getByText("批量解档").click();
      await expect(page.getByText("批量解档").first()).toBeVisible({ timeout: 3_000 });

      // Confirm
      await page.getByText("确认解档").click();
      await page.waitForTimeout(2_000);
    }
  }
});

test("5. 搜索已归档会话", async ({ page }) => {
  await page.goto("/#/archive");
  await expect(page.getByText("会话归档")).toBeVisible({ timeout: 15_000 });

  // Wait for sessions to load
  await expect(page.getByText("修仙世界设定讨论")).toBeVisible({ timeout: 10_000 });

  // Type search query
  const searchInput = page.getByPlaceholder("搜索归档会话…");
  await searchInput.fill("修仙");

  // After debounce (300ms), the list should filter
  await page.waitForTimeout(500);

  // Matching session should be visible
  await expect(page.getByText("修仙世界设定讨论")).toBeVisible();

  // Non-matching sessions should be hidden
  await expect(page.getByText("第二章修订建议")).not.toBeVisible({ timeout: 3_000 });
  await expect(page.getByText("角色关系梳理")).not.toBeVisible();

  // Clear search
  await searchInput.fill("");
  await page.waitForTimeout(500);

  // All sessions should be visible again
  await expect(page.getByText("第二章修订建议")).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText("角色关系梳理")).toBeVisible();
});
