# InkChain v1.5a Sprint 1 — 增量 PRD

**文档编号**：prd-sprint-1-role-tiering-relations
**日期**：2026-07-01
**类型**：增量 PRD（基于 v1.5a MVP 主 PRD）
**Sprint 周期**：W1（第1周）
**关联文档**：prd-inkos-novel-agent-2026-07-01、inkos-execution-startup-plan-2026-07-01
**编写者**：Alice · Product Manager

---

## 1. Sprint 1 产品目标

**一句话概括**：完成角色从2级到5级分层的用户可感知改动，并搭建关系数据模型的基础设施，为 Sprint 2 关系图面板铺路。

**用户价值**：长篇网文作者首次感受到角色管理不再混乱——50+角色可按出场层级筛选，客串/一次性角色不再干扰主角和重要角色的查看。关系数据模型虽不可见，但为后续关系图可视化打下基础。

**首次可感知改动时间点**：W1 周末，用户角色列表即可看到5级分层。

---

## 2. 用户故事

### US-S1-01：角色5级分层 — "客串角色终于不跟主角混在一起了"
**场景**：作者王芳的仙侠小说有47个角色——5个主角、12个重要角色、20个次要角色、8个客串、2个一次性角色。当前只有major/minor两级，全混在一起。
**用户故事**：作为多角色长篇作者，我希望能按出场层级（主角/支持/客串/一次性/场景专属）分类管理角色，以便在写作时快速筛选出需要关注的角色，不被大量一次性角色干扰。
**对应任务**：S1-3、S1-4、S1-5

### US-S1-02：角色层级筛选 — "我只想看重要角色"
**场景**：作者想快速查看所有"重要"层级的角色，但当前必须翻遍全部47个角色。
**用户故事**：作为长篇作者，我希望能按层级Tab筛选角色列表，并用不同颜色区分层级，以便一目了然地掌握角色体系结构。
**对应任务**：S1-5

### US-S1-03：角色编辑时设定层级 — "新建角色应该选好层级"
**场景**：作者新建了一个客串角色，创建完成后还需要手动移动到对应目录。
**用户故事**：作为作者，我希望在新建角色时直接选择层级（5选1），角色自动归入对应分类，无需事后调整。
**对应任务**：S1-4

### US-S1-04：关系数据模型就位 — "关系数据有结构化管理了"
**场景**：关系图谱功能依赖关系数据的结构化存储，当前只有简单的6节点 SVG 展示。
**用户故事**：作为开发视角，relations.json 的 Zod schema 和 CRUD API 是关系图功能的前提条件——数据模型先就位，可视化后跟上。
**对应任务**：S1-1、S1-2

### US-S1-05：用户数据安全保障
**场景**：用户30章/13.4万字的小说数据目前没有任何版本管理或备份。
**用户故事**：作为用户，我不希望在开发过程中因意外操作丢失现有的全部创作数据。
**对应任务**：S1-7

### US-S1-06：法律合规 — "隐私政策和开源声明需要到位"
**场景**：二次开发项目需要 AGPL-3.0 合规，用户隐私政策需明确。
**用户故事**：作为项目运营方，我们需要在首次发布前完成隐私政策、服务条款和 AGPL 开源声明，确保法律合规。
**对应任务**：S1-8

---

## 3. 需求池（P0/P1/P2 优先级）

### P0 — Must have（Sprint 1 核心交付）

| 编号 | 需求 | 对应任务 | 估算工时 | 依赖 |
|------|------|----------|----------|------|
| R-S1-01 | **relations.json Zod schema 定义** | S1-1 | 2d | 无 |
| R-S1-02 | **relations.json CRUD API（Hono路由）** | S1-2 | 3d | R-S1-01 |
| R-S1-03 | **角色5级分层枚举定义** | S1-3 | 1d | 无 |
| R-S1-04 | **CharacterMeta.role 升级 + UI 选择器** | S1-4 | 2d | R-S1-03 |
| R-S1-05 | **角色列表页分层过滤 + 视觉区分** | S1-5 | 2d | R-S1-04 |
| R-S1-06 | **单元测试：Zod schema + API CRUD** | S1-6 | 1d | R-S1-01, R-S1-02 |

### P1 — Should have（Sprint 1 周期内但可酌情延后）

| 编号 | 需求 | 对应任务 | 估算工时 | 依赖 |
|------|------|----------|----------|------|
| R-S1-07 | **🚨 用户数据备份（git init + 打包）** | S1-7 | 0.5d | 无 |
| R-S1-08 | **法律合规：隐私政策 + AGPL 声明** | S1-8 | 3d | 无 |

> **说明**：S1-7 和 S1-8 标记为 P1 是因为它们与核心功能开发可完全并行执行，不影响角色分层和关系模型的核心交付。但 S1-7（数据备份）的**业务紧急度**最高——用户数据无备份的风险大于功能缺失。

### 需求依赖关系图

```
R-S1-03 (角色枚举) ──→ R-S1-04 (UI选择器) ──→ R-S1-05 (过滤+视觉)
                        ↓
R-S1-01 (relations schema) ──→ R-S1-02 (CRUD API)
                                  ↓
                             R-S1-06 (单元测试)
```

---

## 4. UI 设计参考

### 4.1 角色分层管理 — 原型参考

**原型文件**：`deliverables/prototypes/v1.5a-mvp/character-tiering.html`

关键交互元素：

| UI 元素 | 描述 | 原型参考 |
|---------|------|---------|
| **层级 Tab 栏** | 角色面板顶部显示6个Tab：[全部] [主角] [重要] [次要] [客串] [一次性]，选中高亮品牌色 | character-tiering.html Tab Bar |
| **角色卡片** | 白色卡片展示：层级徽章（圆形，5级5色）+ 角色名 + 层级标签 + 角色描述 + 操作按钮 | character-tiering.html .char-card |
| **层级配色** | 主角=金色(#D4A855) ★、重要=蓝色(#4A8FD4) ★、次要=灰蓝(#8888AA) ●、客串=灰色(#AAAAAA) ●、一次性=浅灰(#CCCCCC) · | character-tiering.html CSS tier variables |
| **图例** | 底部展示5级图例，标注每级定义（如"主角 — 全程推动核心叙事"） | character-tiering.html .legend |
| **统计栏** | 显示当前筛选结果 + 总字数引用 + 出场率统计 | character-tiering.html .stats-bar |
| **新建角色按钮** | 页面右上角"+ 新建角色"按钮，点击弹出层级选择器 | character-tiering.html .btn-brand |
| **角色操作** | 每张卡片右侧：编辑 / 关系图 / 时间线（按层级决定显示项） | character-tiering.html .char-actions |

**层级命名映射**（执行计划 S1-3 枚举 → 原型显示名）：

| 枚举值 | 原型显示名 | 英文 | 说明 |
|--------|-----------|------|------|
| `protagonist` | 主角 | Protagonist | 全程推动核心叙事 |
| `supporting` | 重要角色 | Supporting | 关键段落/支线驱动 |
| `guest` | 次要角色 | Guest | 阶段性辅助/转变 |
| `one-shot` | 客串角色 | One-shot | 场景NPC/群像 |
| `scene` | 一次性/场景专属 | Scene | 1-2句出场·可归档 |

> **注意**：原型中的层级命名（主角/重要/次要/客串/一次性）与 S1-3 枚举定义（protagonist/supporting/guest/one-shot/scene）存在映射差异。Sprint 1 **以实现枚举定义为准**，原型命名作为UI显示层的参考。前端显示名称可由产品确认最终文案。

### 4.2 关系数据模型（后端不可见部分）

**数据流**：角色关系数据通过新的 relations.json 文件持久化，CRUD API 提供5个端点：
- `GET /api/relations` — 获取所有关系
- `GET /api/relations?character=:name` — 按角色查询关系
- `POST /api/relations` — 创建新关系
- `PUT /api/relations/:id` — 更新关系
- `DELETE /api/relations/:id` — 删除关系

此数据模型在 Sprint 1 无前端 UI——它将作为 Sprint 2 关系图面板的数据源。

### 4.3 其他原型参考（Sprint 1 不涉及，但上下文参考）

| 原型 | 文件 | Sprint 1 关联 |
|------|------|--------------|
| 分卷管理 | volume-management.html | Sprint 3 交付，Sprint 1 仅知悉设计方向 |
| 会话归档 | session-archive.html | 后续 Sprint，Sprint 1 不涉及 |
| 卡文突破 | writers-block-breakthrough.html | Sprint 4 交付 |
| Agent 协作可视化 | agent-collaboration-visualizer.html | 后续 Sprint 参考 |

---

## 5. 验收标准

### R-S1-01：relations.json Zod schema 定义

- [ ] `packages/core/src/models/relations.ts` 新建，定义 `CharacterRelationSchema` Zod schema
- [ ] 字段包含：`id` (uuid string)、`sourceRoleId` (角色ID)、`targetRoleId` (角色ID)、`relationType` (枚举，至少5种预设：挚友/敌对/联盟/师徒/血缘)、`description` (可选 string)、`validFromChapter` (number)、`validUntilChapter` (可选 number)、`intensity` (1-5 number)、`createdAt`、`updatedAt`
- [ ] `relationType` 枚举值 ≥ 5 种，均通过 TypeScript 类型校验
- [ ] 必填字段缺失时 Zod 校验返回明确的错误信息
- [ ] Schema 校验覆盖率 ≥ 90%（通过 Vitest）
- [ ] 导入 `relations.ts` 不破坏现有类型导出

### R-S1-02：relations.json CRUD API（Hono路由）

- [ ] `packages/studio/src/routes/relations.ts` 新建 Hono 路由文件
- [ ] 5个 API 端点全部实现：
  - `GET /api/relations` — 返回全部关系列表
  - `GET /api/relations?character=:name` — 按角色名过滤返回关系
  - `POST /api/relations` — 创建新关系（body 校验通过 Zod）
  - `PUT /api/relations/:id` — 更新指定关系
  - `DELETE /api/relations/:id` — 删除指定关系
- [ ] POST/PUT 请求体使用 Zod schema 校验，无效数据返回 400 错误
- [ ] 数据持久化到 `story/state/relations.json` 文件
- [ ] 路由注册到 Hono app，通过 `GET /api/relations` 可验证
- [ ] E2E 测试覆盖全部5个端点的正向和异常场景

### R-S1-03：角色5级分层枚举定义

- [ ] `packages/core/src/models/character.ts` 中 `CharacterTier` 枚举扩展为5级：
  - `protagonist` — 主角
  - `supporting` — 重要角色/次要角色
  - `guest` — 客串角色
  - `one-shot` — 一次性角色
  - `scene` — 场景专属角色
- [ ] 现有 `major`/`minor` 枚举值保留为别名或迁移路径（兼容旧数据）
- [ ] 枚举值导出为 TypeScript 类型，可在前端直接引用
- [ ] 层级排序逻辑（由高到低）：protagonist > supporting > guest > one-shot > scene

### R-S1-04：CharacterMeta.role 升级 + UI 选择器

- [ ] `CharacterMeta` 的 tier/role 字段更新为使用新的5级枚举
- [ ] 角色创建/编辑表单中增加层级下拉选择器（5个选项，对应5级枚举）
- [ ] 新建角色时**强制选择**层级（无默认值或默认为 guest/supporting）
- [ ] 选择后角色自动存入对应 `roles/<tier>/` 目录
- [ ] 角色编辑页面可修改层级（升降级），修改后自动迁移目录
- [ ] 现有角色的层级数据迁移方案：未指定层级的角色默认归入 `supporting`
- [ ] 创建角色 UI 位于 `packages/studio/src/sidebar/CharacterSection.tsx`

### R-S1-05：角色列表页分层过滤 + 视觉区分

- [ ] 角色面板顶部增加层级 Tab 栏：[全部] [主角] [重要] [次要] [客串] [一次性]
- [ ] 每个 Tab 显示该层级角色数量，如"主角 5"
- [ ] 选中 Tab 时，列表只显示对应层级的角色
- [ ] 5个层级使用5种不同配色区分（参考原型配色方案）
- [ ] 每个角色卡片显示层级徽章（圆形色块 + 标识符号）
- [ ] 角色名旁显示层级文字标签
- [ ] 底部显示层级图例
- [ ] 搜索过滤与层级筛选叠加生效
- [ ] 统计栏显示当前筛选结果

### R-S1-06：单元测试：Zod schema + API CRUD

- [ ] `packages/core/src/models/__tests__/relations.test.ts` — Schema 校验覆盖率 ≥ 90%
- [ ] `packages/studio/src/routes/__tests__/relations.test.ts` — 5个 API 端点测试全覆盖
- [ ] 测试通过 `pnpm test` 可运行，不破坏现有测试
- [ ] 包含正向用例（合法数据通过校验）和异常用例（缺失字段/类型错误/字符串超长等）

### R-S1-07：用户数据备份

- [ ] 用户项目目录 `~/.hermes/novel-projects/inkos-workspace` 已执行 `git init`
- [ ] 首次 commit 包含全部现有数据（30章/13.4万字 + 26角色 + 18世界设定）
- [ ] `.gitignore` 已配置，排除 SQLite 二进制文件（`*.db*`）、`node_modules/`、`dist/`
- [ ] zip 打包备份已完成（双重保险）
- [ ] 每日自动备份脚本已创建并配置定时任务

### R-S1-08：法律合规

- [ ] `PRIVACY.md` 文档完成，包含用户内容版权归属声明
- [ ] `TERMS.md` 文档完成，包含服务条款
- [ ] Studio 前端界面底部添加 AGPL-3.0 声明
- [ ] Studio「关于」页面添加 AGPL 开源声明和源码链接
- [ ] `SECURITY.md` 文档完成（可选 P2）

### Sprint 1 结束检查点

- ✅ relations.json Zod schema 定义完成，校验覆盖率 ≥ 90%
- ✅ relations.json CRUD API 5个端点全部可用，E2E 测试通过
- ✅ 角色5级分层枚举定义完成（protagonist/supporting/guest/one-shot/scene）
- ✅ 角色编辑页 tier 选择器可用，创建角色时强制选择
- ✅ 角色列表页按 tier 筛选 + 视觉区分（不同配色/图标）
- ✅ 用户数据 git 备份完成，zip 备份完成
- ✅ 隐私政策 + 服务条款文档初版完成，AGPL 声明添加到 Studio
- ✅ 0 P0 Bug，≤ 3 P1 Bug

---

## 6. 待确认问题

| # | 问题 | 影响范围 | 建议决策方向 | 决策截止 |
|---|------|----------|-------------|---------|
| Q1 | **层级中文命名**：S1-3 枚举定义为 protagonist/supporting/guest/one-shot/scene，但原型中使用 主角/重要/次要/客串/一次性。UI 显示层的中文名以哪个为准？ | R-S1-04, R-S1-05 | 建议使用原型命名（主角/重要/次要/客串/一次性）作为UI显示，枚举值保持不变 | Sprint 1 开始前 |
| Q2 | **场景专属角色（scene）的展示方式**：scene 层级的角色是否应出现在全局角色列表中？还是仅出现在章节侧边栏？ | R-S1-05 | 参考原始 PRD R-04：scene 角色关联到特定章节，不独立出现在全局列表——因此 Tab 栏中 scene 层级仅在"全部"Tab 下可见？需确认 | Sprint 1 开始前 |
| Q3 | **关系类型预设列表**：S1-1 的 `relationType` 枚举至少需要几种？ | R-S1-01 | 原始 PRD（R-05）建议 12 种预设。Sprint 1 建议先实现核心 6 种（挚友/敌对/联盟/师徒/血缘/暗恋），Sprint 2 扩展 | Sprint 1 开发中 |
| Q4 | **relations.json 存储位置**：应放在 `story/state/relations.json` 还是作为独立数据文件？是否与 truth 文件系统兼容？ | R-S1-01, R-S1-02 | 建议统一存储在 `story/state/relations.json`，与现有 truth 文件分离 | Sprint 1 开始前 |
| Q5 | **现有角色数据迁移**：现有角色使用的 `major`/`minor` 两级枚举如何映射到新5级？ | R-S1-04 | 建议：major → supporting，minor → guest。遗留数据通过迁移脚本自动处理 | Sprint 1 开发中 |
| Q6 | **关系 API 的鉴权**：是否需要身份验证？当前 Hono 路由是否有鉴权中间件？ | R-S1-02 | 建议与现有 API 鉴权策略一致，Sprint 1 不做额外鉴权 | Sprint 1 开始前 |

---

## 附录 A：团队分工建议

| 任务 | 工时 | 建议负责人 | 并行可行性 |
|------|------|-----------|-----------|
| S1-1 relations.json Zod schema | 2d | 后端 | 与 S1-3 并行 |
| S1-2 relations.json CRUD API | 3d | 后端 | 依赖 S1-1 |
| S1-3 角色5级分层枚举定义 | 1d | 前端/后端 | 与 S1-1 并行 |
| S1-4 CharacterMeta.role + UI选择器 | 2d | 前端 | 依赖 S1-3 |
| S1-5 角色列表页分层过滤 + 视觉 | 2d | 前端 | 依赖 S1-4 |
| S1-6 单元测试 | 1d | 全栈 | 依赖 S1-1, S1-2 |
| S1-7 用户数据备份 | 0.5d | 所有人 | 完全并行 |
| S1-8 法律合规 | 3d | 全栈/AI | 完全并行 |

**关键路径**：S1-3 → S1-4 → S1-5（前端角色分层）与 S1-1 → S1-2 → S1-6（后端关系模型）两条线可完全并行。

---

## 附录 B：Sprint 1 与后续 Sprint 的衔接

| Sprint 1 产出 | 后续 Sprint 依赖方 | 说明 |
|--------------|-------------------|------|
| relations.json schema + CRUD API | Sprint 2 关系图面板 (S2-7) | 关系图数据从此 API 加载 |
| 角色5级分层枚举 + UI | Sprint 2 关系图节点 (S2-3) | 节点按层级配色 |
| 角色5级分层枚举 + UI | Sprint 3 分卷 (S3-4) | 角色可按卷筛选（非硬依赖） |
| 用户数据备份 | 所有后续 Sprint | 开发过程中的数据安全保障 |
| 法律合规文档 | v1.5a MVP 发布 | 首次发布前必须完成 |

---

*文档结束*
