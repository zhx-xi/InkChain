import { cn } from "../lib/utils";

// ── Agent Role Type (matching AgentRoleEnum from @actalk/inkos-core) ──

export type AgentRole = "writer" | "auditor" | "editor" | "architect" | "planner" | "observer" | "reviser";

export type AgentStatus = "ready" | "busy" | "error" | "disabled";

// ── Agent Metadata ──

export interface AgentMetadata {
  readonly role: AgentRole;
  readonly label: string;
  readonly description: string;
  readonly color: string;
  readonly icon: string;
}

export const AGENTS: ReadonlyArray<AgentMetadata> = [
  { role: "writer",     label: "Writer",     description: "章节正文写手", color: "#E88D3A", icon: "✍️" },
  { role: "auditor",    label: "Auditor",    description: "连贯性审计",   color: "#4A90D9", icon: "🔍" },
  { role: "editor",     label: "Editor",     description: "文字润色编辑", color: "#5CB85C", icon: "✏️" },
  { role: "architect",  label: "Architect",  description: "故事架构设计", color: "#8B5CF6", icon: "🏗️" },
  { role: "planner",    label: "Planner",    description: "章节节奏规划", color: "#9CA3AF", icon: "📋" },
  { role: "observer",   label: "Observer",   description: "叙事状态追踪", color: "#0EA5E9", icon: "👁️" },
  { role: "reviser",    label: "Reviser",    description: "内容修订优化", color: "#EF4444", icon: "🔄" },
];

// ── Status Config ──

const STATUS_CONFIG: Record<AgentStatus, { label: string; dotClass: string }> = {
  ready:    { label: "就绪", dotClass: "bg-emerald-500" },
  busy:     { label: "忙碌", dotClass: "bg-yellow-500 animate-pulse" },
  error:    { label: "错误", dotClass: "bg-red-500" },
  disabled: { label: "禁用", dotClass: "bg-muted-foreground/30" },
};

// ── Agent Card Component ──

interface AgentCardProps {
  readonly agent: AgentMetadata;
  readonly status: AgentStatus;
  readonly displayName?: string;
  readonly onClick?: () => void;
  readonly className?: string;
}

export function AgentCard({ agent, status, displayName, onClick, className }: AgentCardProps) {
  const statusCfg = STATUS_CONFIG[status];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group/card relative flex flex-col items-center gap-2 rounded-xl border-2 p-5 transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-0.5",
        status === "disabled"
          ? "border-border/20 bg-muted/20 opacity-50 cursor-not-allowed"
          : "border-border/40 bg-card/50 hover:border-border/80 hover:bg-card",
        onClick == null && "cursor-default",
        className,
      )}
      disabled={status === "disabled"}
      style={{ borderColor: status !== "disabled" ? `${agent.color}30` : undefined }}
    >
      {/* Status dot - top right */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5">
        <span className={cn("h-2 w-2 rounded-full", statusCfg.dotClass)} />
        <span className="text-[10px] text-muted-foreground/50 font-medium">
          {statusCfg.label}
        </span>
      </div>

      {/* Agent icon */}
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-sm transition-transform group-hover/card:scale-110"
        style={{ backgroundColor: `${agent.color}15` }}
      >
        <span role="img" aria-label={agent.label}>{agent.icon}</span>
      </div>

      {/* Agent name */}
      <div className="text-center">
        <div className="text-sm font-semibold text-foreground">
          {displayName ?? agent.label}
        </div>
        <div className="text-[11px] text-muted-foreground/60 mt-0.5">
          {agent.description}
        </div>
      </div>

      {/* Color strip at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl"
        style={{ backgroundColor: agent.color }}
      />
    </button>
  );
}
