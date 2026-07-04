import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
export const E2E_ROOT = resolve(__dirname, "../../../..", "test-project");
export const E2E_SKILL_BOOK_ID = "e2e-skill-library";

/**
 * Seeds project-level skill configs for E2E testing.
 *
 * Writes skill JSON files to `.inkos/skills/` so the /api/skills endpoint
 * returns a mix of builtin + project skills.
 *
 * Skills created:
 * - custom-style-check: writing category, enabled
 * - world-rules-auditor: world category, disabled
 * - character-consistency-check: character category, enabled
 * - plot-hole-detector: analysis category, enabled
 * - batch-summarizer: utility category, disabled
 */
export async function seedSkillLibrary(): Promise<void> {
  const skillsDir = join(E2E_ROOT, ".inkos", "skills");
  await mkdir(skillsDir, { recursive: true });

  const skills = [
    {
      id: "custom-style-check",
      category: "writing" as const,
      enabled: true,
      description: "自定义文风检测：检查章节是否符合已设定的风格指南",
      triggers: [
        { type: "post_write" as const, condition: "true" },
      ],
      injection: { mode: "append" as const, target: "system_prompt" as const, priority: 50 },
      params: {},
      prompt: "请检查以下文本是否符合用户定义的目标文风。",
    },
    {
      id: "world-rules-auditor",
      category: "world" as const,
      enabled: false,
      description: "世界规则审计：验证新章节是否与世界设定中的规则一致",
      triggers: [
        { type: "post_write" as const, condition: "true" },
      ],
      injection: { mode: "append" as const, target: "system_prompt" as const, priority: 60 },
      params: {},
      prompt: "请审核以下内容是否违反已建立的世界规则。",
    },
    {
      id: "character-consistency-check",
      category: "character" as const,
      enabled: true,
      description: "角色一致性检查：确保角色行为与性格设定一致",
      triggers: [
        { type: "post_write" as const, condition: "true" },
      ],
      injection: { mode: "append" as const, target: "system_prompt" as const, priority: 55 },
      params: {},
      prompt: "请检查角色行为是否符合其性格设定。",
    },
    {
      id: "plot-hole-detector",
      category: "analysis" as const,
      enabled: true,
      description: "情节漏洞检测：识别时间线矛盾、逻辑断裂等情节问题",
      triggers: [
        { type: "post_write" as const, condition: "true" },
      ],
      injection: { mode: "prepend" as const, target: "user_prompt" as const, priority: 70 },
      params: {},
      prompt: "请分析以下文本，找出可能的情节漏洞。",
    },
    {
      id: "batch-summarizer",
      category: "utility" as const,
      enabled: false,
      description: "批量摘要工具：将多章节内容压缩为摘要",
      triggers: [
        { type: "manual" as const },
      ],
      injection: { mode: "append" as const, target: "system_prompt" as const, priority: 40 },
      params: {},
      prompt: "请将以下内容压缩为简洁的摘要。",
    },
  ];

  for (const skill of skills) {
    await writeFile(
      join(skillsDir, `${skill.id}.json`),
      JSON.stringify(skill, null, 2),
      "utf-8",
    );
  }

  // ── Project book for skill context ──
  const bookDir = join(E2E_ROOT, "books", E2E_SKILL_BOOK_ID);
  await mkdir(bookDir, { recursive: true });

  const now = new Date("2026-07-04T00:00:00.000Z").toISOString();
  await writeFile(
    join(bookDir, "book.json"),
    JSON.stringify({
      id: E2E_SKILL_BOOK_ID,
      title: "E2E Skill 库测试项目",
      platform: "webnovel",
      genre: "xianxia",
      status: "active",
      targetChapters: 10,
      chapterWordCount: 2000,
      language: "zh",
      createdAt: now,
      updatedAt: now,
    }, null, 2),
    "utf-8",
  );
}
