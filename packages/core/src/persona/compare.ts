// ── Persona Comparison / Diff Utilities ──
// Provides structural comparison between two PersonaConfig objects,
// used by the A/B testing feature to highlight differences.
//
// See: Issue #95 (Per-10: Persona A/B 对比测试)

import type { PersonaConfig } from "../models/persona-config.js";
import type { BehaviorConstraint, DialogueStyle } from "../models/persona-config.js";

// ── Types ──

export interface PersonaDiff {
  /** Display name difference */
  displayName: FieldDiff | null;
  /** Personality traits difference */
  personalityTraits: ArrayDiff | null;
  /** Dialogue style differences */
  dialogueStyle: NestedFieldDiff<DialogueStyle> | null;
  /** Behavior constraints differences */
  behaviorConstraints: BehaviorConstraintDiff;
  /** Free text details difference */
  freeTextDetails: FieldDiff | null;
  /** Model override difference */
  modelOverride: FieldDiff | null;
  /** Bound skills difference */
  boundSkills: ArrayDiff | null;
}

export interface FieldDiff {
  kind: "changed" | "added" | "removed";
  from?: string;
  to?: string;
}

export interface ArrayDiff {
  kind: "changed";
  added: string[];
  removed: string[];
  unchanged: string[];
}

export interface NestedFieldDiff<T extends Record<string, unknown>> {
  kind: "changed";
  fields: Partial<Record<keyof T, FieldDiff>>;
}

export interface BehaviorConstraintDiff {
  kind: "changed";
  added: BehaviorConstraint[];
  removed: BehaviorConstraint[];
  modified: { from: BehaviorConstraint; to: BehaviorConstraint }[];
  unchanged: BehaviorConstraint[];
}

/**
 * Compare two PersonaConfigs and produce a structured diff.
 */
export function comparePersonaConfigs(
  configA: PersonaConfig,
  configB: PersonaConfig,
): PersonaDiff {
  return {
    displayName: compareField(configA.displayName, configB.displayName),
    personalityTraits: compareStringArrays(configA.personalityTraits, configB.personalityTraits),
    dialogueStyle: compareDialogueStyles(configA.dialogueStyle, configB.dialogueStyle),
    behaviorConstraints: compareBehaviorConstraints(
      configA.behaviorConstraints,
      configB.behaviorConstraints,
    ),
    freeTextDetails: compareField(configA.freeTextDetails, configB.freeTextDetails),
    modelOverride: compareJsonField(
      configA.modelOverride ? JSON.stringify(configA.modelOverride, null, 2) : undefined,
      configB.modelOverride ? JSON.stringify(configB.modelOverride, null, 2) : undefined,
    ),
    boundSkills: compareStringArrays(configA.boundSkills, configB.boundSkills),
  };
}

/**
 * Get a human-readable summary of the diff for display in the A/B panel.
 */
export function summarizePersonaDiff(diff: PersonaDiff): string[] {
  const changes: string[] = [];

  if (diff.displayName) {
    changes.push(`显示名: "${diff.displayName.from ?? "(空)"}" → "${diff.displayName.to ?? "(空)"}"`);
  }
  if (diff.personalityTraits) {
    const { added, removed } = diff.personalityTraits;
    if (added.length > 0) changes.push(`新增性格标签: ${added.join(", ")}`);
    if (removed.length > 0) changes.push(`移除性格标签: ${removed.join(", ")}`);
  }
  if (diff.dialogueStyle && diff.dialogueStyle.fields) {
    const fieldLabels: Record<string, string> = {
      tone: "语气",
      rhythm: "节奏",
      vocabulary: "词汇",
    };
    for (const [key, fieldDiff] of Object.entries(diff.dialogueStyle.fields)) {
      if (fieldDiff) {
        const label = fieldLabels[key] ?? key;
        changes.push(`对话风格-${label}: "${fieldDiff.from ?? "(空)"}" → "${fieldDiff.to ?? "(空)"}"`);
      }
    }
  }
  if (diff.behaviorConstraints.kind === "changed") {
    if (diff.behaviorConstraints.added.length > 0) {
      changes.push(`新增行为规则: ${diff.behaviorConstraints.added.map((c) => c.rule).join(", ")}`);
    }
    if (diff.behaviorConstraints.removed.length > 0) {
      changes.push(`移除行为规则: ${diff.behaviorConstraints.removed.map((c) => c.rule).join(", ")}`);
    }
    if (diff.behaviorConstraints.modified.length > 0) {
      changes.push(`修改行为规则: ${diff.behaviorConstraints.modified.length} 条`);
    }
  }
  if (diff.freeTextDetails) {
    changes.push("自由文本详情: 已更改");
  }
  if (diff.modelOverride) {
    changes.push("模型覆盖: 已更改");
  }
  if (diff.boundSkills) {
    const { added, removed } = diff.boundSkills;
    if (added.length > 0) changes.push(`新增绑定 Skill: ${added.join(", ")}`);
    if (removed.length > 0) changes.push(`移除绑定 Skill: ${removed.join(", ")}`);
  }

  return changes;
}

// ── Internal Helpers ──

function compareField(from?: string, to?: string): FieldDiff | null {
  if (from === to) return null;
  if (from === undefined || from === "") {
    return { kind: "added", to };
  }
  if (to === undefined || to === "") {
    return { kind: "removed", from };
  }
  return { kind: "changed", from, to };
}

function compareJsonField(from?: string, to?: string): FieldDiff | null {
  if (from === to) return null;
  return { kind: "changed", from, to };
}

function compareStringArrays(from: string[], to: string[]): ArrayDiff | null {
  const fromSet = new Set(from);
  const toSet = new Set(to);

  if (from.length === to.length && from.every((item) => toSet.has(item))) {
    return null;
  }

  const added = to.filter((item) => !fromSet.has(item));
  const removed = from.filter((item) => !toSet.has(item));
  const unchanged = from.filter((item) => toSet.has(item));

  return { kind: "changed", added, removed, unchanged };
}

function compareDialogueStyles(
  from: Partial<DialogueStyle>,
  to: Partial<DialogueStyle>,
): NestedFieldDiff<DialogueStyle> | null {
  const allKeys = new Set([...Object.keys(from), ...Object.keys(to)]) as Set<keyof DialogueStyle>;
  const fieldDiffs: Partial<Record<keyof DialogueStyle, FieldDiff>> = {};
  let hasChanges = false;

  for (const key of allKeys) {
    const fromVal = from[key] ?? "";
    const toVal = to[key] ?? "";
    const diff = compareField(fromVal, toVal);
    if (diff) {
      fieldDiffs[key] = diff;
      hasChanges = true;
    }
  }

  return hasChanges ? { kind: "changed", fields: fieldDiffs as Partial<Record<keyof DialogueStyle, FieldDiff>> } : null;
}

function behaviorConstraintKey(c: BehaviorConstraint): string {
  return `${c.style}:${c.rule}`;
}

function compareBehaviorConstraints(
  from: BehaviorConstraint[],
  to: BehaviorConstraint[],
): BehaviorConstraintDiff {
  const fromMap = new Map(from.map((c) => [behaviorConstraintKey(c), c]));
  const toMap = new Map(to.map((c) => [behaviorConstraintKey(c), c]));

  const allKeys = new Set([...fromMap.keys(), ...toMap.keys()]);

  const added: BehaviorConstraint[] = [];
  const removed: BehaviorConstraint[] = [];
  const modified: { from: BehaviorConstraint; to: BehaviorConstraint }[] = [];
  const unchanged: BehaviorConstraint[] = [];

  for (const key of allKeys) {
    const fromC = fromMap.get(key);
    const toC = toMap.get(key);

    if (!fromC && toC) {
      added.push(toC);
    } else if (fromC && !toC) {
      removed.push(fromC);
    } else if (fromC && toC) {
      if (JSON.stringify(fromC) === JSON.stringify(toC)) {
        unchanged.push(fromC);
      } else {
        modified.push({ from: fromC, to: toC });
      }
    }
  }

  return { kind: "changed", added, removed, modified, unchanged };
}
