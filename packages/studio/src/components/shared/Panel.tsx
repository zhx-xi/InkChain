// ── SharedPanel (Issue #375) ──
// Unified side-sliding panel wrapper used across all pages.
// Guarantees: top >= 72px, close button, slide-in animation, responsive.

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

// ── Props ──

interface SharedPanelProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title?: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly width?: "sm" | "md" | "lg" | "xl" | "full";
  readonly showCloseButton?: boolean;
  readonly side?: "left" | "right";
}

const WIDTH_MAP: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  full: "max-w-[90vw]",
};

// ── Component ──

export function SharedPanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  className,
  width = "md",
  showCloseButton = true,
  side = "right",
}: SharedPanelProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const slideClass =
    side === "right"
      ? "data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right"
      : "data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left";

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[90] flex justify-end fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Panel */}
      <div
        ref={panelRef}
        data-open={open}
        className={cn(
          "relative z-10 h-full w-full overflow-y-auto bg-card border-l border-border/60 shadow-2xl pt-[72px]",
          WIDTH_MAP[width] ?? WIDTH_MAP.md,
          slideClass,
          "duration-200",
          className,
        )}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border/40 bg-card/95 backdrop-blur-sm">
            <div className="flex-1 min-w-0">
              {title && (
                <h2 className="text-lg font-semibold font-serif tracking-tight text-foreground truncate">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors shrink-0"
                aria-label="关闭面板"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
