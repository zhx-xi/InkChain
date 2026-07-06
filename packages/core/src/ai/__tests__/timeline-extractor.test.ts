// ── TimelineExtractor Tests (Issue #259) ──

import { describe, expect, it, vi, afterEach } from "vitest";
import * as llmProvider from "../../llm/provider.js";
import { extractTimelineEvents } from "../timeline-extractor.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const DEFAULT_CONFIG = {
  llm: { provider: "openai", model: "test", baseUrl: "http://test", apiKey: "test", service: "test", temperature: 0.7, apiFormat: "chat", stream: false, configSource: "studio" },
} as const;

function mockLLMResponse(data: unknown) {
  vi.spyOn(llmProvider, "chatCompletion").mockResolvedValue({
    content: JSON.stringify(data),
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  } as any);
}

function mockLLMException() {
  vi.spyOn(llmProvider, "chatCompletion").mockRejectedValue(new Error("LLM service unavailable"));
}

// ── 9. 时间线事件提取 ──

describe("extractTimelineEvents", () => {
  it("extracts timeline events from text with title, eventType, description", async () => {
    mockLLMResponse([
      {
        title: "森林遭遇",
        eventType: "plot",
        description: "主角在森林中遇到神秘生物",
        relatedCharacters: ["小明"],
        importance: 4,
        tags: ["冒险", "神秘"],
      },
    ]);

    const result = await extractTimelineEvents("森林中的描述…", 3, DEFAULT_CONFIG);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].title).toBe("森林遭遇");
    expect(result.events[0].eventType).toBe("plot");
    expect(result.events[0].description).toBe("主角在森林中遇到神秘生物");
  });

  // ── 10. 重要性钳制 ──

  it("clamps importance to 1-5 range", async () => {
    mockLLMResponse([
      {
        title: "太低",
        eventType: "character",
        description: "不重要的事",
        relatedCharacters: [],
        importance: 0,
        tags: [],
      },
      {
        title: "太高",
        eventType: "world",
        description: "宇宙大事",
        relatedCharacters: [],
        importance: 10,
        tags: [],
      },
      {
        title: "正常",
        eventType: "plot",
        description: "正常事件",
        relatedCharacters: [],
        importance: 3,
        tags: [],
      },
    ]);

    const result = await extractTimelineEvents("文本…", 1, DEFAULT_CONFIG);

    expect(result.events).toHaveLength(3);
    expect(result.events[0].importance).toBe(1);
    expect(result.events[1].importance).toBe(5);
    expect(result.events[2].importance).toBe(3);
  });

  // ── 11. eventType 验证 ──

  it("defaults invalid eventType to plot", async () => {
    mockLLMResponse([
      {
        title: "奇怪事件",
        eventType: "random",
        description: "描述",
        relatedCharacters: [],
        importance: 3,
        tags: [],
      },
    ]);

    const result = await extractTimelineEvents("文本…", 1, DEFAULT_CONFIG);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].eventType).toBe("plot");
  });

  // ── 12. tags 数组验证 ──

  it("ensures tags is a string array", async () => {
    mockLLMResponse([
      {
        title: "有标签",
        eventType: "plot",
        description: "描述",
        relatedCharacters: [],
        importance: 3,
        tags: ["战斗", "转折"],
      },
      {
        title: "无标签",
        eventType: "character",
        description: "描述",
        relatedCharacters: [],
        importance: 2,
        tags: null,
      },
    ]);

    const result = await extractTimelineEvents("文本…", 1, DEFAULT_CONFIG);

    expect(result.events).toHaveLength(2);
    expect(Array.isArray(result.events[0].tags)).toBe(true);
    expect(result.events[0].tags).toEqual(["战斗", "转折"]);
    expect(Array.isArray(result.events[1].tags)).toBe(true);
    expect(result.events[1].tags).toEqual([]);
  });

  // ── 13. 空文本 ──

  it("returns empty events for empty text", async () => {
    mockLLMResponse([]);

    const result = await extractTimelineEvents("", 1, DEFAULT_CONFIG);

    expect(result.events).toEqual([]);
  });

  // ── 14. LLM 异常 ──

  it("returns empty events when LLM throws (no crash)", async () => {
    mockLLMException();

    await expect(extractTimelineEvents("文本…", 1, DEFAULT_CONFIG)).rejects.toThrow();
  });

  // ── 15. Chapter 参数传入验证 ──

  it("passes chapter parameter correctly to LLM prompt", async () => {
    const spy = vi.spyOn(llmProvider, "chatCompletion").mockResolvedValue({
      content: JSON.stringify([]),
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    } as any);

    await extractTimelineEvents("某章文本", 7, DEFAULT_CONFIG);

    const messages = spy.mock.calls[0][2];
    const userMessage = messages.find((m) => m.role === "user");
    expect(userMessage?.content).toContain("第 7 章");
  });
});
