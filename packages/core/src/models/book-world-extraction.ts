// ── Book-to-World reverse extraction (Issue #78 — World-2) ──
//
// Heuristic utility that imports an existing book (without a World) into the
// World system by deriving a WorldConfig from book metadata and optional
// narrative text.

import type { BookConfig } from "./book.js";
import { createWorld } from "./world-store.js";
import { WorldConfigSchema, type WorldConfig } from "./world-config.js";

export interface ExtractWorldFromBookInput {
  readonly book: BookConfig;
  readonly narrativeText?: string;
}

function cleanId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function extractWorldFromBook(input: ExtractWorldFromBookInput): WorldConfig {
  const book = input.book;
  const worldId = cleanId(book.id) || "imported-world";
  const world = createWorld(worldId, book.title, `Imported from book "${book.title}"`);

  // Genre becomes a cultural setting entry.
  world.settings.push({
    id: "genre",
    name: "题材",
    type: "文化习俗",
    description: `Genre: ${book.genre}`,
    constraints: [],
    sortIndex: 0,
  });

  // Platform becomes a social setting entry.
  world.settings.push({
    id: "platform",
    name: "发布平台",
    type: "社会结构",
    description: `Platform: ${book.platform}`,
    constraints: [],
    sortIndex: 0,
  });

  const text = (input.narrativeText ?? "").trim();
  if (text.length > 0) {
    // Simple heuristic: look for "规则" or "定律" lines and turn them into rules.
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^(规则|定律|限制|约束)\s*[：:]/.test(trimmed) || /[。！](?:规则|定律)/.test(trimmed)) {
        const ruleName = trimmed.replace(/^[\s\-#>*]+/, "").replace(/^\s*(规则|定律|限制|约束)\s*[：:]\s*/, "").slice(0, 50);
        if (ruleName) {
          world.rules.push({
            id: `rule-${world.rules.length + 1}`,
            name: ruleName,
            type: "叙事",
            description: trimmed,
            constraints: [],
            sortIndex: 0,
          });
        }
      }
    }
  }

  return WorldConfigSchema.parse(world);
}
