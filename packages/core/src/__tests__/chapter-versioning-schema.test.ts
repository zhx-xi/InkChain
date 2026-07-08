import { describe, it, expect } from "vitest";
import { ChapterVersioningModeSchema, ProjectConfigSchema } from "../models/project.js";

describe("ChapterVersioningModeSchema", () => {
  it("accepts 'snapshot' (default)", () => {
    const result = ChapterVersioningModeSchema.safeParse("snapshot");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("snapshot");
  });

  it("accepts 'git'", () => {
    const result = ChapterVersioningModeSchema.safeParse("git");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("git");
  });

  it("accepts 'off'", () => {
    const result = ChapterVersioningModeSchema.safeParse("off");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("off");
  });

  it("rejects invalid values", () => {
    const result = ChapterVersioningModeSchema.safeParse("auto");
    expect(result.success).toBe(false);
  });

  it("defaults to 'snapshot' in new projects", () => {
    const config = ProjectConfigSchema.parse({
      name: "test-project",
      version: "0.1.0",
      language: "zh",
      llm: {
        provider: "custom",
        service: "custom",
        configSource: "studio",
        baseUrl: "http://localhost:11434/v1",
        model: "gpt-4",
        cover: undefined,
      },
    });
    expect(config.chapterVersioning).toBe("snapshot");
  });

  it("persists explicit mode in project config", () => {
    const config = ProjectConfigSchema.parse({
      name: "test-project",
      version: "0.1.0",
      language: "zh",
      llm: {
        provider: "custom",
        service: "custom",
        configSource: "studio",
        baseUrl: "http://localhost:11434/v1",
        model: "gpt-4",
        cover: undefined,
      },
      chapterVersioning: "off",
    });
    expect(config.chapterVersioning).toBe("off");
  });

  it("rejects unknown chapter versioning values", () => {
    const result = ProjectConfigSchema.safeParse({
      name: "test-project",
      version: "0.1.0",
      language: "zh",
      llm: {
        provider: "custom",
        service: "custom",
        configSource: "studio",
        baseUrl: "http://localhost:11434/v1",
        model: "gpt-4",
        cover: undefined,
      },
      chapterVersioning: "invalid-mode",
    });
    expect(result.success).toBe(false);
  });
});
