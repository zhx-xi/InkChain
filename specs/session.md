# 会话管理 — 功能规格书 (SDD)

**版本**: 1.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `api/routes/sessions.ts` + `interaction/session.ts` + `ChatPage.tsx`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: 会话系统管理项目中所有 AI 交互会话的生命周期，包括创建/归档/解档/删除/合并/自动归档功能。ChatPage 为前端聊天界面入口，支持多种会话类型（chat、book-create、book、short、play、edit 等）。
> **痛点**: (1) 大量过期会话堆积占用界面空间；(2) 分散的主题讨论难以合并为连贯的创作上下文；(3) 缺少自动清理机制；(4) 会话标签系统未完全集成。
> **期望状态**: 完整的会话生命周期管理——自动归档过期会话、手动批量操作、合并关联会话、标签分类。
> **成功指标**: session-archive / authoring 共 2 个 E2E spec 全部通过。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **创建新的 AI 对话会话** so that **能就不同的写作话题分别讨论**。【P0】
2. As a **写作者**, I want **归档不常用的会话** so that **界面保持清爽**。【P1】
3. As a **写作者**, I want **合并两个相关会话** so that **上下文不分散**。【P2】
4. As a **写作者**, I want **批量操作多个会话** so that **管理效率更高**。【P2】
5. As a **写作者**, I want **自动归档 30 天未活跃的会话** so that **无需手动清理**。【P2】
6. As a **写作者**, I want **永久删除不需要的会话** so that **彻底清理数据**。【P1】

---

## 1. 模块概述

会话管理是 InkChain 中管理 **AI 交互会话** 的核心模块。每次与 AI 的对话都封装为一个会话（Session），支持多种会话类型（聊天、书籍创建、短篇创作、剧本创作等）。后端提供完整的会话生命周期 API（归档/解档/合并/删除/批量操作/自动归档），前端 ChatPage 提供聊天界面和会话选择器。

---

## 2. 行为合约

### 2.1 API 接口

所有路由挂载于 `/api/v1/project`:

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/sessions` | query `?status=active\|archived` (可选) | `{ sessions: SessionListItem[] }` | 列出所有会话（含标签信息） |
| GET | `/sessions/:id` | — | `{ session }` | 获取单个会话详情 |
| POST | `/sessions/:id/archive` | `{ reason?: string }` (可选) | `{ session }` | 归档指定会话 |
| POST | `/sessions/:id/unarchive` | — | `{ session }` | 解档指定会话 |
| DELETE | `/sessions/:id` | — | `{ ok: true }` | 永久删除会话 |
| POST | `/sessions/archive/batch` | `{ sessionIds: string[] }` | `{ archivedCount: number }` | 批量归档 |
| POST | `/sessions/:targetId/merge` | `{ sourceId: string }` | `{ session }` | 将 source 合并入 target |
| POST | `/sessions/archive/auto` | `{ maxAgeDays?: number }` (默认 30) | `{ archivedCount: number }` | 自动归档过期会话 |

**请求/响应示例**:

```json
// GET /sessions?status=archived
// → 200 OK
{ "sessions": [{ "id": "session-arch-001", "title": "修仙世界设定讨论",
    "status": "archived", "messageCount": 12, "archivedAt": "...",
    "createdAt": "...", "updatedAt": "...", "tags": [...] }] }

// POST /sessions/:id/archive
// Request Body (optional)
{ "reason": "已完成讨论" }
// → 200 OK
{ "session": { ...状态变为 archived } }

// POST /sessions/archive/batch
// Request Body
{ "sessionIds": ["session-001", "session-002"] }
// → 200 OK
{ "archivedCount": 2 }

// POST /sessions/target-session/merge
// Request Body
{ "sourceId": "source-session-id" }
// → 200 OK (合并成功)
// → 400 (sourceId 为空或等于 targetId)
// → 404 (目标或源会话不存在)

// Error → 400 Bad Request (batch)
{ "error": { "code": "INVALID_JSON", "message": "请求体不是有效的 JSON" } }
{ "error": { "code": "VALIDATION_ERROR", "message": "sessionIds 必须是字符串数组" } }

// Error → 404 Not Found
{ "error": { "code": "NOT_FOUND", "message": "会话 xxx 不存在" } }

// Error → 500 Internal Server Error
{ "error": { "code": "INTERNAL_ERROR", "message": "..." } }
```

### 2.2 数据模型

| Schema | 类型 | 必填字段 | 可选字段 | 默认值 / 校验 |
|--------|------|----------|---------|--------------|
| `BookSessionSchema` | object | sessionId (string min 1), bookId (nullable), status ("active"\|"archived"), createdAt, updatedAt | sessionKind, playMode, title (nullable, default null), archivedAt, archiveReason, messages (default []), creationDraft, draftRounds (default []), events (default []), currentExecution | status 默认 "active"；合并时源会话被清空 |
| `SessionKindSchema` | enum | chat / book-create / book / short / play / script / storyboard / interactive-film / edit / interactive-film-authoring | — | 决定会话的行为上下文 |
| `InteractionMessageSchema` | object | role ("user"\|"assistant"\|"system"), content, timestamp | thinking, toolExecutions | 支持思考链和工具执行步骤 |
| `BookCreationDraftSchema` | object | concept (string min 1) | title, genre, platform, language, targetChapters, chapterWordCount, blurb, worldPremise, settingNotes, protagonist, supportingCast, conflictCore, volumeOutline, constraints, authorIntent, currentFocus, nextQuestion, missingFields (default []), readyToCreate (default false) | 用于新书创建的渐进式草稿 |
| `SessionListItem` | object | id, title, status, messageCount, createdAt, updatedAt | archivedAt, tags | 客户端友好格式 |

### 2.3 状态转换

#### 会话生命周期状态机

```
                     创建会话
                      │
                      ▼
                   active ──────────────────────────→ 已删除 (不可逆)
                      │                    DELETE
                      │
                      │ POST /archive
                      │ POST /archive/batch
                      │ POST /archive/auto
                      ▼
                  archived ──────────────────────────→ 已删除 (不可逆)
                      │                    DELETE
                      │
                      │ POST /unarchive
                      ▼
                   active
                      │
                      │ POST /merge (作为 source)
                      ▼
                   merged (消息迁移至 target, source 保留但清空)

自动归档: active 会话超过 maxAgeDays (默认 30 天) 未活跃 → POST /archive/auto 自动归档
```

#### UI 状态机（ChatPage）

```
                    ┌── error ──────────────────────────────────────┐
                    │  SSE 连接失败 / API 异常 → 错误提示           │
                    │  retry → 重新连接                              │
                    ▼                                                │
idle ──→ loading ──→ ready                                         │
  ▲         │           │                                           │
  │         │           ├── 无选中会话 → 空面板/新会话提示           │
  │         │           └── 选中会话 → 加载消息历史                  │
  │         │                → 显示消息列表                          │
  │         │                → 输入框就绪                            │
  └─────────┴──── 创建新会话 / 切换会话 / 接收新消息               │
                    │                                                │
                    ├── streaming (SSE)                              │
                    │     → 逐 token 渲染 AI 回复                    │
                    │     → ToolExecutionSteps 显示工具调用          │
                    └── generating_complete                          │
                          → 消息追加到列表                           │
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| 会话 → 书籍 | 多对一 | 删除书籍 → 关联会话保留（bookId 变为无效引用） |
| 会话 → 消息 | 一对多 | 删除会话 → 所有消息级联删除（不可恢复） |
| 会话 → 标签 | 多对多 | 删除标签 → 会话的标签引用变为无效 |
| 会话合并 | source → target | source 消息追加到 target 末尾，source 保留原记录但消息清空 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 列出会话 | GET → 200 → 渲染会话列表 | API 500 → INTERNAL_ERROR | 无会话 → 空列表 [] | 大量会话(>100) → 正常列出 |
| 归档会话 | POST → 200 → status 变为 archived | NOT_FOUND → 404 | N/A | 重复归档 → 幂等（再次归档无副作用） |
| 解档会话 | POST → 200 → status 变为 active | NOT_FOUND → 404 | N/A | 解档已 active 会话 → 幂等 |
| 删除会话 | DELETE → 200 → 会话消失 | INTERNAL_ERROR → 500 | N/A | 删除不存在的会话 → 静默成功 |
| 批量归档 | POST → 200 → archivedCount 返回 | INVALID_JSON → 400 / VALIDATION_ERROR → 400 | sessionIds=[] → archivedCount=0 | 部分 ID 不存在 → 跳过无效 ID |
| 合并会话 | POST → 200 → source 消息追加 target | sourceId=targetId → 400 / NOT_FOUND → 404 | N/A | source 无消息 → 合并后 target 不变 |
| 自动归档 | POST → 200 → archivedCount 返回 | INTERNAL_ERROR → 500 | maxAgeDays 默认 30 | 无过期会话 → archivedCount=0 |
| 获取详情 | GET → 200 → 返回完整 session | NOT_FOUND → 404 | N/A | 大消息历史(>1000 条) → 性能正常 |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `ChatPage` | `/#/chat` | — | 主聊天界面，含消息列表、输入框、会话选择器 |
| `ArchivePage` | `/#/archive` | — | 归档会话列表，支持解档/删除/批量操作 |
| `AgentStatusIndicator` | (内嵌 ChatPage) | — | 显示 AI Agent 当前状态（idle/thinking/writing） |
| `WritingProgress` | (内嵌 ChatPage) | — | 显示写作 Pipeline 进度（分阶段） |
| `ToolExecutionSteps` | (内嵌 ChatPage) | — | 显示 AI 工具调用步骤 |
| `QuickActions` | (内嵌 ChatPage) | — | 快捷操作按钮（续写/审核/生成等） |
| `PlayHud` | (内嵌 ChatPage) | — | 互动剧本的 HUD 界面 |

### 4.2 交互流程

```
ChatPage 主流程:
  进入聊天页 → 加载会话列表 →
  ├─ 选择会话 → 加载消息历史 → 显示对话
  │   ├─ 输入消息 → SSE 流式响应 → 实时渲染
  │   ├─ 工具调用 → ToolExecutionSteps 显示进度
  │   └─ 完成 → 消息追加到列表
  ├─ 新建会话 → POST /sessions → 切换至新会话
  └─ 切换书籍上下文 → 关联活跃书籍

会话管理流程 (ArchivePage):
  归档列表 → 显示所有 archived 会话 →
  ├─ hover 会话卡片 → 显示操作按钮
  │   ├─ [解档] → 确认弹窗 → unarchive → 会话从列表消失
  │   └─ [删除] → 确认弹窗 → DELETE → 会话从列表消失
  └─ 批量选择 → 批量操作栏
      ├─ [全选] checkbox
      └─ [批量解档] → 确认 → batch unarchive

自动归档:
  定时任务 / 手动触发 → POST /sessions/archive/auto
  → maxAgeDays 天未活跃的 active 会话自动归档
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 消息列表容器 | `.chat-messages` (class) | 消息列表渲染区域 |
| 输入框 | `textarea` / `input` (role) | 用户消息输入 |
| 会话选择器 | `.session-list` (class) | 会话列表下拉/侧边栏 |
| 发送按钮 | `button` (role, 含 ArrowUp 图标) | 发送消息入口 |
| AI 回复卡片 | `.assistant-message` (class) | AI 回复渲染 |
| 归档会话卡片 | `.group` (class, 含 session title) | 归档列表中的会话项 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 1s 会话列表加载；p95 < 3s 合并操作 | Playwright E2E timeout |
| 并发 | 支持多个会话同时活跃（多 tab 或多书籍） | 手动验证 |
| 回滚 | 合并前自动创建 backup；归档为可逆操作（unarchive） | 单元测试 |
| 降级 | SSE 连接断开 → 自动重连；API 不可用 → 本地消息暂存 | — |
| 数据安全 | 删除为永久操作，需确认对话框；归档为安全操作 | 前端确认弹窗 + 后端不可逆标注 |
| 内存 | 单会话消息数 > 500 时启用虚拟滚动 | — |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 会话导出为外部格式（PDF/Markdown） | 超出当前 MVP 范围 |
| 会话搜索全文 | 消息量尚小，浏览器 Ctrl+F 可覆盖 |
| 会话历史版本/undo | 归档即视为软删除，无需版本管理 |
| 多用户协作会话 | 单用户桌面应用 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 会话列表含 4 个 archived 会话 | 访问归档页面 | 归档列表显示 4 个会话及其标题 | ⬜ | session-archive |
| 2 | 归档列表含"角色关系梳理"会话 | hover 会话卡片 → 点击解档 | 确认弹窗出现 → 确认后会话从列表消失 | ⬜ | session-archive |
| 3 | 归档列表含"已弃用的旧设定"会话 | hover 会话卡片 → 点击删除 | 永久删除确认弹窗 → 确认后会话消失 | ⬜ | session-archive |
| 4 | 归档列表选中 2 个会话 | 点击批量解档 | 批量操作栏出现 → 确认后 2 个会话解档 | ⬜ | session-archive |
| 5 | 电影创作页加载完成 | 用户编辑场景文本 → 保存 | scene 内容更新 → Player 面板内容同步 | ⬜ | authoring |
| 6 | 会话无消息 | 查询会话详情 | 返回完整 session 对象，messages 为空数组 | ⬜ | — |
| 7 | 项目含 10 个超过 30 天未活跃会话 | 触发自动归档 | POST auto → archivedCount = 10 | ⬜ | — |
| 8 | sourceId 和 targetId 相同 | 执行合并 | 返回 400 "不能将会话合并到自身" | ⬜ | — |

完成度: 0/8 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | 会话合并后 source 会话是否应自动归档？ | @product | 否 |
| 2 | 自动归档的默认天数(30)是否合理？是否需要可配置？ | @product | 否 |
| 3 | 删除操作是否需要软删除（回收站）？ | @product | 否 |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 初始版本：基于代码分析和 E2E 测试 | spec-writer-2 |
