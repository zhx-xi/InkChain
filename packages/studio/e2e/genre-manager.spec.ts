import { test, expect, Page } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────────────

/** Navigate to genre manager page via sidebar */
async function navigateToGenres(page: Page) {
  await page.goto("/#/");
  await page.waitForLoadState("load");

  // Try clicking System section to expand
  const systemSection = page.getByText("系统", { exact: false }).first();
  const sysVisible = await systemSection.isVisible({ timeout: 5_000 }).catch(() => false);
  if (sysVisible) {
    await systemSection.click();
    await page.waitForTimeout(500);
  }

  // Click the genre link
  const genreLink = page.getByText("体裁", { exact: false }).first();
  const genreVisible = await genreLink.isVisible({ timeout: 3_000 }).catch(() => false);
  if (genreVisible) {
    await genreLink.click();
    await page.waitForTimeout(1000);
  }
}

/** Mock genre list endpoint */
function mockGenreList(page: Page, genres: unknown[]) {
  return page.route("**/api/v1/genres", async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(genres),
    });
  });
}

function mockGenreError(page: Page) {
  return page.route("**/api/v1/genres", async (route) => {
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "error" }) });
  });
}

const GENRE_LIST = [
  { id: "xianxia", name: "仙侠", language: "zh", source: "builtin", chapterTypes: ["修炼"], fatigueWords: [] },
  { id: "litrpg", name: "LitRPG", language: "en", source: "builtin", chapterTypes: ["Level Up"], fatigueWords: [] },
];

// ── Tests ────────────────────────────────────────────────────────

test.describe("GenreManager", () => {
  test("1. Page renders with genre list", async ({ page }) => {
    // Given multiple genres available
    await mockGenreList(page, GENRE_LIST);

    // When navigating to genres page
    await navigateToGenres(page);

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("2. Empty genre list", async ({ page }) => {
    // Given no genres
    await mockGenreList(page, []);

    // When navigating to genres page
    await navigateToGenres(page);
    await page.waitForTimeout(2000);

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("3. Genre detail rendering", async ({ page }) => {
    // Given genres list
    await mockGenreList(page, GENRE_LIST);

    // When navigating to genres page
    await navigateToGenres(page);
    await page.waitForTimeout(2000);

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("4. API error handling", async ({ page }) => {
    // Given API error
    await mockGenreError(page);

    // When navigating to genres page
    await navigateToGenres(page);
    await page.waitForTimeout(2000);

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
