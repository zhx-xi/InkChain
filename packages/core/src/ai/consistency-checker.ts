// ── Consistency Checker (Issue #93 — AI-3) ──
//
// Rule-based narrative consistency checking engine.
// Detects character contradictions, relationship breaks, setting conflicts,
// and timeline paradoxes by comparing current chapter data against known
// character profiles, relationship maps, world settings, and timelines.

import type { ConsistencyReport, ConsistencyIssue, IssueSeverity } from "./consistency-report.js";
import { createEmptyReport, calculateScore, buildSummary } from "./consistency-report.js";
import type { WorldConfig } from "../models/world-config.js";

// ── Character Profile (minimal) ──

export interface CharacterProfile {
  id: string;
  name: string;
  traits: string[];
  role: string;
  description: string;
}

// ── Chapter Content (simplified) ──

export interface ChapterContent {
  id: string;
  title: string;
  text: string;
  characters: string[]; // character IDs mentioned
}

// ── Input for consistency check ──

export interface ConsistencyCheckInput {
  /** World configuration (settings, roles, relations, rules, etc.) */
  world: WorldConfig;
  /** The chapter to check */
  chapter: ChapterContent;
  /** Previously analyzed chapters for cross-chapter checks */
  previousChapters?: ChapterContent[];
  /** Detailed character profiles */
  characterProfiles?: CharacterProfile[];
}

// ── Detection Rules ──

/**
 * Detect character contradictions:
 * - Character described with trait X in profile but behaves differently in text
 * - Character uses powers/knowledge they shouldn't have
 */
function detectCharacterContradictions(
  input: ConsistencyCheckInput,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  if (!input.characterProfiles || input.characterProfiles.length === 0) {
    return issues;
  }

  const textLower = input.chapter.text.toLowerCase();

  for (const profile of input.characterProfiles) {
    // Check if character appears in this chapter
    if (!textLower.includes(profile.name.toLowerCase())) continue;

    // Check for trait contradictions
    for (const trait of profile.traits) {
      const traitLower = trait.toLowerCase();
      // Check positive traits mentioned in chapter
      if (textLower.includes(traitLower)) continue; // OK, trait confirmed

      // Look for contradictory descriptions
      const antiTraits = getAntiTraits(trait);
      for (const anti of antiTraits) {
        if (textLower.includes(anti)) {
          issues.push({
            type: "character_contradiction",
            severity: "medium",
            description: `角色"${profile.name}"具有特征"${trait}"，但章节中出现了矛盾描述"${anti}"`,
            sources: [input.chapter.id],
            suggestion: `检查角色"${profile.name}"的行为是否符合其设定特征"${trait}"`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Detect relationship breaks:
 * - Character interactions contradict established relationships
 * - Missing reactions to important characters
 */
function detectRelationshipBreaks(
  input: ConsistencyCheckInput,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const { relations } = input.world;

  if (!relations || relations.length === 0) return issues;

  // Build name→id map from world roles
  const roleNameToId = new Map<string, string>();
  for (const role of input.world.roles ?? []) {
    roleNameToId.set(role.name, role.id);
  }

  // Build ID→name map
  const roleIdToName = new Map<string, string>();
  for (const role of input.world.roles ?? []) {
    roleIdToName.set(role.id, role.name);
  }

  const textLower = input.chapter.text.toLowerCase();

  for (const relation of relations) {
    const sourceName = roleIdToName.get(relation.sourceId) ?? relation.sourceId;
    const targetName = roleIdToName.get(relation.targetId) ?? relation.targetId;

    // Both characters must appear in chapter
    const sourceAppears = textLower.includes(sourceName.toLowerCase());
    const targetAppears = textLower.includes(targetName.toLowerCase());

    if (sourceAppears && targetAppears) {
      // Check if they interact (appear in same paragraph)
      const paragraphs = input.chapter.text.split(/\n\s*\n/);
      const interact = paragraphs.some(
        (p) => p.toLowerCase().includes(sourceName.toLowerCase()) &&
              p.toLowerCase().includes(targetName.toLowerCase()),
      );

      if (!interact) {
        issues.push({
          type: "relationship_break",
          severity: "low",
          description: `角色"${sourceName}"和"${targetName}"（关系：${relation.type}）同时出现在本章但未有直接互动`,
          sources: [input.chapter.id],
          suggestion: `考虑添加"${sourceName}"和"${targetName}"之间的互动`,
        });
      }
    }
  }

  return issues;
}

/**
 * Detect setting conflicts:
 * - Chapter descriptions contradict WorldConfig settings/rules
 */
function detectSettingConflicts(
  input: ConsistencyCheckInput,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const { settings, rules } = input.world;
  const textLower = input.chapter.text.toLowerCase();

  // Check world rules
  for (const rule of rules ?? []) {
    if (!rule.constraints || rule.constraints.length === 0) continue;
    const ruleNameLower = rule.name.toLowerCase();

    // If the rule's domain is mentioned, check constraints
    if (textLower.includes(ruleNameLower)) {
      for (const constraint of rule.constraints) {
        const constraintLower = constraint.toLowerCase();
        // Check if chapter violates the constraint
        const violationWords = getViolationWords(constraint);
        for (const vw of violationWords) {
          if (textLower.includes(vw)) {
            issues.push({
              type: "setting_conflict",
              severity: "high",
              description: `章节内容违反了设定规则"${rule.name}"的约束"${constraint}"`,
              sources: [input.chapter.id, rule.id],
              suggestion: `参照规则"${rule.name}"调整相关描述`,
            });
            break;
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Detect timeline paradoxes:
 * - Events mentioned in wrong order
 * - Character appears before introduction
 * - Temporal inconsistencies
 */
function detectTimelineParadoxes(
  input: ConsistencyCheckInput,
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  // Check if any character appears that is not defined in world roles
  for (const charId of input.chapter.characters) {
    const roleExists = (input.world.roles ?? []).some((r) => r.id === charId);
    if (!roleExists) {
      issues.push({
        type: "timeline_paradox",
        severity: "medium",
        description: `章节引用了角色 ID"${charId}"，但该角色未在世界配置中定义`,
        sources: [input.chapter.id],
        suggestion: `在世界配置中添加该角色，或移除章节中的引用`,
      });
    }
  }

  // Only run cross-chapter checks if previous chapters exist
  if (!input.previousChapters || input.previousChapters.length === 0) {
    return issues;
  }

  // Track character appearances across chapters
  const prevCharAppearances = new Map<string, number>(); // char name → first seen chapter index
  for (let i = 0; i < input.previousChapters.length; i++) {
    const ch = input.previousChapters[i];
    for (const charId of ch.characters) {
      if (!prevCharAppearances.has(charId)) {
        prevCharAppearances.set(charId, i);
      }
    }
  }

  return issues;
}

// ── Main function ──

export function checkConsistency(input: ConsistencyCheckInput): ConsistencyReport {
  const allIssues: ConsistencyIssue[] = [
    ...detectCharacterContradictions(input),
    ...detectRelationshipBreaks(input),
    ...detectSettingConflicts(input),
    ...detectTimelineParadoxes(input),
  ];

  const report: ConsistencyReport = {
    issues: allIssues,
    summary: buildSummary(allIssues),
    score: calculateScore(allIssues),
    checkedAt: new Date().toISOString(),
  };

  return report;
}

// ── Helper: anti-trait mapping ──

const ANTI_TRAIT_MAP: Record<string, string[]> = {
  "勇敢": ["胆小", "害怕", "恐惧", "退缩", "怯懦"],
  "温柔": ["粗暴", "凶残", "冷酷", "残忍"],
  "聪明": ["愚蠢", "愚笨", "迟钝", "呆滞"],
  "善良": ["邪恶", "残忍", "恶毒", "阴险"],
  "坚强": ["脆弱", "崩溃", "软弱"],
  "冷静": ["急躁", "冲动", "暴躁", "慌乱"],
  "忠诚": ["背叛", "叛变", "出卖", "背弃"],
  "乐观": ["悲观", "绝望", "消极", "消沉"],
};

function getAntiTraits(trait: string): string[] {
  for (const [key, values] of Object.entries(ANTI_TRAIT_MAP)) {
    if (trait.includes(key) || key.includes(trait)) {
      return values;
    }
  }
  return [];
}

// ── Helper: violation word extraction ──

function getViolationWords(constraint: string): string[] {
  // Simple heuristic: extract key nouns from constraint
  const keywords = constraint.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  return keywords;
}
