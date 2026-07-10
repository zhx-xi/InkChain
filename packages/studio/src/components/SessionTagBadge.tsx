import type { SessionTag } from "@actalk/inkchain-core";
import { cn } from "@/lib/utils";

export interface SessionTagBadgeProps {
  /** The tag data to render. */
  tag: SessionTag;
  /** Optional callback when the remove (×) button is clicked. */
  onRemove?: () => void;
  /** Size variant. Defaults to "md". */
  size?: "sm" | "md";
}

/**
 * A small colored badge displaying a session tag name.
 *
 * - `sm` size: compact badge with smaller font, suitable for tight spaces.
 * - `md` size: default badge with comfortable spacing.
 *
 * When `onRemove` is provided, a small × button appears on hover.
 *
 * Uses Tailwind CSS for styling, consistent with InkOS design tokens.
 */
export function SessionTagBadge({
  tag,
  onRemove,
  size = "md",
}: SessionTagBadgeProps) {
  const sizeClasses = size === "sm"
    ? "text-[10px] px-1.5 py-0.5 gap-0.5 h-4"
    : "text-xs px-2 py-0.5 gap-1 h-5";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full font-medium whitespace-nowrap transition-colors",
        "border border-transparent",
        sizeClasses,
      )}
      style={{
        backgroundColor: `${tag.color}22`,
        color: tag.color,
        borderColor: `${tag.color}44`,
      }}
    >
      <span className="truncate max-w-[100px]">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            "inline-flex items-center justify-center rounded-full",
            "hover:bg-black/10 dark:hover:bg-white/10",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "transition-colors",
            size === "sm" ? "h-3 w-3 text-[8px]" : "h-3.5 w-3.5 text-[10px]",
          )}
          aria-label={`移除标签 ${tag.name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
