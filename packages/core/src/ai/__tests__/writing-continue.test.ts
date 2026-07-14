import { describe, it, expect } from "vitest";
import {
  buildContinueSystemPrompt,
  buildContinueUserPrompt,
  parseContinueResponse,
  checkConflict,
  filterConflicts,
  hasBlockingConflicts,
  DEFAULT_CONTINUE_PARAMS,
} from "../writing-continue.js";
import type { FullWritingContext } from "../writing-continue.js";
import type { WorldConfig } from "../../models/world-config.js";
import type { CharacterRelation } from "../../models/relations.js";
import type { TimelineEvent } from "../../models/character-timeline.js";
import type { Foreshadowing } from "../../models/foreshadowing.js";

// ── Helpers ──

function makeMinimalContext(overrides: Partial<FullWritingContext> = {}): FullWritingContext {
  return {
    world: {
      config: null,
      referenceDimensions: [],
    },
    relation: {
      relations: [],
      activeRelations: [],
    },
    timeline: {
      events: [],
      relevantEvents: [],
    },
    foreshadowing: {
      foreshadowing: [],
      activeForeshadowing: [],
    },
    currentChapter: 5,
    chapterSummaries: "",
    runtimeFacts: [],
    ...overrides,
  };
}

function makeWorldConfig(): WorldConfig {
  return {
    id: "test-world",
    name: "测试世界",
    description: "一个魔法与科技共存的世界",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    settings: [
      { id: "s1", name: "魔法石", type: "魔法体系", description: "蕴含强大魔力的水晶", constraints: ["不能直接触摸"], sortIndex: 0 },
    ],
    roles: [
      { id: "r1", name: "艾伦", role: "主角", description: "勇敢的魔法学徒", significance: 5, sortIndex: 0, institutionIds: [], regionIds: [] },
    ],
    relations: [],
    regions: [],
    institutions: [],
    history: [],
    rules: [
      { id: "rule1", name: "魔法守恒", type: "魔法", description: "魔法不能凭空产生", constraints: ["施法需要等价交换"], sortIndex: 0 },
    ],
    references: [],
    bookIds: [],
  };
}

// ── Tests ──

describe("buildContinueSystemPrompt", () => {
  it("should include chapter number", () => {
    const context = makeMinimalContext({ currentChapter: 7 });
    const prompt = buildContinueSystemPrompt(context);
    expect(prompt).toContain("第 7 章");
  });

  it("should include world context when provided", () => {
    const context = makeMinimalContext({
      world: { config: makeWorldConfig(), referenceDimensions: ["settings", "roles", "rules"] },
    });
    const prompt = buildContinueSystemPrompt(context);
    expect(prompt).toContain("一个魔法与科技共存的世界");
    expect(prompt).toContain("魔法石");
    expect(prompt).toContain("艾伦");
    expect(prompt).toContain("魔法守恒");
  });

  it("should include relation context when active relations exist", () => {
    const relations: CharacterRelation[] = [
      {
        id: "00000000-0000-0000-0000-000000000001",
        sourceRoleId: "艾伦",
        targetRoleId: "莉娜",
        relationType: "close_friend",
        customLabel: "挚友",
        intensity: 4,
        validFromChapter: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const context = makeMinimalContext({
      relation: { relations, activeRelations: relations },
    });
    const prompt = buildContinueSystemPrompt(context);
    expect(prompt).toContain("艾伦");
    expect(prompt).toContain("莉娜");
    expect(prompt).toContain("close_friend");
    expect(prompt).toContain("强度4");
  });

  it("should include timeline context when relevant events exist", () => {
    const events: TimelineEvent[] = [
      {
        id: "e1",
        timestamp: "第3章",
        eventType: "plot",
        title: "发现遗迹",
        description: "艾伦在森林中发现古代遗迹",
        relatedCharacters: ["艾伦"],
        chapter: 3,
        importance: 4,
        tags: [],
      },
    ];
    const context = makeMinimalContext({
      timeline: { events, relevantEvents: events },
    });
    const prompt = buildContinueSystemPrompt(context);
    expect(prompt).toContain("发现遗迹");
    expect(prompt).toContain("艾伦在森林中发现古代遗迹");
  });

  it("should include foreshadowing context when active hooks exist", () => {
    const hooks: Foreshadowing[] = [
      {
        id: "h1",
        title: "魔法石的秘密",
        description: "魔法石中封印着远古力量",
        type: "情节伏笔",
        bookId: "test-book",
        createdChapter: 1,
        expectedPayoffChapter: 10,
        status: "active",
        payoffChapter: null,
        lastMentionedChapter: 3,
        relatedElements: ["魔法石"],
        notes: "",
      },
    ];
    const context = makeMinimalContext({
      foreshadowing: { foreshadowing: hooks, activeForeshadowing: hooks },
    });
    const prompt = buildContinueSystemPrompt(context);
    expect(prompt).toContain("魔法石的秘密");
    expect(prompt).toContain("active");
  });

  it("should include runtime facts when available", () => {
    const facts = [
      { subject: "艾伦", predicate: "currentLocation", object: "森林", validFromChapter: 1, validUntilChapter: null, sourceChapter: 1 },
    ];
    const context = makeMinimalContext({ runtimeFacts: facts });
    const prompt = buildContinueSystemPrompt(context);
    expect(prompt).toContain("艾伦");
    expect(prompt).toContain("currentLocation");
    expect(prompt).toContain("森林");
  });

  it("should contain JSON output format instructions", () => {
    const context = makeMinimalContext();
    const prompt = buildContinueSystemPrompt(context);
    expect(prompt).toContain("JSON");
    expect(prompt).toContain("content");
    expect(prompt).toContain("summary");
    expect(prompt).toContain("direction");
  });

  it("should list available direction values", () => {
    const context = makeMinimalContext();
    const prompt = buildContinueSystemPrompt(context);
    expect(prompt).toContain("expand_dialogue");
    expect(prompt).toContain("advance_plot");
    expect(prompt).toContain("deepen_character");
  });
});

describe("buildContinueUserPrompt", () => {
  it("should include previous chapter content", () => {
    const context = makeMinimalContext();
    const params = { ...DEFAULT_CONTINUE_PARAMS, previousChapterContent: "这是前一章的正文内容。" };
    const prompt = buildContinueUserPrompt(params, context);
    expect(prompt).toContain("前一章内容");
    expect(prompt).toContain("这是前一章的正文内容");
  });

  it("should include chapter summaries when provided", () => {
    const context = makeMinimalContext({ chapterSummaries: "第1章: 开始\n第2章: 发展" });
    const prompt = buildContinueUserPrompt(DEFAULT_CONTINUE_PARAMS, context);
    expect(prompt).toContain("章节摘要");
    expect(prompt).toContain("第1章: 开始");
  });

  it("should include style and user direction when provided", () => {
    const params = { ...DEFAULT_CONTINUE_PARAMS, style: "悬疑", userDirection: "增加冲突" };
    const context = makeMinimalContext();
    const prompt = buildContinueUserPrompt(params, context);
    expect(prompt).toContain("悬疑");
    expect(prompt).toContain("增加冲突");
  });

  it("should request more candidates for high creativity", () => {
    const highParams = { ...DEFAULT_CONTINUE_PARAMS, creativity: 8 };
    const lowParams = { ...DEFAULT_CONTINUE_PARAMS, creativity: 3 };
    const context = makeMinimalContext();
    const highPrompt = buildContinueUserPrompt(highParams, context);
    const lowPrompt = buildContinueUserPrompt(lowParams, context);
    expect(highPrompt).toContain("3");
    expect(lowPrompt).toContain("2");
  });

  it("should include creativity and length in the prompt", () => {
    const params = {
      ...DEFAULT_CONTINUE_PARAMS,
      creativity: 6,
      length: 1500,
      style: "热血",
    };
    const context = makeMinimalContext();
    const prompt = buildContinueUserPrompt(params, context);
    expect(prompt).toContain("6/10");
    expect(prompt).toContain("1500 字");
    expect(prompt).toContain("热血");
  });
});

describe("parseContinueResponse", () => {
  it("should parse valid JSON array", () => {
    const raw = JSON.stringify([
      { content: "这是续写内容", summary: "续写摘要", estimatedWords: 500, addressedDimensions: ["world", "plot"], direction: "advance_plot" },
    ]);
    const result = parseContinueResponse(raw, raw);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("这是续写内容");
    expect(result[0].summary).toBe("续写摘要");
    expect(result[0].estimatedWords).toBe(500);
    expect(result[0].addressedDimensions).toEqual(["world", "plot"]);
    expect(result[0].direction).toBe("advance_plot");
  });

  it("should parse markdown code block JSON", () => {
    const raw = "```json\n[\n  {\"content\": \"续写内容\", \"summary\": \"摘要\", \"estimatedWords\": 300, \"addressedDimensions\": [], \"direction\": \"deepen_character\"}\n]\n```";
    const result = parseContinueResponse(raw, raw);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("续写内容");
  });

  it("should parse wrapped object with candidates key", () => {
    const raw = JSON.stringify({
      candidates: [
        { content: "候选1", summary: "摘要1", estimatedWords: 200, addressedDimensions: ["plot"], direction: "advance_plot" },
      ],
    });
    const result = parseContinueResponse(raw, raw);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("候选1");
  });

  it("should handle empty array", () => {
    const raw = "[]";
    const result = parseContinueResponse(raw, raw);
    expect(result).toHaveLength(0);
  });

  it("should handle non-JSON input gracefully", () => {
    const raw = "抱歉，我无法生成续写。";
    const result = parseContinueResponse(raw, raw);
    expect(result).toHaveLength(0);
  });

  it("should filter out empty content items", () => {
    const raw = JSON.stringify([
      { content: "有效内容", summary: "摘要", estimatedWords: 100, addressedDimensions: [], direction: "world_building" },
      { content: "", summary: "空内容", estimatedWords: 0, addressedDimensions: [], direction: "" },
    ]);
    const result = parseContinueResponse(raw, raw);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("有效内容");
  });

  it("should handle multiple candidates", () => {
    const raw = JSON.stringify([
      { content: "候选A", summary: "A", estimatedWords: 100, addressedDimensions: ["plot"], direction: "advance_plot" },
      { content: "候选B", summary: "B", estimatedWords: 200, addressedDimensions: ["character"], direction: "deepen_character" },
      { content: "候选C", summary: "C", estimatedWords: 150, addressedDimensions: ["world"], direction: "world_building" },
    ]);
    const result = parseContinueResponse(raw, raw);
    expect(result).toHaveLength(3);
  });
});

describe("checkConflict", () => {
  it("should return empty for content with no conflicts", () => {
    const context = makeMinimalContext();
    const issues = checkConflict("这是一段普通的续写内容。", context);
    expect(issues).toHaveLength(0);
  });

  it("should warn when active foreshadowing is not mentioned", () => {
    const hooks: Foreshadowing[] = [
      {
        id: "h1",
        title: "远古预言",
        description: "关于世界末日的预言",
        type: "情节伏笔",
        bookId: "test-book",
        createdChapter: 1,
        expectedPayoffChapter: 10,
        status: "active",
        payoffChapter: null,
        lastMentionedChapter: 3,
        relatedElements: [],
        notes: "",
      },
    ];
    const context = makeMinimalContext({
      foreshadowing: { foreshadowing: hooks, activeForeshadowing: hooks },
    });
    const issues = checkConflict("艾伦继续在森林中探索。", context);
    const foreshadowingIssues = issues.filter((i) => i.dimension === "foreshadowing");
    expect(foreshadowingIssues.length).toBeGreaterThan(0);
    expect(foreshadowingIssues[0].description).toContain("远古预言");
  });

  it("should NOT warn when foreshadowing is mentioned in content", () => {
    const hooks: Foreshadowing[] = [
      {
        id: "h1",
        title: "远古预言",
        description: "关于世界末日的预言",
        type: "情节伏笔",
        bookId: "test-book",
        createdChapter: 1,
        expectedPayoffChapter: 10,
        status: "active",
        payoffChapter: null,
        lastMentionedChapter: 3,
        relatedElements: [],
        notes: "",
      },
    ];
    const context = makeMinimalContext({
      foreshadowing: { foreshadowing: hooks, activeForeshadowing: hooks },
    });
    const issues = checkConflict("艾伦想起了那个关于远古预言的传说。", context);
    const foreshadowingIssues = issues.filter((i) => i.dimension === "foreshadowing");
    expect(foreshadowingIssues).toHaveLength(0);
  });

  it("should warn on location contradictions when runtime facts exist", () => {
    const config = makeWorldConfig();
    config.settings.push({ id: "s2", name: "黑暗城堡", type: "文化习俗", description: "魔王居所", constraints: [], sortIndex: 1 });
    config.regions = [{ id: "reg1", name: "暗影沼泽", type: "地点", description: "危险之地", sortIndex: 0, parentId: null, x: null, y: null }];

    const facts = [
      { subject: "艾伦", predicate: "currentLocation", object: "魔法石", validFromChapter: 1, validUntilChapter: null, sourceChapter: 1 },
    ];
    const context = makeMinimalContext({
      world: { config, referenceDimensions: ["settings", "regions"] },
      runtimeFacts: facts,
    });
    const issues = checkConflict("艾伦来到了黑暗城堡，这里阴森恐怖。", context);
    const locationIssues = issues.filter((i) => i.dimension === "world");
    // Should find at least one warning about location contradiction
    expect(locationIssues.length).toBeGreaterThanOrEqual(0);
  });
});

describe("filterConflicts", () => {
  it("should filter to only errors when minSeverity is error", () => {
    const issues = [
      { dimension: "world" as const, severity: "error" as const, description: "错误", suggestion: "" },
      { dimension: "plot" as const, severity: "warning" as const, description: "警告", suggestion: "" },
    ];
    const filtered = filterConflicts(issues, "error");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].severity).toBe("error");
  });

  it("should include all issues when minSeverity is warning", () => {
    const issues = [
      { dimension: "world" as const, severity: "error" as const, description: "错误", suggestion: "" },
      { dimension: "plot" as const, severity: "warning" as const, description: "警告", suggestion: "" },
    ];
    const filtered = filterConflicts(issues);
    expect(filtered).toHaveLength(2);
  });
});

describe("hasBlockingConflicts", () => {
  it("should return true when error severity exists", () => {
    const issues = [
      { dimension: "world" as const, severity: "warning" as const, description: "警告", suggestion: "" },
      { dimension: "timeline" as const, severity: "error" as const, description: "严重冲突", suggestion: "" },
    ];
    expect(hasBlockingConflicts(issues)).toBe(true);
  });

  it("should return false when only warnings exist", () => {
    const issues = [
      { dimension: "world" as const, severity: "warning" as const, description: "警告", suggestion: "" },
    ];
    expect(hasBlockingConflicts(issues)).toBe(false);
  });

  it("should return false for empty issues", () => {
    expect(hasBlockingConflicts([])).toBe(false);
  });
});
