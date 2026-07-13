import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createRelationsRouter } from "../routes/relations.js";
import { type RelationsFile } from "@inkchain/inkchain-core";

// ── Helpers ──

function createTmpBookDir(): string {
  const dir = join(tmpdir(), `inkos-test-relations-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  return dir;
}

async function writeRelationsFile(bookDir: string, data: RelationsFile): Promise<void> {
  const dir = join(bookDir, "story", "state");
  await mkdir(dir, { recursive: true });
  await writeFile(join(bookDir, "story", "state", "relations.json"), JSON.stringify(data, null, 2));
}

// ── Tests ──

describe("Relations CRUD API", () => {
  let bookDir: string;
  let router: ReturnType<typeof createRelationsRouter>;

  beforeEach(() => {
    bookDir = createTmpBookDir();
    router = createRelationsRouter((_id: string) => bookDir);
  });

  afterEach(async () => {
    await rm(bookDir, { recursive: true, force: true });
  });

  describe("GET /:id/relations", () => {
    it("should return empty list when no relations file exists", async () => {
      const res = await router.request("/test-book/relations");
      expect(res.status).toBe(200);
      const body = await res.json() as { relations: unknown[] };
      expect(body.relations).toEqual([]);
    });

    it("should return all relations", async () => {
      await writeRelationsFile(bookDir, {
        schemaVersion: "1",
        relations: [
          {
            id: "550e8400-e29b-41d4-a716-446655440000",
            sourceRoleId: "protagonist-1",
            targetRoleId: "supporting-1",
            relationType: "close_friend",
            description: "童年挚友",
            validFromChapter: 1,
            validUntilChapter: 24,
            intensity: 4,
            createdAt: "2025-06-01T00:00:00.000Z",
            updatedAt: "2025-06-01T00:00:00.000Z",
          },
        ],
      });

      const res = await router.request("/test-book/relations");
      expect(res.status).toBe(200);
      const body = await res.json() as { relations: unknown[] };
      expect(body.relations).toHaveLength(1);
      expect(body.relations[0]).toMatchObject({ sourceRoleId: "protagonist-1" });
    });

    it("should filter by character query param", async () => {
      await writeRelationsFile(bookDir, {
        schemaVersion: "1",
        relations: [
          {
            id: "550e8400-e29b-41d4-a716-446655440001",
            sourceRoleId: "char-a",
            targetRoleId: "char-b",
            relationType: "close_friend",
            validFromChapter: 1,
            intensity: 3,
            createdAt: "2025-06-01T00:00:00.000Z",
            updatedAt: "2025-06-01T00:00:00.000Z",
          },
          {
            id: "550e8400-e29b-41d4-a716-446655440002",
            sourceRoleId: "char-c",
            targetRoleId: "char-a",
            relationType: "rival",
            validFromChapter: 5,
            intensity: 5,
            createdAt: "2025-06-01T00:00:00.000Z",
            updatedAt: "2025-06-01T00:00:00.000Z",
          },
        ],
      });

      const res = await router.request("/test-book/relations?character=char-a");
      expect(res.status).toBe(200);
      const body = await res.json() as { relations: unknown[] };
      expect(body.relations).toHaveLength(2); // char-a is both source and target
    });

    it("should return empty when character has no relations", async () => {
      await writeRelationsFile(bookDir, {
        schemaVersion: "1",
        relations: [
          {
            id: "550e8400-e29b-41d4-a716-446655440003",
            sourceRoleId: "char-x",
            targetRoleId: "char-y",
            relationType: "alliance",
            validFromChapter: 1,
            intensity: 2,
            createdAt: "2025-06-01T00:00:00.000Z",
            updatedAt: "2025-06-01T00:00:00.000Z",
          },
        ],
      });

      const res = await router.request("/test-book/relations?character=nonexistent");
      expect(res.status).toBe(200);
      const body = await res.json() as { relations: unknown[] };
      expect(body.relations).toHaveLength(0);
    });
  });

  describe("POST /:id/relations", () => {
    it("should create a new relation", async () => {
      const payload = {
        sourceRoleId: "protagonist-1",
        targetRoleId: "supporting-1",
        relationType: "mentor",
        description: "师徒关系",
        validFromChapter: 1,
        intensity: 3,
      };

      const res = await router.request("/test-book/relations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(201);
      const body = await res.json() as { relation: { id: string; sourceRoleId: string; relationType: string } };
      expect(body.relation.id).toBeDefined();
      expect(body.relation.sourceRoleId).toBe("protagonist-1");
      expect(body.relation.relationType).toBe("mentor");

      // Verify persistence
      const raw = await readFile(join(bookDir, "story", "state", "relations.json"), "utf-8");
      const saved = JSON.parse(raw) as RelationsFile;
      expect(saved.relations).toHaveLength(1);
      expect(saved.relations[0].id).toBe(body.relation.id);
    });

    it("should reject invalid payload", async () => {
      const res = await router.request("/test-book/relations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceRoleId: "" }), // missing required fields
      });

      expect(res.status).toBe(400);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject non-JSON body", async () => {
      const res = await router.request("/test-book/relations", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "not-json",
      });

      expect(res.status).toBe(400);
    });

    it("should reject invalid relationType", async () => {
      const payload = {
        sourceRoleId: "s1",
        targetRoleId: "t1",
        relationType: "invalid_type",
        validFromChapter: 1,
        intensity: 3,
      };

      const res = await router.request("/test-book/relations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(400);
    });

    it("should reject out-of-range intensity", async () => {
      const payload = {
        sourceRoleId: "s1",
        targetRoleId: "t1",
        relationType: "blood",
        validFromChapter: 1,
        intensity: 99,
      };

      const res = await router.request("/test-book/relations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("PUT /:id/relations/:relationId", () => {
    it("should update an existing relation", async () => {
      // Seed a relation
      await writeRelationsFile(bookDir, {
        schemaVersion: "1",
        relations: [
          {
            id: "550e8400-e29b-41d4-a716-446655440010",
            sourceRoleId: "s1",
            targetRoleId: "t1",
            relationType: "close_friend",
            validFromChapter: 1,
            intensity: 3,
            createdAt: "2025-06-01T00:00:00.000Z",
            updatedAt: "2025-06-01T00:00:00.000Z",
          },
        ],
      });

      const res = await router.request(
        "/test-book/relations/550e8400-e29b-41d4-a716-446655440010",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intensity: 5, description: "更新描述" }),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json() as { relation: { intensity: number; description: string; updatedAt: string } };
      expect(body.relation.intensity).toBe(5);
      expect(body.relation.description).toBe("更新描述");
      expect(body.relation.updatedAt).not.toBe("2025-06-01T00:00:00.000Z");
    });

    it("should return 404 for non-existent relation", async () => {
      const res = await router.request(
        "/test-book/relations/550e8400-e29b-41d4-a716-446655449999",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intensity: 3 }),
        },
      );

      expect(res.status).toBe(404);
    });

    it("should reject invalid field types", async () => {
      await writeRelationsFile(bookDir, {
        schemaVersion: "1",
        relations: [
          {
            id: "550e8400-e29b-41d4-a716-446655440020",
            sourceRoleId: "s1",
            targetRoleId: "t1",
            relationType: "close_friend",
            validFromChapter: 1,
            intensity: 3,
            createdAt: "2025-06-01T00:00:00.000Z",
            updatedAt: "2025-06-01T00:00:00.000Z",
          },
        ],
      });

      const res = await router.request(
        "/test-book/relations/550e8400-e29b-41d4-a716-446655440020",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intensity: "high" }),
        },
      );

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /:id/relations/:relationId", () => {
    it("should delete an existing relation", async () => {
      await writeRelationsFile(bookDir, {
        schemaVersion: "1",
        relations: [
          {
            id: "550e8400-e29b-41d4-a716-446655440030",
            sourceRoleId: "s1",
            targetRoleId: "t1",
            relationType: "secret_crush",
            validFromChapter: 1,
            intensity: 2,
            createdAt: "2025-06-01T00:00:00.000Z",
            updatedAt: "2025-06-01T00:00:00.000Z",
          },
        ],
      });

      const res = await router.request(
        "/test-book/relations/550e8400-e29b-41d4-a716-446655440030",
        { method: "DELETE" },
      );

      expect(res.status).toBe(200);
      const body = await res.json() as { deleted: boolean };
      expect(body.deleted).toBe(true);

      // Verify persistence
      const raw = await readFile(join(bookDir, "story", "state", "relations.json"), "utf-8");
      const saved = JSON.parse(raw) as RelationsFile;
      expect(saved.relations).toHaveLength(0);
    });

    it("should return 404 for non-existent relation", async () => {
      const res = await router.request(
        "/test-book/relations/550e8400-e29b-41d4-a716-446655449999",
        { method: "DELETE" },
      );

      expect(res.status).toBe(404);
    });
  });
});
