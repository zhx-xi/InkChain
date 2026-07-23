# Publish / 跨平台发布 — 功能规格书 (SDD)

**版本**: 2.0
**创建日期**: 2026-07-23
**状态**: approved
**代码源**: `api/routes/publish.ts` + `PublishPage.tsx`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: Publish 模块提供跨平台发布功能，支持就绪检查（书名/体裁/章节数/总字数/平台兼容 5 项）、TXT 导出、格式预览、完整发布流程、EPUB 下载、HTML 预览。目前正式支持起点中文网(qidian)，实验性支持通用格式，规划中的包括番茄/飞卢。
> **痛点**: (1) 发布流程为实验功能，未对接真实平台 API；(2) EPUB 导出依赖 `buildExportArtifact` 核心库；(3) 格式预览缺少原始/格式化并排对比展示；(4) 规划中平台按钮 disabled 可能误导用户。
> **期望状态**: 完整发布流程对接真实平台 API；EPUB/HTML 导出稳定可用；格式预览支持 before/after 对比；规划中平台显示明确的时间线。
> **成功指标**: E2E export spec 全部通过；PublishPage 正常渲染/check/export/download。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **一键检查发布就绪状态** so that **在导出前知道还缺什么**。【P0】
2. As a **写作者**, I want **导出为平台兼容的 TXT 文件** so that **上传到起点中文网作家专区**。【P0】
3. As a **写作者**, I want **预览章节格式化效果** so that **确认格式符合平台要求后再发布**。【P1】
4. As a **写作者**, I want **下载 EPUB 文件** so that **在电子书阅读器上查看作品**。【P2】
5. As a **写作者**, I want **在浏览器中 HTML 预览** so that **快速查看书籍排版效果**。【P2】
6. As a **维护者**, I want **发布接口返回结构化的验证警告** so that **用户清楚每项未通过的原因**。【P1】

---

## 1. 模块概述

Publish 模块提供从 InkChain 作品到外部发布平台的导出能力。核心流程包括就绪检查（验证书名/题材/章节数/字数/平台兼容性）→ TXT 格式导出（兼容起点中文网格式）→ 完整发布流程（含平台适配器校验）。扩展支持包括 EPUB 二进制下载和 HTML 预览。

---

## 2. 行为合约

### 2.1 API 接口

#### Publish API (`/api/publish`)

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/:bookId/check` | — | `{ ready, checks[], meta }` | 就绪检查（5 项） |
| POST | `/:bookId/export` | — | `{ ok, filename, content, contentType, chapterCount, totalWords }` | 导出为 TXT 格式 |
| POST | `/:bookId/format-preview` | `{ platform, chapters: number[] }` | `{ previews[] }` | 格式化预览（original vs formatted） |
| POST | `/:bookId/publish` | `{ platform, chapters: number[] }` | `{ ok, published, platform, chapterCount, totalWords, formatted, message }` | 完整发布流程（含校验） |
| GET | `/:bookId/export-epub` | — | Binary `application/epub+zip` | EPUB 二进制下载 |
| POST | `/:bookId/preview-html` | — | HTML `text/html` | HTML 预览 |

**请求/响应示例**:
```json
// GET /api/publish/:bookId/check → Response
{ "ready": false,
  "checks": [
    { "name": "书名", "passed": true, "message": "书名: 仙武纪元" },
    { "name": "题材", "passed": true, "message": "题材: 仙侠" },
    { "name": "章节数", "passed": false, "message": "当前 3 章，还需 2 章" },
    { "name": "总字数", "passed": false, "message": "当前约 8,500 字，还需约 1,500 字" },
    { "name": "平台兼容性", "passed": true, "message": "起点中文网" }
  ],
  "meta": { "title": "仙武纪元", "totalChapters": 3, "totalWords": 8500 }
}

// POST /api/publish/:bookId/export → Response
{ "ok": true, "filename": "仙武纪元_export_1720000000000.txt",
  "content": "仙武纪元\r\n作者: （请填写作者名）\r\n...",
  "contentType": "text/plain; charset=utf-8", "chapterCount": 5, "totalWords": 12500 }

// POST /api/publish/:bookId/format-preview → Request
{ "platform": "qidian", "chapters": [1, 2] }
// → Response
{ "previews": [
  { "chapter": { "number": 1, "title": "第一章", "wordCount": 2500 },
    "original": "原始文本...", "formatted": "格式化后文本..." }
] }

// POST /api/publish/:bookId/publish → 校验未通过
// → 400 Bad Request
{ "ok": false, "published": false,
  "warnings": [{ "field": "章节数", "message": "至少需要 5 章", "severity": "error" }],
  "message": "存在未通过的检查项" }

// POST /api/publish/:bookId/publish → 成功
// → 200 OK
{ "ok": true, "published": true, "platform": "qidian",
  "chapterCount": 5, "totalWords": 12500, "formatted": "格式化文本...",
  "message": "已成功发布 5 章到 起点中文网" }
```

**安全校验**: `bookId` 通过 `safeDir()` 校验 `^[a-z0-9_-]+$` 正则，防止路径遍历攻击。

### 2.2 数据模型

| Schema | 类型 | 必填字段 | 可选字段 | 默认值 / 校验 |
|--------|------|----------|---------|--------------|
| `BookMeta` (内部) | interface | id, title, platform, genre, status | — | 从 `book.json` 读取 |
| `PublishCheckResult` | interface | ready (boolean), checks[] (name/passed/message), meta (title/totalChapters/totalWords) | — | 5 项检查 |
| `PublishExportResponse` | interface | ok, filename, content, contentType, chapterCount, totalWords | — | content 为 `\r\n` 分隔的 TXT 文本 |
| `FormatPreviewBody` | interface | platform (PublishPlatform), chapters (number[]) | — | 章节数校验：> 0 |
| `PublishBody` | interface | platform (PublishPlatform), chapters (number[]) | — | 同上 |
| `PublishPlatform` | type | — | — | "qidian" \| "tomato" \| "feilu" \| "other" |
| `PublishChapter` | interface | meta (chapterMeta), text (string) | — | 章节元信息 + 文本内容 |
| `ValidationWarning` | interface | field, message, severity: "ok" \| "error" | — | 发布校验警告 |

**平台信息**:

| 平台 Key | 名称 | 状态 | 描述 |
|----------|------|------|------|
| `qidian` | 起点中文网 | experimental | 国内最大的原创文学平台，支持 TXT 格式导入 |
| `tomato` | 番茄小说 | planned | 免费阅读平台，支持 TXT/EPUB 格式导入 |
| `feilu` | 飞卢小说网 | planned | 付费阅读平台，需适配专属格式 |
| `other` | 其他平台 | experimental | 通用 TXT 导出格式 |

**就绪检查规则**:
1. 书名 ≥ 2 字符
2. 题材 ≥ 2 字符
3. 章节数 ≥ 5
4. 总字数 ≥ 10,000
5. 平台兼容性: `meta.platform === "qidian"` 或 `"other"`

**TXT 导出格式**:
```
<书名>
作者: <作者信息>
题材: <题材>
总字数: <字数>

========================================

第N章 <章节标题>

<章节内容>

------------------------------
```

### 2.3 状态转换

#### 发布页面状态机

```
                    ┌── checkError ────────────────────┐
                    │  API 500 / 网络超时 → 错误提示     │
                    ▼                                   │
idle ──→ checking ──→ checkLoaded                       │
  ▲         │            │                               │
  │         │            ├── ready=true → 绿色 "就绪"    │
  │         │            ├── ready=false → 琥珀 "待完善" │
  │         │            └── 5 项检查逐项渲染 ✓/⚠       │
  └─────────┴──── 切换书籍 → 重新检查                    │
```

#### 导出状态机

```
                    ┌── exportError ────────────────────┐
                    │  NO_CHAPTERS → 400                 │
                    │  网络超时 → 错误提示                │
                    ▼                                    │
idle ──→ exporting ──→ exported                          │
  ▲         │             │                               │
  │         │             ├── 成功 → Blob URL 下载        │
  │         │             │   + 绿色 "导出完成" 提示       │
  │         │             └── EPUB → Content-Disposition   │
  │         │                   attachment download        │
  └─────────┴──── 重新导出                                │
```

#### 完整发布状态机

```
checkLoaded ──→ 选择章节 ──→ POST /publish
                               │
                    ┌──────────┤
                    ▼          ▼
              errors > 0    errors === 0
              → 400 +       → published=true
                warnings       + formatted 文本
                "未通过"       + message
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| 发布 → 书籍 | 多对一 | 删除书籍 → 发布状态失效 |
| 发布 → 章节 | 通过 `chapterIds[]` 选择 | 删除章节 → 选中集合需要重新构建 |
| 发布 → 平台适配器 | 策略模式 `getAdapter(platform)` | 不支持的平台 → 应在前端层面 disabled |
| 导出文件 → 本地 Blob | 服务端生成 → 浏览器下载 | URL.revokeObjectURL 清理内存 |
| EPUB → `ExportArtifact` | 通过 `buildExportArtifact()` 生成 | 无 EPUB 构建状态 → 抛出 500 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 就绪检查 | GET /check → 200 → 5 项检查渲染 | BOOK_NOT_FOUND → 404 / checkError 显示 | 空章节 → chapters >= 5 未通过 | bookId 含特殊字符 → INVALID_BOOK_ID → 400 |
| TXT 导出 | POST /export → 200 → 下载 Blob | NO_CHAPTERS → 400 / exportError 显示 | 无章节 → 400 NO_CHAPTERS | 单章节导出 → 正常（无分隔符） |
| 格式预览 | POST /format-preview → previews[] 返回 | CHAPTER_NOT_FOUND → 404 / MISSING_PLATFORM → 400 | N/A (chapters 必填校验) | 全章节预览 → 正常返回全部 |
| 完整发布 | POST /publish → 200 + published=true | errors > 0 → 400 + warnings 列表 | N/A | 无平台校验失败 → 400 MISSING_PLATFORM |
| EPUB 下载 | GET /export-epub → 200 + application/epub+zip | EXPORT_FAILED → 500 | 无章节 → 可能返回空 EPUB | Content-Disposition attachment 文件名正确 |
| HTML 预览 | POST /preview-html → 200 text/html | PREVIEW_FAILED → 500 | 无 .md 文件 → `<body></body>` | 中文字符正确转义 (`<` → `&lt;`) |
| 平台选择 | 点击平台卡片 → 选中高亮 | N/A | N/A | planned 状态 → 卡片 disabled + cursor-not-allowed |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `PublishPage` | 通过侧边栏 "发布" 进入 | — | 主页面：返回按钮 + 平台选择器 + 检查清单 + 导出区 |
| Platform Selector | (内嵌) | — | 4 平台网格卡片 |
| Publish Checklist | (内嵌) | — | 5 项检查逐项渲染 + 汇总统计 |
| Export Section | (内嵌) | — | TXT 导出 / EPUB 下载 / HTML 预览 按钮组 |

### 4.2 交互流程

```
进入发布页 → auto-check (useEffect mount)
├── 页面标题: "跨平台发布" + "将《书名》发布到各平台（实验功能）"
├── 平台选择器: 4 平台网格卡片
│   ├── 起点中文网: experimental → "⚡ 实验"
│   ├── 番茄小说: planned → disabled, "○ 规划中"
│   ├── 飞卢小说网: planned → disabled, "○ 规划中"
│   └── 其他平台: experimental → "⚡ 实验"
├── 检查清单: 5 项检查
│   ├── Loading: Loader2 animate-spin + "正在检查发布就绪状态…"
│   ├── Error: 红色错误提示
│   └── Check Result:
│       ├── 每项: ✓/! icon + name + 通过/未通过 tag + message
│       └── 汇总: 章节数 / 总字数 / 发布状态 (就绪/待完善)
├── 导出区:
│   ├── "导出 TXT 文件" (Download icon)
│   │   disabled: exporting || checkResult === null
│   │   → POST /export → Blob → URL.createObjectURL → a.click()
│   ├── "下载 EPUB" (BookOpen icon)
│   │   → `<a href="/api/publish/:id/export-epub" download>`
│   └── "HTML 预览" (Eye icon)
│       → POST /preview-html → window.open → write html → close
└── 返回按钮 (ArrowLeft) → nav.toBook(bookId)
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 返回按钮 | `ArrowLeft` icon button | 返回导航 |
| 平台卡片 | `.rounded-lg.border.p-3` 4 个 button | 平台选择 |
| 检查加载 | `Loader2` + "正在检查" 文本 | Checking 状态 |
| 检查通过 | `Check` icon + "通过" tag | 检查项通过 |
| 检查未通过 | `AlertCircle` icon + "未通过" tag | 检查项未通过 |
| TXT 导出按钮 | `button:has-text('导出 TXT')` | 导出入口 |
| EPUB 下载 | `a:has-text('下载 EPUB')` | EPUB 入口 |
| HTML 预览 | `button:has-text('HTML 预览')` | 预览入口 |
| 导出成功 | "导出完成" 绿色文本 | 导出成功断言 |
| 导出失败 | "导出失败" 红色文本 | 导出失败断言 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | p95 < 2s 就绪检查；p95 < 5s TXT 导出（100 章） | E2E waitForTimeout |
| 安全 | `safeDir()` 校验 bookId 正则 `^[a-z0-9_-]+$` | 单元测试路径遍历攻击 |
| 回滚 | 导出操作为读操作（只读 chapters），无副作用 | 天然的幂等操作 |
| 降级 | EPUB/HTML 预览失败 → `ApiError 500` + 具体错误信息 | 手动测试 |
| 浏览器兼容 | Chrome / Firefox / Edge 最新两个大版本 | CI matrix |
| 内存 | 100 章导出 → 前端内存 < 30MB（Blob URL 及时 revoke） | Chrome DevTools Memory |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 对接真实平台 API（起点作家专区发布） | 实验功能阶段，仅导出文件 |
| EPUB 内嵌封面图片 | `buildExportArtifact` 当前不支持 |
| 发布历史 / 发布记录 | 单次导出，无历史追踪 |
| 多平台并行发布 | 单平台单次导出 |
| PDF 格式导出 | 无需求，优先 EPUB/HTML |
| 章节批量格式预览（全量对比） | 当前仅逐章 preview |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 已创建书籍含书名/题材/5章/12,500字 | 打开发布页面 | 就绪检查 5 项全部通过；ready=true；"就绪" 标签绿色 | ⬜ | — |
| 2 | 书籍仅 3 章 8,500 字 | 打开发布页面 | 章节数检查 failed："还需 2 章"；字数检查 failed："还需约 1,500 字"；ready=false | ⬜ | — |
| 3 | 就绪检查完成 | 点击 "导出 TXT 文件" | Blob 下载触发；文件包含书名/作者/题材/章节标记；chapterCount 正确 | ⬜ | — |
| 4 | 无章节数据 | 点击 "导出 TXT 文件"（如果未 disabled） | POST /export → 400 NO_CHAPTERS 或导出按钮 disabled | ⬜ | — |
| 5 | 选择章节 [1,2] + platform="qidian" | POST /format-preview | 返回 previews[] 含 original + formatted 对比 | ⬜ | — |
| 6 | 就绪检查失败（章节<5） | POST /publish | 返回 400 + validation warnings; published=false | ⬜ | — |
| 7 | 就绪检查通过 | POST /publish (platform=qidian, chapters=[1-5]) | 返回 200 + published=true + message "已成功发布 5 章到 起点中文网" | ⬜ | — |
| 8 | 发布页加载 | 点击 "下载 EPUB" | 浏览器下载 .epub 文件；Content-Type: application/epub+zip | ⬜ | — |
| 9 | 发布页加载 | 点击 "HTML 预览" | 新窗口打开；含完整 HTML 结构（head/style/body/section） | ⬜ | — |
| 10 | 检查中状态 | 页面初次加载 | Loader2 旋转动画 + "正在检查发布就绪状态…" 文本可见 | ⬜ | — |
| 11 | 检查 API 返回 500 | 打开发布页面 | 错误提示 "检查失败：…" 红色显示 | ⬜ | — |
| 12 | 选择 "番茄小说"（planned） | 检查按钮状态 | 卡片 disabled（opacity-40 + cursor-not-allowed） | ⬜ | — |

完成度: 0/12 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | 发布 API 何时对接真实平台 API（起点/番茄/飞卢）？ | @backend-lead | 否（当前为导出模式） |
| 2 | EPUB 导出 `buildExportArtifact` 依赖的核心库状态？ | @backend-lead | 否（export.spec 测试 self-contained HTML） |
| 3 | preview-html 章节读取路径 `books/:id/chapters/*.md` 是否与 `DATA_DIR_NAME` 一致？ | @backend-lead | 否（路径硬编码，可能不一致） |
| 4 | 发布页是否需要章节多选 UI（当前 API 支持 chapters[] 但 UI 未暴露选择器）？ | @frontend-lead | 否（export 无章节选择，publish/form-preview 需后端传入） |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 骨架（自动生成） | — |
| 2026-07-23 | v2.0 完整补全：基于源码 + export E2E spec | spec-writer-3 |
