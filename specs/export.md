# 导出发布 — 功能规格书 (SDD)

**版本**: 2.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `api/routes/publish.ts`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: Export/Publish 模块提供跨平台导出和发布支持——TXT 导出（起点中文网兼容）、EPUB 导出、HTML 预览、平台格式化预览、完整发布流程。最初面向起点中文网，扩展后支持多平台适配器。
> **痛点**: (1) TXT 导出将所有章节拼接为单一字符串返回 JSON，大章节量时内存压力大；(2) publish 端点使用 mock BookConfig 进行校验，非真实书籍配置；(3) EPUB 导出路径硬编码 `root/books/{id}` 而非 DATA_DIR 标准化路径；(4) HTML 预览仅支持 .md 章节文件，不兼容 .json 章节格式。
> **期望状态**: 所有导出端点覆盖 Normal/Error/Empty/Edge 四态；自助式 HTML 导出完全剥离服务器依赖；EPUB 提供标准 Content-Disposition 下载。
> **成功指标**: export E2E（2 个测试）全部通过。

---

## 0a. 用户故事 (User Stories)

1. As a **写作者**, I want **一键导出书籍为 TXT 文件** so that **上传到起点中文网等平台**。【P0】
2. As a **写作者**, I want **发布前检查书籍准备状态** so that **避免因缺章节/字数不足被平台拒收**。【P0】
3. As a **写作者**, I want **预览格式化后的章节** so that **发布前确认格式正确**。【P1】
4. As a **写作者**, I want **导出互动电影为自包含 HTML** so that **离线分享给读者**。【P1】
5. As a **写作者**, I want **导出为 EPUB** so that **在电子书设备上阅读**。【P2】
6. As a **维护者**, I want **导出端点返回正确的 Content-Type 和 Content-Disposition** so that **浏览器正确处理下载**。【P1】

---

## 1. 模块概述

导出/发布模块（路由挂载在 `/api/publish`）是 InkChain 中将作品输出到外部平台的桥梁。支持六个端点：

1. **准备检查** (`GET /:bookId/check`)：校验书名、题材、章节数(≥5)、总字数(≥10000)、平台兼容性
2. **TXT 导出** (`POST /:bookId/export`)：生成起点中文网兼容的 TXT 内容
3. **格式化预览** (`POST /:bookId/format-preview`)：使用平台适配器格式化指定章节
4. **完整发布** (`POST /:bookId/publish`)：校验 + 格式化 + 发布流程
5. **EPUB 下载** (`GET /:bookId/export-epub`)：生成 EPUB 文件流
6. **HTML 预览** (`POST /:bookId/preview-html`)：生成响应式 HTML 页面

另有通过项目 API 的导出端点（`/projects/:id/export/html|json|ink`）用于互动电影导出。

---

## 2. 行为合约

### 2.1 API 接口

| 方法 | 路径 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| GET | `/api/publish/:bookId/check` | — | `{ ready, checks[], meta: { title, totalChapters, totalWords } }` | 发布准备检查 |
| POST | `/api/publish/:bookId/export` | — | `{ ok, filename, content, contentType, chapterCount, totalWords }` | 导出为 TXT |
| POST | `/api/publish/:bookId/format-preview` | `{ platform, chapters[] }` | `{ previews[]: { chapter, original, formatted } }` | 按平台格式化预览 |
| POST | `/api/publish/:bookId/publish` | `{ platform, chapters[] }` | `{ ok, published, platform, chapterCount, totalWords, formatted, message }` 或 400 `{ ok: false, warnings[] }` | 完整发布流程 |
| GET | `/api/publish/:bookId/export-epub` | — | `application/epub+zip` 流 (attachment) | EPUB 下载 |
| POST | `/api/publish/:bookId/preview-html` | — | `text/html` 页面 | HTML 预览 |
| GET | `/api/v1/projects/:id/export/html` | — | `text/html` (自包含) | 互动电影 HTML 导出 |
| GET | `/api/v1/projects/:id/export/json` | — | `application/json` (attachment) | 互动电影 JSON 导出 |
| GET | `/api/v1/projects/:id/export/ink` | — | `text/plain` (attachment) | 互动电影 Ink 导出 |

**请求/响应示例**:
```json
// GET /api/publish/:bookId/check → 200
{
  "ready": true,
  "checks": [
    { "name": "书名", "passed": true, "message": "书名: 修仙传" },
    { "name": "题材", "passed": true, "message": "题材: xianxia" },
    { "name": "章节数", "passed": true, "message": "当前 12 章" },
    { "name": "总字数", "passed": true, "message": "当前约 36000 字" },
    { "name": "平台兼容性", "passed": true, "message": "起点中文网" }
  ],
  "meta": { "title": "修仙传", "totalChapters": 12, "totalWords": 36000 }
}

// GET /api/publish/:bookId/check → 200 (not ready)
{ "ready": false, "checks": [
    { "name": "章节数", "passed": false, "message": "当前 3 章，还需 2 章" }
  ], "meta": { ... } }

// POST /api/publish/:bookId/export → 200
{ "ok": true, "filename": "修仙传_export_17123456789.txt", "content": "修仙传\r\n作者: ...", "contentType": "text/plain; charset=utf-8", "chapterCount": 12, "totalWords": 36000 }

// Error → 400 (NO_CHAPTERS)
{ "error": { "code": "NO_CHAPTERS", "message": "No chapters to export" } }

// Error → 400 (INVALID_BOOK_ID)
{ "error": { "code": "INVALID_BOOK_ID", "message": "Invalid book id: <script>" } }

// Error → 404 (BOOK_NOT_FOUND)
{ "error": { "code": "BOOK_NOT_FOUND", "message": "Book not found: xxx" } }

// POST /api/publish/:bookId/format-preview → 400 (MISSING_PLATFORM)
{ "error": { "code": "MISSING_PLATFORM", "message": "请指定发布平台" } }

// POST /api/publish/:bookId/format-preview → 400 (NO_CHAPTERS_SELECTED)
{ "error": { "code": "NO_CHAPTERS_SELECTED", "message": "请选择要发布的章节" } }

// POST /api/publish/:bookId/publish → 400 (校验失败)
{ "ok": false, "published": false, "warnings": [...], "message": "存在未通过的检查项" }
```

### 2.2 数据模型

| Schema | 类型 | 字段 | 说明 |
|--------|------|------|------|
| `BookMeta` | object | id, title, platform, genre, status | 从 `book.json` 读取的书籍元数据 |
| `ChapterItem` | object | number, title, content | 从 `chapters/{n}.json` 读取的章节 |
| `PublishCheckResult` | object | ready, checks[] | checks 每条含 name/passed/message |
| `FormatPreviewBody` | object | platform (PublishPlatform), chapters[] (number[]) | 格式化预览请求体 |
| `PublishBody` | object | platform (PublishPlatform), chapters[] (number[]) | 发布请求体 |
| `PublishPlatform` | string | 平台标识符 | 传递给 `getAdapter()` 获取格式化器 |
| `PublishChapter` | object | meta (包含 number/title/status/wordCount), text | `@inkchain/inkchain-core` 定义的发布章节类型 |
| `ValidationWarning` | object | field, message, severity (ok/error) | 平台校验警告 |

**安全约束**:
- `bookId` 必须匹配 `/^[a-z0-9_-]+$/i`，否则返回 400 INVALID_BOOK_ID
- 章节文件从 `chapters/` 目录读取，仅匹配 `^\d+\.json$` 格式

### 2.3 状态转换

#### 发布准备检查流程

```
GET /:bookId/check
  → 读取 book.json (BookMeta)
  → 列出章节 (chapters/*.json)
  → 逐项检查:
     1. 书名 ≥ 2 字符
     2. 题材 ≥ 2 字符
     3. 章节数 ≥ 5
     4. 总字数 ≥ 10000
     5. 平台兼容性 (platform in [qidian, other])
  → ready = all passed
  → 返回 JSON
```

#### 完整发布流程

```
POST /:bookId/publish
  → 读取元数据 + 章节
  → getAdapter(platform)
  → adapter.validateRequirements(bookConfig, selectedChapters)
  → 有 error → 返回 400 { ok: false, warnings }
  → 无 error → adapter.formatFullBook(...)
  → 返回 200 { ok: true, published: true, formatted }
```

#### 章节级别错误处理

| 场景 | 错误码 | HTTP | 含义 |
|------|--------|------|------|
| bookId 含非法字符 | INVALID_BOOK_ID | 400 | 安全拦截，防止路径遍历 |
| 找不到 book.json | BOOK_NOT_FOUND | 404 | 书籍不存在 |
| 无章节可导出 | NO_CHAPTERS | 400 | chapters/ 目录为空或无 .json 文件 |
| 请求章节不存在 | CHAPTER_NOT_FOUND | 404 | format-preview/publish 指定章节号不存在 |
| 缺少 platform 参数 | MISSING_PLATFORM | 400 | 未指定发布目标平台 |
| 未选择章节 | NO_CHAPTERS_SELECTED | 400 | chapters 数组为空 |
| EPUB/HTML 生成失败 | EXPORT_FAILED / PREVIEW_FAILED | 500 | 文件读取或格式转换错误 |

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| 导出 → 书籍 | 多对一 | 删除书籍 → 无法导出（BOOK_NOT_FOUND） |
| 导出 → 章节 | 一对一 | 章节不存在 → CHAPTER_NOT_FOUND |
| 发布 → 平台适配器 | 多对一 | 平台未注册 → getAdapter 抛出异常 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 准备检查 | 5 项全部通过 → ready=true | 任一项失败 → ready=false + 详细提示 | 书籍无章节 → chapters=0，章节数检查失败 | bookId 含特殊字符 → 400 INVALID_BOOK_ID |
| TXT 导出 | POST → 200 → JSON 含 content+filename | chapters=0 → 400 NO_CHAPTERS | 空书籍 → 400 NO_CHAPTERS | 书名/作者/章节标题含特殊字符 → 正常转义 |
| 格式化预览 | POST → 200 → previews[] 含 original+formatted | 章节未找到 → 404 CHAPTER_NOT_FOUND | chapters 数组为空 → 400 NO_CHAPTERS_SELECTED | 请求全部章节（最大 chapter number） |
| 发布 | POST → 校验通过 → published=true | 校验未通过 → 400 + warnings[] | 同上 | 使用 mock BookConfig（targetChapters=200, chapterWordCount=3000） |
| EPUB | GET → 200 → application/epub+zip 流 | bookId 验证失败 → 500 EXPORT_FAILED | 无章节 → EPUB 空文件 | 大书籍 EPUB（100+章节）→ 内存压力 |
| HTML | POST → 200 → text/html 页面 | 文件读取失败 → 500 PREVIEW_FAILED | chapters/ 目录不存在 → 空 HTML（仅标题） | 仅处理 .md 文件，忽略 .json 章节 |

---

## 4. UI 覆盖

### 4.1 页面 / 面板

Export/Publish 模块主要为 API 接口，无独立 UI 页面，通常通过书籍页面中的「导出」按钮或侧边栏入口触发。

互动电影导出端点在 `FlowView` 或相应页面中触发。

### 4.2 关键 data-testid

纯 API 模块，无 UI 组件特定的 data-testid。E2E 测试通过 API 请求和响应断言：

| 元素 | E2E 验证方式 | 用途 |
|------|------------|------|
| HTML 导出内容 | `page.request.get("/api/v1/projects/:id/export/html")` → `page.setContent(html)` | 验证自包含播放 |
| JSON 导出头 | `page.request.get(".../export/json")` | 验证 Content-Type=application/json + Content-Disposition=attachment |
| Ink 导出头 | `page.request.get(".../export/ink")` | 验证 Content-Type=text/plain + Content-Disposition=attachment |
| 互动播放器 | `page.locator("#if-player")` | 验证自包含 HTML 中的播放器初始化 |
| 选择按钮 | `page.locator(".choice").first()` | 验证离线交互 |
| 结局页面 | `page.locator(".ending-title")` | 验证完整离线播放流程 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 响应时间 | TXT 导出 p95 < 3s（50 章）；EPUB p95 < 5s | E2E 响应时间监控 |
| 安全 | bookId 正则校验 `/^[a-z0-9_-]+$/i`，防路径遍历 | 单元测试 |
| 正确性 | 导出端点返回正确的 Content-Type + Content-Disposition | export E2E #2 断言 headers |
| 自包含 | HTML 导出无需服务器即可播放 | export E2E #1: setContent() 后交互 |
| 浏览器兼容 | Chrome / Firefox / Edge 最新两个大版本 | CI matrix |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 多平台一键发布 | 当前平台适配器仅支持格式化，真实发布需对接平台 API |
| PDF 导出 | 不在 v1 范围内，EPUB + HTML 覆盖主流格式 |
| 增量导出（仅导出新增章节） | 每次导出为全量操作 |
| 导出样式自定义 | 使用平台标准模板格式化 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 存在一个 start→ending 的互动电影项目 | 获取 /export/html → setContent → 点击 .choice | 离线 HTML 中播放器初始化，点击到结局页 .ending-title | ⬜ | export #1 |
| 2 | 存在导出项目 | 分别请求 /export/json 和 /export/ink | json: Content-Type=application/json, Content-Disposition=attachment；ink: Content-Type=text/plain, Content-Disposition=attachment | ⬜ | export #2 |

完成度: 0/2 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | EPUB 导出路径是否应统一使用 DATA_DIR_NAME（`data/`）替代硬编码 `root/books/`？ | @backend-lead | 是 |
| 2 | 发布流程是否需要真实的平台 API 对接（非仅格式化）？ | @backend-lead | 否（v1 仅格式化） |
| 3 | HTML 预览是否应同时兼容 .json 和 .md 章节格式？ | @backend-lead | 否 |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 骨架（自动生成） | — |
| 2026-07-23 | v2.0 完整补全：基于 publish.ts + export E2E + 互动电影导出端点 | spec-writer-4 |
