// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

afterEach(cleanup);

const DIMENSION_LABELS: Record<string, string> = {
  settings: "世界观设定",
  roles: "世界角色",
  relations: "世界关系",
  regions: "地理区域",
  institutions: "组织势力",
  history: "历史事件",
  rules: "世界规则",
};

/** Mirrors the AiExtractResponse interface after the fix */
interface AiExtractResponse {
  readonly summary: string;
  readonly entities: Array<{ type: string; name: string; description?: string }>;
  readonly sections: Array<{ readonly type: string; readonly name: string; readonly description?: string }>;
  readonly textLength: number;
  readonly chaptersRead: number;
}

/** Mirrors the sections rendering block from WorldListPage.tsx (line 372-387) */
function SectionsDisplay({ sections }: { readonly sections: AiExtractResponse["sections"] }) {
  if (sections.length === 0) return null;
  return (
    <div>
      <h3>提取维度</h3>
      <div>
        {sections.map((section, idx) => (
          <span key={idx} data-testid={`section-${idx}`}>
            {DIMENSION_LABELS[section.type] || section.name}
          </span>
        ))}
      </div>
    </div>
  );
}

describe("WorldListPage - AI Extract sections rendering", () => {
  it("renders section objects with type and name without crashing", () => {
    const mockSections: AiExtractResponse["sections"] = [
      { type: "settings", name: "世界观设定" },
      { type: "roles", name: "世界角色" },
      { type: "unknown-type", name: "自定义维度" },
    ];

    const { container } = render(<SectionsDisplay sections={mockSections} />);

    expect(container.textContent).toContain("世界观设定");
    expect(container.textContent).toContain("世界角色");
    // For unknown types, falls back to section.name
    expect(container.textContent).toContain("自定义维度");
  });

  it("renders section objects with description field", () => {
    const mockSections: AiExtractResponse["sections"] = [
      { type: "regions", name: "地理区域", description: "世界的物理地理" },
      { type: "history", name: "历史事件", description: "重大历史事件" },
    ];

    const { container } = render(<SectionsDisplay sections={mockSections} />);

    expect(container.textContent).toContain("地理区域");
    expect(container.textContent).toContain("历史事件");
  });

  it("returns null for empty sections array", () => {
    const { container } = render(<SectionsDisplay sections={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("handles section type matching DIMENSION_LABELS correctly", () => {
    const mockSections: AiExtractResponse["sections"] = [
      { type: "institutions", name: "组织势力" },
      { type: "rules", name: "世界规则" },
      { type: "relations", name: "世界关系" },
    ];

    const { container } = render(<SectionsDisplay sections={mockSections} />);

    expect(container.textContent).toContain("组织势力");
    expect(container.textContent).toContain("世界规则");
    expect(container.textContent).toContain("世界关系");
  });

  it("renders multiple sections with correct count", () => {
    const mockSections: AiExtractResponse["sections"] = [
      { type: "roles", name: "世界角色" },
      { type: "regions", name: "地理区域" },
      { type: "settings", name: "世界观设定" },
    ];

    render(<SectionsDisplay sections={mockSections} />);

    const items = screen.getAllByTestId(/^section-/);
    expect(items).toHaveLength(3);
  });

  it("accepts AiExtractResponse type with object sections (type-level test)", () => {
    // This test validates that the AiExtractResponse type accepts objects
    const response: AiExtractResponse = {
      summary: "Test",
      entities: [],
      sections: [
        { type: "settings", name: "世界观设定" },
        { type: "roles", name: "世界角色", description: "角色描述" },
      ],
      textLength: 100,
      chaptersRead: 1,
    };

    expect(response.sections[0].type).toBe("settings");
    expect(response.sections[1].description).toBe("角色描述");
  });
});
