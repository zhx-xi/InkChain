import { useState, useCallback } from "react";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import type { TriggerConfig } from "@actalk/inkchain-core";

// ── Condition type definitions ──

export type ConditionField = "sessionKind" | "language" | "bookId";
export type ConditionOp =
  | "contains" | "not_contains" | "equals" | "not_equals"
  | "gt" | "lt" | "gte" | "lte"
  | "exists" | "not_exists"
  | "time_since" | "time_absolute"
  | "context_match";

export interface StructuredCondition {
  field: ConditionField;
  op: ConditionOp;
  value: string;
  /** For numeric comparisons - parsed from value. */
}

const CONDITION_TYPE_META: Record<string, { label: string; description: string; ops: ConditionOp[]; fields: ConditionField[]; icon: string }> = {
  text_match: {
    label: "文本匹配",
    description: "基于文本内容判断",
    ops: ["contains", "not_contains", "equals", "not_equals"],
    fields: ["sessionKind", "language", "bookId"],
    icon: "Aa",
  },
  numeric: {
    label: "数值比较",
    description: "基于数值大小判断",
    ops: ["gt", "lt", "gte", "lte"],
    fields: ["sessionKind"],
    icon: "#",
  },
  existence: {
    label: "存在性判断",
    description: "判断字段是否存在",
    ops: ["exists", "not_exists"],
    fields: ["sessionKind", "language", "bookId"],
    icon: "✓",
  },
  time: {
    label: "时间条件",
    description: "基于触发间隔判断",
    ops: ["time_since", "time_absolute"],
    fields: ["sessionKind"],
    icon: "🕐",
  },
  context: {
    label: "上下文条件",
    description: "基于当前 Agent/场景判断",
    ops: ["context_match"],
    fields: ["sessionKind", "bookId"],
    icon: "⚙",
  },
};

const FIELD_LABELS: Record<string, string> = {
  sessionKind: "当前会话类型",
  language: "语言",
  bookId: "当前书籍",
};

const OP_LABELS: Record<string, string> = {
  contains: "包含",
  not_contains: "不包含",
  equals: "等于",
  not_equals: "不等于",
  gt: "大于",
  lt: "小于",
  gte: "大于等于",
  lte: "小于等于",
  exists: "存在",
  not_exists: "不存在",
  time_since: "距离上次触发",
  time_absolute: "固定时间",
  context_match: "匹配上下文",
};

/**
 * Parse a condition string to detect its structure for display purposes.
 * Returns a best-effort StructuredCondition; falls back to raw display.
 */
function parseCondition(condition: string): {
  conditionType: string;
  structured: StructuredCondition | null;
  raw: string;
} {
  // Try to parse as a simple equality check: field === 'value' or field === value
  const eqMatch = condition.match(/^(\w+)\s*===\s*['"](.+?)['"]$/);
  if (eqMatch) {
    return {
      conditionType: "text_match",
      structured: { field: eqMatch[1] as ConditionField, op: "equals", value: eqMatch[2] },
      raw: condition,
    };
  }

  const neqMatch = condition.match(/^(\w+)\s*!==\s*['"](.+?)['"]$/);
  if (neqMatch) {
    return {
      conditionType: "text_match",
      structured: { field: neqMatch[1] as ConditionField, op: "not_equals", value: neqMatch[2] },
      raw: condition,
    };
  }

  return { conditionType: "text_match", structured: null, raw: condition };
}

/**
 * Build a readable condition string from structured data.
 */
function buildConditionString(ct: string, structured: StructuredCondition): string {
  const field = structured.field;
  const val = structured.value;

  switch (ct) {
    case "text_match": {
      const escaped = val.includes("'") ? `"${val}"` : `'${val}'`;
      switch (structured.op) {
        case "contains": return `${field}.includes(${escaped})`;
        case "not_contains": return `!${field}.includes(${escaped})`;
        case "equals": return `${field} === ${escaped}`;
        case "not_equals": return `${field} !== ${escaped}`;
        default: return `${field} === ${escaped}`;
      }
    }
    case "numeric": {
      const num = parseFloat(val) || 0;
      switch (structured.op) {
        case "gt": return `${field}.length > ${num}`;
        case "lt": return `${field}.length < ${num}`;
        case "gte": return `${field}.length >= ${num}`;
        case "lte": return `${field}.length <= ${num}`;
        default: return `${field}.length === ${num}`;
      }
    }
    case "existence": {
      return structured.op === "exists" ? `${field} !== undefined` : `${field} === undefined`;
    }
    case "time": {
      return `true`; // placeholder - advanced time conditions reserved for v3+
    }
    case "context": {
      return `${field} === '${val}'`;
    }
    default:
      return `${field} === '${val}'`;
  }
}

// ── Props ──

interface TriggerBuilderProps {
  triggers: TriggerConfig[];
  onChange: (triggers: TriggerConfig[]) => void;
}

// ── Single Trigger Card ──

interface TriggerCardProps {
  trigger: TriggerConfig;
  index: number;
  total: number;
  onChange: (updated: TriggerConfig) => void;
  onDelete: () => void;
  onMoveUp: (() => void) | null;
  onMoveDown: (() => void) | null;
}

function TriggerCard({ trigger, index, total, onChange, onDelete, onMoveUp, onMoveDown }: TriggerCardProps) {
  const [expanded, setExpanded] = useState(true);

  const parsed = trigger.type === "condition" && trigger.condition
    ? parseCondition(trigger.condition)
    : null;

  const [conditionType, setConditionType] = useState(parsed?.conditionType ?? "text_match");
  const [structured, setStructured] = useState<StructuredCondition>(
    parsed?.structured ?? { field: "sessionKind", op: "equals", value: "" },
  );

  const handleConditionTypeChange = useCallback((newType: string) => {
    setConditionType(newType);
    const defaults: Record<string, Partial<StructuredCondition>> = {
      text_match: { field: "sessionKind", op: "equals", value: "" },
      numeric: { field: "sessionKind", op: "gt", value: "0" },
      existence: { field: "sessionKind", op: "exists", value: "" },
      time: { field: "sessionKind", op: "time_since", value: "1" },
      context: { field: "sessionKind", op: "context_match", value: "" },
    };
    const updated = defaults[newType] ?? { field: "sessionKind" as ConditionField, op: "equals" as ConditionOp, value: "" };
    const full = { ...updated } as StructuredCondition;
    setStructured(full);
    // Update the condition string
    const newCondition = buildConditionString(newType, full);
    onChange({ type: "condition", condition: newCondition });
  }, [onChange]);

  const handleFieldChange = useCallback((field: ConditionField) => {
    const updated = { ...structured, field };
    setStructured(updated);
    if (trigger.type === "condition") {
      const newCondition = buildConditionString(conditionType, updated);
      onChange({ type: "condition", condition: newCondition });
    }
  }, [structured, conditionType, trigger.type, onChange]);

  const handleOpChange = useCallback((op: ConditionOp) => {
    const updated = { ...structured, op };
    setStructured(updated);
    if (trigger.type === "condition") {
      const newCondition = buildConditionString(conditionType, updated);
      onChange({ type: "condition", condition: newCondition });
    }
  }, [structured, conditionType, trigger.type, onChange]);

  const handleValueChange = useCallback((value: string) => {
    const updated = { ...structured, value };
    setStructured(updated);
    if (trigger.type === "condition") {
      const newCondition = buildConditionString(conditionType, updated);
      onChange({ type: "condition", condition: newCondition });
    }
  }, [structured, conditionType, trigger.type, onChange]);

  // Build human-readable description
  const readableDesc = trigger.type === "manual"
    ? "手动触发"
    : structured.value
      ? `${FIELD_LABELS[structured.field] ?? structured.field} ${OP_LABELS[structured.op] ?? structured.op} "${structured.value}"`
      : `${FIELD_LABELS[structured.field] ?? structured.field} ${OP_LABELS[structured.op] ?? structured.op}`;

  return (
    <div className="rounded-lg border border-border/40 bg-card shadow-sm transition-all hover:border-border/60">
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Reorder grip */}
        <div className="flex flex-col gap-0.5 text-muted-foreground/30">
          {onMoveUp && (
            <button type="button" onClick={onMoveUp} className="hover:text-muted-foreground transition-colors leading-none">
              <ChevronUp size={12} />
            </button>
          )}
          {onMoveDown && (
            <button type="button" onClick={onMoveDown} className="hover:text-muted-foreground transition-colors leading-none">
              <ChevronDown size={12} />
            </button>
          )}
        </div>

        <GripVertical size={14} className="text-muted-foreground/20 shrink-0" />

        {/* Type badge */}
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
          trigger.type === "manual"
            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
        }`}>
          {trigger.type === "manual" ? "手动" : "条件"}
        </span>

        {/* Readable description */}
        <span className="text-xs text-foreground/80 truncate flex-1 min-w-0">
          {readableDesc}
        </span>

        {/* Expand/collapse */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-0.5 text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
          aria-label="删除触发器"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/30 space-y-2.5">
          {/* Row 1: Trigger type switch */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onChange({ type: "manual" });
                setExpanded(false);
              }}
              className={`flex-1 rounded-md border px-3 py-1.5 text-xs transition-all ${
                trigger.type === "manual"
                  ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 font-medium"
                  : "border-border/40 text-muted-foreground hover:border-border"
              }`}
            >
              手动
            </button>
            <button
              type="button"
              onClick={() => {
                const defaultCondition = buildConditionString(conditionType, structured);
                onChange({ type: "condition", condition: defaultCondition });
              }}
              className={`flex-1 rounded-md border px-3 py-1.5 text-xs transition-all ${
                trigger.type === "condition"
                  ? "border-purple-400 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 font-medium"
                  : "border-border/40 text-muted-foreground hover:border-border"
              }`}
            >
              条件表达式
            </button>
          </div>

          {/* Condition type selector & fields (only for "condition" type) */}
          {trigger.type === "condition" && (
            <>
              {/* Condition type */}
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">条件类型</label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(CONDITION_TYPE_META).map(([key, meta]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleConditionTypeChange(key)}
                      className={`px-2 py-1 rounded-md border text-[11px] transition-all ${
                        conditionType === key
                          ? "border-primary/50 bg-primary/5 text-primary font-medium"
                          : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                      title={meta.description}
                    >
                      {meta.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Field selector */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">字段</label>
                  <select
                    value={structured.field}
                    onChange={(e) => handleFieldChange(e.target.value as ConditionField)}
                    className="w-full rounded-md border border-border/40 bg-background px-2 py-1 text-xs outline-none focus:border-primary/50"
                  >
                    {CONDITION_TYPE_META[conditionType]?.fields.map((f) => (
                      <option key={f} value={f}>{FIELD_LABELS[f] ?? f}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">操作符</label>
                  <select
                    value={structured.op}
                    onChange={(e) => handleOpChange(e.target.value as ConditionOp)}
                    className="w-full rounded-md border border-border/40 bg-background px-2 py-1 text-xs outline-none focus:border-primary/50"
                  >
                    {CONDITION_TYPE_META[conditionType]?.ops.map((op) => (
                      <option key={op} value={op}>{OP_LABELS[op] ?? op}</option>
                    ))}
                  </select>
                </div>

                {/* Value input (hide for existence type) */}
                {conditionType !== "existence" && (
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">值</label>
                    <input
                      type={conditionType === "numeric" ? "number" : "text"}
                      value={structured.value}
                      onChange={(e) => handleValueChange(e.target.value)}
                      placeholder={conditionType === "time" ? "分钟" : "值"}
                      className="w-full rounded-md border border-border/40 bg-background px-2 py-1 text-xs outline-none focus:border-primary/50"
                    />
                  </div>
                )}
              </div>

              {/* Preview */}
              {trigger.condition && (
                <div className="rounded-md bg-muted/50 px-2.5 py-1.5 text-[10px] text-muted-foreground/70 font-mono leading-relaxed break-all">
                  {trigger.condition}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──

export function TriggerBuilder({ triggers, onChange }: TriggerBuilderProps) {
  const handleAdd = useCallback(() => {
    onChange([...triggers, { type: "manual" }]);
  }, [triggers, onChange]);

  const handleTriggerChange = useCallback((index: number, updated: TriggerConfig) => {
    const next = [...triggers];
    next[index] = updated;
    onChange(next);
  }, [triggers, onChange]);

  const handleDelete = useCallback((index: number) => {
    onChange(triggers.filter((_, i) => i !== index));
  }, [triggers, onChange]);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    const next = [...triggers];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  }, [triggers, onChange]);

  const handleMoveDown = useCallback((index: number) => {
    if (index >= triggers.length - 1) return;
    const next = [...triggers];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  }, [triggers, onChange]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[13px] font-medium text-foreground">触发条件</label>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/50">{triggers.length} 个</span>
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center gap-1 rounded-md border border-border/50 px-2 py-1 text-[12px] text-muted-foreground hover:bg-secondary/50 transition-colors"
          >
            <Plus size={12} />
            添加
          </button>
        </div>
      </div>

      {/* Logic operator bar (show when > 1 trigger) */}
      {triggers.length > 1 && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] text-muted-foreground/50">逻辑关系</span>
          <div className="flex gap-1">
            <button
              type="button"
              className="px-2 py-0.5 rounded text-[10px] border border-border/40 bg-card text-foreground font-medium cursor-default"
            >
              OR
            </button>
          </div>
          <span className="text-[9px] text-muted-foreground/40">满足任一条件即触发</span>
        </div>
      )}

      <div className="space-y-2">
        {triggers.map((trigger, idx) => (
          <TriggerCard
            key={idx}
            trigger={trigger}
            index={idx}
            total={triggers.length}
            onChange={(updated) => handleTriggerChange(idx, updated)}
            onDelete={() => handleDelete(idx)}
            onMoveUp={idx > 0 ? () => handleMoveUp(idx) : null}
            onMoveDown={idx < triggers.length - 1 ? () => handleMoveDown(idx) : null}
          />
        ))}
        {triggers.length === 0 && (
          <p className="text-xs text-muted-foreground/60 py-4 text-center border border-dashed border-border/30 rounded-lg">
            暂无触发条件。点击"添加"创建触发器。
          </p>
        )}
      </div>
    </section>
  );
}
