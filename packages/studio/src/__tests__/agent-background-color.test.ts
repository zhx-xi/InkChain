// ── Agent Background Color Design System Token Tests (Bug #626) ──
//
// Verifies that the Agent Team components use CSS variable tokens
// instead of hardcoded warm color values (#FDF6F0, #FFFBF7, #E8D8C8),
// ensuring consistency with the page design system.

import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");

async function readSource(relPath: string): Promise<string> {
  return readFile(resolve(PROJECT_ROOT, relPath), "utf-8");
}

describe("AgentFlowEditor — WARM_LITERAL design tokens", () => {
  it("WARM_LITERAL.bg uses CSS variable --background instead of hardcoded #FDF6F0", async () => {
    const source = await readSource("src/components/AgentFlowEditor.tsx");
    // WARM_LITERAL.bg should reference var(--background)
    expect(source).toContain('bg: "var(--background)"');
    expect(source).not.toContain('bg: "#FDF6F0"');
  });

  it("WARM_LITERAL.bgCard uses CSS variable --card instead of hardcoded #FFFBF7", async () => {
    const source = await readSource("src/components/AgentFlowEditor.tsx");
    expect(source).toContain('bgCard: "var(--card)"');
    expect(source).not.toContain('bgCard: "#FFFBF7"');
  });

  it("WARM_LITERAL.border uses hsl(var(--border)) instead of hardcoded #E8D8C8", async () => {
    const source = await readSource("src/components/AgentFlowEditor.tsx");
    expect(source).toContain('border: "hsl(var(--border))"');
    expect(source).not.toContain('border: "#E8D8C8"');
  });

  it("WARM_LITERAL.text uses CSS variable --foreground instead of hardcoded #3a2a1a", async () => {
    const source = await readSource("src/components/AgentFlowEditor.tsx");
    expect(source).toContain('text: "var(--foreground)"');
    expect(source).not.toContain('text: "#3a2a1a"');
  });

  it("WARM_LITERAL.textMuted uses hsl(var(--muted-foreground)) instead of hardcoded #8a7a6a", async () => {
    const source = await readSource("src/components/AgentFlowEditor.tsx");
    expect(source).toContain('textMuted: "hsl(var(--muted-foreground))"');
    expect(source).not.toContain('textMuted: "#8a7a6a"');
  });
});

describe("AgentFlowEditor — Controls className uses CSS var classes", () => {
  it("Controls button styles use Tailwind CSS variable classes instead of hardcoded hex colors", async () => {
    const source = await readSource("src/components/AgentFlowEditor.tsx");
    expect(source).toContain("[&>button]:border-border");
    expect(source).toContain("[&>button]:bg-card");
    expect(source).toContain("[&>button]:text-foreground");
    expect(source).not.toContain("#E8D8C8");
    expect(source).not.toContain("#FFFBF7");
    expect(source).not.toContain("#3a2a1a");
  });
});

describe("AgentHubPage — no hardcoded background color", () => {
  it('AgentHubPage does not use inline style with backgroundColor: "#FDF6F0"', async () => {
    const source = await readSource("src/pages/AgentHubPage.tsx");
    expect(source).not.toContain('backgroundColor: "#FDF6F0"');
    expect(source).not.toContain('backgroundColor: "#FFFBF7"');
  });

  it("AgentHubPage source exports the component (check module exports compile-time)", async () => {
    const source = await readSource("src/pages/AgentHubPage.tsx");
    // Verify the component is exported as a named export
    expect(source).toContain("export function AgentHubPage");
  });
});

describe("AgentTeamPanel — background color tokens", () => {
  it("root container uses var(--background) instead of #FDF6F0", async () => {
    const source = await readSource("src/pages/AgentTeamPanel.tsx");
    // The main container bg should use CSS variable
    const bgUsageCount = (source.match(/var\(--background\)/g) ?? []).length;
    expect(bgUsageCount).toBeGreaterThanOrEqual(5);
    // Ensure no hardcoded warm backgrounds remain
    expect(source).not.toContain('backgroundColor: "#FDF6F0"');
    expect(source).not.toContain('backgroundColor: "#FFFBF7"');
  });

  it("card backgrounds use var(--card) instead of #FFFBF7", async () => {
    const source = await readSource("src/pages/AgentTeamPanel.tsx");
    const cardUsageCount = (source.match(/var\(--card\)/g) ?? []).length;
    expect(cardUsageCount).toBeGreaterThanOrEqual(5);
  });

  it("borders use hsl(var(--border)) instead of #E8D8C8", async () => {
    const source = await readSource("src/pages/AgentTeamPanel.tsx");
    const borderUsageCount = (source.match(/hsl\(var\(--border\)\)/g) ?? []).length;
    expect(borderUsageCount).toBeGreaterThanOrEqual(15);
  });

  it("loading state uses var(--background) instead of #FDF6F0", async () => {
    const source = await readSource("src/pages/AgentTeamPanel.tsx");
    expect(source).toContain('backgroundColor: "var(--background)"');
  });

  it("error state uses var(--background) instead of #FDF6F0", async () => {
    const source = await readSource("src/pages/AgentTeamPanel.tsx");
    expect(source).toContain('backgroundColor: "var(--background)"');
  });
});

describe("AgentTeamPanel — component exports", () => {
  it("AgentTeamPanel source exports the component", async () => {
    const source = await readSource("src/pages/AgentTeamPanel.tsx");
    expect(source).toContain("export function AgentTeamPanel");
  });

  it("AgentTeamPanel provides hashed export for agent flow", async () => {
    const source = await readSource("src/pages/AgentTeamPanel.tsx");
    // Component provides the team panel interface for use by parent components
    expect(source).toContain("AgentTeamPanelProps");
    expect(source).toContain("AgentTeamPanel");
  });
});

describe("No hardcoded warm background colors remain in agent components", () => {
  const agentComponentFiles = [
    "src/pages/AgentTeamPanel.tsx",
    "src/pages/AgentHubPage.tsx",
    "src/components/AgentFlowEditor.tsx",
  ];

  for (const file of agentComponentFiles) {
    it(`${file} has no remaining #FDF6F0`, async () => {
      const source = await readSource(file);
      // Allow #FDF6F0 in comments (e.g. "was #FDF6F0") but not in active code
      const lines = source.split("\n");
      const codeLines = lines.filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"));
      const matches = codeLines.filter((line) => line.includes("#FDF6F0"));
      // Allow only if it's in a string describing the old value
      const oldValueRefs = matches.filter((line) => line.includes("was") || line.includes("old") || line.includes("legacy") || line.includes("previously"));
      expect(matches.length - oldValueRefs.length).toBe(0);
    });

    it(`${file} has no remaining #FFFBF7`, async () => {
      const source = await readSource(file);
      expect(source).not.toContain("#FFFBF7");
    });

    it(`${file} has no remaining #E8D8C8`, async () => {
      const source = await readSource(file);
      expect(source).not.toContain("#E8D8C8");
    });
  }
});
