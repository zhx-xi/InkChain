import type { BookConfig } from "../models/book.js";
import type { IPlatformAdapter, PublishChapter, FormatOptions, ValidationWarning } from "./index.js";

/**
 * 番茄小说 (Fanqie) publish adapter.
 *
 * Format rules:
 * - Each chapter: 1000–3000 characters
 * - Section breaks: "***" between scene changes
 * - Dialogue formatting: each speaker on a new line
 * - No indentation
 *
 * Validation:
 * - Minimum 3 chapters
 * - Minimum 5,000 total characters
 */

function formatChapterTitle(index: number, title: string): string {
  if (title && title.trim()) {
    return `${index}. ${title.trim()}`;
  }
  return `${index}.`;
}

/** Detect if a line is dialogue (contains quotation marks) */
function isDialogueLine(line: string): boolean {
  return /["""''「」『』【】]/.test(line);
}

export const fanqieAdapter: IPlatformAdapter = {
  getName(): string {
    return "番茄小说";
  },

  formatChapter(chapter: PublishChapter, index: number, _options?: FormatOptions): string {
    const lines: string[] = [];
    const titleLine = formatChapterTitle(index, chapter.meta.title);
    lines.push(titleLine);
    lines.push("");

    // Clean and format the content
    const text = chapter.text.trim();
    const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

    for (let pi = 0; pi < paragraphs.length; pi++) {
      const para = paragraphs[pi];
      const lines_in_para = para.split("\n").map((l) => l.trim()).filter(Boolean);

      for (const line of lines_in_para) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Handle section breaks (scene changes)
        if (/^[#*]{3,}$/.test(trimmed)) {
          lines.push("***");
          lines.push("");
          continue;
        }

        // If it's dialogue, ensure it's on its own line
        if (isDialogueLine(trimmed)) {
          // Check if dialogue is embedded with non-dialogue text
          const dialogueParts = trimmed.split(/(?<=[」』"])(?=[^」』"」』""])/g);
          for (const part of dialogueParts) {
            const p = part.trim();
            if (p) {
              lines.push(p);
              lines.push("");
            }
          }
        } else {
          lines.push(trimmed);
          lines.push("");
        }
      }

      // Add section break between paragraphs (scene changes)
      if (pi < paragraphs.length - 1) {
        lines.push("***");
        lines.push("");
      }
    }

    return lines.join("\n").trim();
  },

  validateRequirements(bookConfig: BookConfig, chapters: PublishChapter[]): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Min 3 chapters
    if (chapters.length < 3) {
      warnings.push({
        field: "chapters",
        message: `番茄要求至少 3 章，当前 ${chapters.length} 章`,
        severity: "error",
      });
    }

    // Min 5,000 total chars
    const totalChars = chapters.reduce((sum, ch) => sum + ch.text.length, 0);
    if (totalChars < 5000) {
      warnings.push({
        field: "wordCount",
        message: `番茄要求总字数至少 5000 字，当前约 ${totalChars} 字`,
        severity: "error",
      });
    }

    // Check for reasonable chapter lengths
    for (const ch of chapters) {
      if (ch.text.length < 100) {
        warnings.push({
          field: "chapterLength",
          message: `第 ${ch.meta.number} 章内容过短（${ch.text.length} 字）`,
          severity: "warn",
        });
      }
    }

    // Platform must be fanqie/tomato
    if (bookConfig.platform !== "tomato" && bookConfig.platform !== "qidian") {
      warnings.push({
        field: "platform",
        message: `当前平台设置为 "${bookConfig.platform}"，发布到番茄建议将平台设为 tomato`,
        severity: "warn",
      });
    }

    return warnings;
  },

  formatFullBook(bookConfig: BookConfig, chapters: PublishChapter[], options?: FormatOptions): string {
    const lines: string[] = [];
    lines.push(bookConfig.title);
    lines.push("");
    lines.push("=".repeat(40));
    lines.push("");

    for (let i = 0; i < chapters.length; i++) {
      const formatted = this.formatChapter(chapters[i], i + 1, options);
      lines.push(formatted);
      lines.push("");
    }

    return lines.join("\n");
  },
};
