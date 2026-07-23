# 伏笔管理 — 功能规格书 (SDD)

**版本**: 1.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `api/routes/foreshadowing.ts` + `api/routes/foreshadowing-relations.ts` + `models/foreshadowing.ts` + `ForeshadowingPage.tsx`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: 伏笔管理系统支持伏笔的 CRUD 操作、状态追踪（active/paid_off/abandoned）、遗忘检测、三种视图（列表/卡片/关系图）、AI 提取候选伏笔、跨章节关系分析和批量操作。
> **痛点**: (1) AI 提取伏笔依赖 LLM 模型，降级策略不明确；(2) 遗忘检测阈值固定为 10 章，不可配置；(3) 跨章节关系分析仅支持前端算法，缺少 LLM 深度分析；(4) 批量删除无二次确认。
> **期望状态**: 完整的伏笔生命周期管理——从创建到回收的全程追踪，智能遗忘提醒，跨章节关联分析，批量管理能力。
> **成功指标**: foreshadowing-page-core / foreshadowing-delete-item / foreshadowing-batch-delete / foreshadowing-flow / foreshadowing-graph-view / foreshadowing-data-integrity / foreshadowing-dynamic-chapters / foreshadow-payoff / foresight-table / foresight-pagination 共 10 个 E2E spec 全部通过。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **创建一个伏笔记录** so that **能追踪后续回收**。【P0】
2. As a **写作者**, I want **标记伏笔已回收** so that **知道哪些线头已经接上**。【P0】
3. As a **写作者**, I want **AI 自动从文本中提取潜在伏笔** so that **不遗漏重要线索**。【P1】
4. As a **写作者**, I want **看到被遗忘的伏笔提醒** so that **避免剧情漏洞**。【P1】
5. As a **写作者**, I want **查看跨章节伏笔关系** so that **理解伏笔网络**。【P2】
6. As a **写作者**, I want **批量删除/管理伏笔** so that **提高效率**。【P2】
7. As a **写作者**, I want **通过图表可视化伏笔分布** so that **直观了解伏笔在章节中的位置**。【P2】

---

## 1. 模块概述

伏笔管理是 InkChain 中追踪**长篇小说伏笔设定**的核心工具。支持手写录入和 AI 自动提取两种创建方式，伏笔按类型（情节/角色/物品/设定）分类，按状态（活跃/已回收/已废弃）追踪。提供遗忘检测算法（超过 N 章未提及的活跃伏笔标记为遗忘）、三种视图模式（列表/卡片/关系图）和跨章节关系自动分析。

---

## 2. 行为合约

### 2.1 API 接口

所有路由挂载于 `/api/foreshadowing`:

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/` | query `?bookId=&status=&type=&currentChapter=&forgetThreshold=` | `{ foreshadowing: [...], total, currentChapter }` | 列出伏笔（含 `_forgotten` 标记） |
| GET | `/forgotten` | query `?bookId=&currentChapter=&threshold=` | `{ forgotten: ForgetCheck[] }` | 列出遗忘的活跃伏笔 |
| GET | `/:id` | — | `{ foreshadowing }` | 获取单个伏笔详情 |
| POST | `/` | ForeshadowingCreate body | `{ foreshadowing }` (201) | 创建伏笔（id 由客户端生成） |
| PUT | `/:id` | ForeshadowingUpdate body (partial) | `{ foreshadowing }` | 更新伏笔（id 不可变） |
| DELETE | `/:id` | — | `{ ok: true, id }` | 删除指定伏笔 |
| DELETE | `/batch` | `{ ids: string[] }` | `{ ok: true, deletedCount, ids }` | 批量删除（先于 `/:id` 匹配） |
| POST | `/:id/payoff` | `{ payoffChapter?: number }` | `{ foreshadowing }` | 标记伏笔已回收 |

**跨章节关系 API** (挂载于 `/api/v1/books`):

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| POST | `/:id/foreshadowing/relations` | `{ candidates: ForeshadowingExtractCandidate[] }` | `{ relations: ForeshadowingRelation[] }` | 分析候选伏笔之间的跨章节关系 |

**请求/响应示例**:

```json
// POST /api/foreshadowing → Request Body
{ "id": "fs-001", "bookId": "my-book", "title": "主角的伤疤秘密",
  "type": "角色伏笔", "createdChapter": 3, "expectedPayoffChapter": 15 }
// → 201 Created
{ "foreshadowing": { "id": "fs-001", ...所有字段,
    "status": "active", "lastMentionedChapter": 3, "relatedElements": [],
    "notes": "", "payoffChapter": null } }

// GET /api/foreshadowing?bookId=my-book&currentChapter=20
// → 200 OK
{ "foreshadowing": [{ ...fields, "_forgotten": true }], "total": 5, "currentChapter": 20 }

// POST /api/foreshadowing/:id/payoff
// Request Body
{ "payoffChapter": 18 }
// → 200 OK
{ "foreshadowing": { ...status: "paid_off", payoffChapter: 18 } }

// Error → 400 Bad Request
{ "error": { "code": "VALIDATION_ERROR", "message": "Foreshadowing validation failed",
    "details": { "fieldErrors": { "title": ["伏笔标题不能为空"] } } } }

// Error → 404 Not Found
// → throw ApiError(404, "FORESHADOWING_NOT_FOUND", ...)

// Error → 409 Conflict (重复创建)
// → throw ApiError(409, "FORESHADOWING_ALREADY_EXISTS", ...)
```

### 2.2 数据模型

| Schema | 类型 | 必填字段 | 可选字段 | 默认值 / 校验 |
|--------|------|----------|---------|--------------|
| `ForeshadowingSchema` | object | id (string min 1), bookId (string min 1), title (string min 1) | description (default ""), type (default "情节伏笔"), createdChapter (default 0, int >=0), expectedPayoffChapter (nullable, default null), status (default "active"), payoffChapter (nullable, default null), lastMentionedChapter (default 0), relatedElements (default []), notes (default "") | type 枚举: 情节伏笔/角色伏笔/物品伏笔/设定伏笔；status 枚举: active/paid_off/abandoned |
| `ForeshadowingCreateSchema` | object | id, title | 同 ForeshadowingSchema 其余字段 | 最小创建只需 id + title |
| `ForeshadowingUpdateSchema` | object | — | 任意字段 (id 不可变) | 显式 optional，不使用 .partial() 避免默认值覆盖 |
| `ForeshadowingTypeEnum` | enum | 情节伏笔 / 角色伏笔 / 物品伏笔 / 设定伏笔 | — | — |
| `ForeshadowingStatusEnum` | enum | active / paid_off / abandoned | — | — |

**持久化**: 存储在 `<projectRoot>/.inkos/foreshadowing/<id>.json`，通过 IndexManager 管理索引。

**遗忘检测**: `checkForeshadowingForget(entry, currentChapter, threshold=10)` — 当活跃伏笔超过 threshold 章未提及，标记为 `isForgotten`。

### 2.3 状态转换

```
                    POST /foreshadowing (201)
新建 ───────────────────────────────────────────→ active (活跃)
                                                    │
                       POST /:id/payoff              │
active ────────────────────────────────────────────→ paid_off (已回收)
                                                    │
                         PUT /:id (status=abandoned) │
active ────────────────────────────────────────────→ abandoned (已废弃)
                                                    │
                         PUT /:id (status=active)    │
abandoned ─────────────────────────────────────────→ active
                                                    │
                    DELETE /:id / DELETE /batch      │
任意状态 ───────────────────────────────────────────→ 已删除 (不可逆)

遗忘状态: active + (currentChapter - lastMentionedChapter >= threshold)
         → _forgotten: true (标记但不改变 status)
```

#### UI 状态机（ForeshadowingPage）

```
idle ──→ loading ──→ rendered
  ▲         │           │
  │         │           ├── empty (total === 0)
  │         │           │     → fs-state-empty 可见
  │         │           └── data (total > 0)
  │         │                → 当前视图渲染 (列表/卡片/关系图)
  │         │
  └─────────┴──── refresh / 切换书籍 / 切换视图
                    │
                    ├── error ───────────────────────────────────────┐
                    │  API 失败 → fs-state-error 显示错误             │
                    │  retry / refresh → 返回 idle                   │
                    ▼                                                │
                 error                                              │
```

**视图切换**:
- `列表视图` (默认): 表格式展示，列包含标题、类型、状态、章节、操作
- `卡片视图`: 卡片式布局，每个伏笔一张卡片
- `关系图视图`: SVG 可视化，节点按章节分布，连线表示跨章节关系

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| 伏笔 → 书籍 | 多对一 | 删除书籍 → 该书籍的伏笔文件孤立（需手动清理） |
| 伏笔 → 角色/地点/物品 | 多对多 (via relatedElements) | 删除实体 → relatedElements 引用变为无效 |
| 伏笔关系 | source/target 候选伏笔间 | 关系不持久化，每次重新分析 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 创建 | POST → 201 → 列表刷新 | INVALID_JSON → 400 / VALIDATION_ERROR → 400 + details | 首次创建 → 类型默认"情节伏笔" | 重复 ID 创建 → 409 |
| 读取列表 | GET → 200 → 渲染当前视图 | API 500 → fs-state-error | 无伏笔 → fs-state-empty | 大量伏笔(>100) → 正常渲染/分页 |
| 读取详情 | GET → 200 → 返回完整对象 | NOT_FOUND → 404 | N/A | N/A |
| 更新 | PUT → 200 → 数据刷新 | NOT_FOUND → 404 / VALIDATION_ERROR → 400 | N/A | partial update 不影响其他字段 |
| 标记回收 | POST /payoff → 200 → status 变为 paid_off | NOT_FOUND → 404 | N/A | payoffChapter 默认 lastMentionedChapter |
| 删除 | DELETE → 200 → 从列表消失 | 忽略磁盘错误 | N/A | 删除不存在的 ID → 静默成功 |
| 批量删除 | DELETE /batch → 200 → deletedCount 返回 | INVALID_JSON → 400 / ids 为空 → 400 | N/A | 部分 ID 不存在 → 跳过 |
| 遗忘检测 | GET → 200 → forgotten 列表 | currentChapter=0 → 正常返回 | 无活跃伏笔 → 空数组 | 阈值设置为 0 → 全部标记遗忘 |
| 关系分析 | POST → 200 → 返回 relation 数组 | INVALID_JSON → 400 / INVALID_CANDIDATES → 400 | candidates=[] → 空 relations | 所有候选同章节 → 返回空 relations |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `ForeshadowingPage` | `/#/foreshadowing/:bookId` | `fs-` | 主页面，支持 3 种视图模式 |

### 4.2 交互流程

```
进入伏笔页 → 自动加载伏笔列表 → 默认列表视图
├─ 顶部工具栏:
│   ├─ [搜索] 关键词过滤
│   ├─ [创建] 打开创建表单 → 填写 → POST → 列表刷新
│   ├─ [AI提取] 打开提取模态框 → 选择章节范围 → 等待结果
│   ├─ [刷新] 重新加载列表
│   ├─ [视图切换] 列表/卡片/关系图
│   └─ [类型筛选] 情节/角色/物品/设定
├─ 批量操作:
│   ├─ 勾选 checkbox → 批量工具栏出现
│   └─ [批量删除] → 确认弹窗 → DELETE /batch
└─ 单个操作:
    ├─ 点击伏笔行 → 展开详情 / 编辑表单
    ├─ [标记回收] → POST /payoff
    ├─ [编辑] → PUT → refetch
    └─ [删除] → DELETE

关系图视图:
  节点按创建章节 X 轴分布 → 同类型用颜色区分 →
  跨章节相似伏笔显示连线 → hover 节点/边显示详情
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 创建按钮 | `fs-create-btn` | E2E 定位创建入口 |
| AI 提取按钮 | `fs-extract-btn` | AI 提取入口 |
| 刷新按钮 | `fs-btn-refresh` | 重新加载 |
| 搜索输入框 | `fs-search-input` | 搜索过滤 |
| 列表容器 | `fs-table-foreshadowing-list` | 表格视图容器 |
| 视图切换按钮 | `fs-btn-view-graph` / `fs-btn-view-table` / `fs-btn-view-card` | 切换视图模式 |
| 批量工具栏 | `fs-batch-toolbar` | 批量操作栏 |
| 批量删除按钮 | `fs-batch-delete` | 批量删除入口 |
| 全选 checkbox | `fs-select-all` | 全选/取消全选 |
| 伏笔项 | `fs-item-{id}` | 单个伏笔行 |
| 伏笔 checkbox | `fs-checkbox-{id}` | 单个伏笔勾选 |
| 关系图 SVG | `fs-graph-svg` | 关系图可视化 |
| 加载状态 | `fs-state-loading` | 加载指示器 |
| 空状态 | `fs-state-empty` | 无数据空状态 |
| 异常状态 | `fs-state-error` | API 异常提示 |
| 删除确认弹窗 | `fs-modal-confirm-delete` | 删除确认 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 1s 伏笔列表加载（<50 条）；p95 < 30s AI 提取 | Playwright E2E timeout |
| 并发 | 多 tab 操作独立（IndexManager per-tab 缓存） | 手动验证 |
| 回滚 | 删除为不可逆操作；更新为 partial update 不过度覆盖 | — |
| 降级 | AI 提取失败 → fs-state-error 显示错误 | `INKOS_AGENT_LLM_STUB=1` |
| 数据完整性 | 伏笔 JSON 文件损坏 → IndexManager 跳过损坏项，不阻塞列出 | 单元测试 |
| 遗忘检测 | threshold 可配置（默认 10），O(n) 时间复杂度 | — |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 伏笔自动生成（AI 无需确认直接创建） | 作者需审核，AI 仅提取候选 |
| 伏笔优先级排序 | 当前 MVP 范围外 |
| 伏笔与具体段落关联 | 伏笔粒度为章节级，段落级追踪复杂度高 |
| 回收率统计仪表盘 | 功能需求未确认 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 伏笔列表无数据 | 导航到伏笔页面 | `fs-state-empty` 可见，显示"暂无伏笔" | ⬜ | foreshadowing-page-core |
| 2 | 伏笔列表有 5 条记录 | 导航到伏笔页面 | 表格显示 5 行数据，含标题/类型/状态/章节 | ⬜ | foreshadowing-page-core |
| 3 | 页面已加载 | 点击创建按钮 → 填写标题"新伏笔" → 提交 | POST 201 → 列表出现新记录 | ⬜ | foreshadowing-flow |
| 4 | 某条活跃伏笔存在 | 点击标记回收 → 选择章节 18 | status 变为 paid_off, payoffChapter=18 | ⬜ | foreshadow-payoff |
| 5 | 活跃伏笔 lastMentionedChapter=3 | 查询 currentChapter=20, threshold=10 | _forgotten: true | ⬜ | foreshadowing-data-integrity |
| 6 | 选中 2 条伏笔 | 点击批量删除 → 确认 | DELETE /batch → 2 条伏笔消失 | ⬜ | foreshadowing-batch-delete |
| 7 | 某条伏笔存在 | 点击删除按钮 → 确认 | DELETE → 该伏笔从列表消失 | ⬜ | foreshadowing-delete-item |
| 8 | 页面列表视图 | 点击关系图视图按钮 | SVG 图表渲染，节点按章节分布 | ⬜ | foreshadowing-graph-view |
| 9 | AI 提取按钮可见 | 点击 AI 提取 | 提取模态框打开，可选择章节范围 | ⬜ | foreshadowing-flow |
| 10 | 候选伏笔列表有 3 条 | 分析跨章节关系 | 返回 same_topic/payoff_setup 关系 | ⬜ | foreshadowing-page-core |
| 11 | 搜索框输入关键词 | 输入"主角" | 列表过滤为匹配项 | ⬜ | foresight-table |
| 12 | 无章节数据的书籍 | 伏笔 createdChapter=0 | 正常显示，不受影响 | ⬜ | foreshadowing-dynamic-chapters |

完成度: 0/12 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | AI 伏笔提取使用哪个 LLM 后端？是否需要上下文压缩？ | @backend-lead | 否 |
| 2 | 遗忘检测阈值(10)是否需要用户可配置？ | @product | 否 |
| 3 | 关系图视图是否需要交互式编辑（拖拽节点/手动连线）？ | @frontend-lead | 否 |
| 4 | 批量操作是否需要支持批量回收/批量更新类型？ | @product | 否 |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 初始版本：基于代码分析和 E2E 测试 | spec-writer-2 |
