// ── Style Consistency Analyzer API (Issue #279) ──
//
// Routes (mounted at /api/style-consistency):
//   POST /analyze   — Analyze style consistency for book chapters
//
// Returns dimension scores, anomaly list, and overall consistency metrics
// comparing a target chapter against established style baselines.

import { Hono } from "hono";
import { ApiError } from "../errors.js";

interface StyleConsistencyDimension {
  readonly name: string;
  readonly label: string;
  readonly score: number;
  readonly status: "ok" | "warn" | "good";
  readonly note: string;
}

interface StyleAnomaly {
  readonly index: number;
  readonly tag: "length" | "modifier" | "dialogue";
  readonly tagLabel: string;
  readonly paragraphIndex: number;
  readonly description: string;
  readonly quote: string;
  readonly detail: string;
  readonly diffPercent: string;
  readonly ignored: boolean;
}

interface StyleConsistencyResult {
  readonly score: number;
  readonly dimensions: readonly StyleConsistencyDimension[];
  readonly anomalies: readonly StyleAnomaly[];
  readonly baselineLabel: string;
  readonly targetLabel: string;
  readonly sensitivity: number;
}

function mockAnalysis(sensitivity: number): StyleConsistencyResult {
  // Generate mock results that vary with sensitivity
  const scoreMap: Record<number, number> = { 0: 85, 1: 78, 2: 65 };
  const score = scoreMap[sensitivity] ?? 78;

  const dimensions: StyleConsistencyDimension[] = [
    {
      name: "vocabulary",
      label: "词汇分布",
      score: 88,
      status: "ok",
      note: "高频词重叠率 · 与基线匹配",
    },
    {
      name: "sentence-length",
      label: "句式长度",
      score: sensitivity === 2 ? 55 : sensitivity === 1 ? 65 : 72,
      status: "warn",
      note: "短句频次偏高 · 与基线差异 +23%",
    },
    {
      name: "dialogue-ratio",
      label: "对话比例",
      score: 92,
      status: "ok",
      note: "对话/叙述比例 · 与基线一致",
    },
    {
      name: "modifier-density",
      label: "修饰语密度",
      score: sensitivity === 2 ? 40 : sensitivity === 1 ? 55 : 68,
      status: "warn",
      note: "修饰语密度 0.12 vs 基线 0.08 · 偏高 50%",
    },
  ];

  const diffBase: Record<number, string> = { 0: "+18%", 1: "+31%", 2: "+45%" };
  const anomalies: StyleAnomaly[] = [
    {
      index: 0,
      tag: "length",
      tagLabel: "句式过长",
      paragraphIndex: 3,
      description: "连续短句偏离基线节奏模式。",
      quote: "他走了进去。看了看四周。没人。等了很久。",
      detail: "连续短句（4句/17字）偏离基线节奏模式。",
      diffPercent: diffBase[sensitivity] ?? "+31%",
      ignored: false,
    },
    {
      index: 1,
      tag: "modifier",
      tagLabel: "修饰语偏高",
      paragraphIndex: 5,
      description: "全段修饰语密度 0.12 vs 基线 0.08",
      quote: "幽暗的、模糊不清的、近乎窒息的寂静",
      detail: '全段修饰语密度 0.12 vs 基线 0.08 · "幽暗的、模糊不清的、近乎窒息的寂静"——三连叠修饰在基线的克制风格中极少出现。',
      diffPercent: "+50%",
      ignored: false,
    },
  ];

  if (sensitivity >= 1) {
    anomalies.push({
      index: 2,
      tag: "dialogue",
      tagLabel: "对话比例异常",
      paragraphIndex: 8,
      description: "对话占比 65% vs 基线 35%",
      quote: "",
      detail: "对话占比 65% vs 基线 35% · 该段以密集对话推进情节，而基线此阶段以叙述描写为主。",
      diffPercent: "+86%",
      ignored: sensitivity === 1,
    });
  }

  return {
    score,
    dimensions,
    anomalies,
    baselineLabel: "第1–10章 · 共32,450字",
    targetLabel: "第11章",
    sensitivity,
  };
}

export function createStyleConsistencyRouter(_root: string) {
  const router = new Hono();

  // POST /api/style-consistency/analyze — analyze style consistency
  router.post("/analyze", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const { bookId, chapterIds, sensitivity: rawSensitivity } = body as {
      bookId?: string;
      chapterIds?: string[];
      sensitivity?: number;
    };

    const sensitivity = typeof rawSensitivity === "number"
      ? Math.max(0, Math.min(2, Math.round(rawSensitivity)))
      : 1;

    // For now, return mock data. In production, this would call the core analyzer.
    const result = mockAnalysis(sensitivity);

    return c.json({ result });
  });

  return router;
}
