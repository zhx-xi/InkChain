import { useEffect, useState, useMemo } from "react";
import { Users, ChevronDown, Network } from "lucide-react";
import { useChatStore } from "../../store/chat";
import { fetchJson } from "../../hooks/use-api";
import { SidebarCard } from "./SidebarCard";
import { cn } from "../../lib/utils";
import { roleFromPath, TIER_CONFIG, type RoleRef, type CharacterTier } from "../../lib/truth-display";
import { useHashRoute } from "../../hooks/use-hash-route";

// ── 5-tier badge color scheme (kept in sync with TIER_CONFIG in core) ──

const TIER_BADGE: Record<CharacterTier, { label: string; color: string; symbol: string }> = {
  protagonist: { label: "主角", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", symbol: "★" },
  supporting:  { label: "重要", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400", symbol: "★" },
  guest:       { label: "次要", color: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400", symbol: "●" },
  one_shot:    { label: "客串", color: "bg-gray-500/15 text-gray-600 dark:text-gray-400", symbol: "●" },
  scene:       { label: "一次性", color: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400", symbol: "·" },
};

// ── Legacy support: character_matrix.md parser ──

interface CharacterInfo {
  name: string;
  fields: Record<string, string>;
}

function parseCharacterMatrix(md: string): CharacterInfo[] {
  const characters: CharacterInfo[] = [];
  // Split by ## headings (level 2 only)
  const sections = md.split(/^## /m).slice(1);
  for (const section of sections) {
    const lines = section.split("\n");
    const name = lines[0].trim();
    if (!name) continue;
    const fields: Record<string, string> = {};
    for (let i = 1; i < lines.length; i++) {
      const match = lines[i].match(/^-\s+\*\*(.+?)\*\*:\s*(.+)/);
      if (match) {
        fields[match[1]] = match[2].trim();
      }
    }
    characters.push({ name, fields });
  }
  return characters;
}

const ROLE_COLORS: Record<string, string> = {
  "主角": "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "反派": "bg-red-500/15 text-red-600 dark:text-red-400",
  "盟友": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "配角": "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "提及": "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
  "protagonist": "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "antagonist": "bg-red-500/15 text-red-600 dark:text-red-400",
  "ally": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "minor": "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "mentioned": "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
};

function getRoleColor(role: string): string {
  const lower = role.toLowerCase().trim();
  for (const [key, color] of Object.entries(ROLE_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400";
}

// ── Phase 5 RoleEntry: one file per character ──

function RoleEntry({ role }: { readonly role: RoleRef }) {
  const openArtifact = useChatStore((s) => s.openArtifact);
  const badge = TIER_BADGE[role.tier];
  return (
    <button
      onClick={() => openArtifact(role.path)}
      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors text-left"
    >
      <Users size={16} className="shrink-0 text-muted-foreground/60" />
      <span className="text-[15px] leading-6 font-medium text-foreground font-['SimSun','Songti_SC','STSong',serif] flex-1 truncate">
        {role.name}
      </span>
      <span className={cn("text-[12px] px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5", badge.color)}>
        <span className="text-[10px]">{badge.symbol}</span>
        {badge.label}
      </span>
    </button>
  );
}

// ── Legacy CharacterCard (pre-Phase-5) ──

function CharacterCard({ char }: { readonly char: CharacterInfo }) {
  const [expanded, setExpanded] = useState(false);
  const role = char.fields["定位"] ?? char.fields["Role"] ?? "";
  const tags = char.fields["标签"] ?? char.fields["Tags"] ?? "";
  const current = char.fields["当前"] ?? char.fields["Current"] ?? "";

  return (
    <div className="rounded-lg bg-secondary/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left"
      >
        <Users size={16} className="shrink-0 text-muted-foreground/60" />
        <span className="text-[15px] leading-6 font-medium text-foreground font-['SimSun','Songti_SC','STSong',serif] flex-1 truncate">
          {char.name}
        </span>
        {role && (
          <span className={cn("text-[12px] px-1.5 py-0.5 rounded-full shrink-0", getRoleColor(role))}>
            {role.split("/")[0].trim()}
          </span>
        )}
        <ChevronDown size={14} className={cn("text-muted-foreground/50 transition-transform shrink-0", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-1">
          {tags && (
            <p className="text-[14px] leading-6 text-muted-foreground"><span className="text-muted-foreground/60">标签</span> {tags}</p>
          )}
          {current && (
            <p className="text-[14px] leading-6 text-muted-foreground"><span className="text-muted-foreground/60">当前</span> {current}</p>
          )}
          {Object.entries(char.fields)
            .filter(([k]) => !["定位", "Role", "标签", "Tags", "当前", "Current"].includes(k))
            .map(([key, val]) => (
              <p key={key} className="text-[14px] leading-6 text-muted-foreground">
                <span className="text-muted-foreground/60">{key}</span> {val}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Tab definitions ──

interface TabItem {
  readonly id: CharacterTier | "all";
  readonly label: string;
}

const TIER_TABS: ReadonlyArray<TabItem> = [
  { id: "all", label: "全部" },
  { id: "protagonist", label: "主角" },
  { id: "supporting", label: "重要" },
  { id: "guest", label: "次要" },
  { id: "one_shot", label: "客串" },
  { id: "scene", label: "一次性" },
];

// Sort order: protagonist(1) → supporting(2) → guest(3) → one_shot(4) → scene(5)
const TIER_SORT_ORDER: Record<CharacterTier, number> = {
  protagonist: 1,
  supporting: 2,
  guest: 3,
  one_shot: 4,
  scene: 5,
};

// ── Main component ──

interface CharacterSectionProps {
  readonly bookId: string;
}

export function CharacterSection({ bookId }: CharacterSectionProps) {
  const [roles, setRoles] = useState<ReadonlyArray<RoleRef>>([]);
  const [legacyChars, setLegacyChars] = useState<CharacterInfo[]>([]);
  const [activeTab, setActiveTab] = useState<CharacterTier | "all">("all");
  const bookDataVersion = useChatStore((s) => s.bookDataVersion);
  const { setRoute } = useHashRoute();

  useEffect(() => {
    let cancelled = false;
    setRoles([]);
    setLegacyChars([]);

    fetchJson<{ files: ReadonlyArray<{ name: string }> }>(`/books/${bookId}/truth`)
      .then(async (data) => {
        if (cancelled) return;
        const roleRefs = data.files
          .map((f) => roleFromPath(f.name))
          .filter((r): r is RoleRef => r !== null)
          .sort((a, b) => {
            const orderA = TIER_SORT_ORDER[a.tier];
            const orderB = TIER_SORT_ORDER[b.tier];
            return orderA !== orderB ? orderA - orderB : a.name.localeCompare(b.name);
          });

        // Phase 5 books expose one file per character under roles/.
        if (roleRefs.length > 0) {
          setRoles(roleRefs);
          return;
        }

        // Pre-Phase-5 books only have the flat character_matrix.md table.
        const matrix = await fetchJson<{ content: string | null }>(
          `/books/${bookId}/truth/character_matrix.md`,
        ).catch(() => ({ content: null }));
        if (!cancelled && matrix.content) {
          setLegacyChars(parseCharacterMatrix(matrix.content));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRoles([]);
          setLegacyChars([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bookId, bookDataVersion]);

  // Filter + count by active tab
  const filteredRoles = useMemo(() => {
    if (activeTab === "all") return roles;
    return roles.filter((r) => r.tier === activeTab);
  }, [roles, activeTab]);

  // Count per tier for tab badges
  const tierCounts = useMemo(() => {
    const counts: Partial<Record<CharacterTier, number>> = {};
    for (const r of roles) {
      counts[r.tier] = (counts[r.tier] ?? 0) + 1;
    }
    return counts;
  }, [roles]);

  if (roles.length === 0 && legacyChars.length === 0) return null;

  // Legacy view — no tab filtering for character_matrix.md mode
  if (roles.length === 0) {
    return (
      <SidebarCard title="角色">
        <div className="space-y-1.5">
          {legacyChars.map((char) => <CharacterCard key={char.name} char={char} />)}
        </div>
        <button
          onClick={() => setRoute({ page: "relations", bookId })}
          className="mt-2 w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors text-left text-[13px] text-muted-foreground hover:text-foreground"
        >
          <Network size={16} className="shrink-0 text-muted-foreground/60" />
          <span>关系图谱</span>
        </button>
      </SidebarCard>
    );
  }

  return (
    <SidebarCard title="角色">
      {/* Tier tab bar */}
      <div className="flex gap-1 mb-2 flex-wrap">
        {TIER_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tab.id === "all" ? roles.length : (tierCounts[tab.id] ?? 0);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "text-[12px] px-2 py-1 rounded-full transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary/80",
              )}
            >
              {tab.label} {count}
            </button>
          );
        })}
      </div>

      {/* Role list */}
      <div className="space-y-1.5">
        {filteredRoles.map((role) => <RoleEntry key={role.path} role={role} />)}
      </div>

      {/* Status bar */}
      {filteredRoles.length > 0 && (
        <p className="text-[11px] text-muted-foreground/50 mt-2 px-0.5">
          显示 {filteredRoles.length} / {roles.length} 个角色
        </p>
      )}

      {/* Relation graph entry */}
      <button
        onClick={() => setRoute({ page: "relations", bookId })}
        className="mt-2 w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors text-left text-[13px] text-muted-foreground hover:text-foreground"
      >
        <Network size={16} className="shrink-0 text-muted-foreground/60" />
        <span>关系图谱</span>
      </button>
    </SidebarCard>
  );
}
