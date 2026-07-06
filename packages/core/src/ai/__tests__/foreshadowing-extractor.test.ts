// ── ForeshadowingExtractor Tests (Issue #259) ──

import { describe, expect, it, vi, afterEach } from "vitest";
import * as llmProvider from "../../llm/provider.js";
import { extractForeshadowings } from "../foreshadowing-extractor.js";

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

function mockLLMContent(content: string) {
  vi.spyOn(llmProvider, "chatCompletion").mockResolvedValue({
    content,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  } as any);
}

// ── 1. 情节伏笔 ──

describe("extractForeshadowings", () => {
  it("extracts plot foreshadowing from chapter text", async () => {
    mockLLMResponse([
      {
        title: "神秘黑影",
        type: "情节伏笔",
        description: "描述",
        expectedPayoffChapter: 10,
        confidence: 0.8,
      },
    ]);

    const result = await extractForeshadowings("章节文本描述…", 5, DEFAULT_CONFIG);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].title).toBe("神秘黑影");
    expect(result.candidates[0].type).toBe("情节伏笔");
  });

  // ── 2. 角色伏笔 ──

  it("extracts character foreshadowing", async () => {
    mockLLMResponse([
      {
        title: "神秘身份",
        type: "角色伏笔",
        description: "角色身份暗示",
        expectedPayoffChapter: null,
        confidence: 0.7,
      },
    ]);

    const result = await extractForeshadowings("角色相关描述…", 3, DEFAULT_CONFIG);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].type).toBe("角色伏笔");
  });

  // ── 3. 空文本 ──

  it("returns empty candidates for empty text", async () => {
    mockLLMResponse([]);

    const result = await extractForeshadowings("", 1, DEFAULT_CONFIG);

    expect(result.candidates).toEqual([]);
  });

  // ── 4. 置信度过滤 ──

  it("filters out candidates with confidence < 0.3", async () => {
    mockLLMResponse([
      {
        title: "低可信",
        type: "情节伏笔",
        description: "不太像",
        expectedPayoffChapter: null,
        confidence: 0.2,
      },
      {
        title: "高可信",
        type: "物品伏笔",
        description: "很可能是",
        expectedPayoffChapter: 8,
        confidence: 0.9,
      },
    ]);

    const result = await extractForeshadowings("文本…", 1, DEFAULT_CONFIG);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].title).toBe("高可信");
  });

  // ── 5. 无效 JSON ──

  it("gracefully handles invalid JSON from LLM", async () => {
    mockLLMContent("抱歉，我没有找到任何伏笔。");

    const result = await extractForeshadowings("文本…", 1, DEFAULT_CONFIG);

    expect(result.candidates).toEqual([]);
  });

  // ── 6. 类型验证 ──

  it("defaults invalid type to 情节伏笔", async () => {
    mockLLMResponse([
      {
        title: "奇怪伏笔",
        type: "随机类型",
        description: "描述",
        expectedPayoffChapter: null,
        confidence: 0.6,
      },
    ]);

    const result = await extractForeshadowings("文本…", 1, DEFAULT_CONFIG);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].type).toBe("情节伏笔");
  });

  // ── 7. expectedPayoffChapter 验证 ──

  it("expectedPayoffChapter is null or positive integer", async () => {
    mockLLMResponse([
      {
        title: "伏笔A",
        type: "设定伏笔",
        description: "描述A",
        expectedPayoffChapter: null,
        confidence: 0.7,
      },
      {
        title: "伏笔B",
        type: "物品伏笔",
        description: "描述B",
        expectedPayoffChapter: 15,
        confidence: 0.8,
      },
    ]);

    const result = await extractForeshadowings("文本…", 1, DEFAULT_CONFIG);

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].expectedPayoffChapter).toBeNull();
    expect(result.candidates[1].expectedPayoffChapter).toBe(15);
  });

  // ── 8. currentChapter 传入验证 ──

  it("passes currentChapter correctly to LLM prompt", async () => {
    const spy = vi.spyOn(llmProvider, "chatCompletion").mockResolvedValue({
      content: JSON.stringify([]),
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    } as any);

    await extractForeshadowings("某章文本", 42, DEFAULT_CONFIG);

    const messages = spy.mock.calls[0][2];
    const userMessage = messages.find((m) => m.role === "user");
    expect(userMessage?.content).toContain("第 42 章");
  });
});
