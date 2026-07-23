# 章节与分卷管理 — 功能规格书 (SDD)

**版本**: 1.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `api/routes/chapter-versions.ts` + `api/routes/volumes.ts` + `models/chapter.ts` + `models/volume.ts` + `ChapterReader.tsx` + `ChapterWizard.tsx`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: 章节管理包含阅读/编辑/生成三条路径——ChapterReader 提供沉浸式阅读与手动编辑功能，ChapterWizard 提供 4 步 AI 生成管道，后端支持版本快照/恢复和分卷 CRUD。
> **痛点**: (1) 章节版本管理缺乏明确的版本策略（snapshot vs Git 模式）；(2) ChapterWizard 生成流程为 mock 实现，未接入真实 AI；(3) 分卷删除时的级联策略（cascade vs unlink）行为不明确；(4) 章节阅读器无版本历史入口。
> **期望状态**: 版本控制模式可配置（snapshot/Git/off）；ChapterWizard 生成管道对接 AI API；分卷级联操作明确、安全；ChapterReader 提供版本历史入口。
> **成功指标**: chapter-reader / chapter-wizard / chapter-versioning / chapter-history-core / chapter-volume / edge-chapter-range 共 6 个 E2E spec 全部通过。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **阅读章节的优美排版体验** so that **能像读纸质书一样审阅内容**。【P0】
2. As a **写作者**, I want **编辑章节内容并保存** so that **能直接修改不满意的地方**。【P0】
3. As a **写作者**, I want **AI 逐步引导生成章节** so that **省去从空白页开始的痛苦**。【P1】
4. As a **写作者**, I want **对章节内容审批通过/拒绝** so that **AI 生成的章节经过质量把关**。【P1】
5. As a **写作者**, I want **管理章节的历史版本** so that **能恢复到之前的某个版本**。【P1】
6. As a **写作者**, I want **将章节分配到分卷** so that **长篇小说结构清晰**。【P2】
7. As a **写作者**, I want **创建/编辑/删除/重排序分卷** so that **能灵活组织故事结构**。【P2】

---

## 1. 模块概述

章节管理是 InkChain 中管理**章节内容**和**分卷结构**的核心模块。包含三大子系统：
- **章节阅读/编辑**（ChapterReader）：提供仿纸张风格的沉浸式阅读体验，支持内容编辑、审批通过/拒绝
- **AI 章节生成**（ChapterWizard）：4 步管道（场景描述 → 关联实体 → 生成参数 → 逐段审核），引导式生成章节
- **版本控制**（chapter-versions）：支持 snapshot 模式和 Git 模式的章节版本管理，包括快照创建、版本列表、内容加载、版本恢复
- **分卷管理**（volumes）：分卷 CRUD、排序、章节与分卷关联，支持 cascade/unlink 删除策略

---

## 2. 行为合约

### 2.1 API 接口

**章节版本 API** (挂载于 `/api/v1/books`):

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/:id/chapters/:num/versions` | chapterNum (int >= 0) | `{ versions: [...], chapterNum }` | 列出章节的所有版本历史 |
| GET | `/:id/chapters/:num/versions/:timestamp` | timestamp (string) | `{ content, chapterNum, timestamp }` | 加载指定版本的章节内容 |
| POST | `/:id/chapters/:num/versions/snapshot` | — | `{ ok: true, chapterNum, timestamp }` | 手动创建当前内容的快照 |
| POST | `/:id/chapters/:num/versions/:timestamp/restore` | timestamp (string) | `{ ok: true, chapterNum, restoredTimestamp, wordCount }` | 恢复指定版本（恢复前自动创建快照） |

**分卷 API** (挂载于 `/api/v1/books`):

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/:id/volumes` | — | `{ volumes: Volume[] }` | 列出书籍所有分卷 |
| POST | `/:id/volumes` | `{ title, description?, status?, order? }` | `{ volume }` (201) | 创建分卷（id/uuid 自动生成） |
| PUT | `/:id/volumes/:volumeId` | partial body | `{ volume }` | 更新分卷 |
| DELETE | `/:id/volumes/:volumeId` | query `cascade` (boolean, default false) | `{ deleted: true, volumeId, cascade, title }` | 删除分卷：cascade=true 删除章节文件；cascade=false 仅解除关联 |
| PATCH | `/:id/volumes/reorder` | `{ volumeIds: string[] }` | `{ volumes: Volume[] }` | 按给定 ID 顺序重排分卷 |
| PATCH | `/:id/chapters/:num/volume` | `{ volumeId: string | null }` | `{ ok: true, chapterNumber, volumeId }` | 将章节关联/解关联到指定分卷 |
| GET | `/:id/volumes/:volumeId/chapters` | — | `{ volumeId, chapters: [...] }` | 列出某分卷下的所有章节 |

**请求/响应示例**:

```json
// POST /:id/volumes → Request Body
{ "title": "第一卷", "description": "开篇", "status": "draft" }
// → 201 Created
{ "volume": { "id": "uuid-auto-generated", "title": "第一卷", "description": "开篇",
    "status": "draft", "order": 0, "createdAt": "...", "updatedAt": "..." } }

// Error → 400 Bad Request
{ "error": { "code": "VALIDATION_ERROR", "message": "校验失败：title 必须是字符串" } }

// POST /:id/chapters/:num/versions/snapshot
// → 200 OK
{ "ok": true, "chapterNum": 3, "timestamp": "2026-07-23T12:00:00Z" }

// Error → 400 Bad Request (invalid chapter number)
{ "error": { "code": "INVALID_CHAPTER", "message": "Invalid chapter number" } }

// POST /:id/chapters/:num/versions/:timestamp/restore
// → 200 OK
{ "ok": true, "chapterNum": 3, "restoredTimestamp": "2026-07-22T08:00:00Z", "wordCount": 2547 }

// Error → 404 Not Found
{ "error": { "code": "VERSION_NOT_FOUND", "message": "Version 2025-01-01T00:00:00Z not found" } }
```

### 2.2 数据模型

**章节模型** (`models/chapter.ts`):

| Schema | 类型 | 必填字段 | 可选字段 | 默认值 / 校验 |
|--------|------|----------|---------|--------------|
| `ChapterMetaSchema` | object | number (int, >=1), title, status, createdAt, updatedAt | wordCount (default 0), auditIssues (default []), lengthWarnings (default []), reviewNote, detectionScore (0-1), detectionProvider, detectedAt, lengthTelemetry, tokenUsage, volumeId (nullable) | wordCount 默认 0；detectionScore 范围 [0,1]；volumeId 可设为 null |
| `ChapterStatusSchema` | enum | card-generated / drafting / drafted / auditing / audit-passed / audit-failed / state-degraded / revising / ready-for-review / approved / rejected / published / imported | — | 完整生命周期状态链 |

**分卷模型** (`models/volume.ts`):

| Schema | 类型 | 必填字段 | 可选字段 | 默认值 / 校验 |
|--------|------|----------|---------|--------------|
| `VolumeSchema` | object | id (string min 1), title (string min 1), order (int >=0), createdAt, updatedAt | description (default ""), status (default "draft") | status 枚举: draft / active / completed |
| `VolumeStatusSchema` | enum | draft / active / completed | — | — |

**持久化**:
- 版本数据存储在 `story/state/versions/` 目录下，按 `chapter-{num}/` 子目录组织
- 分卷数据存储在 `story/state/volumes.json`
- 章节索引存储在 `chapters/index.json`

### 2.3 状态转换

#### 章节状态机

```
                    POST /chapters/:num (生成章节卡)
card-generated ──────────────────────────────────────→ drafting
                                                          │
                           PUT /chapters/:num (保存内容)  │
drafting ──────────────────────────────────────────────→ drafted
                                                          │
                       POST /audit (提交审核)              │
drafted ───────────────────────────────────────────────→ auditing
                                                          │
                      审核结果                              │
auditing ─────────────────── audit-passed / audit-failed
                             │
                             ├── audit-passed → ready-for-review
                             │   │
                             │   ├── POST /approve → approved
                             │   └── POST /reject → rejected
                             │       │
                             │       └── approved → published
                             │
                             └── audit-failed → state-degraded
                                                     │
                                       重新起草       │
state-degraded ────────────────────────────────────→ revising → drafted
```

#### 分卷状态机

```
                   POST /volumes (201)
新建 ──────────────────────────────────────→ draft
                                               │
                        PUT /volumes/:id      │
draft ────────────────────────────────────────→ active
                                               │
                        PUT /volumes/:id      │
active ──────────────────────────────────────→ completed
                                               │
                  DELETE /volumes/:id          │
任意状态 ──────────────────────────────────────→ 已删除 (不可逆)
     └─ cascade=true: 章节文件一同删除
     └─ cascade=false: 章节解除关联（volumeId=null）

                    PATCH /volumes/reorder
任意顺序 ──────────────────────────────────────→ 按 volumeIds 新顺序
```

#### UI 状态机（ChapterReader）

```
                    ┌── error ───────────────────────────────────────┐
                    │  API 500 / 网络超时 → 显示红色错误框              │
                    │  refetch → 返回 idle                             │
                    ▼                                                  │
idle ──→ loading ──→ rendered                                        │
  ▲         │           │                                             │
  │         │           ├── 编辑模式 (editing=true)                     │
  │         │           │     → textarea 替换原文渲染                   │
  │         │           │     → 保存/预览按钮                           │
  │         │           └── 阅读模式 (editing=false)                   │
  │         │                → 纸质风格排版                             │
  │         │                → 审批/拒绝/编辑/沉浸写作按钮              │
  └─────────┴──── refetch() / 审批后跳转                              │
```

**守卫条件**:
- `阅读模式` → `编辑模式`: 仅当 `data !== null`
- `编辑模式` → `保存`: 仅当 `saving === false` 且内容非空
- `编辑模式` → `阅读模式`: 点击取消或保存成功后

#### UI 状态机（ChapterWizard）

```
idle ──→ step-1 (场景描述) ──→ step-2 (关联实体) ──→ step-3 (生成参数)
            ▲                    ▲                    ▲
            │                    │                    │
            └── 返回 ───────────┘────────────────────┘
                                                      │
                                              点击生成 │
                                                      ▼
                                              step-4 (逐段审核)
                                                    │
                                         全部审核通过 │
                                                    ▼
                                                完成 → 跳转至书籍
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| 章节 → 书籍 | 多对一 | 删除书籍 → 全部章节文件和版本历史级联删除 |
| 章节 → 分卷 | 多对一 | 分卷删除(cascade=false) → 章节 volumeId 设为 null；分卷删除(cascade=true) → 关联章节文件删除 |
| 章节 → 版本快照 | 一对多 | 删除章节文件 → 版本历史快照孤立（需清理） |
| 分卷排序 | 列表 | 插入分卷默认 order = max(order) + 1 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 创建分卷 | POST → 201 → 插入分卷列表 | INVALID_JSON → 400 / VALIDATION_ERROR → 400 + details | 首次创建 → order=0 | title 为空 → 默认"新建分卷" |
| 读取分卷列表 | GET → 200 → 渲染分卷数据 | volumes.json 损坏 → 返回空数组 | volumes.json 不存在 → 返回 schemaVersion: "1", volumes: [] | 大量分卷(>50) → 滚动展示 |
| 读取章节 | GET → 200 → 渲染纸质风格 | CHAPTERS_DIR_NOT_FOUND → 404 / CHAPTER_NOT_FOUND → 404 | 章节文件不存在 → 显示错误 | 超大章节(>100KB) → 正常渲染 |
| 创建快照 | POST → 200 → 返回 timestamp | CHAPTERS_DIR_NOT_FOUND → 404 / SNAPSHOT_FAILED → 500 | 章节文件不存在 → 404 | 章节文件为空的快照 → 正常创建 |
| 恢复版本 | POST → 200 → 写入恢复内容 | VERSION_NOT_FOUND → 404 / CHAPTER_NOT_FOUND → 404 | N/A | 恢复前自动创建当前快照 |
| 编辑章节 | PUT → 200 → refetch 刷新 | 网络异常 → alert 提示 | N/A | 并发编辑 → 后写覆盖 |
| 删除分卷(cascade) | DELETE → 200 → 章节文件+索引移除 | 索引文件格式异常 → 静默跳过 | N/A | 分卷无章节 → 仅删除分卷条目 |
| 删除分卷(unlink) | DELETE → 200 → 章节解除关联 | 索引文件不存在 → 静默跳过 | N/A | 分卷无章节 → 仅删除分卷条目 |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `ChapterReader` | `/#/book/:id/read/:num` | — | 章节阅读/编辑，纸质排版风格，含审批通过/拒绝 |
| `ChapterWizard` | `/#/chapter-wizard/:id` | `chapter-wizard` | 4 步 AI 生成管道：场景→实体→参数→审核 |
| `VolumeManagement` | (内嵌 BookDetail) | — | 分卷列表，创建/编辑/删除/排序 |
| `ImmersiveWritingPanel` | (ChapterReader 覆盖层) | — | 沉浸式写作模式，全屏编辑器 |

### 4.2 交互流程

```
ChapterReader 流程:
  进入 → 加载章节内容 → 纸质风格渲染 →
  ├─ [编辑] → textarea 模式 → [保存] → refetch → 阅读模式
  │                        └─ [预览] → 阅读模式
  ├─ [审批] → POST /approve → 跳转书籍首页
  ├─ [拒绝] → POST /reject → 跳转书籍首页
  ├─ [沉浸写作] → ImmersiveWritingPanel 全屏 → 关闭返回
  └─ [返回列表] → 跳转书籍首页

ChapterWizard 流程:
  进入 → Step1: 输入场景描述 → Step2: 选择关联世界实体 →
  Step3: 配置长度/风格/自由度 → 生成 → Step4: 逐段审核/编辑/重生成/跳过 →
  全部审核完成 → 跳转书籍首页

分卷管理流程:
  侧边栏分卷区域 → [+新建分卷] → 弹窗填写标题/描述/状态 → POST 创建
  分卷卡片 → [编辑] / [删除] → 确认
  章节拖拽 → 分配到分卷
  分卷标签页 → 筛选该分卷下的章节
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 章节向导主容器 | `chapter-wizard` | E2E 定位向导页面 |
| Step 1 容器 | `wizard-step-1` | 场景描述步骤 |
| Step 2 容器 | `wizard-step-2` | 关联实体步骤 |
| Step 3 容器 | `wizard-step-3` | 生成参数步骤 |
| Step 4 容器 | `wizard-step-4` | 逐段审核步骤 |
| 书香元素 | `.paper-sheet` | 阅读器纸张渲染容器 |
| 编辑器文本区 | `textarea` | 编辑模式下的内容编辑器 |
| 分卷管理区域 | `.volume-card` / nav (章节管理) | 侧边栏分卷/章节导航 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 2s 章节加载；p95 < 5s 版本恢复；p95 < 30s AI 生成 | Playwright E2E timeout |
| 并发 | 同一书籍多 tab 操作各自独立 | 手动验证 |
| 回滚 | 版本恢复前自动创建当前快照；volumes.json 写操作原子性 | 单元测试 mock fs 写入失败 |
| 降级 | ChapterWizard 当前为 mock 实现，集成真实 AI 后需降级策略 | `INKOS_AGENT_LLM_STUB=1` 环境变量 |
| 浏览器兼容 | Chrome / Firefox / Edge 最新两个大版本 | CI matrix |
| 数据安全 | 章节版本快照不可直接删除（仅通过书籍级联删除） | — |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 章节实时协作编辑 | 单用户桌面应用，无 WebSocket sync |
| 章节 diff 对比视图 | 当前版本控制仅支持快照和恢复，不提供 diff |
| 章节合并/拆分 | 超出当前 MVP 范围 |
| 分卷嵌套（子分卷） | 保持扁平结构，复杂度低 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 书籍已有章节 | 导航到章节阅读页面 | 页面渲染纸质风格，显示标题、正文、字数/阅读时间统计 | ⬜ | chapter-reader |
| 2 | 章节页面加载完成 | 点击编辑按钮 | 切换为 textarea 编辑模式，显示保存和预览按钮 | ⬜ | chapter-reader |
| 3 | 编辑模式下修改内容 | 点击保存按钮 | PUT API 调用成功，页面刷新为编辑后内容 | ⬜ | chapter-reader |
| 4 | 章节页面已加载 | 点击审批通过按钮 | POST /approve 成功，跳转回书籍首页 | ⬜ | chapter-reader |
| 5 | 章节页面已加载 | 点击审批拒绝按钮 | POST /reject 成功，跳转回书籍首页 | ⬜ | chapter-reader |
| 6 | 无效书籍 ID | 导航到章节阅读页面 | 页面不崩溃，显示错误信息或空状态 | ⬜ | chapter-reader |
| 7 | 无章节的空书籍 | 导航到章节阅读/向导页面 | 页面正常加载不崩溃 | ⬜ | chapter-reader / chapter-wizard |
| 8 | 书籍已存在 | 导航到章节向导页 | 显示 4 步进度条和场景描述输入区 | ⬜ | chapter-wizard |
| 9 | 向导 Step1 填写场景描述 | 点击下一步 → Step4 | 进入逐段审核，每段可审批/编辑/重生成/跳过 | ⬜ | chapter-wizard |
| 10 | 项目设置页面 | 点击章节/Chapters 侧边栏 | 版本控制模式选择器可见（snapshot/Git/off） | ⬜ | chapter-versioning |
| 11 | snapshot 模式 | 切换至 Git 模式并保存 | PUT API 调用成功 | ⬜ | chapter-versioning |
| 12 | API 500 错误 | 保存版本控制配置 | 页面不崩溃，显示错误提示 | ⬜ | chapter-versioning |
| 13 | 已创建 3 卷 + 25 章节 | 打开书籍首页 | 章节列表可见，分卷标签可筛选 | ⬜ | chapter-volume |
| 14 | 分卷有 2 个章节 | 删除分卷(cascade=false) | 章节 volumeId 设为 null，章节保留 | ⬜ | chapter-volume |
| 15 | 分卷有 3 个章节 | 删除分卷(cascade=true) | 章节文件从磁盘删除 | ⬜ | chapter-volume |
| 16 | 章节有 3 个历史版本 | 点击版本历史 | 版本列表显示 | ⬜ | chapter-history-core |
| 17 | 章节版本列表已加载 | 选择旧版本 → 恢复 | 当前内容替换为旧版本内容，自动创建恢复前快照 | ⬜ | chapter-history-core |

完成度: 0/17 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | ChapterWizard 对接哪个 AI 模型？是否需要支持多个后端？ | @backend-lead | 否（mock 模式可用） |
| 2 | 版本控制的 Git 模式具体实现方案？是否依赖本地 Git 仓库？ | @backend-lead | 否（snapshot 模式已工作） |
| 3 | 分卷删除时 cascade=true 的行为是否为不可逆操作？需不需要回收站？ | @product | 否 |
| 4 | ChapterReader 是否需要支持章节间的历史版本 diff 比较？ | @product | 否 |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 初始版本：基于代码分析和 E2E 测试 | spec-writer-2 |
