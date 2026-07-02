import type { BookConfig } from "../models/book.js";
import type { IPlatformAdapter, PublishChapter, FormatOptions, ValidationWarning } from "./index.js";

/**
 * 起点中文网 (Qidian) publish adapter.
 *
 * Format rules:
 * - Each chapter: 2000–4000 characters
 * - Chapter title format: "第X章 章节名"
 * - Paragraphs separated by blank line
 * - No special section break characters
 *
 * Validation:
 * - Minimum 5 chapters
 * - Minimum 10,000 total characters
 * - Coherent chapter titles (no repeated or empty titles)
 */

function formatChapterTitle(index: number, title: string): string {
  const cnIndex = toChineseNumber(index);
  if (title && title.trim()) {
    return `第${cnIndex}章 ${title.trim()}`;
  }
  return `第${cnIndex}章`;
}

function toChineseNumber(n: number): string {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (n <= 10) return digits[n] ?? String(n);
  if (n < 20) return `十${digits[n % 10] ?? ""}`;
  if (n < 100) {
    const tens = digits[Math.floor(n / 10)] ?? "";
    const ones = digits[n % 10] ?? "";
    return `${tens}十${ones}`;
  }
  return String(n);
}

export const qidianAdapter: IPlatformAdapter = {
  getName(): string {
    return "起点中文网";
  },

  formatChapter(chapter: PublishChapter, index: number, _options?: FormatOptions): string {
    const lines: string[] = [];
    const titleLine = formatChapterTitle(index, chapter.meta.title);
    lines.push(titleLine);
    lines.push("");

    // Clean and format the content: normalize whitespace, split paragraphs
    const text = chapter.text.trim();
    const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

    for (const para of paragraphs) {
      // Strip existing section break markers
      const clean = para.replace(/^[#*]{3,}\s*$/, "").trim();
      if (!clean) {
        continue;
      }
      lines.push(clean);
      lines.push("");
    }

    return lines.join("\n").trim();
  },

  validateRequirements(bookConfig: BookConfig, chapters: PublishChapter[]): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Min 5 chapters
    if (chapters.length < 5) {
      warnings.push({
        field: "chapters",
        message: `起点要求至少 5 章，当前 ${chapters.length} 章`,
        severity: "error",
      });
    }

    // Min 10,000 total chars
    const totalChars = chapters.reduce((sum, ch) => sum + ch.text.length, 0);
    if (totalChars < 10000) {
      warnings.push({
        field: "wordCount",
        message: `起点要求总字数至少 10000 字，当前约 ${totalChars} 字`,
        severity: "error",
      });
    }

    // Coherent titles check
    const titles = chapters.map((ch) => ch.meta.title.trim().toLowerCase());
    const emptyTitles = titles.filter((t) => !t).length;
    if (emptyTitles > 0) {
      warnings.push({
        field: "titles",
        message: `${emptyTitles} 个章节标题为空`,
        severity: "warn",
      });
    }

    // Check for duplicate titles
    const uniqueTitles = new Set(titles.filter(Boolean));
    if (uniqueTitles.size < titles.filter(Boolean).length) {
      warnings.push({
        field: "titles",
        message: "存在重复的章节标题",
        severity: "warn",
      });
    }

    // Platform must be qidian
    if (bookConfig.platform !== "qidian") {
      warnings.push({
        field: "platform",
        message: `当前平台设置为 "${bookConfig.platform}"，发布到起点建议将平台设为 qidian`,
        severity: "warn",
      });
    }

    return warnings;
  },

  formatFullBook(bookConfig: BookConfig, chapters: PublishChapter[], options?: FormatOptions): string {
    const lines: string[] = [];
    lines.push(bookConfig.title);
    lines.push(`作者: ${bookConfig.platform === "qidian" ? "" : "InkOS"}`);
    lines.push(`题材: ${bookConfig.genre}`);
    lines.push(`总字数: ${chapters.reduce((sum, ch) => sum + ch.text.length, 0)}`);
    lines.push("");
    lines.push("=".repeat(40));
    lines.push("");

    for (let i = 0; i < chapters.length; i++) {
      const formatted = this.formatChapter(chapters[i], i + 1, options);
      lines.push(formatted);
      lines.push("");
      lines.push("-".repeat(30));
      lines.push("");
    }

    return lines.join("\n");
  },
};
