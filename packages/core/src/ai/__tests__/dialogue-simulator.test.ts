import { describe, expect, it } from "vitest";
import {
  buildVoiceConstraints,
  buildDialogueSystemPrompt,
  createDialogueSession,
  addTurn,
  buildDialogueMessages,
  exportDialogueAsMaterial,
} from "../dialogue-simulator.js";

describe("buildVoiceConstraints (AI-4)", () => {
  it("detects gentle tone from description", () => {
    const constraints = buildVoiceConstraints("一个温柔文雅的角色，说话礼貌客气");
    expect(constraints.tone).toContain("gentle");
    expect(constraints.formality).toBe("formal");
  });

  it("detects firm tone", () => {
    const constraints = buildVoiceConstraints("一个态度强硬的严厉角色");
    expect(constraints.tone).toContain("firm");
  });

  it("detects lively tone", () => {
    const constraints = buildVoiceConstraints("活泼开朗的性格，爱开玩笑");
    expect(constraints.tone).toContain("lively");
  });

  it("handles empty description gracefully", () => {
    const constraints = buildVoiceConstraints("");
    expect(constraints.tone).toHaveLength(0);
    expect(constraints.formality).toBe("mixed");
    expect(constraints.vocabularyStyle).toBe("neutral");
  });
});

describe("buildDialogueSystemPrompt (AI-4)", () => {
  it("builds a prompt with character name", () => {
    const c = buildVoiceConstraints("温柔的角色");
    const prompt = buildDialogueSystemPrompt("测试角色", c, "咖啡馆");
    expect(prompt).toContain("测试角色");
    expect(prompt).toContain("咖啡馆");
  });
});

describe("DialogueSession (AI-4)", () => {
  it("creates empty session", () => {
    const session = createDialogueSession({
      characterId: "char1",
      scenario: "In a tavern",
      temperature: 0.8,
      maxTokens: 500,
    });
    expect(session.id).toBeDefined();
    expect(session.turns).toHaveLength(0);
    expect(session.config.scenario).toBe("In a tavern");
  });

  it("adds turns to session", () => {
    let session = createDialogueSession({
      characterId: "char1",
      scenario: "",
      temperature: 0.7,
      maxTokens: 300,
    });
    session = addTurn(session, "Alice", "char1", "Hello!");
    expect(session.turns).toHaveLength(1);
    expect(session.turns[0].text).toBe("Hello!");
  });

  it("builds dialogue messages from turns", () => {
    let session = createDialogueSession({
      characterId: "char1",
      scenario: "Test",
      temperature: 0.7,
      maxTokens: 300,
    });
    session = addTurn(session, "Alice", "char1", "Hi");
    session = addTurn(session, "Bob", "char2", "Hello");

    const c = buildVoiceConstraints("friendly");
    const prompt = buildDialogueSystemPrompt("Alice", c, "Test");
    const messages = buildDialogueMessages(prompt, session.turns);
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages[0].role).toBe("system");
  });

  it("exports dialogue as novel format", () => {
    let session = createDialogueSession({
      characterId: "char1",
      scenario: "",
      temperature: 0.7,
      maxTokens: 300,
    });
    session = addTurn(session, "Alice", "char1", "你好吗？");
    session = addTurn(session, "Bob", "char2", "我很好，谢谢！");

    const novel = exportDialogueAsMaterial(session.turns, "novel");
    expect(novel).toContain("你好吗？");
    expect(novel).toContain("我很好");
  });
});
