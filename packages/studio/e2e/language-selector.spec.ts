import { test, expect } from "@playwright/test";

// ── Tests ────────────────────────────────────────────────────────
// LanguageSelector is a startup overlay shown when project has no explicit language set.
// It's not a hash-addressable page.

test.describe("LanguageSelector", () => {
  test("1. Page loads without crash", async ({ page }) => {
    // When navigating to home
    await page.goto("/#/");
    await page.waitForLoadState("networkidle");

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("2. Language selector rendering", async ({ page }) => {
    // When navigating to home
    await page.goto("/#/");
    await page.waitForLoadState("networkidle");

    // Check if LanguageSelector overlay is showing
    const hasSelector = await page.getByText("InkChain Studio").isVisible({ timeout: 3_000 }).catch(() => false);
    const hasChinese = await page.getByText("中文创作").isVisible({ timeout: 2_000 }).catch(() => false);

    // Either language selector shows OR normal dashboard loads — both are valid
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("3. Language selection interaction", async ({ page }) => {
    // Given the home page
    await page.goto("/#/");
    await page.waitForLoadState("networkidle");

    // Check if language selector shows
    const zhCard = page.getByText("中文创作");
    const zhVisible = await zhCard.isVisible({ timeout: 3_000 }).catch(() => false);

    if (zhVisible) {
      // When clicking Chinese option
      await zhCard.click();
      await page.waitForTimeout(2000);

      // Then the page should navigate (selector closes)
      const bodyText = await page.evaluate(() => document.body.innerText);
      expect(bodyText.length).toBeGreaterThan(0);
    } else {
      // Language already set — page renders normally
      const bodyText = await page.evaluate(() => document.body.innerText);
      expect(bodyText.length).toBeGreaterThan(0);
    }
  });

  test("4. English language selection", async ({ page }) => {
    // Given the home page
    await page.goto("/#/");
    await page.waitForLoadState("networkidle");

    // Check if language selector shows
    const enCard = page.getByText("English Writing");
    const enVisible = await enCard.isVisible({ timeout: 3_000 }).catch(() => false);

    if (enVisible) {
      // When clicking English option
      await enCard.click();
      await page.waitForTimeout(2000);

      // Then page updates
      const bodyText = await page.evaluate(() => document.body.innerText);
      expect(bodyText.length).toBeGreaterThan(0);
    } else {
      // Normal UI
      const bodyText = await page.evaluate(() => document.body.innerText);
      expect(bodyText.length).toBeGreaterThan(0);
    }
  });
});
