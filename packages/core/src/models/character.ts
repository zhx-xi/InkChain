// ── Character 5-tier hierarchy ──
// Central definition shared across core and studio. The enum values match both
// the on-disk directory names (roles/protagonist/, roles/supporting/, …) and
// the Chinese-localized variants created by the architect.

export enum CharacterTier {
  protagonist = "protagonist",   // 主角 — 全程推动核心叙事
  supporting = "supporting",     // 重要角色 — 关键段落/支线驱动
  guest = "guest",               // 次要角色 — 阶段性辅助/转变
  one_shot = "one_shot",         // 客串角色 — 场景NPC/群像
  scene = "scene",               // 一次性/场景专属 — 1-2句出场
}

// Tier display configuration shared between backend and frontend.
export interface TierConfig {
  readonly label: string;
  readonly sortOrder: number;
  readonly badgeColor: string;
  readonly badgeSymbol: string;
}

export const TIER_CONFIGS: Record<CharacterTier, TierConfig> = {
  [CharacterTier.protagonist]: {
    label: "主角",
    sortOrder: 1,
    badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    badgeSymbol: "★",
  },
  [CharacterTier.supporting]: {
    label: "重要",
    sortOrder: 2,
    badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    badgeSymbol: "★",
  },
  [CharacterTier.guest]: {
    label: "次要",
    sortOrder: 3,
    badgeColor: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    badgeSymbol: "●",
  },
  [CharacterTier.one_shot]: {
    label: "客串",
    sortOrder: 4,
    badgeColor: "bg-gray-500/15 text-gray-600 dark:text-gray-400",
    badgeSymbol: "●",
  },
  [CharacterTier.scene]: {
    label: "一次性",
    sortOrder: 5,
    badgeColor: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
    badgeSymbol: "·",
  },
} as const;

// Migration mapping — old enum-like string values → new CharacterTier.
// Used when reading pre-v1.5a books that still use "major"/"minor" in their
// role-from-path resolution or legacy data stores.
export const TIER_MIGRATION: Record<string, CharacterTier> = {
  major: CharacterTier.supporting,
  minor: CharacterTier.guest,
};

// Directory name → tier mapping for roleFromPath resolution.
export const TIER_DIR_MAP: Record<string, CharacterTier> = {
  // Chinese directory names
  "主角": CharacterTier.protagonist,
  "重要": CharacterTier.supporting,
  "次要": CharacterTier.guest,
  "客串": CharacterTier.one_shot,
  "一次性": CharacterTier.scene,
  // English directory names (new)
  protagonist: CharacterTier.protagonist,
  supporting: CharacterTier.supporting,
  guest: CharacterTier.guest,
  "one-shot": CharacterTier.one_shot,
  scene: CharacterTier.scene,
  // Legacy directory names (pre-v1.5a compat)
  "主要角色": CharacterTier.supporting,
  "次要角色": CharacterTier.guest,
  major: CharacterTier.supporting,
  minor: CharacterTier.guest,
};
