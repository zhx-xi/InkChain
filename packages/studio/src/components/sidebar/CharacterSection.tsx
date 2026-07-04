import { useEffect, useState, useMemo, useCallback } from "react";
import { Users, ChevronDown, Network, Trash2, Star, ChevronLeft, ChevronRight } from "lucide-react";
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

// ── Tier → star count mapping ──
const TIER_STARS: Record<CharacterTier, number> = {
  protagonist: 5,
  supporting: 4,
  guest: 3,
  one_shot: 2,
  scene: 1,
};

const TIER_FROM_STARS: Record<number, CharacterTier> = {
  5: "protagonist",
  4: "supporting",
  3: "guest",
  2: "one_shot",
  1: "scene",
};

// ── Phase 5 RoleEntry: one file per character ──

interface RoleEntryProps {
  readonly role: RoleRef;
  readonly bookId: string;
  readonly onDeleted: (name: string) => void;
  readonly onTierChanged: (name: string, newTier: CharacterTier) => void;
}

function RoleEntry({ role, bookId, onDeleted, onTierChanged }: RoleEntryProps) {
  const openArtifact = useChatStore((s) => s.openArtifact);
  const badge = TIER_BADGE[role.tier];
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await fetchJson(`/books/${bookId}/characters/${encodeURIComponent(role.name)}`, {
        method: "DELETE",
      });
      onDeleted(role.name);
    } catch {
      // Refresh page on error to show original state
      window.location.reload();
    }
    setDeleting(false);
    setConfirmingDelete(false);
  }, [confirmingDelete, bookId, role.name, onDeleted]);

  const handleCancelDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmingDelete(false);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", role.name);
    e.dataTransfer.effectAllowed = "move";
  }, [role.name]);

  // Build star display: filled=★ empty=☆
  const starCount = TIER_STARS[role.tier] ?? 3;
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        size={12}
        className={cn(
          "cursor-pointer transition-colors",
          i <= starCount
            ? "fill-amber-400 text-amber-400"
            : "fill-none text-muted-foreground/30 hover:text-amber-400/50",
        )}
        onClick={(e) => {
          e.stopPropagation();
          const newTier = TIER_FROM_STARS[i];
          if (newTier && newTier !== role.tier) {
            fetchJson(`/books/${bookId}/characters/${encodeURIComponent(role.name)}/tier`, {
              method: "PATCH",
              body: JSON.stringify({ tier: newTier }),
              headers: { "Content-Type": "application/json" },
            }).then(() => onTierChanged(role.name, newTier)).catch(() => window.location.reload());
          }
        }}
      />,
    );
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={cn(
        "group w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors",
        dragOver ? "bg-secondary/70" : "bg-secondary/30 hover:bg-secondary/50",
      )}
    >
      <Users size={16} className="shrink-0 text-muted-foreground/60 cursor-grab active:cursor-grabbing" />
      <button
        onClick={() => openArtifact(role.path)}
        className="flex items-center gap-2 flex-1 min-w-0 text-left"
      >
        <span className="text-[15px] leading-6 font-medium text-foreground font-['SimSun','Songti_SC','STSong',serif] truncate">
          {role.name}
        </span>
      </button>

      {/* Star rating */}
      <div className="flex items-center gap-0.5 shrink-0">
        {stars}
      </div>

      {/* Delete button */}
      {confirmingDelete ? (
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-[11px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-600 hover:bg-red-500/30"
          >
            {deleting ? "..." : "确认"}
          </button>
          <button
            type="button"
            onClick={handleCancelDelete}
            className="text-[11px] px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground hover:bg-secondary/80"
          >
            取消
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmingDelete(true);
          }}
          className="shrink-0 p-0.5 rounded text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
          title="删除角色"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
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
  const [dropTargetTab, setDropTargetTab] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
  // R-04: Scene-tier roles are hidden from the "全部" (all) view. They only
  // appear when the "scene" tab is explicitly selected. This avoids cluttering
  // the global character list with chapter-scoped disposable characters.
  const filteredRoles = useMemo(() => {
    if (activeTab === "all") return roles.filter((r) => r.tier !== "scene");
    return roles.filter((r) => r.tier === activeTab);
  }, [roles, activeTab]);

  // Reset pagination when tab changes
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  // Count per tier for tab badges
  const tierCounts = useMemo(() => {
    const counts: Partial<Record<CharacterTier, number>> = {};
    for (const r of roles) {
      counts[r.tier] = (counts[r.tier] ?? 0) + 1;
    }
    return counts;
  }, [roles]);

  // Callbacks for RoleEntry child
  const handleDeleted = useCallback((name: string) => {
    setRoles((prev) => prev.filter((r) => r.name !== name));
  }, []);

  const handleTierChanged = useCallback((name: string, newTier: CharacterTier) => {
    setRoles((prev) => prev.map((r) => r.name === name ? { ...r, tier: newTier } : r));
  }, []);

  const handleTabDrop = useCallback((tier: CharacterTier) => (e: React.DragEvent) => {
    e.preventDefault();
    setDropTargetTab(null);
    const draggedName = e.dataTransfer.getData("text/plain");
    if (!draggedName) return;
    fetchJson(`/books/${bookId}/characters/${encodeURIComponent(draggedName)}/tier`, {
      method: "PATCH",
      body: JSON.stringify({ tier }),
      headers: { "Content-Type": "application/json" },
    }).then(() => handleTierChanged(draggedName, tier)).catch(() => window.location.reload());
  }, [bookId, handleTierChanged]);

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
      {/* Tier tab bar — also serves as drop targets for DnD re-tier */}
      <div className="flex gap-1 mb-2 flex-wrap">
        {TIER_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tab.id === "all" ? roles.length : (tierCounts[tab.id] ?? 0);
          const isDropTarget = dropTargetTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onDragOver={(e) => {
                if (tab.id === "all") return;
                e.preventDefault();
                setDropTargetTab(tab.id);
              }}
              onDragLeave={() => setDropTargetTab(null)}
              onDrop={tab.id === "all" ? undefined : handleTabDrop(tab.id as CharacterTier)}
              className={cn(
                "text-[12px] px-2 py-1 rounded-full transition-all",
                isDropTarget && tab.id !== "all" && "ring-2 ring-blue-400 scale-110",
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

      {/* Role list (Phase 5 — paginated) */}
      <div className="space-y-1.5">
        {filteredRoles
          .slice((page - 1) * pageSize, page * pageSize)
          .map((role) => (
            <RoleEntry
              key={role.path}
              role={role}
              bookId={bookId}
              onDeleted={handleDeleted}
              onTierChanged={handleTierChanged}
            />
          ))}
      </div>

      {/* Pagination controls */}
      {filteredRoles.length > 0 && (
        <div className="flex items-center gap-2 mt-2 px-0.5">
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="text-[11px] bg-transparent border border-border/20 rounded px-1 py-0.5 outline-none text-muted-foreground/60"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span className="text-[11px] text-muted-foreground/50 flex-1 tabular-nums">
            {(() => {
              const start = (page - 1) * pageSize + 1;
              const end = Math.min(page * pageSize, filteredRoles.length);
              return `显示 ${start}-${end} / ${filteredRoles.length} 个角色`;
            })()}
          </span>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={12} />
          </button>
          <button
            onClick={() =>
              setPage((p) =>
                Math.min(Math.ceil(filteredRoles.length / pageSize), p + 1),
              )
            }
            disabled={page >= Math.ceil(filteredRoles.length / pageSize)}
            className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ChevronRight size={12} />
          </button>
        </div>
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
