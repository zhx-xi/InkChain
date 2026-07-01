// ── Behavior Rule Editor ──
// Edit a single behavior constraint (Always / Never / When rule).

import { useCallback } from "react";
import { cn } from "../lib/utils";
import type { BehaviorConstraint, BehaviorStyle } from "@actalk/inkos-core/models/persona-config.js";

// ── Style options with colors ──

const STYLE_OPTIONS: ReadonlyArray<{ value: BehaviorStyle; label: string; color: string }> = [
  { value: "Always", label: "始终执行", color: "#22C55E" },
  { value: "Never", label: "从不执行", color: "#EF4444" },
  { value: "When", label: "条件触发", color: "#EAB308" },
];

// ── Props ──

interface BehaviorRuleEditorProps {
  readonly constraint: BehaviorConstraint;
  readonly index: number;
  readonly onChange: (index: number, constraint: BehaviorConstraint) => void;
  readonly onDelete: (index: number) => void;
}

// ── Component ──

export function BehaviorRuleEditor({ constraint, index, onChange, onDelete }: BehaviorRuleEditorProps) {
  const handleRuleChange = useCallback((value: string) => {
    onChange(index, { ...constraint, rule: value });
  }, [constraint, index, onChange]);

  const handleStyleChange = useCallback((value: BehaviorStyle) => {
    onChange(index, { ...constraint, style: value, condition: value === "When" ? constraint.condition : undefined });
  }, [constraint, index, onChange]);

  const handlePriorityChange = useCallback((value: string) => {
    const priority = Math.min(100, Math.max(1, Number.parseInt(value, 10) || 10));
    onChange(index, { ...constraint, priority });
  }, [constraint, index, onChange]);

  const handleEnabledChange = useCallback(() => {
    onChange(index, { ...constraint, enabled: !constraint.enabled });
  }, [constraint, index, onChange]);

  const handleConditionChange = useCallback((value: string) => {
    onChange(index, { ...constraint, condition: value });
  }, [constraint, index, onChange]);

  const style = STYLE_OPTIONS.find((s) => s.value === constraint.style) ?? STYLE_OPTIONS[0];

  return (
    <div
      className={cn(
        "rounded-lg border p-3.5 space-y-3 transition-all",
        constraint.enabled
          ? "border-border/40 bg-card/30"
          : "border-border/20 bg-muted/20 opacity-60",
      )}
    >
      {/* Header: Rule + Delete */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          {/* Enable toggle */}
          <button
            type="button"
            onClick={handleEnabledChange}
            className={cn(
              "h-5 w-5 rounded border-2 flex items-center justify-center transition-colors",
              constraint.enabled
                ? "bg-primary border-primary"
                : "border-muted-foreground/30",
            )}
          >
            {constraint.enabled && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          {/* Rule text input */}
          <input
            type="text"
            value={constraint.rule}
            onChange={(e) => handleRuleChange(e.target.value)}
            placeholder="输入行为规则…"
            className={cn(
              "flex-1 bg-transparent border-none outline-none text-sm",
              "placeholder:text-muted-foreground/40 text-foreground",
            )}
          />
        </div>

        <button
          type="button"
          onClick={() => onDelete(index)}
          className="text-muted-foreground/40 hover:text-destructive transition-colors p-1"
          title="删除规则"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Style selector */}
        <div className="flex gap-1">
          {STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleStyleChange(opt.value)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                constraint.style === opt.value
                  ? "text-white shadow-sm"
                  : "text-muted-foreground/60 hover:text-foreground bg-transparent",
              )}
              style={constraint.style === opt.value ? { backgroundColor: opt.color } : undefined}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Priority input */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
          <span>优先级</span>
          <input
            type="number"
            value={constraint.priority}
            onChange={(e) => handlePriorityChange(e.target.value)}
            min={1}
            max={100}
            className="w-12 px-1.5 py-0.5 rounded border border-border/30 bg-background text-xs text-center text-foreground"
          />
        </div>
      </div>

      {/* Condition input for "When" style */}
      {constraint.style === "When" && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/60 shrink-0">条件表达式</span>
          <input
            type="text"
            value={constraint.condition ?? ""}
            onChange={(e) => handleConditionChange(e.target.value)}
            placeholder="例如: 包含古风关键词"
            className="flex-1 px-2 py-1 rounded border border-border/30 bg-background text-xs text-foreground placeholder:text-muted-foreground/40"
          />
        </div>
      )}
    </div>
  );
}
