import { describe, it, expect } from "vitest";
import type { AgentStatus, AgentStatusIndicatorProps } from "../AgentStatusIndicator";
import type { WritingProgressProps, AgentProgressItem } from "../WritingProgress";
import type { WritingQuickActionsProps } from "../WritingQuickActions";

describe("AgentStatusIndicator types", () => {
  it("defines AgentStatus correctly", () => {
    const idleAgent: AgentStatus = { id: "writer", name: "Writer", status: "idle" };
    expect(idleAgent.id).toBe("writer");
    expect(idleAgent.name).toBe("Writer");
    expect(idleAgent.status).toBe("idle");

    const thinkingAgent: AgentStatus = { id: "architect", name: "Architect", status: "thinking", progress: 50 };
    expect(thinkingAgent.status).toBe("thinking");
    expect(thinkingAgent.progress).toBe(50);

    const errorAgent: AgentStatus = {
      id: "auditor",
      name: "Auditor",
      status: "error",
      lastError: "Something broke",
    };
    expect(errorAgent.status).toBe("error");
    expect(errorAgent.lastError).toBe("Something broke");

    const writingAgent: AgentStatus = {
      id: "reviser",
      name: "Reviser",
      status: "writing",
      currentStage: "Revising chapter 3",
      progress: 75,
    };
    expect(writingAgent.status).toBe("writing");
    expect(writingAgent.currentStage).toBe("Revising chapter 3");
    expect(writingAgent.progress).toBe(75);
  });

  it("defines AgentStatusIndicatorProps correctly", () => {
    const props: AgentStatusIndicatorProps = {
      agents: [
        { id: "w", name: "W", status: "idle" },
        { id: "a", name: "A", status: "writing" },
      ],
    };
    expect(props.agents).toHaveLength(2);
    expect(props.onHover).toBeUndefined();
  });

  it("supports onHover callback", () => {
    const props: AgentStatusIndicatorProps = {
      agents: [{ id: "w", name: "W", status: "idle" }],
      onHover: (agent) => {
        if (agent) {
          expect(agent.id).toBe("w");
        }
      },
    };
    expect(props.onHover).toBeDefined();
    props.onHover!({ id: "w", name: "W", status: "idle" });
    props.onHover!(null);
  });
});

describe("WritingProgress types", () => {
  it("defines WritingProgressProps correctly", () => {
    const agentProgress: AgentProgressItem[] = [
      { agentId: "writer", agentName: "Writer", progress: 100, status: "completed" },
      { agentId: "architect", agentName: "Architect", progress: 50, status: "running" },
    ];

    const props: WritingProgressProps = {
      currentWordCount: 2500,
      targetWordCount: 5000,
      chapterNumber: 3,
      chapterTitle: "The Beginning",
      agentProgress,
    };

    expect(props.currentWordCount).toBe(2500);
    expect(props.targetWordCount).toBe(5000);
    expect(props.chapterNumber).toBe(3);
    expect(props.chapterTitle).toBe("The Beginning");
    expect(props.agentProgress).toHaveLength(2);
  });

  it("works without optional fields", () => {
    const props: WritingProgressProps = {
      currentWordCount: 0,
      targetWordCount: 5000,
      chapterNumber: 1,
      agentProgress: [],
    };
    expect(props.chapterTitle).toBeUndefined();
    expect(props.agentProgress).toEqual([]);
  });
});

describe("WritingQuickActions types", () => {
  it("defines WritingQuickActionsProps correctly", () => {
    const props: WritingQuickActionsProps = {
      onGenerateNext: () => {},
      onRewriteSelection: () => {},
      onAdjustParams: () => {},
      onSwitchPersona: () => {},
    };
    expect(props.onGenerateNext).toBeDefined();
    expect(props.onRewriteSelection).toBeDefined();
    expect(props.disabled).toBeUndefined();
  });

  it("supports optional collapsed state", () => {
    const props: WritingQuickActionsProps = {
      onGenerateNext: () => {},
      onRewriteSelection: () => {},
      onAdjustParams: () => {},
      onSwitchPersona: () => {},
      collapsed: true,
      onToggleCollapse: () => {},
      disabled: false,
    };
    expect(props.collapsed).toBe(true);
  });

  it("handles callback invocation", () => {
    let called = false;
    const props: WritingQuickActionsProps = {
      onGenerateNext: () => { called = true; },
      onRewriteSelection: () => {},
      onAdjustParams: () => {},
      onSwitchPersona: () => {},
    };
    props.onGenerateNext();
    expect(called).toBe(true);
  });
});
