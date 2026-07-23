# 导入管理器 — 功能规格书 (SDD)

**版本**: 2.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `ImportManager.tsx`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: 导入管理器是 InkChain 中批量导入创作素材的 UI 工具，支持五个导入场景——章节导入、母本（设定）导入、同人创作初始化、番外创作初始化、仿写创作初始化。使用 Tab 分组切换，每个 Tab 有独立的表单和 API 调用。
> **痛点**: (1) 所有 Tab 共享 `loading` 和 `status` 状态，无法并行操作；(2) 每次 API 错误仅显示 `status` 文本，无结构化错误信息；(3) 仿写/同人/番外初始化调用异步 API 后跳转页面，用户可能失去上下文；(4) 母本导入和章节导入无 loading 期间的表单禁用状态。
> **期望状态**: 每个 Tab 独立加载态和错误处理，表单验证到位后启用提交按钮，操作成功后清晰反馈或跳转，覆盖 Normal/Error/Empty/Edge 四态。
> **成功指标**: import-manager E2E（4 个测试）全部通过。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **粘贴多章文本按分隔符拆分导入** so that **从其他工具迁移已有章节**。【P0】
2. As a **写作者**, I want **从已有书籍导入设定作为母本** so that **衍生作品共享世界观**。【P1】
3. As a **写作者**, I want **输入原文片段初始化同人作品** so that **快速开始同人创作**。【P1】
4. As a **写作者**, I want **基于父书籍生成番外** so that **扩展已有世界观**。【P2】
5. As a **写作者**, I want **提供参考文本和故事构思初始化仿写** so that **基于文风参考快速启动**。【P2】
6. As a **维护者**, I want **API 故障时页面不崩溃且显示错误信息** so that **能定位导入失败原因**。【P1】

---

## 1. 模块概述

Import Manager 是 InkChain 的素材导入前端工具，纯 UI 模块（无专用 API 路由）。通过五个 Tab 页面覆盖不同导入场景，每个 Tab 调用不同的后端 API endpoint。页面通过路由 `/#/import` 或 `/#/import/:tab` 访问，Books 列表从 `GET /books` 获取作为选择框的选项。

---

## 2. 行为合约

### 2.1 API 接口

Import Manager 本身无专用路由，通过以下已有 API 实现各 Tab 功能：

| Tab | 调用的 API | 方法 | 说明 |
|-----|-----------|------|------|
| 章节导入 | `POST /books/:bookId/import/chapters` | POST | 按分隔符拆分文本并导入章节 |
| 母本导入 | `POST /books/:bookId/import/canon` | POST | 从已有书籍导入设定 |
| 同人创作 | `POST /fanfic/init` | POST | 初始化同人创作书籍 |
| 番外创作 | `POST /spinoff/init` | POST | 初始化番外创作书籍 |
| 仿写创作 | `POST /imitation/init` | POST | 初始化仿写创作书籍 |
| 书籍列表 | `GET /books` | GET | 获取所有书籍用于下拉选择 |

### 2.2 数据模型

| 接口 | 输入字段 | 必填 | 说明 |
|------|---------|------|------|
| 章节导入 | `text` (string), `splitRegex?` (string) | text + bookId | 分隔正则空时默认不分隔 |
| 母本导入 | `fromBookId` (string), `targetBookId` | 两者 | 来源和目标书 |
| 同人创作 | `title` (string), `sourceText` (string), `mode` (canon/au/ooc/cp), `genre`, `language` (zh/en) | title + sourceText | mode 默认 "canon" |
| 番外创作 | `title` (string), `parentBookId` (string), `direction?` (string) | title + parentBookId | direction 可选的创作方向说明 |
| 仿写创作 | `title` (string), `referenceText` (string), `storyIdea` (string), `genre`, `language` (zh/en) | title + referenceText + storyIdea | — |

**UI 状态（不持久化）**:

| 状态 | 类型 | 说明 |
|------|------|------|
| `tab` | "chapters" / "canon" / "fanfic" / "spinoff" / "imitation" | 当前激活的 Tab，可通过 URL hash 或 initialTab prop 设置 |
| `loading` | boolean | 全局单一加载指示器 |
| `status` | string | 操作反馈文本（成功/错误），根据前缀判断样式色 |
| `booksData` | `{ books: BookSummary[] }` | 从 GET /books 获取的书籍列表 |

### 2.3 状态转换

#### 全局 UI 状态机

```
                    ┌── error ──────────────────────────────────┐
                    │  API 返回错误 → status = "Error: ..."      │
                    │  显示红色背景 (bg-destructive/10)           │
                    │  下次操作重新 start()                       │
                    ▼                                             │
idle ──→ loading ──→ success                                    │
  ▲         │           │                                        │
  │         │           ├── 章节/母本: status=成功文本，绿色背景    │
  │         │           └── 同人/番外/仿写:                       │
  │         │                status=创建中 → waitForBookReady     │
  │         │                → status=完成 → nav.toBook(bookId)   │
  └─────────┴──── 用户重新操作 (button click)                     │
```

**提交按钮守卫（disabled 条件）**:
- 章节导入: `loading || !chBookId || !chText.trim()`
- 母本导入: `loading || !canonTarget || !canonFrom`
- 同人创作: `loading || !ffTitle.trim() || !ffText.trim()`
- 番外创作: `loading || !spTitle.trim() || !spParent`
- 仿写创作: `loading || !imTitle.trim() || !imRef.trim() || !imIdea.trim()`

#### Tab 切换

```
点击 Tab 按钮 → setTab(tabId) + setStatus("") → 表单区域切换
URL hash /#/import/:tab → initialTab prop → useEffect 设置 tab
```

注意: Tab 切换不清空当前 Tab 的表单数据（`loading` 为全局共享状态）。

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| 同人/番外/仿写 → 书籍 | 创建新书籍 | 操作成功后自动导航到新书籍 |
| 母本导入 → 来源书籍 + 目标书籍 | 多对多 | 两本书必须存在；删除来源书不影响已导入的母本 |
| 章节导入 → 目标书籍 | 多对一 | 需目标书已存在 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 页面加载 | GET /books → 200 → 渲染 5 个 Tab + chapters 默认展开 | GET /books → 500 → 页面仍渲染，但下拉框无选项 | 无书籍 → 下拉框显示 placeholder | initialTab=fanfic → Tab 自动切换到同人 |
| 章节导入 | POST → 200 → status 绿色显示导入章节数 | POST 失败 → status 红色显示错误信息 | 空文本 → 提交按钮 disabled | 分隔正则为空 → 整个文本作为一章 |
| 母本导入 | POST → 200 → status 绿色显示成功 | POST 失败 → 红色错误 + 错误信息 | 未选来源/目标 → 按钮 disabled | 来源=目标 → 应拒绝（当前未校验） |
| 同人/番外/仿写 | POST → 200 → status 更新 → waitForReady → 导航到新书 | POST 失败 → 红色错误 | 必填为空 → 按钮 disabled | 同人 mode 默认="canon", lang 默认跟随页面语言 |
| Tab 切换 | 点击 Tab → 表单切换 + status 清空 | N/A | 目标 Tab 所有字段为空 | initialTab 变化时 useEffect 同步 |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `ImportManager` | `/#/import` 或 `/#/import/:tab` | 无统一前缀 | 主导入页面，含 Breadcrumb + 5 Tab 按钮 + 条件表单 |

### 4.2 交互流程

```
进入页面 → GET /books → 渲染选项列表
┌─ Breadcrumb ────────────────────────────────────┐
│ 首页 / 导入工具                                   │
└─────────────────────────────────────────────────┘
┌─ Title ─────────────────────────────────────────┐
│ 📄 导入工具                                       │
└─────────────────────────────────────────────────┘
┌─ Tabs ──────────────────────────────────────────┐
│ [导入章节] [导入母本] [同人创作] [番外创作] [仿写创作] │
└─────────────────────────────────────────────────┘
┌─ Tab Content (chapters 示例) ────────────────────┐
│ [选择目标书籍 ▼]                                  │
│ [分隔正则表达式]                                  │
│ [多行文本 textarea]                               │
│ [导入章节] (button,  disabled when invalid)       │
└─────────────────────────────────────────────────┘
│ Status message (绿色/红色，条件渲染)               │
```

### 4.3 关键 data-testid

ImportManager 未声明显式 `data-testid`。E2E 测试使用文本内容定位：

| 元素 | 选择器 | 用途 |
|------|--------|------|
| 页面标题 | `page.getByText("导入工具")` | 确认页面已渲染 |
| Tab 按钮 | `page.getByText("导入章节")`, `"导入母本"`, `"同人创作"`, `"番外创作"`, `"仿写创作"` | 验证 5 个 Tab 存在 |
| 章节选择框 | `select` (第一个 option 为 placeholder) | 选择目标书籍 |
| 文本输入 | `textarea` | 粘贴章节/素材文本 |
| 提交按钮 | `button:has-text("导入章节")` | 触发导入 |
| Status 消息 | `div.text-sm` (绿色/红色背景) | 验证操作反馈 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | Tab 切换 < 100ms（纯客户端）；导入 API < 5s | E2E waitForTimeout |
| 降级 | GET /books 失败 → 下拉框为空，页��不崩溃 | import-manager E2E #3 |
| 浏览器兼容 | Chrome / Firefox / Edge 最新两个大版本 | CI matrix |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 批量导入多本书 | 单次导入单一目标 |
| 导入进度条 | 同人/番外/仿写使用 `waitForBookReady` 轮询，无需进度条 |
| 导入历史记录 | 导入操作不持久化日志 |
| 文件上传导入 | 当前仅支持文本粘贴 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | Books API 返回 1 本书 | 导航到 `/#/import` | 页面标题 "导入工具" 可见，5 个 Tab 按钮均可见 | ⬜ | import-manager #1 |
| 2 | Books API 返回书籍列表 | 导航到 `/#/import/fanfic` | 同人创作 Tab 激活，页面无崩溃 | ⬜ | import-manager #2 |
| 3 | Books API 返回 500 错误 | 导航到 `/#/import` | 页面标题仍可见，不易崩溃 | ⬜ | import-manager #3 |
| 4 | Books API 返回 1 本书 | 导航到 `/#/import/chapters` | 章节导入 Tab 可见，无崩溃 | ⬜ | import-manager #4 |

完成度: 0/4 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | 各 Tab 是否需要独立 loading/error 状态？当前共享全局 `loading`，并行操作会冲突 | @frontend-lead | 否 |
| 2 | 母本导入时来源书籍等于目标书籍是否需要前端拦截？ | @frontend-lead | 否 |
| 3 | 同人/番外/仿写创建成功后导航是否应提供"留在本页"选项？ | @frontend-lead | 否 |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 骨架（自动生成） | — |
| 2026-07-23 | v2.0 完整补全：基于 ImportManager + 5 Tab API 调用 + E2E spec | spec-writer-4 |
