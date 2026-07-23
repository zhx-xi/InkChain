# 章节审计 — 功能规格书 (SDD)

**版本**: 1.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `api/routes/audit.ts` + `models/book.ts` + `AuditPage.tsx`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: 审计模块提供章节审计 Dashboard，支持单章审计、批量审计、批准、重新审计、一键修复，以及卷筛选和分页。使用基于规则(rule)和AI模式双通道审计，结果带内容哈希缓存。
> **痛点**: (1) 批量审计无进度反馈，用户不知道整体进度；(2) 规则审计结果随机（mock），缺乏确定性；(3) 一键修复仅追加注释到章节末尾而非内联修正；(4) 审计模式切换不直观。
> **期望状态**: 批量审计显示进度条和各章结果；规则审计基于真实规则引擎；一键修复内联替换问题文本；模式选择器明确标注优劣。
> **成功指标**: 8 个 E2E spec 全部通过（audit-page-core / audit-ai-verification / audit-cache / audit-context-popup / audit-context / audit-fix-button / audit-status-update / audit-volumes）。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **查看所有章节的审计状态一览** so that **知道哪些章节需要润色**。【P0】
2. As a **写作者**, I want **对某一章触发审计并查看问题列表** so that **针对性地修复剧情矛盾/语法/风格问题**。【P0】
3. As a **写作者**, I want **一键修复审计问题** so that **快速迭代修正而不需要逐条手动操作**。【P1】
4. As a **写作者**, I want **按卷筛选审计状态** so that **聚焦当前分卷的写作质量**。【P1】
5. As a **写作者**, I want **批准审计结果标记"已审核"** so that **追踪哪些问题已处理**。【P2】
6. As a **维护者**, I want **缓存机制避免重复审计未修改章节** so that **节省计算资源**。【P1】

---

## 1. 模块概述

章节审计是 InkChain 中**检查章节内容质量**的工具。对每章进行规则(runMockAudit)或 AI 深度审计，输出 issue 列表（continuity/logic/character/style/pacing/grammar/other），带严重程度(info/warning/error)。结果持久化到 `.inkos/books/<id>/audit/chapter-<N>.json`，通过 SHA-256 内容哈希实现缓存验签。支持批量审计、批准、重新审计、一键修复。

---

## 2. 行为合约

### 2.1 API 接口

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/:bookId/audit` | — | `{ chapters: [...], summary: { totalChapters, auditedChapters, passedChapters, warnChapters, failedChapters } }` | 获取所有章节审计状态+汇总 |
| POST | `/:bookId/chapters/:chapterNumber/audit` | query `mode` (rule/ai) | `{ audit: ChapterAuditResult }` | 触发单章审计（含缓存检测） |
| POST | `/:bookId/chapters/:chapterNumber/audit/approve` | — | `{ audit: ChapterAuditResult }` | 批准审计结果（status→approved） |
| POST | `/:bookId/chapters/:chapterNumber/audit/reaudit` | query `mode` (rule/ai) | `{ audit: ChapterAuditResult }` | 重新审计（含缓存检测） |
| POST | `/:bookId/chapters/audit/batch` | `{ chapterNumbers: number[] }` | `{ batchSize, totalRequested, skipped, results: [{chapterNumber, status}] }` | 批量审计 |
| POST | `/:bookId/chapters/:chapterNumber/audit/fix` | — | `{ chapterNumber, suggestions, originalContent(前500字) }` | 获取修复建议 |
| POST | `/:bookId/chapters/:chapterNumber/audit/fix/apply` | `{ suggestions: [...] }` | `{ chapterNumber, message, fixCount }` | 应用修复到章节文件 |

**请求/响应示例**:
```json
// GET /:bookId/audit → 200
{ "chapters": [
    { "chapterNumber": 1, "title": "第1章", "status": "pass", "issues": [], "lastAuditedAt": "2026-07-23T12:00:00Z", "approvedAt": null },
    { "chapterNumber": 2, "title": "第2章", "status": "warn", "issues": [...], "lastAuditedAt": "..." }
  ],
  "summary": { "totalChapters": 10, "auditedChapters": 5, "passedChapters": 3, "warnChapters": 1, "failedChapters": 1 } }

// POST /:bookId/chapters/audit/batch → Request
{ "chapterNumbers": [1, 2, 3] }
// → 200
{ "batchSize": 3, "totalRequested": 3, "skipped": 0, "results": [
    { "chapterNumber": 1, "status": "pass" },
    { "chapterNumber": 2, "status": "warn" },
    { "chapterNumber": 3, "status": "fail" }
  ] }
```

### 2.2 数据模型

| Schema | 类型 | 必填字段 | 可选字段 | 默认值 / 校验 |
|--------|------|----------|---------|--------------|
| `AuditIssue` | interface | type(continuity/logic/character/style/pacing/grammar/other), severity(info/warning/error), description, chapterNumber | location | — |
| `ChapterAuditResult` | interface | chapterNumber, status(pending/pass/warn/fail/approved), issues[] | lastAuditedAt, approvedAt, contentHash(SHA-256), mode(rule/ai) | status 默认 pending |
| `AuditStatus` | union | pending / pass / warn / fail / approved | — | pending=未审计; pass=通过; warn=有警告; fail=错误; approved=已批准 |
| `AuditMode` | union | rule / ai | — | rule: 规则审计(快); ai: AI 深度审计(慢) |

章节内容哈希: `createHash("sha256").update(chapterContent, "utf-8").digest("hex")` — 用于缓存验签。

### 2.3 状态转换

#### UI 状态机

```
                    ┌── error ──────────────────────────────────┐
                    │  API 500 / 网络超时 → au-state-error 可见   │
                    │  重试 → refetch dashboard                  │
                    ▼                                             │
idle ──→ loading ──→ rendered                                   │
  ▲         │           │                                        │
  │         │           ├── empty (无章节/chapters.length===0)   │
  │         │           │     → au-state-empty 可见              │
  │         │           └── data (有章节)                        │
  │         │                → 章节表格 + 状态色标 + 摘要行       │
  └─────────┴──── refetch / 卷筛选 / 分页切换                    │
```

**守卫条件**:
- `rendered` → `批量审计进行中`: 仅当 POST batch 返回 200 → 进度轮询
- `rendered` → `修复预览弹窗`: 仅当点击"一键修复" + fix API 返回 suggestions
- `rendered` → `AI 审计确认`: 仅当 mode=ai 且有 LLM 成本估算

#### 数据状态机（审计生命周期）

```
                    POST /audit (200)
未审计(pending) ────────────────────────────→ pass / warn / fail
                                                  │
                          POST /audit/approve     │
pass / warn / fail ────────────────────────────→ approved (已批准)
                                                  │
                          POST /audit/reaudit    │
approved ───────────────────────────────────────→ pass / warn / fail (重新审计)
                                                  │
                     POST /audit/fix/apply       │
warn / fail ────────────────────────────────────→ approved (修复后自动批准)

缓存判断: rule 模式 + 内容哈希未变 + 已有缓存 → 返回 cached:true
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| 审计 → 书籍 | 多对一 | 删除书籍 → audit/ 目录级联删除 |
| 审计 → 章节 | 一对一 | 删除章节 → 对应 chapter-N.json 变为孤儿（不自动清理） |
| 审计缓存 → 章节内容 | 通过 SHA-256 哈希 | 内容变更后缓存自动失效 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 触发审计 | POST → 200 → 章节状态更新→pass/warn/fail | INVALID_CHAPTER_NUMBER → 400 / CHAPTER_NOT_FOUND → 404 | 无章节 → 不显示审计入口 | 并发审计同一章→后一次覆盖前一次 |
| 获取概览 | GET → 200 → 渲染状态表格+汇总 | API 500 → au-state-error | 无章节→au-empty-state "暂无可审计章节" | 100+章节 → 分页显示 |
| 批准 | POST approve → 200 → status→approved | AUDIT_NOT_FOUND → 404（需先审计） | N/A | 批准未审计章节 → 404 error |
| 批量审计 | POST batch → 200 → 各章异步审计+缓存 | CHAPTERS_NOT_FOUND → 404 / VALIDATION_ERROR → 400 | N/A | 100+章节批量审计 → 进度条/mock 耗时 |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `AuditPage` | `/#/audit/:bookId` | `au-` | 主页面，含章节审计状态表格 + 工具栏 |
| `BatchAuditPanel` | 内嵌 | — | 批量审计进度面板 |
| `FixPreviewDialog` | Dialog | — | 修复建议预览 + 选择性应用 |
| `ModeSelector` | Select | — | 审计模式选择(rule/ai) |

### 4.2 交互流程

```
进入审计 → 加载章节索引+审计结果 → 渲染状态表格 → 显示摘要统计
┌─ 工具栏 ──────────────────────────────────────────────┐
│ [批量审计] [模式: rule↓/ai↓] [卷筛选▼] [分页控件]      │
└───────────────────────────────────────────────────────┘
章节行: [章节号] [标题] [状态色标: pending灰/pass绿/warn黄/fail红/approved蓝] [审计时间] [操作: 审计/批准/重审计/一键修复]
点击"审计" → 触发单章审计 → spinner → 更新状态色标
点击"批量审计" → 选择章节范围 → 确认 → 进度面板 → 批量结果
点击"一键修复" → 加载修复建议 → 修复预览弹窗 → 选择修复项 → "应用修复" → 章节文件更新
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 批量审计按钮 | `au-batch-audit-btn` / `au-btn-batch-audit` | 批量审计入口 |
| 审计模式选择 | 基于 `data-testid*='mode'` | 选择 rule/ai |
| 卷筛选 | 基于 `data-testid*='volume'` | 卷筛选下拉 |
| 修复按钮 | `au-auto-fix-btn` / `au-btn-apply-fix` | 一键修复入口 |
| 加载状态 | `au-loading-spinner` / `au-state-loading` | 加载中 |
| 错误状态 | `au-error-state` / `au-state-error` | API 异常 |
| 空状态 | `au-empty-state` / `au-state-empty` | 无章节时 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 1s 获取审计概览(100章内)；p95 < 5s 单章 rule 审计；p95 < 30s AI 审计 | Playwright E2E timeout |
| 并发 | 同一书籍多 tab 各自独立 audit state | 手动验证 |
| 缓存 | contentHash 不变 + mode=rule → 返回缓存结果(不重新审计) | E2E audit-cache |
| 回滚 | 审计结果写入独立 JSON 文件，失败不影响章节原文件 | 单元测试 mock 写入失败 |
| 浏览器兼容 | Chrome / Firefox / Edge 最新两个大版本 | CI matrix |
| 无障碍 | WCAG 2.1 AA — 表格可键盘导航 | axe-core 扫描 |
| 存储 | 每章审计结果 < 10KB；100章 < 1MB | 文件大小监控 |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 自动修复生成（真正 AI 内联替换） | 当前 mock 仅追加注释；真实 AI patch 需要后续迭代 |
| 审计历史对比（before/after diff） | 当前仅保存最新结果，无版本对比 |
| 自定义审计规则配置 | 规则引擎尚未抽象为用户可配置 |
| 章节间交叉关联审计（跨章剧情矛盾检测） | 当前单章独立审计，不对比前后章 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 审计 Dashboard 已加载 | 查看章节列表 | 每章显示状态色标(pending/pass/warn/fail/approved)；汇总统计显示总数/已审计/通过/警告/失败 | ⬜ | audit-page-core |
| 2 | 选择 AI 审计模式 | 触发单章 AI 审计 | 审计结果包含 AI-specific issue（与 rule 不同） | ⬜ | audit-ai-verification |
| 3 | 章内容未修改 | 触发 rule 审计 | 返回缓存结果 (cached:true)；不重复审计 | ⬜ | audit-cache |
| 4 | 点击章节行的上下文信息 | 弹出审计详情 Panel | 显示该章所有 issue 列表（类型/严重度/描述/位置） | ⬜ | audit-context-popup |
| 5 | 审计 Dashboard 已加载 | Hover 章节行 | 显示上下文摘要信息 | ⬜ | audit-context |
| 6 | 章节有 warn/fail issue 列表 | 点击"一键修复" | 加载修复建议 → 修复预览弹窗 → 应用修复 → 章节状态更新为 approved | ⬜ | audit-fix-button |
| 7 | 批准已审计章节 | 点击"批准" | status 从 warn/fail → approved | ⬜ | audit-status-update |
| 8 | 有多个卷 | 选择卷筛选 | 仅显示该卷章节的审计状态；其他卷章节隐藏 | ⬜ | audit-volumes |

完成度: 0/8 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | AI 审计模式接入真实 LLM 还是保留 mock stub？降级策略是什么？ | @backend-lead | 否（当前 runMockAudit 可独立运行） |
| 2 | 一键修复(fix/apply)是否需要支持用户自定义编辑替换文本？当前仅 mock 追加注释 | @frontend-lead | 是（修复质量取决于 AI 能力） |
| 3 | 批量审计是否应并发执行(多章同时)还是串行？当前 mock 同步返回，真实环境需考虑并发 | @backend-lead | 否（mock 串行即可） |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 初始版本，基于 API/Model/E2E 代码 | spec-writer-1 |
