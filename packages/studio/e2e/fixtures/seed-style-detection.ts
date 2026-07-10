import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
export const E2E_ROOT = resolve(__dirname, "../../", "test-project");
export const E2E_STYLE_BOOK_ID = "e2e-style-detection";

/**
 * Seeds chapter content with known style patterns for style detection E2E testing.
 *
 * Creates a book with multiple chapters, each containing text with distinctive
 * style characteristics (sentence length, vocabulary, rhetorical features).
 *
 * Chapter 1 (approved): Short, punchy sentences — typical xianxia action style
 * Chapter 2 (drafted): Long, descriptive sentences — literary/descriptive style
 * Chapter 3 (drafted): Dialogue-heavy with varied sentence length
 */
export async function seedStyleDetection(): Promise<void> {
  const bookDir = join(E2E_ROOT, "books", E2E_STYLE_BOOK_ID);
  const chaptersDir = join(bookDir, "chapters");
  const stateDir = join(bookDir, "story", "state");

  const now = new Date("2026-07-04T00:00:00.000Z").toISOString();

  // ── Book Config ──
  await mkdir(bookDir, { recursive: true });
  const bookJsonPath = join(bookDir, "book.json");
  try {
    await writeFile(
      bookJsonPath,
      JSON.stringify({
        id: E2E_STYLE_BOOK_ID,
        title: "E2E 文风检测测试",
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
  } catch {
    // File may already exist
  }

  // ── Chapter index ──
  await mkdir(chaptersDir, { recursive: true });
  await writeFile(
    join(chaptersDir, "index.json"),
    JSON.stringify([
      { number: 1, title: "第一章 初入战场", status: "approved", wordCount: 1200, createdAt: now, updatedAt: now, volumeId: null, auditIssues: [], lengthWarnings: [] },
      { number: 2, title: "第二章 暗流涌动", status: "drafted", wordCount: 1500, createdAt: now, updatedAt: now, volumeId: null, auditIssues: [], lengthWarnings: [] },
      { number: 3, title: "第三章 智者之言", status: "drafted", wordCount: 1300, createdAt: now, updatedAt: now, volumeId: null, auditIssues: [], lengthWarnings: [] },
    ], null, 2),
    "utf-8",
  );

  // ── Chapter 1: Short, punchy action style ──
  const chapter1Text = (
    "狂风呼啸。天地变色。\n\n" +
    "李凡握紧长剑。剑刃反射着寒光。他的眼神冰冷而坚定。\n\n" +
    "敌人冲了过来。速度极快。地面在脚下碎裂。\n\n" +
    "李凡侧身一闪。剑光划过。一道血线飞溅。\n\n" +
    "战斗结束了。他收起长剑。转身离去。\n\n" +
    "身后是满目疮痍的战场。"
  );

  // ── Chapter 2: Long, descriptive style ──
  const chapter2Text = (
    "当最后一抹夕阳的余晖悄然隐没在西山之下，整个小镇便被一层朦胧的暮色所笼罩。\n\n" +
    "街道两旁的灯笼次第亮起，橘黄色的光晕在青石板路上投下斑驳陆离的影子。远处传来几声犬吠，夹杂着茶馆里若有若无的谈笑声。\n\n" +
    "林小月站在阁楼的窗前，望着这座渐渐沉睡的小城，心中涌起一股难以言说的怅惘。她想起三年前那个同样暮色苍茫的傍晚，师父就是在这里将那块玉佩交到她手中的。\n\n" +
    "「此物关系重大，务必妥善保管。」师父的话语犹在耳畔回响，然而那慈祥的面容却已在记忆中渐渐模糊。\n\n" +
    "她轻轻摩挲着腰间温润的玉佩，感受着那上面细致入微的纹路，仿佛能从中读出某种古老的预言。夜色渐深，远方的天际隐约传来一声悠长的鹤鸣。"
  );

  // ── Chapter 3: Dialogue-heavy mixed style ──
  const chapter3Text = (
    "「你真的决定了？」老者问道，语气中带着一丝不易察觉的忧虑。\n\n" +
    "「是的。」青年回答得很干脆。\n\n" +
    "「那可是九死一生。」\n\n" +
    "「死又何惧。」青年抬起头，目光如炬，「若连试都不敢试，此生与草木何异？」\n\n" +
    "老者沉默良久，终于缓缓点头：「既然如此，我便将毕生所学传授于你。但你需记住——力量越大，责任越重。」\n\n" +
    "青年深深一拜：「弟子谨记。」\n\n" +
    "窗外忽然刮起一阵大风。窗棂发出吱呀的响声。\n\n" +
    "老者微微一笑：「看来，连老天都在为你送行了。」\n\n" +
    "青年站起身，大步走向门外。他的脚步坚定而有力。"
  );

  await writeFile(join(chaptersDir, "1.json"), JSON.stringify({ number: 1, content: chapter1Text }, null, 2), "utf-8");
  await writeFile(join(chaptersDir, "2.json"), JSON.stringify({ number: 2, content: chapter2Text }, null, 2), "utf-8");
  await writeFile(join(chaptersDir, "3.json"), JSON.stringify({ number: 3, content: chapter3Text }, null, 2), "utf-8");

  // ── story/chapters/index.json for volume-based routes ──
  await mkdir(join(bookDir, "story", "chapters"), { recursive: true });
  await writeFile(
    join(bookDir, "story", "chapters", "index.json"),
    JSON.stringify({ chapters: [
      { number: 1, title: "第一章 初入战场", status: "approved", wordCount: 1200, createdAt: now, updatedAt: now, volumeId: null },
      { number: 2, title: "第二章 暗流涌动", status: "drafted", wordCount: 1500, createdAt: now, updatedAt: now, volumeId: null },
      { number: 3, title: "第三章 智者之言", status: "drafted", wordCount: 1300, createdAt: now, updatedAt: now, volumeId: null },
    ]}, null, 2),
    "utf-8",
  );

  // ── story/state/volumes.json ──
  await mkdir(stateDir, { recursive: true });
  await writeFile(
    join(stateDir, "volumes.json"),
    JSON.stringify({ schemaVersion: "1", volumes: [] }, null, 2),
    "utf-8",
  );
}
