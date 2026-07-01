#!/usr/bin/env tsx
/**
 * migrate-relations.ts — Semi-automated relation extraction from character cards.
 *
 * Scans all character role cards under the `roles/` directory of a book project,
 * parses their "关系" (Relations) sections, and outputs candidate relationships
 * for user confirmation before batch-writing to the relations API.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-relations.ts <book-project-dir>
 *
 * Interactive mode (default):
 *   Reviews each candidate relationship and asks for confirmation.
 *
 * Scan-only mode:
 *   pnpm tsx scripts/migrate-relations.ts <book-project-dir> --scan
 *   (Outputs candidates without writing)
 *
 * Dependencies: Node.js built-in modules only.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";

// ── Types ────────────────────────────────────────────────────────────────────

interface CharacterRef {
  /** Full role path, e.g. "roles/protagonist/叶知秋" */
  rolePath: string;
  /** Human-readable name from filename */
  name: string;
  /** Tier extracted from path: protagonist / supporting / guest / one_shot / scene */
  tier: string;
}

interface CandidateRelation {
  sourcePath: string;
  sourceName: string;
  targetPath: string;
  targetName: string;
  relationType: RelationType;
  confidence: "high" | "medium" | "low";
  evidence: string;
}

type RelationType =
  | "close_friend"
  | "rival"
  | "alliance"
  | "mentor"
  | "blood"
  | "secret_crush";

// ── Constants ────────────────────────────────────────────────────────────────

const RELATION_PATTERNS: Array<{
  patterns: RegExp[];
  type: RelationType;
}> = [
  {
    // 师徒 — "XX的师父/徒弟/弟子/师兄/师弟/师姐/师妹"
    patterns: [
      /(?:的?)(?:师父|师傅|徒弟|弟子|传人)(?:[，\s、]|$)/u,
      /(?:的?)(?:师兄|师弟|师姐|师妹)(?:[，\s、]|$)/u,
      /(?:拜\s*?)(?:师|入门)/u,
    ],
    type: "mentor",
  },
  {
    // 挚友 — "XX的好友/挚友/兄弟/姐妹/朋友/知己"
    patterns: [
      /(?:的?)(?:挚友|好友|朋友|知己|兄弟|姐妹|伙伴)(?:[，\s、]|$)/u,
    ],
    type: "close_friend",
  },
  {
    // 敌对 — "XX的敌人/仇敌/对手/死对头"
    patterns: [
      /(?:的?)(?:敌人|仇敌|对手|死对头|宿敌|劲敌)(?:[，\s、]|$)/u,
    ],
    type: "rival",
  },
  {
    // 血缘 — "XX的父亲/母亲/儿子/女儿/兄弟/姐妹/父母/子女"
    patterns: [
      /(?:的?)(?:父亲|母亲|爸爸|妈妈|爹|娘|父母)(?:[，\s、]|$)/u,
      /(?:的?)(?:儿子|女儿|孩子|子女)(?:[，\s、]|$)/u,
      /(?:的?)(?:兄长|弟弟|妹妹|姊妹|姐姐|哥哥)(?:[，\s、]|$)/u,
      /(?:血缘|血亲|亲生)(?:[，\s、]|$)/u,
    ],
    type: "blood",
  },
  {
    // 暗恋 — "暗恋/单恋/爱慕/喜欢XX"
    patterns: [
      /暗恋/u,
      /单恋/u,
      /爱慕/u,
      /心上人/u,
      /意中人/u,
    ],
    type: "secret_crush",
  },
];

const SECTION_HEADERS = [
  /^#+\s*关系/u,
  /^#+\s*关联/u,
  /^#+\s*人际关系/u,
  /^#+\s*关系描述/u,
  /^#+\s*人物关系/u,
  /^#+\s*Relations?\b/i,
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Scan the `roles/` directory for all role card markdown files.
 */
function scanCharacterCards(bookDir: string): CharacterRef[] {
  const rolesDir = path.join(bookDir, "roles");
  if (!fs.existsSync(rolesDir)) {
    console.error(`❌ roles/ directory not found at: ${rolesDir}`);
    process.exit(1);
  }

  const characters: CharacterRef[] = [];
  const tiers = fs.readdirSync(rolesDir, { withFileTypes: true });

  for (const tierEntry of tiers) {
    if (!tierEntry.isDirectory()) continue;
    const tierName = tierEntry.name;
    const tierDir = path.join(rolesDir, tierName);

    const files = fs.readdirSync(tierDir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const name = file.replace(/\.md$/, "");
      characters.push({
        rolePath: `roles/${tierName}/${name}`,
        name,
        tier: tierName,
      });
    }
  }

  return characters;
}

/**
 * Read a character card Markdown file and extract the "关系" section content.
 * Returns the text content of the relations section, or empty string if not found.
 */
function extractRelationsSection(bookDir: string, charPath: string): string {
  const fullPath = path.join(bookDir, charPath + ".md");
  if (!fs.existsSync(fullPath)) return "";

  const content = fs.readFileSync(fullPath, "utf-8");
  const lines = content.split("\n");

  let inSection = false;
  const sectionLines: string[] = [];

  for (const line of lines) {
    if (!inSection) {
      if (SECTION_HEADERS.some((h) => h.test(line))) {
        inSection = true;
        continue;
      }
    } else {
      // Stop at the next heading (unless it's a sub-heading of the relations section)
      if (/^#{1,3}\s/.test(line) && !SECTION_HEADERS.some((h) => h.test(line))) {
        break;
      }
      sectionLines.push(line);
    }
  }

  return sectionLines.join("\n").trim();
}

/**
 * Try to match a character name from a text fragment against known characters.
 * Returns the matched CharacterRef or undefined.
 */
function findCharacter(
  text: string,
  characters: CharacterRef[],
  excludePath?: string,
): CharacterRef | undefined {
  // Match by full name (longest match first to prefer multi-character names)
  const sorted = [...characters]
    .filter((c) => c.rolePath !== excludePath)
    .sort((a, b) => b.name.length - a.name.length);

  for (const char of sorted) {
    if (text.includes(char.name)) {
      return char;
    }
  }
  return undefined;
}

/**
 * Detect relation type from a line of text.
 */
function detectRelationType(text: string): { type: RelationType; confidence: "high" | "medium" | "low" } | null {
  for (const entry of RELATION_PATTERNS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(text)) {
        // Direct keyword match = high confidence
        return { type: entry.type, confidence: "high" };
      }
    }
  }
  return null;
}

/**
 * Parse a single line of a relations section to extract candidate relations.
 */
function parseRelationLine(
  line: string,
  sourceChar: CharacterRef,
  allCharacters: CharacterRef[],
): CandidateRelation | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#")) return null;

  // Try to find a target character mentioned in this line
  const targetChar = findCharacter(trimmed, allCharacters, sourceChar.rolePath);
  if (!targetChar) return null;

  // Detect relation type
  const detected = detectRelationType(trimmed);
  if (!detected) {
    // Default to alliance with low confidence if no specific type detected
    return {
      sourcePath: sourceChar.rolePath,
      sourceName: sourceChar.name,
      targetPath: targetChar.rolePath,
      targetName: targetChar.name,
      relationType: "alliance",
      confidence: "low",
      evidence: trimmed,
    };
  }

  return {
    sourcePath: sourceChar.rolePath,
    sourceName: sourceChar.name,
    targetPath: targetChar.rolePath,
    targetName: targetChar.name,
    relationType: detected.type,
    confidence: detected.confidence,
    evidence: trimmed,
  };
}

/**
 * Compute a deduplication key for a candidate relation.
 * (Same pair in either direction -> same key)
 */
function dedupKey(r: CandidateRelation): string {
  const ids = [r.sourcePath, r.targetPath].sort();
  return `${ids[0]}::${ids[1]}::${r.relationType}`;
}

/**
 * Print a formatted candidate relation to stdout.
 */
function printCandidate(r: CandidateRelation, index: number): void {
  const confidenceIcon =
    r.confidence === "high" ? "🟢" : r.confidence === "medium" ? "🟡" : "🔴";
  const relationLabel = RELATION_LABELS[r.relationType] ?? r.relationType;

  console.log(
    `\n${confidenceIcon} [#${index}] ${r.sourceName} → ${r.targetName} | ${relationLabel}`,
  );
  console.log(`   置信度: ${r.confidence} | 证据: "${r.evidence}"`);
  console.log(`   Source: ${r.sourcePath} | Target: ${r.targetPath}`);
}

const RELATION_LABELS: Record<string, string> = {
  close_friend: "挚友",
  rival: "敌对",
  alliance: "联盟",
  mentor: "师徒",
  blood: "血缘",
  secret_crush: "暗恋",
};

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const scanOnly = args.includes("--scan");
  const bookDir = args.find((a) => !a.startsWith("--")) ?? process.cwd();

  if (!fs.existsSync(bookDir)) {
    console.error(`❌ Directory not found: ${bookDir}`);
    console.error("Usage: pnpm tsx scripts/migrate-relations.ts <book-project-dir> [--scan]");
    process.exit(1);
  }

  console.log(`🔍 Scanning character cards in: ${bookDir}\n`);

  // ── Step 1: Scan all character cards ─────────────────────────────────────
  const characters = scanCharacterCards(bookDir);
  console.log(`📋 Found ${characters.length} character cards:`);
  for (const c of characters) {
    console.log(`   ${c.rolePath}`);
  }
  console.log();

  // ── Step 2: Extract relations sections ────────────────────────────────────
  const allCandidates: CandidateRelation[] = [];

  for (const char of characters) {
    const relationsText = extractRelationsSection(bookDir, char.rolePath);
    if (!relationsText) continue;

    const lines = relationsText.split("\n");
    for (const line of lines) {
      const candidate = parseRelationLine(line, char, characters);
      if (candidate) {
        allCandidates.push(candidate);
      }
    }
  }

  // ── Step 3: Deduplicate ───────────────────────────────────────────────────
  const seen = new Set<string>();
  const candidates: CandidateRelation[] = [];

  for (const c of allCandidates) {
    const key = dedupKey(c);
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(c);
    } else {
      // Prefer the higher confidence version
      const existingIdx = candidates.findIndex((e) => dedupKey(e) === key);
      if (existingIdx >= 0 && confidenceRank(c.confidence) > confidenceRank(candidates[existingIdx].confidence)) {
        candidates[existingIdx] = c;
      }
    }
  }

  if (candidates.length === 0) {
    console.log("ℹ️  No candidate relations found in any character card.");
    console.log("   Tip: Make sure your role cards have a \"## 关系\" section");
    console.log("   with mentions of other character names.");
    return;
  }

  // ── Step 4: Display candidates ────────────────────────────────────────────
  console.log(`\n📊 Found ${candidates.length} candidate relations (after dedup):`);
  console.log(`   🟢 High: ${candidates.filter((c) => c.confidence === "high").length}`);
  console.log(`   🟡 Medium: ${candidates.filter((c) => c.confidence === "medium").length}`);
  console.log(`   🔴 Low: ${candidates.filter((c) => c.confidence === "low").length}`);

  if (scanOnly) {
    // Scan-only mode: just output and exit
    for (let i = 0; i < candidates.length; i++) {
      printCandidate(candidates[i], i + 1);
    }
    console.log("\n✅ Scan complete. Use without --scan for interactive confirmation.");
    return;
  }

  // ── Step 5: Interactive confirmation ──────────────────────────────────────
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const confirmed: CandidateRelation[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    printCandidate(c, i + 1);

    const answer = await new Promise<string>((resolve) => {
      rl.question("\n  确认添加? (y=确认 / n=跳过 / a=全部确认 / q=退出): ", resolve);
    });

    const a = answer.trim().toLowerCase();
    if (a === "q") {
      console.log("  已退出。");
      break;
    }
    if (a === "a") {
      confirmed.push(c);
      // Auto-confirm remaining
      for (let j = i + 1; j < candidates.length; j++) {
        confirmed.push(candidates[j]);
      }
      console.log(`  ✅ 已全部确认 (${candidates.length - i - 1} 个自动确认)`);
      break;
    }
    if (a === "y") {
      confirmed.push(c);
      console.log("  ✅ 已确认");
    } else {
      console.log("  ⏭️  已跳过");
    }
  }

  rl.close();

  if (confirmed.length === 0) {
    console.log("\nℹ️  No relations confirmed. Exiting.");
    return;
  }

  console.log(`\n📤 ${confirmed.length} relations confirmed. Ready to write.`);
  console.log("\n   API endpoint: POST /books/:id/relations");
  console.log("   To write, pipe this output or use the bulk import feature.");
  console.log("\n   JSON output:");
  console.log(JSON.stringify(
    confirmed.map((c) => ({
      sourceRoleId: c.sourcePath,
      targetRoleId: c.targetPath,
      relationType: c.relationType,
      description: c.evidence,
      intensity: c.confidence === "high" ? 4 : c.confidence === "medium" ? 3 : 2,
      validFromChapter: 1,
    })),
    null,
    2,
  ));
}

function confidenceRank(c: string): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
