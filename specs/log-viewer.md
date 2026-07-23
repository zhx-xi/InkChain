# Log Viewer — 功能规格书 (SDD)

**版本**: 2.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `packages/studio/src/pages/LogViewer.tsx` + `e2e/log-viewer.spec.ts` + `e2e/log-viewer-508.spec.ts`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: LogViewer 从 `/logs` API 拉取近期的结构化日志条目，展示时间戳、日志级别、标签和消息内容，支持手动刷新。
> **痛点**: 无级别筛选、无搜索过滤、无自动刷新——适合轻量排查但不够灵活。
> **期望状态**: 快速查看最近日志，按级别颜色区分，一目了然定位错误。
> **成功指标**: E2E spec 覆盖正常渲染、空状态、API 异常、级别颜色 4 个场景通过。

---

## 0a. 用户故事 (User Stories)

1. As a **开发者**, I want **查看最近的系统日志** so that **排查运行时异常**。【P0】
2. As a **维护者**, I want **日志按级别用不同颜色标识** so that **快速找到 error/warn**。【P1】
3. As a **开发者**, I want **API 异常时不白屏** so that **页面保持可操作**。【P0】

---

## 1. 模块概述

LogViewer 是 InkChain 的运行时日志查看器。通过 `/logs` API 获取日志条目，以等宽字体分行展示，每条日志包含时间戳、级别标签、来源 tag 和消息正文。级别按 error/warn/info/debug 四色区分。支持手动刷新按钮。

---

## 2. 行为合约

### 2.1 API 接口

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/logs` | — | `{ entries: LogEntry[] }` | 返回近期日志条目数组 |

**请求/响应示例**:
```json
// GET /logs → 200
{ "entries": [
    { "level": "info", "tag": "system", "message": "Application started",
      "timestamp": "2026-07-09T08:00:00.000Z" },
    { "level": "error", "tag": "daemon", "message": "Connection timeout",
      "timestamp": "2026-07-09T08:02:00.000Z" }
  ] }

// Empty → 200
{ "entries": [] }
```

### 2.2 数据模型

| Schema | 类型 | 字段 | 默认值 / 校验 |
|--------|------|------|--------------|
| `LogEntry` | interface (TypeScript, 无 Zod) | level?: string, tag?: string, message: string, timestamp?: string | message 必填；其余可选 |
| 级别颜色映射 | `LEVEL_COLORS` 常量 | error → text-destructive, warn → text-amber-500, info → text-primary/70, debug → text-muted-foreground/50 | 未知级别回退到 text-muted-foreground |

- 无对应 core 模型；纯前端类型定义。
- 无持久化存储；每次进入/刷新通过 `useApi` hook 获取。

### 2.3 状态转换

```
                    ┌── error ──────────────────────────────┐
                    │  API 500 / 网络超时 → 内容区空白        │
                    │  页面不崩溃，用户可手动 refresh          │
                    ▼                                          │
idle ──→ loading ──→ rendered
  ▲         │           │
  │         │           ├── empty (entries.length === 0) → "暂无日志" 占位
  │         │           └── data (entries.length > 0)  → 分行渲染日志条目
  │         │
  └─────────┴──── refetch() 触发重新查询
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| 日志 → 系统运行时 | 只读流式输出 | 独立于其他模块，无级联 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 读取 | GET → 200 → 按时间/级别/标签/消息分行渲染 | GET → 500 → 内容区空白，页面不崩溃 | entries=[] → "暂无日志" 斜体提示 | 大量日志（>500 条）→ max-h-[600px] + overflow-y-auto |

---

## 4. UI 覆盖

### 4.1 页面

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `LogViewer` | `/#/logs`（通过侧边栏"系统 → 日志"进入） | — | 主页面，含面包屑 + 刷新按钮 + 日志列表 |

### 4.2 交互流程

```
进入页面 → useApi("/logs") 加载
    │
    ▼
数据就绪 → 渲染日志列表
    ├── 每条日志：时间戳 | 级别（大写，色标） | [tag] | 消息
    └── 空数据：显示"暂无日志"斜体占位
    │
    ▼
点击"刷新" → refetch() → 重新拉取
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 刷新按钮 | 按钮文字 `common.refresh` | 重新加载日志 |
| 空状态提示 | 文字 `logs.empty` | 日志为空时断言 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 1s 日志加载 | E2E timeout 断言 |
| 降级 | API 500 → 页面不崩溃 | E2E 验证 bodyText.length > 0 |
| 浏览器兼容 | Chrome / Firefox / Edge 最新两个大版本 | CI matrix |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 级别筛选（只看 error） | 当前为轻量查看器，完整过滤留待后续迭代 |
| 全文搜索 | 日志量有限，浏览器 ctrl+f 已满足基本需求 |
| 自动刷新 / WebSocket 推送 | 按需手动刷新已足够诊断使用 |
| 日志导出下载 | 非核心需求，运维场景不在此模块范围 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 系统有近期日志 | 进入日志页 | 标题"日志"可见；日志消息原文渲染 | ⬜ | log-viewer.spec.ts #1 |
| 2 | 系统无日志 | 进入日志页 | 显示"暂无日志"空状态 | ⬜ | log-viewer.spec.ts #2 |
| 3 | API 返回 500 | 进入日志页 | 页面不崩溃，bodyText 非空 | ⬜ | log-viewer.spec.ts #3 |
| 4 | 日志含多种级别 | 进入日志页 | INFO/WARN/ERROR/DEBUG 标签均可见 | ⬜ | log-viewer.spec.ts #4 |

完成度: 0/4 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | 是否需要分页 / 按时间范围过滤？ | @frontend-lead | 否 |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 骨架（create-spec.py 自动生成） | — |
| 2026-07-23 | v2.0 完整补全：基于 LogViewer.tsx + 4 E2E spec | spec-writer-5 |
