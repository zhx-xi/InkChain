# 世界观管理 — 功能规格书 (SDD)

**版本**: 1.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `api/routes/worlds.ts` + `models/world-config.ts` + `WorldMapPage.tsx`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: 世界观模块提供 7 维度(settings/roles/relations/regions/institutions/history/rules)的配置管理和 CRUD API，支持实体引用、搜索、继承、书籍关联，以及可视化世界地图。
> **痛点**: (1) 创建世界观时 7 维度表单过于庞大，用户不知从何下手；(2) 世界观继承(inherit)缺少模板推荐；(3) 地图节点坐标需手动设置 x/y；(4) 跨实体引用(references)的管理不够直观。
> **期望状态**: 分步向导引导创建；继承时可选择模板基类；地图支持拖拽定位节点；引用面板可视化展示连线。
> **成功指标**: 8 个 E2E spec 全部通过（world-map-core / world-map / world-list-core / world-create-validation / world-association / world-extract-book-error / world-extract-llm / world-inheritance-page）。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **创建并管理世界观配置的 7 个维度** so that **构建完整的虚构世界基础**。【P0】
2. As a **写作者**, I want **在世界地图上可视化区域和角色位置** so that **直观理解世界地理布局**。【P0】
3. As a **写作者**, I want **将世界观与书籍关联** so that **同一世界观可服务多本书籍**。【P1】
4. As a **写作者**, I want **从已有世界观继承创建新世界观** so that **省去重复配置**。【P2】
5. As a **写作者**, I want **在世界观内搜索实体** so that **快速定位特定角色/区域/势力**。【P2】
6. As a **维护者**, I want **删除实体前检测跨实体引用** so that **防止悬空引用**。【P1】

---

## 1. 模块概述

世界观是 InkChain 中管理**虚构世界设定**的核心模块。每个世界观包含 7 个维度：settings(世界观设定-物理/魔法/科技/社会/文化)、roles(角色-主角/配角/反派/中立)、relations(角色关系)、regions(地理区域-大陆/国家/城市/地点)、institutions(组织势力-宗门/国家/组织/家族)、history(历史事件)、rules(世界规则-物理/魔法/社会/叙事)。数据存储为 `.inkos/worlds/<id>.json`。支持 CRUD、全文搜索、跨实体引用、继承、书籍关联，以及可视化世界地图。

---

## 2. 行为合约

### 2.1 API 接口

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/api/worlds` | — | `{ worlds: WorldConfig[] }` | 列出所有世界观 |
| GET | `/api/worlds/:id` | — | `{ world: WorldConfig }` | 获取单个世界观（含 7 维度） |
| POST | `/api/worlds` | `WorldConfigSchema` body | `{ world: WorldConfig }` (201) | 创建世界观 |
| PUT | `/api/worlds/:id` | `WorldConfigUpdateSchema` body | `{ world: WorldConfig }` | 更新世界观（partial update） |
| DELETE | `/api/worlds/:id` | — | `{ ok: true, id }` | 删除世界观 |
| GET | `/api/worlds/:id/search?q=&dimension=` | query q, dimension(可选) | `{ results: WorldSearchResult[] }` | 在单个世界观内搜索 |
| POST | `/api/worlds/:id/references` | `WorldReferenceCreateSchema` body | `{ world: WorldConfig }` (201) | 添加跨维度引用 |
| DELETE | `/api/worlds/:id/references/:refId` | — | `{ world: WorldConfig }` | 删除引用 |
| POST | `/api/worlds/:id/inherit` | `{ newId?, newTitle? }` | `{ world, message }` | 继承创建新世界观 |
| GET | `/api/books/:bookId/worlds` | — | `{ worlds: WorldConfig[] }` | 列出书籍关联的世界观 |
| POST | `/api/books/:bookId/worlds-associate` | `{ worldId }` | `{ ok: true, worldIds }` | 关联世界观到书籍 |

**请求/响应示例**:
```json
// POST /api/worlds → Request Body
{ "id": "my-world", "name": "中土大陆", "description": "经典奇幻设定",
  "createdAt": "2026-07-23T12:00:00Z", "updatedAt": "2026-07-23T12:00:00Z",
  "settings": [...], "roles": [...], "regions": [...], ... }
// → 201 Created
{ "world": { ...同上 } }

// Error → 409 Conflict
{ "error": { "code": "WORLD_ALREADY_EXISTS", ... } }

// POST /api/worlds/my-world/inherit → Request
{ "newId": "my-world-2", "newTitle": "中土大陆 (同人)" }
// → 200
{ "world": { ...继承的世界观 }, "message": "已从「中土大陆」继承创建新世界观" }
```

### 2.2 数据模型

| Schema | 类型 | 必填字段 | 可选字段 | 默认值 / 校验 |
|--------|------|----------|---------|--------------|
| `WorldConfigSchema` | object | id, name, description, createdAt, updatedAt | settings[], roles[], relations[], regions[], institutions[], history[], rules[], references[], bookIds[] | 所有数组默认[]; id 为字母数字/下划线 |
| `WorldSettingEntrySchema` | object | id, name, type(物理规则/魔法体系/科技水平/社会结构/文化习俗) | description, constraints[], sortIndex | sortIndex 默认 0; description 默认 "" |
| `WorldRoleSchema` | object | id, name, role(主角/配角/反派/中立) | description, significance(1-5), sortIndex, institutionIds[], regionIds[], currentRegionId | significance 默认 3; sortIndex 默认 0 |
| `WorldRegionSchema` | object | id, name, parentId, type(大陆/国家/城市/地点) | description, sortIndex, x(0-100), y(0-100), coordinates, regionType | parentId 默认 null; x/y 默认 null |
| `WorldInstitutionSchema` | object | id, name, type(宗门/国家/组织/家族) | leaderId, members[], description, sortIndex, regionId | leaderId 默认 null; members 默认 [] |
| `WorldHistoryEventSchema` | object | id, title, timestamp | description, affectedRegions[], significance(1-5), sortIndex | significance 默认 3; sortIndex 默认 0 |
| `WorldRuleSchema` | object | id, name, type(物理/魔法/社会/叙事) | description, constraints[], sortIndex | sortIndex 默认 0; description 默认 "" |
| `WorldReferenceSchema` | object | id, sourceDimension, sourceId, targetDimension, targetId | label | label 默认 "" |
| `WorldReferenceCreateSchema` | object | sourceDimension, sourceId, targetDimension, targetId | label | label 默认 "" |

### 2.3 状态转换

#### UI 状态机

```
                    ┌── error ──────────────────────────────────┐
                    │  API 500 / 网络超时 → 错误提示+重试         │
                    ▼                                             │
idle ──→ loading ──→ rendered                                   │
  ▲         │           │                                        │
  │         │           ├── empty (无世界观)                     │
  │         │           │     → 空状态 "暂无世界观"              │
  │         │           └── data (有世界观)                      │
  │         │                → 列表视图 / 地图视图               │
  └─────────┴──── refetch / 刷新                                │
```

#### 数据状态机（世界观生命周期）

```
                   POST /worlds (201)
新建 ───────────────────────────────────────→ 已创建
                                               │
                  PUT /worlds/:id (200)        │
已创建 ───────────────────────────────────────→ 已修改(updatedAt 刷新)
                                               │
                  DELETE /worlds/:id           │
已创建 / 已修改 ───────────────────────────────→ 已删除 (不可逆)
                                               │
            POST /worlds/:id/inherit (200)     │
已创建 ───────────────────────────────────────→ 新世界观（继承副本）

引用状态: addWorldReference → 更新 references[]
           removeWorldReference → 删除指定引用
           deleteEntityWithRefCheck → 删除前检查引用
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| 世界观 → 书籍 | 一对多（通过 book.worldIds） | 删除世界观 → 书籍 worldIds 需清理 |
| 区域 → 父区域 | 树形（通过 parentId） | 删除父区域 → 子区域 parentId 变为 null |
| 势力 → 区域 | 通过 institution.regionId | 删除区域 → 势力 regionId 变为 null |
| 角色 → 势力/区域 | 通过 institutionIds/regionIds | 标记引用但不级联 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 创建 | POST → 201 → 列表插入新世界观 | VALIDATION_ERROR → 400+details / WORLD_ALREADY_EXISTS → 409 | 首个世界观创建 → 列表从空变有 | INVALID_WORLD_ID → 400 |
| 读取 | GET → 200 → 列表/地图渲染 | API 500 → error 状态 | 空列表 → "暂无世界观" | 7 维度数据量极大 → 懒加载/分页 |
| 更新 | PUT → 200 → applyWorldUpdate 合并更新 | VALIDATION_ERROR → 400 / WORLD_NOT_FOUND → 404 | N/A | 并发编辑同一世界观 → 后写覆盖 |
| 删除 | DELETE → 200 → 原子删除 JSON 文件 | WORLD_NOT_FOUND → 404 | N/A | 删除前检测引用: deleteEntityWithRefCheck |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `WorldMapPage` | `/#/worlds/:worldId/map` | `wm-` | 世界地图页面，含 ReactFlow 地图 + 面包屑 + 工具栏 |
| `WorldListPage` | `/#/worlds` | — | 世界观列表页面 |
| `WorldCreatePage` | `/#/worlds/new` | — | 创建世界观表单 |
| `WorldDetailPanel` | 内嵌 | `wm-detail-panel` | 地图节点详情面板 |
| `WorldInheritancePage` | `/#/worlds/:id/inherit` | — | 世界观继承页面 |

### 4.2 交互流程

```
世界地图:
  进入 /#/worlds/:id/map → 加载世界观数据 → 渲染区域节点+连线
  ┌─ 工具栏 ──────────────────────────────────┐
  │ [面包屑导航] [缩放+/-] [导出] [全屏]        │
  └───────────────────────────────────────────┘
  点击区域节点 → DetailPanel 右侧展示区域详情
  滚动缩放置 → zoom 控制更新

世界观列表:
  进入 /#/worlds → 加载所有世界观 → 卡片列表
  [创建世界观] → 填写 7 维度配置 → POST → 列表刷新
  [继承] → 选择基世界观 → 生成副本 → 列表刷新
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 地图画布 | `wm-canvas-map` | 世界地图渲染区域 |
| 详情面板 | `wm-detail-panel` | 节点详情 |
| 面包屑导航 | `wm-breadcrumb` | 层级面包屑 |
| 工具栏 | `wm-toolbar` | 工具栏 |
| 缩放按钮 | `wm-zoom-in` / `wm-zoom-out` | 缩放控制 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 1s 世界列表加载(100世界观内)；p95 < 2s 世界地图渲染(50区域) | Playwright E2E timeout |
| 数据完整性 | 7 维度 JSON 完整校验；ID 格式校验(/^[a-z0-9_-]+$/i) | Zod schema validation |
| 搜索性能 | p95 < 500ms 单世界观内全文搜索 | E2E response timing |
| 继承性能 | p95 < 2s 完整世界观继承（含所有维度深拷贝） | E2E creation timing |
| 浏览器兼容 | Chrome / Firefox / Edge 最新两个大版本 | CI matrix |
| 无障碍 | WCAG 2.1 AA — 地图节点可键盘导航 | axe-core 扫描 |
| 存储 | 单个世界观 JSON < 5MB (1000实体内) | 文件大小监控 |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 多世界观合并/对比 | 单用户使用，合并非高频需求 |
| 区域气候/生态/经济模拟 | 超出写作者工具范畴 |
| 世界地图导出为高清位图 | 当前 SVG/ReactFlow 自带截图能力 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 进入世界地图页面 | 等待加载完成 | 地图画布渲染，`wm-canvas-map` 可见；面包屑导航显示层级 | ⬜ | world-map-core |
| 2 | 世界地图含多个区域节点 | 点击区域节点 | DetailPanel 弹出显示区域详情 | ⬜ | world-map |
| 3 | 世界观列表页面 | 查看世界观列表 | 所有已创建的世界观显示在列表中 | ⬜ | world-list-core |
| 4 | 创建表单 | 提交缺少必填字段的表单 | VALIDATION_ERROR 返回具体字段错误 | ⬜ | world-create-validation |
| 5 | 书籍已设置 worldId | 查看书籍关联的世界观 | 书籍→世界观关联正确显示 | ⬜ | world-association |
| 6 | 从书籍提取世界观 | 提取 API 返回错误 | 前端显示明确错误信息而非静默失败 | ⬜ | world-extract-book-error |
| 7 | 使用 LLM 提取世界观 | 等待提取结果 | 7 维度数据正确填充 | ⬜ | world-extract-llm |
| 8 | 世界观继承页面 | 选择基世界观+输入新ID | 生成副本，所有 7 维度保留 | ⬜ | world-inheritance-page |

完成度: 0/8 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | 世界地图的 regions 坐标(x/y)是否需要自动布局算法？目前依赖手动设置 | @frontend-lead | 否（手动坐标可用 auto-layout 兜底） |
| 2 | 世界观提取(world-extract)是否应从整本书还是分章节提取？ | @backend-lead | 否（当前支持 book-level extract） |
| 3 | 删除世界观时是否需要级联清除所有关联书籍的 worldIds？ | @backend-lead | 是（当前未实现自动清理） |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 初始版本，基于 API/Model/E2E 代码 | spec-writer-1 |
