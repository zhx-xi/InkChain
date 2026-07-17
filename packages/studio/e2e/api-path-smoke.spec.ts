// ── API Path Unification Smoke E2E (Issue #736) ──
// Refactoring: unify all API paths to /api/v1/ format
// Smoke tests across affected modules: foreshadowing, world, skills, publish, audit
// Verifies no 404 errors after path migration

import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";

test.describe("API Path Smoke — 跨模块冒烟测试", () => {

  // ─── Foreshadowing (was /api/foreshadowing) ───

  test("S1: 伏笔页面加载 — 无 404", async ({ page }) => {
    await page.goto(`${BASE_URL}/#/book/test-project-123/foreshadowing`, {
      waitUntil: "load",
    });
    await page.waitForTimeout(3000);

    await page.waitForURL(/#\/book\//, { timeout: 10000 });

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    // No crash or 404
    const hasCrash = /(Cannot read|undefined is not|Failed to fetch|404)/.test(bodyText);
    expect(hasCrash).toBeFalsy();
  });

  // ─── World Management (was /api/worlds) ───

  test("S2: 世界页面加载 — 无 404", async ({ page }) => {
    await page.goto(`${BASE_URL}/#/worlds`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    await page.waitForURL(/#\/worlds/, { timeout: 10000 });

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const hasCrash = /(Cannot read|undefined is not|Failed to fetch|404)/.test(bodyText);
    expect(hasCrash).toBeFalsy();
  });

  // ─── Skills Library (was /api/skills) ───

  test("S3: Skill 库页面加载 — 无 404", async ({ page }) => {
    await page.goto(`${BASE_URL}/#/skills`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    await page.waitForURL(/#\/skills/, { timeout: 10000 });

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const hasCrash = /(Cannot read|undefined is not|Failed to fetch|404)/.test(bodyText);
    expect(hasCrash).toBeFalsy();

    // Should show skill list or empty state
    const hasSkillContent =
      (await page.getByText(/skill|技能|创建/i).first().isVisible({ timeout: 5000 }).catch(() => false)) ||
      bodyText.length > 15;
    expect(hasSkillContent).toBeTruthy();
  });

  // ─── Publish (was /api/publish) ───

  test("S4: 发布页面加载 — 无 404", async ({ page }) => {
    await page.goto(`${BASE_URL}/#/book/test-project-123/publish`, {
      waitUntil: "load",
    });
    await page.waitForTimeout(3000);

    await page.waitForURL(/#\/book\//, { timeout: 10000 });

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const hasCrash = /(Cannot read|undefined is not|Failed to fetch|404)/.test(bodyText);
    expect(hasCrash).toBeFalsy();
  });

  // ─── Audit (was /api/books/{id}/audit) ───

  test("S5: 审计页面加载 — 无 404", async ({ page }) => {
    await page.goto(`${BASE_URL}/#/book/test-project-123/audit`, {
      waitUntil: "load",
    });
    await page.waitForTimeout(3000);

    await page.waitForURL(/#\/book\//, { timeout: 10000 });

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const hasCrash = /(Cannot read|undefined is not|Failed to fetch|404)/.test(bodyText);
    expect(hasCrash).toBeFalsy();
  });

  // ─── Style Management (was /api/style-profiles) ───

  test("S6: 风格管理页面加载 — 无 404", async ({ page }) => {
    await page.goto(`${BASE_URL}/#/style`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    await page.waitForURL(/#\/style/, { timeout: 10000 });

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const hasCrash = /(Cannot read|undefined is not|Failed to fetch|404)/.test(bodyText);
    expect(hasCrash).toBeFalsy();
  });

  // ─── World detail with extract (was /api/worlds + /api/extract) ───

  test("S7: 世界详情页面加载 — 无 404", async ({ page }) => {
    await page.goto(`${BASE_URL}/#/book/test-project-123/worlds`, {
      waitUntil: "load",
    });
    await page.waitForTimeout(3000);

    await page.waitForURL(/#\/book\//, { timeout: 10000 });

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const hasCrash = /(Cannot read|undefined is not|Failed to fetch|404)/.test(bodyText);
    expect(hasCrash).toBeFalsy();
  });

  // ─── Timeline (v1 path, should still work) ───

  test("S8: 时间线页面加载 — 无 404 (v1 路径回归)", async ({ page }) => {
    await page.goto(`${BASE_URL}/#/book/test-project-123/timeline`, {
      waitUntil: "load",
    });
    await page.waitForTimeout(3000);

    await page.waitForURL(/#\/book\//, { timeout: 10000 });

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const hasCrash = /(Cannot read|undefined is not|Failed to fetch|404)/.test(bodyText);
    expect(hasCrash).toBeFalsy();
  });

  // ─── Relation Graph (v1 path, should still work) ───

  test("S9: 关系图谱页面加载 — 无 404 (v1 路径回归)", async ({ page }) => {
    await page.goto(`${BASE_URL}/#/book/test-project-123/relations`, {
      waitUntil: "load",
    });
    await page.waitForTimeout(3000);

    await page.waitForURL(/#\/book\//, { timeout: 10000 });

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(10);

    const hasCrash = /(Cannot read|undefined is not|Failed to fetch|404)/.test(bodyText);
    expect(hasCrash).toBeFalsy();
  });

  // ─── All pages sequential — comprehensive regression check ───

  test("S10: 全模块顺序访问 — 所有页面无崩溃", async ({ page }) => {
    const routes = [
      "/#/book/test-project-123/foreshadowing",
      "/#/book/test-project-123/timeline",
      "/#/book/test-project-123/relations",
      "/#/book/test-project-123/worlds",
      "/#/book/test-project-123/audit",
      "/#/book/test-project-123/publish",
      "/#/book/test-project-123/style",
      "/#/worlds",
      "/#/skills",
      "/#/style",
    ];

    for (const route of routes) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: "load" });
      await page.waitForTimeout(1500);

      const bodyText = await page.locator("body").innerText();
      expect(bodyText.length).toBeGreaterThan(5);

      const hasCrash = /(Cannot read|undefined is not|Failed to fetch|404)/.test(bodyText);
      if (hasCrash) {
        console.log(`CRASH detected on route: ${route}`);
      }
      expect(hasCrash).toBeFalsy();
    }
  });
});
