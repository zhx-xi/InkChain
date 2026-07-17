import { test, expect, type Page, type Locator } from "@playwright/test";
import { seedVolumeDnd, E2E_BOOK_ID, VOLUME_1_ID, VOLUME_2_ID } from "./fixtures/seed-volume-dnd";

// Register page error logging for debugging test failures
test.beforeEach(async ({ page }) => {
  page.on("pageerror", (err) => {
    console.error("[page error]", err.message);
  });
});

test.beforeAll(async () => {
  await seedVolumeDnd();
});

test.beforeEach(async ({ page }) => {
  // Re-seed data to reset any modifications from previous tests
  await seedVolumeDnd();

  // Mock the book API so the page renders reliably in CI
  await page.route(`**/api/v1/books/${E2E_BOOK_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        book: { id: E2E_BOOK_ID, title: "E2E 分卷拖拽测试", platform: "webnovel", genre: "xianxia", status: "active", targetChapters: 10, chapterWordCount: 2000, language: "zh", createdAt: "2026-07-04T00:00:00.000Z", updatedAt: "2026-07-04T00:00:00.000Z" },
        chapters: [
          { number: 1, title: "第一章", status: "drafted", wordCount: 1000 },
          { number: 2, title: "第二章", status: "drafted", wordCount: 1000 },
          { number: 3, title: "第三章", status: "drafted", wordCount: 1000, volumeId: "vol-2-id" },
          { number: 4, title: "第四章", status: "drafted", wordCount: 1000, volumeId: "vol-1-id" },
          { number: 5, title: "第五章", status: "drafted", wordCount: 1000, volumeId: "vol-1-id" },
        ],
        nextChapter: 6,
      }),
    });
  });

  await page.goto(`/#/book/${E2E_BOOK_ID}`);
  await page.waitForTimeout(3000);
});

// ── Helpers ──

function volumeCardLocator(page: Page, titlePart: string): Locator {
  return page.locator(
    `xpath=//*[contains(text(),'${titlePart}')]/ancestor::div[contains(@class,'rounded-lg')]`,
  );
}
function unassignedDropZone(page: Page): Locator {
  return page.locator("xpath=//*[contains(text(),'未分配章节')]/..");
}

/**
 * Simulate HTML5 drag-and-drop using programmatic DragEvent dispatch.
 *
 * Strategy:
 * - Source: find a <li draggable=true> element whose descendant text contains
 *   sourceText.  The <li> in ChaptersSection has onDragStart/onDragEnd.
 * - Target: if targetText is "未分配章节", find the drop-zone <div> that is
 *   the parent of the element containing that text.  Otherwise treat
 *   targetText as a volume title and find the VolumeCard's outermost <div>
 *   (with class "rounded-lg") that contains that title.
 */
async function simulateDragDrop(
  page: Page,
  sourceText: string,
  targetText: string,
  chapterNumber: number,
): Promise<void> {
  const ok = await page.evaluate(
    ({ src, tgt, chNum }: { src: string; tgt: string; chNum: number }) => {
      function esc(s: string) {
        return s.replace(/'/g, "&apos;");
      }

      // Source: <li draggable> containing the chapter text
      const srcXPath = `//li[@draggable][contains(., '${esc(src)}')]`;
      const srcResult = document.evaluate(
        srcXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null,
      );
      const srcEl = srcResult.singleNodeValue as HTMLElement | null;

      if (!srcEl) {
        throw new Error(`DnD source <li draggable> containing "${src}" not found`);
      }

      // Target
      let tgtEl: HTMLElement | null;
      if (tgt === "未分配章节") {
        // Unassigned drop zone: the <div> whose text contains "未分配章节"
        const textParent = document.evaluate(
          `//*[contains(text(), '${esc(tgt)}')]`,
          document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null,
        ).singleNodeValue as HTMLElement | null;
        if (textParent?.parentElement) {
          tgtEl = textParent.parentElement;
        } else {
          tgtEl = textParent;
        }
      } else {
        // Volume card: ancestor div with class "rounded-lg" that contains the title text
        tgtEl = document.evaluate(
          `//*[contains(text(), '${esc(tgt)}')]/ancestor::div[contains(@class,'rounded-lg')]`,
          document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null,
        ).singleNodeValue as HTMLElement | null;
      }

      if (!tgtEl) {
        throw new Error(`DnD target "${tgt}" not found`);
      }

      const dt = new DataTransfer();
      dt.setData("application/x-chapter-number", String(chNum));

      srcEl.dispatchEvent(
        new DragEvent("dragstart", { dataTransfer: dt, bubbles: true, cancelable: true }),
      );
      tgtEl.dispatchEvent(
        new DragEvent("dragenter", { dataTransfer: dt, bubbles: true, cancelable: true }),
      );
      tgtEl.dispatchEvent(
        new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }),
      );
      tgtEl.dispatchEvent(
        new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }),
      );
      srcEl.dispatchEvent(
        new DragEvent("dragend", { dataTransfer: dt, bubbles: true, cancelable: true }),
      );
      return true;
    },
    { src: sourceText, tgt: targetText, chNum: chapterNumber },
  );

  if (!ok) throw new Error("drag-and-drop simulation failed");
  await page.waitForTimeout(800);
}

async function countChaptersInVolume(page: Page, volumeTitle: string): Promise<number> {
  return volumeCardLocator(page, volumeTitle).locator("li").count();
}

async function countUnassignedChapters(page: Page): Promise<number> {
  const text = await page.getByText(/未分配章节/).textContent();
  if (!text) return 0;
  const m = text.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// ── Tests ──

test.describe("Volume DnD — drag to volume", () => {
  test("1. drag unassigned chapter to target volume", async ({ page }) => {
    const beforeUn = await countUnassignedChapters(page);
    expect(beforeUn).toBeGreaterThanOrEqual(2);

    const beforeV1 = await countChaptersInVolume(page, "第一卷");
    expect(beforeV1).toBe(2);

    await simulateDragDrop(page, "01 第一章", "第一卷 · 筑基篇", 1);

    await page.waitForTimeout(1000);
    const afterV1 = await countChaptersInVolume(page, "第一卷");
    expect(afterV1).toBe(3);

    const afterUn = await countUnassignedChapters(page);
    expect(afterUn).toBe(beforeUn - 1);
  });

  test("2. API call issues correct PATCH after drag", async ({ page }) => {
    const patchPromise = page.waitForRequest((req) =>
      req.method() === "PATCH" &&
      req.url().includes(`/books/${E2E_BOOK_ID}/chapters/2/volume`),
    );

    await simulateDragDrop(page, "02 第二章", "第二卷 · 历练篇", 2);

    const req = await patchPromise;
    const body = JSON.parse(req.postData() ?? "{}");
    expect(body).toEqual({ volumeId: VOLUME_2_ID });
  });

  test("3. dataTransfer uses application/x-chapter-number format", async ({ page }) => {
    const result = await page.evaluate(() => {
      const li = document.evaluate(
        '//li[@draggable][contains(., "01 第一章")]',
        document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null,
      ).singleNodeValue as HTMLElement | null;
      if (!li) return null;

      const dt = new DataTransfer();
      li.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt, bubbles: true, cancelable: true }));

      const formats: string[] = [];
      for (let i = 0; i < dt.items.length; i++) formats.push(dt.items[i].type);
      return { formats, value: dt.getData("application/x-chapter-number") };
    });

    expect(result).not.toBeNull();
    expect(result!.formats).toContain("application/x-chapter-number");
    expect(result!.value).toBe("1");
  });
});

test.describe("Volume DnD — drag to unassigned", () => {
  test("4. drag chapter from volume back to unassigned", async ({ page }) => {
    const beforeV1 = await countChaptersInVolume(page, "第一卷");
    expect(beforeV1).toBe(2);
    const beforeUn = await countUnassignedChapters(page);

    // Verify source and target exist before dragging
    await expect(page.locator("xpath=//li[@draggable][contains(.,'04 第四章')]")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/未分配章节/)).toBeVisible({ timeout: 3000 });

    await simulateDragDrop(page, "04 第四章", "未分配章节", 4);

    // Wait for the volume card to show only 1 chapter li
    await expect(async () => {
      expect(await countChaptersInVolume(page, "第一卷")).toBe(1);
    }).toPass({ timeout: 5_000 });
    expect(await countUnassignedChapters(page)).toBe(beforeUn + 1);
  });

  test("5. drag chapter out of volume to unassigned area", async ({ page }) => {
    const beforeV2 = await countChaptersInVolume(page, "第二卷");
    expect(beforeV2).toBe(1);
    const beforeUn = await countUnassignedChapters(page);

    await simulateDragDrop(page, "03 第三章", "未分配章节", 3);

    await expect(async () => {
      expect(await countChaptersInVolume(page, "第二卷")).toBe(0);
    }).toPass({ timeout: 5_000, intervals: [500] });
    expect(await countUnassignedChapters(page)).toBe(beforeUn + 1);
  });
});

test.describe("Volume DnD — visual feedback", () => {
  test("6. source element has 50% opacity during dragStart", async ({ page }) => {
    const opacity = await page.evaluate(() => {
      const li = document.evaluate(
        `//li[@draggable][contains(., "01 第一章")]`,
        document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null,
      ).singleNodeValue as HTMLElement | null;
      if (!li) return null;

      const dt = new DataTransfer();
      dt.setData("application/x-chapter-number", "1");
      li.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt, bubbles: true, cancelable: true }));

      return parseFloat(window.getComputedStyle(li).opacity);
    });
    expect(opacity).toBe(0.5);
  });

  test("7. opacity restored to 1 after dragEnd", async ({ page }) => {
    const opacity = await page.evaluate(() => {
      const li = document.evaluate(
        `//li[@draggable][contains(., "01 第一章")]`,
        document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null,
      ).singleNodeValue as HTMLElement | null;
      if (!li) return null;

      const dt = new DataTransfer();
      dt.setData("application/x-chapter-number", "1");
      li.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt, bubbles: true, cancelable: true }));
      li.dispatchEvent(new DragEvent("dragend", { dataTransfer: dt, bubbles: true, cancelable: true }));

      return parseFloat(window.getComputedStyle(li).opacity);
    });
    expect(opacity).toBe(1);
  });

  test("8. target volume highlights during dragOver", async ({ page }) => {
    const volCard = volumeCardLocator(page, "第一卷");
    await expect(volCard).toBeVisible({ timeout: 5000 });

    // Dispatch drag events inside the browser context
    await page.evaluate(() => {
      const srcEl = document.evaluate(
        '//li[@draggable][contains(., "01 第一章")]',
        document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null,
      ).singleNodeValue as HTMLElement | null;
      const card = document.evaluate(
        '//*[contains(text(),"第一卷")]/ancestor::div[contains(@class,"rounded-lg")]',
        document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null,
      ).singleNodeValue as HTMLElement | null;
      if (!srcEl || !card) return;

      const dt = new DataTransfer();
      dt.setData("application/x-chapter-number", "1");
      srcEl.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt, bubbles: true, cancelable: true }));
      card.dispatchEvent(new DragEvent("dragenter", { dataTransfer: dt, bubbles: true, cancelable: true }));
      card.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
    });

    // Wait for React state update to apply the highlight class
    await expect(volCard).toHaveClass(/border-primary|ring/, { timeout: 3_000 });
  });
});
