// ── SharedBreadcrumb (Issue #375) ──
// Unified breadcrumb navigation component used across all pages.
// Supports: nested segments, clickable links, active state, responsive truncation.

import { type ReactNode } from "react";
import { cn } from "../../lib/utils";
import { ChevronRight, Home } from "lucide-react";

// ── Types ──

interface BreadcrumbSegment {
  readonly label: string;
  readonly href?: string;
  readonly icon?: ReactNode;
  readonly onClick?: () => void;
}

interface SharedBreadcrumbProps {
  readonly segments: readonly BreadcrumbSegment[];
  readonly className?: string;
  readonly showHome?: boolean;
  readonly homeHref?: string;
  readonly onHomeClick?: () => void;
}

// ── Component ──

export function SharedBreadcrumb({
  segments,
  className,
  showHome = true,
  homeHref,
  onHomeClick,
}: SharedBreadcrumbProps) {
  const allSegments: BreadcrumbSegment[] = [
    ...(showHome
      ? [{ label: "首页", href: homeHref, icon: <Home size={14} />, onClick: onHomeClick }]
      : []),
    ...segments,
  ];

  return (
    <nav
      aria-label="面包屑导航"
      className={cn("flex items-center gap-1 text-sm text-muted-foreground flex-wrap", className)}
    >
      {allSegments.map((seg, idx) => {
        const isLast = idx === allSegments.length - 1;

        return (
          <span key={idx} className="flex items-center gap-1">
            {/* Separator (except first) */}
            {idx > 0 && (
              <ChevronRight size={12} className="text-muted-foreground/40 shrink-0" />
            )}

            {/* Segment */}
            {seg.onClick ? (
              <button
                onClick={seg.onClick}
                className={cn(
                  "inline-flex items-center gap-1.5 transition-colors",
                  isLast
                    ? "text-foreground font-medium cursor-default"
                    : "hover:text-foreground hover:underline underline-offset-2",
                )}
                disabled={isLast}
              >
                {seg.icon}
                <span className="truncate max-w-[120px]">{seg.label}</span>
              </button>
            ) : seg.href ? (
              <a
                href={seg.href}
                className={cn(
                  "inline-flex items-center gap-1.5 transition-colors",
                  isLast
                    ? "text-foreground font-medium cursor-default pointer-events-none"
                    : "hover:text-foreground hover:underline underline-offset-2",
                )}
              >
                {seg.icon}
                <span className="truncate max-w-[120px]">{seg.label}</span>
              </a>
            ) : (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5",
                  isLast && "text-foreground font-medium",
                )}
              >
                {seg.icon}
                <span className="truncate max-w-[120px]">{seg.label}</span>
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
