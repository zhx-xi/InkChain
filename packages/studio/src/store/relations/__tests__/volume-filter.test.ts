import { describe, it, expect } from "vitest";
import type { GraphEdgeData } from "../types";

// ─── Pure filter function extracted from the component ─────────────────────

function filterEdgesByVolume(
  edges: readonly GraphEdgeData[],
  volumeChapterRange: [number, number] | null,
): GraphEdgeData[] {
  if (!volumeChapterRange) return [...edges];
  const [minCh, maxCh] = volumeChapterRange;
  return edges.filter((e) => {
    if (e.validFromChapter === undefined || e.validFromChapter === null) return false;
    if (e.validFromChapter < minCh) return false;
    if (e.validFromChapter > maxCh) return false;
    return true;
  });
}

// ─── Fixtures ──────────────────────────────────────────────────────────────

const edges: readonly GraphEdgeData[] = [
  // Edges with various validFromChapter values
  {
    id: "e1", source: "a", target: "b", relationType: "close_friend",
    label: "挚友", intensity: 4, isForgotten: false,
    validFromChapter: 1,
  },
  {
    id: "e2", source: "b", target: "c", relationType: "rival",
    label: "敌对", intensity: 3, isForgotten: false,
    validFromChapter: 5,
  },
  {
    id: "e3", source: "c", target: "d", relationType: "mentor",
    label: "师徒", intensity: 2, isForgotten: false,
    validFromChapter: 10,
  },
  {
    id: "e4", source: "d", target: "e", relationType: "alliance",
    label: "联盟", intensity: 1, isForgotten: false,
    validFromChapter: 15,
  },
  {
    id: "e5", source: "e", target: "f", relationType: "family",
    label: "家族", intensity: 5, isForgotten: false,
    validFromChapter: 20,
  },
  // Edge with validUntilChapter (open-ended within range)
  {
    id: "e6", source: "f", target: "g", relationType: "close_friend",
    label: "好友", intensity: 3, isForgotten: false,
    validFromChapter: 8, validUntilChapter: 25,
  },
  // Edge without validFromChapter
  {
    id: "e7", source: "g", target: "h", relationType: "acquaintance",
    label: "相识", intensity: 1, isForgotten: false,
  },
  // Edge with undefined validFromChapter
  {
    id: "e8", source: "h", target: "i", relationType: "one_shot",
    label: "一面之缘", intensity: 1, isForgotten: false,
    validFromChapter: undefined,
  },
];

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("volume edge filter", () => {
  describe("no volume selected (volumeChapterRange is null)", () => {
    it("returns all edges when no volume is selected", () => {
      const result = filterEdgesByVolume(edges, null);
      expect(result).toHaveLength(edges.length);
    });

    it("returns a new array, not the original reference", () => {
      const result = filterEdgesByVolume(edges, null);
      expect(result).not.toBe(edges);
    });
  });

  describe("volume with chapter range [1, 5]", () => {
    it("includes edges whose validFromChapter falls within range", () => {
      const result = filterEdgesByVolume(edges, [1, 5]);
      // e1 (ch1), e2 (ch5) should be included
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.id)).toEqual(["e1", "e2"]);
    });

    it("excludes edges with validFromChapter below range", () => {
      // Volume [5, 10]: exclude edges with validFromChapter < 5
      const result = filterEdgesByVolume(edges, [5, 10]);
      expect(result.map((e) => e.id)).not.toContain("e1"); // ch1 < 5
    });

    it("excludes edges with validFromChapter above range", () => {
      // Volume [1, 3]: exclude edges with validFromChapter > 3
      const result = filterEdgesByVolume(edges, [1, 3]);
      expect(result.map((e) => e.id)).not.toContain("e4"); // ch15 > 3
    });
  });

  describe("volume with chapter range [8, 15]", () => {
    it("includes edges on the boundary", () => {
      const result = filterEdgesByVolume(edges, [8, 15]);
      // e3 (ch10), e4 (ch15), e6 (ch8) in range
      expect(result.map((e) => e.id)).toEqual(
        expect.arrayContaining(["e3", "e4", "e6"]),
      );
    });

    it("excludes edges before the range", () => {
      const result = filterEdgesByVolume(edges, [8, 15]);
      expect(result.map((e) => e.id)).not.toContain("e1"); // ch1
      expect(result.map((e) => e.id)).not.toContain("e2"); // ch5
    });

    it("excludes edges after the range", () => {
      const result = filterEdgesByVolume(edges, [8, 15]);
      expect(result.map((e) => e.id)).not.toContain("e5"); // ch20
    });
  });

  describe("volume with single chapter [10, 10]", () => {
    it("includes only edges whose validFromChapter is exactly 10", () => {
      const result = filterEdgesByVolume(edges, [10, 10]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("e3");
    });
  });

  describe("edges without chapter info", () => {
    it("excludes edges with undefined validFromChapter", () => {
      const result = filterEdgesByVolume(edges, [1, 30]);
      expect(result.map((e) => e.id)).not.toContain("e7");
      expect(result.map((e) => e.id)).not.toContain("e8");
    });

    it("excludes edges with null validFromChapter", () => {
      const result = filterEdgesByVolume(
        edges.map((e) =>
          e.id === "e1" ? { ...e, validFromChapter: null as unknown as undefined } : e,
        ),
        [1, 10],
      );
      expect(result.map((e) => e.id)).not.toContain("e1");
    });
  });

  describe("empty results", () => {
    it("returns empty array when no edges match the volume", () => {
      const result = filterEdgesByVolume(edges, [50, 60]);
      expect(result).toHaveLength(0);
    });

    it("returns empty array when given empty edge list", () => {
      const result = filterEdgesByVolume([], [1, 10]);
      expect(result).toHaveLength(0);
    });
  });
});

// ─── Integration-style: building filtered node set from filtered edges ─────

describe("node set derived from filtered edges", () => {
  it("includes only nodes connected by filtered edges", () => {
    const filtered = filterEdgesByVolume(edges, [1, 5]);
    const nodeIds = new Set<string>();
    for (const e of filtered) {
      nodeIds.add(e.source);
      nodeIds.add(e.target);
    }
    // e1 (a-b) + e2 (b-c) → nodes {a, b, c}
    expect(nodeIds).toEqual(new Set(["a", "b", "c"]));
  });

  it("produces empty node set when no edges match", () => {
    const filtered = filterEdgesByVolume(edges, [50, 60]);
    const nodeIds = new Set<string>();
    for (const e of filtered) {
      nodeIds.add(e.source);
      nodeIds.add(e.target);
    }
    expect(nodeIds.size).toBe(0);
  });
});
