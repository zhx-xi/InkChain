import { Edit3 } from "lucide-react";
import { cn } from "../lib/utils";

// ── Agent Role Type ──
// Built-in roles are fixed; custom agents use arbitrary string ids.

export type AgentRole = string;

export type AgentStatus = "ready" | "busy" | "error" | "disabled";

// ── Agent Metadata ──

export interface AgentMetadata {
  readonly role: AgentRole;
  readonly label: string;
  readonly description: string;
  readonly color: string;
  readonly icon: string;
  readonly isCustom?: boolean;
}

export const AGENTS: ReadonlyArray<AgentMetadata> = [
  { role: "writer",     label: "执笔者",     description: "章节正文写手", color: "#E88D3A", icon: "✍️" },
  { role: "auditor",    label: "审核者",     description: "连贯性审计",   color: "#4A90D9", icon: "🔍" },
  { role: "editor",     label: "Editor",     description: "文字润色编辑", color: "#5CB85C", icon: "✏️" },
  { role: "architect",  label: "架构师",     description: "故事架构设计", color: "#8B5CF6", icon: "🏗️" },
  { role: "planner",    label: "规划师",     description: "章节节奏规划", color: "#9CA3AF", icon: "📋" },
  { role: "observer",   label: "Observer",   description: "叙事状态追踪", color: "#0EA5E9", icon: "👁️" },
  { role: "reviser",    label: "修订者",     description: "内容修订优化", color: "#EF4444", icon: "🔄" },
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
  readonly testId?: string;
}

export function AgentCard({ agent, status, displayName, onClick, className, testId }: AgentCardProps) {
  const statusCfg = STATUS_CONFIG[status];

  return (
    <button
      type="button"
      data-testid={testId}
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
      {/* Custom badge */}
      {agent.isCustom && (
        <div className="absolute -top-2 -left-2 z-10 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider shadow-sm"
          style={{ backgroundColor: agent.color, color: "#fff" }}>
          自定义
        </div>
      )}

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

      {/* Edit button - bottom-right */}
      {onClick != null && status !== "disabled" && (
        <button
          type="button"
          data-testid={`edit-agent-${agent.role}`}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="absolute bottom-2 right-2 z-10 flex items-center justify-center rounded-md p-1 opacity-0 transition-all duration-200
            group-hover/card:opacity-100 hover:scale-110"
          style={{ color: agent.color }}
          aria-label="编辑"
        >
          <Edit3 size={14} />
        </button>
      )}

      {/* Color strip at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl"
        style={{ backgroundColor: agent.color }}
      />
    </button>
  );
}
