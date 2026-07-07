import { test, expect } from "@playwright/test";
import { seedChapterAudit, E2E_BOOK_ID, E2E_ROOT } from "./fixtures/seed-chapter-audit";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Seed audit result data so chapters have issues visible in the audit page
async function seedAuditData(): Promise<void> {
  const auditDir = join(E2E_ROOT, ".inkos", "books", E2E_BOOK_ID, "audit");
  await mkdir(auditDir, { recursive: true });

  // Chapter 2: 2 issues (audit-failed)
  await writeFile(
    join(auditDir, "chapter-2.json"),
    JSON.stringify({
      chapterNumber: 2,
      status: "fail",
      issues: [
        {
          type: "logic",
          severity: "error",
          description: "灵根测试结果前后不一致",
          chapterNumber: 2,
        },
        {
          type: "pacing",
          severity: "warning",
          description: "第二章节奏偏慢，缺乏冲突",
          chapterNumber: 2,
        },
      ],
      lastAuditedAt: new Date().toISOString(),
    }, null, 2),
    "utf-8",
  );

  // Chapter 4: 3 issues (audit-failed)
  await writeFile(
    join(auditDir, "chapter-4.json"),
    JSON.stringify({
      chapterNumber: 4,
      status: "fail",
      issues: [
        {
          type: "logic",
          severity: "error",
          description: "秘境规则与第三章描述不符",
          chapterNumber: 4,
        },
        {
          type: "character",
          severity: "error",
          description: "主角行为与性格设定不符",
          chapterNumber: 4,
        },
        {
          type: "other",
          severity: "warning",
          description: "时间线跳跃不合理",
          chapterNumber: 4,
        },
      ],
      lastAuditedAt: new Date().toISOString(),
    }, null, 2),
    "utf-8",
  );
}

async function expandChapter(page: import("@playwright/test").Page, chapterLabel: string): Promise<void> {
  // Click the chapter header button to expand it
  await page.getByRole("button", { name: new RegExp(chapterLabel) }).first().click();
  await page.waitForTimeout(300);
}

test.beforeAll(async () => {
  await seedChapterAudit();
  await seedAuditData();
});

test("1. 加载审计页面", async ({ page }) => {
  await page.goto(`/#/audit/${E2E_BOOK_ID}`);
  await expect(page.getByRole("heading", { name: "章节审计" })).toBeVisible({ timeout: 20_000 });
});

test("2. 有审计问题的章节展开后显示修复按钮", async ({ page }) => {
  await page.goto(`/#/audit/${E2E_BOOK_ID}`);
  await expect(page.getByRole("heading", { name: "章节审计" })).toBeVisible({ timeout: 20_000 });

  // Expand chapter 2
  await expandChapter(page, "第2章");

  // Chapter 2 has 2 issues → 2 fix buttons should appear
  const fixButtons = page.getByRole("button", { name: /^修复$/ });
  await expect(fixButtons.first()).toBeVisible({ timeout: 5_000 });
});

test("3. 无审计问题的章节展开后不显示修复按钮", async ({ page }) => {
  await page.goto(`/#/audit/${E2E_BOOK_ID}`);
  await expect(page.getByRole("heading", { name: "章节审计" })).toBeVisible({ timeout: 20_000 });

  // Expand chapter 1 (approved, no issues)
  await expandChapter(page, "第1章");

  // Chapter 1 has no issues → no fix buttons
  const fixButtons = page.getByRole("button", { name: /^修复$/ });
  await expect(fixButtons).toHaveCount(0);
});

test("4. 点击修复按钮弹出对话框", async ({ page }) => {
  await page.goto(`/#/audit/${E2E_BOOK_ID}`);
  await expect(page.getByRole("heading", { name: "章节审计" })).toBeVisible({ timeout: 20_000 });

  // Expand chapter 4 (3 issues)
  await expandChapter(page, "第4章");

  // Click the first fix button
  await page.getByRole("button", { name: /^修复$/ }).first().click();

  // Verify dialog appears (use heading to avoid matching multiple elements)
  await expect(page.getByRole("heading", { name: /修复建议/ })).toBeVisible({ timeout: 10_000 });
});

test("5. 修复建议对话框显示正确内容", async ({ page }) => {
  await page.goto(`/#/audit/${E2E_BOOK_ID}`);
  await expect(page.getByRole("heading", { name: "章节审计" })).toBeVisible({ timeout: 20_000 });

  // Expand chapter 2 and click fix
  await expandChapter(page, "第2章");
  await page.getByRole("button", { name: /^修复$/ }).first().click();

  // Verify suggestion items are displayed
  await expect(page.getByText("修复建议（2 项）")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("灵根测试结果前后不一致").first()).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText("第二章节奏偏慢，缺乏冲突").first()).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText("原始内容预览")).toBeVisible({ timeout: 3_000 });

  // Verify apply button
  await expect(page.getByRole("button", { name: "应用修复" })).toBeVisible({ timeout: 3_000 });
});

test("6. 应用修复后刷新章节状态", async ({ page }) => {
  await page.goto(`/#/audit/${E2E_BOOK_ID}`);
  await expect(page.getByRole("heading", { name: "章节审计" })).toBeVisible({ timeout: 20_000 });

  // Expand chapter 2 and click fix
  await expandChapter(page, "第2章");
  await page.getByRole("button", { name: /^修复$/ }).first().click();
  await expect(page.getByText("修复建议（2 项）")).toBeVisible({ timeout: 10_000 });

  // Click apply
  await page.getByRole("button", { name: "应用修复" }).click();

  // Dialog should close after applying — use the heading locator to avoid ambiguity
  await expect(page.getByRole("heading", { name: /修复建议/ })).not.toBeVisible({ timeout: 10_000 });
});

test("7. 修复对话框可关闭", async ({ page }) => {
  await page.goto(`/#/audit/${E2E_BOOK_ID}`);
  await expect(page.getByRole("heading", { name: "章节审计" })).toBeVisible({ timeout: 20_000 });

  // Expand chapter 2 and open fix dialog
  await expandChapter(page, "第2章");
  await page.getByRole("button", { name: /^修复$/ }).first().click();
  await expect(page.getByText("修复建议（2 项）")).toBeVisible({ timeout: 10_000 });

  // Click cancel
  await page.getByRole("button", { name: "取消" }).click();
  await expect(page.getByText("修复建议")).not.toBeVisible({ timeout: 5_000 });
});
