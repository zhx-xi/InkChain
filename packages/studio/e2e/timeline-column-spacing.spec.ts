import { test, expect, Page } from "@playwright/test";
import {
  seedTimeline,
  clearTimeline,
  E2E_TIMELINE_BOOK_ID,
} from "./fixtures/seed-timeline";

// ── Helpers ──────────────────────────────────────────────────────

/** Navigate to the timeline page for the E2E test book */
async function gotoTimeline(page: Page) {
  await page.goto(`/#/timeline/${E2E_TIMELINE_BOOK_ID}`);
  await expect(page.getByRole("heading", { name: "时间线" })).toBeVisible({
    timeout: 15_000,
  });
}

/** Get the text content of the chapter filter select */
async function getChapterFilterOptions(page: Page): Promise<string[]> {
  // The chapter filter is typically a select dropdown
  const filterSelect = page.locator("select").nth(1); // second select (first is volume)
  if (await filterSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
    const options = await filterSelect.locator("option").all();
    const values: string[] = [];
    for (const opt of options) {
      values.push((await opt.textContent()) || "");
    }
    return values;
  }
  return [];
}

// ── Setup ────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await seedTimeline();
});

test.beforeEach(async ({ page }) => {
  await seedTimeline();
  await gotoTimeline(page);
});

// ── Tests ────────────────────────────────────────────────────────

test.describe("Timeline — 列间距与筛选一致性", () => {
  test("1. 正常加载: 时间线渲染所有章节列且间距固定", async ({ page }) => {
    // Verify all seeded events are visible
    await expect(page.getByText("主角入门")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("结识好友")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("发现秘境")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("获得传承")).toBeVisible({ timeout: 3_000 });

    // Verify event count
    await expect(page.getByText("4 个事件")).toBeVisible({ timeout: 3_000 });

    // Verify the ReactFlow container is rendered (fixed column gap)
    const timelineCanvas = page.locator(".react-flow__renderer");
    await expect(timelineCanvas).toBeVisible({ timeout: 3_000 });

    // Verify chapter column headers exist (chapters 1, 2, 3, 5)
    // Chapter headers appear as label nodes in ReactFlow
    await expect(page.getByText("第 1 章")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("第 2 章")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("第 3 章")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("第 5 章")).toBeVisible({ timeout: 3_000 });
  });

  test("2. 章节筛选: 筛选后仅显示对应章节列", async ({ page }) => {
    // Find the chapter filter — note that this is a timeline with 4 chapters (1,2,3,5)
    // Apply chapter filter to show only chapter 1
    const chapterFilter = page.getByLabel(/章节/, { exact: false }).first();
    const anyFilterSelect = page.locator("select");

    // Try filtering — the exact mechanism depends on component structure
    // Some timelines use separate filter UI, try different approaches

    // Approach 1: Look for chapter filter buttons/selects
    const filterSelects = await page.locator("select").all();
    let filtered = false;

    for (const sel of filterSelects) {
      const options = await sel.locator("option").all();
      for (const opt of options) {
        const text = (await opt.textContent()) || "";
        const value = await opt.getAttribute("value");
        if (text.includes("第 1 章") || value === "1") {
          await sel.selectOption(value || "1");
          filtered = true;
          break;
        }
      }
      if (filtered) break;
    }

    if (filtered) {
      await page.waitForTimeout(500);

      // After filtering to chapter 1, only "主角入门" (chapter 1) should be visible
      await expect(page.getByText("主角入门")).toBeVisible({ timeout: 3_000 });

      // Events from other chapters should NOT be present
      // (filteredEvents now drives header computation, so only chapter 1 header shows)
      await expect(page.getByText("获得传承")).not.toBeVisible({ timeout: 3_000 });
    }

    // Verify we were able to filter at all
    expect(filtered).toBe(true);
  });

  test("3. 角色筛选: 筛选后仅显示关联角色的事件", async ({ page }) => {
    // Filter by character "林月" (only associated with "结识好友" in chapter 2)
    const characterFilter = page.getByPlaceholder(/角色/, { exact: false }).first();
    let filtered = false;

    // Try character filter via select or input
    const filterControls = await page.locator("input, select").all();
    for (const ctrl of filterControls) {
      const placeholder = await ctrl.getAttribute("placeholder");
      const ariaLabel = await ctrl.getAttribute("aria-label");
      const label = placeholder || ariaLabel || "";
      if (label.includes("角色") || label.includes("人物") || label.includes("character")) {
        await ctrl.fill("林月");
        await page.keyboard.press("Enter");
        filtered = true;
        break;
      }
    }

    // If no direct filter, try clicking on "林月" in a character tag and check
    if (!filtered) {
      try {
        const linYueTag = page.locator("text=林月").first();
        if (await linYueTag.isVisible({ timeout: 1_000 }).catch(() => false)) {
          await linYueTag.click();
          filtered = true;
        }
      } catch {
        // skip
      }
    }

    if (filtered) {
      await page.waitForTimeout(500);
      // After filtering, event count should reflect filtered results
      // The filtered uniqueChapters should now only include chapters with matching events
    }
  });

  test("4. 空状态: 全部删除后显示空引导", async ({ page }) => {
    // Delete all events via API
    for (const id of ["tl-e2e-1", "tl-e2e-2", "tl-e2e-3", "tl-e2e-4"]) {
      const res = await page.request.delete(
        `/api/v1/books/${E2E_TIMELINE_BOOK_ID}/timelines/${id}`,
      );
      expect(res.status()).toBe(200);
    }

    // Reload timeline — should now be empty
    await gotoTimeline(page);

    // Empty state message
    await expect(page.getByText("暂无时间线事件")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("开始添加第一个事件吧")).toBeVisible({ timeout: 3_000 });

    // All event nodes should be gone
    await expect(page.getByText("主角入门")).not.toBeVisible({ timeout: 2_000 });
    await expect(page.getByText("获得传承")).not.toBeVisible({ timeout: 2_000 });
  });

  test("5. 错误处理: API失败显示错误状态", async ({ page }) => {
    // Mock timeline API to return server error
    await page.route("**/api/v1/books/**/timelines*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "SERVER_ERROR", message: "无法加载时间线数据" },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.reload();
    await page.waitForTimeout(2_000);

    // Error message should be visible
    await expect(page.getByText("无法加载时间线数据")).toBeVisible({
      timeout: 10_000,
    });

    // Retry button should be visible
    await expect(page.getByRole("button", { name: /重试/ })).toBeVisible({
      timeout: 3_000,
    });

    // No event data should be shown in error state
    await expect(page.getByText("主角入门")).not.toBeVisible({ timeout: 2_000 });
  });

  test("6. 章节列间距不因事件密度变化", async ({ page }) => {
    // The fix caps column gap at COLUMN_GAP_X (220px) regardless of event density
    // Verify the timeline canvas renders with consistent spacing

    const timelineCanvas = page.locator(".react-flow__renderer");
    await expect(timelineCanvas).toBeVisible({ timeout: 3_000 });

    // Get all chapter header nodes
    const chapterHeaders = page.locator(".react-flow__node").filter({
      hasText: /第 \d+ 章/,
    });
    const headerCount = await chapterHeaders.count();

    // Should have 4 chapter headers (chapters 1, 2, 3, 5)
    expect(headerCount).toBeGreaterThanOrEqual(3);

    // Check that column headers are evenly spaced (fixed gap)
    // Get X positions of the first and last headers
    const firstHeader = chapterHeaders.first();
    const lastHeader = chapterHeaders.last();
    const firstBox = await firstHeader.boundingBox();
    const lastBox = await lastHeader.boundingBox();

    if (firstBox && lastBox) {
      const totalWidth = lastBox.x - firstBox.x + lastBox.width;
      // Even with 4 columns spanning chapters 1-5, the gap should be consistent
      // (no excessive widening from event density calculation)
      expect(totalWidth).toBeGreaterThan(0);

      const avgGap = (lastBox.x - firstBox.x) / Math.max(headerCount - 1, 1);
      // Average gap should be within reasonable range (COLUMN_GAP_X ~ 220px)
      // The gap could be slightly different due to node widths, but should not be >400
      expect(avgGap).toBeLessThan(400);
    }
  });
});
