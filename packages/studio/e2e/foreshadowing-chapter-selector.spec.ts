import { test, expect } from "@playwright/test";
import {
  seedForeshadowing,
  clearForeshadowing,
  E2E_FORES_BOOK_ID,
} from "./fixtures/seed-foreshadowing";
import { conditionalMock } from "./fixtures/mock-llm-helper";

/**
 * Mock the book detail API to return a known chapter count.
 * The foreshadowing page fetches this to determine the dynamic chapter count.
 */
function mockBookDetail(page: import("@playwright/test").Page, chapterCount: number) {
  conditionalMock(() => {
    page.route("**/api/v1/books/**", async (route) => {
      const chapters = Array.from({ length: chapterCount }, (_, i) => ({
        number: i + 1,
      }));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: E2E_FORES_BOOK_ID,
          title: "E2E 娴嬭瘯涔?,
          chapters,
        }),
      });
    });
  });
}

test.beforeAll(async () => {
  await seedForeshadowing();
});

test.beforeEach(async ({ page }) => {
  await seedForeshadowing();
});

test.describe("Foreshadowing 鈥?绔犺妭閫夋嫨鍣ㄥ姩鎬佺珷鑺傛暟 E2E", () => {
  /** Helper: wait for the foreshadowing page heading (avoid strict mode conflict with sidebar) */
  async function waitForPage(page: import("@playwright/test").Page) {
    await expect(page.getByRole("heading", { name: "浼忕瑪杩借釜" })).toBeVisible({ timeout: 15_000 });
  }

  test("1. 姝ｅ父鎬侊細5 绔犳暟鎹姞杞介〉闈笉宕╂簝", async ({ page }) => {
    mockBookDetail(page, 5);

    await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
    await waitForPage(page);

    // Verify seeded foreshadowing entries are visible
    await expect(page.getByText("绁炵鎴掓寚")).toBeVisible({ timeout: 10_000 });
  });

  test("2. 绌烘€侊細0 绔犳椂闄嶇骇鑷抽粯璁ゅ€?1锛岄〉闈笉宕╂簝", async ({ page }) => {
    mockBookDetail(page, 0);

    await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
    await waitForPage(page);

    // With 0 chapters, Math.max(1, 0) = 1, page should still load
    await expect(page.getByText("绁炵鎴掓寚")).toBeVisible({ timeout: 10_000 });
  });

  test("3. 閿欒鎬侊細book detail API 500 鏃堕檷绾ц嚦 1", async ({ page }) => {
    conditionalMock(() => {
      page.route("**/api/v1/books/**", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Server error" }),
        });
      });
    });

    await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
    await waitForPage(page);

    // When book detail API fails, actualChapterCount = 0, Math.max(1, 0) = 1
    await expect(page.getByText("绁炵鎴掓寚")).toBeVisible({ timeout: 10_000 });
  });

  test("4. AI 鎻愬彇妯℃€佹锛氱珷鑺傝寖鍥撮€夋嫨鍣ㄥ伐浣滄甯?, async ({ page }) => {
    mockBookDetail(page, 10);

    // Mock AI extraction to return test entries
    conditionalMock(() => {
      page.route("**/api/foreshadowing/extract*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: [
              {
                id: "fs-chapter-test-1",
                title: "绔犺妭鑼冨洿娴嬭瘯浼忕瑪",
                description: "閫氳繃绔犺妭鑼冨洿娴嬭瘯鐨勪紡绗?,
                type: "鎯呰妭浼忕瑪",
                sourceChapter: 5,
              },
            ],
          }),
        });
      });
    });

    await page.goto(`/#/foreshadowing/${E2E_FORES_BOOK_ID}`);
    await waitForPage(page);

    // Open AI extract modal
    await page.getByRole("button", { name: /AI 鎻愬彇/ }).click();
    await expect(page.getByText("AI 鎻愬彇浼忕瑪")).toBeVisible({ timeout: 5_000 });

    // Chapter range selector should be visible 鈥?proves dynamic chapter count works
    await expect(page.getByText("绔犺妭鑼冨洿锛?)).toBeVisible({ timeout: 3_000 });

    // Click start extract
    await page.getByRole("button", { name: "寮€濮嬫彁鍙? }).click();

    // Extraction results should appear
    await expect(page.getByText("绔犺妭鑼冨洿娴嬭瘯浼忕瑪")).toBeVisible({ timeout: 8_000 });

    // Apply the result
    await page.getByRole("button", { name: "搴旂敤鎵€鏈? }).click();
    await expect(page.getByText("AI 鎻愬彇浼忕瑪")).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("绔犺妭鑼冨洿娴嬭瘯浼忕瑪")).toBeVisible({ timeout: 5_000 });
  });
});
