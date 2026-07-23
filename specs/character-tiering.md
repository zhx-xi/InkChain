# Character Tiering / 角色分层管理 — 功能规格书 (SDD)

**版本**: 2.0
**创建日期**: 2026-07-23
**状态**: approved
**代码源**: `api/routes/scene-roles.ts` + `models/scene-role.ts` + `CharacterTiering.tsx`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: Character Tiering 提供 5 级角色分层视图（主角/重要/次要/客串/一次性），支持按层级 Tab 过滤、按出场频次排序。Scene Roles API 管理场景级角色（绑定特定章节），以 YAML frontmatter markdown 文件存储。
> **痛点**: (1) 角色层级由 AI 提取标注，可能出现误分类；(2) Scene Role 与全局 Character 无关联映射；(3) 分层页无批量操作能力；(4) 层级 Tab 数据需手动刷新。
> **期望状态**: A I 标层结果可手动修正；Scene Role 可升格为全局 Character；分层页支持批量移动层级；数据变更自动刷新 Tab 计数。
> **成功指标**: E2E character-tiering spec 全部通过（Normal/Error/Empty/Edge 4 态）。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **看到所有角色按出场层级分类** so that **清楚知道主角/配角比例是否合理**。【P0】
2. As a **写作者**, I want **按层级 Tab 过滤角色列表** so that **聚焦某个层级的所有角色**。【P1】
3. As a **写作者**, I want **创建场景级角色** so that **记录只在特定章节出现的临时角色**。【P1】
4. As a **维护者**, I want **场景角色关联特定章节** so that **按章节筛选时只显示相关角色**。【P2】
5. As a **写作者**, I want **从角色分层页跳转到关系图/时间线** so that **快速查看该角色的关系网络**。【P2】

---

## 1. 模块概述

Character Tiering 是 InkChain 中管理角色出场层级（protagonist / supporting / guest / one_shot / scene）的工具。5 个层级按出场重要度递减排列，前端使用 5 色 Badge 样式区分。Scene Roles API 提供独立的场景角色 CRUD，存储为 `story/roles/scene/<name>.md`，与全局 Character 表解耦。

---

## 2. 行为合约

### 2.1 API 接口

#### Scene Roles API (`/books/:id/scene-roles`)

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/:id/scene-roles?chapter=N` | query `chapter` (可选) | `{ sceneRoles: SceneRole[] }` | 列出所有场景角色，可选按章节过滤 |
| POST | `/:id/scene-roles` | `CreateSceneRole` body | `{ sceneRole }` (201) | 创建场景角色；name 唯一（409 冲突） |
| PUT | `/:id/scene-roles/:name` | `UpdateSceneRole` body (partial) | `{ sceneRole }` | 更新指定角色（merge existing + partial） |
| DELETE | `/:id/scene-roles/:name` | — | `{ ok: true }` | 删除指定角色 |

**请求/响应示例**:
```json
// POST /:id/scene-roles → Request Body
{ "name": "店小二", "description": "第三章客栈中的跑堂", "relatedChapters": [3, 5] }
// → 201 Created
{ "sceneRole": { "name": "店小二", "description": "第三章客栈中的跑堂",
    "relatedChapters": [3, 5], "createdAt": "2026-07-23T12:00:00Z", "updatedAt": "2026-07-23T12:00:00Z" } }

// POST /:id/scene-roles → 重复 name
// → 409 Conflict
{ "error": "场景角色\"店小二\"已存在" }

// PUT /:id/scene-roles/店小二 → Request Body
{ "description": "第三章客栈跑堂 + 第五章市集再次出现" }
// → 200 OK
{ "sceneRole": { "name": "店小二", "description": "...", "relatedChapters": [3, 5],
    "createdAt": "2026-07-23T12:00:00Z", "updatedAt": "2026-07-23T12:01:00Z" } }

// PUT /:id/scene-roles/nonexistent
// → 404 Not Found
{ "error": "场景角色\"nonexistent\"不存在" }

// DELETE /:id/scene-roles/店小二
// → 200 OK
{ "ok": true }
```

#### Character List API (`/books/:id/characters`)

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/books/:id/characters` | — | `{ characters: {name: string, tier: string}[] }` | 列出角色名与层级标签 |

### 2.2 数据模型

| Schema | 类型 | 必填字段 | 可选字段 | 默认值 / 校验 |
|--------|------|----------|---------|--------------|
| `SceneRoleSchema` | object | name (string, min 1), createdAt, updatedAt (datetime) | description (默认 ""), relatedChapters (number[] 默认 []) | name 作为文件名 `roles/scene/<name>.md` |
| `CreateSceneRoleSchema` | object | name, description?, relatedChapters? | — | 同 SceneRole 但省略 createdAt/updatedAt（服务端生成） |
| `UpdateSceneRoleSchema` | partial | — | name?, description?, relatedChapters? | 全字段可选 |
| `SceneRolesFileSchema` | file | schemaVersion: "1", sceneRoles[] | — | 空目录 → 返回 [] |

**Character Tier (层级枚举)**:

| Tier | 中文标签 | 说明 | Badge 颜色 | 符号 | 排序 |
|------|---------|------|-----------|------|------|
| `protagonist` | 主角 | 全程推动核心叙事 | 琥珀色 (amber) | ★ | 1 |
| `supporting` | 重要 | 关键段落/支线驱动 | 蓝色 (blue) | ★ | 2 |
| `guest` | 次要 | 阶段性辅助/转变 | 靛蓝 (indigo) | ● | 3 |
| `one_shot` | 客串 | 场景NPC/群像 | 灰色 (gray) | ● | 4 |
| `scene` | 一次性 | 1-2句出场 · 可归档 | 锌灰 (zinc) | · | 5 |

**存储路径**: `story/roles/scene/<name>.md`
```yaml
---
description: 第三章客栈中的跑堂
relatedChapters: [3, 5]
createdAt: 2026-07-23T12:00:00.000Z
updatedAt: 2026-07-23T12:01:00.000Z
---
# 店小二

第三章客栈中的跑堂
```

### 2.3 状态转换

#### 角色分层页加载状态机

```
                    ┌── error ──────────────────────────────┐
                    │  API 500 / 网络超时 → 空列表           │
                    ▼                                        │
idle ──→ loading ──→ loaded                                 │
  ▲         │           │                                    │
  │         │           ├── 有角色 → Tier Tab 渲染           │
  │         │           │   + Tier 图例                      │
  │         │           └── 无角色 → 各 Tab 计数为 0          │
  │         │               → 当前 Tab 显示 "该层级暂无角色"  │
  └─────────┴──── bookId 变化 → 重新加载                     │
```

**守卫条件**:
- `loading` → `loaded`: 仅当 `cancelled === false` 且 API 返回
- `loaded` 数据格式: tier 字符串通过 `TIER_DIR_MAP` 映射到 `CharacterTier` 枚举，无法映射的角色被过滤
- 角色排序: 按 `TIER_SORT_ORDER` 升序，同级按 `name.localeCompare("zh")`

#### 场景角色生命周期

```
                    POST /scene-roles (201)
新建 ──────────────────────────────────────→ 已创建 (name.md 落盘)
                                               │
                    PUT /scene-roles/:name      │
已创建 ──────────────────────────────────────→ 已修改 (updatedAt 刷新)
                                               │
                    DELETE /scene-roles/:name   │
已创建 / 已修改 ──────────────────────────────→ 已删除 (unlink .md 文件)
                                               │
重复 name → 409 Conflict                       │
```

**冲突检测**: `loadSceneRole(name)` 非 null → 409 "场景角色已存在"

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| Scene Role → 书籍 | 多对一 (文件路径含 bookDir) | 删除书籍 → `story/roles/scene/` 目录级联删除 |
| Scene Role → 章节 | `relatedChapters: number[]` | 删除章节 → relatedChapters 不自动更新 |
| Scene Role ↔ 全局 Character | 弱关联（通过 name） | 无联动；两者存储路径不同 |
| Character Tier → Character | 属性 (tier: string) | 修改 tier → 排序结果更新 |
| 角色列表 → CharacterTiering 页 | 数据源 | `fetchJson(/books/:id/characters)` 拉取 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 加载分层视图 | GET /books/:id/characters → 200 → 按 Tier 排序渲染 | API 异常 → 空数组 + bodyText > 0 | 无角色 → "当前筛选: 全部角色" + 各 Tab 计数 0 | 无效 tier 值 → `TIER_DIR_MAP` 找不到 → 过滤掉 |
| 加载空书籍 | 空书无角色 → 显示"全部角色" Tab + count 0 | API 离线 → 空字符集 + 不崩溃 | 该 Tab 无角色 → 显示 "该层级暂无角色" | 无效 bookId → bodyText > 0 + 页面不崩溃 |
| Tab 切换 | 点击 "主角" Tab → 仅显示 protagonist 角色 | N/A | 该 Tab 无角色 → "该层级暂无角色" | 快速连续切换 → 状态不掉步 |
| 跳转关系图 | 点击角色行 Share2 按钮 → `setRoute({page:"relations", bookId})` | N/A | N/A | hashRoute 重定向 |
| 跳转时间线 | 点击角色行 Clock 按钮 → `setRoute({page:"timeline", bookId})` | N/A | N/A | hashRoute 重定向 |
| 场景角色 CRUD | POST/PUT/DELETE → 文件写入/更新/删除 | Zod 校验失败 → 400 + issues; 404 → name 不存在; 500 → 删除文件失败 | 空目录 → `listSceneRoles()` 返回 [] | chapter 过滤 NaN → 忽略 query |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `CharacterTiering` | `/#/characters/:bookId/tiers` | — | 主页面：标题 + Tier Tabs + 角色列表 |
| Tier Tab Bar | (内嵌) | — | 5 级 Tab 切换栏 + "全部" Tab |
| Character Row | (内嵌) | — | 角色行：Badge + name + description + 操作 |
| Tier Legend | (内嵌) | — | 底部分层图例 |

### 4.2 交互流程

```
进入角色分层 → GET /books/:id/characters → 转换 tier 枚举 → 按顺序排序
├── 标题: "角色分层管理" + "N 个角色 · 5 级出场层级"
├── Tier Tab Bar (bg-muted/30 p-1 rounded-lg):
│   ├── 全部 (N) | 主角 (n1) | 重要 (n2) | 次要 (n3) | 客串 (n4) | 一次性 (n5)
│   └── 点击 Tab → setActiveTab → 过滤字符列表
├── Stats Bar:
│   └── 当前筛选: [Tab Label] · 角色数: N
├── 角色列表:
│   每个角色行:
│   ├── Tier Badge (圆形, 颜色 + 符号)
│   ├── name (font-medium)
│   ├── tier label (muted)
│   ├── description (if exists, truncate)
│   └── 操作按钮 (group-hover 显示):
│       ├── Edit (Edit3 icon) → 编辑
│       ├── 关系图 (Share2 icon) → navigate("relations")
│       └── 时间线 (Clock icon) → navigate("timeline")
└── Tier Legend (border-t pt-4):
    └── 5 行图例: 色点 + tier 描述
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 加载 spinner | `border-4 border-primary/20 border-t-primary rounded-full animate-spin` | 加载状态 |
| Tier Tab 按钮 | `.rounded-md.text-sm` 按钮组 | Tab 切换交互 |
| 角色行 | `.group.flex.items-center.gap-3.rounded-lg.border` | 角色列表项 |
| Tier Badge | `.w-6.h-6.rounded-full` | 层级标记 |
| 空 Tab 提示 | `text=该层级暂无角色` | 空数据断言 |
| Tier Legend | `.border-t.border-border` 底部区域 | 图例存在性 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 1s 角色列表加载；p95 < 500ms Tab 切换 | E2E waitForTimeout |
| 并发 | CharacterTiering 使用 local state + useEffect cleanup (cancelled flag) | 切换 bookId → cancelled flag 防竞态 |
| 回滚 | 场景角色写入使用 `writeFile` 覆盖，失败时抛异常不落盘 | 单元测试 mock fs |
| 降级 | API 失败 → setCharacters([]) 空列表，不崩溃 | character-tiering E2E test 2 |
| 浏览器兼容 | Chrome / Firefox / Edge 最新两个大版本 | CI matrix |
| 内存 | 500 个角色 → 内存 < 20MB（前端列表渲染） | Chrome DevTools Memory |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 批量移动层级 | UI 无批量操作，一次修改一个角色 tier |
| Scene Role 自动生成 | 手动创建，无 AI 自动提取 |
| Scene Role 与 Character 关联 | 两者数据源独立，无映射层 |
| 角色层级历史记录 | 层级变更为即时更新，无版本回退 |
| 层级配置自定义 | 5 级硬编码，不支持增减 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 已有书籍含角色数据 | 导航到 `/#/characters/:id/tiers` | 页面渲染 "角色分层管理" 标题；bodyText > 0; 无 JS pageerror | ⬜ | character-tiering |
| 2 | 无效书籍 ID | 导航到 `/#/characters/nonexistent/tiers` | 页面不崩溃；bodyText > 0 | ⬜ | character-tiering |
| 3 | 已有书籍 | 先访问设置页再导航到分层页 | 两层导航后页面正常渲染；无 JS error | ⬜ | character-tiering |
| 4 | 无章节的空书籍 | 导航到空书籍的分层页 | 页面渲染，显示 "全部" Tab 计数 0；bodyText > 0 | ⬜ | character-tiering |
| 5 | 角色列表含 protagonist + supporting | 点击 "主角" Tab | 列表仅显示 protagonist 角色；当前筛选标签为 "主角"；筛选计数正确 | ⬜ | — |
| 6 | 角色列表含 protagonist + supporting | 点击 "全部" Tab | 列表显示所有角色，按 protagonist→supporting→... 排序 | ⬜ | — |
| 7 | 角色列表不为空 | Hover 角色行 | 编辑/关系图/时间线 操作按钮从 opacity-0 变为 opacity-100 | ⬜ | — |
| 8 | 角色行 Hover 中 | 点击 "关系图" 按钮 | 导航到 `relations` page (hashRoute 更新) | ⬜ | — |
| 9 | 角色行 Hover 中 | 点击 "时间线" 按钮 | 导航到 `timeline` page (hashRoute 更新) | ⬜ | — |
| 10 | 无角色数据 | 打开分层页 | "全部" Tab 显示；所有 Tier Tab 计数为 0 | ⬜ | — |

完成度: 0/10 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | 角色 tier 映射 `TIER_DIR_MAP` 的完整键值对是什么？ | @frontend-lead | 否（定义在 `lib/truth-display.ts`） |
| 2 | Scene Role 是否需要支持 Markdown body（当前 frontmatter body 仅含 `# name\n\ndescription`）？ | @backend-lead | 否 |
| 3 | `relatedChapters` 章节号删除后是否需要自动清理？ | @backend-lead | 否 |
| 4 | "新建角色" 按钮当前无实现 → 何时补全？ | @frontend-lead | 是（按钮存在但无 onClick 逻辑） |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 骨架（自动生成） | — |
| 2026-07-23 | v2.0 完整补全：基于源码 + 1 E2E spec | spec-writer-3 |
