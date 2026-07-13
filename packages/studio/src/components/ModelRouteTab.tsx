// ── Model Route Tab (Tab 2) ──
// Form for editing model routing configuration:
// - Model selector dropdown
// - Temperature slider (0-2, step 0.1)
// - Max tokens input
// - Inherit defaults checkbox

import { useCallback } from "react";
import { cn } from "../lib/utils";
import type { PersonaConfig } from "@inkchain/inkchain-core/models/persona-config.js";

// ── Provider options ──

const PROVIDER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "custom", label: "自定义" },
];

const DEFAULT_MODELS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "claude-sonnet-4-7", label: "Claude Sonnet 4.7" },
  { value: "gpt-5.4", label: "GPT 5.4" },
  { value: "gpt-4o", label: "GPT 4o" },
  { value: "MiniMax-M2.7", label: "MiniMax M2.7" },
  { value: "kimi-k2.5", label: "Kimi K2.5" },
  { value: "deepseek-v3", label: "DeepSeek V3" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
];

// ── Props ──

interface ModelRouteTabProps {
  readonly config: PersonaConfig;
  readonly onChange: (config: PersonaConfig) => void;
}

// ── Default values (for inherit display) ──

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;

// ── Component ──

export function ModelRouteTab({ config, onChange }: ModelRouteTabProps) {
  const modelOverride = config.modelOverride;
  const isInheriting = !modelOverride;

  // ── Handlers ──

  const handleInheritToggle = useCallback(() => {
    if (isInheriting) {
      // Enable override with defaults
      onChange({
        ...config,
        modelOverride: {
          provider: "custom" as const,
          temperature: DEFAULT_TEMPERATURE,
        },
      });
    } else {
      // Disable override
      onChange({
        ...config,
        modelOverride: undefined,
      });
    }
  }, [config, onChange, isInheriting]);

  const handleProviderChange = useCallback((value: string) => {
    onChange({
      ...config,
      modelOverride: {
        ...(config.modelOverride ?? {}),
        provider: value === "anthropic" ? "anthropic" as const : value === "openai" ? "openai" as const : "custom" as const,
        service: value === "custom" ? config.modelOverride?.service : undefined,
        model: value === "custom" ? config.modelOverride?.model : DEFAULT_MODELS[0]?.value,
      },
    });
  }, [config, onChange]);

  const handleModelChange = useCallback((value: string) => {
    onChange({
      ...config,
      modelOverride: { ...(config.modelOverride ?? {}), model: value || undefined },
    });
  }, [config, onChange]);

  const handleServiceChange = useCallback((value: string) => {
    onChange({
      ...config,
      modelOverride: { ...(config.modelOverride ?? {}), service: value || undefined },
    });
  }, [config, onChange]);

  const handleTemperatureChange = useCallback((value: number) => {
    onChange({
      ...config,
      modelOverride: { ...(config.modelOverride ?? {}), temperature: value },
    });
  }, [config, onChange]);

  const handleMaxTokensChange = useCallback((value: string) => {
    const num = Number.parseInt(value, 10);
    if (!Number.isNaN(num) && num > 0) {
      onChange({
        ...config,
        modelOverride: { ...(config.modelOverride ?? {}), maxTokens: num },
      });
    }
  }, [config, onChange]);

  return (
    <div className="space-y-6">
      {/* Inherit defaults toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border/40 bg-card/30 p-4">
        <div>
          <p className="text-sm font-medium text-foreground">继承默认配置</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
            使用项目级别的默认模型配置
          </p>
        </div>
        <button
          type="button"
          onClick={handleInheritToggle}
          className={cn(
            "relative h-6 w-11 rounded-full transition-colors",
            isInheriting ? "bg-primary" : "bg-muted-foreground/20",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
              isInheriting ? "translate-x-[22px]" : "translate-x-[2px]",
            )}
          />
        </button>
      </div>

      {/* Custom model routing (only editable when NOT inheriting) */}
      <div className={cn("space-y-4", isInheriting && "pointer-events-none opacity-40")}>
        {/* Provider selector */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground/60 font-medium">服务提供商</label>
          <select
            value={modelOverride?.provider ?? "custom"}
            onChange={(e) => handleProviderChange(e.target.value)}
            disabled={isInheriting}
            className={cn(
              "w-full px-3 py-2 rounded-lg border border-border/40 bg-background text-sm text-foreground",
              "outline-none focus:border-primary/50 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Service (for custom providers) */}
        {modelOverride?.provider === "custom" && (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground/60 font-medium">服务标识</label>
            <input
              type="text"
              value={modelOverride?.service ?? ""}
              onChange={(e) => handleServiceChange(e.target.value)}
              placeholder="例如: openrouter, siliconcloud"
              disabled={isInheriting}
              className="w-full px-3 py-2 rounded-lg border border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
            />
          </div>
        )}

        {/* Model selector */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground/60 font-medium">模型</label>
          <select
            value={modelOverride?.model ?? ""}
            onChange={(e) => handleModelChange(e.target.value)}
            disabled={isInheriting}
            className={cn(
              "w-full px-3 py-2 rounded-lg border border-border/40 bg-background text-sm text-foreground",
              "outline-none focus:border-primary/50 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            <option value="">-- 选择模型 --</option>
            {DEFAULT_MODELS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Temperature slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground/60 font-medium">Temperature</label>
            <span className="text-xs text-muted-foreground/60 tabular-nums">
              {(modelOverride?.temperature ?? DEFAULT_TEMPERATURE).toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={200}
            value={Math.round((modelOverride?.temperature ?? DEFAULT_TEMPERATURE) * 10)}
            onChange={(e) => handleTemperatureChange(Number.parseInt(e.target.value, 10) / 10)}
            disabled={isInheriting}
            className={cn(
              "w-full h-2 rounded-full appearance-none cursor-pointer",
              "bg-muted-foreground/20 accent-primary",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground/40">
            <span>0.0 (精确)</span>
            <span>2.0 (创意)</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground/60 font-medium">Max Tokens</label>
          <input
            type="number"
            value={(modelOverride as { maxTokens?: number })?.maxTokens ?? DEFAULT_MAX_TOKENS}
            onChange={(e) => handleMaxTokensChange(e.target.value)}
            min={1}
            max={128000}
            disabled={isInheriting}
            className="w-full px-3 py-2 rounded-lg border border-border/40 bg-background text-sm text-foreground outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
          />
        </div>
      </div>

      {/* Summary when inheriting */}
      {isInheriting && (
        <div className="rounded-lg bg-muted/20 border border-border/20 p-3">
          <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
            当前使用项目默认模型配置。关闭"继承默认配置"以自定义此 Agent 的模型路由。
          </p>
        </div>
      )}
    </div>
  );
}
