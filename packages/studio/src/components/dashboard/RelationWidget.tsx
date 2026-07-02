import { useApi } from "../../hooks/use-api";
import { Share2, ArrowRight } from "lucide-react";

interface RelationEntry {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly type: string;
}

interface DashboardData {
  readonly relations?: {
    readonly total: number;
    readonly recent: ReadonlyArray<RelationEntry>;
  };
}

const RELATION_TYPE_COLORS: Record<string, string> = {
  family: "text-rose-500",
  friend: "text-emerald-500",
  love: "text-pink-500",
  enemy: "text-red-500",
  mentor: "text-violet-500",
  colleague: "text-blue-500",
  neutral: "text-gray-500",
};

function relationColor(type: string): string {
  const lower = type.toLowerCase();
  for (const [key, color] of Object.entries(RELATION_TYPE_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "text-primary";
}

function formatRelationType(type: string): string {
  const labels: Record<string, string> = {
    family: "家族",
    friend: "朋友",
    love: "恋爱",
    enemy: "敌对",
    mentor: "师徒",
    colleague: "同事",
    neutral: "中立",
  };
  const lower = type.toLowerCase();
  for (const [key, label] of Object.entries(labels)) {
    if (lower.includes(key)) return label;
  }
  return type;
}

// ── Simple SVG mini-graph ──

function MiniRelationGraph({ relations }: { readonly relations: ReadonlyArray<RelationEntry> }) {
  if (relations.length === 0) return null;

  // Collect unique characters and assign positions in a circle
  const chars = new Map<string, { x: number; y: number }>();
  const uniqueNames = [...new Set(relations.flatMap((r) => [r.source, r.target]))];
  const centerX = 80;
  const centerY = 40;
  const radius = 30;

  uniqueNames.forEach((name, i) => {
    const angle = (2 * Math.PI * i) / uniqueNames.length - Math.PI / 2;
    chars.set(name, {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    });
  });

  return (
    <svg viewBox="0 0 160 80" className="w-full h-20 mb-2" xmlns="http://www.w3.org/2000/svg">
      {/* Edges */}
      {relations.slice(0, 8).map((rel, i) => {
        const from = chars.get(rel.source);
        const to = chars.get(rel.target);
        if (!from || !to) return null;
        return (
          <line
            key={i}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="hsl(var(--primary) / 0.3)"
            strokeWidth="1"
            strokeDasharray="3,2"
          />
        );
      })}
      {/* Nodes */}
      {[...chars.entries()].map(([name, pos], i) => (
        <g key={name}>
          <circle cx={pos.x} cy={pos.y} r="5" fill="hsl(var(--primary) / 0.8)" />
          <text
            x={pos.x}
            y={pos.y + 14}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="5"
          >
            {name.length > 6 ? name.slice(0, 6) + "…" : name}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function RelationWidget({ bookId }: { bookId: string }) {
  const { data, loading } = useApi<DashboardData>(`/books/${bookId}/dashboard`);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const total = data?.relations?.total ?? 0;
  const recent = data?.relations?.recent ?? [];

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Share2 size={32} className="text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">暂无关系数据</p>
        <p className="text-xs text-muted-foreground/60 mt-1">角色关系将在写作中自动建立</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Share2 size={16} className="text-primary" />
        <span>共 {total} 条关系</span>
      </div>

      {/* Mini graph */}
      {recent.length >= 2 && <MiniRelationGraph relations={recent} />}

      {/* Recent relations list */}
      {recent.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">最近关系</div>
          {recent.map((rel) => (
            <div
              key={rel.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/20 text-sm"
            >
              <span className="font-medium truncate max-w-[80px]">{rel.source}</span>
              <ArrowRight size={12} className="shrink-0 text-muted-foreground" />
              <span className="font-medium truncate max-w-[80px]">{rel.target}</span>
              <span className={`ml-auto text-xs shrink-0 ${relationColor(rel.type)}`}>
                {formatRelationType(rel.type)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
