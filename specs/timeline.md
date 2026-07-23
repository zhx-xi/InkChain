# 时间线 — 功能规格书 (SDD)

**版本**: 1.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `api/routes/timelines.ts` + `models/character-timeline.ts` + `TimelinePage.tsx`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: 时间线使用 ReactFlow 矩阵布局渲染，X 轴为章节、Y 轴为角色，支持手动 CRUD、AI 提取、卷筛选、折叠/展开、轻量模式（500+ 事件）。
> **痛点**: (1) 多事件堆积在单元格时阅读困难，超过 3 个事件被折叠后用户无法快速预览；(2) AI 提取事件仅支持逐章提取，不支持批量章节；(3) 大事件量(>500)时轻量模式下的编辑体验退化；(4) 跨角色关联边的识别基于标签匹配，不够直观。
> **期望状态**: 可展开/折叠单元格查看所有事件；AI 提取支持章节范围输入(如 1-5)；轻量模式保持可交互编辑；跨角色边基于共享标签自动连线。
> **成功指标**: 11 个 E2E spec 全部通过（timeline-page-core / timeline-axis-view / timeline-chapter-filter / timeline-character-labels / timeline-column-spacing / timeline-cross-role / timeline-filter / timeline-flow / timeline-hierarchy-collapse / timeline-volume-filter / timeline-zoom-drag）。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **在矩阵视图中看到每个章节与角色的交叉是否有事件** so that **能快速定位剧情密集区**。【P0】
2. As a **写作者**, I want **点击事件节点查看详情并编辑** so that **能快速修正事件信息**。【P0】
3. As a **写作者**, I want **AI 从指定章节范围提取时间线事件** so that **批量导入结构性事件**。【P1】
4. As a **写作者**, I want **按卷或章节筛选视图** so that **聚焦当前写作任务**。【P1】
5. As a **写作者**, I want **在多事件单元格中展开/折叠** so that **不过度拥挤且保留访问所有事件的能力**。【P2】
6. As a **维护者**, I want **character_timelines.json 损坏时显示明确错误而非白屏** so that **能快速定位数据问题**。【P1】

---

## 1. 模块概述

时间线是 InkChain 中管理**章节-角色交叉事件**的矩阵可视化工具。底层用 ReactFlow 渲染节点-边图，X 轴为章节、Y 轴为角色，事件节点排列在对应交叉单元格中。数据持久化到 `story/state/character_timelines.json`。支持手动 CRUD、AI 提取、卷和章节筛选、角色筛选、层级折叠、轻量模式（500+ 事件时简化渲染）。

---

## 2. 行为合约

### 2.1 API 接口

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/:id/timelines` | query `character`(可选), `chapter`(可选) | `{ events: TimelineEvent[] }` | 列出所有事件，可选按角色/章节过滤 |
| GET | `/:id/timelines/:eventId` | — | `{ event: TimelineEvent }` | 获取单个事件 |
| POST | `/:id/timelines` | `TimelineEvent` body (无 id) | `{ event: TimelineEvent }` (201) | 创建事件（id/timestamp 自动生成） |
| PUT | `/:id/timelines/:eventId` | `TimelineEventSchema.partial()` body | `{ event: TimelineEvent }` | 更新指定事件；id 不可变 |
| DELETE | `/:id/timelines/:eventId` | — | `{ deleted: true }` | 删除指定事件 |

**请求/响应示例**:
```json
// POST /:id/timelines → Request Body
{ "timestamp": "2026-07-23T12:00:00Z", "eventType": "plot",
  "title": "主角遇敌", "description": "主角在城外遭遇埋伏",
  "relatedCharacters": ["张三"], "chapter": 3, "importance": 4,
  "tags": ["战斗", "转折"] }
// → 201 Created
{ "event": { "id": "uuid-auto-generated", ...上面所有字段 } }

// Error → 400 Bad Request
{ "error": { "code": "VALIDATION_ERROR", "message": "校验失败",
    "details": { "fieldErrors": { "importance": ["必须为 1-5 的整数"] } } } }

// Error → 404 Not Found (DELETE non-existent)
{ "error": { "code": "NOT_FOUND", "message": "时间线事件 non-existent-id 不存在" } }
```

### 2.2 数据模型

| Schema | 类型 | 必填字段 | 可选字段 | 默认值 / 校验 |
|--------|------|----------|---------|--------------|
| `TimelineEventSchema` | object | id, timestamp(ISO datetime), eventType, title, chapter(int≥0), importance(1-5) | description, relatedCharacters[], regionId, tags[], timestamp | id=crypto.randomUUID(); importance 默认 3; description 默认 "" |
| `CharacterTimelineFileSchema` | object | — | events[], version | events 默认 []; version 默认 1; 损坏文件→返回 {events:[], version:1} |
| `eventType` | string | plot / character / world | — | 颜色映射: plot→蓝, character→绿, world→橙, 其他→灰 |

importance 显示: 1="微不足道", 2="次要", 3="普通", 4="重要", 5="核心"；星级用 ★/☆ 渲染。

### 2.3 状态转换

#### UI 状态机（每个操作独立）

```
                    ┌── error ──────────────────────────────────┐
                    │  API 500 / 网络超时 → "无法加载时间线数据"   │
                    │  点击"重试" → refetch()                    │
                    ▼                                             │
idle ──→ loading ──→ rendered                                   │
  ▲         │           │                                        │
  │         │           ├── empty (events.length === 0)          │
  │         │           │     → tl-state-empty 可见              │
  │         │           └── data (events.length > 0)             │
  │         │                → ReactFlow 矩阵渲染                │
  └─────────┴──── refetch() / 卷切换 / 筛选条件变化              │
```

**守卫条件**:
- `rendered` → `EventDetailDialog 可见`: 仅当 `selectedEvent !== null`
- `rendered` → `EditDialog 可见`: 仅当 `editDialogOpen === true` (双击节点 或 右键→编辑)
- `rendered` → `ContextMenu 可见`: 仅当 `contextMenu !== null` (右键节点)
- `rendered` → `DeleteConfirm 可见`: 仅当 `deleteConfirmEvent !== null`
- `rendered` → `AI Extract Modal 可见`: 仅当 `showAiExtract === true`
- `rendered` → `轻量模式`: 仅当事件数 > 500 (isLightweightMode)

#### 数据状态机（事件生命周期）

```
                   POST /timelines (201)
新建 ───────────────────────────────────────→ 已创建
                                               │
                          PUT /timelines/:id  │
已创建 ───────────────────────────────────────→ 已修改
                                               │
                    DELETE /timelines/:id      │
已创建 / 已修改 ───────────────────────────────→ 已删除 (不可逆)
                                               │
                          AI 提取              │
已创建 ───────────────────────────────────────→ 提取待导入
                                               │
                    选择性应用 / 全部应用       │
提取待导入 ───────────────────────────────────→ 已创建

冲突状态: PUT 前无乐观锁检测 → 后写覆盖
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| 事件 → 书籍 | 多对一 | 删除书籍 → 整个 character_timelines.json 级联删除 |
| 事件 → 角色 | 多对多（通过 relatedCharacters 字符串数组） | 角色删除时不自动清理关联事件 |
| 事件 → 世界观区域 | 通过 regionId | 删除区域不影响事件 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 创建 | POST → 201 → 矩阵插入新事件节点 | INVALID_JSON → 400 / VALIDATION_ERROR → 400 + details | 空数组 → POST 后出现首个事件节点 | importance=0 或 6 → 校验失败 400 |
| 读取 | GET → 200 → ReactFlow 矩阵渲染 | API 500 → tl-state-error 显示; 点击"重试" | 空事件列表 → tl-state-empty "暂无时间线事件" | 500+事件 → isLightweightMode=true 轻量渲染 |
| 更新 | PUT → 200 → 节点标签/星标刷新 | NOT_FOUND → 404 / VALIDATION_ERROR → 400 | N/A | 双击节点→编辑对话框；并发保存无冲突检测 |
| 删除 | DELETE → 200 → 节点从矩阵消失，refetch | NOT_FOUND → 404 | N/A | 右键→删除→确认对话框；deleting 状态锁 |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `TimelinePage` | `/#/timeline/:bookId` | `tl-` | 主页面，含 ReactFlow 画布 + 工具栏 + 底部状态栏 |
| `TimelineEventNode` | ReactFlow 节点 | `tl-event-node` | 自定义事件节点，显示标题/类型/重要度/角色 |
| `OverflowIndicatorNode` | ReactFlow 节点 | `tl-cell-overflow-btn-` | 折叠标识，点击展开该单元格所有事件 |
| `ChapterHeaderNode` | ReactFlow 节点 | — | X 轴章节标签（第 N 章） |
| `CharacterHeaderNode` | ReactFlow 节点 | — | Y 轴角色标签 |
| `EventEditDialog` | 内嵌 Dialog | — | 创建/编辑事件表单（标题/描述/类型/章节/重要度/角色/标签） |
| `AI Extract Modal` | 全屏遮罩 | — | AI 提取面板，输入章节范围 + 预览/勾选/应用结果 |
| `ContextMenu` | 绝对定位 | — | 右键菜单（编辑/删除） |
| `DeleteConfirm` | Dialog | — | 删除确认弹窗 |

### 4.2 交互流程

```
进入时间线 → 自动加载 character_timelines.json → 计算矩阵布局 → 渲染节点+边 → fitView
┌─ 工具栏 ───────────────────────────────────────────────────────────┐
│ [卷筛选▼] [折叠卷] [筛选角色…] [章节筛选▼] [折叠章节] [全部展开/折叠] │
│ [图例:●剧情 ●角色 ●世界观] [AI提取] [新增事件] [FPS(dev)] [轻量(500+)] │
└────────────────────────────────────────────────────────────────────┘
点击节点 → EventDetailDialog (标题/描述/类型/重要度/角色/标签/时间) → [编辑]
双击节点 → EventEditDialog → [保存/Cancel]
右键节点 → ContextMenu → [编辑] [删除]
右键→删除 → 确认弹窗 → "确认删除事件「标题」？此操作不可撤销。" → [确认删除/Cancel]
点击AI提取 → 章节范围输入(如 1-5) → 开始提取 → 事件预览→ 勾选/全部应用 → refetch
┌─ 底部状态栏 ──────────────────────────────────────────────────────┐
│ 共 N 个事件，已加载 M 个（全部事件: T）   [加载更多（+100）]        │
└────────────────────────────────────────────────────────────────────┘
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 事件节点 | `tl-event-node` | ReactFlow 事件节点 |
| 折叠标记 | `tl-cell-overflow-btn-{cellKey}` | 点击展开折叠事件 |
| 缩放-放大 | `tl-btn-zoom-in` | 放大按钮 |
| 缩放-缩小 | `tl-btn-zoom-out` | 缩小按钮 |
| 适应画布 | `tl-btn-fit-view` | fitView 按钮 |
| 加载状态 | `tl-state-loading` / `tl-loading-spinner` | 加载中指示器 |
| 错误状态 | `tl-state-error` | API 异常提示 |
| 空状态 | `tl-state-empty` | 无事件时显示 |
| 画布区域 | `tl-canvas-reactflow` | ReactFlow 渲染容器 |
| 加载更多 | `tl-indicator-load-more` | 分页加载按钮 |
| 卷折叠 | `tl-btn-volume-collapse` | 折叠/展开卷 |
| 章节折叠 | `tl-btn-chapter-collapse` | 折叠/展开章节 |
| 全部展开 | `tl-btn-expand-all` | 全部展开/折叠 |
| 角色筛选 | `character-filter` | 角色名筛选输入 |
| 缩放控制 | `tl-btn-zoom-in` / `tl-btn-zoom-out` / `tl-btn-fit-view` | 自定义缩放按钮 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 2s 矩阵加载(100 事件内)；p95 < 30s AI 提取；p99 < 5s 超大矩阵(500事件) | Playwright E2E `page.waitForSelector("tl-canvas-reactflow")` timeout |
| 并发 | 同一书籍多 tab 各自独立 React state | 手动验证 |
| 回滚 | 写操作原子性: `saveTimelines` 使用 `writeFile` 覆盖 → 失败时返回错误不更新前端 | 单元测试 mock fs 写入失败 |
| 降级 | 500+事件自动切换轻量模式(isLightweightMode)；AI 提取失败→Modal 显示错误 | useTimelineSegments hook 懒加载 |
| 浏览器兼容 | Chrome / Firefox / Edge 最新两个大版本 | CI matrix |
| 无障碍 | WCAG 2.1 AA — 所有按钮通过键盘可访问 | axe-core 扫描 |
| 内存 | 500 事件 + ReactFlow → 内存 < 80MB（不含 Chrome 基线） | Chrome DevTools Memory 面板 |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 时间线时间轴视图（纯线性） | 当前矩阵视图已覆盖章节-角色交叉；线性视图另有独立方案 |
| 事件拖拽移动到其他章节/角色 | 需修改 chapter/relatedCharacters 字段，当前仅通过编辑对话框 |
| 实时协作编辑 | 单用户桌面应用，无 WebSocket sync |
| 跨角色边的双向连线 | 边仅为可视化辅助，不表示双向关系 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 进入时间线页面 | 等待加载完成 | ReactFlow 画布可见，`tl-canvas-reactflow` 渲染；事件节点有 `tl-event-node` | ⬜ | timeline-page-core |
| 2 | 时间线已加载含 3 章 × 2 角色 | 查看矩阵布局 | X 轴显示章节标签，Y 轴显示角色名；事件在正确交叉单元格 | ⬜ | timeline-axis-view |
| 3 | 选择章节筛选下拉 | 选择"第 3 章" | 仅显示第 3 章事件；其他章节列隐藏 | ⬜ | timeline-chapter-filter |
| 4 | 输入角色筛选关键词 | 输入"张三" | 仅显示张三相关事件；其他角色行隐藏 | ⬜ | timeline-character-labels |
| 5 | 筛选后角色/章节数变化 | 查看列间距 | 列间距自动调整(180-220px)；角色行间距根据最大事件数动态变化 | ⬜ | timeline-column-spacing |
| 6 | 两个事件有共享标签 | 查看跨角色连线 | 虚线边连接不同角色的共享标签事件 | ⬜ | timeline-cross-role |
| 7 | 工具栏可见 | 切换卷筛选/角色筛选/章节筛选 | 视图随筛选条件实时更新 | ⬜ | timeline-filter |
| 8 | 时间线有 ReactFlow 视图 | 缩放/拖拽画布 | zoom/pan 流畅；自定义缩放按钮(+/-/⊞)可用 | ⬜ | timeline-zoom-drag |
| 9 | 时间线含章节和角色层级 | 点击卷折叠/章节折叠 | 折叠的章节行隐藏；点击展开恢复 | ⬜ | timeline-hierarchy-collapse |
| 10 | 选择卷筛选→选特定卷 | 查看过滤结果 | 仅显示该卷章节内事件 | ⬜ | timeline-volume-filter |
| 11 | 时间线有 ReactFlow 边 | @xyflow/react 版本为 v12+ | fitView 正确计算节点位置 | ⬜ | timeline-flow |

完成度: 0/11 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | AI 提取使用的 skillId="extract-timeline" 在后端如何接入？降级策略是什么？ | @backend-lead | 否（当前 mock/extract API 可模拟） |
| 2 | 删除角色时是否自动清理关联的 timeline 事件中的 relatedCharacters？ | @backend-lead | 是（当前未实现级联清理） |
| 3 | 轻量模式(500+事件)下的事件编辑是否应降至只读？当前仍保持可编辑 | @frontend-lead | 否 |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 初始版本，基于 API/Model/E2E 代码 | spec-writer-1 |
