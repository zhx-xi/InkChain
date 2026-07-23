# Daemon — 功能规格书 (SDD)

**版本**: 1.0
**创建日期**: 2026-07-23
**对应 Issue**: #N
**状态**: draft | review | approved | implemented

---

## 1. 模块概述

<!-- 一句话描述这个功能做什么，给谁用 -->

## 2. 行为合约

### 2.1 API 接口

| 方法 | 路径 | 输入 Schema | 输出 Schema | 说明 |
|------|------|-------------|-------------|------|
| GET | `/api/v1/xxx` | — | `XxxSchema` | 描述 |

### 2.2 数据模型

| Schema | 类型 | 定义 |
|--------|------|------|
| `RuntimeStateLanguageSchema` | enum | ["zh", "en"] |
| `StateManifestSchema` | object | {
  schemaVersion: z.literal(2 |
| `HookStatusSchema` | enum | ["open", "progressing", "deferred", "resolved"] |
| `HookPayoffTimingSchema` | enum | [
  "immediate",
  "near-term",
  "mid-arc",
  "slow-burn",
  "endgame",
] |
| `HookRecordSchema` | object | {
  hookId: z.string( |
| `HooksStateSchema` | object | {
  hooks: z.array(HookRecordSchema |
| `ChapterSummaryRowSchema` | object | {
  chapter: z.number( |
| `ChapterSummariesStateSchema` | object | {
  rows: z.array(ChapterSummaryRowSchema |
| `CurrentStateFactSchema` | object | {
  subject: z.string( |
| `CurrentStateStateSchema` | object | {
  chapter: z.number( |
| `CurrentStatePatchSchema` | object | {
  currentLocation: z.string( |
| `HookOpsSchema` | object | {
  upsert: z.array(HookRecordSchema |
| `NewHookCandidateSchema` | object | {
  type: z.string( |
| `RuntimeStateDeltaSchema` | object | {
  chapter: z.number( |
| `RuntimeStateLanguageSchema` | enum | zh, en |
| `HookStatusSchema` | enum | open, progressing, deferred, resolved |
| `HookPayoffTimingSchema` | enum | immediate, near-term, mid-arc, slow-burn, endgame,  |

<!-- 引用 core/src/models/ 中的 Zod Schema，标注必填/可选/默认值 -->

### 2.3 状态转换

```
[状态 A] ──(操作 X)──→ [状态 B]
[状态 B] ──(操作 Y)──→ [状态 C]
[任意状态] ──(错误)──→ [错误状态]
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| 角色 → 书籍 | 多对一 | 删除书籍时级联删除角色 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal（正常） | Error（异常） | Empty（空数据） | Edge（边界） |
|------|---------------|---------------|-----------------|-------------|
| 创建 | 表单提交 → 200 → 列表刷新 | 缺少必填 → 400 + 校验提示 | N/A（首次创建即正常） | 同名冲突 → 409 |
| 读取 | 加载列表 → 200 | API 500 → 显示降级 UI | 空列表 → 显示空状态占位 | 大量数据 → 分页/虚拟滚动 |
| 更新 | PATCH → 200 → 数据刷新 | 权限不足 → 403 | 不适用（无数据不可更新） | 并发编辑 → 版本冲突提示 |
| 删除 | DELETE → 204 → 移除列表 | 关联数据存在 → 409 | 不适用 | 批量删除 → 确认对话框 |

---

## 4. UI 覆盖

### 4.1 页面

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `DaemonControl` | | | | / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `XxxPage` | `/#/xxx` | `xxx-` | 主页面 |

### 4.2 交互流程

```
用户点击"创建" → 弹出表单 → 填写 → 提交 → API 调用 → 列表刷新
                                    └→ 校验失败 → 标红提示
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 创建按钮 | `xxx-btn-create` | E2E 定位 |
| 列表容器 | `xxx-list-container` | 空状态/加载状态检测 |
| 错误提示 | `xxx-msg-error` | 异常状态断言 |

---

## 5. 非功能需求

| 维度 | 要求 |
|------|------|
| 响应时间 | < 2s（正常操作）/ < 5s（AI 操作） |
| 并发 | 支持同一书籍的多 tab 操作 |
| 回滚 | 失败时数据恢复至操作前状态 |
| 降级 | AI 不可用时显示"功能暂不可用" |

---

## 6. 验收矩阵

<!-- 以下由 AI Agent 执行验证后打勾 -->

| # | 验收项 | 状态 | 证据 |
|---|--------|------|------|
| 1 | 创建操作正常流程通过 | ⬜ | — |
| 2 | 必填校验正确拦截 | ⬜ | — |
| 3 | 空数据时显示空状态 | ⬜ | — |
| 4 | API 异常时降级 UI 显示 | ⬜ | — |
| 5 | 删除前确认对话框 | ⬜ | — |
| 6 | 级联约束生效 | ⬜ | — |

完成度: 0/6 = 0%

---

## 7. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | 初始版本 | — |
