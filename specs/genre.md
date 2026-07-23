# Genre / 体裁管理 — 功能规格书 (SDD)

**版本**: 2.0
**创建日期**: 2026-07-23
**状态**: approved
**代码源**: `api/routes/presets.ts` + `models/genre-profile.ts` + `GenreManager.tsx`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: Genre Manager 提供体裁配置列表展示与详情编辑，支持内置体裁 + 项目自定义体裁。Presets API 管理 Persona 预设列表，支持列表/详情/应用/创建/删除完整 CRUD（实际路由为 `/presets`，Genre Manager 使用的是 `/genres` 端点）。
> **痛点**: (1) 体裁详情面板缺少语言筛选一致性；(2) 预设应用缺少回滚机制；(3) 内置体裁不可删除无明确提示；(4) 体裁创建/编辑表单无 Zod 校验前端预览。
> **期望状态**: 语言筛选正确过滤；预设应用后配置可回滚；内置体裁删除按钮隐藏；表单创建时实时校验提示。
> **成功指标**: E2E genre-manager spec 全部通过；Genre Manager 页面正常加载/列表/详情/CRUD。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **选择适合的体裁预设** so that **让 Agent 采用该体裁的写作规则**。【P0】
2. As a **写作者**, I want **创建自定义体裁** so that **定义小众/混合类型的写作策略**。【P1】
3. As a **维护者**, I want **将内置体裁复制到项目** so that **基于内置模板调整而不影响原版**。【P1】
4. As a **写作者**, I want **查看体裁的章节类型/疲劳词/节奏规则** so that **理解该体裁的约束集**。【P2】
5. As a **管理员**, I want **删除项目级体裁** so that **清理不再使用的自定义配置**。【P2】

---

## 1. 模块概述

Genre Manager 管理网文体裁（仙侠/LitRPG/都市等）的配置规则集。每个体裁定义章节类型（修炼/Level Up 等）、疲劳词（高频重复词）、数值体系/战力体系开关、时代考据开关、节奏规则、爽点类型列表、审计维度等。体裁数据以 YAML frontmatter 格式存储在 `genres/` 目录。Presets API 管理 Agent Persona 预设，支持应用到 7 个 Agent。

---

## 2. 行为合约

### 2.1 API 接口

#### Genre API (`/genres`)

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/genres` | — | `{ genres: GenreInfo[] }` | 列出所有体裁（内置+项目） |
| GET | `/genres/:id` | — | `{ profile: GenreProfile, body: string }` | 获取体裁完整配置 |
| POST | `/genres/create` | `GenreFormData` | `{ ok: true }` | 创建自定义体裁 |
| PUT | `/genres/:id` | `{ profile, body }` | 200 OK | 更新体裁（仅项目级可编辑） |
| DELETE | `/genres/:id` | — | 204 No Content | 删除体裁（仅项目级 `source: "project"` 可删除） |
| POST | `/genres/:id/copy` | — | `{ ok: true }` | 复制体裁到项目 `genres/` 目录 |

#### Presets API (`/api/v1/project/presets`)

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/presets` | — | `{ presets }` | 列出所有预设 |
| GET | `/presets/:id` | — | `{ preset }` | 获取预设详情 (PersonaConfig × 7 Agent) |
| POST | `/presets/:id/apply` | — | `{ ok: true, message }` | 应用预设到所有 Agent |
| POST | `/presets` | `{ name, description, personas }` | `{ ok: true, presetId, message }` | 保存当前 Agent 配置为新预设 |
| DELETE | `/presets/:id` | — | `{ ok: true, message }` | 删除项目级预设 |

**请求/响应示例**:
```json
// POST /genres/create → Request
{ "id": "wuxia", "name": "武侠", "language": "zh",
  "chapterTypes": ["修炼", "奇遇", "战斗"], "fatigueWords": ["冷笑", "淡淡道"],
  "numericalSystem": false, "powerScaling": true, "eraResearch": true,
  "pacingRule": "每5章一个小高潮", "body": "# 武侠体裁规则\n..." }
// → 200
{ "ok": true }

// POST /presets → Request
{ "name": "仙侠标准配置", "description": "适用于仙侠小说",
  "personas": { "writer": {...}, "reviewer": {...}, ... } }
// → 200
{ "ok": true, "presetId": "preset-1720000000000", "message": "预设 '仙侠标准配置' 已保存" }

// DELETE /presets/builtin-genre (内置预设)
// → 404 Not Found
{ "error": { "code": "NOT_FOUND", "message": "预设 'builtin-genre' 不存在或不是项目级别预设" } }

// POST /presets → 缺少 name
// → 400
{ "error": { "code": "VALIDATION_ERROR", "message": "预设名称不能为空" } }
```

### 2.2 数据模型

| Schema | 类型 | 必填字段 | 可选字段 | 默认值 / 校验 |
|--------|------|----------|---------|--------------|
| `GenreProfileSchema` | object | name, id | language ("zh"\|"en"), chapterTypes[], fatigueWords[], numericalSystem, powerScaling, eraResearch, pacingRule, satisfactionTypes[], auditDimensions[] | language="zh", numericalSystem=false, powerScaling=false, eraResearch=false, pacingRule="", satisfactionTypes=[], auditDimensions=[] |
| `GenreInfo` (前端) | interface | id, name, source: "project"\|"builtin", language | — | source 决定可编辑/可删除 |
| `GenreDetail` (前端) | interface | profile (GenreProfile), body (string) | — | body 为 YAML frontmatter 后的 Markdown 正文 |
| `GenreFormData` (前端) | interface | id, name, language, chapterTypes: string, fatigueWords: string, numericalSystem, powerScaling, eraResearch, pacingRule, body | — | chapterTypes/fatigueWords 前端逗号分隔字符串，提交时 `parseCommaSeparated()` 转数组 |

体裁以 YAML frontmatter 文件存储，结构:
```yaml
---
name: 仙侠
id: xianxia
language: zh
chapterTypes: [修炼, 奇遇, 战斗]
fatigueWords: [冷笑, 淡淡道]
numericalSystem: false
powerScaling: true
eraResearch: true
pacingRule: 每5章一个小高潮
satisfactionTypes: [突破, 碾压, 觉醒]
auditDimensions: [1, 3, 5, 7]
---
# 仙侠体裁规则正文 (body)
...具体规则描述...
```

### 2.3 状态转换

#### 体裁详情面板状态机

```
                    ┌── 无效 ID ─────────────────────────┐
                    │  详情面板显示空状态提示              │
                    ▼                                     │
idle ──→ loading ──→ detail-loaded                       │
  ▲         │            │                                 │
  │         │            ├── 详情展示: name/id/lang/tags    │
  │         │            │   chapterTypes chips            │
  │         │            │   fatigueWords chips (max 15)   │
  │         │            │   pacingRule / body pre         │
  │         │            └── 操作按钮: edit/copy/delete     │
  │         │                 source="builtin" → 隐藏delete│
  └─────────┴──── setSelected(null) / 切换体裁             │
```

#### 体裁 CRUD 状态

```
                    POST /genres/create
新建 ─────────────────────────────────────→ 已创建 → setFormMode("hidden")
                                               │
                    PUT /genres/:id            │
已创建 ──────────────────────────────────────→ 已修改 → setFormMode("hidden")
                                               │
                    DELETE /genres/:id          │
已创建 ──────────────────────────────────────→ 已删除 → setSelected(null)
                                               │     (仅 source="project")
                    POST /genres/:id/copy       │
内置 ──────────────────────────────────────→ 项目副本 (source="project")
```

#### Preset 状态

```
                    POST /presets/:id/apply
已保存 ────────────────────────────────────→ 已应用 (7 Agent 配置更新)
                                               │
                    POST /presets              │
当前配置 ────────────────────────────────────→ 新预设 (presetId 返回)
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| 体裁 → 语言 | 属性 | 前端按 `g.language === lang \|\| g.source === "project"` 筛选显示 |
| 体裁 → 书籍 | 书籍选择体裁 ID | 删除体裁 → 书籍引用失效（需手动重置） |
| 预设 → Agent (7 个) | 多对多 | apply 全量覆盖 7 个 Agent 的 PersonaConfig |
| 预设 → 项目文件 | 文件系统 | 删除项目 → 预设文件级联删除 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 加载列表 | GET /genres → 200 → 体裁列表渲染 | API 500 → 页面不崩溃，显示最小 fallback | 无体裁 → bodyText > 0 (页面框架) | 多语言混合 → lang 筛选正确 |
| 查看详情 | 点击体裁 → GET /genres/:id → 详情面板渲染 | GET 失败 → 空详情面板 | 无已选体裁 → "请选择一个体裁" 提示 | 内置体裁 → 复制按钮可用 |
| 创建体裁 | 表单填写 → POST /create → refetch | 缺少必填 → alert 弹窗 | N/A | 同名 ID → 创建覆盖? (当前无冲突检测) |
| 编辑体裁 | 表单编辑 → PUT /:id → refetch | PUT 失败 → alert 弹窗 | N/A | 编辑内置体裁 → 应通过 copy 后编辑 |
| 删除体裁 | 确认弹窗 → DELETE /:id → 列表刷新 | DELETE 失败 → alert 弹窗 | N/A | 内置体裁 → 删除按钮不渲染 |
| 复制体裁 | POST /:id/copy → alert "Copied" | copy 失败 → 未处理 (无 catch) | N/A | 重复复制 → 同 ID 覆盖 |
| 应用预设 | POST /presets/:id/apply → 7 Agent 更新 | NOT_FOUND → 404 | N/A | 当前未保存配置 → 预设覆盖并丢失未保存内容 |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `GenreManager` | 通过侧边栏 "体裁" 进入 | — | 主页面：左侧列表 + 右侧详情面板 |
| Genre List (左栏) | (内嵌) | — | 体裁列表，按语言筛选 |
| Genre Detail (右栏) | (内嵌) | — | 详情：name/id/lang/tags/chapterTypes/fatigueWords |
| GenreForm | (内嵌/弹窗) | — | 创建/编辑表单 |
| `ConfirmDialog` | (弹窗) | — | 删除确认弹窗 |

### 4.2 交互流程

```
进入体裁管理 → GET /genres → 渲染列表 + 详情面板
├── 左侧列表: 按语言筛选 (g.language === lang || g.source === "project")
│   ├── 内置体裁: 显示 id · language · source
│   └── 项目体裁: source="project"
├── 点击体裁 → 选中高亮 (bg-primary/10)
│   → 右侧详情面板加载:
│   ├── 标题: name
│   ├── 元信息: id · language · numerical/power/era flags
│   ├── chapterTypes chips
│   ├── fatigueWords chips (最多显示 15 个，超出显示 +N)
│   ├── pacingRule 文本
│   └── body Markdown pre
├── 详情面板操作按钮:
│   ├── Edit (Pencil) → 进入编辑表单
│   ├── Delete (Trash2) → 仅 project 级显示 → ConfirmDialog
│   └── Copy → POST /genres/:id/copy → alert
├── "创建" (Plus) → 显示 GenreForm
│   └── 格式: id + name + language + chapterTypes/fatigueWords (逗号分隔)
│       + checkboxes (numericalSystem/powerScaling/eraResearch)
│       + pacingRule input + body textarea
│       → create: POST /genres/create
│       → edit: PUT /genres/:id
│       → cancel: 关闭表单
└── 面包屑: Home > 体裁
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 体裁列表项 | 左侧列表 button 元素 | 列表渲染断言 |
| 详情面板 | 右侧面板 (min-h-[400px]) | 详情加载断言 |
| 编辑按钮 | `button` with Pencil icon | 编辑入口 |
| 删除按钮 | `button` with Trash2 icon | 删除入口 |
| 复制按钮 | `button:has-text('copy')` 或 `genre.copyToProject` | 复制入口 |
| 创建按钮 | `button:has-text('创建')` 或 Plus icon | 创建入口 |
| 表单面板 | `border rounded-lg p-6` | 表单容器 |
| ConfirmDialog | `ConfirmDialog` component | 删除确认 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 1s 体裁列表加载；p95 < 2s 体裁创建 | E2E waitForTimeout |
| 并发 | 体裁存储为文件系统读取，IndexManager 单例管理 | 无并发冲突 |
| 回滚 | 创建/编辑失败 → alert 弹窗，不更新 UI 状态 | mock API 返回 500 |
| 降级 | API 不可用 → 页面空白/不崩溃 (bodyText > 0) | genre-manager E2E test 4 |
| 浏览器兼容 | Chrome / Firefox / Edge 最新两个大版本 | CI matrix |
| 无障碍 | 表单标签与输入框关联 | 手动检查 |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 体裁版本管理 / 变更历史 | 体裁数据量小，Git 已覆盖 |
| 体裁审计维度自定义编辑 (auditDimensions as number[]) | 当前使用数字索引，UI 未暴露编辑 |
| Preset 部分编辑（只更新个别 Agent） | apply 为全量覆盖 7 Agent |
| 体裁导入/导出（跨项目共享） | 当前仅在项目内 `genres/` 目录 |
| 体裁继承（子体裁继承父体裁规则） | 无需求，每个体裁独立 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 存在内置体裁 (xianxia, litrpg) | 导航到体裁页面 | 页面渲染不崩溃；bodyText > 0 | ⬜ | genre-manager |
| 2 | 无体裁数据 | 导航到体裁页面 (API 返回 []) | 页面不崩溃 | ⬜ | genre-manager |
| 3 | 体裁列表已加载 | 点击某个体裁条目 | 右侧详情面板显示 name/id/lang/tags/chapterTypes/fatigueWords | ⬜ | genre-manager |
| 4 | API 返回 500 错误 | 导航到体裁页面 | 页面不崩溃，显示降级 UI | ⬜ | genre-manager |
| 5 | 详情面板已打开 | 点击 "编辑" 按钮 | 弹出编辑表单，预填 genre 字段；id 字段 disabled | ⬜ | — |
| 6 | 编辑表单已填充 | 修改 name + chapterTypes → 点击保存 | PUT /genres/:id → 列表刷新 → 表单关闭 | ⬜ | — |
| 7 | 内置体裁详情打开 | 检查删除按钮 | 删除按钮不渲染（`source !== "project"`） | ⬜ | — |
| 8 | 项目级体裁详情打开 | 点击删除 → ConfirmDialog → 确认 | DELETE /genres/:id → 体裁从列表移除 → selected 清空 | ⬜ | — |
| 9 | 任意体裁详情打开 | 点击 "复制" 按钮 | POST /genres/:id/copy → alert "Copied" → 列表刷新含新副本 | ⬜ | — |
| 10 | 表单未填写 ID/name | 点击 "创建" 按钮 | POST /genres/create → 后端校验失败? (前端无校验) | ⬜ | — |

完成度: 0/10 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | Genre Manager 和 Presets API 是否是同一套数据？代码中 Genre Manager 用 `/genres`，Presets 用 `/presets` | @backend-lead | 否 |
| 2 | 体裁的 `auditDimensions` 数字数组含义？UI 是否应暴露编辑？ | @frontend-lead | 否（当前用数字索引） |
| 3 | `handleCopy` 没有错误处理（catch），复制失败时用户体验如何？ | @frontend-lead | 否 |
| 4 | 前端创建体裁时无必填校验，后端是否有？ | @backend-lead | 否 |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 骨架（自动生成） | — |
| 2026-07-23 | v2.0 完整补全：基于源码 + 1 E2E spec | spec-writer-3 |
