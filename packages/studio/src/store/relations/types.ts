import type { CharacterTier } from "../../lib/truth-display";
import type { RelationType } from "@actalk/inkos-core";

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
  label: string;
  intensity: number;
  isForgotten: boolean;
  description?: string;
}
