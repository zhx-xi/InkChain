// ── API Path Unification — API 路径统一 E2E (Issue #736) ──
// Refactoring: unify all /api/ paths to /api/v1/ format
// 强断言版: 拦截 API 调用，断言所有请求使用 /api/v1/ (非 /api/)
// 功能未实现 → 测试应全红 (当前代码仍使用 /api/ 路径)

import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4580";

// 收集 API 调用路径
async function collectApiPaths(
  page: import("@playwright/test").Page,
  navigationUrl: string,
  waitMs: number = 4000
): Promise<string[]> {
  const apiPaths: string[] = [];
  const handler = (route: import("@playwright/test").Route) => {
    const url = route.request().url();
    if (url.includes("/api/")) {
      try {
        apiPaths.push(new URL(url).pathname);
      } catch {
        apiPaths.push(url);
      }
    }
    route.continue();
  };

  await page.route("**/api/**", handler);
  await page.goto(`${BASE_URL}${navigationUrl}`);
  await page.waitForTimeout(waitMs);
  await page.unroute("**/api/**");

  return apiPaths;
}

test.describe("API Path Smoke — 所有 API 调用统一 /api/v1/", () => {

  // ═══ S1: 伏笔页 (was /api/foreshadowing) ═══
  test("S1: 伏笔页面 — API 调用全部使用 /api/v1/", async ({ page }) => {
    const paths = await collectApiPaths(page, "/#/book/test-project-123/foreshadowing", 5000);

    // 确保至少有一次 API 调用 (否则测试无意义)
    expect(paths.length).toBeGreaterThan(0);

    // 所有路径必须以 /api/v1/ 开头 (非 /api/xxx 即 /api/ 不带 v1)
    const nonV1 = paths.filter((p) => p.startsWith("/api/") && !p.startsWith("/api/v1/"));
    expect(nonV1).toEqual([]);
  });

  // ═══ S2: 世界页面 (was /api/worlds) ═══
  test("S2: 世界页面 — API 调用全部使用 /api/v1/", async ({ page }) => {
    const paths = await collectApiPaths(page, "/#/worlds", 5000);
    expect(paths.length).toBeGreaterThan(0);

    const nonV1 = paths.filter((p) => p.startsWith("/api/") && !p.startsWith("/api/v1/"));
    expect(nonV1).toEqual([]);
  });

  // ═══ S3: Skill 库 (was /api/skills) ═══
  test("S3: Skill 库页面 — API 调用全部使用 /api/v1/", async ({ page }) => {
    const paths = await collectApiPaths(page, "/#/skills", 5000);
    expect(paths.length).toBeGreaterThan(0);

    const nonV1 = paths.filter((p) => p.startsWith("/api/") && !p.startsWith("/api/v1/"));
    expect(nonV1).toEqual([]);
  });

  // ═══ S4: 发布页面 (was /api/publish) ═══
  test("S4: 发布页面 — API 调用全部使用 /api/v1/", async ({ page }) => {
    const paths = await collectApiPaths(page, "/#/book/test-project-123/publish", 5000);
    expect(paths.length).toBeGreaterThan(0);

    const nonV1 = paths.filter((p) => p.startsWith("/api/") && !p.startsWith("/api/v1/"));
    expect(nonV1).toEqual([]);
  });

  // ═══ S5: 审计页面 (was /api/books/{id}/audit) ═══
  test("S5: 审计页面 — API 调用全部使用 /api/v1/", async ({ page }) => {
    const paths = await collectApiPaths(page, "/#/book/test-project-123/audit", 5000);
    expect(paths.length).toBeGreaterThan(0);

    const nonV1 = paths.filter((p) => p.startsWith("/api/") && !p.startsWith("/api/v1/"));
    expect(nonV1).toEqual([]);
  });

  // ═══ S6: 风格管理 (was /api/style-profiles) ═══
  test("S6: 风格管理页面 — API 调用全部使用 /api/v1/", async ({ page }) => {
    const paths = await collectApiPaths(page, "/#/style", 5000);
    expect(paths.length).toBeGreaterThan(0);

    const nonV1 = paths.filter((p) => p.startsWith("/api/") && !p.startsWith("/api/v1/"));
    expect(nonV1).toEqual([]);
  });

  // ═══ S7: 世界详情 (was /api/worlds + /api/extract) ═══
  test("S7: 世界详情页面 — API 调用全部使用 /api/v1/", async ({ page }) => {
    const paths = await collectApiPaths(page, "/#/book/test-project-123/worlds", 5000);
    expect(paths.length).toBeGreaterThan(0);

    const nonV1 = paths.filter((p) => p.startsWith("/api/") && !p.startsWith("/api/v1/"));
    expect(nonV1).toEqual([]);
  });

  // ═══ S8: 时间线 (v1 路径回归测试) ═══
  test("S8: 时间线页面 — API 调用全部使用 /api/v1/ (回归)", async ({ page }) => {
    const paths = await collectApiPaths(page, "/#/book/test-project-123/timeline", 5000);
    expect(paths.length).toBeGreaterThan(0);

    const nonV1 = paths.filter((p) => p.startsWith("/api/") && !p.startsWith("/api/v1/"));
    expect(nonV1).toEqual([]);
  });

  // ═══ S9: 关系图谱 (v1 路径回归测试) ═══
  test("S9: 关系图谱页面 — API 调用全部使用 /api/v1/ (回归)", async ({ page }) => {
    const paths = await collectApiPaths(page, "/#/book/test-project-123/relations", 5000);
    expect(paths.length).toBeGreaterThan(0);

    const nonV1 = paths.filter((p) => p.startsWith("/api/") && !p.startsWith("/api/v1/"));
    expect(nonV1).toEqual([]);
  });

  // ═══ S10: 全模块顺序访问 — 综合回归 ═══
  test("S10: 全模块顺序访问 — 所有 API 调用统一 /api/v1/", async ({ page }) => {
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

    const allNonV1Paths: string[] = [];

    for (const route of routes) {
      const paths = await collectApiPaths(page, route, 2000);

      const nonV1 = paths.filter((p) => p.startsWith("/api/") && !p.startsWith("/api/v1/"));
      allNonV1Paths.push(...nonV1);
    }

    // 任何非 /api/v1/ 调用都应报告
    expect(allNonV1Paths).toEqual([]);
  });
});
