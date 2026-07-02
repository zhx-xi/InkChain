// ── Chapter Plan Model ──

export interface ChapterPlan {
  chapterNumber: number;
  title: string;
  plotPoints: string[];
  wordCount: number;
  characters: string[];
}

// ── Input ──

export interface OutlinePlannerInput {
  /** Existing world configuration (optional). */
  worldConfig?: {
    characters?: string[];
    regions?: string[];
    institutions?: string[];
    history?: string[];
    rules?: string[];
  };
  /** Existing chapter outline to extend (optional). */
  outline?: {
    chapters: Array<{ number: number; title: string; summary: string; characters?: string[] }>;
  };
  /** Number of chapters to plan. */
  chapterCount: number;
  /** Creative genre hint. */
  genre?: string;
  /** Currently written chapters to continue from (optional). */
  currentChapters?: Array<{ number: number; summary: string }>;
}

// ── Default Configuration ──

export interface PlannerConfig {
  defaultWordCountPerChapter: number;
  minPlotPoints: number;
  maxPlotPoints: number;
}

export const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  defaultWordCountPerChapter: 3000,
  minPlotPoints: 2,
  maxPlotPoints: 5,
};

// ── Arc Phase ──

type ArcPhase = "intro" | "build" | "conflict" | "climax" | "resolution";

interface ArcSegment {
  phase: ArcPhase;
  startIndex: number; // 0-based chapter index within the planned block
  endIndex: number;   // inclusive
}

// ── Helpers ──

/**
 * Distribute chapters across the standard 5-act story arc,
 * ensuring every phase gets at least one chapter when possible.
 */
function distributeArc(totalChapters: number): ArcSegment[] {
  if (totalChapters <= 0) return [];

  if (totalChapters === 1) {
    return [{ phase: "climax", startIndex: 0, endIndex: 0 }];
  }

  if (totalChapters === 2) {
    return [
      { phase: "build", startIndex: 0, endIndex: 0 },
      { phase: "climax", startIndex: 1, endIndex: 1 },
    ];
  }

  if (totalChapters === 3) {
    return [
      { phase: "intro", startIndex: 0, endIndex: 0 },
      { phase: "conflict", startIndex: 1, endIndex: 1 },
      { phase: "resolution", startIndex: 2, endIndex: 2 },
    ];
  }

  // For 4+ chapters use proportional distribution
  const ratios: Record<ArcPhase, number> = {
    intro: 0.15,
    build: 0.25,
    conflict: 0.25,
    climax: 0.2,
    resolution: 0.15,
  };

  const phases: ArcPhase[] = ["intro", "build", "conflict", "climax", "resolution"];
  const segments: ArcSegment[] = [];
  let start = 0;

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    let count: number;

    if (i === phases.length - 1) {
      // Last phase gets remaining chapters
      count = totalChapters - start;
    } else {
      count = Math.max(1, Math.round(totalChapters * ratios[phase]));
      // Adjust to not overshoot remaining chapters
      const remaining = totalChapters - start;
      const remainingPhases = phases.length - i;
      if (count > remaining - (remainingPhases - 1)) {
        count = Math.max(1, remaining - (remainingPhases - 1));
      }
    }

    const end = Math.min(start + count - 1, totalChapters - 1);
    segments.push({ phase, startIndex: start, endIndex: end });
    start = end + 1;

    if (start >= totalChapters) break;
  }

  return segments;
}

/**
 * Generate a title for a chapter based on its position and phase.
 */
function generateChapterTitle(chapterNumber: number, phase: ArcPhase, total: number, genre?: string): string {
  const phaseTitles: Record<ArcPhase, string[]> = {
    intro: ["开端", "序幕", "启程", "相遇", "新的开始"],
    build: ["发展", "深入", "暗流", "探索", "积累", "疑云", "线索", "成长"],
    conflict: ["冲突", "对决", "危机", "转折", "挣扎", "抉择", "激战", "困境"],
    climax: ["高潮", "真相", "决战", "终极", "巅峰", "逆转", "爆发"],
    resolution: ["结局", "余波", "新生", "归途", "尾声", "曙光"],
  };

  const pool = phaseTitles[phase] ?? phaseTitles.build;
  const idx = (chapterNumber - 1) % pool.length;
  return `第${chapterNumber}章 ${pool[idx]}`;
}

/**
 * Generate plot points appropriate to a story phase.
 */
function generatePlotPoints(phase: ArcPhase, config: PlannerConfig): string[] {
  const basePlots: Record<ArcPhase, string[]> = {
    intro: [
      "引入主要角色，展现其日常生活",
      "埋下核心冲突的伏笔",
      "展示故事世界观的基础设定",
      "主角遭遇触发事件的契机",
    ],
    build: [
      "主要角色之间的关系逐步深化",
      "次要冲突浮现，增加故事张力",
      "主角开始主动探索问题的根源",
      "新的盟友或对手登场",
    ],
    conflict: [
      "核心冲突全面爆发",
      "主角面临重大抉择或考验",
      "反派或阻碍势力展现真正实力",
      "关键信息被揭露，局势发生变化",
    ],
    climax: [
      "主角与核心对手正面交锋",
      "所有伏笔在此汇聚",
      "故事的关键真相被揭晓",
      "高潮对决决定故事走向",
    ],
    resolution: [
      "高潮事件的直接后果展现",
      "角色关系得到重塑或确认",
      "最终状态展示，为后续留有余地",
      "主题升华，呼应开篇",
    ],
  };

  const pool = basePlots[phase] ?? basePlots.build;
  const count = Math.min(
    config.maxPlotPoints,
    Math.max(config.minPlotPoints, pool.length),
  );
  return pool.slice(0, count);
}

/**
 * Determine which characters appear in a given arc phase.
 */
function generatePhaseCharacters(
  characters: string[],
  phase: ArcPhase,
  chapterIndex: number,
): string[] {
  if (characters.length === 0) return ["旁白"];

  // Main character always appears
  const mainChar = characters[0];
  const result = [mainChar];

  // Secondary characters appear more in build & conflict phases
  const secondaryCounts: Record<ArcPhase, number> = {
    intro: 1,
    build: 2,
    conflict: 2,
    climax: 2,
    resolution: 1,
  };
  const count = Math.min(secondaryCounts[phase] ?? 1, characters.length - 1);

  // Rotate secondary characters based on chapter index for variety
  for (let i = 0; i < count; i++) {
    const idx = ((chapterIndex + i) % (characters.length - 1)) + 1;
    result.push(characters[idx]);
  }

  return [...new Set(result)];
}

// ── Main Planner ──

/**
 * Rule-based chapter planning engine.
 *
 * Analyzes existing outline structure and generates a coherent chapter
 * sequence with plot progression following the standard story arc:
 * intro → build → conflict → climax → resolution.
 */
export function planChapters(input: OutlinePlannerInput, config: PlannerConfig = DEFAULT_PLANNER_CONFIG): ChapterPlan[] {
  const { chapterCount, genre } = input;

  if (chapterCount <= 0) return [];

  // Gather existing characters
  const existingCharacterSet = new Set<string>();
  for (const ch of input.outline?.chapters ?? []) {
    for (const c of ch.characters ?? []) {
      existingCharacterSet.add(c);
    }
  }
  for (const c of input.worldConfig?.characters ?? []) {
    existingCharacterSet.add(c);
  }

  const allCharacters = [...existingCharacterSet];
  const segments = distributeArc(chapterCount);
  const plans: ChapterPlan[] = [];

  for (let i = 0; i < chapterCount; i++) {
    const segment = segments.find((s) => i >= s.startIndex && i <= s.endIndex);
    const phase: ArcPhase = segment?.phase ?? "build";
    const isFirstChapter = i === 0;
    const isLastChapter = i === chapterCount - 1;

    // Adjust phase for edge chapters
    const effectivePhase = isFirstChapter && phase !== "intro" ? "intro"
      : isLastChapter && phase !== "resolution" ? "resolution"
      : phase;

    const title = generateChapterTitle(i + 1, effectivePhase, chapterCount, genre);
    const plotPoints = generatePlotPoints(effectivePhase, config);
    const characters = generatePhaseCharacters(allCharacters, effectivePhase, i);

    plans.push({
      chapterNumber: i + 1,
      title,
      plotPoints,
      wordCount: config.defaultWordCountPerChapter,
      characters,
    });
  }

  return plans;
}

/**
 * Analyze existing outline and detect story arc phase coverage.
 * Returns a map of detected arc phases to their chapter counts.
 */
export function detectArcCoverage(
  chapters: Array<{ number: number; title: string; summary?: string; keyEvents?: string[] }>,
): Partial<Record<ArcPhase, number>> {
  const coverage: Partial<Record<ArcPhase, number>> = {};
  const total = chapters.length;
  if (total === 0) return coverage;

  const segments = distributeArc(total);
  for (const segment of segments) {
    coverage[segment.phase] = (coverage[segment.phase] ?? 0) + (segment.endIndex - segment.startIndex + 1);
  }
  return coverage;
}
