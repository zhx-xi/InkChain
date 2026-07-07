import { create } from "zustand";
import { fetchJson } from "../../hooks/use-api";
import type { CharacterRelation } from "@actalk/inkos-core";
import type { GraphNodeData, GraphEdgeData } from "./types";
import { fuzzyMatchRoleId, roleFromPath, type RoleRef } from "../../lib/truth-display";

interface GraphState {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  selectedNodeId: string | null;
  loading: boolean;
  error: string | null;
  /** Incremented on each successful load — components can watch this to
   *  detect external changes (e.g. tier updates, chapter moves). */
  dataVersion: number;
  loadGraph: (bookId: string) => Promise<void>;
  /** Force a full reload from API even if already loading. */
  refreshGraph: (bookId: string) => Promise<void>;
  selectNode: (nodeId: string | null) => void;
}

/**
 * Build a map of character role paths → tier/name from the truth files listing.
 * This is used to enrich relation nodes with tier metadata.
 */
async function fetchCharacterRoles(
  bookId: string,
): Promise<Map<string, RoleRef>> {
  try {
    const data = await fetchJson<{
      files: ReadonlyArray<{ name: string }>;
    }>(`/books/${bookId}/truth`);
    const roleMap = new Map<string, RoleRef>();
    for (const f of data.files ?? []) {
      const ref = roleFromPath(f.name);
      if (ref) {
        roleMap.set(ref.path, ref);
      }
    }
    return roleMap;
  } catch {
    return new Map();
  }
}

/**
 * Extract a simple character identifier from a roleId.
 * Role IDs follow the pattern "roles/<tier>/<name>" — we use the name portion
 * as a stable identifier. For other formats, return the ID as-is.
 */
function simplifyRoleId(roleId: string): string {
  const m = roleId.match(/^roles\/[^/]+\/(.+)$/);
  return m ? m[1] : roleId;
}

/** Internal load implementation — skipLoadingCheck bypasses the duplicate guard. */
async function doLoadGraph(
  bookId: string,
  skipLoadingCheck: boolean,
  set: (partial: Partial<GraphState>) => void,
  get: () => GraphState,
): Promise<void> {
  if (!skipLoadingCheck && get().loading) return;
  set({ loading: true, error: null, nodes: [], edges: [], selectedNodeId: null });

  try {
    // Fetch character role metadata (tier, name) alongside relations
    const [roleMap, relations] = await Promise.all([
      fetchCharacterRoles(bookId),
      fetchJson<{
        relations: ReadonlyArray<CharacterRelation>;
      }>(`/books/${bookId}/relations`),
    ]);

    const relationList = relations.relations ?? [];

    // Determine the max chapter number across all relations for forgotten-edge detection
    let currentMaxChapter = 0;
    for (const r of relationList) {
      if (r.validFromChapter > currentMaxChapter) {
        currentMaxChapter = r.validFromChapter;
      }
      if (r.validUntilChapter !== undefined && r.validUntilChapter > currentMaxChapter) {
        currentMaxChapter = r.validUntilChapter;
      }
    }

    // Collect unique character IDs from relations
    const characterIds = new Set<string>();
    for (const r of relationList) {
      characterIds.add(r.sourceRoleId);
      characterIds.add(r.targetRoleId);
    }

    // Build nodes: one per unique character
    const nodeMap = new Map<string, GraphNodeData>();
    for (const charId of characterIds) {
      const simpleId = simplifyRoleId(charId);
      const roleRef = roleMap.get(charId);
      // Count appearances (times this character appears as source or target)
      const appearances = relationList.filter(
        (r) => r.sourceRoleId === charId || r.targetRoleId === charId,
      ).length;

      // Resolve role path: try direct lookup first, then fuzzy match
      let resolvedRolePath = charId;
      if (roleRef) {
        resolvedRolePath = charId;
      } else {
        const matched = fuzzyMatchRoleId(charId, roleMap);
        if (matched) {
          resolvedRolePath = matched;
        }
      }

      nodeMap.set(charId, {
        id: resolvedRolePath,
        label: roleRef?.name ?? simpleId,
        tier: roleRef?.tier ?? "scene",
        rolePath: resolvedRolePath,
        chapterAppearances: appearances,
      });
    }

    // Build edges from relations
    const edges: GraphEdgeData[] = relationList.map((r) => {
      const isForgotten =
        r.validUntilChapter !== undefined &&
        r.validUntilChapter < currentMaxChapter;

      return {
        id: r.id,
        source: r.sourceRoleId,
        target: r.targetRoleId,
        relationType: r.relationType,
        label: r.customLabel ?? getRelationLabel(r.relationType),
        customLabel: r.customLabel,
        intensity: r.intensity,
        isForgotten,
        description: r.description,
        validFromChapter: r.validFromChapter,
        validUntilChapter: r.validUntilChapter,
      };
    });

    set({
      nodes: Array.from(nodeMap.values()),
      edges,
      loading: false,
      dataVersion: get().dataVersion + 1,
    });
  } catch (e) {
    set({
      loading: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export const useGraphStore = create<GraphState>()((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  loading: false,
  error: null,
  dataVersion: 0,

  loadGraph: async (bookId: string) => {
    await doLoadGraph(bookId, false, set, get);
  },

  refreshGraph: async (bookId: string) => {
    await doLoadGraph(bookId, true, set, get);
  },

  selectNode: (nodeId: string | null) => {
    set({ selectedNodeId: nodeId });
  },
}));

/**
 * Map a RelationType to a human-readable Chinese label.
 * Uses an inline map instead of importing from @actalk/inkos-core to keep the
 * frontend bundle lean and avoid cross-package dependency concerns.
 */
function getRelationLabel(type: string): string {
  const labels: Record<string, string> = {
    close_friend: "挚友",
    rival: "敌对",
    alliance: "联盟",
    mentor: "师徒",
    blood: "血缘",
    secret_crush: "暗恋",
  };
  return labels[type] ?? type;
}
