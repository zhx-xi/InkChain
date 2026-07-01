import { describe, expect, it } from "vitest";
import {
  CharacterRelationSchema,
  CreateRelationSchema,
  UpdateRelationSchema,
  RelationsFileSchema,
  RelationType,
} from "../models/relations.js";

// A valid relation fixture used across tests.
const VALID_RELATION = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  sourceRoleId: "protagonist-1",
  targetRoleId: "supporting-1",
  relationType: "close_friend" as const,
  description: "童年挚友，暗中相助",
  validFromChapter: 1,
  validUntilChapter: 24,
  intensity: 4,
  createdAt: "2025-06-01T00:00:00.000Z",
  updatedAt: "2025-06-01T00:00:00.000Z",
};

describe("CharacterRelationSchema", () => {
  it("should accept a valid relation", () => {
    const result = CharacterRelationSchema.safeParse(VALID_RELATION);
    expect(result.success).toBe(true);
  });

  it("should reject missing required fields", () => {
    const { sourceRoleId, ...missing } = VALID_RELATION;
    const result = CharacterRelationSchema.safeParse(missing);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("sourceRoleId"))).toBe(true);
    }
  });

  it("should reject empty sourceRoleId", () => {
    const result = CharacterRelationSchema.safeParse({ ...VALID_RELATION, sourceRoleId: "" });
    expect(result.success).toBe(false);
  });

  it("should reject empty targetRoleId", () => {
    const result = CharacterRelationSchema.safeParse({ ...VALID_RELATION, targetRoleId: "" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid relationType", () => {
    const result = CharacterRelationSchema.safeParse({ ...VALID_RELATION, relationType: "arch_enemy" });
    expect(result.success).toBe(false);
  });

  it("should accept all valid relation types", () => {
    for (const rt of RelationType.options) {
      const result = CharacterRelationSchema.safeParse({ ...VALID_RELATION, relationType: rt });
      expect(result.success).toBe(true);
    }
  });

  it("should reject intensity < 1", () => {
    const result = CharacterRelationSchema.safeParse({ ...VALID_RELATION, intensity: 0 });
    expect(result.success).toBe(false);
  });

  it("should reject intensity > 5", () => {
    const result = CharacterRelationSchema.safeParse({ ...VALID_RELATION, intensity: 6 });
    expect(result.success).toBe(false);
  });

  it("should accept intensity at boundaries (1, 5)", () => {
    expect(CharacterRelationSchema.safeParse({ ...VALID_RELATION, intensity: 1 }).success).toBe(true);
    expect(CharacterRelationSchema.safeParse({ ...VALID_RELATION, intensity: 5 }).success).toBe(true);
  });

  it("should reject non-integer intensity", () => {
    const result = CharacterRelationSchema.safeParse({ ...VALID_RELATION, intensity: 2.5 });
    expect(result.success).toBe(false);
  });

  it("should reject invalid uuid", () => {
    const result = CharacterRelationSchema.safeParse({ ...VALID_RELATION, id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid datetime", () => {
    const result = CharacterRelationSchema.safeParse({ ...VALID_RELATION, createdAt: "yesterday" });
    expect(result.success).toBe(false);
  });

  it("should reject validFromChapter < 1", () => {
    const result = CharacterRelationSchema.safeParse({ ...VALID_RELATION, validFromChapter: 0 });
    expect(result.success).toBe(false);
  });

  it("should accept validUntilChapter as optional", () => {
    const { validUntilChapter, ...without } = VALID_RELATION;
    const result = CharacterRelationSchema.safeParse(without);
    expect(result.success).toBe(true);
  });

  it("should accept description as optional", () => {
    const { description, ...without } = VALID_RELATION;
    const result = CharacterRelationSchema.safeParse(without);
    expect(result.success).toBe(true);
  });
});

describe("CreateRelationSchema", () => {
  it("should omit id, createdAt, updatedAt", () => {
    const result = CreateRelationSchema.safeParse({
      sourceRoleId: "s1",
      targetRoleId: "t1",
      relationType: "rival",
      validFromChapter: 1,
      intensity: 3,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // id should NOT be part of the parsed data
      expect((result.data as Record<string, unknown>).id).toBeUndefined();
    }
  });

  it("should reject when sourceRoleId is missing", () => {
    const result = CreateRelationSchema.safeParse({
      targetRoleId: "t1",
      relationType: "rival",
      validFromChapter: 1,
      intensity: 3,
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateRelationSchema", () => {
  it("should accept partial update with one field", () => {
    const result = UpdateRelationSchema.safeParse({ intensity: 5 });
    expect(result.success).toBe(true);
  });

  it("should accept empty object (no-op update)", () => {
    const result = UpdateRelationSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should accept full update", () => {
    const result = UpdateRelationSchema.safeParse(VALID_RELATION);
    expect(result.success).toBe(true);
  });

  it("should reject invalid field type in partial", () => {
    const result = UpdateRelationSchema.safeParse({ intensity: "high" });
    expect(result.success).toBe(false);
  });
});

describe("RelationsFileSchema", () => {
  it("should accept a valid relations file", () => {
    const result = RelationsFileSchema.safeParse({
      schemaVersion: "1",
      relations: [VALID_RELATION],
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid schemaVersion", () => {
    const result = RelationsFileSchema.safeParse({
      schemaVersion: "2",
      relations: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject non-array relations", () => {
    const result = RelationsFileSchema.safeParse({
      schemaVersion: "1",
      relations: "not-an-array",
    });
    expect(result.success).toBe(false);
  });

  it("should accept empty relations array", () => {
    const result = RelationsFileSchema.safeParse({
      schemaVersion: "1",
      relations: [],
    });
    expect(result.success).toBe(true);
  });

  it("should validate each relation in the array", () => {
    const result = RelationsFileSchema.safeParse({
      schemaVersion: "1",
      relations: [VALID_RELATION, { ...VALID_RELATION, intensity: 99 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("RelationType enum", () => {
  it("should have exactly 6 relation types", () => {
    expect(RelationType.options).toHaveLength(6);
  });

  it("should include all expected types", () => {
    expect(RelationType.options).toEqual(
      expect.arrayContaining(["close_friend", "rival", "alliance", "mentor", "blood", "secret_crush"]),
    );
  });
});
