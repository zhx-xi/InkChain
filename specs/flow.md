# 剧情流程图 — 功能规格书 (SDD)

**版本**: 2.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `FlowView.tsx` + `story-flow-layout.ts` + `story-editor-deltas.ts`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: Flow 模块是互动电影的故事图可视化工具，基于 ReactFlow + 自定义 dagre 布局渲染节点-边图，支持拖拽移位、添加/删除节点、连接节点、删除边、悬停路径高亮、小地图导航。
> **痛点**: (1) 编辑模式需要手动切换后才能修改节点/边；(2) 拖拽节点位置后需等待后端 delta 持久化；(3) 空图（无节点）无专门的空状态占位；(4) dead-end 节点（非 ending 且无分支）无特殊视觉标识。
> **期望状态**: 流程图支持增删改查节点/边，编辑开关隔离读写模式，悬停路径高亮辅助剧情分析，统计栏提供结构健康检查，所有操作覆盖 4 态。
> **成功指标**: 3 个 E2E spec 全部通过（flow / flow-editor / flow-screenshot）。

---

## 0a. 用户故事 (User Stories)

1. As a **互动电影创作者**, I want **可视化查看所有剧情节点和分支** so that **理清故事分支结构**。【P0】
2. As a **互动电影创作者**, I want **拖拽节点调整布局** so that **流程图更直观易读**。【P0】
3. As a **互动电影创作者**, I want **添加/删除/连接节点和边** so that **在可视化界面中编辑故事结构**。【P1】
4. As a **互动电影创作者**, I want **悬停节点时高亮其后继路径** so that **快速理解分支后果**。【P1】
5. As a **互动电影创作者**, I want **查看节点统计（总数/分支数/结局数/死路数）** so that **评估故事结构健康度**。【P2】
6. As a **维护者**, I want **截图测试验证 9 节点布局无重叠** so that **确保 dagre 布局质量基线**。【P1】

---

## 1. 模块概述

流程图 (`FlowView`) 是 InkChain 互动电影模块的核心可视化工具。底层用 ReactFlow 渲染带类型的节点（start/branch/ending/merge/explore/normal），数据从 `/projects/:id/story-graph` API 加载，通过 `layoutStoryGraph()` 计算 dagre 布局后展示。支持编辑模式下通过 delta API 进行增量修改（添加节点、移动节点、添加/删除分支连线、删除节点），悬停节点时 DFS 计算后继路径并高亮，提供 MiniMap 和 Controls 导航。

注意：Flow 模块无独立 API 路由——它复用项目 API（GET `/projects/:id/story-graph`，POST `/projects/:id/story-graph/delta`），状态通过 ReactFlow controlled state + zustand 管理。

---

## 2. 行为合约

### 2.1 API 接口

Flow 本身无专用 API 路由，通过共享 Store 调用以下接口：

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/projects/:id/story-graph` | — | `StoryGraph` | 加载故事图数据 |
| POST | `/projects/:id/story-graph/delta` | `{ delta: MoveNodeDelta / AddNodeDelta / AddChoiceDelta / RemoveChoiceDelta / RemoveNodeDelta }` | 操作结果 | 增量修改剧情图 |

### 2.2 数据模型

| Schema | 类型 | 字段 | 说明 |
|--------|------|------|------|
| `StoryGraph` | object | nodes[], title?, edges 由 nodes.choices 推导 | 顶层故事图结构 |
| `GraphNode` | object | id (string), type (start/branch/ending/merge/explore/normal), title, choices[], position? | 节点定义，choices 中的每个选项映射为一条边 |
| `Choice` | object | id, text, targetNodeId | 分支选项，连线格式 `${sourceId}->${choiceId}` |
| `NodeTypes` | enum | start / branch / ending / merge / explore / normal | 节点类型决定颜色和 Minimap 色值 |
| `TYPE_COLOR` (UI) | record | start=emerald, branch=amber, ending=rose, merge=sky, explore=violet, normal=muted | CSS 类名 |
| `TYPE_MINIMAP_COLOR` | record | start=#10b981, branch=#f59e0b, ending=#f43f5e, merge=#0ea5e9, explore=#8b5cf6, normal=#6b7280 | MiniMap 节点颜色 |
| `StoryNode` (RF) | Node | id, position, data={label, nodeType}, type="story" | ReactFlow 节点 |
| `StoryEdge` (RF) | Edge | id=`${node.id}->${choice.id}`, source, target, label=choice.text | ReactFlow 边 |

**显示规则**:
- 边的语义颜色：ending 边 = 橙色(#f59e0b)，普通边 = 灰色(#9ca3af)，悬停路径 = 紫色(#8b5cf6)
- 节点宽 200px × 高 90px，overflow hidden
- 边标签超过 14 字符截断 + "…"

### 2.3 状态转换

#### UI 状态机

```
                    ┌── error ──────────────────────────────────┐
                    │  API 500 / 网络异常 → 显示 error 文本       │
                    │  refetch → 返回 loading                     │
                    ▼                                             │
idle ──→ loading ──→ rendered (graph 非 null)                    │
  ▲         │           │                                        │
  │         │           ├── editing=false (只读模式)               │
  │         │           │     → drag 可移动节点 / hover 高亮 /     │
  │         │           │       无法 connect/delete               │
  │         │           └── editing=true (编辑模式)                │
  │         │                → 可 connect / delete / addNode       │
  │         │                → 显示"加节点"按钮                    │
  └─────────┴──── refetch() after delta POST                     │
```

**守卫条件**:
- `graph === null` (未加载): 返回 null，不渲染
- `editing` 切换: `nodesConnectable`, `elementsSelectable`, `deleteKeyCode` 联动
- `onNodeDragStop`: 无需编辑模式即可拖拽（`nodesDraggable` 恒为 true）
- `onConnect` / `onEdgesDelete` / `onNodesDelete`: 仅在 `editing=true` 时生效

#### 编辑操作生命周期

```
Delta 操作:
  用户操作 → POST /projects/:id/story-graph/delta
  → 成功 → refetch() → 新 graph 数据 → layoutStoryGraph() → setRfNodes/setRfEdges
  → 失败 → setEditError(errorMessage) → 显示红色错误文本
```

#### 悬停路径计算

```
onNodeMouseEnter(nodeId)
  → dfsForwardPath(nodeId, graph) → { nodeIds, edgeIds }
  → displayNodes: 路径上=opacity 1 + purple glow, 路径外=opacity 0.2
  → displayEdges: 路径上=purple + animated + strokeWidth 2.5, 路径外=opacity 0.2
onNodeMouseLeave
  → hoveredPath = null → 所有节点/边恢复默认样式
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| Flow 图 → 项目 | 一对一 | 删除项目 → 图数据级联删除 |
| 节点 → 边 | 一对多 | 删除节点 → 通过 removeNodeDelta 自动清理关联边 |
| 边 → 节点 | 多对一连接 | source/target 必须存在；自连接 (source===target) 被 onConnect 拦截 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 加载 | GET → 200 → layoutStoryGraph → 渲染节点/边 + fitView | API 500 → 显示 error 文本 | graph=null → 返回 null（不渲染，需增强空状态） | 图过大(>100节点) → dagre 布局性能下降 |
| 添加节点 | POST delta → refetch → 节点计数+1 | POST 失败 → setEditError 显示错误 | N/A | 编辑模式下新增节点默认位置 (80,80) |
| 拖拽节点 | onDragStop → POST moveNodeDelta → refetch | POST 失败 → editError 显示错误 | N/A | 刷新后位置持久化验证（E2E 测试） |
| 连接节点 | onConnect → POST addChoiceDelta → refetch | 自连接阻止（source===target 静默忽略） | N/A | 跨类型连接无限制 |
| 删除节点 | onNodesDelete → POST removeNodeDelta → refetch | POST 失败 → editError | N/A | 按 Delete/Backspace（仅编辑模式） |
| 删除边 | onEdgesDelete → POST removeChoicesDelta → refetch | POST 失败 → editError | N/A | 按 Delete/Backspace（仅编辑模式） |
| 悬停路径 | 鼠标进入节点 → DFS 计算 → 高亮 | 无节点图 → 无操作 | 无节点图 | 路径包含 ending 节点时，ending 边保持橙色 |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `FlowView` | `/#/flow/:projectId` | `flow-` | 主流程图页面，含 ReactFlow 画布 + 工具栏 + 统计栏 |

### 4.2 交互流程

```
进入流程图 → GET /projects/:id/story-graph → layoutStoryGraph() → 渲染节点+边
┌─ Header ──────────────────────────────────────────┐
│ [返回书籍] {title}              [编辑/完成编辑] [加节点] │
│ {editError 红色文本}                               │
└─────────────────────────────────���──────────────────┘
┌─ StatsBar ─────────────────────────────────────────┐
│ 总节点 N | 分支 B | 结局 E | 死路 D | 图例: 默认/结局/悬停路径 │
└────────────────────────────────────────────────────┘
┌─ ReactFlow Canvas ─────────────────────────────────┐
│ 节点: StoryFlowNode (200×90, type color border)    │
│       - Handle (target Left, source Right)         │
│       - label + nodeType                           │
│ 边: label = choice text (截断14字符)                │
│     ending edge → orange stroke                    │
│     hover path → purple animated stroke            │
│ 控件: Background + Controls + MiniMap (type color)  │
└────────────────────────────────────────────────────┘
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 流程图容器 | `flow-view` | 确认页面已渲染 |
| 返回按钮 | `flow-back` | 导航回书籍 |
| 标题 | `flow-title` | 显示项目标题 |
| 编辑开关 | `flow-edit-toggle` | 切换编辑/只读模式 |
| 添加节点 | `flow-add-node` | 新增节点（仅编辑模式可见） |
| 编辑错误 | `flow-edit-error` | 显示 delta 操作错误 |
| 统计栏 | `flow-stats` | 显示节点/分支/结局/死路统计 |
| 节点 | `flow-node-{id}` | ReactFlow 自定义节点 |
| 统计栏 | `flow-stats` | E2E 定位结构健康信息 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 2s 图加载（≤50 节点）；p99 < 5s | Playwright waitForSelector + polling |
| 拖拽持久化 | 拖拽位置在 reload 后保留 | flow-editor E2E #2 验证 |
| 截图质量 | 9 节点无重叠，MiniMap + 统计可见 | flow-screenshot E2E 截图检查 |
| 浏览器兼容 | Chrome / Firefox / Edge 最新两个大版本 | CI matrix |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 实时协作编辑 | 单用户桌面应用 |
| 撤销/重做 | 操作通过 delta POST 不可逆（需后端支持历史） |
| 节点搜索/过滤 | 图数据量小（互动电影通常 <50 节点） |
| 导出流程图为图片 | 非核心需求，截图工具可替代 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 已创建含 3 个节点的故事图 | 导航到 `/#/flow/:id` | 容器 `flow-view` 可见，3 个节点 `flow-node-s/g/x` 可见 | ⬜ | flow #1 |
| 2 | 已创建含 start+ending 节点的图 | 进入编辑模式，点击"加节点" | 节点计数 +1（polling 等待） | ⬜ | flow-editor #1 |
| 3 | 已创建含节点 "s" 的图 | 拖拽节点 s 到新位置，等待 800ms，reload | 节点 s 的 position 在 API 中存在（非 undefined） | ⬜ | flow-editor #2 |
| 4 | 9 节点图已布局完成 | 截图检查 | 节点无重叠，Minimap + 统计栏可见 | ⬜ | flow-screenshot #1 |

完成度: 0/4 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | 空图状态（graph=null）是否需要显示空状态占位而非返回 null？ | @frontend-lead | 否 |
| 2 | 编辑模式是否需要独立的 Undo/Redo 支持？ | @frontend-lead | 否（非 v1 需求） |
| 3 | 节点超过 100 时 dagre 布局性能优化策略？ | @frontend-lead | 否（当前 max ~50） |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 骨架（自动生成） | — |
| 2026-07-23 | v2.0 完整补全：基于 FlowView + story-graph + E2E specs | spec-writer-4 |
