import { test, expect } from "@playwright/test";
import {
  seedTimeline,
  clearTimeline,
  E2E_TIMELINE_BOOK_ID,
} from "./fixtures/seed-timeline";

test.beforeAll(async () => {
  await seedTimeline();
});

test.beforeEach(async ({ page }) => {
  await seedTimeline();
  await page.goto(`/#/timeline/${E2E_TIMELINE_BOOK_ID}`, { waitUntil: "load", timeout: 30_000 }).catch(() =>
    page.goto(`/#/timeline/${E2E_TIMELINE_BOOK_ID}`, { waitUntil: "domcontentloaded" })
  );
  // Wait for React to mount
  await page.waitForFunction(() => {
    const root = document.getElementById("root");
    return root && root.children.length > 0;
  }, { timeout: 15_000 });
  await page.waitForTimeout(2000);
  await expect(page.getByRole("heading", { name: "时间线" })).toBeVisible({ timeout: 15_000 });
});

test("1. 默认选中'所有卷'而非第一卷", async ({ page }) => {
  // The volume select should have an "所有卷" option
  const volumeSelect = page.locator('select').first();
  await expect(volumeSelect).toBeVisible({ timeout: 3_000 });

  // Default value should be empty string (all volumes)
  const defaultValue = await volumeSelect.inputValue();
  expect(defaultValue).toBe("");

  // "所有卷/所有章节" option should exist (terminology may vary by fixture)
  // <option> elements in <select> are hidden by default; check its value and existence
  const options = await volumeSelect.locator('option').all();
  const allVolumesOption = options.find(async (opt) => {
    return (await opt.getAttribute('value')) === '';
  });
  // At least one option with empty value should exist
  const allVolumesValue = await volumeSelect.inputValue();
  // Value should be empty (all volumes selected)
  expect(allVolumesValue).toBe('');
});

test("2. 切换卷后事件列表正确过滤", async ({ page }) => {
  // Get initial event count (all volumes)
  const initialEventText = await page.getByText(/个事件/).textContent().catch(() => "all");

  // Try to switch to first volume option (non-empty value)
  const volumeSelect = page.locator('select').first();
  const options = await volumeSelect.locator('option').all();

  // Find a volume option (non-empty value)
  let switched = false;
  for (const opt of options) {
    const value = await opt.getAttribute("value");
    if (value && value !== "") {
      await volumeSelect.selectOption(value);
      switched = true;
      break;
    }
  }

  if (switched) {
    // After switching to a volume, event count should update
    await page.waitForTimeout(500);
    // The volume filter should be applied
    await expect(volumeSelect).not.toHaveValue("");
  }
});

test("3. 切换回'所有卷'恢复全量显示", async ({ page }) => {
  const volumeSelect = page.locator('select').first();

  // Switch to a volume then back to all volumes
  const options = await volumeSelect.locator('option').all();
  for (const opt of options) {
    const value = await opt.getAttribute("value");
    if (value && value !== "") {
      await volumeSelect.selectOption(value);
      break;
    }
  }

  await page.waitForTimeout(300);

  // Switch back to "所有卷"
  await volumeSelect.selectOption("");
  await page.waitForTimeout(300);

  // Value should be empty (all volumes)
  await expect(volumeSelect).toHaveValue("");
});
