# Agent 团队管理 — 功能规格书 (SDD)

**版本**: 1.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `api/routes/agent-team.ts` + `api/routes/agent-templates.ts` + `api/routes/agent-order.ts` + `api/routes/custom-agents.ts` + `models/agent-team-config.ts` + `AgentTeamPanel.tsx` + `AgentHubPage.tsx` + `AgentPipelineView.tsx`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: Agent 团队系统管理 InkChain 中 AI Agent 的多角色协作配置。内置 7 个角色（writer/architect/planner/editor/auditor/observer/reviser），支持启用/禁用、模型覆盖、自定义 Prompt。提供自定义 Agent 创建、团队模板保存/加载、Agent 排序、协作模式切换（sequential/parallel/hybrid）和 Agent Pipeline 可视化。
> **痛点**: (1) 团队成员配置缺乏模板化管理；(2) 自定义 Agent 的创建路径分散；(3) Agent 在 Hub 中的视觉一致性（背景色、卡片尺寸）未标准化；(4) Pipeline 视图中 Flow 编辑器的渲染稳定性待验证。
> **期望状态**: 集中的 Agent Hub 管理界面，支持内置角色 + 自定义 Agent，模板化配置，Pipeline 可视化，统一的视觉规范。
> **成功指标**: agent-team-core / agent-team / agent-team-dedup / agent-hub-page / agent-pipeline-view / agent-background-color / agent-card-sizing / agent-create-custom / agent-edit-functionality / agent-edit / agent-flow-editor-render / baseline-agent-skill-audit 共 12 个 E2E spec 全部通过。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **配置 Agent 团队的成员（启用/禁用角色）** so that **控制 AI 写作时使用哪些角色的能力**。【P0】
2. As a **写作者**, I want **创建自定义 Agent** so that **补充内置角色之外的专业能力**。【P1】
3. As a **写作者**, I want **保存/加载团队配置模板** so that **不同项目使用不同的团队配置**。【P1】
4. As a **写作者**, I want **拖拽排序 Agent 显示顺序** so that **按偏好组织工作流**。【P2】
5. As a **写作者**, I want **切换协作模式（顺序/并行/混合）** so that **控制 Agent 间的协作方式**。【P2】
6. As a **写作者**, I want **在 Pipeline 视图中可视化 Agent 流水线** so that **直观理解创作流程**。【P2】

---

## 1. 模块概述

Agent 团队管理是 InkChain 中管理 **AI Agent 角色配置** 的核心模块。提供内置 7 角色（Writer/Architect/Planner/Editor/Auditor/Observer/Reviser）的启用/禁用控制，支持自定义 Agent 创建（自定义名称、角色描述、Persona、Skills、图标和颜色），团队配置模板化存储，Agent 排序持久化，以及 Pipeline 流程可视化。Agent Hub 页面为所有 Agent 管理的统一入口。

---

## 2. 行为合约

### 2.1 API 接口

**Agent Team API** (挂载于 `/api/project/agent-team`):

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/` | — | `{ config: AgentTeamConfig }` | 获取当前团队配置（无文件返回默认） |
| PUT | `/` | `AgentTeamConfig` body | `{ config }` | 保存团队配置 |

**Agent Templates API** (挂载于 `/api/v1/agent-templates`):

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/` | — | `{ templates: AgentTemplate[] }` | 列出所有模板 |
| POST | `/` | `{ name, description, preset, config }` | `{ template }` (201) | 创建新模板 |
| PUT | `/:id` | partial update | `{ template }` | 更新模板 |
| DELETE | `/:id` | — | `{ ok: true, id }` | 删除模板 |

**Agent Order API** (挂载于 `/api/v1/agent-order`):

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/` | — | `{ order: string[] }` | 获取 Agent 显示顺序 |
| PUT | `/` | `{ order: string[] }` | `{ order }` | 保存 Agent 顺序 |

**Custom Agents API** (挂载于 `/api/v1/custom-agents`):

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/` | — | `{ agents: CustomAgent[] }` | 列出所有自定义 Agent |
| POST | `/` | `{ name, role, description, color, icon [, modelRouter, persona, skills] }` | `{ agent }` (201) | 创建自定义 Agent |
| PUT | `/:id` | partial update | `{ agent }` | 更新自定义 Agent |
| DELETE | `/:id` | — | `{ ok: true, id }` | 删除自定义 Agent |

**请求/响应示例**:

```json
// PUT /api/project/agent-team → Request Body
{ "schemaVersion": "1",
  "agents": [{ "role": "writer", "enabled": true },
             { "role": "architect", "enabled": true },
             { "role": "editor", "enabled": false }],
  "defaultModel": "gpt-4o",
  "collaborationMode": "sequential" }
// → 200 OK
{ "config": { ...同上 } }

// POST /api/v1/custom-agents → Request Body
{ "name": "情感检测师", "role": "sentiment_analyzer",
  "description": "分析文本情感倾向与基调一致性",
  "color": "#EC4899", "icon": "Heart" }
// → 201 Created
{ "agent": { "id": "uuid-auto-generated", "name": "情感检测师",
    "role": "sentiment_analyzer", "description": "...",
    "color": "#EC4899", "icon": "Heart",
    "createdAt": "...", "updatedAt": "..." } }

// Error → 400 Bad Request (custom-agents)
{ "error": { "code": "VALIDATION_ERROR", "message": "name must be a non-empty string" } }

// Error → 400 Bad Request (custom-agents: invalid color)
{ "error": { "code": "VALIDATION_ERROR", "message": "color must be one of: #E88D3A, #4A90D9, ..." } }

// Error → 404 Not Found
{ "error": { "code": "NOT_FOUND", "message": "Custom agent xxx not found" } }
```

### 2.2 数据模型

| Schema | 类型 | 必填字段 | 可选字段 | 默认值 / 校验 |
|--------|------|----------|---------|--------------|
| `AgentTeamConfigSchema` | object | schemaVersion: "1", agents: AgentRoleConfig[] | defaultModel, collaborationMode ("sequential"\|"parallel"\|"hybrid") | collaborationMode 默认 "sequential"；无文件时返回内置 7 角色全启 |
| `AgentRoleConfigSchema` | object | role (string), enabled (bool) | model, systemPromptOverride | enabled 默认 true |
| `CustomAgent` | object | id, name, role, description, color, icon, createdAt, updatedAt | modelRouter, persona, skills[] | color 限 12 色预定义集；skills 为字符串数组 |
| `AgentTemplate` | object | id, name, description, preset, config, createdAt, updatedAt | — | config 为 Record<string, unknown> |
| `AgentOrderFile` | array | order: string[] | — | 空文件/无文件 → 返回 `[]` |

**内置 Agent 角色**:
| Role | 名称 | 职责 |
|------|------|------|
| writer | 写手 | 生成文本内容 |
| architect | 架构师 | 设计故事结构、大纲 |
| planner | 规划师 | 章节规划、进度管理 |
| editor | 编辑 | 润色、风格调整 |
| auditor | 审核员 | 一致性检查、错误检测 |
| observer | 观察员 | 监控生成过程 |
| reviser | 修订员 | 修改审核发现的问题 |

**协作模式**:
| Mode | 行为 |
|------|------|
| sequential | Agent 按顺序依次执行，后一个依赖前一个的输出 |
| parallel | Agent 并发执行，结果合并 |
| hybrid | 混合模式，部分并行部分串行 |

**自定义 Agent 颜色集**: `#E88D3A`, `#4A90D9`, `#5CB85C`, `#8B5CF6`, `#9CA3AF`, `#0EA5E9`, `#EF4444`, `#F59E0B`, `#10B981`, `#6366F1`, `#EC4899`, `#14B8A6`

### 2.3 状态转换

#### 团队配置状态机

```
                    加载配置
                       │
                       ▼
                默认配置 (7 roles all enabled)
                       │
                  PUT /agent-team
                       │
                       ▼
                 用户配置 (自定义 enabled/disabled + model override)
                       │
                       ├── 保存模板 → POST /agent-templates → 模板持久化
                       │   └── 加载模板 → 替换当前配置
                       │
                       └── 添加自定义 Agent → POST /custom-agents
                           └── 编辑 → PUT /custom-agents/:id
                               └── 删除 → DELETE /custom-agents/:id

Agent 排序:
  GET /agent-order → 获取当前顺序 →
  PUT /agent-order → 保存新顺序（拖拽后）
```

#### UI 状态机（AgentHubPage）

```
                    ┌── error ───────────────────────────────────────┐
                    │  API 500 / 网络异常 → 显示错误提示             │
                    │  retry → 重新加载                              │
                    ▼                                                │
idle ──→ loading ──→ rendered                                       │
  ▲         │           │                                            │
  │         │           ├── Tab 切换                                │
  │         │           │   ├── Team 面板 (AgentTeamPanel)           │
  │         │           │   ├── Templates (模板列表)                 │
  │         │           │   └── Custom (自定义 Agent 列表)           │
  │         │           │                                           │
  │         │           └── Pipeline 视图 (AgentPipelineView)        │
  │         │                → Flow 编辑器渲染 Agent 节点+连线       │
  │         │                                                       │
  └─────────┴──── refresh / 保存配置 / 切换 Tab                    │
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| Agent 配置 → 项目 | 多对一 | 项目删除 → agent-team.json 级联删除 |
| 模板 → 项目 | 多对一 | 项目删除 → agent-templates.json 级联删除 |
| 自定义 Agent → 项目 | 多对一 | 项目删除 → custom-agents.json 级联删除 |
| Agent 排序 → 内置/自定义 Agent | 引用列表 | 被删除的 Agent ID 在 order 中变为无效引用（需清理） |
| 模板 → 内置角色 | 引用 | 编辑/删除内置角色 → 模板不受影响 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 获取配置 | GET → 200 → 返回用户配置 | agent-team.json 损坏 → 返回默认配置 | 无配置 → 返回内置 7 角色全启 | schemaVersion 不匹配 → 部分合并 |
| 保存配置 | PUT → 200 → 配置持久化 | INVALID_JSON → 400 / VALIDATION_ERROR → 400 | N/A | 禁用了所有 Agent → 允许但不建议 |
| 创建自定义 | POST → 201 → 列表追加 | 名称重复 → 400 / 颜色不合法 → 400 | N/A | 名称含特殊字符 → 正常创建 |
| 列出模板 | GET → 200 → 模板数组 | templates.json 损坏 → API 500 | 无模板 → 空数组 [] | 大量模板(>20) → 正常列出 |
| 保存模板 | POST → 201 → 模板持久化 | name 为空 → 400 | N/A | 重复 preset 名称 → 允许（按 ID 区分） |
| Agent 排序 | PUT → 200 → order 持久化 | order 文件写入失败 → 500 | 空数组 → 无顺序 | order 含未注册 Agent ID → 正常保留 |
| Pipeline 视图 | Flow 编辑器渲染节点+边 | 渲染错误 → 降级空白 | 无 Agent → 空流程 | 大量 Agent(>20) → 横向滚动 |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `AgentHubPage` | `/#/agents` | — | Agent 管理统一入口 |
| `AgentTeamPanel` | (内嵌 AgentHubPage) | `ag-` | 内置角色配置面板，含启用/禁用 toggle |
| `AgentPipelineView` | (内嵌) | — | Flow 编辑器可视化 Agent 流水线 |

### 4.2 交互流程

```
Agent Hub 页面流程:
  进入 /#/agents → 加载团队配置 → 
  ├─ Tab: [团队配置]
  │   ├─ 7 内置角色卡片:
  │   │   ├─ [Toggle 开关] → 启用/禁用角色
  │   │   ├─ [模型选择] → 覆盖默认模型
  │   │   └─ [Prompt 编辑] → 自定义系统提示词
  │   ├─ [协作模式选择] → sequential/parallel/hybrid
  │   ├─ [默认模型] → 下拉选择
  │   ├─ [保存配置] → PUT /agent-team
  │   └─ [模板下拉] → 加载已有模板
  │
  ├─ Tab: [模板]
  │   ├─ 模板列表
  │   ├─ [保存为模板] → POST /agent-templates
  │   ├─ [应用模板] → 替换当前配置
  │   └─ [删除模板] → DELETE /templates/:id
  │
  ├─ Tab: [自定义 Agent]
  │   ├─ 自定义 Agent 卡片列表
  │   ├─ [创建] → 填写 name/role/description/color/icon → POST /custom-agents
  │   ├─ [编辑] → PUT /custom-agents/:id
  │   └─ [删除] → DELETE /custom-agents/:id
  │
  └─ 拖拽排序:
      ├─ 拖拽 Agent 卡片 → PUT /agent-order
      └─ 顺序持久化

Pipeline 视图:
  加载 Agent 配置 → Flow 编辑器渲染 →
  每个 Agent 为一个节点 → 按协作模式连线 →
  节点显示角色名称/图标/颜色/状态
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 创建 Agent 按钮 | `ag-create-btn` / `ag-btn-create-agent` | E2E 定位创建入口 |
| 模板按钮 | `ag-btn-template` | 模板操作入口 |
| 列表容器 | `ag-list` | Agent 列表 |
| Tab 导航 | `[role='tab']` | Tab 切换 |
| 空状态 | `ag-empty` | 无 Agent 空状态 |
| 错误状态 | `ag-error` | API 异常 |
| 加载状态 | `ag-loading` | 数据加载中 |
| 保存按钮 | `ag-save-btn` | 保存团队配置 |
| Pipeline 视图 | `flow-view` | Flow 编辑器渲染 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 1s 配置加载；p95 < 2s Flow 编辑器渲染 | Playwright E2E timeout |
| 并发 | 多 tab 操作独立（配置按项目存储） | 手动验证 |
| 回滚 | 配置保存失败 → 前端恢复上次成功值 | 前端状态管理 |
| 数据完整性 | agent-team.json / custom-agents.json 损坏 → 返回默认值，不崩溃 | 校验+fallback |
| 视觉一致性 | Agent 卡片背景色和尺寸在 12 种颜色下一致 | E2E agent-background-color, agent-card-sizing |
| 自定义 Agent 去重 | 同名不同 role → 允许（ID 去重）；同 ID 重复 → API 409 或 UI 拒绝 | agent-team-dedup |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| Agent 实时运行/执行引擎 | Agent 管理是配置层，执行在 Session/生成管道中 |
| Agent 版本的 A/B 测试 | 超出 MVP 范围 |
| 团队配置云端同步 | 单用户桌面应用，本地存储 |
| Agent 市场/社区分享 | 模板系统可作为基础，但分享不在 MVP 范围 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 默认团队配置 | 导航到 /#/agents | 7 个内置 Agent 卡片可见，每个有 Toggle 开关 | ⬜ | agent-team-core |
| 2 | 编辑器启用，其余 Agent 全开 | 禁用 Editor 角色 → 保存 | 配置持久化，Editor 卡片灰色 | ⬜ | agent-team |
| 3 | Agent 页面已加载 | 切换协作模式为 parallel → 保存 | 模式切换成功 | ⬜ | agent-hub-page |
| 4 | 当前配置有 5 个启用 Agent | 保存为模板"简版团队" | POST 成功，模板列表出现新项 | ⬜ | agent-team-core |
| 5 | 模板列表含"简版团队" | 加载模板 | 当前配置替换为模板配置 | ⬜ | agent-team-core |
| 6 | 自定义 Agent 区无数据 | 创建新 Agent"情感检测师" → 提交 | POST 201 → 列表出现新卡片，颜色#EC4899 | ⬜ | agent-create-custom |
| 7 | 自定义 Agent 存在 | 编辑名称/描述 → 保存 | PUT 成功，卡片更新 | ⬜ | agent-edit-functionality |
| 8 | 自定义 Agent 存在 | 点击删除 → 确认 | DELETE 成功，卡片消失 | ⬜ | agent-edit-functionality |
| 9 | 多个 Agent 卡片可见 | 拖拽 Agent 卡片重排序 | PUT /agent-order 成功，顺序持久化 | ⬜ | agent-team-core |
| 10 | Pipeline 视图 | 切换至 Flow 视图 | Flow 编辑器渲染 Agent 节点+连线 | ⬜ | agent-flow-editor-render |
| 11 | Agent 背景色统一 | 所有内置+自定义 Agent 渲染 | 12 种颜色内每张卡片 color 正常显示 | ⬜ | agent-background-color |
| 12 | Agent 卡片 | 全部渲染 | 所有卡片宽度一致，文字不溢出 | ⬜ | agent-card-sizing |
| 13 | API 全部 500 | 导航到 Agent 页面 | 不崩溃，显示错误提示 | ⬜ | agent-pipeline-view |
| 14 | 创建同名 Agent | 重复创建同名 Agent | 允许（ID 去重）或非致命错误 | ⬜ | agent-team-dedup |

完成度: 0/14 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | Parallel/Hybrid 协作模式在实际执行中的具体行为？ | @backend-lead | 否（配置层存储，执行在 Session 管道） |
| 2 | 自定义 Agent 的 Persona 和 Skills 如何映射到 LLM 系统提示词？ | @backend-lead | 否 |
| 3 | Pipeline 视图中 Flow 编辑器是否支持交互式编辑（连线/删除节点）？ | @frontend-lead | 否 |
| 4 | 是否需要支持 Agent 导出/导入（跨项目迁移）？ | @product | 否 |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 初始版本：基于代码分析和 E2E 测试 | spec-writer-2 |
