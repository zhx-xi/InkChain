// ── WorldExtractor Tests (Wrld-7) ──

import { describe, it, expect } from "vitest";
import {
  extractWorldFromText,
  splitSections,
  extractEntities,
  summarizeExtraction,
} from "../world-extractor.js";
import type { ExtractedWorld } from "../world-extractor.js";

// ── Fixtures ──

const SIMPLE_MD_FIXTURE = `# 世界观设定

这是一个剑与魔法的奇幻世界。大陆上有三个主要种族：人类、精灵和兽人。

## 物理规则

魔法需要消耗精神力，使用过度会导致精神反噬。
高级魔法需要施法材料辅助。

## 角色

- 艾伦: 人类少年，勇敢善良
- 莉莉: 精灵公主，擅用弓箭
- 格罗姆: 兽人战士，粗犷豪迈

## 地理区域

- 艾尔大陆: 主大陆，三国鼎立
- 翡翠森林: 精灵族的家园
- 铁壁要塞: 人类王国的军事重镇

## 关系

- 艾伦和莉莉: 并肩作战的伙伴
- 格罗姆和艾伦: 亦敌亦友

## 组织势力

- 光明教会: 信仰光明的宗教组织
- 暗影议会: 操控黑暗势力的秘密组织

## 历史

- 光明历1000年: 精灵族与人类结成同盟
- 光明历1200年: 暗影战争爆发
- 光明历1250年: 战争结束，三国重归和平

## 世界规则

1. 魔法守恒定律: 释放魔法的能量来源于自然界
2. 生命等价: 任何生命都不能被无代价地创造或消灭
`;

const PLAIN_TEXT_FIXTURE = `这个世界设定在一个魔法与科技并存的世界。

主要角色有小明、小红和老王。小明是一个勇敢的少年，擅长使用火焰魔法。小红是一个聪明的女孩，精通机械工程。

大陆分为东大陆和西大陆，中间被无尽之海隔开。

东大陆有三大帝国：炎龙帝国、冰风帝国和雷霆帝国。

历史上有过三次大型战争，第一次是魔法战争，第二次是机械革命，第三次是融合之战。`;

const NO_HEADINGS_FIXTURE = `世界设定：
这是一个后末日的废土世界。核战争摧毁了旧文明，幸存者在废墟中重建社会。

主要角色：
- 陈锋：前军人，擅长生存技巧
- 林薇：科学家，寻找恢复文明的方法

地点：
- 铁锈城：最大的幸存者聚居地
- 绿洲镇：少数未被污染的区域

势力：
- 复兴会：致力于重建旧文明
- 废土帮：依靠掠夺为生的组织`;

// ── Tests ──

describe("splitSections", () => {
  it("should split simple markdown into sections", () => {
    const sections = splitSections(SIMPLE_MD_FIXTURE);
    expect(sections.length).toBeGreaterThanOrEqual(7);
    expect(sections[0].heading).toBe("世界观设定");
    expect(sections[0].dimension).toBe("settings");
  });

  it("should handle plain text without headings", () => {
    const sections = splitSections(PLAIN_TEXT_FIXTURE);
    expect(sections.length).toBe(0);
  });

  it("should handle colon-style headings", () => {
    const sections = splitSections(NO_HEADINGS_FIXTURE);
    expect(sections.length).toBe(0);
  });
});

describe("extractEntities", () => {
  it("should extract entities from bullet list with colon separator", () => {
    const text = "- 艾伦: 人类少年\n- 莉莉: 精灵公主";
    const entities = extractEntities(text, "roles");
    expect(entities.length).toBe(2);
    expect(entities[0].name).toBe("艾伦");
    expect(entities[0].description).toBe("人类少年");
    expect(entities[1].name).toBe("莉莉");
    expect(entities[1].description).toBe("精灵公主");
  });

  it("should extract entities with Chinese parentheses", () => {
    const text = "- 光明教会（信仰光明的宗教组织）";
    const entities = extractEntities(text, "institutions");
    expect(entities.length).toBe(1);
    expect(entities[0].name).toBe("光明教会");
    expect(entities[0].description).toBe("信仰光明的宗教组织");
  });

  it("should extract entities with dash separator", () => {
    const text = "- 艾伦 —— 人类少年";
    const entities = extractEntities(text, "roles");
    expect(entities.length).toBe(1);
    expect(entities[0].name).toBe("艾伦");
    expect(entities[0].description).toBe("人类少年");
  });

  it("should return empty for text with no matches", () => {
    const text = "这是一段普通文本，没有实体定义。";
    const entities = extractEntities(text, "settings");
    expect(entities.length).toBe(0);
  });
});

describe("extractWorldFromText", () => {
  it("should extract all 7 dimensions from well-structured markdown", () => {
    const result = extractWorldFromText(SIMPLE_MD_FIXTURE);
    const { world } = result;

    expect(world.settings).toContain("剑与魔法");
    expect(world.settings).toContain("精灵和兽人");

    expect(world.roles).toContain("艾伦");
    expect(world.roles).toContain("莉莉");
    expect(world.roles).toContain("格罗姆");

    expect(world.relations).toContain("艾伦和莉莉");
    expect(world.regions).toContain("艾尔大陆");
    expect(world.institutions).toContain("光明教会");
    expect(world.history).toContain("暗影战争");
    expect(world.rules).toContain("魔法守恒定律");

    expect(result.entities.length).toBeGreaterThanOrEqual(10);
    expect(result.sections.length).toBeGreaterThanOrEqual(7);
  });

  it("should extract from plain text using keyword scoring", () => {
    const result = extractWorldFromText(PLAIN_TEXT_FIXTURE);
    const { world } = result;

    expect(world.roles).toContain("小明");
    expect(world.regions).toContain("东大陆");
    expect(world.institutions).toContain("炎龙帝国");
    expect(world.history).toContain("三次大型战争");
  });

  it("should extract from colon-style headings", () => {
    const result = extractWorldFromText(NO_HEADINGS_FIXTURE);
    const { world } = result;

    expect(world.settings).toContain("后末日");
    expect(world.roles).toContain("陈锋");
    expect(world.regions).toContain("铁锈城");
    expect(world.institutions).toContain("复兴会");
  });

  it("should handle empty text", () => {
    const result = extractWorldFromText("");
    const { world } = result;

    expect(world.settings).toBe("");
    expect(world.roles).toBe("");
    expect(world.relations).toBe("");
    expect(world.regions).toBe("");
    expect(world.institutions).toBe("");
    expect(world.history).toBe("");
    expect(world.rules).toBe("");

    expect(result.entities.length).toBe(0);
    expect(result.sections.length).toBe(0);
  });

  it("should handle single-line text", () => {
    const result = extractWorldFromText("这是一个简单的世界观设定。");
    const { world } = result;

    // Single line with keywords "世界观" and "设定" should be scored into settings
    expect(world.settings.length).toBeGreaterThan(0);
    expect(world.settings).toContain("世界观设定");
  });

  it("should produce consistent empty strings for missing dimensions", () => {
    const text = "# 角色\n- 小明: 主角";
    const result = extractWorldFromText(text);
    const { world } = result;

    expect(world.roles).toContain("小明");
    expect(world.settings).toBe("");
    expect(world.relations).toBe("");
    expect(world.regions).toBe("");
    expect(world.institutions).toBe("");
    expect(world.history).toBe("");
    expect(world.rules).toBe("");
  });
});

describe("summarizeExtraction", () => {
  it("should produce a readable summary", () => {
    const result = extractWorldFromText(SIMPLE_MD_FIXTURE);
    const summary = summarizeExtraction(result);

    expect(summary).toContain("提取报告");
    expect(summary).toContain("个章节");
    expect(summary).toContain("个实体");
  });

  it("should handle empty result", () => {
    const result = extractWorldFromText("");
    const summary = summarizeExtraction(result);

    expect(summary).toContain("提取报告");
  });
});
