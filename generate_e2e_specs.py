#!/usr/bin/env python3
"""Generate E2E skeleton spec files for Feature milestone E2E template issues."""

IMPORT_LINE = 'import { test, expect } from "@playwright/test";'

SPEC_TPL = """{import_line}

// E2E skeleton: {page_display}
// Issues: {issues_list}
// TODO: fill real E2E code in review/test task
// This is a skeleton spec — tests are skipped and will be filled by review/test task.

test.describe("{page_display} E2E", () => {{
{test_bodies}
}});
"""

TEST_TPL = """  test("{idx}. {name}", async ({{ page }}) => {{
    // TODO: implement E2E test for: {name}
    test.skip();
  }})"""

PAGES = [
    ("AgentHubPage", "agent-hub-page", "Closes #473", [
        "Page renders with title and agent card list",
        "Agent card click navigates/expands",
        "Activity status filter",
    ]),
    ("AgentPipelineView", "agent-pipeline-view", "Closes #474, Closes #494", [
        "Page renders",
        "Node click shows details",
        "Preset switching",
        "Animation controls",
    ]),
    ("BookCreate", "book-create", "Closes #475, Closes #495", [
        "Form renders",
        "Fill and submit (title/type/platform)",
        "Submit creates and redirects",
        "Form validation",
    ]),
    ("BookDetail", "book-detail", "Closes #476, Closes #496", [
        "Info display",
        "Edit and save",
        "Delete flow",
    ]),
    ("BookStylePage", "book-style-page", "Closes #477, Closes #497", [
        "Panel renders",
        "Parameter adjustment",
        "Preview effect",
        "Save config",
    ]),
    ("ChapterReader", "chapter-reader", "Closes #478, Closes #498", [
        "Content renders",
        "Chapter navigation",
        "Edit mode toggle",
        "Word count",
    ]),
    ("ChapterWizard", "chapter-wizard", "Closes #479, Closes #499", [
        "Step navigation renders",
        "Form fill",
        "AI generation",
        "Save flow",
    ]),
    ("CharacterTiering", "character-tiering", "Closes #480, Closes #500", [
        "Tab switching",
        "Card list display",
        "Search filter",
        "Create new character",
        "Drag reorder",
    ]),
    ("ConsistencyCheck", "consistency-check-panel", "Closes #481, Closes #501", [
        "Results display",
        "Category filter",
        "Severity filter",
        "Fix/ignore/locate actions",
    ]),
    ("DaemonControl", "daemon-control", "Closes #482, Closes #502", [
        "Page renders",
        "Start/stop",
        "Status display",
    ]),
    ("DoctorView", "doctor-view", "Closes #483, Closes #503", [
        "Diagnosis items display",
        "Retry action",
    ]),
    ("EditDashboard", "edit-dashboard", "Closes #484, Closes #504", [
        "Panel renders",
        "KPI display",
        "Module collapse",
        "Data refresh",
    ]),
    ("GenreManager", "genre-manager", "Closes #485, Closes #505", [
        "List renders",
        "Selection toggle",
        "Config edit",
    ]),
    ("ImportManager", "import-manager", "Closes #486, Closes #506", [
        "Tab switching",
        "Text paste",
        "AI extract review",
        "Confirm save",
    ]),
    ("LanguageSelector", "language-selector", "Closes #487, Closes #507", [
        "Options render",
        "Selection applies",
        "UI text updates",
    ]),
    ("LogViewer", "log-viewer", "Closes #488, Closes #508", [
        "List renders",
        "Level filter",
        "Search",
        "Refresh",
    ]),
    ("ProjectSettings", "project-settings", "Closes #489, Closes #509", [
        "Tab renders",
        "Agent cards",
        "Save",
        "Skill list",
        "Preset switching",
    ]),
    ("RadarView", "radar-view", "Closes #490, Closes #510", [
        "Page renders",
        "Data display",
        "Refresh action",
    ]),
    ("ServiceListPage", "service-list-detail", "Closes #491, Closes #511", [
        "List renders",
        "Add/edit",
        "Connection test",
        "Delete",
    ]),
    ("TruthFiles", "truth-files", "Closes #492, Closes #512", [
        "List renders",
        "Search filter",
        "View/edit",
        "Create new",
    ]),
    ("WorldInheritancePage", "world-inheritance", "Closes #493, Closes #513", [
        "Tree selector renders",
        "State toggle",
        "Conflict handling",
        "Confirm inheritance",
    ]),
]

def gen_tests(scenarios):
    parts = []
    for i, name in enumerate(scenarios, 1):
        parts.append(TEST_TPL.format(idx=i, name=name))
    return "\n\n".join(parts)

def main():
    import os
    e2e_dir = "packages/studio/e2e"
    os.makedirs(e2e_dir, exist_ok=True)

    for comp, filename, issues_str, scenarios in PAGES:
        test_bodies = gen_tests(scenarios)
        content = SPEC_TPL.format(
            import_line=IMPORT_LINE,
            page_display=comp,
            issues_list=issues_str,
            test_bodies=test_bodies,
        )

        filepath = os.path.join(e2e_dir, f"{filename}.spec.ts")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content.lstrip("\n"))
        print(f"OK: {filename}.spec.ts  ({issues_str})")

    print(f"\nTotal: {len(PAGES)} E2E spec files generated")

if __name__ == "__main__":
    main()
