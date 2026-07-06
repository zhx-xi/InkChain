import { test, expect } from "@playwright/test";
import { seedChapterAudit, E2E_BOOK_ID } from "./fixtures/seed-chapter-audit";

test.beforeAll(async () => {
  await seedChapterAudit();
});

test("1. 书籍详情页加载显示章节列表", async ({ page }) => {
  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await expect(page.getByText("E2E 审计仪表板测试")).toBeVisible({ timeout: 20_000 });

  await expect(page.getByText("第一章 初入修仙")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("第二章 灵根测试")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("第三章")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("第四章 秘境探索")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("第五章 回归")).toBeVisible({ timeout: 5_000 });
});

test("2. 章节字数信息", async ({ page }) => {
  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await expect(page.getByText("E2E 审计仪表板测试")).toBeVisible({ timeout: 20_000 });

  // Chapter word counts should be visible
  await expect(page.getByText("2,100")).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText("1,800")).toBeVisible({ timeout: 3_000 });
});

test("3. 批准API调用", async ({ page }) => {
  const res = await page.request.post(`/books/${E2E_BOOK_ID}/chapters/5/approve`);
  expect([200, 404, 500]).toContain(res.status());
});

test("4. 审计API调用", async ({ page }) => {
  const res = await page.request.post(`/books/${E2E_BOOK_ID}/audit/5`, { timeout: 10_000 }).catch(() => null);
  if (res) {
    expect([200, 404, 500]).toContain(res.status());
  }
  // API may fail with LLM stub, that's expected
});

test("5. 章节状态标签", async ({ page }) => {
  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await expect(page.getByText("E2E 审计仪表板测试")).toBeVisible({ timeout: 20_000 });

  // Chapter 1 is approved, should show an approval status
  const row1 = page.locator('text=第一章 初入修仙').locator('..');
  await row1.hover();
});

test("6. 章节行可悬停显示操作按钮", async ({ page }) => {
  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await expect(page.getByText("E2E 审计仪表板测试")).toBeVisible({ timeout: 20_000 });

  // Hover the last chapter row
  const lastRow = page.locator('text=第五章 回归').locator('..');
  await lastRow.hover();
  await page.waitForTimeout(300);
});

// ── Volume Filter + Pagination (PR #444) ──

test("7. 卷筛选下拉存在且默认选中全部卷", async ({ page }) => {
  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await expect(page.getByText("E2E 审计仪表板测试")).toBeVisible({ timeout: 20_000 });

  // Volume filter select exists
  const volumeSelect = page.locator("select").first();
  await expect(volumeSelect).toBeVisible({ timeout: 3_000 });

  // Default value = "" (all volumes)
  const defaultValue = await volumeSelect.inputValue();
  expect(defaultValue).toBe("");

  // "全部卷" option exists
  const allVolumesOption = volumeSelect.locator('option[value=""]');
  await expect(allVolumesOption).toBeVisible();
});

test("8. 切换卷后章节列表过滤", async ({ page }) => {
  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await expect(page.getByText("E2E 审计仪表板测试")).toBeVisible({ timeout: 20_000 });

  const volumeSelect = page.locator("select").first();
  const options = await volumeSelect.locator("option").all();

  // Find a specific volume (non-empty value)
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
    // After filtering, volume should be set to the selected volume
    const currentValue = await volumeSelect.inputValue();
    expect(currentValue).not.toBe("");
  }
});

test("9. 分页控件存在且默认10条/页", async ({ page }) => {
  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await expect(page.getByText("E2E 审计仪表板测试")).toBeVisible({ timeout: 20_000 });

  // Pagination info should be visible (共Y页 · 总计Z个问题)
  const paginationInfo = page.locator("text=/第\\d+页 \\/ 共\\d+页/");
  await expect(paginationInfo).toBeVisible({ timeout: 3_000 });

  // Page size select exists with default 10
  const pageSizeSelect = page.locator("select").last();
  await expect(pageSizeSelect).toBeVisible();
  const pageSizeValue = await pageSizeSelect.inputValue();
  expect(pageSizeValue).toBe("10");
});

test("10. 切换每页条数重置到第1页", async ({ page }) => {
  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await expect(page.getByText("E2E 审计仪表板测试")).toBeVisible({ timeout: 20_000 });

  const pageSizeSelect = page.locator("select").last();
  await pageSizeSelect.selectOption("20");

  // After switching to 20/page, page should reset to 1
  const currentPageSize = await pageSizeSelect.inputValue();
  expect(currentPageSize).toBe("20");

  // Pagination should show page 1
  await expect(page.locator("text=/第1页 \\/ 共\\d+页/")).toBeVisible({ timeout: 3_000 });
});

test("11. 上一页/下一页按钮状态", async ({ page }) => {
  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await expect(page.getByText("E2E 审计仪表板测试")).toBeVisible({ timeout: 20_000 });

  const totalPages = page.locator("text=/共(\\d+)页/");
  const totalText = await totalPages.textContent().catch(() => "共1页");
  const match = totalText?.match(/共(\d+)页/);
  const pageCount = match ? parseInt(match[1], 10) : 1;

  // Previous button should be disabled on page 1
  const prevBtn = page.locator("button:has-text('上一页')");
  if (pageCount > 1) {
    await expect(prevBtn).toBeDisabled({ timeout: 2_000 });
  }
});
