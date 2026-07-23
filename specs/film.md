# 互动电影创作 — 功能规格书 (SDD)

**版本**: 1.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `models/play.ts` + `FilmWizard.tsx` + `StoryGraphTree.tsx` + `StoryPlayer.tsx` + `FlowView.tsx` + film E2E tests

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: 互动电影创作系统（InkChain Film）支持从世界观设定到最终可播放的完整创作流水线。包含 5 个阶段（世界/规模/结构/逐节点/校验），每个阶段提供专门视图（对话/世界锚点/流程图/树/校验面板/预览播放器）。底层用 StoryGraph 数据结构存储节点（对话/分支）、变量和结局。
> **痛点**: (1) 规模配置（Scale）阶段为 P2 占位功能；(2) 节点图片在树视图和播放器中的一致性需验证；(3) 多结局/变量系统的复杂度管理；(4) 创作流程中各阶段的进度和 stale 标记需明确。
> **期望状态**: 完整的互动电影创作流水线——从世界观设定到可玩的交互式故事，支持多分支、变量系统和结局管理。
> **成功指标**: film-wizard / film-list / film-image 共 3 个 E2E spec 全部通过。

---

## 0a. 用户故事 (User Stories)

1. As a **创作者**, I want **通过分阶段向导创建互动电影** so that **结构化的创作流程不遗漏关键步骤**。【P0】
2. As a **创作者**, I want **在对话模式下用 AI 辅助设定世界观和角色** so that **降低创作门槛**。【P0】
3. As a **创作者**, I want **在流程图视图中可视化节点关系** so that **直观管理分支结构**。【P1】
4. As a **创作者**, I want **在树视图中编辑每个节点的场景内容** so that **精细控制每个叙事节点**。【P1】
5. As a **创作者**, I want **播放预览最终作品** so that **体验最终效果并发现交互问题**。【P1】
6. As a **创作者**, I want **管理多个电影项目** so that **在多个作品间切换**。【P2】

---

## 1. 模块概述

互动电影创作是 InkChain 中创建**交互式非线性叙事**的子系统。采用 5 阶段创作向导，底层用 StoryGraph 数据结构表达叙事图和 PlayEntity 实体系统。支持节点场景的内容编辑、分支选择配置、变量系统和结局定义，最终可通过 StoryPlayer 进行可交互播放。支持多个电影项目的创建和管理。

---

## 2. 行为合约

### 2.1 API 接口

**地图 AI 生成 API** (挂载于 `/api/worlds`):

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| POST | `/:id/map/generate` | `{ creativity?: number (1-10, 默认 5) }` | AI 生成的地图区域候选列表 | AI 根据世界配置生成地图区域 |
| POST | `/:id/map/confirm` | `{ regions: MapRegionCandidate[] }` | 确认保存 | 将选中的区域持久化到世界数据 |

**电影项目** (数据层):
- StoryGraph 存储在 `<projectRoot>/.inkos/interactive-film/<projectId>.json`
- 通过 `saveStoryGraph` / `loadStoryGraph` 读写
- 项目侧边栏通过扫描目录列出所有电影项目

### 2.2 数据模型

| Schema | 类型 | 必填字段 | 可选字段 | 默认值 / 校验 |
|--------|------|----------|---------|--------------|
| `StoryGraph` | object | schemaVersion (1), projectId, title, nodes[], endings[], variables[] | worldAnchor, characters, playMode | nodes 至少含一个 start 节点 |
| `StoryNode` | object | id, type ("start"\|"story"\|"branch"), sceneDesc | choices[], imagePath, authorNotes | type 决定节点行为 |
| `StoryChoice` | object | id, label, targetNodeId | condition (变量条件) | 用于分支选择 |
| `PlayEntity` | object | id, type (actor/location/item/evidence/clue/claim/proof_chain/organization/rule/scene/event), label | summary, status, createdEventId, updatedEventId | 范式世界观实体系统 |
| `PlayActionIntent` | object | actionKind (look/say/move/do/wait), intent, manner, risk, ambiguity | targetEntityLabel, targetLocationLabel, secondaryActions | LLM 输出解析，lenient 容错 |
| `WorldAnchor` | object | storyCore | theme, genre, durationMinutes, worldRules | 电影世界观锚点 |

**创作阶段 (Phases)**:

| 阶段 | Phase Key | 默认子视图 | 说明 |
|------|-----------|-----------|------|
| 世界 | world | chat | AI 对话设定世界观、角色 |
| 规模 | scale | — | P2 功能：节点数量/分支深度/结局数设定 |
| 结构 | structure | flow | 流程图/树视图可视化节点结构 |
| 逐节点 | workshop | tree | 树视图逐节点编辑场景内容 |
| 校验 | validate | — | 完整性检查面板 |
| — | — | preview | StoryPlayer 可播放预览 |

### 2.3 状态转换

#### 创作阶段状态机

```
           打开电影项目
               │
               ▼
          世界 (world) ──→ 规模 (scale) ──→ 结构 (structure)
              │                                  │
              ├── WorldAnchor 已配置             ├── 流程图 (FlowView)
              │   → phaseStatus: "ready"         │
              └── WorldAnchor 未配置             └── 树视图 (StoryGraphTree)
                  → phaseStatus: "empty"
                                                     │
                                                     ▼
                                          逐节点 (workshop) ──→ 校验 (validate)
                                              │                     │
                                              ├── 场景编辑           ├── 完整性检查
                                              └── 节点图片           └── 缺失分支检查
                                                     │
                                                     ▼
                                             预览 (StoryPlayer)
                                              └── start → 播放交互

阶段进度: computePhaseProgress(graph) → { world, scale, structure, workshop, validate }
阶段过期: computeStaleFlags(graph, progress) → 指示哪些阶段需要更新
```

#### UI 状态机（FilmWizard）

```
idle ──→ loading (加载 StoryGraph) ──→ rendered
  │                                        │
  │                                        ├── 当前阶段视图
  │                                        │   ├── chat (ChatPage 嵌入)
  │                                        │   ├── anchor (WorldAnchorView)
  │                                        │   ├── flow (FlowView)
  │                                        │   ├── tree (StoryGraphTree)
  │                                        │   ├── validate (校验面板)
  │                                        │   └── preview (StoryPlayer)
  │                                        │
  │                                        ├── error ──────────────────
  │                                        │   graph 加载失败 → 错误提示
  │                                        └── empty ──────────────────
  │                                            no nodes → 引导创建
  │
  └──── 切换阶段 / 切换子视图

故事播放器状态:
  ┌─ 待播放 ──[start]──→ 当前节点内容 ──[选择选项]──→ 下一节点
  │                                                       │
  │                         选择 ending 选项               │
  └───────────────────────────────────────────────────────┘
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| StoryGraph → 电影项目 | 一对一 | 删除项目 → StoryGraph 文件删除 |
| StoryNode → StoryChoice | 一对多 | 节点删除 → 关联选择清理 |
| StoryChoice → StoryNode | 多对一 (via targetNodeId) | 目标节点删除 → choice 变为悬空引用 |
| PlayEntity ↔ PlayActionIntent | 实体-动作 | 松耦合，通过 label 匹配 |
| 电影项目侧边栏 | 扫描目录 | 无 `.inkos/interactive-film/` 文件 → 不显示 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 打开向导 | 加载 StoryGraph → 渲染阶段视图 | graph 解析失败 → 显示错误 | 无 nodes → 引导创建新图 | 超大 graph(>100 节点) → FlowView 性能 |
| 流程图视图 | FlowView 渲染节点+连线 | 渲染错误 → 降级为空面板 | 无节点 → 空白 | 循环引用 / 孤立节点 → 正常渲染 |
| 树视图 | 树结构展示+场景编辑 | save 失败 → alert | 仅 start 节点 → 显示 | 节点编辑→save→Player 同步验证 |
| 校验 | 完整性检查通过 | 检测到缺失分支 → 提示 | N/A | 多结局依赖 → 全部引用有效 |
| 播放器 | start → 正常交互推进 | 目标节点不存在 → 终止 | N/A | 变量条件判断 → 正确显示/隐藏选项 |
| 节点图片 | 图片在树和播放器中渲染 | 图片路径无效 → 不显示 | 无图片路径 → 不显示 | 大图(>5MB) → 正常加载 |
| 电影列表 | 侧边栏显示电影项目 | 扫描失败 → 隐藏列表 | 无电影 → 显示空状态 | 多项目 → 按名称排序 |
| AI 地图生成 | POST /generate → 返回候选区域 | LLM 不可用 → 降级 | world 无描述 → 生成效果差 | creativity=1 vs 10 对比 |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `FilmWizard` | `/#/studio/film/:id` | `film-wizard` | 5 阶段创作向导主页面 |
| `FlowView` | (内嵌 FilmWizard) | `flow-view` | 流程图可视化 |
| `StoryGraphTree` | (内嵌 FilmWizard) | `film-tree` | 树视图节点编辑 |
| `StoryPlayer` | (内嵌 FilmWizard) | `player-` | 互动故事播放器 |
| `WorldAnchorView` | (内嵌 FilmWizard) | `film-world` | 世界观锚点展示 |
| `ChatPage` | (内嵌 FilmWizard) | — | AI 对话辅助创作 |
| `AnalysisPanel` | (内嵌 FilmWizard) | — | 阶段分析面板 |
| `ExportBar` | (内嵌 FilmWizard) | — | 导出工具栏 |

### 4.2 交互流程

```
FilmWizard 主流程:
  侧边栏 [互动电影] → 显示项目列表 →
  ├─ [+创建] → 新建空白 StoryGraph
  └─ [点击项目] → 打开 5 阶段创作向导
      │
      ├─ 世界阶段:
      │   ├─ [对话] 子视图 → ChatPage 嵌入，AI 辅助设定
      │   └─ [世界锚点] 子视图 → 展示 worldAnchor + 角色
      │
      ├─ 结构阶段:
      │   ├─ [流程图] 子视图 → FlowView 可视化节点+边
      │   └─ [树] 子视图 → StoryGraphTree 层级浏览
      │
      ├─ 逐节点阶段:
      │   ├─ [树] 子视图 → 展开节点场景 → 编辑 content →
      │   │   [保存] → graph 持久化
      │   └─ [对话] 子视图 → AI 辅助编辑节点内容
      │
      ├─ 校验阶段 → 检查缺失分支/变量/结局
      │
      └─ [预览] → StoryPlayer:
          ├─ [开始] → 显示当前节点场景 + 选项列表
          ├─ [选择] → 导航至目标节点
          └─ 结局节点 → 显示结尾 + 重新开始选项
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 向导主容器 | `film-wizard` | E2E 定位向导页面 |
| 世界阶段步骤 | `wizard-step-world` | 世界阶段 tab |
| 结构阶段步骤 | `wizard-step-structure` | 结构阶段 tab |
| 校验阶段步骤 | `wizard-step-validate` | 校验阶段 tab |
| 子视图切换 | `wizard-subview-tree` | 切换到树视图 |
| 预览按钮 | `wizard-preview` | 打开播放器预览 |
| 流程图视图 | `flow-view` | FlowView 渲染容器 |
| 树视图 | `film-tree` | StoryGraphTree 渲染容器 |
| 校验面板 | `validation-panel` | 校验结果展示 |
| 世界锚点 | `film-world` | 世界观锚点数据 |
| 播放开始 | `player-start` | 播放器开始按钮 |
| 播放屏幕 | `player-screen` | 播放器内容区域 |
| 播放图片 | `player-image` | 播放器中节点图片 |
| 节点图片 | `node-image-{id}` | 树视图中的节点缩略图 |
| 场景编辑 | `film-scene-{id}` | 场景内容文本区 |
| 场景保存 | `film-save-{id}` | 场景保存按钮 |
| 播放按钮 | `film-play` | 进入播放器按钮 |
| 电影项目条目 | `film-project-{id}` | 侧边栏电影项目 |
| 电影项目列表 | `film-projects-section` | 侧边栏电影列表区域 |
| 标题 | `film-title` | 电影标题 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 2s StoryGraph 加载；p95 < 5s FlowView 渲染(100 节点) | Playwright E2E timeout |
| 并发 | 多电影项目独立（各自 StoryGraph 文件） | 手动验证 |
| 回滚 | scene 保存失败 → graph 不更新 | 前端 error handling |
| 降级 | LLM 不可用 → ChatPage 阶段仍可手动编辑；地图 AI 生成降级提示 | `INKOS_AGENT_LLM_STUB=1` |
| 数据完整性 | StoryGraph JSON 损坏 → zod 解析报错，前端显示错误 | 校验层 |
| 图像 | 节点图片支持 serve 端点，E2E 验证 naturalWidth > 0 | E2E film-image |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 实时多人协作编辑电影 | 单用户桌面应用 |
| 3D 场景编辑器 | 小说转型的工具，非游戏引擎 |
| 音频/配音支持 | 超出 MVP 范围 |
| 观众分析/遥测 | 离线创作工具 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 侧边栏显示电影项目列表 | 点击 Alpha 项目 | FilmWizard 打开，5 个阶段步骤可见 | ⬜ | film-list |
| 2 | 向导已加载 | 点击结构阶段 | FlowView 渲染流程图 | ⬜ | film-wizard |
| 3 | 结构阶段流程图可见 | 切换到树子视图 | StoryGraphTree 树结构渲染 | ⬜ | film-wizard |
| 4 | 树/流程图中 | 点击校验阶段 | 校验面板渲染 | ⬜ | film-wizard |
| 5 | 校验通过 | 点击预览 | StoryPlayer 显示开始按钮 | ⬜ | film-wizard |
| 6 | 播放器开始页面 | 点击开始 | 播放屏幕显示当前节点内容+选项 | ⬜ | film-wizard |
| 7 | 树视图中节点有图片 | 查看节点缩略图 | 图片正常加载(naturalWidth > 0) | ⬜ | film-image |
| 8 | 树视图中节点有图片 | 进入播放器 → 开始播放 | 播放器图片渲染 | ⬜ | film-image |
| 9 | 作者编辑场景文本 | 输入内容 → 点击保存 | graph 持久化成功，player 同步更新 | ⬜ | authoring |
| 10 | 无 worldAnchor | 查看世界阶段 | 显示引导文本"请先切换到对话" | ⬜ | — |
| 11 | AI 地图生成请求 | POST /generate, creativity=5 | 返回候选区域列表 | ⬜ | — |

完成度: 0/11 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | Scale（规模）阶段的 P2 功能何时实现？是否需要节点/分支/结局数量限制？ | @product | 否 |
| 2 | 电影项目是否需要导出为可独立运行的格式（HTML/可执行文件）？ | @product | 否 |
| 3 | PlayEntity 实体系统的复杂度是否适合网文作者的认知模型？ | @product | 否 |
| 4 | LLM 辅助生成电影内容时是否需要世界设定作为上下文注入？ | @backend-lead | 否 |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 初始版本：基于代码分析和 E2E 测试 | spec-writer-2 |
