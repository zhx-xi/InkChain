# Doctor — 功能规格书 (SDD)

**版本**: 2.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `packages/studio/src/pages/DoctorView.tsx` + `e2e/doctor-view.spec.ts`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: Doctor 页面调用 `/doctor` API 检测系统健康状态（5 项检查 + 书籍计数），显示通过/失败列表和汇总结论。
> **痛点**: 无手动修复引导，失败项仅有状态提示无操作入口。
> **期望状态**: 明确列出所有检查项状态，提供"重新检查"按钮，汇总结论清晰可读。
> **成功指标**: 4 个 E2E spec 全部通过（doctor-view.spec.ts）。

---

## 0a. 用户故事 (User Stories)

1. As a **维护者**, I want **一键查看所有系统健康状态** so that **快速定位配置问题**。【P0】
2. As a **维护者**, I want **重新执行检查** so that **修复配置后立即验证**。【P1】
3. As a **开发者**, I want **API 异常时不白屏** so that **页面保持可操作**。【P0】

---

## 1. 模块概述

Doctor 是 InkChain 的系统诊断工具，通过 `/doctor` API 查询 5 项核心健康指标，以对号/叉号图标清晰展示每项结果，下方汇总通过/失败结论。

---

## 2. 行为合约

### 2.1 API 接口

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/doctor` | — | `DoctorChecks` (JSON) | 返回 5 项检查布尔值 + bookCount |

**请求/响应示例**:
```json
// GET /doctor → 200 OK
{ "inkosJson": true, "projectEnv": true, "globalEnv": false,
  "booksDir": true, "llmConnected": false, "bookCount": 3 }

// Error → 500
{ "error": "Internal error" }
```

### 2.2 数据模型

| Schema | 类型 | 字段 | 说明 |
|--------|------|------|------|
| `DoctorChecks` | interface (TypeScript, 无 Zod) | inkosJson: boolean, projectEnv: boolean, globalEnv: boolean, booksDir: boolean, llmConnected: boolean, bookCount: number | 前端类型定义，无对应 core 模型 |

- 所有字段均为只读，由后端 `/doctor` 端点一次性返回。
- 无持久化存储；每次进入页面通过 `useApi` hook 获取。

### 2.3 状态转换

```
                    ┌── error ──────────────────────────────┐
                    │  API 500 / 网络超时 → Loader2 持续旋转   │
                    │  用户可手动 retry (refetch)              │
                    ▼                                          │
idle ──→ loading ──→ rendered
  ▲         │           │
  │         │           ├── allPassed (全部 5 项 true) → 绿色汇总
  │         │           └── someFailed (任一 false)    → 橙色汇总
  │         │
  └─────────┴──── refetch() 触发重新查询
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| Doctor → 系统配置 | 只读查询 | 无级联，仅反映当前运行时状态 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 读取 | GET → 200 → 5 项逐行渲染 check/x 图标 | GET → 500 → Loader2 持续显示，页面不崩溃 | N/A（必有返回，至少含默认值） | 快速连续点击"重新检查" → refetch 队列 |

---

## 4. UI 覆盖

### 4.1 页面

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `DoctorView` | `/#/doctor`（通过侧边栏"诊断"进入） | — | 主页面，含面包屑 + 检查列表 + 汇总 |

### 4.2 交互流程

```
进入页面 → useApi("/doctor") 加载 → 显示 Loader2 旋转
    │
    ▼
数据就绪 → 渲染 5 行 CheckRow（每行 CheckCircle2 / XCircle + 标签 + 可选详情）
    │
    ├── 全部通过 → 绿色汇总 "所有检查通过"
    └── 部分失败 → 橙色汇总 "部分检查未通过"
    │
    ▼
点击"重新检查" → refetch() → 重新加载
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 加载指示器 | `rg-loading`（通过 Loader2 动画识别） | 加载中状态断言 |
| 重新检查按钮 | 按钮文字 `doctor.recheck` | 重新执行检查 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 1s 检查结果加载 | E2E `waitForTimeout` 超时 |
| 降级 | API 500 → Loader2 持续显示，页面不崩溃 | E2E 验证 bodyText.length > 0 |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 手动修复引导 | doctor 仅诊断不修复；实际操作在其他设置页完成 |
| 检查历史记录 | 一次性诊断工具，无需版本历史 |
| 实时健康监控 | 非监控面板，按需检查即可 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 系统全部健康 | 进入 doctor 页 | 5 行全部绿色对号；汇总显示"所有检查通过" | ⬜ | doctor-view.spec.ts #1 |
| 2 | 部分检查项失败 | 进入 doctor 页 | 失败行显示红色叉号；汇总显示"部分检查未通过" | ⬜ | doctor-view.spec.ts #2 |
| 3 | 修复配置后 | 点击"重新检查" | refetch() 调用，检查结果刷新 | ⬜ | doctor-view.spec.ts #3 |
| 4 | API 返回 500 | 进入 doctor 页 | Loader2 持续显示，页面不崩溃 | ⬜ | doctor-view.spec.ts #4 |

完成度: 0/4 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | 是否需要导出检查报告（JSON/文本）？ | @frontend-lead | 否 |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 骨架（create-spec.py 自动生成） | — |
| 2026-07-23 | v2.0 完整补全：基于 DoctorView.tsx + 4 E2E spec | spec-writer-5 |
