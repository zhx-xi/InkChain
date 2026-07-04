// ── Foreshadowing Cross-Chapter Relations (Issue #324) ──
//
// Route:
//   POST /:id/foreshadowing/relations — Analyze cross-chapter relations among extracted candidates

import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ApiError } from "../errors.js";
import { isSafeBookId } from "../safety.js";

interface ForeshadowingExtractCandidate {
  title: string;
  type: string;
  description: string;
  expectedPayoffChapter: number | null;
  confidence: number;
  chapter: number;
}

interface ForeshadowingRelation {
  type: "same_topic" | "payoff_setup" | "chain";
  sourceIdx: number;
  targetIdx: number;
  label: string;
}

interface RelationsRequestBody {
  candidates: ForeshadowingExtractCandidate[];
}

// ── Helper: Simple title similarity (Jaccard on character bigrams) ──

function charBigrams(s: string): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.add(s.slice(i, i + 2));
  }
  return bigrams;
}

function similarity(a: string, b: string): number {
  const ba = charBigrams(a);
  const bb = charBigrams(b);
  if (ba.size === 0 && bb.size === 0) return 1;
  let intersection = 0;
  for (const gram of ba) {
    if (bb.has(gram)) intersection++;
  }
  const union = ba.size + bb.size - intersection;
  return union > 0 ? intersection / union : 0;
}

// ── Analyze relations among candidates ──

function analyzeRelations(candidates: ForeshadowingExtractCandidate[]): ForeshadowingRelation[] {
  const relations: ForeshadowingRelation[] = [];

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];

      // Only compare across different chapters
      if (a.chapter === b.chapter) continue;

      // Same topic detection (similar title)
      const titleSim = similarity(a.title, b.title);
      if (titleSim >= 0.4) {
        relations.push({
          type: "same_topic",
          sourceIdx: i,
          targetIdx: j,
          label: `"${a.title}" 与 "${b.title}" 可能为同一伏笔，贯穿第 ${a.chapter} 章和第 ${b.chapter} 章`,
        });
        continue;
      }

      // Payoff-setup: one mentions "设下" and the other mentions "回收" or expected payoff chapter matches
      const aPaysB = a.expectedPayoffChapter !== null && a.expectedPayoffChapter <= b.chapter;
      const bPaysA = b.expectedPayoffChapter !== null && b.expectedPayoffChapter <= a.chapter;
      if (aPaysB) {
        relations.push({
          type: "payoff_setup",
          sourceIdx: i,
          targetIdx: j,
          label: `"${a.title}"（第 ${a.chapter} 章设伏）可能在 "${b.title}"（第 ${b.chapter} 章）回收`,
        });
      }
      if (bPaysA) {
        relations.push({
          type: "payoff_setup",
          sourceIdx: j,
          targetIdx: i,
          label: `"${b.title}"（第 ${b.chapter} 章设伏）可能在 "${a.title}"（第 ${a.chapter} 章）回收`,
        });
      }
    }
  }

  return relations;
}

export function createForeshadowingRelationsRouter(): Hono {
  const router = new Hono();

  // POST /:id/foreshadowing/relations
  router.post("/:id/foreshadowing/relations", async (c) => {
    try {
      const id = c.req.param("id");

      if (!isSafeBookId(id)) {
        throw new ApiError(400, "INVALID_BOOK_ID", `Invalid book id: "${id}"`);
      }

      let body: RelationsRequestBody;
      try {
        body = await c.req.json() as RelationsRequestBody;
      } catch {
        throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
      }

      const candidates = body.candidates;
      if (!Array.isArray(candidates)) {
        throw new ApiError(400, "INVALID_CANDIDATES", "candidates must be an array");
      }

      const relations = analyzeRelations(candidates);

      return c.json({ relations });
    } catch (err) {
      if (err instanceof ApiError) {
        return c.json({
          error: { code: err.code, message: err.message },
        }, err.status as ContentfulStatusCode);
      }
      return c.json({
        error: {
          code: "RELATIONS_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      }, 500);
    }
  });

  return router;
}
