"use client";

import { Loader2, Edit3, CheckCircle2, AlertCircle, Timer, Activity } from "lucide-react";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "./ui/hover-card";

export interface AgentStatus {
  readonly id: string;
  readonly name: string;
  readonly status: "thinking" | "writing" | "idle" | "error";
  readonly currentStage?: string;
  readonly progress?: number; // 0-100
  readonly lastError?: string;
}

export interface AgentStatusIndicatorProps {
  readonly agents: ReadonlyArray<AgentStatus>;
  readonly onHover?: (agent: AgentStatus | null) => void;
}

const STATUS_COLORS: Record<
  AgentStatus["status"],
  { bg: string; border: string; text: string; icon: string }
> = {
  thinking: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-600 dark:text-blue-400",
    icon: "text-blue-500",
  },
  writing: {
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    text: "text-green-600 dark:text-green-400",
    icon: "text-green-500",
  },
  idle: {
    bg: "bg-gray-500/10",
    border: "border-gray-500/20",
    text: "text-gray-500 dark:text-gray-400",
    icon: "text-gray-400",
  },
  error: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-600 dark:text-red-400",
    icon: "text-red-500",
  },
};

const STATUS_LABELS: Record<AgentStatus["status"], string> = {
  thinking: "思考中",
  writing: "写作中",
  idle: "空闲",
  error: "异常",
};

function AgentIcon({ status }: { readonly status: AgentStatus["status"] }) {
  switch (status) {
    case "thinking":
      return <Loader2 size={16} className="animate-spin shrink-0" />;
    case "writing":
      return <Edit3 size={16} className="animate-pulse shrink-0" />;
    case "idle":
      return <CheckCircle2 size={16} className="shrink-0" />;
    case "error":
      return <AlertCircle size={16} className="shrink-0" />;
  }
}

function AgentHoverCard({ agent }: { readonly agent: AgentStatus }) {
  const colors = STATUS_COLORS[agent.status];
  return (
    <div className="w-56 space-y-2">
      <div className="flex items-center gap-2">
        <div className={`p-1 rounded-full ${colors.bg} ${colors.icon}`}>
          <AgentIcon status={agent.status} />
        </div>
        <div>
          <div className="text-[14px] leading-5 font-semibold text-foreground">
            {agent.name}
          </div>
          <div className={`text-[11px] leading-4 font-medium ${colors.text}`}>
            {STATUS_LABELS[agent.status]}
          </div>
        </div>
      </div>

      {agent.currentStage && (
        <div className="flex items-center gap-1.5 rounded-lg bg-secondary/30 px-2.5 py-1.5">
          <Activity size={12} className="text-muted-foreground" />
          <span className="text-[12px] leading-4 text-muted-foreground truncate">
            {agent.currentStage}
          </span>
        </div>
      )}

      {agent.progress !== undefined && agent.progress >= 0 && (
        <div>
          <div className="flex items-center justify-between text-[11px] leading-4 text-muted-foreground mb-1">
            <span>进度</span>
            <span>{Math.round(agent.progress)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                agent.status === "thinking"
                  ? "bg-blue-500"
                  : agent.status === "writing"
                    ? "bg-green-500"
                    : agent.status === "error"
                      ? "bg-red-500"
                      : "bg-gray-400"
              }`}
              style={{ width: `${Math.max(0, Math.min(100, agent.progress))}%` }}
            />
          </div>
        </div>
      )}

      {agent.lastError && (
        <div className="flex items-start gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-1.5">
          <AlertCircle size={12} className="text-destructive shrink-0 mt-0.5" />
          <span className="text-[12px] leading-4 text-destructive break-words">
            {agent.lastError}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
        <Timer size={10} />
        <span>{agent.id}</span>
      </div>
    </div>
  );
}

export function AgentStatusIndicator({
  agents,
  onHover,
}: AgentStatusIndicatorProps) {
  if (agents.length === 0) return null;

  const anyActive = agents.some(
    (a) => a.status === "thinking" || a.status === "writing",
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] leading-4 font-semibold uppercase tracking-wider text-muted-foreground/60">
          写作 Agent
        </span>
        {anyActive && (
          <span className="flex items-center gap-1 text-[10px] text-primary">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            运行中
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {agents.map((agent) => {
          const colors = STATUS_COLORS[agent.status];
          return (
            <HoverCard
              key={agent.id}
              onOpenChange={(open) => onHover?.(open ? agent : null)}
            >
              <HoverCardTrigger className="cursor-pointer">
                <div
                  className={[
                    "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors",
                    colors.bg,
                    colors.border,
                  ].join(" ")}
                >
                  <div className={colors.icon}>
                    <AgentIcon status={agent.status} />
                  </div>
                  <span
                    className={[
                      "text-[13px] leading-5 font-medium truncate flex-1",
                      colors.text,
                    ].join(" ")}
                  >
                    {agent.name}
                  </span>
                  {agent.progress !== undefined && agent.progress >= 0 && (
                    <span className="text-[10px] leading-4 text-muted-foreground shrink-0">
                      {Math.round(agent.progress)}%
                    </span>
                  )}
                </div>
              </HoverCardTrigger>
              <HoverCardContent side="left" sideOffset={8} align="start">
                <AgentHoverCard agent={agent} />
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
    </div>
  );
}
