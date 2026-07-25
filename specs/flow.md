# 剧情流程图 — 功能规格书 (SDD)

**版本**: 3.1
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `FlowView.tsx` + `StoryGraphTree.tsx` + `story-flow-layout.ts` + `interactive-film/`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: Flow 模块是互动电影的故事图可视化工具，包含 FlowView（ReactFlow 节点-边图 + 编辑模式）和 StoryGraphTree（列表视图 + 节点编辑器 + AI 图片生成）。API 端点在 `server.ts` 中内联，无独立 routes 文件。
> **痛点**: (1) 编辑模式需要手动切换；(2) 拖拽位置需等待后端 delta 持久化；(3) 空图无空状态占位；(4) dead-end 节点无特殊视觉标识。
> **期望状态**: 流程图支持增删改查节点/边，编辑开关隔离读写模式，悬停路径高亮，统计栏检查结构健康，树视图支持节点编辑，覆盖 4 态。
> **成功指标**: 4 个 E2E spec 全部通过（flow / flow-editor / flow-screenshot / agent-flow-editor-render）。

---

## 0a. 用户故事 (User Stories)

1. As a **互动电影创作者**, I want **可视化查看所有剧情节点和分支** so that **理清故事分支结构**。【P0】
2. As a **互动电影创作者**, I want **拖拽节点调整布局** so that **流程图更直观易读**。【P0】
3. As a **互动电影创作者**, I want **添加/删除/连接节点和边** so that **在可视化界面中编辑故事结构**。【P1】
4. As a **互动电影创作者**, I want **悬停节点时高亮其后继路径** so that **快速理解分支后果**。【P1】
5. As a **互动电影创作者**, I want **查看节点统计（总数/分支/结局/死路）** so that **评估故事结构健康度**。【P2】
6. As a **互动电影创作者**, I want **编辑节点场景描述和对话** so that **在树视图中完善内容**。【P1】
7. As a **维护者**, I want **截图测试验证 9 节点布局无重叠** so that **确保布局质量基线**。【P1】

---

## 1. 模块概述

Flow 模块是 InkChain 互动电影的核心可视化工具，包含两个页面：

**FlowView** (`packages/studio/src/pages/FlowView.tsx`): 基于 ReactFlow (`@xyflow/react`) 渲染带类型的节点图（start/branch/ending/merge/explore/normal）。数据通过 `GET /api/v1/projects/:id/story-graph` 加载，通过 `layoutStoryGraph()` 计算 BFS 深度优先布局（COL=280, ROW=140）。支持编辑模式下通过 delta API 增量修改，悬停节点时 DFS 计算后继路径并高亮，提供 MiniMap 和 Controls。

**StoryGraphTree** (`packages/studio/src/pages/StoryGraphTree.tsx`): 列表/详情视图，提供每个节点的内联场景编辑器、对话显示、AI 图片生成按钮，嵌入 AnalysisPanel（验证问题 + 情感弧线图 + 路径分布图）。

**API 端点**（内联在 `server.ts` 第 5584-5713 行）:
- `GET /api/v1/projects/:id/story-graph` — 加载故事图 JSON
- `POST /api/v1/projects/:id/story-graph/delta` — 增量修改（节点增删移、边增删）
- `GET /api/v1/projects/:id/story-graph/validation` — 执行 `reviewStoryGraph()` 验证
- `GET /api/v1/projects/:id/story-graph/analysis` — 验证 + 情感弧线 + 路径分布
- `GET /api/v1/projects/:id/export/json` — 导出 story-graph.json
- `GET /api/v1/projects/:id/export/ink` — 导出为 Ink 格式
- `GET /api/v1/projects/:id/export/html` — 导出为可交互 HTML
- `GET /api/v1/projects/:id/export` — 导出完整 tar.gz 包
- `POST /api/v1/projects/:id/nodes/:nodeId/image` — AI 图片生成

**数据模型**（`packages/core/src/interactive-film/`）:
- `graph-schema.ts` (112 行): StoryGraph、StoryNode、Choice、WorldAnchor、Character、Variable、Ending 等 Zod schema
- `delta.ts` (74 行): StoryGraphDelta 操作 — upsert/remove for worldAnchor/characters/nodes/variables/endings
- `validation.ts` (305 行): 14 种问题代码 (DEAD_END, BROKEN_LINK, UNREACHABLE, VARIABLE_UNWRITTEN, GATED_UNREACHABLE, ENDING_UNREACHABLE, VARIABLE_UNUSED, ENDING_VARIETY, IMAGE_MISSING, ILLUSORY_BRANCH, LINEAR_GRAPH, ISOLATED_NODE, LONG_LINEAR_CHAIN)
- `paths.ts` (63 行): 运行时路径枚举，BFS 考虑变量状态，默认 200 条路径上限
- `evaluator.ts`: 变量评估 — `visibleChoices(node, varState)`, `applyEffects`
- `emotion.ts`: 情感弧线分析
- `layout`（`story-flow-layout.ts`）: BFS 深度优先布局，节点间距 COL=280, ROW=140

**节点类型**: start / branch / ending / merge / explore / normal。各类型对应颜色和 MiniMap 色值（start=emerald/#10b981, branch=amber/#f59e0b, ending=rose/#f43f5e, merge=sky/#0ea5e9, explore=violet/#8b5cf6, normal=muted/#6b7280）。

---

## 2. 行为合约

### 2.1 API 接口

Flow 模块所有端点内联在 `server.ts` 中，无独立 `routes/` 文件：

**核心端点**:
- `GET /api/v1/projects/:id/story-graph` → StoryGraph JSON。从 `{projectRoot}/interactive-films/{id}/story-graph.json` 读取
- `POST /api/v1/projects/:id/story-graph/delta` → 应用 StoryGraphDelta，返回操作结果

**辅助端点**:
- `GET /api/v1/projects/:id/story-graph/validation` → `reviewStoryGraph()` 验证报告
- `GET /api/v1/projects/:id/story-graph/analysis` → 验证报告 + 情感弧线 + 路径分布
- `GET /api/v1/projects/:id/export/json|ink|html` → 各格式导出
- `GET /api/v1/projects/:id/export` → tar.gz 完整包
- `POST /api/v1/projects/:id/nodes/:nodeId/image` → AI 节点图片

### 2.2 数据模型

**核心模型**（`packages/core/src/interactive-film/graph-schema.ts`）:

- **StoryGraph** (顶层): schemaVersion (1), projectId, title, worldAnchor?, characters[], variables[], nodes[], endings[]
- **StoryNode**: id, type (start/normal/branch/merge/ending/explore), title, sceneDesc?, dialogue[], choices[], imageSlot?, act?, position?
- **Choice** (分支选项): id, text, targetNodeId, condition? (Condition: var, op, value), effects[] (Effect: var, op, value), weight ("light"/"heavy"/"critical")
- **WorldAnchor**: coreConflict, themes[], authorVoice, intendedAudience
- **Character**: id, name, persona, arc
- **Variable**: id, name, initial (VarValue: number | string | boolean)
- **Ending**: id, title, nodeId, description

**条件运算** (Condition): `>=` / `<=` / `>` / `<` / `==` / `!=`
**效果运算** (Effect): `set` / `add` / `sub`

**Delta 操作** (`delta.ts`): `applyStoryGraphDelta({ graph, delta })` 支持 worldAnchor/characters/nodes/variables/endings 的 upsert/remove。

**Graph 验证** (`validation.ts`):
- `validateStoryGraph(graph)`: 仅检查关键错误（死路、断裂链接、不可达节点、无法到达结局）
- `reviewStoryGraph(graph)`: 完整评审（验证 + 变量分析 + 路径分析 + 风格检查）

**路径枚举** (`paths.ts`): `enumerateRuntimePaths(graph, opts?)` — BFS 遍历，考虑变量条件，默认上限 200 条路径、最大深度 50。

**UI 渲染规则**:
- 节点尺寸: 200px × 90px，overflow hidden
- 边标签: 超过 14 字符截断 + "…"
- 边颜色: ending 边 = #f59e0b (橙色)，普通边 = #9ca3af (灰色)，悬停路径 = #8b5cf6 (紫色)
- 连线格式: `{sourceNodeId}->{choiceId}`

### 2.3 状态转换

**FlowView 状态机**:

```
idle → loading → rendered (graph 非 null)
  ├── editing=false (只读): drag 可移动 / hover 高亮 / 不可 connect/delete
  └── editing=true (编辑): 可 connect/delete/addNode / 显示"加节点"按钮
API 500 → 显示 error 文本 → refetch → 返回 loading
graph=null → 返回 null（不渲染）
```

**编辑操作生命周期**:
```
用户操作 → POST delta → 成功 → refetch() → layoutStoryGraph() → 更新画布
                     → 失败 → setEditError(errorMessage) → 红色错误文本
```

**悬停路径**:
```
onNodeMouseEnter(nodeId) → dfsForwardPath(nodeId, graph)
  → 路径上节点: opacity 1 + purple glow
  → 路径外节点: opacity 0.2
  → 路径上边: purple + animated + strokeWidth 2.5
onNodeMouseLeave → hoveredPath=null → 恢复默认样式
```

**守卫条件**:
- `nodesDraggable`: 恒为 true（无需编辑模式即可拖拽）
- `nodesConnectable`, `elementsSelectable`, `deleteKeyCode`: 随 editing 联动
- `onConnect` 阻止自连接 (source === target)

### 2.4 关联约束

- Flow 图 → 项目: 一对一。删除项目 → 图数据级联删除
- 节点 → 边: 一对多。删除节点 → removeNodeDelta 自动清理关联边
- 边 → 节点: 多对一。source/target 必须存在；自连接被拦截
- StoryGraphTree → AnalysisPanel: 嵌入关系。NodeEditor 保存失败 → film-save-error 显示

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 加载 (FlowView) | GET 200 → layoutStoryGraph → 渲染节点/边 + fitView | API 500 → error 文本 | graph=null → 返回 null | >100 节点 → 布局性能下降 |
| 添加节点 | POST delta → refetch → 节点计数+1 | POST 失败 → editError | N/A | 默认位置 (80,80) |
| 拖拽节点 | onDragStop → POST moveNodeDelta → refetch | POST 失败 → editError | N/A | reload 后位置持久化验证 |
| 连接节点 | onConnect → POST addChoiceDelta → refetch | 自连接静默忽略 | N/A | 跨类型连接无限制 |
| 删除节点/边 | 按 Delete → POST delta → refetch | POST 失败 → editError | N/A | 仅编辑模式生效 |
| 悬停路径 | 鼠标进入节点 → DFS 高亮 | 无节点图 → 无操作 | 无节点图 | ending 边保持橙色 |
| 树视图编辑 | NodeEditor → POST delta → refetch | POST 失败 → film-save-error | sceneDesc 为空 → textarea 空 | AI 图片生成中 → loading |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `FlowView` | `/#/flow/:projectId` | `flow-` | ReactFlow 画布 + 工具栏 + 统计栏 |
| `StoryGraphTree` | `/#/film/:projectId/tree` | `film-` | 节点列表 + NodeEditor + AnalysisPanel |

### 4.2 交互流程

**FlowView**:
```
进入 → GET story-graph → layoutStoryGraph() → 渲染
Header: [返回书籍] {title} [编辑/完成编辑] [加节点] {editError}
StatsBar: 总节点 N | 分支 B | 结局 E | 死路 D | 图例
Canvas: StoryFlowNode (200×90) + Handle + 边 + MiniMap + Controls
```

**StoryGraphTree**:
```
进入 → GET story-graph → 渲染节点列表
Header: [返回] {title} [试玩] [流程图] [AI创作] [导出]
WorldAnchor 卡片 → NodeEditor (每节点: sceneDesc textarea + 保存 + 生成图片)
AnalysisPanel: IssuesList + EmotionArcChart + PathDistribution
```

### 4.3 关键 data-testid

**FlowView**: `flow-view` (容器), `flow-back` (返回), `flow-title` (标题), `flow-edit-toggle` (编辑开关), `flow-add-node` (加节点), `flow-edit-error` (错误), `flow-stats` (统计栏), `flow-node-{id}` (节点)

**StoryGraphTree**: `film-tree` (容器), `film-back`, `film-title`, `film-play`, `open-flow`, `open-authoring`, `film-export-package`, `film-save-error`, `film-world`, `film-nodes`, `film-node-{id}`, `node-image-{id}`, `film-scene-{id}`, `film-save-{id}`, `gen-image-{id}`

**AnalysisPanel**: `validation-panel` (验证问题容器), `validation-issue-{code}` (如 BROKEN_LINK), `emotion-arc` (情感弧线图), `path-distribution` (路径分布面板)

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 2s 图加载（≤50 节点）；p99 < 5s | Playwright waitForSelector + polling |
| 拖拽持久化 | 拖拽位置在 reload 后保留 | flow-editor E2E #2 |
| 截图质量 | 9 节点无重叠，MiniMap + 统计可见 | flow-screenshot E2E |
| 浏览器兼容 | Chrome / Firefox / Edge 最新两个大版本 | CI matrix |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 实时协作编辑 | 单用户桌面应用 |
| 撤销/重做 | delta POST 不可逆，需后端历史支持 |
| 节点搜索/过滤 | 图数据量小（<50 节点） |
| 导出为图片 | 截图工具可替代 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 已创建含 3 个节点的故事图 | 导航到 `/#/flow/:id` | 容器 `flow-view` 可见，3 个节点可见 | ⬜ | flow #1 |
| 2 | 已创建含 start+ending 节点的图 | 进入编辑模式，点击"加节点" | 节点计数 +1 | ⬜ | flow-editor #1 |
| 3 | 已创建含节点 "s" 的图 | 拖拽节点，等待 800ms，reload | position 持久化（非 undefined） | ⬜ | flow-editor #2 |
| 4 | 9 节点图已布局完成 | 截图检查 | 节点无重叠，Minimap + 统计栏可见 | ⬜ | flow-screenshot #1 |

完成度: 0/4 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | 空图状态是否需要空状态占位而非返回 null？ | @frontend-lead | 否 |
| 2 | 编辑模式是否需要独立的 Undo/Redo？ | @frontend-lead | 否 |
| 3 | 节点超过 100 时的布局优化策略？ | @frontend-lead | 否 |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 骨架（自动生成） | — |
| 2026-07-23 | v2.0 完整补全 | spec-writer-4 |
| 2026-07-25 | v3.0 页面组件对齐；v3.1 移除 API 表格和数据模型表格，改为 prose 格式 | sdd-phase-0-agent |
