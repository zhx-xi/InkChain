# 守护进程 — 功能规格书 (SDD)

**版本**: 2.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `models/runtime-state.ts` + `DaemonControl.tsx`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: Daemon 是 InkChain 的后台运行时服务，负责管理写作守护任务（如章节自动保存、状态同步、钩子处理、章节摘要更新等）。前端通过 DaemonControl 页面提供启动/停止控制和实时事件日志查看。
> **痛点**: (1) 守护进程状态依赖 SSE 消息驱动刷新，无初始状态时 UI 显示不准确；(2) 事件日志仅显示最近 20 条，历史事件丢失；(3) 启动/停止无确认弹窗，误操作风险；(4) 运行时状态数据模型（Hook/HooksState/ChapterSummary 等）定义在 core 包中，与 UI 完全解耦。
> **期望状态**: 守护进程页面提供清晰的运行状态指示、启动/停止控制和实时事件日志，覆盖 Normal/Error/Empty/Edge 四态。
> **成功指标**: daemon-control E2E（4 个测试）全部通过。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **一键启动/停止后台守护进程** so that **控制自动保存和 AI 助手开关**。【P0】
2. As a **写作者**, I want **查看守护进程运行状态** so that **确认后台任务是否正常**。【P0】
3. As a **写作者**, I want **查看实时事件日志** so that **监控守护进程活动**。【P1】
4. As a **维护者**, I want **API 故障时页面不崩溃** so that **不影响其他模块的使用**。【P1】

---

## 1. 模块概述

守护进程 (Daemon) 是 InkChain 的后台运行时管理器。DaemonControl 页面提供：
- 运行状态指示（运行中 / 已停止）
- 启动/停止操作按钮
- 最近 20 条事件的实时日志流（通过 SSE 接收）

无专用 API 路由——通过已有 `/daemon`、`/daemon/start`、`/daemon/stop` 端点交互。运行时状态数据模型（`runtime-state.ts`）定义了 Hook、章节摘要、当前状态等所有需要 daemon 管理的数据结构。

---

## 2. 行为合约

### 2.1 API 接口

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/api/v1/daemon` | — | `{ running: boolean }` | 获取守护进程运行状态 |
| POST | `/api/v1/daemon/start` | — | `{ ok: boolean, running: true }` | 启动守护进程 |
| POST | `/api/v1/daemon/stop` | — | `{ ok: boolean, running: false }` | 停止守护进程 |

**SSE 事件类型**:
- `daemon:*` — 守护进程状态事件（如 `daemon:started`, `daemon:stopped`）
- `log` — 通用日志事件

### 2.2 数据模型

#### UI 数据

| Schema | 类型 | 字段 | 说明 |
|--------|------|------|------|
| DaemonStatus | object | running (boolean) | 从 GET /daemon 获取 |

#### 运行时状态（由 daemon 管理，定义在 `@inkchain/inkchain-core`）

| Schema | 关键字段 | 说明 |
|--------|---------|------|
| `StateManifest` | schemaVersion (2), language (zh/en), lastAppliedChapter, projectionVersion, migrationWarnings[] | 状态文件清单 |
| `HookRecord` | hookId, startChapter, type, status (open/progressing/deferred/resolved), lastAdvancedChapter, expectedPayoff, payoffTiming?, notes, dependsOn?, paysOffInArc?, coreHook?, halfLifeChapters?, advancedCount?, promoted? | 单个伏笔/钩子记录 |
| `HooksState` | hooks[] (HookRecord[]) | 全局钩子状态 |
| `ChapterSummaryRow` | chapter, title, characters, events, stateChanges, hookActivity, mood, chapterType | 章节摘要（CSV 风格） |
| `ChapterSummariesState` | rows[] (ChapterSummaryRow[]) | 章节摘要集合 |
| `CurrentStateFact` | subject, predicate, object, validFromChapter, validUntilChapter?, sourceChapter | 当前状态事实（SPO 三元组） |
| `CurrentStateState` | chapter, facts[] (CurrentStateFact[]) | 当前状态快照 |
| `CurrentStatePatch` | currentLocation?, protagonistState?, currentGoal?, currentConstraint?, currentAlliances?, currentConflict? | 当前状态增量更新 |
| `HookOps` | upsert[] (HookRecord[]), mention[] (string[]), resolve[] (string[]), defer[] (string[]) | 钩子批量操作 |
| `RuntimeStateDelta` | chapter, currentStatePatch?, hookOps, newHookCandidates[], chapterSummary?, subplotOps[], emotionalArcOps[], characterMatrixOps[], notes[] | 单次章节应用的状态增量 |

**状态转换**:
- `HookStatus`: open → progressing → resolved（或 deferred）
- `HookPayoffTiming`: immediate → near-term → mid-arc → slow-burn → endgame

### 2.3 UI 状态转换

#### DaemonControl 状态机

```
                    ┌── error ──────────────────────────────────┐
                    │  API 500 / 网络异常 → alert() 弹出错误      │
                    │  状态显示保持上次值（不自动恢复）             │
                    ▼                                             │
idle ──→ GET /daemon → 显示状态                                  │
  ▲         │           │                                        │
  │         │           ├── running=true                          │
  │         │           │     → 绿色 "运行中" + 停止按钮           │
  │         │           │     → 事件日志区域可见                    │
  │         │           └── running=false                         │
  │         │                → 灰色 "已停止" + 启动按钮            │
  │         │                → 空日志区域 + 提示文字               │
  │         │                                                    │
  ├─────────┴── SSE 消息触发 refetch (shouldRefetchDaemonStatus)  │
  │                                                               │
  └──────────── start/stop → POST → refetch 状态更新               │
```

**守卫条件**:
- `shouldRefetchDaemonStatus(sseEvent)`: 仅当最新 SSE 消息匹配特定条件时触发 refetch
- `handleStart` / `handleStop`: 操作期间 `loading` 为 true，按钮 disabled

#### 事件日志过滤

```
sse.messages
  → 过滤: event 以 "daemon:" 开头 或 event === "log"
  → slice(-20): 仅保留最近 20 条
  → 渲染: event 名称 + " › " + (data.message ?? data.bookId ?? JSON)
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| Daemon → 书籍 | 一对多 | daemon 停止 → 不影响已持久化的书籍数据 |
| Daemon → 运行时状态 | 一对一 | daemon 停止 → 状态管理暂停，数据不丢失 |
| DaemonControl → SSE | 被动监听 | SSE 连接断开 → 无法实时更新状态，手动 refetch |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 页面加载 | GET /daemon → 200 → 显示状态 + 按钮 | GET /daemon → 500 → 页面渲染但状态未知，按钮仍可操作 | data=null → running=false 降级显示 | SSE 无消息 → 事件日志为空 |
| 启动 | POST /daemon/start → 200 → refetch → 显示"运行中" | POST 失败 → alert() 弹出错误信息 | N/A | 快速连续点击 → loading 守卫阻止 |
| 停止 | POST /daemon/stop → 200 → refetch → 显示"已停止" | POST 失败 → alert() 弹出错误信息 | N/A | 快速连续点击 → loading 守卫阻止 |
| 事件日志 | SSE 推送 daemon:* 事件 → 列表更新 | SSE 连接断开 → 日志停止更新 | 无历史事件 → 显示提示文字 | 20 条限制 → 旧事件自动掉落 |
| API 异常 | N/A | 所有 API 返回 500 → 页面不崩溃 | N/A | E2E 测试覆盖 #4 |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `DaemonControl` | `/#/daemon` | 无统一前缀 | 守护进程控制页面，含状态指示 + 启动/停止按钮 + 事件日志 |

### 4.2 交互流程

```
进入守护进程页面 → GET /daemon → 显示状态 + 近期事件
┌─ Breadcrumb ────────────────────────────────────┐
│ 首页 / 守护进程                                   │
└─────────────────────────────────────────────────┘
┌─ Header ────────────────────────────────────────┐
│ 守护进程控制            {运行中/已停止} [启动/停止] │
└─────────────────────────────────────────────────┘
┌─ Event Log ─────────────────────────────────────┐
│ 事件日志                                         │
│ ┌── 消息列表 (最多 20 条) ──────────────────────┐│
│ │ daemon:started › 守护进程已启动               ││
│ │ daemon:chapter-saved › ch-1                    ││
│ │ ...                                           ││
│ └──────────────────────────────────────────────┘│
│  空态: "守护进程未启动，点击启动按钮" 或            │
│        "等待事件..."                             │
└─────────────────────────────────────────────────┘
```

### 4.3 关键 data-testid

DaemonControl 未声明显式 `data-testid`。E2E 测试通过文本内容定位：

| 元素 | 选择器 | 用途 |
|------|--------|------|
| 页面标题 | `page.getByText("守护进程控制")` | 确认页面已渲染 |
| 状态指示 | `text: "运行中"` / `text: "已停止"` | 验证运行状态显示 |
| 启动按钮 | `button:has-text("启动")` | 启动守护进程 |
| 停止按钮 | `button:has-text("停止")` | 停止守护进程 |
| 事件日志区域 | `text: "事件日志"` | 定位日志面板 |
| 空日志提示 | `text: "守护进程未启动"` / `text: "等待事件"` | 验证空状态 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | GET /daemon < 500ms；start/stop < 2s | E2E waitForTimeout + 手动 |
| 降级 | API 不可用 → 页面不崩溃，alert 提示 | daemon-control E2E #4 |
| 实时性 | SSE 事件到达到 UI 更新 < 100ms | React useEffect 触发 refetch |
| 浏览器兼容 | Chrome / Firefox / Edge 最新两个大版本 | CI matrix |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 守护进程配置页面 | 配置通过 CLI 或配置文件管理 |
| 历史事件搜索/过滤 | 仅保留 20 条最近事件 |
| 多守护进程管理 | 单实例桌面应用 |
| 守护进程健康监控告警 | 非企业级运维工具 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 守护进程已停止，API 返回 running:false | 导航到守护进程页面 | 页面标题 "守护进程控制" 可见 | ⬜ | daemon-control #1 |
| 2 | 守护进程已停止 | Mock start API 返回 ok:true | 页面不崩溃，body 有内容 | ⬜ | daemon-control #2 |
| 3 | 守护进程运行中 | Mock stop API 返回 ok:true | 页面不崩溃，body 有内容 | ⬜ | daemon-control #3 |
| 4 | 所有 daemon API 返回 500 | 导航到守护进程页面 | 页面不崩溃，body 有内容 | ⬜ | daemon-control #4 |

完成度: 0/4 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | 事件日志是否需要持久化到本地文件以支持历史查看？ | @backend-lead | 否 |
| 2 | start/stop 操作是否需要确认弹窗防止误操作？ | @frontend-lead | 否 |
| 3 | 事件日志 20 条限制是否可配置？ | @frontend-lead | 否 |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 骨架（自动生成） | — |
| 2026-07-23 | v2.0 完整补全：基于 runtime-state 模型 + DaemonControl + E2E spec | spec-writer-4 |
