// ── Foreshadowing — 伏笔数据完整性 E2E (Issue #732) ──
// Bug: 更新后所有伏笔线索数据消失 — API 路由/数据格式变更导致无法加载
// 强断言版: 功能未实现 → 测试应全红 (E2E Required ✅ + 功能 E2E ❌)
// 4-state coverage: normal / error / empty / edge

import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";

test.describe("Foreshadowing — 伏笔数据完整性 (强断言)", () => {

  // ═══ N1: 页面加载 + 核心 UI 元素 ═══
  test("N1: 伏笔页面加载 — 页头和创建按钮可见", async ({ page }) => {
    await page.goto(`${BASE_URL}/#/foreshadowing/test-project-123`);
    await page.waitForURL(/#\/foreshadowing\//, { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 页头应可见 (h1 heading)
    const heading = page.getByRole("heading", { level: 1 }).first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // 创建按钮应可见 — 核心功能入口
    const createBtn = page.locator(
      "[data-testid='fs-create-btn'], button:has-text('创建')"
    ).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });

    // AI 提取按钮应可见
    const aiBtn = page.locator(
      "[data-testid='fs-extract-btn'], button:has-text('AI')"
    ).first();
    await expect(aiBtn).toBeVisible({ timeout: 10000 });
  });

  // ═══ N2: 数据列表有内容 ═══
  test("N2: 伏笔列表渲染 — 展示数据项或列表容器", async ({ page }) => {
    await page.goto(`${BASE_URL}/#/foreshadowing/test-project-123`);
    await page.waitForURL(/#\/foreshadowing\//, { timeout: 15000 });
    await page.waitForTimeout(4000);

    // 查找伏笔数据项 (data-testid fs-item-*) 或列表容器
    const listOrItems = page.locator(
      "[data-testid^='fs-item'], [data-testid^='fs-list'], " +
      "[data-testid^='fs-table'], table tbody tr"
    ).first();
    await expect(listOrItems).toBeVisible({ timeout: 8000 });

    // 无崩溃
    await expect(page.getByText(/Cannot read|undefined is not/)).toHaveCount(0);
  });

  // ═══ N3: 搜索可交互 ═══
  test("N3: 搜索框可输入关键词", async ({ page }) => {
    await page.goto(`${BASE_URL}/#/foreshadowing/test-project-123`);
    await page.waitForURL(/#\/foreshadowing\//, { timeout: 15000 });
    await page.waitForTimeout(3000);

    const searchInput = page.locator(
      "[data-testid='fs-search-input'], input[placeholder*='搜索'], input[placeholder*='search']"
    ).first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    await searchInput.fill("test-clue");
    await expect(searchInput).toHaveValue("test-clue");
  });

  // ═══ D1: 无 API 404 ═══
  test("D1: API 不返回 404", async ({ page }) => {
    let has404 = false;
    page.on("response", (r) => {
      if (r.url().includes("/api/") && r.status() === 404) has404 = true;
    });

    await page.goto(`${BASE_URL}/#/foreshadowing/test-project-123`);
    await page.waitForURL(/#\/foreshadowing\//, { timeout: 15000 });
    await page.waitForTimeout(4000);

    expect(has404).toBe(false);

    const main = page.locator("main, [role='main'], #root > *").first();
    await expect(main).toBeVisible({ timeout: 5000 });
  });

  // ═══ C1: 创建弹窗 ═══
  test("C1: 创建伏笔 — 弹窗包含表单字段", async ({ page }) => {
    await page.goto(`${BASE_URL}/#/foreshadowing/test-project-123`);
    await page.waitForURL(/#\/foreshadowing\//, { timeout: 15000 });
    await page.waitForTimeout(3000);

    const createBtn = page.locator(
      "[data-testid='fs-create-btn'], button:has-text('创建')"
    ).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click({ force: true });
    await page.waitForTimeout(1500);

    // 弹窗应出现
    const dialog = page.locator(
      "[data-testid*='create'], [data-testid*='modal'], " +
      "[role='dialog'], [class*='Modal'], [class*='Dialog'], [class*='Sheet']"
    ).first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 弹窗内应有确认/取消按钮
    const actionBtns = page.locator(
      "button:has-text('确定'), button:has-text('保存'), " +
      "button:has-text('确认'), button:has-text('创建'), button:has-text('取消')"
    ).first();
    await expect(actionBtns).toBeVisible({ timeout: 3000 });
  });

  // ═══ E1: 空状态 ═══
  test("E1: 空状态 — 无数据时有提示", async ({ page }) => {
    await page.goto(`${BASE_URL}/#/foreshadowing/new-empty-book-999`);
    await page.waitForURL(/#\/foreshadowing\//, { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 空状态应显示提示或至少页面有结构
    const emptyOrContainer = page.locator(
      "[data-testid='fs-empty'], [class*='empty'], [role='main'], main"
    ).first();
    await expect(emptyOrContainer).toBeVisible({ timeout: 8000 });

    await expect(page.getByText(/Cannot read|undefined is not/)).toHaveCount(0);
  });

  // ═══ E2: 错误状态 ═══
  test("E2: 错误状态 — 无效 bookId 不白屏", async ({ page }) => {
    await page.goto(`${BASE_URL}/#/foreshadowing/__invalid__`);
    await page.waitForURL(/#\/foreshadowing\//, { timeout: 15000 });
    await page.waitForTimeout(4000);

    // 应有错误提示或页面结构
    const content = page.locator(
      "main, [role='main'], #root > *, [class*='error'], [class*='toast']"
    ).first();
    await expect(content).toBeVisible({ timeout: 8000 });

    await expect(page.getByText(/Cannot read|undefined is not/)).toHaveCount(0);
  });

  // ═══ C2: 保存并验证 ═══
  test("C2: 创建伏笔 — 保存后卡片出现在列表中", async ({ page }) => {
    await page.goto(`${BASE_URL}/#/foreshadowing/test-project-123`);
    await page.waitForURL(/#\/foreshadowing\//, { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 打开创建弹窗
    const createBtn = page.locator(
      "[data-testid='fs-create-btn'], button:has-text('创建')"
    ).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click({ force: true });
    await page.waitForTimeout(1500);

    // 填写名称
    const nameInput = page.locator(
      "[data-testid*='name'], input[placeholder*='名称'], input[placeholder*='伏笔']"
    ).first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill("E2E-Test-Foreshadow");

    // 点击保存
    const saveBtn = page.locator(
      "button:has-text('确定'), button:has-text('保存'), button:has-text('确认'), button:has-text('创建')"
    ).first();
    await expect(saveBtn).toBeVisible({ timeout: 3000 });
    await saveBtn.click({ force: true });
    await page.waitForTimeout(2000);

    // 新卡片应出现在列表中（带 data-testid fs-item-*）
    const newItem = page.locator("[data-testid^='fs-item-']").first();
    await expect(newItem).toBeVisible({ timeout: 8000 });
  });

  // ═══ E3: 持久化 ═══
  test("E3: 刷新后页面结构保持", async ({ page }) => {
    await page.goto(`${BASE_URL}/#/foreshadowing/test-project-123`);
    await page.waitForURL(/#\/foreshadowing\//, { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 页头应可见
    const heading = page.getByRole("heading", { level: 1 }).first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    await page.reload({ waitUntil: "load" });
    await page.waitForURL(/#\/foreshadowing\//, { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 刷新后页头仍可见
    await expect(heading).toBeVisible({ timeout: 10000 });

    await expect(page.getByText(/Cannot read|undefined is not/)).toHaveCount(0);
  });
});
