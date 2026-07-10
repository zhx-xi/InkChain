// ── Persona Edit Tab (Tab 1) ──
// Form for editing the personality traits, behavior constraints, and free-text details.

import { useCallback } from "react";
import { Plus } from "lucide-react";
import { cn } from "../lib/utils";
import { BehaviorRuleEditor } from "./BehaviorRuleEditor";
import type {
  PersonaConfig,
  BehaviorConstraint,
  BehaviorStyle,
} from "@actalk/inkchain-core/models/persona-config.js";

// ── Props ──

interface PersonaEditTabProps {
  readonly config: PersonaConfig;
  readonly onChange: (config: PersonaConfig) => void;
  readonly agentLabel: string;
}

// ── Trait Input Sub-Component ──

function TraitInput({
  traits,
  onChange,
}: {
  readonly traits: ReadonlyArray<string>;
  readonly onChange: (traits: string[]) => void;
}) {
  const handleAdd = useCallback(() => {
    onChange([...traits, ""]);
  }, [traits, onChange]);

  const handleRemove = useCallback((index: number) => {
    onChange(traits.filter((_, i) => i !== index));
  }, [traits, onChange]);

  const handleChange = useCallback((index: number, value: string) => {
    const updated = [...traits];
    updated[index] = value;
    onChange(updated);
  }, [traits, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {traits.map((trait, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/50 text-xs font-medium text-foreground"
          >
            <input
              type="text"
              value={trait}
              onChange={(e) => handleChange(index, e.target.value)}
              className="w-16 bg-transparent border-none outline-none text-xs text-center"
              placeholder="标签"
            />
            <button
              type="button"
              onClick={() => handleRemove(index)}
              className="text-muted-foreground/40 hover:text-destructive"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-border/40 text-xs text-muted-foreground/60 hover:text-foreground hover:border-border/60 transition-colors"
        >
          <Plus size={12} />
          <span>添加标签</span>
        </button>
      </div>
    </div>
  );
}

// ── Component ──

export function PersonaEditTab({ config, onChange, agentLabel }: PersonaEditTabProps) {
  // ── Handlers ──

  const handleDisplayNameChange = useCallback((value: string) => {
    onChange({ ...config, displayName: value });
  }, [config, onChange]);

  const handleTraitsChange = useCallback((traits: string[]) => {
    onChange({ ...config, personalityTraits: traits });
  }, [config, onChange]);

  const handleFreeTextChange = useCallback((value: string) => {
    onChange({ ...config, freeTextDetails: value });
  }, [config, onChange]);

  const handleConstraintChange = useCallback((index: number, constraint: BehaviorConstraint) => {
    const updated = [...config.behaviorConstraints];
    updated[index] = constraint;
    onChange({ ...config, behaviorConstraints: updated });
  }, [config, onChange]);

  const handleAddConstraint = useCallback(() => {
    const newConstraint: BehaviorConstraint = {
      rule: "",
      style: "Always" as BehaviorStyle,
      priority: 10,
      enabled: true,
    };
    onChange({ ...config, behaviorConstraints: [...config.behaviorConstraints, newConstraint] });
  }, [config, onChange]);

  const handleDeleteConstraint = useCallback((index: number) => {
    const updated = config.behaviorConstraints.filter((_, i) => i !== index);
    onChange({ ...config, behaviorConstraints: updated });
  }, [config, onChange]);

  return (
    <div className="space-y-6">
      {/* Section: Basic Info */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          基本信息
        </h3>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground/60 font-medium">角色名 (Display Name)</label>
          <input
            type="text"
            value={config.displayName}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            placeholder={`${agentLabel} 的别名…`}
            className="w-full px-3 py-2 rounded-lg border border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors"
          />
        </div>
      </section>

      {/* Section: Personality Traits */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          性格特征标签
        </h3>
        <TraitInput
          traits={config.personalityTraits}
          onChange={handleTraitsChange}
        />
      </section>

      {/* Section: Behavior Constraints */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            行为规则
          </h3>
          <button
            type="button"
            onClick={handleAddConstraint}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-primary/80 hover:text-primary hover:bg-primary/5 transition-colors"
          >
            <Plus size={12} />
            <span>添加规则</span>
          </button>
        </div>

        <div className="space-y-2">
          {config.behaviorConstraints.length === 0 && (
            <p className="text-xs text-muted-foreground/40 italic px-1">
              尚无行为规则。点击"添加规则"开始。
            </p>
          )}
          {config.behaviorConstraints.map((constraint, index) => (
            <BehaviorRuleEditor
              key={index}
              constraint={constraint}
              index={index}
              onChange={handleConstraintChange}
              onDelete={handleDeleteConstraint}
            />
          ))}
        </div>
      </section>

      {/* Section: System Prompt / Free Text */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          System Prompt（自由文本）
        </h3>
        <textarea
          value={config.freeTextDetails}
          onChange={(e) => handleFreeTextChange(e.target.value)}
          placeholder="在此编写 System Prompt 或详细的人格描述…&#10;&#10;支持 Markdown 格式。"
          className={cn(
            "w-full min-h-[180px] px-3 py-2.5 rounded-lg border border-border/40 bg-background",
            "text-sm text-foreground leading-relaxed placeholder:text-muted-foreground/40",
            "outline-none focus:border-primary/50 transition-colors resize-y",
            "font-mono text-[13px]",
          )}
        />
      </section>

      {/* System Prompt Preview (read-only) */}
      {config.systemPrompt && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            最终 System Prompt 预览（只读）
          </h3>
          <pre className="w-full p-3 rounded-lg bg-muted/30 border border-border/20 text-xs text-muted-foreground/80 leading-relaxed whitespace-pre-wrap font-mono max-h-[200px] overflow-y-auto">
            {config.systemPrompt}
          </pre>
        </section>
      )}
    </div>
  );
}
