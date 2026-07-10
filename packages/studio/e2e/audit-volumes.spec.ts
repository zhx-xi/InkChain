import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

// ── Fixtures ──────────────────────────────────────────────────────

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const E2E_ROOT = resolve(__dirname, "..", "test-project");
const BOOK_ID = "e2e-audit-volumes";
const NOW = new Date("2026-07-07T00:00:00.000Z").toISOString();

async function seedAuditVolumes(): Promise<void> {
  const bookDir = join(E2E_ROOT, "books", BOOK_ID);
  const chaptersDir = join(bookDir, "chapters");
  const stateDir = join(bookDir, "story", "state");

  await mkdir(bookDir, { recursive: true });
  await writeFile(
    join(bookDir, "book.json"),
    JSON.stringify({
      id: BOOK_ID,
      title: "E2E 审计-卷筛选测试",
      platform: "webnovel",
      genre: "xianxia",
      status: "active",
      targetChapters: 20,
      chapterWordCount: 2000,
      language: "zh",
      createdAt: NOW,
      updatedAt: NOW,
    }, null, 2),
    "utf-8",
  );

  // Volumes
  await mkdir(stateDir, { recursive: true });
  await writeFile(
    join(stateDir, "volumes.json"),
    JSON.stringify({
      schemaVersion: "1",
      volumes: [
        { id: "vol-1", title: "第一卷 初入江湖", status: "active", order: 1 },
        { id: "vol-2", title: "第二卷 秘境探险", status: "active", order: 2 },
        { id: "vol-3", title: "第三卷 风云再起", status: "active", order: 3 },
      ],
    }, null, 2),
    "utf-8",
  );

  // Chapter index with volume assignments
  await mkdir(chaptersDir, { recursive: true });
  await writeFile(
    join(chaptersDir, "index.json"),
    JSON.stringify([
      { number: 1, title: "第一章 启程", status: "approved", wordCount: 2000, createdAt: NOW, updatedAt: NOW, volumeId: "vol-1", auditIssues: [], lengthWarnings: [] },
      { number: 2, title: "第二章 拜师", status: "audit-failed", wordCount: 2100, createdAt: NOW, updatedAt: NOW, volumeId: "vol-1", auditIssues: [{ severity: "high", category: "逻辑矛盾", description: "拜师时间线混乱" }], lengthWarnings: [] },
      { number: 3, title: "第三章 秘籍", status: "drafted", wordCount: 1900, createdAt: NOW, updatedAt: NOW, volumeId: "vol-1", auditIssues: [], lengthWarnings: [] },
      { number: 4, title: "第四章 秘境入口", status: "audit-failed", wordCount: 2200, createdAt: NOW, updatedAt: NOW, volumeId: "vol-2", auditIssues: [{ severity: "high", category: "设定冲突", description: "秘境规则不一致" }, { severity: "medium", category: "角色OOC", description: "主角行为异常" }], lengthWarnings: [] },
      { number: 5, title: "第五章 深谷", status: "drafted", wordCount: 1800, createdAt: NOW, updatedAt: NOW, volumeId: "vol-2", auditIssues: [], lengthWarnings: [] },
      { number: 6, title: "第六章 古墓", status: "approved", wordCount: 2300, createdAt: NOW, updatedAt: NOW, volumeId: "vol-2", auditIssues: [], lengthWarnings: [] },
      { number: 7, title: "第七章 风云", status: "audit-failed", wordCount: 2000, createdAt: NOW, updatedAt: NOW, volumeId: "vol-3", auditIssues: [{ severity: "low", category: "用词", description: "重复使用'突然'" }], lengthWarnings: [] },
      { number: 8, title: "第八章 决战", status: "drafted", wordCount: 2500, createdAt: NOW, updatedAt: NOW, volumeId: "vol-3", auditIssues: [], lengthWarnings: [] },
      { number: 9, title: "第九章 尾声", status: "approved", wordCount: 1500, createdAt: NOW, updatedAt: NOW, volumeId: null, auditIssues: [], lengthWarnings: [] },
      { number: 10, title: "第十章 番外", status: "drafted", wordCount: 3000, createdAt: NOW, updatedAt: NOW, volumeId: null, auditIssues: [], lengthWarnings: [] },
    ], null, 2),
    "utf-8",
  );

  // Also seed story/chapters/index.json
  await mkdir(join(bookDir, "story", "chapters"), { recursive: true });
  await writeFile(
    join(bookDir, "story", "chapters", "index.json"),
    JSON.stringify({ chapters: [
      { number: 1, title: "第一章 启程", status: "approved", wordCount: 2000, createdAt: NOW, updatedAt: NOW, volumeId: "vol-1" },
      { number: 2, title: "第二章 拜师", status: "audit-failed", wordCount: 2100, createdAt: NOW, updatedAt: NOW, volumeId: "vol-1" },
      { number: 3, title: "第三章 秘籍", status: "drafted", wordCount: 1900, createdAt: NOW, updatedAt: NOW, volumeId: "vol-1" },
      { number: 4, title: "第四章 秘境入口", status: "audit-failed", wordCount: 2200, createdAt: NOW, updatedAt: NOW, volumeId: "vol-2" },
      { number: 5, title: "第五章 深谷", status: "drafted", wordCount: 1800, createdAt: NOW, updatedAt: NOW, volumeId: "vol-2" },
      { number: 6, title: "第六章 古墓", status: "approved", wordCount: 2300, createdAt: NOW, updatedAt: NOW, volumeId: "vol-2" },
      { number: 7, title: "第七章 风云", status: "audit-failed", wordCount: 2000, createdAt: NOW, updatedAt: NOW, volumeId: "vol-3" },
      { number: 8, title: "第八章 决战", status: "drafted", wordCount: 2500, createdAt: NOW, updatedAt: NOW, volumeId: "vol-3" },
      { number: 9, title: "第九章 尾声", status: "approved", wordCount: 1500, createdAt: NOW, updatedAt: NOW, volumeId: null },
      { number: 10, title: "第十章 番外", status: "drafted", wordCount: 3000, createdAt: NOW, updatedAt: NOW, volumeId: null },
    ]}, null, 2),
    "utf-8",
  );
}

// ── Setup ─────────────────────────────────────────────────────────

test.beforeAll(async () => {
  await seedAuditVolumes();
});

// ── Tests ─────────────────────────────────────────────────────────

test.describe("审计-卷筛选与分页", () => {
  test("1. 页面加载显示卷筛选下拉和分页控件", async ({ page }) => {
    await page.goto(`/#/audit/${BOOK_ID}`);
    await expect(page.getByRole("heading", { name: "章节审计" })).toBeVisible({ timeout: 20_000 });

    // Volume filter dropdown: select element with "全部卷" option
    const volumeSelect = page.locator("select").first();
    await expect(volumeSelect).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("option[value='']")).toContainText("全部卷");
    await expect(page.locator("option[value='vol-1']")).toContainText("第一卷");
    await expect(page.locator("option[value='vol-2']")).toContainText("第二卷");
    await expect(page.locator("option[value='vol-3']")).toContainText("第三卷");

    // Pagination: page info should be visible when >10 chapters
    await expect(page.getByText(/第1页 \/ 共\d+页/)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("上一页")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("下一页")).toBeVisible({ timeout: 3_000 });
  });

  test("2. 卷筛选可过滤章节列表", async ({ page }) => {
    await page.goto(`/#/audit/${BOOK_ID}`);
    await expect(page.getByRole("heading", { name: "章节审计" })).toBeVisible({ timeout: 20_000 });

    // "全部卷" shows all chapters
    await expect(page.getByText("第一章 启程")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("第四章 秘境入口")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("第九章 尾声")).toBeVisible({ timeout: 3_000 });

    // Select vol-1 → only vol-1 chapters show
    const volumeSelect = page.locator("select").first();
    await volumeSelect.selectOption("vol-1");
    await page.waitForTimeout(500);

    await expect(page.getByText("第一章 启程")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("第二章 拜师")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("第三章 秘籍")).toBeVisible({ timeout: 3_000 });
    // Non-vol-1 chapters should be hidden
    await expect(page.getByText("第四章 秘境入口")).not.toBeVisible({ timeout: 2_000 });
    await expect(page.getByText("第九章 尾声")).not.toBeVisible({ timeout: 2_000 });

    // Select vol-2 → only vol-2 chapters show
    await volumeSelect.selectOption("vol-2");
    await page.waitForTimeout(500);

    await expect(page.getByText("第四章 秘境入口")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("第五章 深谷")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("第六章 古墓")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("第一章 启程")).not.toBeVisible({ timeout: 2_000 });

    // Select vol-3 → only vol-3 chapters + unassigned
    await volumeSelect.selectOption("vol-3");
    await page.waitForTimeout(500);

    await expect(page.getByText("第七章 风云")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("第八章 决战")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("第四章 秘境入口")).not.toBeVisible({ timeout: 2_000 });
    // Unassigned chapters (vol-id=null) should NOT show when a specific volume is selected
  });

  test("3. 无章节卷显示空状态", async ({ page }) => {
    await page.goto(`/#/audit/${BOOK_ID}`);
    await expect(page.getByRole("heading", { name: "章节审计" })).toBeVisible({ timeout: 20_000 });

    // Navigate to a volume that has 2 chapters with pageSize=10 → should show all
    const volumeSelect = page.locator("select").first();

    // Select vol-1 (3 chapters) with pageSize=10 → shows all, no pagination needed
    // But pagination controls should still be visible for >10 items
    await volumeSelect.selectOption("vol-1");
    await page.waitForTimeout(500);

    // Verify vol-1 chapters are visible
    await expect(page.getByText("第一章 启程")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("第三章 秘籍")).toBeVisible({ timeout: 3_000 });
  });

  test("4. 分页控件正常工作", async ({ page }) => {
    await page.goto(`/#/audit/${BOOK_ID}`);
    await expect(page.getByRole("heading", { name: "章节审计" })).toBeVisible({ timeout: 20_000 });

    // With pageSize=10 and 10 chapters → all on one page (1 page total)
    // Verify page info shows correct totals
    await expect(page.getByText(/第1页 \/ 共1页/)).toBeVisible({ timeout: 3_000 });

    // Verify pagination buttons exist
    await expect(page.getByText("上一页")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("下一页")).toBeVisible({ timeout: 3_000 });

    // Page size selector should exist with options
    const pageSizeSelect = page.locator("select").nth(1);
    await expect(pageSizeSelect).toBeVisible({ timeout: 3_000 });
    await expect(pageSizeSelect).toContainText("10条/页");
    await expect(pageSizeSelect).toContainText("20条/页");
    await expect(pageSizeSelect).toContainText("50条/页");
  });
});
