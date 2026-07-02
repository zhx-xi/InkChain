import { describe, it, expect } from "vitest";
import { qidianAdapter } from "../qidian.js";
import { fanqieAdapter } from "../fanqie.js";
import type { PublishChapter } from "../index.js";
import type { BookConfig } from "../../models/book.js";

// ── Sample data ──
// Each chapter has sufficient text to pass validation (total > 10000 chars)

function makeChapter(number: number, title: string, text: string): PublishChapter {
  return {
    meta: {
      number,
      title,
      status: "drafted" as const,
      wordCount: text.length,
      createdAt: `2025-01-0${number}T00:00:00Z`,
      updatedAt: `2025-01-0${number}T00:00:00Z`,
      auditIssues: [],
      lengthWarnings: [],
    },
    text,
  };
}

const longPara =
  "夜幕降临，城市华灯初上。林轩站在天台上，望着远方。他想起三年前的那个雨夜。" +
  "她还好吗？他低声自语。风吹过他的脸颊，带来了一丝凉意。" +
  "这座城市的夜晚总是那么繁忙，霓虹灯闪烁，车水马龙。但他却感到前所未有的孤独。" +
  "三年前的那个决定，改变了他的一生。如果时光可以倒流，他会不会做出同样的选择？" +
  "手机震动了，是一条短信。他看了一眼，嘴角露出一丝苦笑。" +
  "该面对的终究还是要面对。他深吸一口气，转身走下天台。";

const longText = longPara + "\n\n" + longPara + "\n\n" + longPara + "\n\n" + longPara + "\n\n" + longPara + "\n\n" +
  longPara + "\n\n" + longPara + "\n\n" + longPara + "\n\n" + longPara + "\n\n" + longPara + "\n\n" +
  longPara + "\n\n" + longPara + "\n\n" + longPara + "\n\n" + longPara + "\n\n" + longPara + "\n\n" +
  longPara + "\n\n" + longPara + "\n\n" + longPara + "\n\n" + longPara + "\n\n" + longPara + "\n\n" +
  longPara + "\n\n" + longPara + "\n\n" + longPara + "\n\n" + longPara + "\n\n" + longPara;

const shortText = longText;

const sampleChapters: PublishChapter[] = [
  makeChapter(1, "楔子", longText),
  makeChapter(2, "重逢", shortText),
  makeChapter(3, "往事", shortText),
  makeChapter(4, "真相", shortText),
  makeChapter(5, "决定", shortText),
];

const sampleBookConfig: BookConfig = {
  id: "test-book",
  title: "测试小说",
  platform: "qidian",
  genre: "都市",
  status: "active",
  targetChapters: 200,
  chapterWordCount: 3000,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

// ── Qidian Adapter ──

describe("qidianAdapter", () => {
  describe("getName", () => {
    it("returns platform display name", () => {
      expect(qidianAdapter.getName()).toBe("起点中文网");
    });
  });

  describe("formatChapter", () => {
    it("formats chapter with title", () => {
      const result = qidianAdapter.formatChapter(sampleChapters[0], 1);
      expect(result).toContain("第一章");
      expect(result).toContain("楔子");
    });

    it("formats chapter without title gracefully", () => {
      const ch: PublishChapter = {
        ...sampleChapters[0],
        meta: { ...sampleChapters[0].meta, title: "" },
      };
      const result = qidianAdapter.formatChapter(ch, 2);
      expect(result).toContain("第二章");
    });

    it("preserves paragraph structure", () => {
      const result = qidianAdapter.formatChapter(sampleChapters[0], 1);
      const paragraphs = result.split("\n\n").filter(Boolean);
      expect(paragraphs.length).toBeGreaterThanOrEqual(3);
    });

    it("handles empty content", () => {
      const ch: PublishChapter = {
        meta: sampleChapters[0].meta,
        text: "",
      };
      const result = qidianAdapter.formatChapter(ch, 1);
      expect(result).toContain("第一章");
    });
  });

  describe("validateRequirements", () => {
    it("passes when all requirements are met", () => {
      const warnings = qidianAdapter.validateRequirements(sampleBookConfig, sampleChapters);
      const errors = warnings.filter((w) => w.severity === "error");
      expect(errors).toHaveLength(0);
    });

    it("fails when fewer than 5 chapters", () => {
      const warnings = qidianAdapter.validateRequirements(sampleBookConfig, sampleChapters.slice(0, 3));
      const errors = warnings.filter((w) => w.severity === "error");
      expect(errors.some((e) => e.field === "chapters")).toBe(true);
    });

    it("fails when total word count below 10000", () => {
      const shortChapters = sampleChapters.slice(0, 5).map((ch) => ({
        ...ch,
        text: "短内容",
      }));
      const warnings = qidianAdapter.validateRequirements(sampleBookConfig, shortChapters);
      const errors = warnings.filter((w) => w.severity === "error");
      expect(errors.some((e) => e.field === "wordCount")).toBe(true);
    });

    it("warns about empty titles", () => {
      const chaptersWithEmptyTitle = sampleChapters.map((ch, i) => ({
        ...ch,
        meta: { ...ch.meta, title: i === 0 ? "" : ch.meta.title },
      }));
      const warnings = qidianAdapter.validateRequirements(sampleBookConfig, chaptersWithEmptyTitle);
      expect(warnings.some((w) => w.field === "titles" && w.severity === "warn")).toBe(true);
    });
  });

  describe("formatFullBook", () => {
    it("generates complete book output", () => {
      const result = qidianAdapter.formatFullBook(sampleBookConfig, sampleChapters);
      expect(result).toContain("测试小说");
      expect(result).toContain("都市");
      expect(result).toContain("第一章");
      expect(result).toContain("第五章");
    });
  });
});

// ── Fanqie Adapter ──

describe("fanqieAdapter", () => {
  describe("getName", () => {
    it("returns platform display name", () => {
      expect(fanqieAdapter.getName()).toBe("番茄小说");
    });
  });

  describe("formatChapter", () => {
    it("formats chapter with numbered heading", () => {
      const result = fanqieAdapter.formatChapter(sampleChapters[0], 1);
      expect(result).toContain("1. 楔子");
    });

    it("formats dialogue lines properly", () => {
      const result = fanqieAdapter.formatChapter(sampleChapters[1], 2);
      expect(result).toContain("2. 重逢");
    });

    it("handles section breaks", () => {
      const ch: PublishChapter = {
        meta: sampleChapters[0].meta,
        text: "第一段内容\n\n***\n\n第二段内容",
      };
      const result = fanqieAdapter.formatChapter(ch, 1);
      expect(result).toContain("***");
    });
  });

  describe("validateRequirements", () => {
    it("passes when requirements are met", () => {
      const warnings = fanqieAdapter.validateRequirements(sampleBookConfig, sampleChapters);
      const errors = warnings.filter((w) => w.severity === "error");
      expect(errors).toHaveLength(0);
    });

    it("fails when fewer than 3 chapters", () => {
      const warnings = fanqieAdapter.validateRequirements(sampleBookConfig, sampleChapters.slice(0, 2));
      const errors = warnings.filter((w) => w.severity === "error");
      expect(errors.some((e) => e.field === "chapters")).toBe(true);
    });

    it("fails when total word count below 5000", () => {
      const shortChapters = sampleChapters.slice(0, 3).map((ch) => ({
        ...ch,
        text: "很",
      }));
      const warnings = fanqieAdapter.validateRequirements(sampleBookConfig, shortChapters);
      const errors = warnings.filter((w) => w.severity === "error");
      expect(errors.some((e) => e.field === "wordCount")).toBe(true);
    });

    it("warns about very short chapters", () => {
      const ch: PublishChapter = {
        meta: { ...sampleChapters[0].meta, number: 1 },
        text: "短",
      };
      const warnings = fanqieAdapter.validateRequirements(sampleBookConfig, [ch, ...sampleChapters.slice(1)]);
      expect(warnings.some((w) => w.field === "chapterLength" && w.severity === "warn")).toBe(true);
    });
  });

  describe("formatFullBook", () => {
    it("generates complete book output", () => {
      const result = fanqieAdapter.formatFullBook(sampleBookConfig, sampleChapters);
      expect(result).toContain("测试小说");
      expect(result).toContain("1. 楔子");
      expect(result).toContain("5. 决定");
    });
  });
});

// ── getAdapter ──

describe("getAdapter", () => {
  it("returns qidian adapter for qidian platform", async () => {
    const { getAdapter } = await import("../index.js");
    expect(getAdapter("qidian").getName()).toBe("起点中文网");
  });

  it("returns fanqie adapter for fanqie platform", async () => {
    const { getAdapter } = await import("../index.js");
    expect(getAdapter("fanqie").getName()).toBe("番茄小说");
  });
});
