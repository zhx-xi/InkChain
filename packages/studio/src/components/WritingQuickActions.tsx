"use client";

import {
  Sparkles,
  FileEdit,
  SlidersHorizontal,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "./ui/tooltip";

export interface WritingQuickActionsProps {
  readonly onGenerateNext: () => void;
  readonly onRewriteSelection: () => void;
  readonly onAdjustParams: () => void;
  readonly onSwitchPersona: () => void;
  readonly collapsed?: boolean;
  readonly onToggleCollapse?: () => void;
  readonly disabled?: boolean;
}

interface ActionDef {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly tooltip: string;
  readonly onClick: () => void;
  readonly shortcut?: string;
}

export function WritingQuickActions({
  onGenerateNext,
  onRewriteSelection,
  onAdjustParams,
  onSwitchPersona,
  collapsed = false,
  onToggleCollapse,
  disabled = false,
}: WritingQuickActionsProps) {
  const actions: ActionDef[] = [
    {
      icon: <Sparkles size={14} />,
      label: "写下一节",
      tooltip: "生成下一节内容",
      onClick: onGenerateNext,
      shortcut: "Ctrl+Enter",
    },
    {
      icon: <FileEdit size={14} />,
      label: "重写选中",
      tooltip: "重写选中的段落",
      onClick: onRewriteSelection,
    },
    {
      icon: <SlidersHorizontal size={14} />,
      label: "调整参数",
      tooltip: "调整写作参数（风格、长度等）",
      onClick: onAdjustParams,
    },
    {
      icon: <RefreshCw size={14} />,
      label: "切换视角",
      tooltip: "切换写作视角或人设",
      onClick: onSwitchPersona,
    },
  ];

  if (collapsed) {
    return (
      <div className="flex items-center gap-1">
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center gap-1 px-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight size={12} />
            <span>写作操作</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Header with collapse toggle */}
      <div className="flex items-center justify-between">
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center gap-1 px-1 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <ChevronDown size={12} />
            <span>写作操作</span>
          </button>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <Tooltip key={action.label}>
            <TooltipTrigger>
              <button
                type="button"
                onClick={action.onClick}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-secondary/30 px-2.5 py-1.5 text-[12px] leading-5 font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                <span className="shrink-0">{action.icon}</span>
                <span className="truncate">{action.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              <div className="flex items-center gap-2">
                <span>{action.tooltip}</span>
                {action.shortcut && (
                  <kbd className="ml-1 rounded border border-background/20 bg-background/10 px-1 py-0.5 text-[10px] font-mono">
                    {action.shortcut}
                  </kbd>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
