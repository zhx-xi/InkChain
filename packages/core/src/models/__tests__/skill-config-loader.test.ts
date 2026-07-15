import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadSkillConfigs,
  mergeSkillConfigs,
  filterByCategory,
  filterEnabled,
  defaultBuiltinRoot,
} from "../skill-config-loader.js";
import { DATA_DIR_NAME } from "../../utils/data-directory.js";
import type { StoredSkillConfig } from "../skill-config.js";

describe("skill config loader (Issue #74)", () => {
  let projectRoot: string;
  let builtinRoot: string;

  beforeEach(async () => {
<<<<<<< HEAD
    projectRoot = await mkdtemp(join(tmpdir(), "inkchain-skill-proj-"));
    builtinRoot = await mkdtemp(join(tmpdir(), "inkchain-skill-builtin-"));
=======
    projectRoot = await mkdtemp(join(tmpdir(), "inkos-skill-proj-"));
    builtinRoot = await mkdtemp(join(tmpdir(), "inkos-skill-builtin-"));
>>>>>>> origin/main
    await mkdir(join(builtinRoot, "skills"), { recursive: true });
    await mkdir(join(projectRoot, DATA_DIR_NAME, "skills"), { recursive: true });
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(builtinRoot, { recursive: true, force: true });
  });

  it("returns an empty list when no skill directories exist", async () => {
    const emptyProj = await mkdtemp(join(tmpdir(), "inkos-empty-proj-"));
    try {
      const result = await loadSkillConfigs({ projectRoot: emptyProj, builtinRoot: "/nonexistent" });
      expect(result.skills).toEqual([]);
      expect(result.diagnostics).toEqual([]);
    } finally {
      await rm(emptyProj, { recursive: true, force: true });
    }
  });

  it("loads builtin skills when only builtin directory has files", async () => {
    await writeSkill(join(builtinRoot, "skills"), "writing-style", {
      id: "writing-style",
      category: "writing",
      description: "Writing style helper",
    });
    const result = await loadSkillConfigs({ projectRoot: projectRoot, builtinRoot });
    expect(result.skills.map((s) => s.config.id)).toEqual(["writing-style"]);
    expect(result.skills[0].source).toBe("builtin");
    expect(result.diagnostics).toEqual([]);
  });

  it("loads project skills when only project directory has files", async () => {
    await writeSkill(join(projectRoot, DATA_DIR_NAME, "skills"), "custom-helper", {
      id: "custom-helper",
      category: "utility",
      description: "Project-local utility",
    });
    const result = await loadSkillConfigs({ projectRoot, builtinRoot });
    expect(result.skills.map((s) => s.config.id)).toEqual(["custom-helper"]);
    expect(result.skills[0].source).toBe("project");
  });

  it("merges builtin and project skills, project wins on id conflict", async () => {
    await writeSkill(join(builtinRoot, "skills"), "shared", {
      id: "shared",
      category: "writing",
      description: "Builtin version",
      enabled: true,
    });
    await writeSkill(join(projectRoot, DATA_DIR_NAME, "skills"), "shared", {
      id: "shared",
      category: "writing",
      description: "Project override",
      enabled: false,
    });
    await writeSkill(join(builtinRoot, "skills"), "builtin-only", {
      id: "builtin-only",
      category: "analysis",
      description: "Only in builtin",
    });
    await writeSkill(join(projectRoot, DATA_DIR_NAME, "skills"), "project-only", {
      id: "project-only",
      category: "character",
      description: "Only in project",
    });

    const result = await loadSkillConfigs({ projectRoot, builtinRoot });
    expect(result.skills).toHaveLength(3);
    const shared = result.skills.find((s) => s.config.id === "shared");
    expect(shared?.source).toBe("project");
    expect(shared?.config.description).toBe("Project override");
    expect(shared?.config.enabled).toBe(false);
    expect(result.diagnostics).toEqual([]);
  });

  it("returns a diagnostic for malformed JSON", async () => {
    await writeFile(
      join(builtinRoot, "skills", "bad.json"),
      "{ this is not valid json",
      "utf-8",
    );
    const result = await loadSkillConfigs({ projectRoot, builtinRoot });
    expect(result.skills).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].path).toContain("bad.json");
    expect(result.diagnostics[0].message).toMatch(/JSON/i);
  });

  it("returns a diagnostic for schema validation failure", async () => {
    await writeSkill(join(builtinRoot, "skills"), "bad-shape", {
      id: "BadID",
      category: "unknown-category",
    });
    const result = await loadSkillConfigs({ projectRoot, builtinRoot });
    expect(result.skills).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toMatch(/category|kebab/i);
  });

  it("ignores non-json files in the skills directory", async () => {
    await writeFile(
      join(builtinRoot, "skills", "README.md"),
      "# notes",
      "utf-8",
    );
    await writeSkill(join(builtinRoot, "skills"), "real-skill", {
      id: "real-skill",
      category: "writing",
    });
    const result = await loadSkillConfigs({ projectRoot, builtinRoot });
    expect(result.skills.map((s) => s.config.id)).toEqual(["real-skill"]);
  });

  describe("defaultBuiltinRoot (Issue #305)", () => {
    it("resolves a valid non-null directory path", () => {
      const root = defaultBuiltinRoot();
      expect(root).not.toBeNull();
      expect(typeof root).toBe("string");
    });
  });

  describe("mergeSkillConfigs (pure helper)", () => {
    function makeStored(id: string, source: "builtin" | "project"): StoredSkillConfig {
      return {
        config: { id, category: "writing", triggers: [], injection: { mode: "append", target: "system_prompt", priority: 50 }, params: {}, enabled: true, description: `${id} ${source}`, prompt: "" },
        source,
        path: `/path/${id}.json`,
      };
    }

    it("merges with project precedence and sorts by id", () => {
      const merged = mergeSkillConfigs(
        [makeStored("b", "builtin"), makeStored("a", "builtin")],
        [makeStored("a", "project")],
      );
      expect(merged.map((s) => `${s.config.id}:${s.source}`)).toEqual([
        "a:project",
        "b:builtin",
      ]);
    });

    it("returns builtin list when project is empty", () => {
      const merged = mergeSkillConfigs(
        [makeStored("a", "builtin"), makeStored("b", "builtin")],
        [],
      );
      expect(merged.map((s) => s.source)).toEqual(["builtin", "builtin"]);
    });
  });

  describe("filter helpers", () => {
    function makeStored(id: string, category: string, enabled = true): StoredSkillConfig {
      return {
        config: {
          id,
          category: category as "writing" | "analysis" | "world" | "character" | "utility",
          triggers: [],
          injection: { mode: "append", target: "system_prompt", priority: 50 },
          params: {},
          enabled,
          description: "",
          prompt: "",
        },
        source: "project",
        path: `/p/${id}.json`,
      };
    }

    it("filterByCategory keeps only matching category", () => {
      const skills = [
        makeStored("w1", "writing"),
        makeStored("a1", "analysis"),
        makeStored("w2", "writing"),
      ];
      const filtered = filterByCategory(skills, "writing");
      expect(filtered.map((s) => s.config.id)).toEqual(["w1", "w2"]);
    });

    it("filterEnabled keeps only enabled skills", () => {
      const skills = [
        makeStored("on1", "writing", true),
        makeStored("off", "writing", false),
        makeStored("on2", "writing", true),
      ];
      const filtered = filterEnabled(skills);
      expect(filtered.map((s) => s.config.id)).toEqual(["on1", "on2"]);
    });
  });
});

async function writeSkill(
  dir: string,
  filename: string,
  data: Record<string, unknown>,
): Promise<void> {
  await writeFile(join(dir, `${filename}.json`), JSON.stringify(data), "utf-8");
}
