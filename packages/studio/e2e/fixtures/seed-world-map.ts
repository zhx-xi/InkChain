import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
export const E2E_ROOT = resolve(__dirname, "../../../..", "test-project");
export const E2E_WORLD_ID = "e2e-world-map-test";

export async function seedWorldMap(): Promise<void> {
  const worldsDir = join(E2E_ROOT, ".inkos", "worlds");
  await mkdir(worldsDir, { recursive: true });

  const now = new Date("2026-07-04T00:00:00.000Z").toISOString();

  const world = {
    id: E2E_WORLD_ID,
    name: "九州大陆（测试）",
    description: "用于E2E测试的世界地图",
    createdAt: now,
    updatedAt: now,
    settings: [],
    roles: [],
    relations: [],
    regions: [
      {
        id: "continent-1",
        name: "东胜神州",
        parentId: null,
        type: "大陆",
        description: "东部修仙圣地",
        sortIndex: 0,
        x: null,
        y: null,
        regionType: "continent",
        coordinates: { x: 120, y: 60 },
      },
      {
        id: "continent-2",
        name: "西牛贺洲",
        parentId: null,
        type: "大陆",
        description: "西部佛门净土",
        sortIndex: 1,
        x: null,
        y: null,
        regionType: "continent",
        coordinates: { x: 500, y: 200 },
      },
      {
        id: "country-1",
        name: "青云国",
        parentId: "continent-1",
        type: "国家",
        description: "东胜神州第一大国",
        sortIndex: 0,
        x: null,
        y: null,
        regionType: "country",
        coordinates: { x: 80, y: 40 },
      },
      {
        id: "country-2",
        name: "天火国",
        parentId: "continent-1",
        type: "国家",
        description: "以炼丹著称",
        sortIndex: 1,
        x: null,
        y: null,
        regionType: "country",
        coordinates: { x: 200, y: 100 },
      },
      {
        id: "city-1",
        name: "青云城",
        parentId: "country-1",
        type: "城市",
        description: "青云国王都",
        sortIndex: 0,
        x: null,
        y: null,
        regionType: "city",
        coordinates: { x: 60, y: 30 },
      },
      {
        id: "city-2",
        name: "碧波城",
        parentId: "country-1",
        type: "城市",
        description: "水乡之城",
        sortIndex: 1,
        x: null,
        y: null,
        regionType: "city",
        coordinates: { x: 120, y: 60 },
      },
      {
        id: "loc-1",
        name: "天剑宗",
        parentId: "city-1",
        type: "地点",
        description: "天下第一剑派",
        sortIndex: 0,
        x: null,
        y: null,
        regionType: "location",
        coordinates: { x: 50, y: 20 },
      },
    ],
    institutions: [],
    history: [],
    rules: [],
    references: [],
  };

  await writeFile(
    join(worldsDir, `${E2E_WORLD_ID}.json`),
    JSON.stringify(world, null, 2),
    "utf-8",
  );
}
