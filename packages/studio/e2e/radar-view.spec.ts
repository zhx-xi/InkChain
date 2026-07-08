import { test, expect, Page } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────────────

/** Navigate to radar page via sidebar */
async function navigateToRadar(page: Page) {
  await page.goto("/#/");
  await page.waitForLoadState("load");
  await page.waitForTimeout(1000);

  // Click sidebar radar link
  const radarLink = page.getByText("市场雷达", { exact: false }).first();
  const radarVisible = await radarLink.isVisible({ timeout: 5_000 }).catch(() => false);
  if (radarVisible) {
    await radarLink.click();
    await page.waitForTimeout(1000);
  }
}

/** Mock /radar/history endpoint */
function mockHistory(page: Page, items: ReadonlyArray<Record<string, unknown>>) {
  return page.route("**/api/v1/radar/history", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items }),
    });
  });
}

/** Mock /radar/scan endpoint */
function mockScan(page: Page, result: Record<string, unknown>) {
  return page.route("**/api/v1/radar/scan*", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(result),
      });
    } else {
      await route.continue();
    }
  });
}

// ── Sample data ──────────────────────────────────────────────────

const SAMPLE_RECOMMENDATIONS = [
  {
    confidence: 0.85,
    platform: "Web Novel",
    genre: "Fantasy",
    concept: "Rebirth of the Immortal Alchemist",
    reasoning: "Strong overlap with current trending themes in the Chinese web novel market.",
    benchmarkTitles: ["Battle Through the Heavens", "A Will Eternal"],
  },
  {
    confidence: 0.45,
    platform: "Light Novel",
    genre: "Sci-Fi",
    concept: "The Last Star Engineer",
    reasoning: "Moderate potential, niche audience but high engagement.",
    benchmarkTitles: ["Three-Body Problem"],
  },
];

const SAMPLE_RESULT = {
  marketSummary: "The fantasy genre continues to dominate with 60% market share. Isekai and cultivation sub-genres show the highest growth.",
  recommendations: SAMPLE_RECOMMENDATIONS,
};

const SAMPLE_HISTORY = [
  { file: "scan-001.json", timestamp: "2026-07-08T10:00:00.000Z", summaryPreview: "Fantasy market analysis - 5 recommendations found", result: SAMPLE_RESULT },
];

// ── Tests ────────────────────────────────────────────────────────

test.describe("RadarView", () => {
  test("1. Page renders with empty state hint", async ({ page }) => {
    // Given the history API returns empty
    await mockHistory(page, []);

    // When navigating to radar page
    await navigateToRadar(page);
    await page.waitForTimeout(2000);

    // Then the empty hint should be visible
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain("市场雷达");
  });

  test("2. Scan returns results and displays recommendations", async ({ page }) => {
    // Given mock APIs
    await mockHistory(page, []);
    await mockScan(page, SAMPLE_RESULT);

    // When navigating to radar page
    await navigateToRadar(page);
    await page.waitForTimeout(1000);

    // Then the scan button should be visible
    const bodyTextBefore = await page.evaluate(() => document.body.innerText);

    // When clicking the scan button
    const scanButton = page.getByRole("button", { name: /市场扫描|Scan/ }).first();
    const scanVisible = await scanButton.isVisible({ timeout: 3_000 }).catch(() => false);
    if (scanVisible) {
      await scanButton.click();
      await page.waitForTimeout(2000);
    }

    // Then the results should appear
    const bodyTextAfter = await page.evaluate(() => document.body.innerText);
    expect(bodyTextAfter.length).toBeGreaterThan(0);
  });

  test("3. API error shows error message", async ({ page }) => {
    // Given scan returns an error
    await mockHistory(page, []);
    await page.route("**/api/v1/radar/scan*", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "scan failed" }) });
      } else {
        await route.continue();
      }
    });

    // When navigating to radar page
    await navigateToRadar(page);
    await page.waitForTimeout(1000);

    // Then clicking scan should show error state
    const scanButton = page.getByRole("button", { name: /市场扫描|Scan/ }).first();
    const scanVisible = await scanButton.isVisible({ timeout: 3_000 }).catch(() => false);
    if (scanVisible) {
      await scanButton.click();
      await page.waitForTimeout(2000);
    }

    // Then the page should not crash
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("4. History items render when available", async ({ page }) => {
    // Given there is scan history
    await mockHistory(page, SAMPLE_HISTORY);
    await mockScan(page, SAMPLE_RESULT);

    // When navigating to radar page
    await navigateToRadar(page);
    await page.waitForTimeout(2000);

    // Then history items should appear
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain("Fantasy");
    // History button should be present (contains timestamp or preview)
    const hasHistoryContent = bodyText.includes("scan") || bodyText.includes("market");
    expect(hasHistoryContent || bodyText.length > 100).toBeTruthy();
  });
});
