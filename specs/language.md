# Language Selector — 功能规格书 (SDD)

**版本**: 2.0
**创建日期**: 2026-07-23
**状态**: draft
**代码源**: `packages/studio/src/pages/LanguageSelector.tsx` + `e2e/language-selector.spec.ts`

---

## 0. 问题陈述 (Problem Statement)

> **当前状态**: LanguageSelector 是 InkChain 的启动语言选择界面，首次启动时以全屏覆盖层展示"中文创作"和"English Writing"两个选项卡片，选择后通过 `onSelect` 回调设置语言并过渡到主界面。
> **痛点**: 无返回机制，选择后不可在此页面修改（引导用户在设置中修改）。
> **期望状态**: 简洁的两卡片选择 UI，有 hover/选中动画，选择后平滑过渡。
> **成功指标**: 4 个 E2E spec 覆盖页面加载、选择器渲染、中英文选择交互。

---

## 0a. 用户故事 (User Stories)

1. As a **新用户**, I want **首次启动时选择创作语言** so that **界面和 Agent 以对应语言运行**。【P0】
2. As a **用户**, I want **看到清晰的创作生态信息** so that **了解该语言支持的平台和题材**。【P2】

---

## 1. 模块概述

LanguageSelector 是 InkChain 的初始语言选择覆盖层。首次启动且未设置语言时显示，提供"中文创作"和"English Writing"两个大卡片，分别展示支持的题材（玄幻·仙侠·都市 vs LitRPG·Progression·Romantasy）和平台（番茄小说·起点·飞卢 vs Royal Road·Kindle Unlimited·Scribble Hub）。选择后 400ms 延迟过渡到主界面。

---

## 2. 行为合约

### 2.1 API 接口

无专用 API；语言偏好通过 `onSelect` 回调传递给父组件，由父组件存储到 shared store/config（localStorage 或项目配置）。

### 2.2 数据模型

无数据模型。组件仅接受 `onSelect: (lang: "zh" | "en") => void` 回调；内部维护 `hovering` 和 `selected` 两个 UI 状态。

### 2.3 状态转换

```
idle ──(hover zh)──→ hovering zh ──(mouse leave)──→ idle
  │
  ├──(hover en)──→ hovering en ──(mouse leave)──→ idle
  │
  └──(click zh/en)──→ selected (卡片高亮 + scale[1.02])
                          │
                          └──(400ms timeout)──→ onSelect(lang) → 组件卸载
```

### 2.4 关联约束

| 关联 | 类型 | 级联规则 |
|------|------|---------|
| Language → App | 单向通知 | 选择后触发全局语言切换；可在设置中修改 |

---

## 3. 状态矩阵（4 态覆盖）

| 操作 | Normal | Error | Empty | Edge |
|------|--------|-------|-------|------|
| 渲染 | 两卡片正常显示 | N/A（纯 UI，无 API） | N/A | 极窄屏幕 → flex-wrap 保证不溢出 |
| 选择 zh | 点击 → 高亮 → 400ms 后 onSelect("zh") | N/A | N/A | 双击 → 第一次 click 已设 selected，第二次无额外效果 |
| 选择 en | 点击 → 高亮 → 400ms 后 onSelect("en") | N/A | N/A | 同上 |

---

## 4. UI 覆盖

### 4.1 页面

| 页面组件 | 路由 | data-testid 前缀 | 说明 |
|----------|------|------------------|------|
| `LanguageSelector` | 非路由页面（启动覆盖层） | — | 全屏居中布局，含 Logo + 卡片 + 底注 |

### 4.2 交互流程

```
启动 → 无语言设置 → 渲染 LanguageSelector 全屏覆盖
    │
    ├── Logo: 大字 "Ink" + "OS" + 小字 "Studio"
    │
    ├── 左侧卡片 "中文创作": 题材列表 + 平台列表
    ├── 右侧卡片 "English Writing": 题材列表 + 平台列表
    │
    ├── hover → 边框/背景色变化
    ├── click → 卡片高亮 (scale[1.02], bg-primary/10)
    │         → 400ms setTimeout → onSelect(lang)
    │
    └── 底注: "可在设置中更改 · Can be changed in Settings"
```

### 4.3 关键 data-testid

| 元素 | data-testid | 用途 |
|------|-------------|------|
| 中文卡片 | 文字 "中文创作" | E2E 点击中文 |
| 英文卡片 | 文字 "English Writing" | E2E 点击英文 |
| Logo | 文字 "InkChain Studio" | 页面存在性断言 |

---

## 5. 非功能需求

| 维度 | 目标 | 测量方式 |
|------|------|---------|
| 动画流畅度 | 卡片 hover/selected 过渡 300ms ease-out | 肉眼验证 |
| 响应式 | flex gap-8 + px-8 适配 1024px+ 屏幕 | 手动验证 |

---

## 6. Non-goals（明确不做什么）

| 不做的功能 | 原因 |
|------------|------|
| 语言选择后返回修改 | 引导用户在设置中修改，避免启动覆盖层复杂化 |
| 更多语言支持 | 当前仅 zh/en，其他语言需求未明确 |
| 语言自动检测（浏览器 locale） | 手动选择更精确，避免误判 |
| 选择动画更丰富（淡入淡出等） | 当前 400ms delay + scale 已满足需求 |

---

## 7. 验收矩阵

| # | Given | When | Then | 状态 | E2E |
|---|-------|------|------|------|-----|
| 1 | 浏览器打开应用 | 访问 `/#/` | bodyText 非空 | ⬜ | language-selector.spec.ts #1 |
| 2 | 语言选择器可见 | 检查中文卡片 | "中文创作"文字可见 或 正常 dashboard 加载 | ⬜ | language-selector.spec.ts #2 |
| 3 | 语言选择器可见 | 点击"中文创作" | 页面过渡（bodyText 非空） | ⬜ | language-selector.spec.ts #3 |
| 4 | 语言选择器可见 | 点击"English Writing" | 页面过渡（bodyText 非空） | ⬜ | language-selector.spec.ts #4 |

完成度: 0/4 = 0%

---

## 8. Open Questions（待确认）

| # | 问题 | 负责人 | 阻塞实现? |
|---|------|--------|:---:|
| 1 | 语言选择后是否应持久化到项目配置？ | @frontend-lead | 否（父组件负责） |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-07-23 | v1.0 骨架（create-spec.py 自动生成） | — |
| 2026-07-23 | v2.0 完整补全：基于 LanguageSelector.tsx + 4 E2E spec | spec-writer-5 |
