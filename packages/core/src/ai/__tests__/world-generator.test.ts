// ── WorldGenerator Tests (Issue #102 — P3-1) ──

import { describe, it, expect } from "vitest";
import {
  buildChapterGeneratePrompt,
  buildCharacterGeneratePrompt,
  buildEventGeneratePrompt,
  parseChapterResponse,
  parseCharacterResponse,
  parseEventResponse,
  generateEntityId,
  DEFAULT_GENERATION_PARAMS,
  type GenerationParams,
  type WorldConfig,
} from "../world-generator.js";

// ── Fixture ──

const MOCK_WORLD: WorldConfig = {
  id: "test-world",
  name: "测试世界",
  description: "一个剑与魔法的奇幻世界。大陆上有三个主要种族：人类、精灵和兽人。",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  settings: [
    { id: "s1", name: "魔法体系", type: "魔法体系", description: "魔法需要消耗精神力", constraints: ["高级魔法需要施法材料"], sortIndex: 0 },
  ],
  roles: [
    { id: "r1", name: "艾伦", role: "主角", description: "人类少年，勇敢善良", significance: 5, sortIndex: 0, institutionIds: [], regionIds: [] },
    { id: "r2", name: "莉莉", role: "配角", description: "精灵公主，擅用弓箭", significance: 4, sortIndex: 1, institutionIds: [], regionIds: [] },
  ],
  relations: [
    { id: "rel1", sourceId: "r1", targetId: "r2", type: "伙伴", description: "并肩作战", sortIndex: 0 },
  ],
  regions: [
    { id: "reg1", name: "艾尔大陆", type: "大陆", description: "主大陆，三国鼎立", sortIndex: 0, parentId: null },
  ],
  institutions: [
    { id: "inst1", name: "光明教会", type: "组织", description: "信仰光明的宗教组织", leaderId: null, members: [], sortIndex: 0, regionId: null },
  ],
  history: [
    { id: "h1", title: "暗影战争", timestamp: "光明历1200年", description: "光明与黑暗的战争", significance: 5, sortIndex: 0, affectedRegions: ["reg1"] },
  ],
  rules: [
    { id: "rule1", name: "魔法守恒定律", type: "魔法", description: "释放魔法的能量来源于自然界", constraints: [], sortIndex: 0 },
  ],
  references: [],
};

const DEFAULT_PARAMS: GenerationParams = {
  creativity: 5,
  length: 2000,
  style: "热血",
  referenceDimensions: ["settings", "roles", "relations", "regions", "institutions", "history", "rules"],
};

// ── Tests ──

describe("buildChapterGeneratePrompt", () => {
  it("should build system and user prompts", () => {
    const { system, user } = buildChapterGeneratePrompt(MOCK_WORLD, DEFAULT_PARAMS);

    expect(system).toContain("章节内容");
    expect(system).toContain("JSON");
    expect(system).toContain("title");
    expect(system).toContain("content");

    expect(user).toContain("世界观: 测试世界");
    expect(user).toContain("剑与魔法");
    expect(user).toContain("艾伦");
    expect(user).toContain("魔法体系");
    expect(user).toContain("创意度: 5/10");
    expect(user).toContain("热血");
    expect(user).toContain("光明历1200年");
    expect(user).toContain("魔法守恒定律");
  });

  it("should include selected reference dimensions only", () => {
    const params: GenerationParams = { ...DEFAULT_PARAMS, referenceDimensions: ["settings", "roles"] };
    const { user } = buildChapterGeneratePrompt(MOCK_WORLD, params);

    expect(user).toContain("魔法体系");
    expect(user).toContain("艾伦");
    expect(user).not.toContain("艾尔大陆");
    expect(user).not.toContain("光明教会");
  });
});

describe("buildCharacterGeneratePrompt", () => {
  it("should build character generation prompts", () => {
    const { system, user } = buildCharacterGeneratePrompt(MOCK_WORLD, DEFAULT_PARAMS);

    expect(system).toContain("角色设计师");
    expect(system).toContain("新角色");
    expect(system).toContain("significance");

    expect(user).toContain("世界观: 测试世界");
    expect(user).toContain("艾伦");
    expect(user).toContain("莉莉");
  });
});

describe("buildEventGeneratePrompt", () => {
  it("should build event generation prompts", () => {
    const { system, user } = buildEventGeneratePrompt(MOCK_WORLD, DEFAULT_PARAMS);

    expect(system).toContain("历史事件");
    expect(system).toContain("timestamp");
    expect(system).toContain("affectedRegions");

    expect(user).toContain("暗影战争");
    expect(user).toContain("艾尔大陆");
  });
});

describe("parseChapterResponse", () => {
  it("should parse valid JSON array of chapters", () => {
    const raw = JSON.stringify([
      { title: "第一章 启程", content: "清晨的阳光洒在艾尔大陆上...", suggestedChapterNumber: 1 },
      { title: "第二章 危机", content: "暗影再次笼罩...", suggestedChapterNumber: 2 },
    ]);
    const result = parseChapterResponse(raw, raw);

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("第一章 启程");
    expect(result[0].content).toBe("清晨的阳光洒在艾尔大陆上...");
    expect(result[0].suggestedChapterNumber).toBe(1);
    expect(result[1].title).toBe("第二章 危机");
  });

  it("should extract from markdown code block", () => {
    const text = "```json\n[\n  { \"title\": \"测试\", \"content\": \"正文\", \"suggestedChapterNumber\": 0 }\n]\n```";
    const result = parseChapterResponse(text, text);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("测试");
  });

  it("should handle empty input", () => {
    const result = parseChapterResponse("", "");
    expect(result).toEqual([]);
  });

  it("should handle non-JSON input", () => {
    const result = parseChapterResponse("抱歉，我无法生成章节。", "");
    expect(result).toEqual([]);
  });

  it("should parse wrapped object with candidates", () => {
    const raw = JSON.stringify({
      candidates: [
        { title: "候选1", content: "正文内容...", suggestedChapterNumber: 0 },
      ],
    });
    const result = parseChapterResponse(raw, raw);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("候选1");
  });
});

describe("parseCharacterResponse", () => {
  it("should parse valid JSON array of characters", () => {
    const raw = JSON.stringify([
      { name: "赵云", role: "主角", description: "勇猛的战士", significance: 5, traits: ["勇敢", "忠诚"] },
      { name: "貂蝉", role: "配角", description: "美丽的舞姬", significance: 3, traits: ["机智"] },
    ]);
    const result = parseCharacterResponse(raw, raw);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("赵云");
    expect(result[0].role).toBe("主角");
    expect(result[0].significance).toBe(5);
    expect(result[0].traits).toEqual(["勇敢", "忠诚"]);
    expect(result[1].name).toBe("貂蝉");
  });

  it("should clamp significance to 1-5 range", () => {
    const raw = JSON.stringify([
      { name: "神", role: "中立", description: "全能的", significance: 99, traits: [] },
      { name: "虫", role: "配角", description: "渺小的", significance: -5, traits: [] },
    ]);
    const result = parseCharacterResponse(raw, raw);

    expect(result[0].significance).toBe(5);
    expect(result[1].significance).toBe(1);
  });

  it("should handle empty array", () => {
    const result = parseCharacterResponse("[]", "[]");
    expect(result).toEqual([]);
  });
});

describe("parseEventResponse", () => {
  it("should parse valid JSON array of events", () => {
    const raw = JSON.stringify([
      { title: "天降陨石", timestamp: "光明历1300年", description: "巨大的陨石坠落", significance: 4, affectedRegions: ["reg1"] },
    ]);
    const result = parseEventResponse(raw, raw);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("天降陨石");
    expect(result[0].timestamp).toBe("光明历1300年");
    expect(result[0].significance).toBe(4);
    expect(result[0].affectedRegions).toEqual(["reg1"]);
  });

  it("should extract JSON array from text", () => {
    const text = `这是前置文本\n[\n  { "title": "新事件", "timestamp": "历元年", "description": "描述", "significance": 3, "affectedRegions": [] }\n]\n后续文本`;
    const result = parseEventResponse(text, text);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("新事件");
  });
});

describe("generateEntityId", () => {
  it("should generate unique IDs with prefix", () => {
    const id1 = generateEntityId("ch");
    const id2 = generateEntityId("ch");

    expect(id1).toMatch(/^ch_[a-z0-9]+_[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });

  it("should generate different IDs on each call", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateEntityId("test")));
    expect(ids.size).toBe(100);
  });
});

describe("DEFAULT_GENERATION_PARAMS", () => {
  it("should have all 7 dimensions by default", () => {
    expect(DEFAULT_GENERATION_PARAMS.referenceDimensions).toHaveLength(7);
    expect(DEFAULT_GENERATION_PARAMS.referenceDimensions).toContain("settings");
    expect(DEFAULT_GENERATION_PARAMS.referenceDimensions).toContain("rules");
  });
});
