import { useCallback, useRef } from "react";
import { cn } from "../../lib/utils";

interface ResizeHandleProps {
  readonly onResize: (deltaY: number) => void;
  readonly className?: string;
}

/**
 * A thin horizontal draggable bar placed between two resizable sections.
 * Fires `onResize(deltaY)` on each mouse move so the parent can redistribute
 * the height between the adjacent sections.
 *
 * Intended usage: render between two <div> siblings inside a flex-column
 * container where the siblings have CSS `height` set explicitly.
 */
export function ResizeHandle({ onResize, className }: ResizeHandleProps) {
  const dragging = useRef(false);
  const startY = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startY.current = e.clientY;

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        onResize(ev.clientY - startY.current);
        startY.current = ev.clientY;
      };

      const onUp = () => {
        dragging.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [onResize],
  );

  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        "shrink-0 h-1 cursor-row-resize hover:bg-primary/20 active:bg-primary/30 transition-colors rounded-full",
        className,
      )}
    >
      {/* Invisible wider hit area for easier targeting */}
      <div className="-translate-y-1 h-3 w-full" />
    </div>
  );
}
