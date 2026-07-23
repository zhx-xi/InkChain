# Style Detection / 文风检测 — 功能规格书 (SDD)

**版本**: 2.0
**创建日期**: 2026-07-23
**状态**: approved
**代码源**: `api/routes/style-profiles.ts` + `api/routes/style-consistency.ts` + `models/style-profile.ts` + `models/detection.ts` + `StyleManager` 页面

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: Style Manager 提供文本输入分析、代码初筛（按章节标记分割检测）和 AI 深度检测三层文风检测。Style Profiles API 支持创建/读取/删除风格指纹档。Style Consistency API 对比目标章节与基线的风格一致性。
> **痛点**: (1) 空文本分析按钮状态管理不明确；(2) 检测结果缺少结构化异常高亮；(3) 风格一致性分析当前为 mock 数据；(4) 多章节文本初筛异常检测逻辑需完善。
> **期望状态**: 分析按钮在空文本时禁用；检测结果结构化展示异常段落/维度得分；一致性分析接入真实分析器；初筛正确区分单章节/多章节模式。
> **成功指标**: 5 个 E2E spec 全部通过（style-detection / style-detection-core / style-prescreen / style-chapter-range）。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **将参考文本粘贴到分析器** so that **提取该文本的风格指纹（句长/词汇/修辞）**。【P0】
2. As a **写作者**, I want **一键代码初筛检测多章节风格一致性** so that **快速发现文风偏离的章节**。【P1】
3. As a **写作者**, I want **对异常章节进行 AI 深度检测** so that **获取详细的风格差异报告**。【P1】
4. As a **写作者**, I want **保存风格档案到项目** so that **审计 Agent 能引用该风格约束**。【P1】
5. As a **写作者**, I want **将分析结果导出到具体书籍** so that **该书的写作 Agent 自动遵循风格**。【P2】
6. As a **维护者**, I want **风格一致性 API 提供真实分析而非 mock 数据** so that **检测结果有实际参考价值**。【P1】

---

## 1. 模块概述

Style Detection 模块提供三层文风检测能力：**代码初筛**（按章节标记 `---第N章---` 分割文本，计算全局/章节级风格指标，标记异常章节）、**AI 深度检测**（针对异常章节调用 LLM 分析）、**Style Profiles**（风格指纹档 CRUD，供 Agent 引用）。Style Consistency API 提供逐章风格一致性分析，从词汇分布、句式长度、对话比例、修饰语密度四个维度打分。

---

## 2. 行为合约

### 2.1 API 接口

#### Style Profiles API (`/api/style-profiles`)

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/api/style-profiles` | — | `{ profiles: EnhancedStyleProfile[] }` | 列出已保存的风格档案 |
| GET | `/api/style-profiles/:id` | — | `{ profile }` | 获取单个风格档案 |
| POST | `/api/style-profiles` | `{ texts: string[], language?, config? }` | `{ profile, summary }` (201) | 从文本学习风格并保存；id 可选自动生成 |
| POST | `/api/style-profiles/:id/analyze` | `{ texts: string[], language? }` | `{ profile, constraints, summary }` | 分析文本不保存 |
| DELETE | `/api/style-profiles/:id` | — | `{ ok: true, id }` | 删除指定风格档案 |

**请求/响应示例**:
```json
// POST /api/style-profiles → Request
{ "texts": ["狂风呼啸。天地变色。李凡握紧长剑。"], "language": "zh" }
// → 201 Created
{ "profile": { "id": "profile-1720000000000", "avgSentenceLength": 12.3, ..., "autoAnalyzed": true, "language": "zh" },
  "summary": { "styleType": "punchy", "dominance": "短句节奏感强" } }

// POST /api/style-profiles → 空文本
// → 400 Bad Request
{ "error": { "code": "NO_TEXT", "message": "At least one text sample is required" } }

// POST /api/style-profiles → 无效 JSON
// → 400 Bad Request
{ "error": { "code": "INVALID_JSON", "message": "Request body must be valid JSON" } }

// DELETE /api/style-profiles/nonexistent
// → 404 Not Found
{ "error": { "code": "PROFILE_NOT_FOUND", "message": "Style profile not found: nonexistent" } }
```

#### Style Consistency API (`/api/style-consistency`)

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| POST | `/api/style-consistency/analyze` | `{ bookId?, chapterIds?, sensitivity? }` | `{ result: StyleConsistencyResult }` | 分析目标章节 vs 基线风格一致性 |

**请求/响应示例**:
```json
// POST /api/style-consistency/analyze → Request
{ "bookId": "my-book", "sensitivity": 1 }
// → 200
{ "result": {
  "score": 78,
  "dimensions": [
    { "name": "vocabulary", "label": "词汇分布", "score": 88, "status": "ok", "note": "高频词重叠率 · 与基线匹配" },
    { "name": "sentence-length", "label": "句式长度", "score": 65, "status": "warn", "note": "短句频次偏高 · 与基线差异 +23%" },
    { "name": "dialogue-ratio", "label": "对话比例", "score": 92, "status": "ok", "note": "对话/叙述比例 · 与基线一致" },
    { "name": "modifier-density", "label": "修饰语密度", "score": 55, "status": "warn", "note": "修饰语密度 0.12 vs 基线 0.08 · 偏高 50%" }
  ],
  "anomalies": [
    { "index": 0, "tag": "length", "tagLabel": "句式过长", "paragraphIndex": 3,
      "description": "连续短句偏离基线节奏模式。", "quote": "他走了进去。看了看四周。",
      "detail": "连续短句（4句/17字）偏离基线节奏模式。", "diffPercent": "+31%", "ignored": false }
  ],
  "baselineLabel": "第1–10章 · 共32,450字",
  "targetLabel": "第11章",
  "sensitivity": 1
} }

// POST /api/style-consistency/analyze → 无效 JSON
// → 400 Bad Request
{ "error": { "code": "INVALID_JSON", "message": "Request body must be valid JSON" } }
```

### 2.2 数据模型

| Schema | 类型 | 必填字段 | 可选字段 | 默认值 / 校验 |
|--------|------|----------|---------|--------------|
| `StyleProfile` | interface | avgSentenceLength, sentenceLengthStdDev, avgParagraphLength, paragraphLengthRange{min,max}, vocabularyDiversity, topPatterns[], rhetoricalFeatures[] | sourceName, analyzedAt | — |
| `EnhancedStyleProfile` | extends StyleProfile | id, language | autoAnalyzed | 存储为 `data/style-profiles/<id>.json` |
| `DetectionHistoryEntry` | interface | chapterNumber, timestamp, provider, score, action:"detect"\|"rewrite", attempt | — | 写入 `detection_history.json` |
| `DetectionStats` | interface | totalDetections, totalRewrites, avgOriginalScore, avgFinalScore, avgScoreReduction, passRate, chapterBreakdown[] | — | 聚合统计 |
| `StyleConsistencyDimension` | interface | name, label, score, status:"ok"\|"warn"\|"good", note | — | 单维度分析结果 |
| `StyleAnomaly` | interface | index, tag:"length"\|"modifier"\|"dialogue", tagLabel, paragraphIndex, description, quote, detail, diffPercent, ignored | — | 异常段落详情 |
| `StyleConsistencyResult` | interface | score, dimensions[], anomalies[], baselineLabel, targetLabel, sensitivity (0-2) | — | 聚合一致性分析结果 |

**sensitivity 参数含义**:
- `0`: 低敏感度 — 仅检测最显著的异常
- `1`: 中敏感度（默认） — 包含对话比例异常、部分 ignored=true
- `2`: 高敏感度 — 检测所有维度，阈值最低

### 2.3 状态转换

#### 风格分析流程状态机

```
                    ┌── error ──────────────────────────────┐
                    │  INVALID_JSON → 400                    │
                    │  NO_TEXT → 400                         │
                    ▼                                        │
idle ──→ analyzing ──→ analyzed                             │
  ▲         │            │                                   │
  │         │            ├── success → 显示 profile + summary│
  │         │            │     + constraints                 │
  │         │            └── auto-save → POST 201            │
  └─────────┴──── 清空输入 / 重新分析                        │
```

#### 代码初筛状态机

```
                    ┌── 空文本 ──────────────────────────────┐
                    │  按钮 disabled (isDisabled=true)         │
                    ▼                                         │
idle ──→ prescreening ──→ prescreened                        │
  ▲         │               │                                  │
  │         │               ├── 多章节检测 → 章节级指标列表    │
  │         │               │   + 异常章节高亮 (标签 "异常")   │
  │         │               │   + "AI深度检测异常章节" 按钮    │
  │         │               ├── 单章节 (无 `---第N章---`)       │
  │         │               │   → 全局指标, 无异常标记          │
  │         │               └── 显示统计: avgSentenceLength     │
  │         │                   vocabDiversity, avgParagraph    │
  └─────────┴──── 修改输入 → 重置初筛结果                      │
```

#### 风格档案生命周期

```
                    POST /style-profiles (201)
新建 ──────────────────────────────────────────→ 已保存
                                                   │
                        POST /:id/analyze          │
已保存 ──────────────────────────────────────────→ 分析中 (不保存)
                                                   │
                        DELETE /:id                │
已保存 ──────────────────────────────────────────→ 已删除 (不可逆)
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| 风格档案 → 项目 | 存储在项目 data/style-profiles/ 目录 | 删除项目 → style-profiles 目录级联删除 |
| 风格约束 → Agent | 通过 `profileToConstraints()` 生成约束文本 | 删除档案 → Agent 约束丢失引用 |
| 检测历史 → 章节 | 记录 chapterNumber | 删除章节 → 检测历史条目不减 |
| 一致性分析 → 书籍 | 通过 `chapterIds` 引用 | mock 模式无实际数据依赖 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 分析文本 | POST → 201 → 显示 profile + summary | INVALID_JSON → 400 / NO_TEXT → 400 | N/A | 极端长文本(>100K字) → 正常分析 |
| 读取档案 | GET → 200 → 显示档案列表 | PROFILE_NOT_FOUND → 404 | 空档案列表 → 显示空状态提示 | 大量档案(>100) → 列表性能正常 |
| 删除档案 | DELETE → 200 → 档案消失 | PROFILE_NOT_FOUND → 404 | N/A | 快速连续删除 → 索引正确驱逐 |
| 代码初筛 | 填入多章节文本 → 点击初筛 → 显示结果 | 分析失败 → 错误提示 | textarea 为空 → 按钮 disabled | 单章节无标记 → 不显示异常 |
| 一致性分析 | POST /analyze → 返回维度得分+异常列表 | INVALID_JSON → 400 | N/A | sensitivity=2 高敏感 额外暴露 anomalies |
| 导出到项目 | 分析后 → 选择书籍 → 导入 | API 不可用 → alert 提示 | N/A | 无书籍可选 → select 为空 |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| Style Manager | 通过侧边栏 "文风" 按钮进入 | — | 主页面：textarea 输入 + 分析/初筛/导出操作 |
| Style Profile List | (内嵌) | — | 已保存档案列表 |
| Prescreen Results | (内嵌) | — | 代码初筛结果（章节级指标 + 异常标记） |
| Consistency Panel | (内嵌) | — | 风格一致性维度得分 + 异常列表 |

### 4.2 交互流程

```
进入文风检测 → textarea 可见 + source 输入框可见
├── 空文本 → "分析" 按钮 disabled
├── 填入文本 → 点击 "分析" → POST /style-profiles → 显示 profile + summary
│   ├── 显示 avgSentenceLength / vocabDiversity / topPatterns
│   └── 显示 "导入到书" section (book select + Import Guide 按钮)
├── 填入多章节文本 (含 ---第N章---) → 点击 "代码初筛"
│   ├── 显示全局指标: 平均句长 / 词汇丰富度 / 平均段落长
│   ├── 章节级指标列表
│   ├── 异常章节标记 "异常"
│   └── "AI深度检测异常章节" 按钮
└── 选择书籍 → 点击 "导入文风" → 风格档案导入项目

风格一致性分析 (StyleConsistency route):
  POST /style-consistency/analyze
  → 返回 dimensions 4 维度得分
  → 返回 anomalies (含 tag/quote/diffPercent)
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 分析按钮 | `button:has-text('分析')` 或 `[data-testid*='analyze']` | E2E 定位分析入口 |
| 初筛按钮 | `button:has-text('代码初筛')` 或 `[data-testid*='prescreen']` | E2E 定位初筛入口 |
| 深度检测按钮 | `button:has-text('深度')` 或 `[data-testid*='deep']` | 深度检测入口 |
| Textarea | `textarea` (第一个) | 文本输入 |
| Source 输入框 | `input[type='text']` (第一个) | 来源名称输入 |
| 导出按钮 | `button:has-text('导出')` 或 `[data-testid*='export']` | 导出入口 |
| 章节选择器 | `[data-testid*='chapter']` 或 `select` | 章节范围筛选 |
| 差异报告面板 | `[data-testid*='report']` 或 `[class*='panel']` | 结果面板 |
| 空状态 | `[data-testid*='empty']` | 空数据断言 |
| 错误状态 | `text=错误` 或 `text=失败` | 异常状态断言 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 2s 代码初筛（10 章文本）；p95 < 5s AI 分析 | Page waitForTimeout + visible assertion |
| 并发 | Style Profile 存储通过 IndexManager 全局单例，写锁自动排队 | IndexManager 内部锁 |
| 回滚 | 分析操作内存中执行（`:id/analyze` 不保存），失败不落盘 | 接口设计天然无副作用 |
| 降级 | Style Consistency 当前为 mock 实现，不影响前端渲染 | mockAnalysis() 固定返回 |
| 浏览器兼容 | Chrome / Firefox / Edge 最新两个大版本 | CI matrix |
| 内存 | 单次分析 10 章(5 万字) → 内存 < 50MB | Chrome DevTools Memory |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 风格分析历史对比 | 当前 Style Profile 存储无版本概念 |
| 多本书共享风格档案 | 档案按项目隔离，不支持跨项目引用 |
| 自动检测触发（写入时自动分析） | 手动触发设计，未集成到 Write Pipeline |
| Style Consistency 真实分析器 | 当前为 mock，等待 Issue #279 后端实现 |
| 导出风格报告为 PDF | 无导出管道实现 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 文风页面已加载 | 填入文本 "狂风呼啸。天地变色。" + source "测试" | 点击分析 → 显示 profile 结果（avgSentence, vocabDiversity等） | ⬜ | style-detection |
| 2 | textarea 为空 | 检查分析按钮状态 | 按钮 disabled 或点击后显示错误提示 | ⬜ | style-detection |
| 3 | 多章节文本含第1-3章标记 | 点击 "代码初筛" 按钮 | 显示 "代码初筛结果" 标题 + 平均句长/词汇丰富度/平均段落长 3 个指标 | ⬜ | style-prescreen |
| 4 | 第1章为短句风格，第2章为长句散文 | 点击 "代码初筛" | 至少 1 个章节被标记为 "异常"，显示 "AI深度检测异常章节" 按钮 | ⬜ | style-prescreen |
| 5 | 文本无 `---第N章---` 标记 | 点击 "代码初筛" | 显示初筛结果，不触发异常标记 | ⬜ | style-prescreen |
| 6 | 分析完成 | 检查导入区域 | 导出按钮可见，book select 可见 | ⬜ | style-detection |
| 7 | 分析完成 | 检查 "导入文风" / "Import Guide" | 导入按钮可见 | ⬜ | style-detection |
| 8 | 页面加载完成 | 检查页面元素 | 分析按钮、初筛按钮、textarea 同时可见 | ⬜ | style-prescreen |
| 9 | Consistency 分析 | POST /style-consistency/analyze (sensitivity=1) | 返回 4 维度得分 + anomalies 列表 | ⬜ | style-detection-core |
| 10 | API 500 错误 | 拦截 style API 返回 500 | 页面显示错误状态（文本 "错误/失败/重试"） | ⬜ | style-detection-core |

完成度: 0/10 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | Style Consistency API 何时从 mock 切换到真实分析器？ | @backend-lead | 否（mock 可测试 UI） |
| 2 | 风格档案是否需要支持参数化 config（includeDialogue/includeTone）？ | @backend-lead | 否（当前硬编码） |
| 3 | 代码初筛的异常阈值是否可配置？ | @frontend-lead | 否（当前固定算法） |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 骨架（自动生成） | — |
| 2026-07-23 | v2.0 完整补全：基于源码 + 3 E2E spec | spec-writer-3 |
