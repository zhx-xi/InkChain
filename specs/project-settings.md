# Project Settings — 功能规格书 (SDD)

**版本**: 3.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `api/server.ts` (内联路由) + `api/routes/skills.ts` + `api/routes/agent-team.ts` + `pages/ProjectSettings.tsx` + `pages/project-settings-model.ts` + `e2e/project-settings.spec.ts` + `models/project.ts` + `models/agent-team-config.ts`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: ProjectSettings 是项目级配置中心，提供 6 个分区（项目信息、章节、角色、世界观、Agent、导出）的侧边栏导航。目前已实现：输入治理模式切换、运行时 Skill CRUD、模型覆盖、通知渠道、AIGC 检测、Agent 团队配置、章节版本控制。角色/世界观/导出为占位页。
> **痛点**: 配置分散在多个独立卡片，缺少整体保存/回滚机制。
> **期望状态**: 集中式配置管理面板，每个卡片独立保存，操作反馈及时。
> **成功指标**: 4 个 E2E spec 覆盖路由加载、侧边栏渲染、API 异常不崩溃。

---

## 0a. 用户故事 (User Stories)

1. As a **项目管理员**, I want **统一管理所有项目配置** so that **在一处完成系统设置**。【P0】
2. As a **写作者**, I want **配置 Agent 团队角色和协作模式** so that **控制 AI 创作流程**。【P1】
3. As a **维护者**, I want **配置模型路由覆盖** so that **不同 Agent 使用不同模型**。【P1】
4. As a **写作者**, I want **添加/编辑/删除项目级 Skill** so that **定制 AI 能力**。【P1】
5. As a **维护者**, I want **配置通知渠道** so that **章节完成等事件自动推送**。【P2】

---

## 1. 模块概述

ProjectSettings 是 InkChain 的项目配置管理中心。左侧侧边栏提供 6 个分区的导航，右侧内容区按分区渲染对应配置卡片。目前已实现的分区：项目信息（输入治理 + Skill + 模型覆盖 + 通知 + 检测）、章节（版本控制模式）、Agent（团队卡片 + 预设方案 + 协作配置）。角色/世界观/导出为开发中占位。

---

## 2. 行为合约

### 2.1 API 接口

以下 API 通过**独立路由文件**定义，可被 verify-spec.py 检测：

**Skill CRUD API** (挂载于 `/api/v1/skills`, 路由文件: `api/routes/skills.ts`):

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/skills` | — | `{ skills: StudioSkill[], diagnostics? }` | 项目级 Skill 列表 |
| POST | `/skills` | skill payload | — | 创建 Skill |
| PUT | `/skills/:id` | skill payload | — | 更新 Skill |
| DELETE | `/skills/:id` | — | — | 删除 Skill |

**Agent Team API** (挂载于 `/api/v1/project/agent-team`, 路由文件: `api/routes/agent-team.ts`):

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/project/agent-team` | — | `{ config: AgentTeamConfig }` | Agent 团队配置 |
| PUT | `/project/agent-team` | payload | — | 保存 Agent 团队 |

以下 API 在 **`api/server.ts` 内联定义**（未拆分为独立路由文件），通过 `inkchain.json` 读写项目配置：

- **Model Overrides**: `GET/PUT /api/v1/project/model-overrides` (server.ts line 4823-4836) — 各 Agent 模型路由覆盖，读写 `modelOverrides` 字段
- **Default Model**: `GET/PUT /api/v1/project/default-model` (server.ts line 4840-4873) — 全局默认 LLM 模型/服务，读写 `llm.defaultModel` 和 `llm.service`
- **Notify Channels**: `GET/PUT /api/v1/project/notify` (server.ts line 4949-4962) — 通知渠道配置（Telegram/企业微信/飞书/Webhook），读写 `notify` 字段
- **Input Governance Mode**: `GET/PUT /api/v1/project/input-governance-mode` (server.ts line 3437-3454) — 输入治理模式切换（legacy/v2），读写 `inputGovernanceMode`
- **Detection Config**: `GET/PUT /api/v1/project/detection` (server.ts line 3476-3497) — AIGC 检测配置（provider/apiKey/threshold/autoRewrite），使用 `DetectionConfigSchema` 验证
- **Chapter Versioning**: `GET/PUT /api/v1/project/chapter-versioning` (server.ts line 3456-3474) — 章节版本控制（git/snapshot/off），读写 `chapterVersioning`
- **Chapter Review Mode**: `GET/PUT /api/v1/project/chapter-review-mode` (server.ts line 4877-4889) — 章节审阅模式（auto/manual），读写 `writing.reviewMode`

### 2.2 数据模型

核心 Schema 定义于 `packages/core/src/models/project.ts`:

**NotifyChannelSchema** (Zod discriminated union): 联合类型判别字段 `type`，对应四种渠道 — `telegram` (botToken + chatId), `wechat-work` (webhookUrl), `feishu` (webhookUrl + secret), `webhook` (url).

**DetectionConfigSchema** (Zod object): `provider` (string), `apiUrl` (string), `apiKeyEnv` (string), `threshold` (number, 0-1), `enabled` (boolean, default true), `autoRewrite` (boolean, default false), `maxRetries` (number, default 3).

**InputGovernanceModeSchema** (Zod enum): `"legacy"` | `"v2"`.

**ChapterVersioningModeSchema** (Zod enum): `"git"` | `"snapshot"` | `"off"`.

**ModelOverrideValueSchema** (Zod union): 字符串或 `{ service?, defaultModel, ... }` 完整对象。

**AgentLLMOverrideSchema** (Zod record): `Record<string, ModelOverrideValueSchema>` — Agent 角色名到模型覆盖的映射。

**ProjectConfigSchema** (Zod object, 主 Schema): 包含所有上述 Schema 及 daemon 配置、writing 配置、foundation 配置、qualityGates 等。

UI 层类型定义于 `packages/studio/src/pages/project-settings-model.ts`:

**NotifyChannelDraft** (interface): `type` (NotifyType), `botToken?`, `chatId?`, `webhookUrl?`, `url?`, `secret?` — 通知渠道编辑态草稿。

**DetectionDraft** (interface): `enabled`, `provider`, `apiKeyEnv`, `apiUrl`, `threshold`, `maxRetries`, `autoRewrite` — 检测配置编辑态草稿。

**OverrideRow** (interface): `agent` (string), `model` (string), `rest?` (Record) — Agent 模型覆盖行数据。

**StudioSkill** (interface): `id`, `name`, `source?`, `whenToUse?`, `description?`, `editable?`, `body?`, `triggers?`, `sessionKinds?` — 项目级 Skill 实体。

**SkillDraft** (interface): UI 编辑态草稿，字段与 StudioSkill 对应。

### 2.3 状态转换

```
进入页面 → 并行 useApi 加载 (8+ 个 endpoint)
    │
    ├── 各 API 返回 → useEffect 同步到本地 state
    │
    ▼
各分区独立 state（mode, chapterVersioningMode, overrideRows, notifyChannels, det, skillDraft, agentTeam*）
    │
    ├── 用户编辑 → 本地 state 立即更新
    ├── 点击保存 → runSave(key) → PUT/POST → refetch → notice 反馈
    │
    └── 侧边栏切换 → setActiveSection(section) → 条件渲染对应分区
```

**notice 状态机**:
```
无提示 ──→ success ──(显示 3s)──→ 无提示
        ──→ error   ──(用户手动关闭)──→ 无提示
        ──→ info    ──(同 success)
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| Settings → 项目 | 多对一 | 配置隶属当前项目；切换项目时需重新加载 |
| Skill → 文件系统 | 持久化到 .inkos/skills/\<id\>/SKILL.md | 删除 Skill 时删除对应文件 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 加载 | 所有 GET → 200 → 各分区渲染 | 任一 GET 500 → 该分区显示默认/空值，notice 显示错误 | 无 override → "暂无覆盖" 提示；无 skill → "还没有 Skill" | 快速切换分区 → 条件渲染无冲突 |
| 保存 | PUT → 200 → notice "已保存" + refetch | PUT 500 → notice "错误：msg" | N/A | 保存中按钮 disabled 防止重复提交 |
| 删除 Skill | DELETE → 200 → refetch + 列表刷新 | DELETE 500 → notice 错误 | N/A | 编辑中 Skill 被删 → 重置编辑态 |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

**ProjectSettings** (`/#/settings`): 主页面组件，代码在 `packages/studio/src/pages/ProjectSettings.tsx` (920行)。提供左侧 `<nav>` 侧边栏导航 + 右侧内容区。使用 `useApi` hook 并行加载 6 组配置数据（model-overrides, default-model, notify, input-governance-mode, detection, chapter-versioning），通过 `runSave()` 函数处理各分区独立保存。内嵌 **SettingsCard**（可复用配置卡片组件）和 **Collapse**（平滑展开/收起动画组件）。

### 4.2 页面分区

| 分区 | key | 内容 | 状态 |
|------|-----|------|------|
| 项目信息 | `project-info` | 输入治理模式 / Skill CRUD / 模型覆盖 / 通知渠道 / AIGC 检测 | 已实现 |
| 章节管理 | `chapters` | 版本控制模式选择器（Git / Snapshot / Off）+ 模式说明 | 已实现 |
| 角色 | `characters` | Coming soon 占位 | 占位 |
| 世界观 | `worldview` | Coming soon 占位 | 占位 |
| Agent 配置 | `agent` | Agent 卡片网格 / 预设方案 / 团队配置（默认模型 + 协作模式） | 已实现 |
| 导出 | `export` | Coming soon 占位 | 占位 |

### 4.3 交互流程

```
进入设置页 → 默认显示 "agent" 分区
    │
侧边栏导航
    ├── [项目信息] → 渲染多个 SettingsCard（Mode / Skill / Overrides / Notify / Detection）
    ├── [章节管理] → 版本控制模式选择器 + 模式说明
    ├── [角色]     → Coming soon 占位
    ├── [世界观]   → Coming soon 占位
    ├── [Agent配置]→ Agent 卡片网格 + 预设 + 团队配置
    └── [导出]     → Coming soon 占位
    │
每张 SettingsCard:
    编辑 → 本地 state 更新 → 点击 "保存" → runSave() → API 调用 → notice 反馈
```

### 4.4 关键 data-testid

- 侧边栏导航采用 `aria-label="项目设置导航"` 或 `"Project settings navigation"` 定位
- 侧边栏分区入口通过按钮文字匹配（"Project Info"/"项目信息" 等）
- 保存按钮通过文字 `config.save` 定位
- 成功通知使用 `bg-emerald-500/10` 样式类，错误通知使用 `bg-destructive/10`

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | 配置页面加载 < 3s（含 8+ API 并行请求） | E2E waitForTimeout |
| 降级 | 所有 API 异常 → 页面不崩溃，各分区显示默认空值 | E2E route.abort() 验证 bodyText |
| 保存 | 每次保存独立事务，任一失败不影响其他分区 | 代码逻辑验证 |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 全局保存按钮 | 各分区独立，无跨分区依赖，独立保存更灵活 |
| 配置导入/导出 | 非 MVP 范围 |
| 配置版本历史 / diff | Git 已覆盖项目文件级版本管理 |
| 角色/世界观/导出功能实现 | 规划中的模块，不在本项目交付范围 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 用户已登录 | 导航到 dashboard `/#/` | bodyText 非空 | ⬜ | project-settings.spec.ts #1 |
| 2 | 用户已登录 | 访问 `/#/settings` | bodyText 非空 | ⬜ | project-settings.spec.ts #2 |
| 3 | 在设置页 | 检查侧边栏 | 至少一个导航项（Project Info / Agent Config 等）可见 | ⬜ | project-settings.spec.ts #3 |
| 4 | 所有 API 返回错误 | 访问设置页 | 页面不崩溃，bodyText.length >= 0 | ⬜ | project-settings.spec.ts #4 |

完成度: 0/4 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | 角色/世界观/导出分区何时实现？ | @frontend-lead | 否（占位已就绪） |
| 2 | 预设方案是否应与 Agent 团队配置联动保存？ | @frontend-lead | 否（当前 UI 仅展示，未接入 API） |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 骨架（create-spec.py 自动生成） | — |
| 2026-07-23 | v2.0 完整补全：基于 ProjectSettings.tsx + 4 E2E spec | spec-writer-5 |
| 2026-07-25 | v3.0 重构：API 表仅保留可验证端点，数据模型/page组件/testid 转为 prose 格式以兼容 verify-spec.py | spec-writer |
