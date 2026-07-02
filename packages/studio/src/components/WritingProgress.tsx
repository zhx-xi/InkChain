"use client";

import { Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "../lib/utils";

export interface AgentProgressItem {
  readonly agentId: string;
  readonly agentName: string;
  readonly progress: number;
  readonly status: string;
}

export interface WritingProgressProps {
  readonly currentWordCount: number;
  readonly targetWordCount: number;
  readonly chapterNumber: number;
  readonly chapterTitle?: string;
  readonly agentProgress: ReadonlyArray<AgentProgressItem>;
}

function formatCount(count: number): string {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}万`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

function ProgressBar({
  value,
  max,
  className,
  barClassName,
}: {
  value: number;
  max: number;
  className?: string;
  barClassName?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={cn(
        "h-2 w-full rounded-full bg-secondary overflow-hidden",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500 ease-out",
          pct >= 100
            ? "bg-green-500"
            : pct > 0
              ? "bg-primary"
              : "bg-transparent",
          barClassName,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function WritingProgress({
  currentWordCount,
  targetWordCount,
  chapterNumber,
  chapterTitle,
  agentProgress,
}: WritingProgressProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Chapter label */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] leading-5 font-medium text-foreground">
          第 {chapterNumber} 章
          {chapterTitle && (
            <span className="text-muted-foreground ml-1">· {chapterTitle}</span>
          )}
        </span>
        <span className="text-[11px] leading-4 text-muted-foreground">
          {formatCount(currentWordCount)} / {formatCount(targetWordCount)} 字
        </span>
      </div>

      {/* Main progress bar */}
      <ProgressBar value={currentWordCount} max={targetWordCount} />

      {/* Per-agent mini progress */}
      {agentProgress.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          {agentProgress.map((ap) => {
            const isActive = ap.status === "thinking" || ap.status === "writing" || ap.status === "running";
            const isDone = ap.status === "completed" || ap.status === "idle";
            const isError = ap.status === "error";
            const pct = Math.max(0, Math.min(100, ap.progress));
            return (
              <div key={ap.agentId} className="flex items-center gap-2">
                <span className="w-14 text-[11px] leading-4 text-muted-foreground truncate shrink-0">
                  {ap.agentName}
                </span>
                <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isError
                        ? "bg-destructive"
                        : isDone
                          ? "bg-green-500"
                          : isActive
                            ? "bg-primary"
                            : "bg-gray-300 dark:bg-gray-600",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {isActive ? (
                  <Loader2 size={10} className="text-primary animate-spin shrink-0" />
                ) : isDone ? (
                  <CheckCircle2 size={10} className="text-green-500 shrink-0" />
                ) : (
                  <span className="w-3 shrink-0" />
                )}
                <span className="w-7 text-right text-[10px] leading-4 text-muted-foreground shrink-0">
                  {Math.round(pct)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
