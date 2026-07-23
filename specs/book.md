# 书籍管理 — 功能规格书 (SDD)

**版本**: 1.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `api/routes/book-style.ts` + `models/book.ts` + `BookCreate.tsx` / `BookDetail.tsx` / `BookStylePage.tsx`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: 书籍管理模块是 InkChain 的核心入口，包含书籍配置(BookConfig)、创建向导、详情面板、风格分析(StylePage)、以及世界观关联。数据存储为 `books/<id>/book.json`。
> **痛点**: (1) 书籍创建时平台选择(tomato/feilu/qidian/other)需要用户自行判断，缺少引导；(2) 风格分析仅限于简单的句子/段落/词汇统计，缺少写作风格建议；(3) 书籍状态(incubating→outlining→active→paused→completed→dropped)流转缺少自动化触发；(4) 同人模式(fanficMode)与原著(在parentBookId)的差异提示不明显。
> **期望状态**: 创建向导根据目标平台推荐配置；风格分析提供异常发现+对比视图；状态流转支持手动+自动(如完成章节数达标)；同人模式明确标注与原著的关系。
> **成功指标**: 5 个 E2E spec 全部通过（book-create / book-create-click / book-detail / book-style-page / book-world-extract）。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **创建新书籍并配置平台/分类/目标字数** so that **开始写作并适配目标平台**。【P0】
2. As a **写作者**, I want **查看书籍详情和状态** so that **追踪写作进度和配置**。【P0】
3. As a **写作者**, I want **分析全书写作风格一致性** so that **发现前后风格偏差的章节**。【P1】
4. As a **写作者**, I want **将书籍关联到一个世界观** so that **统一世界设定**。【P2】
5. As a **写作者**, I want **从已有书籍提取世界观信息** so that **省去手动配置世界观**。【P2】

---

## 1. 模块概述

书籍管理是 InkChain 的**作品配置中心**，管理每本书的核心元数据：id、title、platform(番茄/飞卢/起点/其他)、genre、status(incubating/outlining/active/paused/completed/dropped)、targetChapters、chapterWordCount、language(zh/en)、worldId、volumes、writing.reviewMode、以及同人模式(parentBookId + fanficMode)。支持创建向导、详情面板、风格分析页面（句子长度/段落/词汇多样性/修辞特征检测/异常发现）、世界观关联和提取。

---

## 2. 行为合约

### 2.1 API 接口（书籍风格分析）

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| POST | `/:id/style/analyze` | `{ chapters?: number[] \| "all" }` | `{ chapters, comparison, averageProfile, anomalies, failedChapters? }` | 分析选定章节的风格 |
| GET | `/:id/style/profiles` | — | `{ profiles: ChapterStyleProfile[] }` | 获取所有章节的风格画像 |

**书籍基础 CRUD**（由框架路由管理，无独立文件）:
- GET `/:id` — 获取书籍详情
- POST `/` — 创建书籍
- PUT `/:id` — 更新书籍
- DELETE `/:id` — 删除书籍

**请求/响应示例**:
```json
// POST /:id/style/analyze → Request Body
{ "chapters": [1, 2, 3] }
// → 200
{ "chapters": [{ "chapterNumber": 1, "avgSentenceLength": 45.2, "vocabularyDiversity": 0.55, ... }],
  "comparison": [{ "chapterNumber": 1, "deviationFromAverage": { "avgSentenceLength": 5.3, ... } }, ...],
  "averageProfile": { "avgSentenceLength": 39.9, "vocabularyDiversity": 0.48, ... },
  "anomalies": [{ "chapterNumber": 3, "dimension": "avgSentenceLength", "value": 72.1, "average": 39.9, "deviation": 32.2 }] }
```

### 2.2 数据模型

| Schema | 类型 | 必填字段 | 可选字段 | 默认值 / 校验 |
|--------|------|----------|---------|--------------|
| `BookConfigSchema` | object | id, title, platform(tomato/feilu/qidian/other), genre, status(incubating/outlining/active/paused/completed/dropped), createdAt, updatedAt | targetChapters, chapterWordCount, language(zh/en), parentBookId, fanficMode(canon/au/ooc/cp), worldId, worldIds[], writing.reviewMode, volumes[] | targetChapters 默认 200; chapterWordCount 默认 3000 |
| `PlatformSchema` | enum | tomato / feilu / qidian / other | — | normalizePlatformId: 支持"番茄"/"起点"/"飞卢"等中文别名 |
| `BookStatusSchema` | enum | incubating / outlining / active / paused / completed / dropped | — | 状态流转手动控制 |
| `FanficModeSchema` | enum | canon(正典) / au(平行宇宙) / ooc(角色脱离设定) / cp(配对被) | 仅 parentBookId 存在时有效 | — |
| `ChapterStyleProfile` | interface | chapterNumber, title, avgSentenceLength, sentenceLengthStdDev, avgParagraphLength, vocabularyDiversity, wordCount | topPatterns[], rhetoricalFeatures[] | 从章节 markdown 文本分析出 |
| `StyleAnalyzeResult` | interface | chapters[], comparison[], averageProfile, anomalies[] | failedChapters[] | anomalies: 偏离均值 >50% 的维度 |
| `CompareResult` | interface | chapterNumber, title, profile, deviationFromAverage | — | deviationFromAverage 含 4 维度偏差值 |

### 2.3 状态转换

#### 书籍状态流转（BookStatus）

```
                创建
  ────────────────────→ incubating (孵化)
                            │
                开始大纲      │
  incubating ───────────────→ outlining (大纲)
                            │
                开始写作      │
  outlining  ───────────────→ active (连载中)
                            │       │
                暂停/继续    │       │
  active  ←────────→ paused (暂停)
                            │       │
                完本         │       │
  active / paused ──────────→ completed (已完结)
                            │
                弃坑         │
  active ──────────────────→ dropped (已弃坑)
```

#### UI 状态机（风格分析页面）

```
                    ┌── error ──────────────────────────────────┐
                    │  API 500 / 章节读取失败 → 错误显示          │
                    │  failedChapters 列出读取失败的章节          │
                    ▼                                             │
idle ──→ loading ──→ rendered                                   │
  ▲         │           │                                        │
  │         │           ├── no chapters → "无章节可分析"         │
  │         │           └── data (profiles+comparison)           │
  │         │                → 图表 + 对比表 + 异常高亮           │
  └─────────┴──── 重新分析 / 章节选择变更                        │
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| 书籍 → 世界观 | 多对多（通过 worldIds） | 删除世界观 → 书籍 worldIds 需手动清理 |
| 书籍 → 同人原著 | 一对一（通过 parentBookId） | 删除原著 → 同人作品 parentBookId 变为 undefined |
| 书籍 → 卷 | 一对多（通过 volumes[]） | 删除书籍 → volumes 数据随 book.json 级联删除 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 创建 | POST → 201 → 导航到新书详情 | 缺少必填字段 → 400 / 书名重复 → 409 | 首个书籍 → 列表从空变为有 | 平台选择"other" → 无平台特定规则 |
| 读取 | GET → 200 → 渲染书籍详情/卷列表/世界观 | API 500 → error 页面 | 无书籍 → bookmark 页空状态 | 大量卷/章节 → 懒加载 |
| 更新 | PUT → 200 → 修改 status/worldId/targetChapters 等 | VALIDATION_ERROR → 400 + details | N/A | 修改 parentBookId 影响 fanficMode 显示 |
| 删除 | DELETE → 200 → 书籍数据+chapters+audit 等全部删除 | BOOK_NOT_FOUND → 404 | N/A | 删除同人原著 → 需检查是否有同人引用 |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `BookCreate` | `/#/book/new` | `bc-` | 创建书籍向导（标题/平台/分类/字数/语言） |
| `BookDetail` | `/#/book/:id` | `bd-` | 书籍详情页（状态/元数据/卷列表/世界观） |
| `BookStylePage` | `/#/book/:id/style` | `bs-` | 风格分析页（章节选择/分析结果/异常高亮） |
| `Dashboard` | `/#/` | — | 首页仪表板（书籍列表卡片） |

### 4.2 交互流程

```
创建书籍:
  进入 /#/book/new → 填写表单
  [书名] [目标平台: 番茄/飞卢/起点/其他▼] [分类] [目标字数: 200默认] [每章字数: 3000默认] [语言: zh/en▼]
  [同人模式?] → 如选中 → 显示 parentBookId + fanficMode(canon/au/ooc/cp)
  → 创建 → POST → 导航到书籍详情

书籍详情:
  进入 /#/book/:id → 加载 book.json → 渲染信息
  [标题] [状态] [平台] [分类] [进度: target/current] [语言]
  ┌─ 操作 ──────────────────────────────┐
  │ [编辑元数据] [创建章节] [关联世界观]   │
  └─────────────────────────────────────┘

风格分析:
  进入 /#/book/:id/style → 选择章节范围 → 分析
  → 显示: 各章统计图表(barchart: avgSentenceLength/vocabularyDiversity)
  → 异常列表: 偏离均值>50%的章节高亮红色
  → 词汇模式: top 5 bigrams
  → 修辞特征: 反问/感叹/词汇丰富度
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 创建表单 | 平台/分类/字数选择器 | BookCreate 表单元素 |
| 详情容器 | 书籍元数据区域 | BookDetail 信息展示 |
| 风格分析 | 章节选择器 + 分析按钮 + 图表 | BookStylePage 交互元素 |
| 导航按钮 | 返回/首页按钮 | 页面间导航 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 1s 书籍详情加载；p95 < 5s 全文风格分析(100章) | Playwright E2E timeout |
| 并发 | 同一项目多本书并行创建无冲突 | 手动验证 |
| 数据完整性 | BookConfigSchema Zod 校验；platform 别名 normalizePlatformId 容错 | Zod parse/node testing |
| 风格分析精度 | 句子切分支持中英混排([。！？.!?\\n]+) | 单元测试 analyzeTextStyle |
| 浏览器兼容 | Chrome / Firefox / Edge 最新两个大版本 | CI matrix |
| 无障碍 | WCAG 2.1 AA — 表单/图表可键盘访问 | axe-core 扫描 |
| 存储 | 每本书 book.json < 50KB | 文件大小监控 |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 书籍封面图片上传 | 纯文本写作工具，非出版物编辑器 |
| 实时写作协作 | 单用户桌面应用，无 WebSocket sync |
| 自动字数统计更新 | 需要在章节写入时触发，当前未集成 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 进入创建书籍页面 | 填写书名/平台/分类/字数 → 提交 | 创建成功，无页面崩溃；导航到新书详情 | ⬜ | book-create |
| 2 | 在创建页面 | 点击"创建"按钮 | 按钮触发创建流程，不崩溃 | ⬜ | book-create-click |
| 3 | 进入书籍详情页 | 查看书籍元数据 | 显示标题/平台/状态/分类/进度信息 | ⬜ | book-detail |
| 4 | 进入风格分析页面 | 选择章节 → 点击分析 | 显示章节风格统计(句子长度/段落/词汇多样性/异常检测) | ⬜ | book-style-page |
| 5 | 书籍含世界观元素 | 触发世界观提取 | 从章节内容提取 worldview 实体到 7 维度 | ⬜ | book-world-extract |

完成度: 0/5 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | 平台规范化映射(normalizePlatformId)是否需要支持更多平台（如书旗、掌阅）？ | @backend-lead | 否（当前 4 平台已覆盖主流网文市场） |
| 2 | 风格分析的异常阈值(50%偏离均值)是否需要可配置？ | @frontend-lead | 否（硬编码已足够） |
| 3 | 同人模式(fanficMode)是否需要在创建时强制关联 parentBookId？当前为可选 | @backend-lead | 否（先创建后关联也可） |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 初始版本，基于 API/Model/E2E 代码 | spec-writer-1 |
