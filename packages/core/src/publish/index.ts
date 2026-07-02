import type { BookConfig } from "../models/book.js";
import type { ChapterMeta } from "../models/chapter.js";

/** Supported publish platforms */
export type PublishPlatform = "qidian" | "fanqie";

/** Format options for publish adapters */
export interface FormatOptions {
  /** Per-chapter target word count */
  chapterWordCount: number;
  /** Chapter indexing start (1-based) */
  chapterStart?: number;
}

/** Validation warning about platform-specific requirements */
export interface ValidationWarning {
  field: string;
  message: string;
  severity: "error" | "warn";
}

/** A chapter's text content for publishing */
export interface PublishChapter {
  meta: ChapterMeta;
  text: string;
}

/** Platform adapter interface */
export interface IPlatformAdapter {
  /** Human-readable platform name */
  getName(): string;
  /** Format a single chapter's text for the target platform */
  formatChapter(chapter: PublishChapter, index: number, options?: FormatOptions): string;
  /** Validate book config against platform requirements, returning warnings */
  validateRequirements(bookConfig: BookConfig, chapters: PublishChapter[]): ValidationWarning[];
  /** Format the full book content for export */
  formatFullBook(bookConfig: BookConfig, chapters: PublishChapter[], options?: FormatOptions): string;
}

export { qidianAdapter } from "./qidian.js";
export { fanqieAdapter } from "./fanqie.js";

import { qidianAdapter } from "./qidian.js";
import { fanqieAdapter } from "./fanqie.js";

/** Lookup an adapter by platform name */
export function getAdapter(platform: PublishPlatform): IPlatformAdapter {
  switch (platform) {
    case "qidian":
      return qidianAdapter;
    case "fanqie":
      return fanqieAdapter;
  }
}
