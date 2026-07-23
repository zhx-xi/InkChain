# InkChain SDD 规格文件索引

**生成日期**: 2026-07-23
**规格总数**: 26 个功能模块
**验证脚本**: `scripts/verify-spec.py`

---

## 符合度一览

| # | 模块 | 符合度 | 等级 | API 路由 | 数据模型 | E2E 覆盖 | 主要 Gap |
|---|------|--------|------|----------|----------|----------|----------|
| 1 | **world** | 81% | 🟢 | 11 条 | 18 个 schema | 高 | 关联约束待完善 |
| 2 | **timeline** | 81% | 🟢 | 5 条 | 2 个 schema | 高 | 交互流程文档化 |
| 3 | **film** | 80% | 🟢 | 3 条 | 17 个 schema | 高 | LLM stub 路径未规范 |
| 4 | **daemon** | 77% | 🟡 | — | 17 个 schema | 低 | 无 API，纯 UI 功能 |
| 5 | **skill** | 77% | 🟡 | 9 条 | 10 个 schema | 中 | builtin-skill 来源不明 |
| 6 | **relations** | 76% | 🟡 | 4 条 | 3 个 schema | 高 | AI 提取分类逻辑 |
| 7 | **audit** | 75% | 🟡 | 7 条 | 8 个 schema | 高 | AI vs 规则引擎未明确 |
| 8 | **export** | 74% | 🟡 | 6 条 | 8 个 schema | 低 | data-testid 缺失多 |
| 9 | **project-settings** | 74% | 🟡 | — | 8 个 schema | 低 | .inkchain/ 迁移待完成 |
| 10 | **session** | 72% | 🟡 | 8 条 | 8 个 schema | 中 | JSONL 分片未实现 |
| 11 | **dashboard** | 71% | 🟡 | — | 12 个 schema | 高 | 根路由 500 问题 |
| 12 | **foreshadowing** | 64% | 🟡 | 8 条 | 3 个 schema | 高 | 图视图渲染为列表 |
| 13 | **consistency** | 64% | 🟡 | 1 条 | 8 个 schema | 低 | 无独立 API 路由 |
| 14 | **book** | 62% | 🟡 | — | 8 个 schema | 中 | 关联书创建逻辑分散 |
| 15 | **doctor** | 62% | 🟡 | — | 8 个 schema | 低 | 无 API，纯诊断 UI |
| 16 | **flow** | 62% | 🟡 | — | 8 个 schema | 中 | ReactFlow 渲染问题 |
| 17 | **language** | 62% | 🟡 | — | 8 个 schema | 低 | 无 API，纯 UI |
| 18 | **log-viewer** | 62% | 🟡 | — | 8 个 schema | 低 | 无 API，纯 UI |
| 19 | **import-manager** | 62% | 🟡 | — | 8 个 schema | 低 | 无独立 API 路由 |
| 20 | **publish** | 62% | 🟡 | 6 条 | 8 个 schema | 低 | data-testid 缺失 |
| 21 | **style-detection** | 58% | 🟡 | 5 条 | — | 中 | LLM stub 路径未覆盖 |
| 22 | **chapter** | 58% | 🟡 | 4 条 | 3 个 schema | 高 | 卷筛选功能 |
| 23 | **character-tiering** | 55% | 🟡 | 4 条 | 2 个 schema | 低 | 角色分级逻辑未实现 |
| 24 | **genre** | 55% | 🟡 | 5 条 | 1 个 schema | 低 | 预设管理功能 |
| 25 | **radar** | 55% | 🟡 | — | 8 个 schema | 低 | 无 API，纯视图 |
| 26 | **agent** | 44% | 🔴 | 2 条 | 2 个 schema | 中 | 流程编辑器不显示 |

---

## 统计

| 等级 | 数量 | 说明 |
|------|------|------|
| 🟢 大部分符合 (>80%) | 3 | world / timeline / film |
| 🟡 部分符合 (50-80%) | 22 | 主力修复区 |
| 🔴 严重不符 (<50%) | 1 | **agent** |
| **平均符合度** | **66%** | |

---

## 行动计划

### 立即修复 (P0/P1)
1. **agent** (44%) — 流程编辑器不显示 / 自定义 agent 创建不完整 / 编辑不可用
2. **relations** (76%) — AI 提取分类 + 角色点击跳转空白页
3. **audit** (75%) — AI vs 规则引擎 + 批准状态图标更新

### 本期完善 (P1/P2)
4. **chapter** (58%) — 卷筛选修复 + data-testid 补全
5. **style-detection** (58%) — LLM stub 路径覆盖
6. **foreshadowing** (64%) — 图视图渲染 + 删除功能

### 后续迭代 (P2/P3)
7. **character-tiering / genre / radar** — data-testid 和 E2E 覆盖补全
8. **doctor / log-viewer / language** — 纯 UI 模块，补充交互文档

---

> 所有 spec 文件位于 `specs/` 目录。TEMPLATE.md 是规格模板。验证脚本: `scripts/verify-spec.py`
