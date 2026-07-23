# Skill 配置管理 — 功能规格书 (SDD)

**版本**: 1.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `api/routes/skills.ts` + `models/skill-config.ts`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: Skill 模块管理可复用的 AI 技能配置，分 builtin 和 project 两级存储。project 级别优先于 builtin，支持 CRUD、启用/禁用切换、版本历史（最多 20 个版本）、版本恢复、分类筛选和搜索。
> **痛点**: (1) 用户创建自定义 skill 时提示模板(trigger/injection)不够直观；(2) 版本历史仅保留 20 个，可能不够大型项目使用；(3) builtin skill 的编辑/禁用后恢复逻辑可能混淆用户；(4) 缺少 skill 的预览/测试运行功能。
> **期望状态**: 创建向导分步骤引导填写 trigger/injection/prompt；版本保留策略可配置；builtin/project 区分清晰；提供 sandbox 测试执行。
> **成功指标**: 8 个 E2E spec 全部通过（skill-library-core / skill-library / skill-create-e2e / skill-create-feature / skill-create-flow / skill-edit-functionality / skill-bind-api / skill-builtin-edit）。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **浏览和启用/禁用已有 Skill** so that **根据需要切换 AI 写作辅助功能**。【P0】
2. As a **高级用户**, I want **创建自定义 Skill 并配置 trigger/injection/prompt** so that **编排个性化的 AI 写作流程**。【P1】
3. As a **高级用户**, I want **查看和恢复 Skill 的历史版本** so that **回退到之前的可用配置**。【P2】
4. As a **写作者**, I want **按分类筛选 Skill** so that **快速定位 writing/analysis/world/character 等类别**。【P1】
5. As a **维护者**, I want **builtin skill 覆盖 project skill 后被删除时恢复为 builtin** so that **保证默认功能不丢失**。【P2】
6. As a **开发者**, I want **Skill ID 遵循 kebab-case 命名规范** so that **确保跨环境互操作性**。【P1】

---

## 1. 模块概述

Skill 配置管理是 InkChain 的**AI 技能注册和编排中枢**。每个 Skill 定义 id、category(writing/analysis/world/character/utility)、triggers(manual/condition)、injection(mode/target/priority)、params（可配置参数定义）、prompt（注入到 LLM 的指令文本）和 enabled 状态。数据分两级存储：builtin 在 `packages/defaults/skills/` 提供基础技能；project 在 `.inkos/skills/<id>.json` 提供用户自定义覆盖。project 级别优先于 builtin。所有写操作自动生成版本快照（最多 20 个保留）。

---

## 2. 行为合约

### 2.1 API 接口

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/api/skills` | query `category`(可选) | `{ skills: ApiSkillResponse[] }` | 列出所有 skill(project+builtin 合并，可选按分类过滤) |
| GET | `/api/skills/:id` | — | `{ skill: ApiSkillResponse }` | 获取单个合并后的 skill |
| POST | `/api/skills` | `SkillConfigSchema` body | `{ skill: ApiSkillResponse }` (201) | 创建 project 级 skill |
| PUT | `/api/skills/:id` | `SkillConfigUpdateSchema` body | `{ skill: ApiSkillResponse }` | 更新 project 级 skill(如不存在则创建覆盖) |
| DELETE | `/api/skills/:id` | — | `{ ok: true, id, reverted }` | 删除 project 级 skill，回退到 builtin(如存在) |
| PATCH | `/api/skills/:id/toggle` | — | `{ skill: ApiSkillResponse }` | 切换启用/禁用状态 |
| GET | `/api/skills/:id/versions` | — | `{ versions: SkillVersionMeta[] }` | 列出 skill 的版本历史 |
| GET | `/api/skills/:id/versions/:rev` | — | `{ version: { rev, config } }` | 获取指定版本 |
| POST | `/api/skills/:id/versions/:rev/restore` | — | `{ skill: ApiSkillResponse }` | 恢复指定版本(覆盖当前) |

**请求/响应示例**:
```json
// POST /api/skills → Request Body
{ "id": "my-custom-analyzer", "category": "analysis",
  "triggers": [{ "type": "manual" }],
  "injection": { "mode": "append", "target": "system_prompt", "priority": 50 },
  "params": { "depth": { "key": "depth", "label": "分析深度", "type": "select", "options": ["浅", "中", "深"] } },
  "prompt": "请对当前章节进行深度分析...", "description": "自定义章节分析器", "enabled": true }
// → 201 Created
{ "skill": { "config": { ... }, "source": "project", "path": ".inkos/skills/my-custom-analyzer.json" } }

// Error → 409 Conflict
{ "error": { "code": "SKILL_ALREADY_EXISTS", ... } }

// DELETE /api/skills/builtin-skill → (如果 builtin 存在)
{ "ok": true, "id": "builtin-skill", "reverted": false }
// → 删除 project 覆盖后，builtin 自动恢复，reverted: true
```

### 2.2 数据模型

| Schema | 类型 | 必填字段 | 可选字段 | 默认值 / 校验 |
|--------|------|----------|---------|--------------|
| `SkillConfigSchema` | object | id(kebab-case), category(writing/analysis/world/character/utility) | triggers[], injection, params{}, enabled, description, prompt | id 正则: `/^[a-z0-9][a-z0-9-]*$/`; category 默认 utility; enabled 默认 true |
| `TriggerConfigSchema` | object | type(manual/condition) | condition | — |
| `InjectionConfigSchema` | object | — | mode(append/prepend/replace), target(system_prompt/user_prompt/context), priority(1-100) | mode 默认 append; target 默认 system_prompt; priority 默认 50 |
| `ParamDefSchema` | object | key, label, type(string/number/boolean/select) | required, defaultValue, options[] | required 默认 false |
| `SkillConfigUpdateSchema` | partial | — | 任意字段(id 不可变) | 省略了 id 字段; partial update |
| `StoredSkillConfig` | interface | config, source(builtin/project), path | — | source 标识来源; project 优先于 builtin |
| `ApiSkillResponse` | interface | config, source | path | project 来源带 path |

### 2.3 状态转换

#### UI 状态机

```
                    ┌── error ──────────────────────────────────┐
                    │  API 500 / 网络超时 → 错误提示              │
                    ▼                                             │
idle ──→ loading ──→ rendered                                   │
  ▲         │           │                                        │
  │         │           ├── empty (无 skill)                     │
  │         │           │     → sk-empty-state "暂无Skill"       │
  │         │           └── data (有 skill)                      │
  │         │                → 卡片列表 + 分类筛选 + 搜索         │
  └─────────┴──── refetch / 刷新                                │
```

**守卫条件**:
- `rendered` → `builtin badge 可见`: 仅当 `skill.source === "builtin"`
- `rendered` → `toggle disabled`: 仅当 `skill.source === "builtin"` 且未被 project 覆盖
- `rendered` → `version list 可见`: 仅当 project skill 且有版本历史

#### 数据状态机（Skill 生命周期）

```
                   POST /skills (201)
新建 ───────────────────────────────────────→ project 已创建
                                               │
                  PUT /skills/:id (200)        │
project 已创建 ───────────────────────────────→ project 已修改 (自动 snapshot)
                                               │
                  DELETE /skills/:id           │
project 已创建 ───────────────────────────────→ 已删除
                    │                             │
                    └── builtin 存在?            └── builtin 回退
                     → 前端显示 builtin           → reverted: true

            PATCH /skills/:id/toggle (200)
project 已创建 ───────────────────────────────→ enabled 切换 (写 project 覆盖)

            版本管理:
            每次 PUT → snapshotBeforeWrite → 版本号自增
            POST /skills/:id/versions/:rev/restore → 恢复指定版本
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| project skill → builtin | 覆盖关系 | 删除 project → 自动回退到 builtin(if exists) |
| Skill → SkillRegistry | 运行时注册 | 禁用 skill → registry 移除注入 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 创建 | POST → 201 → 列表插入新 skill; source=project | VALIDATION_ERROR → 400+details / SKILL_ALREADY_EXISTS → 409 | 首个 project skill → 列表从 empty 变有 | id 不符合 kebab-case → VALIDATION_ERROR |
| 读取 | GET → 200 → 渲染合并列表(builtin+project) | API 500 → error 状态 | 无 skill → empty state | builtin+project 同名→project 优先 |
| 更新 | PUT → 200 → 自动 snapshot→版本历史+1 | VALIDATION_ERROR → 400 + details | N/A | 更新 builtin → 自动创建 project 副本再更新 |
| 删除 | DELETE → 200 → project 文件删除; builtin 自动回退 | SKILL_NOT_FOUND → 404（project+builtin 均无） | N/A | 禁用(disabled)的 builtin 删除 project 覆盖后恢复启用 |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `SkillListPage` | `/#/skills` | `sk-` | Skill 主页面，含卡片列表 + 搜索 + 分类筛选 |
| `SkillCreateDialog` | Dialog | — | 创建 Skill 表单 |
| `SkillEditDialog` | Dialog | — | 编辑 Skill 表单 |
| `SkillDetailPanel` | 内嵌 | — | Skill 详情展示(参数/触发器/注入配置) |
| `VersionHistoryPanel` | 内嵌 | — | 版本历史列表 + 恢复操作 |

### 4.2 交互流程

```
进入 Skill 列表 → 加载 builtin+project 合并列表 → 渲染卡片
┌─ 工具栏 ─────────────────────────────────┐
│ [搜索框] [分类筛选▼] [创建Skill]           │
└──────────────────────────────────────────┘
Skill 卡片: [名称] [分类标签] [builtin badge] [启用开关] [编辑] [删除]
点击"创建" → SkillCreateDialog → 填写 id/category/triggers/injection/prompt → POST → 刷新列表
点击"编辑" → SkillEditDialog → PUT → 自动 version snapshot → 刷新
点击"启用开关" → PATCH toggle → 实时更新 enabled 状态
点击"版本历史" → VersionHistoryPanel → 查看版本列表 → 点击恢复 → POST restore
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 创建按钮 | `sk-create-btn` / `sk-btn-create-skill` | 创建 Skill 入口 |
| 搜索输入 | `sk-search-input` | 搜索 Skill |
| 启用开关 | 基于 `data-testid*='toggle'` / `[role='switch']` | 启/禁用 |
| 分类筛选 | 基于 `data-testid*='category'` | 分类筛选下拉 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 1s 列出所有 skill(50个内)；p95 < 2s 版本历史恢复 | Playwright E2E timeout |
| 版本管理 | 每次 PUT 自动生成版本快照；最多保留 20 个版本；自动修剪旧版本 | 单元测试 snapshotBeforeWrite/pruneVersions |
| 数据完整性 | ID 正则校验(/^[a-z0-9][a-z0-9-]*$/)；Zod schema 严格校验 | Zod parse 失败→VALIDATION_ERROR |
| 回滚 | 版本恢复: POST restore → 完全覆盖当前 → 写 project 文件 | E2E restore test |
| 浏览器兼容 | Chrome / Firefox / Edge 最新两个大版本 | CI matrix |
| 无障碍 | WCAG 2.1 AA — 所有交互元素键盘可访问 | axe-core 扫描 |
| 存储 | 每个 project skill 文件 < 100KB；版本快照 < 20MB total(20×100KB) | 文件大小监控 |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| Skill 实时测试/Sandbox 执行 | 需 Agent 运行时环境，超出 API CRUD 范围 |
| Skill 市场/分享/导入导出 | 单用户桌面应用，非 SaaS |
| 版本 diff 对比（内容级） | 当前仅支持列表+恢复，diff 需要额外文本比较引擎 |
| 条件触发(condition)的运行时求值 | MVP 仅支持 manual 触发，condition 为未来预留 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | Skill 列表页面加载 | 等待加载完成 | 所有 builtin+project skill 显示；search 输入框可见；创建按钮可见 | ⬜ | skill-library-core |
| 2 | Skill 列表含 search 和 filter | 输入关键词搜索 / 切换分类筛选 | 列表按关键词/分类过滤 | ⬜ | skill-library |
| 3 | 点击创建按钮 | 填写完整表单 → 提交 | POST 201 → 新 skill 出现在列表; source=project | ⬜ | skill-create-e2e |
| 4 | 创建表单 | 完整填写 category/triggers/injection/prompt | 验证所有字段正确保存 | ⬜ | skill-create-feature |
| 5 | 创建流程 | 从创建到保存到列表展示 | 端到端流程连贯无断点 | ⬜ | skill-create-flow |
| 6 | 点击编辑 project skill | 修改 prompt/triggers → 保存 | PUT 200 → 自动版本快照 → 列表刷新 | ⬜ | skill-edit-functionality |
| 7 | Skill 关联到 API/bind | 设置 triggers 绑定特定 API | trigger 正确关联到后端 | ⬜ | skill-bind-api |
| 8 | 编辑 builtin skill | 修改 builtin → 保存 | 创建 project 副本覆盖 builtin；删除 → 回退到 builtin | ⬜ | skill-builtin-edit |

完成度: 0/8 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | 是否应支持 skill 依赖声明（skill A 依赖 skill B）？当前无依赖机制 | @backend-lead | 否（未来需求） |
| 2 | 版本修剪(pruneVersions)的 20 条上限是否可配置？当前硬编码 | @backend-lead | 否（20 已足够大多数场景） |
| 3 | condition trigger 的求值表达式语法是什么？当前仅 placeholder 字符串 | @backend-lead | 是（condition 触发功能依赖此定义） |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 初始版本，基于 API/Model/E2E 代码 | spec-writer-1 |
