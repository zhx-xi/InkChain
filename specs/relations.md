# 关系图谱 — 功能规格书 (SDD)

**版本**: 1.3
**创建日期**: 2026-07-23
**状态**: approved（Specky 重审 46→50+，4 条修复完成）
**代码源**: `api/routes/relations.ts` + `models/relations.ts` + `RelationGraphPanel.tsx`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: 关系图谱使用 dagre 布局 + ReactFlow 可视化渲染，支持手动 CRUD 和 AI 自动提取关系、卷筛选、简化视图切换、导出 PNG/SVG。
> **痛点**: (1) 点击角色节点后跳转空白页而非编辑面板；(2) AI 提取不区分主角/配角/一次性角色；(3) 重置按钮无效；(4) 关系边无法单独删除。
> **期望状态**: 点击节点弹出 DetailPanel；AI 提取正确标注角色层级；重置恢复初始状态；每条关系边可独立删除。
> **成功指标**: 6 个 E2E spec 全部通过（relation-character-edit / relation-delete-edge / relation-reset / relation-ai-extract / relation-graph / relation-graph-core）。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **看到所有角色间的关系连线** so that **能理清角色网络**。【P0】
2. As a **写作者**, I want **点击角色节点弹出编辑面板** so that **能修改角色标签和属性**。【P0】
3. As a **写作者**, I want **AI 自动从文本提取角色关系** so that **省去手动逐一录入的时间**。【P1】
4. As a **写作者**, I want **删除不需要的关系边** so that **图谱保持准确**。【P1】
5. As a **写作者**, I want **按卷筛选只展示当前剧情节点的关系** so that **聚焦当前写作进度**。【P2】
6. As a **维护者**, I want **relations.json 损坏时显示明确错误而非白屏** so that **能快速定位数据问题**。【P1】

---

## 1. 模块概述

关系图谱是 InkChain 中管理**角色间关系**的可视化工具。底层用 ReactFlow + dagre 布局渲染节点-边图，数据持久化到 `story/state/relations.json`。支持手动 CRUD、AI 自动提取、卷筛选、简化视图，以及 PNG/SVG 导出。

---

## 2. 行为合约

### 2.1 API 接口

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/:id/relations?character=<roleId>` | query `character` (可选) | `{ relations: CharacterRelation[] }` | 列出所有关系，可选按角色过滤 |
| POST | `/:id/relations` | `CreateRelation` body | `{ relation }` (201) | 创建关系（id/createdAt/updatedAt 自动生成）|
| PUT | `/:id/relations/:relationId` | `UpdateRelation` body (partial) | `{ relation }` | 更新指定关系；id 不可变 |
| DELETE | `/:id/relations/:relationId` | — | `{ deleted: true }` | 删除指定关系 |

**请求/响应示例**:
```json
// POST /:id/relations → Request Body
{ "sourceRoleId": "550e8400-e29b-41d4-a716-446655440000",
  "targetRoleId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "relationType": "mentor", "validFromChapter": 3,
  "intensity": 4, "customLabel": "师父", "description": "主角拜师学艺" }
// → 201 Created
{ "relation": { "id": "uuid-auto-generated", ...上面所有字段,
    "createdAt": "2026-07-23T12:00:00Z", "updatedAt": "2026-07-23T12:00:00Z" } }

// Error → 400 Bad Request
{ "error": { "code": "VALIDATION_ERROR", "message": "校验失败",
    "details": { "fieldErrors": { "intensity": ["必须为 1-5 的整数"] } } } }

// Error → 404 Not Found (DELETE non-existent)
{ "error": { "code": "NOT_FOUND", "message": "关系 non-existent-id 不存在" } }
```

### 2.2 数据模型

| Schema | 类型 | 必填字段 | 可选字段 | 默认值 / 校验 |
|--------|------|----------|---------|--------------|
| `CharacterRelationSchema` | object | id (uuid v4), sourceRoleId, targetRoleId, relationType, validFromChapter, intensity (1-5), createdAt, updatedAt | customLabel, description, validUntilChapter | intensity 默认 3；customLabel max 50 字符；description max 500 字符；id=crypto.randomUUID() |
| `CreateRelationSchema` | object | sourceRoleId, targetRoleId, relationType, validFromChapter, intensity | customLabel, description, validUntilChapter | 同上（id/createdAt/updatedAt 由服务端生成） |
| `UpdateRelationSchema` | partial | — | 任意字段 (id 不可变) | partial update：仅传入字段被更新 |
| `RelationsFileSchema` | file | schemaVersion: "1", relations[] | — | 空文件 → 返回 `{ schemaVersion:"1", relations:[] }` |
| `RelationType` | enum | close_friend / rival / alliance / mentor / blood / secret_crush | — | 中文映射见 `RELATION_LABELS` |

显示标签优先级: `customLabel > RELATION_LABELS[relationType] > relationType raw`。

### 2.3 状态转换

#### UI 状态机（每个操作独立）

```
                    ┌── error ──────────────────────────────────────┐
                    │  API 500 / 网络超时 → AlertBanner              │
                    │  retry → 返回 idle                             │
                    ▼                                                 │
idle ──→ loading ──→ rendered                                       │
  ▲         │           │                                            │
  │         │           ├── empty (relations.length === 0)            │
  │         │           │     → rg-empty-state 可见                   │
  │         │           └── data (relations.length > 0)              │
  │         │                → dagre 布局 + ReactFlow 渲染            │
  └─────────┴──── refreshGraph() / 卷切换 / 重置                     │
```

**守卫条件**:
- `rendered` → `DetailPanel 可见`: 仅当 `selectedNodeId !== null` 且 `node.tier !== undefined`
- `rendered` → `删除边`: 仅当 `selectedEdgeId !== null` 且 `deleteConfirmEdge === edge.id`
- `error` → `rendered`: 仅当重试 API 返回 200

#### 数据状态机（关系生命周期）

```
                   POST /relations (201)
新建 ──────────────────────────────────────→ 已创建
                                               │
                          PUT /relations/:id   │
已创建 ──────────────────────────────────────→ 已修改
                                               │
                    DELETE /relations/:id       │
已创建 / 已修改 ──────────────────────────────→ 已删除 (不可逆)
                                               │
                          AI 提取              │
已创建 ──────────────────────────────────────→ 提取待审核
                                               │
                    审核通过 / 拒绝             │
提取待审核 ──────────────────────────────────→ 已创建 (通过) / 已创建 (拒绝 = 不保存)

冲突状态: PUT 前读取 → 发现 updatedAt 被他人修改 → 409 Conflict
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| 关系 → 书籍 | 多对一 | 删除书籍 → 整个 relations.json 级联删除 |
| 关系 → 角色 | 多对多 | 删除角色时，以该角色为 source/target 的关系变为孤儿（需清理） |
| 关系 → 章节 | 通过 validFromChapter/validUntilChapter | 修改章节号不自动更新关系 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 创建 | POST → 201 → 图谱插入新关系 | INVALID_JSON → 400 / VALIDATION_ERROR → 400 + details | 空 relations.json → 返回 schemaVersion: "1" | 两个不存在的角色ID → 校验失败 400 |
| 读取 | GET → 200 → 渲染 dagre 布局 | API 500 → AlertBanner 显示错误 | 空关系列表 → 只显示角色节点无连线 | 大量关系(>100) → dagre 布局性能 |
| 更新 | PUT → 200 → 边标签刷新 | NOT_FOUND → 404 / VALIDATION_ERROR → 400 | N/A | 并发编辑同一关系 → 后写覆盖 |
| 删除 | DELETE → 200 → 边从图谱消失，节点保留 | NOT_FOUND → 404 | N/A | 删除确认弹窗 + deleteLoading 状态 |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `RelationGraphPanel` | `/#/book/:id/relations` | `rg-` | 主页面，含 ReactFlow 画布 + 工具栏 |
| `DetailPanel` | (内嵌) | — | 点击节点后右侧弹出，显示角色详情 |
| `RelationExtractionReviewPanel` | (内嵌) | — | AI 提取结果预览，支持逐条确认/拒绝 |
| `LegendPanel` | (内嵌) | — | 关系类型图例 |
| `MemoCharacterNode` | ReactFlow 节点 | — | 自定义节点，显示角色名/层级/出场章节 |
| `MemoRelationEdge` | ReactFlow 边 | — | 自定义边，显示关系标签，hover 可删除 |

### 4.2 交互流程

```
进入图谱 → 自动加载 relations.json → dagre 计算布局 → 渲染节点+边 → fitView
┌─ 工具栏 ─────────────────────────────────────┐
│ [返回] [AI提取] [导出▼] [简化视图] [重置] [卷筛选▼] │
└──────────────────────────────────────────────┘
点击节点 → DetailPanel (右侧面板) → 可编辑角色标签
点击边   → 高亮 + 显示删除按钮 → 确认 → DELETE API
点击AI提取 → RelationExtractionReviewPanel → 预览 → 应用 → 图谱刷新
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| AI 提取按钮 | `rg-btn-ai-extract` | E2E 定位提取入口 |
| 重置按钮 | `rg-btn-reset` | 重置操作 |
| 导出按钮 | `rg-btn-export` | 导出入口 |
| 返回按钮 | `rg-btn-back` | 返回书籍 |
| 简化视图开关 | `rg-toggle-simplified` | 简化/完整视图切换 |
| 图谱画布 | `rg-canvas` | ReactFlow 渲染区域 |
| 关系删除按钮 | `rg-btn-delete-edge` | 可删除边的删除入口 |
| 确认删除按钮 | `rg-btn-confirm-delete` | 确认删除弹窗按钮 |
| 加载指示器 | `rg-loading` | 数据加载中 |
| 错误信息 | `rg-msg-error` | API 异常提示 |
| 空状态 | `rg-empty-state` | 无角色/无关系 |
| 卷筛选 | `rg-select-volume` | 卷筛选下拉 |
| 角色节点 | `rg-node-character` | ReactFlow 角色节点 |
| 关系边 | `rg-edge-relation` | ReactFlow 关系连线 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 2s 图谱加载 (100 节点内)；p95 < 30s AI 提取；p99 < 5s 图谱加载 | Playwright E2E `page.waitForSelector("rg-canvas")` timeout |
| 并发 | 同一书籍多 tab 各自独立 graph-store（zustand per-tab） | 手动验证 |
| 回滚 | 写操作原子性：`saveRelations` 使用 `writeFile` 覆盖 → 失败时 store 不更新 | 单元测试 mock fs 写入失败 |
| 降级 | AI 提取失败 → AlertBanner 显示错误；LLM stub 模式不调用真实 LLM | `INKOS_AGENT_LLM_STUB=1` 环境变量 |
| 浏览器兼容 | Chrome / Firefox / Edge 最新两个大版本 | CI matrix |
| 无障碍 | WCAG 2.1 AA — 所有交互元素可通过键盘访问 | axe-core 扫描 |
| 内存 | 100 节点 + 200 边 → 内存 < 50MB（不含 Chrome 基线） | Chrome DevTools Memory 面板 |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 双向连线自动对称 | 关系方向由 sourceRoleId→targetRoleId 决定，不自动生成反向边 |
| 实时协作编辑 | 单用户桌面应用，无 WebSocket sync |
| 社交网络分析（中心度/聚类） | 非网文写作工具核心需求 |
| 历史版本 diff | 关系数据量小，Git 已覆盖版本管理 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 图谱已加载含 3 个角色节点 | 点击角色节点"主角-张三" | DetailPanel 在右侧弹出，显示角色标签编辑框；URL 不变；`rg-detail-panel` 可见 | ⬜ | relation-character-edit |
| 2 | 图谱已加载，AI 提取按钮可见 | 点击 AI 提取 + 等待结果 | 提取结果列表区分主角(protagonist)/配角(supporting)/一次性(one_shot) | ⬜ | relation-ai-extract |
| 3 | 图谱已被修改（添加/删除/移动节点） | 点击重置按钮 + 确认弹窗 | 图谱恢复到初始 dagre 布局；`graph-store` 状态为 clean | ⬜ | relation-reset |
| 4 | 图谱含至少 1 条关系边 | hover 边 + 点击删除按钮 + 确认弹窗 | 关系边从图谱消失；节点保留；DELETE API 返回 200 | ⬜ | relation-delete-edge |
| 5 | 图谱已加载，无已有关系 | 点击创建按钮 → 填写 source/target/type → 提交 | POST 201 → 新边出现在图谱 | ⬜ | relation-graph-core |
| 6 | 图谱含 10+ 角色分布在 3 个卷 | 选择卷筛选 → 选择"卷二" | 仅显示卷二章节内出场的角色及其关系；其他节点隐藏 | ⬜ | relation-graph |
| 7 | 简化视图 toggle 未激活 | 点击简化视图开关 | 过滤掉 guest/one_shot/scene tier 的节点；边随之更新 | ⬜ | relation-graph-core |
| 8 | 图谱已渲染 | 点击导出 → PNG（或 SVG） | 下载文件包含完整图谱截图 | ⬜ | relation-graph |
| 9 | 图谱已加载 | 发送 DELETE /relations/nonexistent-id | API 返回 404 + `rg-msg-error` 显示"关系不存在" | ⬜ | relation-delete-edge |
| 10 | 书籍无角色数据 | 打开关系图谱页面 | `rg-empty-state` 可见，显示"暂无角色和关系" | ⬜ | relation-ai-extract |

完成度: 0/10 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | AI 提取使用哪个 LLM 模型？降级策略是什么？ | @backend-lead | 否（LLM stub 可模拟） |
| 2 | 删除角色时是否需要自动清理关联的关系边？ | @backend-lead | 是（当前未实现级联清理） |
| 3 | 导出功能是否还需要 SVG？当前代码只看到 PNG 路径 | @frontend-lead | 否 |
| 4 | dagre 布局 >100 节点时降级策略（虚拟化/分页）？ | @frontend-lead | 否（当前最大测试数据集 50 节点） |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 骨架（create-spec.py 自动生成） | — |
| 2026-07-23 | v1.1 完整补全：基于代码 + 6 E2E spec | — |
| 2026-07-23 | v1.2 Specky 审计修复：状态机 / GWT 验收 / 百分位 NFR | — |
