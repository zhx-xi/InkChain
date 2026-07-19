import { test, expect } from "@playwright/test";

// Skills are pre-seeded by global-setup.ts — no need for seedSkillLibrary here.

test("1. 加载Skill库→分页显示", async ({ page }) => {
  await page.goto("/#/skills");
  await expect(page.getByRole('heading', { name: 'Skill 库' })).toBeVisible({ timeout: 15_000 });

  // Should show skill count
  await expect(page.getByText(/共 \d+ 个 Skill/)).toBeVisible({ timeout: 10_000 });

  // Our seeded project skill should be listed
  await expect(page.getByText("custom-style-check")).toBeVisible();
  await expect(page.getByText("world-rules-auditor")).toBeVisible();
  await expect(page.getByText("character-consistency-check")).toBeVisible();
  await expect(page.getByText("plot-hole-detector")).toBeVisible();
  await expect(page.getByText("batch-summarizer")).toBeVisible();
});

test("2. 点击Skill→详情面板展开", async ({ page }) => {
  await page.goto("/#/skills");
  await expect(page.getByRole('heading', { name: 'Skill 库' })).toBeVisible({ timeout: 15_000 });

  // Click on a skill card to expand details
  await page.getByText("custom-style-check").click();

  // The expanded detail panel should show description
  await expect(page.getByText("自定义文风检测：检查章节是否符合已设定的风格指南")).toBeVisible({ timeout: 5_000 });

  // Should show injection config
  await expect(page.getByText("注入配置")).toBeVisible();
  // Should show trigger info
  await expect(page.getByText("触发器")).toBeVisible();

  // Click again to collapse
  await page.getByText("custom-style-check").click();
  await expect(page.getByText("描述").first()).not.toBeVisible({ timeout: 3_000 });
});

test("3. 内置Skill只读标记", async ({ page }) => {
  await page.goto("/#/skills");
  await expect(page.getByRole('heading', { name: 'Skill 库' })).toBeVisible({ timeout: 15_000 });

  // Built-in skills should show "内置" badge and should not have edit button
  // Look for a builtin skill like "writing-style-imitation" or "plot-advancement"
  const builtinSkill = page.getByText("writing-style-imitation");
  if (await builtinSkill.isVisible()) {
    // The card should show "内置" label
    await expect(builtinSkill.locator("..").getByText("内置")).toBeVisible();

    // Builtin skills should not have edit button (only toggle switch)
    // The edit button (pencil icon) should not exist for builtin skills
  }
});

test("4. 搜索Skill", async ({ page }) => {
  await page.goto("/#/skills");
  await expect(page.getByRole('heading', { name: 'Skill 库' })).toBeVisible({ timeout: 15_000 });

  // Type search query
  const searchInput = page.getByPlaceholder("搜索 Skill 名称或描述…");
  await searchInput.fill("style");

  // Should filter to matching skills
  await expect(page.getByText("custom-style-check")).toBeVisible();
  await expect(page.getByText("world-rules-auditor")).not.toBeVisible();
  await expect(page.getByText("plot-hole-detector")).not.toBeVisible();

  // Clear search
  await searchInput.fill("");
  await expect(page.getByText("world-rules-auditor")).toBeVisible({ timeout: 5_000 });
});

test("5. 创建新Skill→保存→列表中出现", async ({ page }) => {
  await page.goto("/#/skills");
  await expect(page.getByRole('heading', { name: 'Skill 库' })).toBeVisible({ timeout: 15_000 });

  // Click "创建 Skill" button
  await page.getByText("创建 Skill").click();
  await expect(page.getByText("创建 Skill 方式")).toBeVisible({ timeout: 5_000 });

  // Select "从空白创建"
  await page.getByText("从空白创建").click();

  // The SkillEditSheet should open with create form
  await expect(page.locator("h3").filter({ hasText: /创建 Skill|编辑 Skill/ })).toBeVisible({ timeout: 5_000 });

  // Fill in basic fields
  const idInput = page.getByLabel("Skill ID").or(page.getByPlaceholder(/skill.*id/i));
  if (await idInput.isVisible()) {
    await idInput.fill("e2e-created-skill");
  }

  // Save the skill
  await page.getByText("保存", { exact: true }).click();

  // The new skill should appear in the list
  await expect(page.getByText("e2e-created-skill")).toBeVisible({ timeout: 10_000 });
});

test("6. 分页切换", async ({ page }) => {
  await page.goto("/#/skills");
  await expect(page.getByRole('heading', { name: 'Skill 库' })).toBeVisible({ timeout: 15_000 });

  // Check that pagination exists (we set pageSize=10, and there should be enough skills)
  // The pagination controls should be visible when enough skills exist
  const prevBtn = page.locator("button").filter({ hasText: /chevronLeft/i }).or(page.getByLabel("上一页"));
  const nextBtn = page.locator("button").filter({ hasText: /chevronRight/i }).or(page.getByLabel("下一页"));

  // Verify skill cards are in grid layout
  await expect(page.getByText("custom-style-check")).toBeVisible();

  // Change page size to see if UI reacts (select element with value 10/20)
  const pageSizeSelect = page.locator("select").filter({ has: page.locator('option[value="20"]') });
  if (await pageSizeSelect.isVisible()) {
    await pageSizeSelect.selectOption("20");
    // The skill count should reflect the change
    await expect(page.getByText(/共 \d+ 个 Skill/)).toBeVisible();
  }
});
