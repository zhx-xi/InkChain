import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
export const E2E_ROOT = resolve(__dirname, "../../", "test-project");
export const E2E_BOOK_ID = "e2e-volume-dnd";
export const E2E_WORLD_ID = "e2e-book-world-test";

export async function seedBookWorldExtract(): Promise<void> {
  // Seed a world linked to the book
  const worldsDir = join(E2E_ROOT, ".inkchain", "worlds");
  await mkdir(worldsDir, { recursive: true });

  const now = new Date("2026-07-04T00:00:00.000Z").toISOString();

  const world = {
    id: E2E_WORLD_ID,
    name: "玄幻修仙世界",
    description: "以修仙为主题的世界设定，包含多种修炼体系和宗门势力",
    createdAt: now,
    updatedAt: now,
    settings: [
      { id: "s-1", name: "灵气修炼", type: "魔法体系", description: "万物皆有灵气", constraints: [], sortIndex: 0 },
    ],
    roles: [
      { id: "r-1", name: "叶辰", role: "主角", description: "废材逆袭", significance: 5, sortIndex: 0, institutionIds: [], regionIds: [] },
    ],
    relations: [
      { id: "rel-1", sourceId: "r-1", targetId: "r-1", type: "师徒", description: "", sortIndex: 0 },
    ],
    regions: [
      { id: "rg-1", name: "灵武大陆", parentId: null, type: "大陆", description: "", sortIndex: 0, x: null, y: null, regionType: "continent" },
    ],
    institutions: [
      { id: "i-1", name: "青云宗", type: "宗门", leaderId: null, members: [], description: "", sortIndex: 0, regionId: null },
    ],
    history: [
      { id: "h-1", title: "创世之战", timestamp: "远古", description: "天地初开的战争", affectedRegions: [], significance: 5, sortIndex: 0 },
    ],
    rules: [
      { id: "rule-1", name: "修仙等级", type: "魔法", description: "练气→筑基→金丹→元婴", constraints: [], sortIndex: 0 },
    ],
    references: [],
  };

  await writeFile(
    join(worldsDir, `${E2E_WORLD_ID}.json`),
    JSON.stringify(world, null, 2),
    "utf-8",
  );
}
