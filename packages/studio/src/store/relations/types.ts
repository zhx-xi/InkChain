import type { CharacterTier } from "../../lib/truth-display";
import type { RelationType } from "@actalk/inkchain-core";

export interface GraphNodeData {
  id: string;
  label: string;
  tier: CharacterTier;
  rolePath: string;
  description?: string;
  chapterAppearances: number;
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  relationType: RelationType;
  /** Display label — falls back to preset label if customLabel is unset */
  label: string;
  /** User-defined custom relation label (overrides preset) */
  customLabel?: string;
  intensity: number;
  isForgotten: boolean;
  description?: string;
  /** The chapter where this relation first becomes active (1-based) */
  validFromChapter?: number;
  /** The chapter where this relation ceases to be active (1-based, inclusive) */
  validUntilChapter?: number;
}
