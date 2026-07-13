import { describe, expect, it } from "vitest";
import {
  normalizeParsedResult,
  parseProposalsFromLLMResponse,
} from "../relation-extractor.js";

// ── normalizeParsedResult: characterTiers extraction ──

describe("normalizeParsedResult — characterTiers", () => {
  it("should extract characterTiers from parsed result", () => {
    const result = normalizeParsedResult({
      proposals: [
        {
          sourceId: "林峰",
          targetId: "苏婉清",
          relationshipType: "close_friend",
          confidence: 0.95,
          evidence: "林峰望着苏婉清微微一笑。",
        },
      ],
      sourceCharacters: ["林峰", "苏婉清"],
      characterTiers: {
        "林峰": "protagonist",
        "苏婉清": "supporting",
      },
    });

    expect(result).not.toBeNull();
    expect(result!.characterTiers).toEqual({
      "林峰": "protagonist",
      "苏婉清": "supporting",
    });
  });

  it("should return empty characterTiers when not provided", () => {
    const result = normalizeParsedResult({
      proposals: [
        {
          sourceId: "A",
          targetId: "B",
          relationshipType: "rival",
          confidence: 0.8,
          evidence: "A与B对峙。",
        },
      ],
      sourceCharacters: ["A", "B"],
    });

    expect(result).not.toBeNull();
    expect(result!.characterTiers).toEqual({});
  });

  it("should return empty characterTiers for empty proposals", () => {
    const result = normalizeParsedResult({
      proposals: [],
      sourceCharacters: [],
      characterTiers: { "林峰": "protagonist" },
    });

    expect(result).not.toBeNull();
    expect(result!.proposals).toEqual([]);
    expect(result!.characterTiers).toEqual({ "林峰": "protagonist" });
  });

  it("should filter out invalid tier values", () => {
    const result = normalizeParsedResult({
      proposals: [
        {
          sourceId: "X",
          targetId: "Y",
          relationshipType: "alliance",
          confidence: 0.7,
          evidence: "X与Y合作。",
        },
      ],
      sourceCharacters: ["X", "Y", "Z"],
      characterTiers: {
        "X": "protagonist",
        "Y": "invalid_tier",
        "Z": "one_shot",
      },
    });

    expect(result).not.toBeNull();
    expect(result!.characterTiers).toEqual({
      "X": "protagonist",
      "Z": "one_shot",
    });
    expect(result!.characterTiers["Y"]).toBeUndefined();
  });

  it("should accept all valid CharacterTier values", () => {
    const result = normalizeParsedResult({
      proposals: [],
      sourceCharacters: ["A", "B", "C", "D", "E"],
      characterTiers: {
        "A": "protagonist",
        "B": "supporting",
        "C": "guest",
        "D": "one_shot",
        "E": "scene",
      },
    });

    expect(result).not.toBeNull();
    expect(result!.characterTiers).toEqual({
      "A": "protagonist",
      "B": "supporting",
      "C": "guest",
      "D": "one_shot",
      "E": "scene",
    });
  });

  it("should handle non-object characterTiers gracefully", () => {
    const result = normalizeParsedResult({
      proposals: [
        {
          sourceId: "A",
          targetId: "B",
          relationshipType: "blood",
          confidence: 0.9,
          evidence: "A是B的兄弟。",
        },
      ],
      sourceCharacters: ["A", "B"],
      characterTiers: "not-an-object",
    });

    expect(result).not.toBeNull();
    expect(result!.characterTiers).toEqual({});
  });

  it("should handle empty characterTiers object", () => {
    const result = normalizeParsedResult({
      proposals: [],
      sourceCharacters: [],
      characterTiers: {},
    });

    expect(result).not.toBeNull();
    expect(result!.characterTiers).toEqual({});
  });

  it("should handle proposals from all-relation (no proposals key)", () => {
    const result = normalizeParsedResult({
      sourceId: "A",
      targetId: "B",
      relationshipType: "mentor",
      confidence: 0.85,
      evidence: "A教导B。",
      sourceCharacters: ["A", "B"],
      characterTiers: {
        "A": "protagonist",
        "B": "supporting",
      },
    });

    // When there's no "proposals" key, the parsed object itself is treated as a single proposal
    expect(result).not.toBeNull();
    expect(result!.characterTiers).toEqual({
      "A": "protagonist",
      "B": "supporting",
    });
  });
});

// ── parseProposalsFromLLMResponse ──

describe("parseProposalsFromLLMResponse — characterTiers", () => {
  it("should parse characterTiers from raw JSON", () => {
    const json = JSON.stringify({
      proposals: [
        {
          sourceId: "林峰",
          targetId: "苏婉清",
          relationshipType: "close_friend",
          confidence: 0.95,
          evidence: "林峰望着苏婉清微微一笑。",
        },
      ],
      sourceCharacters: ["林峰", "苏婉清"],
      characterTiers: {
        "林峰": "protagonist",
        "苏婉清": "supporting",
      },
    });

    const result = parseProposalsFromLLMResponse(json);
    expect(result).not.toBeNull();
    expect(result!.characterTiers).toEqual({
      "林峰": "protagonist",
      "苏婉清": "supporting",
    });
  });

  it("should parse characterTiers from code-block-wrapped JSON", () => {
    const json = `
\`\`\`json
{
  "proposals": [],
  "sourceCharacters": ["张三", "李四"],
  "characterTiers": {
    "张三": "protagonist",
    "李四": "one_shot"
  }
}
\`\`\`
    `;

    const result = parseProposalsFromLLMResponse(json);
    expect(result).not.toBeNull();
    expect(result!.characterTiers).toEqual({
      "张三": "protagonist",
      "李四": "one_shot",
    });
  });

  it("should parse response without characterTiers field", () => {
    const json = JSON.stringify({
      proposals: [],
      sourceCharacters: ["张三"],
    });

    const result = parseProposalsFromLLMResponse(json);
    expect(result).not.toBeNull();
    expect(result!.characterTiers).toEqual({});
  });

  it("should parse empty result with empty characterTiers", () => {
    const json = JSON.stringify({
      proposals: [],
      sourceCharacters: [],
      characterTiers: {},
    });

    const result = parseProposalsFromLLMResponse(json);
    expect(result).not.toBeNull();
    expect(result!.proposals).toEqual([]);
    expect(result!.characterTiers).toEqual({});
  });

  it("should return null for malformed JSON", () => {
    const result = parseProposalsFromLLMResponse("this is not json");
    expect(result).toBeNull();
  });
});

// ── ExtractionResult type contract ──

describe("ExtractionResult — characterTiers type contract", () => {
  it("characterTiers field should exist on ExtractionResult", () => {
    // This validates the type contract at runtime
    const result = normalizeParsedResult({
      proposals: [],
      sourceCharacters: ["主角A"],
      characterTiers: { "主角A": "protagonist" },
    });

    expect(result).toHaveProperty("characterTiers");
    expect(typeof result!.characterTiers).toBe("object");
  });

  it("should preserve characterTiers through full extraction flow", () => {
    // Simulate the full flow: parse -> assign IDs -> return
    const parsed = parseProposalsFromLLMResponse(JSON.stringify({
      proposals: [
        {
          sourceId: "A",
          targetId: "B",
          relationshipType: "close_friend",
          confidence: 0.9,
          evidence: "证据",
        },
      ],
      sourceCharacters: ["A", "B"],
      characterTiers: {
        "A": "protagonist",
        "B": "supporting",
      },
    }));

    expect(parsed).not.toBeNull();
    expect(parsed!.characterTiers["A"]).toBe("protagonist");
    expect(parsed!.characterTiers["B"]).toBe("supporting");
  });
});
