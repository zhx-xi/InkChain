# Radar — 功能规格书 (SDD)

**版本**: 2.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `packages/studio/src/pages/RadarView.tsx` + `e2e/radar-view.spec.ts` + `e2e/radar-view-510.spec.ts`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: Radar 页面调用 `/radar/scan` (POST) 发起市场扫描，返回竞品分析和创意建议（含置信度、对标书籍）；同时从 `/radar/history` 加载扫描历史。
> **痛点**: 无扫描进度、无取消机制、无导出/分享。
> **期望状态**: 一键扫描市场趋势，获得结构化推荐列表和历史回顾。
> **成功指标**: 4 个 E2E spec 覆盖空状态、扫描结果、错误处理、历史列表。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **一次扫描获取市场建议** so that **选择高热度题材写作**。【P0】
2. As a **写作者**, I want **查看历史扫描记录** so that **对比多轮分析结果**。【P1】
3. As a **写作者**, I want **看到每条建议的置信度和对标书籍** so that **评估建议可靠性**。【P1】

---

## 1. 模块概述

Radar 是 InkChain 的市场雷达工具。调用 `/radar/scan` 触发 AI 分析当前故事的市场适配度，返回市场摘要和推荐列表；每条推荐含平台、题材、概念、置信度和对标书籍。历史扫描记录可从 `/radar/history` 加载并回溯查看。

---

## 2. 行为合约

### 2.1 API 接口

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/radar/history` | — | `{ items: RadarHistoryItem[] }` | 返回历史扫描列表 |
| POST | `/radar/scan` | — | `RadarResult` | 触发一次市场扫描 |

**请求/响应示例**:
```json
// POST /radar/scan → 200
{ "marketSummary": "Fantasy genre dominates with 60% share...",
  "recommendations": [
    { "confidence": 0.85, "platform": "Web Novel", "genre": "Fantasy",
      "concept": "Rebirth of the Immortal Alchemist",
      "reasoning": "Strong overlap with trending themes",
      "benchmarkTitles": ["Battle Through the Heavens"] }
  ] }

// GET /radar/history → 200
{ "items": [
    { "file": "scan-001.json", "timestamp": "2026-07-08T10:00:00Z",
      "summaryPreview": "Fantasy market analysis", "result": { ... } }
  ] }
```

### 2.2 数据模型

| Schema | 类型 | 字段 | 默认值 / 校验 |
|--------|------|------|--------------|
| `Recommendation` | interface (TypeScript) | confidence: number (0-1), platform: string, genre: string, concept: string, reasoning: string, benchmarkTitles: string[] | 无后端校验 |
| `RadarResult` | interface | marketSummary: string, recommendations: Recommendation[] | 无后端校验 |
| `RadarHistoryItem` | interface | file: string, timestamp: string, summaryPreview: string, result: RadarResult | 无后端校验 |

- 纯前端类型定义，无 core 模型。
- 扫描结果无持久化到 JSON 文件（历史由后端管理）。

### 2.3 状态转换

```
                    ┌── error ──────────────────────────────┐
                    │  POST /scan 500 → 红色错误提示栏         │
                    │  用户可重试 scan                        │
                    ▼                                          │
idle ──→ scanning ──→ scanned
  ▲         │            │
  │         │            ├── 渲染 marketSummary 卡片
  │         │            └── 渲染 recommendations 网格
  │         │                 └── 每条卡片：平台·题材 | 置信度% | 概念 | 推理 | 对标书籍
  │         │
  ├──── historyLoaded ──→ 渲染历史列表（最近 10 条）
  │                        └── 点击历史项 → setResult(item.result) 回看结果
  │
  └──── empty ──→ 虚线占位提示 "暂无扫描数据"
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| Radar → 书籍 | 多对一 | 扫描基于当前书籍上下文，删除书籍不影响历史记录 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 扫描 | POST → 200 → 渲染推荐卡片 | POST → 500 → 红色错误横幅 | 无数据时显示虚线空态提示 | 快速重复点击 → 按钮 disabled 防护 |
| 历史 | GET → 200 → 渲染最近 10 条 | GET 失败 → setHistory([]) 静默 | items=[] → 不渲染历史区块 | 历史数据超 10 条 → 仅显示前 10 |
| 回溯 | 点击历史项 → setResult(item.result) | N/A | N/A | 切换历史时扫描状态保留 |

---

## 4. UI 覆盖

### 4.1 页面

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `RadarView` | `/#/radar`（通过侧边栏"市场雷达"进入） | — | 主页面，含扫描按钮 + 结果卡片 + 历史列表 |

### 4.2 交互流程

```
进入页面 → loadHistory() → 渲染历史列表（若有）
    │
    ▼
点击"市场扫描" → setLoading(true) → POST /radar/scan
    │
    ├── 成功 → setResult(data) → 渲染摘要卡片 + 推荐网格（1-2 列）
    │          → loadHistory() 刷新历史
    └── 失败 → setError(msg) → 红色错误栏
    │
    ▼
历史列表 → 点击历史项 → setResult(item.result) → 回看历史结果
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 扫描按钮 | `role="button"` + name 匹配 "市场扫描" / "Scan" | E2E 点击扫描 |
| 空态提示 | 文字 `radar.emptyHint` | 无数据状态断言 |
| 错误横幅 | 红色 `bg-destructive/10` 容器 | 异常状态断言 |
| 历史项按钮 | 历史列表内按钮 | 点击回看历史结果 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 30s 扫描完成 | E2E waitForTimeout |
| 降级 | 扫描 500 → 红色错误横幅显示 | E2E 验证错误文字存在 |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 扫描进度实时推送 | 当前无 WebSocket，单次 POST 即返回完整结果 |
| 扫描取消 | 无 AbortController；后续迭代考虑 |
| 导出推荐报告 | 非 MVP 范围 |
| 对比多轮扫描 | UI 仅支持单结果视图，历史仅列表展示 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 无历史数据 | 进入雷达页 | 显示"市场雷达"标题；虚线空态提示可见 | ⬜ | radar-view.spec.ts #1 |
| 2 | 点击扫描按钮 | 等待扫描完成 | marketSummary 和推荐卡片渲染 | ⬜ | radar-view.spec.ts #2 |
| 3 | 扫描 API 返回 500 | 点击扫描 | 红色错误横幅显示错误信息 | ⬜ | radar-view.spec.ts #3 |
| 4 | 有历史记录 | 进入雷达页 | 历史列表项渲染 | ⬜ | radar-view.spec.ts #4 |

完成度: 0/4 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | 扫描使用哪个 LLM 模型？降级策略？ | @backend-lead | 否（LLM stub 可模拟） |
| 2 | 历史记录是否有过期清理？ | @backend-lead | 否 |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 骨架（create-spec.py 自动生成） | — |
| 2026-07-23 | v2.0 完整补全：基于 RadarView.tsx + 4 E2E spec | spec-writer-5 |
