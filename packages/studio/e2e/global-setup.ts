import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import { mkdirSync, writeFileSync } from "fs";

/**
 * Rebuild @inkchain/inkchain-core before E2E tests start.
 *
 * The E2E API server (tsx watch src/api/index.ts) imports core via the pnpm
 * workspace symlink, which resolves to packages/core/dist/index.js — the
 * compiled output, not the TypeScript source.  If dist/ is stale the server
 * runs old code regardless of what the TypeScript sources say, causing
 * otherwise-correct agent logic (e.g. the terminalToolResultTail guard) to be
 * silently absent at runtime.
 *
 * Rebuilding here ensures the dist is always fresh before tests run.
 */
export default function globalSetup(): void {
  const thisFile = fileURLToPath(import.meta.url);
  // From packages/studio/e2e: ../ = studio, ../../ = packages, ../../../ = the
  // worktree/workspace root (where pnpm-workspace.yaml lives). A fourth ../ would
  // point at the .worktrees parent, where the --filter matches nothing and the
  // build silently no-ops, leaving core dist stale (agent stub absent at runtime).
  const workspaceRoot = path.resolve(path.dirname(thisFile), "../../../");

  // ════════════════════════════════════════════════════════════════
  //  E2E test-project root — MUST match the API's resolution of
  //  INKCHAIN_PROJECT_ROOT (which is "test-project" relative to
  //  process.cwd() = packages/studio/ in CI).
  //  Do NOT use __dirname-relative paths here; use the same
  //  resolution the API uses (resolve(process.cwd(), "test-project")).
  // ════════════════════════════════════════════════════════════════
  const testProjectDir = path.resolve(process.cwd(), "test-project");
  mkdirSync(testProjectDir, { recursive: true });

  // ── 1. inkchain.json (project config, required by /api/v1/project) ──
  writeFileSync(
    path.join(testProjectDir, "inkchain.json"),
    JSON.stringify({
      name: "E2E Test Project",
      version: "0.1.0",
      language: "zh",
      llm: {
        provider: "openai",
        service: "custom",
        configSource: "env",
        baseUrl: "http://localhost:11434/v1",
        apiKey: "",
        model: "gpt-4o-mini",
        temperature: 0.7,
        thinkingBudget: 0,
        apiFormat: "chat",
        stream: true,
      },
    }, null, 2),
    "utf-8",
  );

  // ── 2. Skill library seed data (for skill-library.spec.ts / #589) ──
  const skillsDir = path.join(testProjectDir, ".inkos", "skills");
  mkdirSync(skillsDir, { recursive: true });

  // ⚠️ TriggerTypeEnum only accepts "manual" or "condition" — match the Zod schema exactly!
  const skills = [
    { id: "custom-style-check", category: "writing", enabled: true, description: "自定义文风检测：检查章节是否符合已设定的风格指南", triggers: [{ type: "condition", condition: "true" }], injection: { mode: "append", target: "system_prompt", priority: 50 }, params: {}, prompt: "请检查以下文本是否符合用户定义的目标文风。" },
    { id: "world-rules-auditor", category: "world", enabled: false, description: "世界规则审计：验证新章节是否与世界设定中的规则一致", triggers: [{ type: "condition", condition: "true" }], injection: { mode: "append", target: "system_prompt", priority: 60 }, params: {}, prompt: "请审核以下内容是否违反已建立的世界规则。" },
    { id: "character-consistency-check", category: "character", enabled: true, description: "角色一致性检查：确保角色行为与性格设定一致", triggers: [{ type: "condition", condition: "true" }], injection: { mode: "append", target: "system_prompt", priority: 55 }, params: {}, prompt: "请检查角色行为是否符合其性格设定。" },
    { id: "plot-hole-detector", category: "analysis", enabled: true, description: "情节漏洞检测：识别时间线矛盾、逻辑断裂等情节问题", triggers: [{ type: "condition", condition: "true" }], injection: { mode: "prepend", target: "user_prompt", priority: 70 }, params: {}, prompt: "请分析以下文本，找出可能的情节漏洞。" },
    { id: "batch-summarizer", category: "utility", enabled: false, description: "批量摘要工具：将多章节内容压缩为摘要", triggers: [{ type: "manual" }], injection: { mode: "append", target: "system_prompt", priority: 40 }, params: {}, prompt: "请将以下内容压缩为简洁的摘要。" },
  ];
  for (const skill of skills) {
    writeFileSync(
      path.join(skillsDir, `${skill.id}.json`),
      JSON.stringify(skill, null, 2),
      "utf-8",
    );
  }

  // Skill library book (for skill context)
  const skillBookDir = path.join(testProjectDir, "books", "e2e-skill-library");
  mkdirSync(skillBookDir, { recursive: true });
  writeFileSync(
    path.join(skillBookDir, "book.json"),
    JSON.stringify({
      id: "e2e-skill-library",
      title: "E2E Skill 库测试项目",
      platform: "webnovel", genre: "xianxia", status: "active",
      targetChapters: 10, chapterWordCount: 2000, language: "zh",
      createdAt: "2026-07-04T00:00:00.000Z",
      updatedAt: "2026-07-04T00:00:00.000Z",
    }, null, 2),
    "utf-8",
  );

  // ── 3. Foreshadowing seed data (for foreshadowing-flow.spec.ts / #590) ──
  const foreshadowingDir = path.join(testProjectDir, ".inkos", "foreshadowing");
  mkdirSync(foreshadowingDir, { recursive: true });

  const now = "2026-07-04T00:00:00.000Z";
  const foreshadowingEntries = [
    { id: "fs-e2e-1", bookId: "e2e-volume-dnd", title: "神秘戒指", description: "主角在第一章获得的戒指，实则隐藏着上古力量", type: "物品伏笔", status: "active", createdChapter: 1, lastMentionedChapter: 3, expectedPayoffChapter: 10, payoffChapter: null, notes: "戒指的来历将在中卷揭晓", createdAt: now, updatedAt: now },
    { id: "fs-e2e-2", bookId: "e2e-volume-dnd", title: "门口的石像", description: "村口石像的眼睛在月圆之夜会发光", type: "设定伏笔", status: "active", createdChapter: 2, lastMentionedChapter: 2, expectedPayoffChapter: null, payoffChapter: null, notes: "", createdAt: now, updatedAt: now },
    { id: "fs-e2e-3", bookId: "e2e-volume-dnd", title: "神秘的预言", description: "长老说'天降异象，必有大事发生'", type: "情节伏笔", status: "paid_off", createdChapter: 1, lastMentionedChapter: 8, expectedPayoffChapter: 8, payoffChapter: 8, notes: "预言在第8章应验", createdAt: now, updatedAt: now },
    { id: "fs-e2e-4", bookId: "e2e-volume-dnd", title: "失踪的师父", description: "主角师父在三年前神秘失踪", type: "角色伏笔", status: "active", createdChapter: 1, lastMentionedChapter: 5, expectedPayoffChapter: 20, payoffChapter: null, notes: "师父去向成谜", createdAt: now, updatedAt: now },
    { id: "fs-e2e-5", bookId: "e2e-volume-dnd", title: "古墓钥匙", description: "祖传的钥匙能打开后山古墓", type: "物品伏笔", status: "abandoned", createdChapter: 3, lastMentionedChapter: 3, expectedPayoffChapter: null, payoffChapter: null, notes: "这条线已经废弃", createdAt: now, updatedAt: now },
  ];
  for (const entry of foreshadowingEntries) {
    writeFileSync(
      path.join(foreshadowingDir, `${entry.id}.json`),
      JSON.stringify(entry, null, 2),
      "utf-8",
    );
  }

  // ── 4. e2e-volume-dnd book (needed for foreshadowing/volume tests) ──
  const volBookDir = path.join(testProjectDir, "books", "e2e-volume-dnd");
  mkdirSync(volBookDir, { recursive: true });
  writeFileSync(
    path.join(volBookDir, "book.json"),
    JSON.stringify({
      id: "e2e-volume-dnd",
      title: "E2E Volume Drag-and-Drop",
      platform: "webnovel", genre: "xianxia", status: "active",
      targetChapters: 100, chapterWordCount: 2000, language: "zh",
      createdAt: "2026-07-04T00:00:00.000Z",
      updatedAt: "2026-07-04T00:00:00.000Z",
    }, null, 2),
    "utf-8",
  );

  // Volume DnD book: add chapter index so the book has content
  const volChaptersDir = path.join(volBookDir, "chapters");
  mkdirSync(volChaptersDir, { recursive: true });
  writeFileSync(
    path.join(volChaptersDir, "index.json"),
    JSON.stringify([
      { number: 1, title: "初始", status: "completed", wordCount: 2100, createdAt: now, updatedAt: now },
      { number: 2, title: "启程", status: "completed", wordCount: 1950, createdAt: now, updatedAt: now },
      { number: 3, title: "奇遇", status: "completed", wordCount: 2050, createdAt: now, updatedAt: now },
    ], null, 2),
    "utf-8",
  );

  // Chapter content files
  for (const ch of [{n:1,t:"初始"}, {n:2,t:"启程"}, {n:3,t:"奇遇"}]) {
    const padded = String(ch.n).padStart(4, "0");
    writeFileSync(
      path.join(volChaptersDir, `${padded}_${ch.t}.md`),
      `# 第 ${ch.n} 章 ${ch.t}\n\n这是 E2E 测试章节内容。\n`,
      "utf-8",
    );
  }

  // ── 5. e2e-sidebar-nav book (for book-detail.spec.ts & book-style-page.spec.ts / #583) ──
  const sidebarNavBookDir = path.join(testProjectDir, "books", "e2e-sidebar-nav");
  mkdirSync(sidebarNavBookDir, { recursive: true });
  writeFileSync(
    path.join(sidebarNavBookDir, "book.json"),
    JSON.stringify({
      id: "e2e-sidebar-nav",
      title: "E2E 侧边栏导航测试",
      platform: "webnovel", genre: "xianxia", status: "active",
      targetChapters: 10, chapterWordCount: 2000, language: "zh",
      createdAt: now, updatedAt: now,
    }, null, 2),
    "utf-8",
  );

  const sidebarNavChaptersDir = path.join(sidebarNavBookDir, "chapters");
  mkdirSync(sidebarNavChaptersDir, { recursive: true });
  writeFileSync(
    path.join(sidebarNavChaptersDir, "index.json"),
    JSON.stringify([
      { number: 1, title: "第01章", status: "drafted", wordCount: 1000, createdAt: now, updatedAt: now, volumeId: null, auditIssues: [], lengthWarnings: [] },
      { number: 2, title: "第02章", status: "drafted", wordCount: 1000, createdAt: now, updatedAt: now, volumeId: null, auditIssues: [], lengthWarnings: [] },
      { number: 3, title: "第03章", status: "drafted", wordCount: 1000, createdAt: now, updatedAt: now, volumeId: null, auditIssues: [], lengthWarnings: [] },
    ], null, 2),
    "utf-8",
  );

  // ── 6. e2e-book-world-test world (for book-world-extract.spec.ts / #583) ──
  const worldsDir = path.join(testProjectDir, ".inkos", "worlds");
  mkdirSync(worldsDir, { recursive: true });
  writeFileSync(
    path.join(worldsDir, "e2e-book-world-test.json"),
    JSON.stringify({
      id: "e2e-book-world-test",
      name: "玄幻修仙世界",
      description: "以修仙为主题的世界设定，包含多种修炼体系和宗门势力",
      createdAt: now, updatedAt: now,
      settings: [
        { id: "s-1", name: "灵气修炼", type: "魔法体系", description: "万物皆有灵气", constraints: [], sortIndex: 0 },
      ],
      roles: [
        { id: "r-1", name: "叶辰", role: "主角", description: "废材逆袭", significance: 5, sortIndex: 0, institutionIds: [], regionIds: [] },
      ],
      relations: [
        { id: "rel-1", sourceId: "r-1", targetId: "r-1", type: "师徒", description: "", sortIndex: 0 },
      ],
      regions: [
        { id: "rg-1", name: "灵武大陆", parentId: null, type: "大陆", description: "", sortIndex: 0, x: null, y: null, regionType: "continent" },
      ],
      institutions: [
        { id: "i-1", name: "青云宗", type: "宗门", leaderId: null, members: [], description: "", sortIndex: 0, regionId: null },
      ],
      history: [
        { id: "h-1", title: "创世之战", timestamp: "远古", description: "天地初开的战争", affectedRegions: [], significance: 5, sortIndex: 0 },
      ],
      rules: [
        { id: "rule-1", name: "修仙等级", type: "魔法", description: "练气→筑基→金丹→元婴", constraints: [], sortIndex: 0 },
      ],
      references: [],
    }, null, 2),
    "utf-8",
  );

  // ── 7. Build core ──
  try {
    execSync("pnpm --filter @inkchain/inkchain-core build", {
      cwd: workspaceRoot,
      stdio: "inherit",
    });
  } catch {
    console.warn("[global-setup] Core build failed (dist may be stale), proceeding anyway");
  }

  console.log("[global-setup] All E2E seed data created successfully");
}
