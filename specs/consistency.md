# 一致性检查 — 功能规格书 (SDD)

**版本**: 2.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `api/routes/consistency.ts` + `ConsistencyCheck.tsx` + `ConsistencyPanel.tsx`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: 一致性检查包含两个独立维度：(1) 叙事一致性检查（AI 驱动）检测角色矛盾/关系断裂/设定冲突/时间线悖论；(2) 文风统一检测（本地算法）对比基线章节分析词汇分布/句式长度/对话比例/修饰语密度。
> **痛点**: (1) 两个检查面板各走不同 API 和本地 mock 降级策略，缺乏统一的入口和错误处理；(2) 叙事一致性检查依赖完整章节文本，空章节时无兜底表现；(3) 文风检测 API 不可用时降级到 mock 数据，用户无法区分真假结果。
> **期望状态**: 两个一致性检查面板可独立运行，各自覆盖 Normal/Error/Empty/Edge 四态；API 失败时明确告知用户；空数据时展示合理的占位 UI。
> **成功指标**: consistency-check-panel（4 个 E2E）+ cross-feature（4 个 E2E）全部通过。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **AI 自动扫描章节发现角色矛盾/设定冲突** so that **避免读者吐槽前后不一**。【P0】
2. As a **写作者**, I want **按类型和严重程度筛选检查结果** so that **优先处理高优先级问题**。【P0】
3. As a **写作者**, I want **核查文风是否偏离基线** so that **长篇连载文风保持统一**。【P1】
4. As a **写作者**, I want **忽略或确认每个检查结果** so that **管理待处理列表**。【P1】
5. As a **维护者**, I want **API 不可用时 Mock 数据可用但给出提示** so that **功能不因 AI 依赖完全不可用**。【P1】

---

## 1. 模块概述

一致性检查是 InkChain 的叙事质量保障工具。分为两个子模块：

- **叙事一致性检查** (`ConsistencyCheck`)：AI 驱动，扫描章节文本，检测四种类型的问题——角色矛盾（角色之间）、关系断裂（关系边）、设定冲突（世界观设定）、时间线悖论（时间线事件）。每个问题含严重程度（high/medium/low）、描述、来源位置、修复建议。
- **文风统一检测** (`ConsistencyPanel`)：本地算法为主、API 为辅，比较当前章节与基线的词汇分布、句式长度、对话比例、修饰语密度四个维度。支持灵敏度调节（低/中/高三档）。

两者均内嵌在书籍工作区中，路由为 `/#/consistency/:bookId` 和 `/#/style/:bookId`。

---

## 2. 行为合约

### 2.1 API 接口

#### 叙事一致性 — POST /api/consistency/check

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| POST | `/api/consistency/check` | `{ worldId?, chapter: { id, title, text, characters }, characterProfiles?, previousChapters? }` | `{ report: { issues, summary, score } }` | 运行一致性扫描 |

**请求/响应示例**:
```json
// Request Body
{
  "chapter": { "id": "ch-1", "title": "第一章", "text": "...", "characters": [] },
  "characterProfiles": [],
  "previousChapters": []
}
// → 200 OK
{ "report": { "issues": [...], "summary": "...", "score": 85 } }

// Error → 400 Bad Request (NO_CHAPTER)
{ "error": { "code": "NO_CHAPTER", "message": "Chapter with text is required" } }

// Error → 400 Bad Request (INVALID_JSON)
{ "error": { "code": "INVALID_JSON", "message": "Request body must be valid JSON" } }

// Error → 404 Not Found (WORLD_NOT_FOUND)
{ "error": { "code": "WORLD_NOT_FOUND", "message": "World not found: xxx" } }
```

#### 文风检测 — POST /api/style-consistency/analyze

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| POST | `/api/style-consistency/analyze` | `{ sensitivity: number }` | `{ result: StyleConsistencyResult }` | 文风一致性分析 |

### 2.2 数据模型

| Schema | 类型 | 必填字段 | 可选字段 | 默认值 / 校验 |
|--------|------|----------|---------|--------------|
| `ConsistencyIssue` | object | type (IssueType), severity (IssueSeverity), description, sources[] | suggestion | sources 字符串数组；type ∈ {character_contradiction, relationship_break, setting_conflict, timeline_paradox} |
| `IssueSeverity` | enum | high / medium / low | — | high="必须修复", medium="建议关注", low="提示" |
| `IssueType` | enum | character_contradiction / relationship_break / setting_conflict / timeline_paradox | — | character_contradiction="角色矛盾", relationship_break="关系断裂", setting_conflict="设定冲突", timeline_paradox="时间线悖论" |
| `ConsistencyReport` | object | issues[], summary, score (0-100) | — | score 100 表示无问题 |
| `StyleConsistencyDimension` | object | name, label, score (0-100), status (ok/warn/good), note | — | 四个维度: vocabulary, sentence-length, dialogue-ratio, modifier-density |
| `StyleAnomaly` | object | index, tag (length/modifier/dialogue), tagLabel, paragraphIndex, description, quote, detail, diffPercent, ignored | — | tag 决定标签颜色：length=rose, modifier=amber, dialogue=emerald |
| `StyleConsistencyResult` | object | score (0-100), dimensions[], anomalies[], baselineLabel, targetLabel, sensitivity (0-2) | — | sensitivity 0=低/1=中/2=高；阈值分别为 0.25/0.15/0.08 |
| `IssueStatus` (UI only) | enum | pending / confirmed / ignored | — | 本地不持久化，刷新后恢复 pending |

### 2.3 状态转换

#### 叙事一致性 UI 状态机

```
                    ┌── error ─────────────────────────────────┐
                    │  API 500 / 网络超时 → 红色 AlertBanner    │
                    │  retry → runCheck() → loading              │
                    ▼                                             │
idle ──→ loading ──→ rendered                                   │
  ▲         │           │                                        │
  │         │           ├── empty (issues.length === 0)           │
  │         │           │     → "未发现一致性问题" 占位图          │
  │         │           └── data (issues.length > 0)              │
  │         │                → StatCard 统计 + IssueCard 列表      │
  └─────────┴──── runCheck() / setTimeout auto-refresh            │
```

**守卫条件**:
- `rendered` → `FloatNotif 可见`: 仅当 `pendingCount > 0`
- `rendered` → `IssueCard 已确认`: 确认后 disable，显示 `line-through`
- `rendered` → `IssueCard 已忽略`: 忽略后 disable + grayscale

#### 文风检测 UI 状态机

```
                    ┌── error ─────────────────────────────────┐
                    │  API 失败 → 降级到 Mock 数据               │
                    │  (catch 块自动 fallback，不显示 error UI)   │
                    ▼                                             │
idle ──→ loading ──→ rendered                                   │
  ▲         │           │                                        │
  │         │           ├── RingGauge (score + gauge arc)         │
  │         │           ├── DimensionBar × 4                      │
  │         │           ├── AnomalyItem list                      │
  │         │           └── SensitivitySlider                     │
  └─────────┴──── handleAnalyze() / sensitivity 变化              │
```

**守卫条件**:
- `AnomalyItem.ignored`: toggle 后 opacity 降低 + line-through
- `SensitivitySlider`: 拖动后立即触发 `runAnalysis(newVal)`
- `ignoredSet 重置`: sensitivity 变化或 handleResetAll 时清空

#### Issue 处理生命周期（仅对叙事检查）

```
扫描完成 ──→ 新建 (pending)
                  │
     确认──→ 已确认 (confirmed)  不可逆，操作按钮 disable
     忽略──→ 已忽略 (ignored)    不可逆，操作按钮 disable
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| 一致性检查 → 书籍 | 多对一 | 删除书籍 → 检查结果消失（内存中，不持久化） |
| 一致性检查 → 世界设定 | 多对一 | worldId 可选，无世界时使用空世界模拟 |
| 文风检测 → 书籍 | 多对一 | 基线基于已写完的章节自动计算 |

---

## 3. 状态矩阵（4 态覆盖）

### 叙事一致性检查

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 扫描 | POST → 200 → StatCard 显示统计 + IssueCard 列表渲染 | INVALID_JSON → 400 / NO_CHAPTER → 400 / API 500 → 红色 error banner + 重试按钮 | 无问题发现 → "未发现一致性问题" 占位 | worldId 指向不存在的世界 → WORLDBOUND |
| 筛选 | categoryFilter + severityFilter → 内存过滤 results | N/A | 筛选后无匹配 → "暂无匹配问题"（与 Empty 态区分） | 全部确认/忽略后 pendingCount=0 → FloatNotif 隐藏 |
| 确认 | 标记 confirmed → UI line-through | N/A | N/A | 已确认再点击无效果（disable guard） |
| 忽略 | 标记 ignored → opacity + grayscale | N/A | N/A | 已忽略再点击无效果（disable guard） |

### 文风统一检测

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 初始化 | POST → 200 → RingGauge + DimensionBars | API 失败 → catch 降级到 generateMockData(sensitivity) | 无结果 → "点击「分析」按钮开始" 占位 | 首次加载 → 自动 runAnalysis |
| 灵敏度 | 拖动 → runAnalysis(newVal) → 结果更新 | N/A | N/A | 灵敏度变化 → ignoredSet 自动清空 |
| 忽略异常 | toggle → AnomalyItem 样式变化 + 计数更新 | N/A | anomalies 为空 → "未发现异常段落" | 全部忽略后 → activeAnomalyCount=0 |
| 重置 | handleResetAll → ignoredSet 清空 | N/A | N/A | N/A |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `ConsistencyCheck` | `/#/consistency/:bookId` | 无统一前缀（内联组件） | 叙事一致性检查主页，含 StatCard + 筛选栏 + IssueCard 列表 + FloatNotif |
| `ConsistencyPanel` | `/#/style/:bookId` | 无统一前缀（内联组件） | 文风统一检测页，含 RingGauge + DimensionBars + AnomalyList + SensitivitySlider |

### 4.2 交互流程

```
叙事一致性:
进入页面 → 自动 runCheck() → loading spinner → 渲染结果
┌─ Header ──────────────────────────────────────┐
│ 叙事一致性检查 · 评分 {score}/100   [扫描按钮]  │
└───────────────────────────────────────────────┘
┌─ StatCards (4 列) ────────────────────────────┐
│ 总问题 | 待处理 | 已确认 | 已忽略              │
└───────────────────────────────────────────────┘
┌─ FilterBar ───────────────────────────────────┐
│ 分类: [全部|角色矛盾|关系断裂|设定冲突|时间线悖论] │
│ 严重程度: [全部|必须修复|建议关注|提示]          │
└───────────────────────────────────────────────┘
┌─ IssueCard List ──────────────────────────────┐
│ 每个卡片: severity 左边栏 + 描述 + tags + 建议  │
│ 操作: [确认修复] [忽略] [定位到章节]            │
└───────────────────────────────────────────────┘

文风检测:
进入页面 → 自动 runAnalysis() → loading → RingGauge + 各维度
┌─ Breadcrumb ──────────────────────────────────┐
│ 首页 / 文风检测 / 文风统一检测                  │
└───────────────────────────────────────────────┘
┌─ 1. RingGauge (评分 0-100, 渐变弧线) ─────────┐
┌─ 2. DimensionBars × 4 (词汇/句式/对话/修饰) ───┐
┌─ 3. AnomalyList (每段异常 + 标签 + 差异度) ────┐
┌─ 4. SensitivitySlider (低/中/高, 阈值展示) ────┐
┌─ Footer ──────────────────────────────────────┐
│ [恢复全部忽略] [重新检测]                       │
└───────────────────────────────────────────────┘
```

### 4.3 关键 data-testid

叙事一致性检查页面无显式 `data-testid` 声明——E2E 测试通过页面内容文本断言 (`bodyText.length > 0`, `pageErrors.length === 0`)。以下是代码中出现的语义选择器：

| 元素 | 选择器 | 用途 |
|------|--------|------|
| 页面 heading | `h2:has-text("叙事一致性检查")` | 确认页面已渲染 |
| 扫描按钮 | `button[title="重新扫描"]` | 手动触发重扫 |
| 重试按钮 | `button:has-text("重试")` | error 状态下的恢复入口 |
| 分类筛选 | `select:has(option:has-text("全部"))` | 按类型过滤 |
| 严重程度按钮组 | `button:has-text("必须修复")`, `button:has-text("建议关注")`, `button:has-text("提示")` | 按严重程度过滤 |
| 确认按钮 | `button:has-text("确认修复")` / `button:has-text("已确认")` | 确认单个 issue |
| 忽略按钮 | `button:has-text("忽略")` / `button:has-text("已忽略")` | 忽略单个 issue |
| 浮动通知 | `button.font-sans` (fixed 定位) | 待处理问题浮窗 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 3s 扫描完成；p99 < 10s | Playwright E2E `waitForTimeout` + 页面内容断言 |
| 降级 | 文风检测 API 失败 → 静默降级到 Mock 数据 | Mock 数据覆盖三个灵敏度档位 |
| 降级 | 叙事检查 API 失败 → 显示 error banner + retry | IEES 内联断言 |
| 内存 | 单个检查结果列表 <100 条 → 无分页需求 | 手动验证 |
| 浏览器兼容 | Chrome / Firefox / Edge 最新两个大版本 | CI matrix |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 自动修复一致性问题 | AI 不建议直接修改，需人工判断 |
| 跨书籍一致性比较 | 单书籍工具，跨书籍对比属于另一功能 |
| 实时检查（输入即扫描） | 扫描需完整章节文本，按需触发合适 |
| 文风检测结果持久化 | 每次重新分析，无历史对比需求 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 已存在书籍有章节 | 导航到 `/#/consistency/:bookId` | 页面不崩溃，body 有内容 | ⬜ | consistency-check-panel #1 |
| 2 | 传入不存在的 bookId | 导航到 `/#/consistency/invalid` | 页面不崩溃 | ⬜ | consistency-check-panel #2 |
| 3 | 从其他页面跳转 | 先访问 /book/:id/settings 再跳转 | 页面不崩溃，body 有内容 | ⬜ | consistency-check-panel #3 |
| 4 | 书籍无章节数据 | 导航到空书籍一致性检查页 | 页面不崩溃 | ⬜ | consistency-check-panel #4 |
| 5 | 跨功能流：章节→图谱→伏笔→时间线 | 顺序访问各模块 | 所有页面正常加载，数据不混淆 | ⬜ | cross-feature X1 |
| 6 | 两本书存在 | 依次访问 Book-A → Book-B 各模块 | Book-B 不泄露 Book-A 数据（角色/伏笔/时间线） | ⬜ | cross-feature X2 |
| 7 | 会话中提及角色名 | 再跳转到关系图谱 | 图谱正常加载无 JS 错误 | ⬜ | cross-feature X3 |
| 8 | 所有面板/弹窗 | 扫描各页面 DOM | 可见面板 `top >= 0`（不越界） | ⬜ | cross-feature X4 |
| 9 | 文风检测 API 故障 | 调用 /api/style-consistency/analyze | 降级到 Mock 数据，得分/维度/异常 均正常渲染 | ⬜ | — |

完成度: 0/9 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | 叙事一致性检查是否应增加 data-testid 以改善 E2E 可测性？当前完全依赖 `bodyText` 断言 | @frontend-lead | 否 |
| 2 | 一致性检查问题是否需要持久化到文件（类似 relations.json）？当前仅内存存储 | @backend-lead | 否 |
| 3 | 文风检测 Mock 降级数据是否需要版本控制？当前硬编码三组数据 | @frontend-lead | 否 |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 骨架（自动生成） | — |
| 2026-07-23 | v2.0 完整补全：基于 API + 页面代码 + E2E spec | spec-writer-4 |
