# 守护进程 — 功能规格书 (SDD)

**版本**: 3.1
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `server.ts` (L3575-3632) + `DaemonControl.tsx` + `runtime-state.ts`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: Daemon 是 InkChain 的后台运行时服务，负责管理写作守护任务（章节自动保存、状态同步、钩子处理、章节摘要更新）。前端通过 DaemonControl 页面提供启动/停止控制和实时事件日志查看。API 端点在 `server.ts` 中内联定义，无独立 routes 文件。
> **痛点**: (1) 状态依赖 SSE 消息驱动刷新，无初始状态时 UI 显示不准确；(2) 事件日志仅显示最近 20 条；(3) 启动/停止无确认弹窗。
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

守护进程 (Daemon) 是 InkChain 的后台运行时管理器。DaemonControl 页面提供运行状态指示、启动/停止操作按钮和最近 20 条事件的实时日志流（通过 SSE 接收）。

**API 端点**（内联在 `packages/studio/src/api/server.ts` 第 3575-3632 行）:
- `GET /api/v1/daemon` — 返回 `{ running: boolean }`，检查 scheduler 运行状态
- `POST /api/v1/daemon/start` — 创建 Scheduler 实例，广播 `daemon:started` SSE 事件
- `POST /api/v1/daemon/stop` — 停止 scheduler，广播 `daemon:stopped` SSE 事件

**SSE 事件**（定义在 `packages/studio/src/hooks/use-sse.ts` 第 22-25 行）: `daemon:started`、`daemon:stopped`、`daemon:chapter`、`daemon:error`。

`shouldRefetchDaemonStatus()` 在 `packages/studio/src/hooks/use-book-activity.ts`（第 34-38 行）中定义：当收到 daemon 相关 SSE 事件时触发状态重取。

---

## 2. 行为合约

### 2.1 API 接口

Daemon 提供三个 REST 端点，全部在 `server.ts` 中内联实现：

- **获取状态**: `GET /api/v1/daemon` → `{ running: boolean }`
- **启动**: `POST /api/v1/daemon/start` → `{ ok: true, running: true }`
- **停止**: `POST /api/v1/daemon/stop` → `{ ok: true, running: false }`

启动操作会创建新的 Scheduler 实例并广播 SSE 事件。停止操作会销毁 scheduler 实例。Daemon 启动后通过 `use-api.ts` 的缓存失效逻辑自动重取状态（第 55-57 行）。

### 2.2 数据模型

**运行时状态模型**（定义在 `packages/core/src/models/runtime-state.ts`，145 行）:

Daemon 通过 Scheduler 和 Writer agent 管理以下数据结构（均为 Zod schema 导出）:

- **StateManifest**: 状态文件清单 — schemaVersion (2), language (zh/en), lastAppliedChapter, projectionVersion, migrationWarnings[]
- **HookRecord**: 伏笔/钩子记录 — hookId, startChapter, type, status (open/progressing/deferred/resolved), lastAdvancedChapter, expectedPayoff, payoffTiming, notes, dependsOn?, coreHook?, halfLifeChapters?, promoted?
- **HooksState**: 全局钩子状态 — hooks[] (HookRecord[])
- **ChapterSummaryRow**: 章节摘要（CSV 风格）— chapter, title, characters, events, stateChanges, hookActivity, mood, chapterType
- **ChapterSummariesState**: 章节摘要集合 — rows[] (ChapterSummaryRow[])
- **CurrentStateFact**: 当前状态事实（SPO 三元组）— subject, predicate, object, validFromChapter, validUntilChapter?, sourceChapter
- **CurrentStateState**: 当前状态快照 — chapter, facts[] (CurrentStateFact[])
- **CurrentStatePatch**: 增量更新 — currentLocation?, protagonistState?, currentGoal?, currentConstraint?, currentAlliances?, currentConflict?
- **HookOps**: 钩子批量操作 — upsert[], mention[], resolve[], defer[]
- **RuntimeStateDelta**: 单次章节状态增量 — chapter, currentStatePatch?, hookOps, newHookCandidates[], chapterSummary?, subplotOps[], emotionalArcOps[], characterMatrixOps[], notes[]

状态转换规则: HookRecord.status: open → progressing → resolved（或 deferred）。HookPayoffTiming: immediate → near-term → mid-arc → slow-burn → endgame。

**Daemon 配置**（定义在 `packages/core/src/models/project.ts` 第 133-163 行）:
- `daemon.schedule.radarCron`: 默认 `"0 */6 * * *"`（每 6 小时雷达扫描）
- `daemon.schedule.writeCron`: 默认 `"*/15 * * * *"`（每 15 分钟写作周期）
- `daemon.maxConcurrentBooks`: 默认 3
- `daemon.chaptersPerCycle`: 默认 1
- `daemon.maxChaptersPerDay`: 默认 50

**运行时状态存储**（`packages/core/src/state/runtime-state-store.ts`，165 行）:
- `loadRuntimeStateSnapshot(bookDir)`: 从 `story/state/` 目录加载 4 个 JSON 文件
- `buildRuntimeStateArtifacts({ bookDir, delta, language })`: 加载快照、仲裁 hooks、应用 delta、渲染投影
- `saveRuntimeStateSnapshot(bookDir, snapshot)`: 持久化状态快照

### 2.3 UI 状态转换

DaemonControl 状态机：

```
idle → GET /daemon → 显示状态
  ├── running=true → 绿色 "运行中" + 停止按钮 + 事件日志可见
  └── running=false → 灰色 "已停止" + 启动按钮 + 空日志提示
SSE 消息触发 refetch (daemon:started/stopped/error)
start/stop → POST → loading=true → refetch 状态更新
API 500 → alert() 弹出错误，状态保持上次值
```

事件日志过滤:
```
sse.messages → filter: event.startsWith("daemon:") || event === "log"
→ slice(-20) → 渲染: event名称 + " › " + (data.message ?? data.bookId ?? JSON)
```

**守卫条件**:
- `shouldRefetchDaemonStatus(sseEvent)`: 仅 daemon:started/stopped/error 触发
- `loading`: 操作期间 true，按钮 disabled（防快速连续点击）

### 2.4 关联约束

- Daemon → 书籍: 一对多。daemon 停止不影响已持久化的书籍数据
- Daemon → 运行时状态: 一对一。daemon 停止 → 状态管理暂停，数据不丢失
- DaemonControl → SSE: 被动监听。SSE 断开 → 无法实时更新，需手动 refetch

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 页面加载 | GET 200 → 显示状态 + 按钮 | GET 500 → 页面渲染但状态未知 | data=null → running=false 降级 | SSE 无消息 → 事件日志为空 |
| 启动 | POST 200 → refetch → "运行中" | POST 失败 → alert() 提示 | N/A | loading 守卫阻止快速连续点击 |
| 停止 | POST 200 → refetch → "已停止" | POST 失败 → alert() 提示 | N/A | loading 守卫阻止快速连续点击 |
| 事件日志 | SSE 推送 daemon:* → 列表更新 | SSE 断开 → 日志停止 | 无事件 → 提示"等待事件..." | 20 条限制 → 旧事件自动掉落 |
| API 异常 | N/A | 所有 API 返回 500 → 页面不崩溃 | N/A | E2E #4 覆盖 |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `DaemonControl` | `/#/daemon` | 无统一前缀 | 守护进程控制页面，含状态指示 + 启动/停止按钮 + 事件日志 |

**Sidebar 集成**（`Sidebar.tsx` 第 770-777, 849-857 行）: 导航标签 `nav.daemon`（"守护进程"），图标 `Zap`，daemon 运行时显示绿色脉冲点 + "Agent Online" 状态指示器。

### 4.2 交互流程

```
进入守护进程页面 → GET /daemon → 显示状态 + 近期事件
┌─ Header ────────────────────────────────────────┐
│ 守护进程控制            {运行中/已停止} [启动/停止] │
└─────────────────────────────────────────────────┘
┌─ Event Log ─────────────────────────────────────┐
│ 事件日志（最多 20 条）                            │
│ 空态: "守护进程未启动" / "等待事件..."             │
└─────────────────────────────────────────────────┘
```

### 4.3 关键 data-testid

DaemonControl 未声明 `data-testid`。E2E 测试通过文本内容定位：

| 元素 | 选择器 | 用途 |
|------|--------|------|
| 页面标题 | `page.getByText("守护进程控制")` | 确认页面已渲染 |
| 状态指示 | `text: "运行中"` / `text: "已停止"` | 验证运行状态 |
| 启动/停止按钮 | `button:has-text("启动")` / `button:has-text("停止")` | 操作按钮 |
| 事件日志区域 | `text: "事件日志"` | 定位日志面板 |
| 空日志提示 | `text: "守护进程未启动"` / `text: "等待事件"` | 验证空状态 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | GET /daemon < 500ms；start/stop < 2s | E2E waitForTimeout |
| 降级 | API 不可用 → 页面不崩溃，alert 提示 | daemon-control E2E #4 |
| 实时性 | SSE 事件到达到 UI 更新 < 100ms | useEffect 触发 refetch |
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
| 1 | 事件日志是否需要持久化到本地文件？ | @backend-lead | 否 |
| 2 | start/stop 操作是否需要确认弹窗？ | @frontend-lead | 否 |
| 3 | 事件日志 20 条限制是否可配置？ | @frontend-lead | 否 |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 骨架（自动生成） | — |
| 2026-07-23 | v2.0 完整补全 | spec-writer-4 |
| 2026-07-25 | v3.0 页面组件对齐；v3.1 移除 API 表格和数据模型表格，改为 prose 格式 | sdd-phase-0-agent |
