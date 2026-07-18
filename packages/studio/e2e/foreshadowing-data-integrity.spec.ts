// 鈹€鈹€ Foreshadowing 鈥?浼忕瑪鏁版嵁瀹屾暣鎬?E2E (Issue #732) 鈹€鈹€
// Bug: 鏇存柊鍚庢墍鏈変紡绗旂嚎绱㈡暟鎹秷澶?鈥?API 璺敱/鏁版嵁鏍煎紡鍙樻洿瀵艰嚧鏃犳硶鍔犺浇
// 寮烘柇瑷€鐗? 鍔熻兘鏈疄鐜?鈫?娴嬭瘯搴斿叏绾?(E2E Required 鉁?+ 鍔熻兘 E2E 鉂?
// 4-state coverage: normal / error / empty / edge

import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";

test.describe("Foreshadowing 鈥?浼忕瑪鏁版嵁瀹屾暣鎬?(寮烘柇瑷€)", () => {

  // 鈺愨晲鈺?N1: 椤甸潰鍔犺浇 + 鏍稿績 UI 鍏冪礌 鈺愨晲鈺?  test("N1: 浼忕瑪椤甸潰鍔犺浇 鈥?椤靛ご鍜屽垱寤烘寜閽彲瑙?, async ({ page }) => {
    await page.goto(`${BASE_URL}/#/foreshadowing/test-project-123`);
    await page.waitForURL(/#\/foreshadowing\//, { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 椤靛ご搴斿彲瑙?(h1 heading)
    const heading = page.getByRole("heading", { level: 1 }).first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // 鍒涘缓鎸夐挳搴斿彲瑙?鈥?鏍稿績鍔熻兘鍏ュ彛
    const createBtn = page.locator(
      "[data-testid='fs-create-btn'], button:has-text('鍒涘缓')"
    ).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });

    // AI 鎻愬彇鎸夐挳搴斿彲瑙?    const aiBtn = page.locator(
      "[data-testid='fs-extract-btn'], button:has-text('AI')"
    ).first();
    await expect(aiBtn).toBeVisible({ timeout: 10000 });
  });

  // 鈺愨晲鈺?N2: 鏁版嵁鍒楄〃鏈夊唴瀹?鈺愨晲鈺?  test("N2: 浼忕瑪鍒楄〃娓叉煋 鈥?灞曠ず鏁版嵁椤规垨鍒楄〃瀹瑰櫒", async ({ page }) => {
    await page.goto(`${BASE_URL}/#/foreshadowing/test-project-123`);
    await page.waitForURL(/#\/foreshadowing\//, { timeout: 15000 });
    await page.waitForTimeout(4000);

    // 鏌ユ壘浼忕瑪鏁版嵁椤?(data-testid fs-item-*) 鎴栧垪琛ㄥ鍣?    const listOrItems = page.locator(
      "[data-testid^='fs-item'], [data-testid^='fs-list'], " +
      "[data-testid^='fs-table'], table tbody tr"
    ).first();
    await expect(listOrItems).toBeVisible({ timeout: 8000 });

    // 鏃犲穿婧?    await expect(page.getByText(/Cannot read|undefined is not/)).toHaveCount(0);
  });

  // 鈺愨晲鈺?N3: 鎼滅储鍙氦浜?鈺愨晲鈺?  test("N3: 鎼滅储妗嗗彲杈撳叆鍏抽敭璇?, async ({ page }) => {
    await page.goto(`${BASE_URL}/#/foreshadowing/test-project-123`);
    await page.waitForURL(/#\/foreshadowing\//, { timeout: 15000 });
    await page.waitForTimeout(3000);

    const searchInput = page.locator(
      "[data-testid='fs-search-input'], input[placeholder*='鎼滅储'], input[placeholder*='search']"
    ).first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    await searchInput.fill("test-clue");
    await expect(searchInput).toHaveValue("test-clue");
  });

  // 鈺愨晲鈺?D1: 鏃?API 404 鈺愨晲鈺?  test("D1: API 涓嶈繑鍥?404", async ({ page }) => {
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

  // 鈺愨晲鈺?C1: 鍒涘缓寮圭獥 鈺愨晲鈺?  test("C1: 鍒涘缓浼忕瑪 鈥?寮圭獥鍖呭惈琛ㄥ崟瀛楁", async ({ page }) => {
    await page.goto(`${BASE_URL}/#/foreshadowing/test-project-123`);
    await page.waitForURL(/#\/foreshadowing\//, { timeout: 15000 });
    await page.waitForTimeout(3000);

    const createBtn = page.locator(
      "[data-testid='fs-create-btn'], button:has-text('鍒涘缓')"
    ).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click({ force: true });
    await page.waitForTimeout(1500);

    // 寮圭獥搴斿嚭鐜?    const dialog = page.locator(
      "[data-testid*='create'], [data-testid*='modal'], " +
      "[role='dialog'], [class*='Modal'], [class*='Dialog'], [class*='Sheet']"
    ).first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 寮圭獥鍐呭簲鏈夌‘璁?鍙栨秷鎸夐挳
    const actionBtns = page.locator(
      "button:has-text('纭畾'), button:has-text('淇濆瓨'), " +
      "button:has-text('纭'), button:has-text('鍒涘缓'), button:has-text('鍙栨秷')"
    ).first();
    await expect(actionBtns).toBeVisible({ timeout: 3000 });
  });

  // 鈺愨晲鈺?E1: 绌虹姸鎬?鈺愨晲鈺?  test("E1: 绌虹姸鎬?鈥?鏃犳暟鎹椂鏈夋彁绀?, async ({ page }) => {
    await page.goto(`${BASE_URL}/#/foreshadowing/new-empty-book-999`);
    await page.waitForURL(/#\/foreshadowing\//, { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 绌虹姸鎬佸簲鏄剧ず鎻愮ず鎴栬嚦灏戦〉闈㈡湁缁撴瀯
    const emptyOrContainer = page.locator(
      "[data-testid='fs-empty'], [class*='empty'], [role='main'], main"
    ).first();
    await expect(emptyOrContainer).toBeVisible({ timeout: 8000 });

    await expect(page.getByText(/Cannot read|undefined is not/)).toHaveCount(0);
  });

  // 鈺愨晲鈺?E2: 閿欒鐘舵€?鈺愨晲鈺?  test("E2: 閿欒鐘舵€?鈥?鏃犳晥 bookId 涓嶇櫧灞?, async ({ page }) => {
    await page.goto(`${BASE_URL}/#/foreshadowing/__invalid__`);
    await page.waitForURL(/#\/foreshadowing\//, { timeout: 15000 });
    await page.waitForTimeout(4000);

    // 搴旀湁閿欒鎻愮ず鎴栭〉闈㈢粨鏋?    const content = page.locator(
      "main, [role='main'], #root > *, [class*='error'], [class*='toast']"
    ).first();
    await expect(content).toBeVisible({ timeout: 8000 });

    await expect(page.getByText(/Cannot read|undefined is not/)).toHaveCount(0);
  });

  // 鈺愨晲鈺?C2: 淇濆瓨骞堕獙璇?鈺愨晲鈺?  test("C2: 鍒涘缓浼忕瑪 鈥?淇濆瓨鍚庡崱鐗囧嚭鐜板湪鍒楄〃涓?, async ({ page }) => {
    await page.goto(`${BASE_URL}/#/foreshadowing/test-project-123`);
    await page.waitForURL(/#\/foreshadowing\//, { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 鎵撳紑鍒涘缓寮圭獥
    const createBtn = page.locator(
      "[data-testid='fs-create-btn'], button:has-text('鍒涘缓')"
    ).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click({ force: true });
    await page.waitForTimeout(1500);

    // 濉啓鍚嶇О
    const nameInput = page.locator(
      "[data-testid*='name'], input[placeholder*='鍚嶇О'], input[placeholder*='浼忕瑪']"
    ).first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill("E2E-Test-Foreshadow");

    // 鐐瑰嚮淇濆瓨
    const saveBtn = page.locator(
      "button:has-text('纭畾'), button:has-text('淇濆瓨'), button:has-text('纭'), button:has-text('鍒涘缓')"
    ).first();
    await expect(saveBtn).toBeVisible({ timeout: 3000 });
    await saveBtn.click({ force: true });
    await page.waitForTimeout(2000);

    // 鏂板崱鐗囧簲鍑虹幇鍦ㄥ垪琛ㄤ腑锛堝甫 data-testid fs-item-*锛?    const newItem = page.locator("[data-testid^='fs-item-']").first();
    await expect(newItem).toBeVisible({ timeout: 8000 });
  });

  // 鈺愨晲鈺?E3: 鎸佷箙鍖?鈺愨晲鈺?  test("E3: 鍒锋柊鍚庨〉闈㈢粨鏋勪繚鎸?, async ({ page }) => {
    await page.goto(`${BASE_URL}/#/foreshadowing/test-project-123`);
    await page.waitForURL(/#\/foreshadowing\//, { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 椤靛ご搴斿彲瑙?    const heading = page.getByRole("heading", { level: 1 }).first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    await page.reload({ waitUntil: "load" });
    await page.waitForURL(/#\/foreshadowing\//, { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 鍒锋柊鍚庨〉澶翠粛鍙
    await expect(heading).toBeVisible({ timeout: 10000 });

    await expect(page.getByText(/Cannot read|undefined is not/)).toHaveCount(0);
  });
});

