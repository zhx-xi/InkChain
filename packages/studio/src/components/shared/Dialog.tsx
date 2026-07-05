// ── SharedDialog (Issue #375) ──
// Unified modal dialog wrapper used across all pages.
// Guarantees: top >= 72px, backdrop, close button, centered layout.

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

// ── Props ──

interface SharedDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title?: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
  readonly size?: "sm" | "md" | "lg";
  readonly showCloseButton?: boolean;
  readonly showHeader?: boolean;
}

const SIZE_MAP: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

// ── Component ──

export function SharedDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  size = "md",
  showCloseButton = true,
  showHeader = true,
}: SharedDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

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

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className={cn(
          "relative z-10 w-full rounded-2xl bg-card border border-border/60 shadow-2xl shadow-primary/5 overflow-hidden",
          "pt-[72px] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          SIZE_MAP[size] ?? SIZE_MAP.md,
          className,
        )}
        data-open={open}
      >
        {/* Header */}
        {showHeader && (title || showCloseButton) && (
          <div className="flex items-start justify-between px-6 pt-6 pb-2">
            <div className="flex-1 min-w-0">
              {title && (
                <h2 className="text-lg font-semibold font-serif tracking-tight text-foreground">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors shrink-0 ml-4"
                aria-label="关闭对话框"
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

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/40 bg-muted/30 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
