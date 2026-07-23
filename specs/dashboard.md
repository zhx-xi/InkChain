# Dashboard — 功能规格书 (SDD)

**版本**: 2.0
**创建日期**: 2026-07-23
**状态**: approved
**代码源**: `packages/studio/src/api/routes/search.ts` + `packages/core/src/models/project.ts` + `Dashboard.tsx` + `EditDashboard.tsx`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: Dashboard 是 InkChain 项目入口页面，展示所有书籍/作品的概览卡片列表，侧边栏提供导航入口，编辑仪表盘提供可配置的 Widget 面板。
> **痛点**: (1) 无 AI 服务时无引导提示；(2) 删除书籍无确认弹窗；(3) 侧边栏收缩边界不清晰；(4) 编辑仪表盘 Widget 不可拖拽重排。
> **期望状态**: 无 AI 服务时显示配置引导；删除按钮带确认弹窗；侧边栏支持收缩/拖拽边界；编辑仪表盘 Widget 可拖拽布局。
> **成功指标**: 5 个 E2E spec 全部通过（dashboard / dashboard-collapse-resize / edit-dashboard / sidebar-navigation / project-root）。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **看到所有作品概览卡片列表** so that **能快速了解每个作品的状态**。【P0】
2. As a **写作者**, I want **点击作品进入创作页面** so that **能继续写作和管理**。【P0】
3. As a **写作者**, I want **一键创建新作品** so that **能快速开始新项目**。【P0】
4. As a **编辑者**, I want **在编辑仪表盘查看多维度 Widget** so that **全局掌握作品进展**。【P1】
5. As a **维护者**, I want **侧边栏收缩/拖拽调整宽度** so that **最大化编辑区域**。【P2】
6. As a **新手**, I want **看到 AI 服务配置引导** so that **知道如何开始创作**。【P1】

---

## 1. 模块概述

Dashboard 是 InkChain 的入口首页，负责展示所有作品卡片列表。编辑仪表盘 (EditDashboard) 是基于书籍的 Widget 面板，集成进度、角色、关系、时间线、世界观 5 大 Widget。搜索路由提供跨 Session 的全文本搜索能力。项目模型定义 LLM 配置、检测配置、写作配置、Daemon 调度等全局设置。

---

## 2. 行为合约

### 2.1 API 接口

#### Search API (`/books/:id/search`)

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/:id/search?q=query` | query `q` (必填)、`scope` (可选) | `{ results: SearchResult[] }` | 在书籍内全文本搜索 Session |
| GET | `/:id/search?q=query&scope=session` | query `scope=session` | `{ results: SearchResult[] }` | 限定 scope 搜索 |

**请求/响应示例**:
```json
// GET /:id/search?q=主角
// → 200
{ "results": [
  { "sessionId": "uuid", "title": "第3章创作", "snippet": "...主角握紧了手中的剑...", "score": 0.87 }
] }

// GET /:id/search
// → 200 (empty query)
{ "results": [] }

// Error → 500
{ "error": { "code": "SEARCH_ERROR", "message": "搜索失败: <message>" } }
```

#### Dashboard Data API (`/books`)

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/books` | — | `{ books: BookSummary[] }` | 列出所有作品概要 |
| DELETE | `/books/:id` | — | 204 No Content | 删除指定作品（含确认弹窗） |
| POST | `/books/:id/write-next` | — | 异步触发写入 | 触发下一章生成 |

**BookSummary 结构**:
```ts
{ id: string; title: string; genre: string; status: string; chaptersWritten: number; language?: string; fanficMode?: string }
```

### 2.2 数据模型

| Schema | 类型 | 必填字段 | 可选字段 | 默认值 / 校验 |
|--------|------|----------|---------|--------------|
| `LLMConfigSchema` | object | provider, baseUrl, model | proxyUrl, services, headers, extra, defaultModel, cover, temperature (0-2), thinkingBudget (≥0), apiFormat, stream | stream=true, temperature=0.7, thinkingBudget=0, apiFormat="chat", configSource="env", service="custom" |
| `DetectionConfigSchema` | object | provider, apiUrl, apiKeyEnv | threshold (0-1), enabled, autoRewrite, maxRetries (1-10) | threshold=0.5, enabled=false, autoRewrite=false, maxRetries=3, provider="custom" |
| `WritingConfigSchema` | object | — | reviewRetries (0-10), reviewMode | reviewRetries=1, reviewMode="auto" |
| `FoundationConfigSchema` | object | — | reviewRetries (0-10) | reviewRetries=2 |
| `QualityGatesSchema` | object | — | maxAuditRetries, pauseAfterConsecutiveFailures, retryTemperatureStep | maxAuditRetries=2, pauseAfterConsecutiveFailures=3, retryTemperatureStep=0.1 |
| `ProjectConfigSchema` | object | name, version:"0.1.0" | language, llm, notify, detection, foundation, writing, modelOverrides, inputGovernanceMode, chapterVersioning, daemon | language="zh", inputGovernanceMode="v2", chapterVersioning="snapshot" |
| `NotifyChannelSchema` | discriminatedUnion | type (telegram\|wechat-work\|feishu\|webhook) | 各类型特有字段 | — |
| `InputGovernanceModeSchema` | enum | — | — | "legacy" \| "v2" |
| `ChapterVersioningModeSchema` | enum | — | — | "git" \| "snapshot" \| "off" |

### 2.3 状态转换

#### Dashboard 加载状态机

```
                    ┌── error ──────────────────────────────┐
                    │  API 500 / 网络超时 → AlertCircle       │
                    │  重试 → 返回 idle                      │
                    ▼                                         │
idle ──→ loading ──→ rendered                               │
  ▲         │           │                                    │
  │         │           ├── empty (books.length === 0)        │
  │         │           │     → 显示空状态引导 + 创建按钮     │
  │         │           └── data (books.length > 0)           │
  │         │                → 卡片列表渲染                   │
  └─────────┴──── refetch() / delete 后刷新                  │
```

#### EditDashboard 状态机

```
                  ┌── no-book ──────────────────────────────┐
                  │  无选中书籍 → 显示"请先创建一本书"提示     │
                  ▼                                          │
idle ──→ loading ──→ rendered                                │
  ▲         │           │                                    │
  │         │           └── data (有书籍 && Widget 渲染)      │
  │         │                → ProgressWidget + Character     │
  │         │                → Relation + Timeline + World    │
  └─────────┴──── refreshKey++ / 刷新                        │
```

#### 写作进度状态（SSE 驱动）

```
写作文本状态:
  idle ──→ writing (isWriting=true) ──→ completed (chapter_saved)
              │                                            
              ├── llm:progress (显示进度)                   
              └── log (显示实时日志)                       
```

**守卫条件**:
- `loading` → `rendered`: 仅当 `useApi` 返回 data 且无 error
- `rendered` → `empty`: 仅当 `data.books.length === 0`
- `writing` → `rendered`: 仅当 SSE `chapter_saved` 事件触发 refetch

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| Dashboard → 项目配置 | 多对一 | 删除书籍 → 级联删除该书关联的 relations.json / characters.json 等 |
| EditDashboard Widget → 书籍 | 多对一 | Widget 通过 bookId 引用数据，解耦于书籍删除 |
| SSE 事件 → Dashboard 刷新 | 观察者 | SSE log / chapter_saved 事件触发 `shouldRefetchBookCollections` |
| 搜索 → Session | 通过 `searchSessions()` | 搜索函数从文件系统读取，无级联 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 加载首页 | GET /books → 200 → 渲染卡片列表 | API 500 → AlertCircle 显示 "Failed to load library" | 无书籍 → 显示空状态引导 "还没有作品" | 快捷访问 `/` (无 hash) → 正常显示 |
| 删除作品 | DELETE /books/:id → 确认弹窗 → 刷新列表 | 网络异常 → alert 弹窗提示 | N/A | 菜单展开外部点击关闭；垃圾桶按钮仅项目级 |
| 写下一章 | POST /books/:id/write-next → writing=true → 按钮变loading | 写入失败 → alert 弹窗 | N/A | isWriting 保护同书不重复触发 |
| 搜索 | GET /search?q=xxx → 返回结果列表 | SEARCH_ERROR → 500 + 错误信息 | 空 query → 返回 `{ results: [] }` | scope 过滤无效值 → 忽略，返回全部 |
| 侧边栏收缩 | 点击 toggle → 侧边栏缩小/展开 | toggle 元素不存在 → 测试失败 | N/A | 连续快速点击 → 状态不掉步 |
| 边界拖拽 | 拖拽 divider → 侧边栏宽度变化 | divider 不存在 → 测试失败 | N/A | 拖拽超出最小宽度 → 限制 min-width |
| 编辑仪表盘 | 加载 → 5 Widget 网格渲染 | API 500 → 降级空面板 | 无书籍 → 显示"请先创建一本书" | 不存在的 bookId → 显示空面板 fallback |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `Dashboard` | `/#/` | `dash-` | 项目首页，书籍卡片列表 + SSE 写作日志面板 |
| `EditDashboard` | `/#/edit-dashboard/:id` | — | 基于书籍的 Widget 面板 |
| `BookMenu` | (内嵌在 Dashboard) | — | 右键菜单：设置/导出/删除 |
| `ConfirmDialog` | (弹窗) | — | 通用确认/取消弹窗 |
| `ProgressWidget` | (内嵌在 EditDashboard) | — | 写作进度 Widget |
| `CharacterWidget` | (内嵌在 EditDashboard) | — | 角色总览 Widget |
| `RelationWidget` | (内嵌在 EditDashboard) | — | 关系图谱 Widget |
| `TimelineWidget` | (内嵌在 EditDashboard) | — | 时间线 Widget |
| `WorldWidget` | (内嵌在 EditDashboard) | — | 世界观 Widget |

### 4.2 交互流程

```
进入首页 → GET /books → 渲染卡片列表
├── 无 AI 服务 → 显示"还没有配置 AI 模型"引导横幅
├── 点击作品标题 → 跳转 `toBook(id)`
├── 点击 "写下一章" → POST /write-next → SSE 流式写入
│   ├── 写作中 → 按钮 animate-pulse + 进度条
│   └── 完成 → SSE chapter_saved → refetch
├── 点击菜单 (MoreVertical) → 弹出菜单
│   ├── 设置 → toBookSettings
│   ├── 导出 → /api/v1/books/:id/export
│   └── 删除 → ConfirmDialog → DELETE /books/:id → refetch
├── 点击 "创建" → toBookCreate
└── SSE log 面板 (右下) → 实时日志滚动

进入编辑仪表盘 → GET /books → 选择 bookId
├── 无书籍 → 显示"请先创建一本书"
└── 有书籍 → 渲染 5 Widget 网格
    ├── 进度 Widget → 章节数/字数统计
    ├── 角色 Widget → 角色列表预览
    ├── 关系 Widget → 关系图谱预览
    ├── 时间线 Widget → 时间线预览
    └── 世界观 Widget → 世界观设定预览
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 加载状态 | `dash-state-loading` | 加载中 spinner 定位 |
| 侧边栏开关 | `sidebar-toggle` or `[class*='sidebar']` | 侧边栏收缩/展开 |
| 面包屑首页 | `breadcrumb-home` | 面包屑导航 |
| 项目卡片 | `[class*='project-card']` or `[class*='book-card']` | 卡片交互点击 |
| 收缩按钮 | `[data-testid*='collapse']` | 侧边栏收缩 |
| 拖拽手柄 | `[data-testid*='resize']` or `[data-testid*='divider']` | 边界拖拽 |
| 加载 Spinner | `[class*='spinner']` or `[class*='skeleton']` | 加载状态断言 |
| 空状态 | `rg-empty-state` (通用模式) | 空数据断言 |
| 创建按钮 | `button:has-text('创建')` | 新建项目入口 |
| AI 配置引导 | `button:has-text('去配置')` | 无 AI 服务时引导 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 2s Dashbard 初始加载；p95 < 1s 删除操作 | Playwright E2E waitForSelector timeout |
| 并发 | Dashboard 页面公共 store (useApi)，多个 bookId 各自独立 | 手动测试 |
| 回滚 | DELETE /books 失败 → 弹窗提示但不移除卡片 | mock API 网络错误 |
| 降级 | AI 不可用时 → "还没有配置 AI 模型"横幅 + 去配置按钮 | 检查 `hasServices` 状态 |
| 浏览器兼容 | Chrome / Firefox / Edge 最新两个大版本 | CI matrix |
| 无障碍 | 所有交互元素可通过键盘访问 | axe-core 扫描 |
| 内存 | Dashboard 显示 100 本书籍 → 内存 < 30MB | Chrome DevTools Memory |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| Dashboard 自定义布局持久化 | EditDashboard 当前使用 DEFAULT_CONFIG 固定布局 |
| Widget 内容内联编辑 | Widget 仅预览，点击跳转到对应全页 |
| 多语言 Dashboard 动态切换 | 语言配置在 ProjectConfig 中，需重建项目 |
| 实时协作编辑 Dashboard | 单用户桌面应用 |
| 拖拽调整 Widget 位置并保存 | 当前 Widget 位置硬编码，未实现持久化 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 首次启动无项目 | 打开 Dashboard 首页 `/#/` | 空状态显示引导文字和"创建新作品"按钮；页面标题 "InkChain Studio" 可见 | ⬜ | dashboard |
| 2 | 已有 3 本书 | 打开 Dashboard | 卡片列表显示 3 本书，含书名、体裁 badge、章节数、状态指示灯 | ⬜ | dashboard |
| 3 | 无 AI 服务连接 | 打开 Dashboard | 顶部横幅显示 "还没有配置 AI 模型" 和 "去配置" 按钮 | ⬜ | dashboard |
| 4 | 已配置 AI 服务 | 点击 "写下一章" 按钮 | 按钮变为 loading 动画；SSE 日志面板显示实时日志；进度条出现 | ⬜ | dashboard |
| 5 | 已有书籍列表 | 点击书籍右侧 MoreVertical → 删除 → 确认弹窗 | 确认后书籍从列表移除；取消后书籍保留；菜单外部点击自动关闭 | ⬜ | dashboard |
| 6 | 侧边栏可见 | 点击侧边栏收缩按钮 | 侧边栏缩小到仅图标模式；再次点击恢复完整宽度 | ⬜ | dashboard-collapse-resize |
| 7 | 侧边栏存在 divider | 拖拽 divider 手柄 | 侧边栏宽度随拖拽变化；达到最小宽度时停止缩小 | ⬜ | dashboard-collapse-resize |
| 8 | 项目卡片可见 | 点击任意项目卡片 | 导航到该作品的详情页（URL 变化） | ⬜ | dashboard-collapse-resize |
| 9 | 编辑仪表盘路由 | 访问 `/#/edit-dashboard/:id` | 页面渲染 5 个 Widget（进度/角色/关系/时间线/世界观）；无 JS crash | ⬜ | edit-dashboard |
| 10 | 不存在的 bookId | 访问 `/#/edit-dashboard/nonexistent-id` | 显示 fallback UI 或空面板，不崩溃 | ⬜ | edit-dashboard |
| 11 | 访问 `/#/` | 浏览器开发者工具无 console error | pageerror 数量为 0 | ⬜ | project-root |
| 12 | API 端口 4581 | 请求 `GET /api/v1/books` | 返回 200，body 包含 `{ books: [...] }` | ⬜ | project-root |
| 13 | 访问 `/` (无 hash) | 页面正常加载 | body 长度 > 0，无崩溃 | ⬜ | dashboard |
| 14 | 访问 `/#/dashboard` | 页面正常加载 | body 长度 > 0，无崩溃 | ⬜ | dashboard |
| 15 | API 离线 | 拦截所有 `/api/**` 请求 | 页面不崩溃，显示降级 UI | ⬜ | dashboard |

完成度: 0/15 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | EditDashboard Widget 是否需要支持拖拽重排并持久化布局？ | @frontend-lead | 否（当前固定布局） |
| 2 | Dashboard 是否需要支持书籍分组/标签筛选？ | @product-lead | 否 |
| 3 | Search API 的 `scope` 参数支持哪些值？ | @backend-lead | 否（当前仅 session） |
| 4 | SSE 重连策略是什么？失联后是否需要手动刷新？ | @backend-lead | 否 |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 骨架（自动生成） | — |
| 2026-07-23 | v2.0 完整补全：基于源码 + 5 E2E spec | spec-writer-3 |
