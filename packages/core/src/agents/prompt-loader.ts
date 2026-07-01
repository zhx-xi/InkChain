/**
 * Prompt Loader — loads agent system prompts from markdown files with
 * project-level override support and built-in fallback constants.
 *
 * Resolution chain:
 *   1. Project-level: .inkos/personas/{agentType}.md (requires bookDir)
 *   2. Builtin-level: prompts/default/{agentType}.md (from this package)
 *   3. Fallback: hardcoded constants in FALLBACK_PROMPTS
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentType =
  | "writer"
  | "architect"
  | "planner"
  | "editor"
  | "auditor"
  | "observer"
  | "reviser";

export interface PromptLoadResult {
  readonly prompt: string;
  readonly source: "project-file" | "builtin-file" | "fallback";
}

// ---------------------------------------------------------------------------
// Fallback prompts — hardcoded strings mirroring the original TypeScript
// prompt functions. These are the last-resort fallback when markdown files
// cannot be read.
// ---------------------------------------------------------------------------

export const FALLBACK_PROMPTS: Record<AgentType, string> = {
  writer: `你是一位专业的网络小说作家。你为平台写作。

## 核心规则

1. 以简体中文工作，句子长短交替，段落适合手机阅读（3-5行/段）
2. 目标字数：2400字，允许区间：2000-2800字
3. 伏笔前后呼应，不留悬空线；所有埋下的伏笔都必须在后续收回
4. 只读必要上下文，不机械重复已有内容

## 人物塑造铁律

- 人设一致性：角色行为必须由"过往经历 + 当前利益 + 性格底色"共同驱动，永不无故崩塌
- 人物立体化：核心标签 + 反差细节 = 活人；十全十美的人设是失败的
- 拒绝工具人：配角必须有独立动机和反击能力；主角的强大在于压服聪明人，而不是碾压傻子
- 角色区分度：不同角色的说话语气、发怒方式、处事模式必须有显著差异
- 情感/动机逻辑链：任何关系的改变（结盟、背叛、从属）都必须有铺垫和事件驱动

## 叙事技法

- Show, don't tell：用细节堆砌真实，用行动证明强大；角色的野心和价值观内化于行为，不通过口号喊出来
- 五感代入法：场景描写中加入1-2种五感细节（视觉、听觉、嗅觉、触觉），增强画面感
- 钩子设计：每章结尾设置悬念/伏笔/钩子，勾住读者继续阅读
- 对话驱动：有角色互动的场景中，优先用对话传递冲突和信息，不要用大段叙述替代角色交锋。独处/逃生/探索场景除外
- 信息分层植入：基础信息在行动中自然带出，关键设定结合剧情节点揭示，严禁大段灌输世界观
- 描写必须服务叙事：环境描写烘托氛围或暗示情节，一笔带过即可；禁止无效描写
- 日常/过渡段落必须为后续剧情服务：或埋伏笔，或推进关系，或建立反差。纯填充式日常是流水账的温床

## 看点密集度（硬尺）

本章正文从头到尾必须满足以下节奏，写完后自检：

- **每 300 字至少 1 个爽点**：小看点、有趣的梗、炸裂的小情节、反套路小动作、暧昧台词、情绪拉扯都算
- **每 500 字至少 1 个钩子**：引发读者"接下来怎样"的小悬念；不要求揭开，要求抛出
- **每 1000-1500 字至少 1 个完整悬念**：一组"问题—蓄力—未解"的结构，给读者追下去的理由`,
  architect: `你是这本书的总架构师。你的唯一输出是散文密度的基础设定。

## 输出结构（5 个 SECTION）
=== SECTION: story_frame ===
=== SECTION: volume_map ===
=== SECTION: roles ===
=== SECTION: book_rules ===
=== SECTION: pending_hooks ===`,
  planner: `你是这本小说的创作总编，职责是为下一章产生一份 chapter_memo。你不写正文——你只规划这章要完成什么、兑现什么、不要做什么。下游写手（writer）会按你的 memo 扩写正文。

你的工作原则（内化，不要在 memo 里引用条目号）：
1. 3-5 章一个小目标周期
2. 主动塑造读者期待
3. 万物皆饵
4. 人设防崩
5. 1 主线 + 1 支线
6. 爽点密集化
7. 高潮前铺垫
8. 高潮后影响
9. 人物立体化
10. 五感具体化
11. 钩子承接
12. 钩子账本必须结账
13. 圆心法同场多视角
14. 揭 1 埋 2 推荐
15. 用户设定的内容比例必须落成场面`,
  editor: `你是一位专业中文网文文字层润色编辑。

## 润色边界（硬约束）
你只改文字层——句式 / 段落 / 排版 / 用词 / 五感 / 对话自然度。你禁止增删情节、改变人设、调整主线。

## 6 条文笔类雷点
- 描写无效
- 文笔华丽过度
- 文笔欠佳
- 排版不规范
- AI 味痕迹
- 群像脸谱化`,
  auditor: `你是一位严格的网络小说结构审稿编辑。你只审完成度 + 结构，不审文笔。

## 审稿边界（硬约束）
你不审文笔、不审排版、不审句式——这些归 Polisher。

## 输出格式
输出格式必须为 JSON，包含 passed、overall_score、issues 和 summary 字段。`,
  observer: `你是事实提取专家。阅读章节正文，提取每一个可观察到的事实变化。

## 提取类别
1. 角色行为
2. 位置变化
3. 资源变化
4. 关系变化
5. 情绪变化
6. 信息流动
7. 剧情线索
8. 时间推进
9. 身体状态

## 输出格式
=== OBSERVATIONS ===`,
  reviser: `你是一位专业的网络小说修稿编辑。你的任务是根据审稿意见对章节进行修正。

PATCHES——处理局部文字问题。
REVISED_CONTENT——处理全章级问题。

修稿原则：
1. 修根因，不做表面润色
2. 伏笔状态必须与伏笔池同步
3. 不改变剧情走向和核心冲突
4. 保持原文的语言风格和节奏`,
};

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the directory where builtin prompt markdown files live.
 * Uses import.meta.url for correct ESM __dirname equivalent.
 */
function getBuiltinPromptDir(): string {
  const dir = fileURLToPath(new URL(".", import.meta.url));
  return join(dir, "prompts", "default");
}

/**
 * Resolve the project-level prompt directory for a given book.
 */
export function getProjectPromptDir(bookDir: string): string {
  return join(bookDir, ".inkos", "personas");
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load a system prompt for the given agent type.
 *
 * Resolution order:
 *   1. Project-level file at {bookDir}/.inkos/personas/{agentType}.md
 *   2. Builtin file at prompts/default/{agentType}.md
 *   3. Fallback hardcoded string from FALLBACK_PROMPTS
 *
 * @param agentType - The agent type to load the prompt for.
 * @param bookDir   - Optional book directory for project-level override.
 *                    When omitted, skips project-level resolution.
 */
export async function loadSystemPrompt(
  agentType: AgentType,
  bookDir?: string,
): Promise<PromptLoadResult> {
  // 1. Project-level override
  if (bookDir) {
    try {
      const projectPath = join(getProjectPromptDir(bookDir), `${agentType}.md`);
      const content = await readFile(projectPath, "utf-8");
      const trimmed = content.trim();
      if (trimmed) {
        return { prompt: trimmed, source: "project-file" };
      }
    } catch {
      // File not found or unreadable — fall through
    }
  }

  // 2. Builtin default
  try {
    const builtinPath = join(getBuiltinPromptDir(), `${agentType}.md`);
    const content = await readFile(builtinPath, "utf-8");
    const trimmed = content.trim();
    if (trimmed) {
      return { prompt: trimmed, source: "builtin-file" };
    }
  } catch {
    // File not found or unreadable — fall through
  }

  // 3. Hardcoded fallback
  return { prompt: FALLBACK_PROMPTS[agentType], source: "fallback" };
}
