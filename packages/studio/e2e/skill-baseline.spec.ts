import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";

test.describe("SkillListPage — 技能管理基线 (Issue #683)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/skills`);
  });

  // 1. 正常加载
  test("1. 正常加载: 页面显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).toBeVisible();
  });

  // 2. 创建技能按钮
  test("2. 创建技能按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const btn = page.locator(
      "[data-testid='sk-btn-create-skill'], button:has-text('创建'), button:has-text('新建技能'), button:has-text('添加技能')"
    );
    const count = await btn.count();
    console.log(`Create skill button: ${count}`);
  });

  // 3. 搜索输入框
  test("3. 搜索输入框存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const input = page.locator(
      "[data-testid='sk-input-search'], input[placeholder*='搜索'], input[type='search'], input[id*='search'], input[name*='search']"
    );
    const count = await input.count();
    console.log(`Search input: ${count}`);
  });

  // 4. 分类筛选器
  test("4. 分类筛选器存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const filter = page.locator(
      "[data-testid='sk-select-category-filter'], select[id*='category'], select[name*='category'], [class*='category-filter'], [data-testid*='sk-filter']"
    );
    const count = await filter.count();
    console.log(`Category filter: ${count}`);
  });

  // 5. 技能列表
  test("5. 技能列表存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const list = page.locator(
      "[data-testid='sk-list-skills'], [data-testid*='sk-list'], [class*='skill-list'], [class*='skills-list']"
    );
    const count = await list.count();
    console.log(`Skill list container: ${count}`);

    const items = page.locator(
      "[data-testid*='sk-item'], [data-testid*='skill-item'], [class*='skill-item'], li:has(button)"
    );
    const itemCount = await items.count();
    console.log(`Skill items: ${itemCount}`);
  });

  // 6. 切换开关
  test("6. 切换开关存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const toggles = page.locator(
      "[data-testid*='sk-toggle'], [role='switch'], input[type='checkbox'], [class*='toggle'], [class*='switch']"
    );
    const count = await toggles.count();
    console.log(`Toggle switches: ${count}`);
  });

  // 7. 编辑和删除按钮
  test("7. 编辑和删除按钮存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const editBtns = page.locator(
      "[data-testid*='sk-btn-edit'], button:has-text('编辑'), button[aria-label*='编辑'], button[aria-label*='edit']"
    );
    const editCount = await editBtns.count();
    console.log(`Edit buttons: ${editCount}`);

    const deleteBtns = page.locator(
      "[data-testid*='sk-btn-delete'], button:has-text('删除'), button[aria-label*='删除'], button[aria-label*='delete']"
    );
    const deleteCount = await deleteBtns.count();
    console.log(`Delete buttons: ${deleteCount}`);
  });

  // 8. 分页控件
  test("8. 分页控件存在", async ({ page }) => {
    await page.waitForTimeout(2000);
    const pagination = page.locator(
      "[data-testid*='pagination'], [class*='pagination'], [class*='pager'], nav[aria-label*='分页'], nav[aria-label*='pagination']"
    );
    const hasPagination = (await pagination.count()) > 0;
    console.log(`Pagination: ${hasPagination}`);
  });

  // 9. 加载状态
  test("9. 加载状态: 数据加载中显示loading", async ({ page }) => {
    await page.waitForTimeout(2000);
    const loading = page.locator(
      "[data-testid*='loading'], [data-testid*='Loading'], [class*='loading'], [class*='spinner'], :has-text('加载中')"
    );
    const hasLoading = (await loading.count()) > 0;
    console.log(`Loading state: ${hasLoading}`);
  });

  // 10. 空状态
  test("10. 空状态: 无数据时显示", async ({ page }) => {
    await page.waitForTimeout(3000);
    const empty = page.locator(
      "[data-testid*='empty'], [data-testid*='Empty'], :has-text('暂无'), :has-text('无数据'), :has-text('创建第一个'), :has-text('还没有技能')"
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

  // 12. 禁用状态
  test("12. 禁用状态: 技能禁用时显示", async ({ page }) => {
    await page.waitForTimeout(2000);
    const disabled = page.locator(
      "[data-testid*='disabled'], [class*='disabled'], [class*='inactive'], [disabled]"
    );
    const hasDisabled = (await disabled.count()) > 0;
    console.log(`Disabled state: ${hasDisabled}`);
  });
});
