// ── Persona Preset List Panel (Per-6) ──
// Modal panel for browsing, applying, and saving persona presets.
// Shows built-in and project-level presets with description and apply button.

import { useState, useCallback } from "react";
import { X, Check, Save, Plus, Loader2, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";
import { usePresetList, usePresetDetail, useApplyPreset, useSavePreset } from "../hooks/use-preset-api";
import { usePersonaList } from "../hooks/use-persona-api";
import { AGENTS } from "./AgentCard";
import type { AgentRole } from "@inkchain/inkchain-core/models/persona-config.js";

// ── Props ──

interface PresetListPanelProps {
  readonly onClose: () => void;
  readonly onApplied: () => void;
}

// ── Component ──

export function PresetListPanel({ onClose, onApplied }: PresetListPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  const { presets, loading, error, refetch } = usePresetList();
  const { preset: detail, loading: detailLoading } = usePresetDetail(selectedId);
  const { apply, applying } = useApplyPreset();
  const { save, saving } = useSavePreset();
  const { personas: currentPersonas } = usePersonaList();

  // ── Apply handler ──
  const handleApply = useCallback(async (presetId: string, presetName: string) => {
    const ok = await apply(presetId);
    if (ok) {
      setApplySuccess(presetName);
      setTimeout(() => setApplySuccess(null), 3000);
      onApplied();
    }
  }, [apply, onApplied]);

  // ── Save handler ──
  const handleSave = useCallback(async () => {
    if (!saveName.trim()) return;
    // Build personas record from current persona list
    const personas: Record<string, unknown> = {};
    for (const p of currentPersonas) {
      // We need to load each persona's full config
      // For now we only have summaries, so we'll rely on the API
    }
    const presetId = await save(saveName.trim(), saveDesc.trim(), {});
    if (presetId) {
      setSaveMode(false);
      setSaveName("");
      setSaveDesc("");
      await refetch();
    }
  }, [saveName, saveDesc, save, currentPersonas, refetch]);

  // ── Reset when save mode opens ──
  const openSaveMode = useCallback(() => {
    setSaveMode(true);
    setSaveName("");
    setSaveDesc("");
  }, []);

  // ── Preset source badge ──
  const SourceBadge = ({ source }: { readonly source: "builtin" | "project" }) => (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
      source === "builtin"
        ? "bg-blue-500/10 text-blue-600"
        : "bg-purple-500/10 text-purple-600",
    )}>
      {source === "builtin" ? "内置" : "项目"}
    </span>
  );

  // ── Agent role label helper ──
  const agentLabel = (role: string): string => {
    const agent = AGENTS.find((a) => a.role === role);
    return agent?.label ?? role;
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">加载预设列表…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-card border border-border/60 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-lg shadow-sm">
              <Sparkles size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Persona 预设库</h2>
              <p className="text-[11px] text-muted-foreground/60">选择预设一键应用到所有 Agent</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openSaveMode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <Plus size={14} />
              <span>另存为预设</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Body: Split layout ── */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Preset list */}
          <div className="w-72 border-r border-border/30 overflow-y-auto p-4 space-y-2">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 text-destructive text-xs">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            {presets.length === 0 && !error && (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground/60">
                <Sparkles size={24} className="opacity-30" />
                <span className="text-xs">暂无预设</span>
              </div>
            )}

            {presets.map((preset) => (
              <button
                key={`${preset.source}-${preset.id}`}
                type="button"
                onClick={() => setSelectedId(preset.id)}
                className={cn(
                  "w-full text-left p-3 rounded-xl border transition-all",
                  selectedId === preset.id
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/30 hover:border-border/60 hover:bg-secondary/30",
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground">{preset.name}</span>
                  <SourceBadge source={preset.source} />
                </div>
                <p className="text-[11px] text-muted-foreground/60 line-clamp-2">
                  {preset.description}
                </p>
                {preset.source === "project" && (
                  <p className="text-[10px] text-muted-foreground/40 mt-1">
                    v{preset.version}
                  </p>
                )}
              </button>
            ))}
          </div>

          {/* Right: Detail + Apply */}
          <div className="flex-1 overflow-y-auto p-4">
            {!selectedId && !saveMode && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40">
                <Sparkles size={32} className="opacity-20 mb-2" />
                <p className="text-sm">选择一个预设查看详情</p>
              </div>
            )}

            {saveMode && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground">另存为新预设</h3>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">预设名称</label>
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="如：我的古风预设"
                    className="w-full px-3 py-2 rounded-lg border border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">描述（可选）</label>
                  <textarea
                    value={saveDesc}
                    onChange={(e) => setSaveDesc(e.target.value)}
                    placeholder="简短描述这个预设的适用场景…"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 resize-none"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!saveName.trim() || saving}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      saveName.trim() && !saving
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "bg-muted-foreground/10 text-muted-foreground/50 cursor-not-allowed",
                    )}
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>{saving ? "保存中…" : "保存预设"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaveMode(false)}
                    className="px-3 py-2 rounded-lg border border-border/40 text-xs text-muted-foreground hover:bg-secondary/50"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {selectedId && detail && !saveMode && (
              <div className="space-y-4">
                {/* Preset info */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-foreground">{detail.name}</h3>
                    <p className="text-xs text-muted-foreground/60 mt-1">{detail.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApply(detail.id, detail.name)}
                    disabled={applying}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0",
                      applying
                        ? "bg-muted-foreground/10 text-muted-foreground/50"
                        : "bg-primary text-primary-foreground hover:opacity-90 shadow-sm",
                    )}
                  >
                    {applying ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    <span>{applying ? "应用中…" : "应用此预设"}</span>
                  </button>
                </div>

                {/* Success toast */}
                {applySuccess && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-600 text-xs">
                    <CheckCircle2 size={14} />
                    <span>预设「{applySuccess}」已应用到所有 Agent</span>
                  </div>
                )}

                {/* Agent persona list */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">7 Agent 配置预览</h4>
                  {Object.entries(detail.personas).map(([role, config]) => (
                    <div
                      key={role}
                      className="p-3 rounded-xl border border-border/20 bg-secondary/20 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">
                          {config.displayName}
                        </span>
                        <span className="text-[10px] text-muted-foreground/40">{agentLabel(role)}</span>
                      </div>
                      {config.personalityTraits.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {config.personalityTraits.map((trait: string, i: number) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 rounded bg-background/80 text-[10px] text-muted-foreground/70 border border-border/20"
                            >
                              {trait}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground/50 line-clamp-2">
                        {config.freeTextDetails}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
