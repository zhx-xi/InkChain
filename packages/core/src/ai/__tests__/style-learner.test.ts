import { describe, expect, it } from "vitest";
import { analyzeDialogue, analyzeTone, learnStyle } from "../style-learner.js";
import { profileToConstraints, formatStyleConstraintsSection } from "../generation-constraints.js";

describe("analyzeDialogue (AI-2)", () => {
  it("detects dialogue ratio in Chinese text", () => {
    const text = `「你今天去哪里了？」他问。
「我去图书馆了。」她回答。
「找到了什么好书吗？」
「当然，这本小说非常精彩。」
他点了点头，继续看书。窗外阳光明媚。`;
    const stats = analyzeDialogue(text, "zh");
    expect(stats.dialogueRatio).toBeGreaterThan(0);
    expect(stats.avgDialogueRun).toBeGreaterThan(0);
  });

  it("returns zero ratio for text without dialogue", () => {
    const text = "这是一个没有对话的段落。只是纯叙述。描述景物和动作。";
    const stats = analyzeDialogue(text, "zh");
    expect(stats.dialogueRatio).toBe(0);
  });

  it("analyzes English dialogue", () => {
    const text = `"Where are you going?" he asked.
"The library," she replied.
"Find anything good?"
"Yes, this novel is amazing."`;
    const stats = analyzeDialogue(text, "en");
    expect(stats.dialogueRatio).toBeGreaterThan(0);
  });
});

describe("analyzeTone (AI-2)", () => {
  it("analyzes positive Chinese text", () => {
    const text = "这是一个美好的故事。温暖的光明照耀着大地。幸福的人们快乐地生活着。灿烂的阳光洒满每个角落。";
    const tone = analyzeTone(text, "zh");
    expect(tone.sentimentScore).toBeGreaterThan(0);
  });

  it("analyzes negative Chinese text", () => {
    const text = "黑暗笼罩着大地。痛苦和绝望在蔓延。悲伤的人们孤独地哭泣。阴森的气氛让人恐惧。";
    const tone = analyzeTone(text, "zh");
    expect(tone.sentimentScore).toBeLessThan(0);
  });

  it("classifies neutral text as neutral", () => {
    const text = "桌子上面放着一本书。窗户是开着的。门关上了。他走了进去。";
    const tone = analyzeTone(text, "zh");
    expect(tone.dominantTone).toContain("neutral");
  });
});

describe("learnStyle (AI-2)", () => {
  it("produces a full EnhancedStyleProfile", () => {
    const profile = learnStyle([
      "这是一个测试段落。包含多个句子。用来测试风格学习功能。",
      "另一个段落。这里有更多内容。用来丰富样本数据。",
    ]);
    expect(profile.avgSentenceLength).toBeGreaterThan(0);
    expect(profile.vocabularyDiversity).toBeGreaterThan(0);
    expect(profile.autoAnalyzed).toBe(true);
    expect(profile.language).toBe("zh");
  });

  it("includes dialogue stats when config allows", () => {
    const profile = learnStyle([
      "「你好！」他说。「你好！」她回答。",
    ], "zh", { sampleSize: 1, includeDialogue: true, includeTone: false });
    expect(profile.dialogue).toBeDefined();
    expect(profile.tone).toBeUndefined();
  });

  it("includes tone stats when config allows", () => {
    const profile = learnStyle([
      "美好的阳光温暖地洒在大地上。幸福的人们快乐地生活着。",
    ], "zh", { sampleSize: 1, includeDialogue: false, includeTone: true });
    expect(profile.tone).toBeDefined();
    expect(profile.dialogue).toBeUndefined();
  });
});

describe("profileToConstraints (AI-2)", () => {
  it("generates constraints from a profile", () => {
    const profile = learnStyle([
      "这是一个测试。包含多个句子。用来测试。",
      "另一个测试。这里也有内容。",
    ]);
    const constraints = profileToConstraints(profile);
    expect(constraints.length).toBeGreaterThan(0);
    expect(constraints.some((c) => c.severity === "strict" || c.severity === "suggest")).toBe(true);
  });

  it("includes dialogue constraint when dialogue data present", () => {
    const profile = learnStyle([
      "「你好！」张三说。「你好吗？」李四问。",
    ], "zh", { sampleSize: 1, includeDialogue: true, includeTone: false });
    const constraints = profileToConstraints(profile);
    expect(constraints.some((c) => c.description.includes("对话"))).toBe(true);
  });

  it("formats constraints section in Chinese", () => {
    const profile = learnStyle(["测试文本。多个句子。风格分析。"]);
    const constraints = profileToConstraints(profile);
    const section = formatStyleConstraintsSection(constraints, "zh");
    expect(section).toContain("风格约束");
  });
});
