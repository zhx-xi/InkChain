import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface AlertBannerProps {
  readonly className?: string;
}

/**
 * Alert banner displayed when the graph contains forgotten (expired) relations.
 * Forgotten relations are ones whose `validUntilChapter` is before the current
 * narrative chapter — they represent character relationships that have faded,
 * ended, or been resolved in the story.
 */
export function AlertBanner({ className }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 mb-4",
        className,
      )}
      role="alert"
    >
      <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-500" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
          存在已遗忘的关系
        </p>
        <p className="text-xs text-amber-600/70 dark:text-amber-500/70 mt-1">
          部分角色关系在当前叙事阶段已结束或失效（以虚线表示）。这些关系曾存在于故事中，
          但已不再活跃。
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 p-1 rounded-md text-amber-500/50 hover:text-amber-600 hover:bg-amber-500/10 transition-colors"
        aria-label="关闭提示"
      >
        <X size={16} />
      </button>
    </div>
  );
}
