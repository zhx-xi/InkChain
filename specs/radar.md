# Radar — 功能规格书 (SDD)

**版本**: 3.1
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `RadarView.tsx` + `server.ts` (L1779-1797, L5502-5530) + `core/src/agents/radar.ts`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: Radar 页面调用 `/radar/scan` 发起 AI 驱动的市场扫描（通过 RadarAgent 抓取番茄小说、起点中文网等平台排行榜数据，LLM 分析后返回推荐），结果含置信度、平台、题材、概念和对标书籍；从 `/radar/history` 加载扫描历史。API 端点在 `server.ts` 中内联。Daemon 通过 `radarCron` 配置定时触发扫描。
> **痛点**: 无扫描进度、无取消机制、无导出/分享。
> **期望状态**: 一键扫描市场趋势，获得结构化推荐列表和历史回顾，覆盖 4 态。
> **成功指标**: 4 个 E2E spec 覆盖空状态、扫描结果、错误处理、历史列表。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **一次扫描获取市场建议** so that **选择高热度题材写作**。【P0】
2. As a **写作者**, I want **查看历史扫描记录** so that **对比多轮分析结果**。【P1】
3. As a **写作者**, I want **看到每条建议的置信度和对标书籍** so that **评估建议可靠性**。【P1】

---

## 1. 模块概述

Radar 是 InkChain 的市场雷达工具。核心架构：

- **RadarAgent** (`packages/core/src/agents/radar.ts`): 从配置的数据源获取排行榜数据，构建 LLM 提示，解析 JSON 响应为 RadarResult。默认使用 FanqieRadarSource + QidianRadarSource。
- **RadarSource** (`packages/core/src/agents/radar-source.ts`): 数据源接口和实现。FanqieRadarSource 调用番茄小说 API（热门榜+黑马榜），QidianRadarSource HTML 抓取起点中文网，TextRadarSource 包装任意文本数据。
- **RadarView** (`packages/studio/src/pages/RadarView.tsx`): 前端页面，显示扫描按钮、市场摘要卡片、推荐网格（含置信度徽章）、历史列表（最近 10 条）。
- **Scheduler** (`packages/core/src/pipeline/scheduler.ts`): 通过 `radarCron` 配置（默认 `"0 */6 * * *"` 每 6 小时）定时触发扫描。

**API 端点**（内联在 `server.ts` 第 1779-1797, 5502-5530 行）:
- `POST /api/v1/radar/scan` — 触发 AI 扫描，通过 SSE 广播 `radar:start` / `radar:complete` / `radar:error`
- `GET /api/v1/radar/history` — 从 `project-root/radar/scan-*.json` 读取并排序

扫描结果通过 `saveRadarScan()` 持久化到 `project-root/radar/` 目录。辅助函数 `radarTimestampForFilename()` 清理时间戳用于文件名。

---

## 2. 行为合约

### 2.1 API 接口

Radar 提供两个 REST 端点，全部在 `server.ts` 中内联实现：

- `POST /api/v1/radar/scan`: 调用 RadarAgent.scan()，通过 SSE 广播进度事件。响应格式：`{ marketSummary: string, recommendations: [...], timestamp: string }`
- `GET /api/v1/radar/history`: 读取 `project-root/radar/` 目录下所有 `scan-*.json` 文件，返回 `{ items: [...] }`（最近扫描优先）

**SSE 事件**: `radar:start`、`radar:complete`、`radar:error`

**请求/响应示例**:
```json
// POST /radar/scan → 200
{
  "marketSummary": "Fantasy genre dominates with 60% share...",
  "recommendations": [{
    "confidence": 0.85, "platform": "Web Novel", "genre": "Fantasy",
    "concept": "Rebirth of the Immortal Alchemist",
    "reasoning": "Strong overlap with trending themes",
    "benchmarkTitles": ["Battle Through the Heavens"]
  }]
}

// GET /radar/history → 200
{
  "items": [{
    "file": "scan-001.json", "timestamp": "2026-07-08T10:00:00Z",
    "summaryPreview": "Fantasy market analysis", "result": { ... }
  }]
}
```

### 2.2 数据模型

**Core 类型**（`packages/core/src/agents/radar.ts`）:

- **RadarResult**: recommendations (RadarRecommendation[]), marketSummary (string), timestamp (string)
- **RadarRecommendation**: platform (string), genre (string), concept (string), confidence (number, 0-1), reasoning (string), benchmarkTitles (string[])

**RadarSource 接口**（`packages/core/src/agents/radar-source.ts`）:

- **RankingEntry**: title, author, category, extra
- **PlatformRankings**: platform (string), entries (RankingEntry[])
- **RadarSource** (interface): name (string), fetch() → Promise\<PlatformRankings\>

具体来源: FanqieRadarSource (番茄小说 API), QidianRadarSource (起点中文网 HTML 抓取), TextRadarSource (任意文本数据)

**前端类型**（RadarView.tsx 内联定义）:

- **Recommendation**: confidence (0-1), platform, genre, concept, reasoning, benchmarkTitles[]
- **RadarResult**: marketSummary, recommendations[]
- **RadarHistoryItem**: file, timestamp, summaryPreview, result

**Daemon 配置**（`project.ts`）: `daemon.schedule.radarCron` 默认 `"0 */6 * * *"`。数据流入: RadarSource → Pipeline.runRadar() → RadarAgent.scan() → LLM → RadarResult。

### 2.3 状态转换

```
idle → scanning → scanned
  ├── 渲染 marketSummary 卡片 + recommendations 网格
  └── 每条推荐: 置信度徽章 | 平台·题材 | 概念 | 推理 | 对标书籍
POST /scan 500 → 红色错误横幅 (bg-destructive/10) → 用户可重试
historyLoaded → 历史列表 (最近 10 条) → 点击历史项回看
empty → 虚线占位提示 (i18n: radar.emptyHint)
```

**置信度徽章颜色**: ≥0.7 → 绿色, 0.4-0.7 → 琥珀色, <0.4 → 暗色

### 2.4 关联约束

- Radar → 书籍: 多对一。删除书籍不影响历史记录
- Radar → Scheduler: 定时触发，radarCron 控制频率
- Radar → RadarSource: 多源聚合 (Fanqie + Qidian 数据合并送 LLM)

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 扫描 | POST 200 → 渲染推荐卡片 + 置信度徽章 | POST 500 → 红色错误横幅 | 空态虚线提示 | loading 时按钮 disabled |
| 历史 | GET 200 → 最近 10 条 | GET 失败 → setHistory([]) 静默 | items=[] → 不渲染 | 超过 10 条仅显示前 10 |
| 回溯 | 点击历史项 → setResult | N/A | N/A | 切换历史时扫描状态保留 |
| SSE | radar:start/complete/error 事件 | SSE 断开不影响已加载结果 | N/A | 事件触发 UI loading 更新 |

---

## 4. UI 覆盖

### 4.1 页面

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `RadarView` | `/#/radar`（侧边栏"市场雷达"） | 无统一前缀 | 扫描按钮 + 结果卡片 + 历史列表 |

**Sidebar 集成**: 导航标签 `nav.radar`（"市场雷达" / "Radar"），图标 `TrendingUp`。

**i18n 键**（`use-i18n.ts` 第 96, 297-307 行）: `nav.radar`, `radar.title`, `radar.scan`, `radar.scanning`, `radar.summary`, `radar.emptyHint`, `radar.history`

### 4.2 交互流程

```
进入页面 → loadHistory() → 渲染历史列表
点击"市场扫描" → setLoading(true) → POST /radar/scan
  ├── 成功 → setResult(data) → 摘要卡片 + 推荐网格 (1-2列)
  │          → loadHistory() 刷新
  └── 失败 → setError(msg) → 红色错误栏
历史列表 → 点击历史项 → setResult(item.result) → 回看
```

### 4.3 关键 data-testid

RadarView 未声明 `data-testid`。E2E 测试通过文本/角色定位：

| 元素 | 选择器 | 用途 |
|------|--------|------|
| 页面标题 | `page.getByText("市场雷达")` | 确认页面已渲染 |
| 扫描按钮 | `page.getByRole("button", { name: /市场扫描\|Scan/ })` | 触发扫描 |
| Loading | `Loader2` 旋转图标 | 验证扫描进行中 |
| 空态提示 | 文字匹配 i18n `radar.emptyHint` | 无数据状态 |
| 错误横幅 | 红色 `bg-destructive/10` 容器 | 异常状态 |
| 历史项按钮 | 历史列表内按钮 | 回看历史 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 30s 扫描完成（含 LLM + 数据抓取） | E2E waitForTimeout |
| 降级 | 扫描 500 → 红色错误横幅 | E2E 验证错误文字存在 |
| 定时调度 | radarCron 默认每 6 小时 | scheduler.test.ts 单元测试 |
| 历史持久化 | 写入 `project-root/radar/scan-*.json` | `saveRadarScan()` 文件写入 |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 扫描进度实时推送 | SSE 仅 start/complete/error，无中间进度 |
| 扫描取消 | 无 AbortController |
| 导出推荐报告 | 非 MVP 范围 |
| 对比多轮扫描 | UI 仅支持单结果视图 |

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
| 1 | 扫描使用哪个 LLM 模型？降级策略？ | @backend-lead | 否 |
| 2 | 历史记录是否有过期清理？ | @backend-lead | 否 |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 骨架（自动生成） | — |
| 2026-07-23 | v2.0 完整补全 | spec-writer-5 |
| 2026-07-25 | v3.0 页面组件对齐；v3.1 移除 API 表格和数据模型表格，改为 prose 格式 | sdd-phase-0-agent |
