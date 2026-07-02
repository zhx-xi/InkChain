// ── Consistency Report Schema (Issue #93 — AI-3) ──
//
// Models for narrative consistency checking results.

export type IssueSeverity = "high" | "medium" | "low";

export type IssueType =
  | "character_contradiction"
  | "relationship_break"
  | "setting_conflict"
  | "timeline_paradox";

export interface ConsistencyIssue {
  type: IssueType;
  severity: IssueSeverity;
  description: string;
  sources: string[];
  /** Optional suggestion for fixing */
  suggestion?: string;
}

export interface ConsistencyReport {
  issues: ConsistencyIssue[];
  summary: string;
  /** Overall consistency score 0-100 */
  score: number;
  checkedAt: string;
}

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  character_contradiction: "角色矛盾",
  relationship_break: "关系断裂",
  setting_conflict: "设定冲突",
  timeline_paradox: "时间线悖论",
};

export const ISSUE_SEVERITY_LABELS: Record<IssueSeverity, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export function createEmptyReport(): ConsistencyReport {
  return {
    issues: [],
    summary: "",
    score: 100,
    checkedAt: new Date().toISOString(),
  };
}

export function calculateScore(issues: ConsistencyIssue[]): number {
  if (issues.length === 0) return 100;
  const penalties: Record<IssueSeverity, number> = { high: 15, medium: 8, low: 3 };
  const total = issues.reduce((sum, i) => sum + (penalties[i.severity] ?? 5), 0);
  return Math.max(0, 100 - total);
}

export function buildSummary(issues: ConsistencyIssue[]): string {
  if (issues.length === 0) return "未发现一致性问题。";
  const high = issues.filter((i: ConsistencyIssue) => i.severity === "high").length;
  const medium = issues.filter((i: ConsistencyIssue) => i.severity === "medium").length;
  const low = issues.filter((i: ConsistencyIssue) => i.severity === "low").length;
  const parts: string[] = [];
  if (high > 0) parts.push(`${high} 个高严重度`);
  if (medium > 0) parts.push(`${medium} 个中严重度`);
  if (low > 0) parts.push(`${low} 个低严重度`);
  return `发现 ${issues.length} 个一致性问题（${parts.join("、")}）。`;
}
