// ── Voice Profile Editor Component (C3-1) ──
// Modal panel for editing a character's voice profile:
// speech style, personality traits, catchphrases, tone,
// vocabulary, avoidance words, and sample dialogues.
// Includes preset selector buttons for quick filling.

import { useState, useCallback, useEffect } from "react";
import { X, Save, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";

// ── Types ──

interface VoiceProfile {
  characterId: string;
  speechStyle: string;
  personality: string[];
  catchphrases: string[];
  tone: string;
  vocabulary: string[];
  avoidance: string[];
  sampleDialogues: string[];
  updatedAt: number;
}

interface VoicePreset {
  id: string;
  speechStyle?: string;
  personality?: string[];
  catchphrases?: string[];
  tone?: string;
  vocabulary?: string[];
  avoidance?: string[];
  sampleDialogues?: string[];
}

// ── Props ──

interface VoiceProfileEditorProps {
  readonly characterId: string;
  readonly characterName?: string;
  readonly onClose: () => void;
}

// ── API Base URL ──

const API_PREFIX = "/api/v1/project";

// ── Tag Editor Sub-Component ──

function TagEditor({
  label,
  tags,
  onChange,
  placeholder,
}: {
  readonly label: string;
  readonly tags: string[];
  readonly onChange: (tags: string[]) => void;
  readonly placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const value = inputValue.trim();
      if (value && !tags.includes(value)) {
        onChange([...tags, value]);
      }
      setInputValue("");
    }
    if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-foreground/70">{label}</label>
      <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-border/40 bg-background/50 min-h-[36px]">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-destructive transition-colors"
              aria-label={`移除 ${tag}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? `输入后按 Enter 添加`}
          className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground/40"
        />
      </div>
    </div>
  );
}

// ── Preset Definitions ──

const PRESET_BUTTONS: Array<{ id: string; label: string; color: string }> = [
  { id: "ancient-scholar", label: "古代书生", color: "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200" },
  { id: "modern-youth", label: "现代青年", color: "bg-sky-100 text-sky-800 border-sky-300 hover:bg-sky-200" },
  { id: "martial-hero", label: "江湖豪侠", color: "bg-red-100 text-red-800 border-red-300 hover:bg-red-200" },
  { id: "court-noble", label: "宫中贵人", color: "bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200" },
];

// ── Component ──

export function VoiceProfileEditor({ characterId, characterName, onClose }: VoiceProfileEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null);

  // Form fields
  const [speechStyle, setSpeechStyle] = useState("现代口语");
  const [personality, setPersonality] = useState<string[]>([]);
  const [catchphrases, setCatchphrases] = useState<string[]>([]);
  const [tone, setTone] = useState("温和");
  const [vocabulary, setVocabulary] = useState<string[]>([]);
  const [avoidance, setAvoidance] = useState<string[]>([]);
  const [sampleDialoguesText, setSampleDialoguesText] = useState("");

  // ── Load Profile ──

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_PREFIX}/voice-profiles/${encodeURIComponent(characterId)}`);
      if (!res.ok) {
        if (res.status === 404) {
          // No profile yet — use defaults
          setSpeechStyle("现代口语");
          setPersonality([]);
          setCatchphrases([]);
          setTone("温和");
          setVocabulary([]);
          setAvoidance([]);
          setSampleDialoguesText("");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json() as { profile: VoiceProfile };
      const p = data.profile;
      setSpeechStyle(p.speechStyle);
      setPersonality(p.personality);
      setCatchphrases(p.catchphrases);
      setTone(p.tone);
      setVocabulary(p.vocabulary);
      setAvoidance(p.avoidance);
      setSampleDialoguesText(p.sampleDialogues.join("\n---\n"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [characterId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  // ── Load Preset ──

  const loadPreset = useCallback(async (presetId: string) => {
    setLoadingPreset(presetId);
    try {
      const res = await fetch(`${API_PREFIX}/voice-profiles/presets/${encodeURIComponent(presetId)}`);
      if (!res.ok) return;
      const data = await res.json() as { preset: VoicePreset };
      const preset = data.preset;
      if (preset.speechStyle) setSpeechStyle(preset.speechStyle);
      if (preset.tone) setTone(preset.tone);
      if (preset.personality) setPersonality(preset.personality);
      if (preset.catchphrases) setCatchphrases(preset.catchphrases);
      if (preset.vocabulary) setVocabulary(preset.vocabulary);
      if (preset.avoidance) setAvoidance(preset.avoidance);
      if (preset.sampleDialogues) setSampleDialoguesText(preset.sampleDialogues.join("\n---\n"));
    } finally {
      setLoadingPreset(null);
    }
  }, []);

  // ── Save ──

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStatus("idle");
    try {
      const sampleDialogues = sampleDialoguesText
        .split(/\n---\n/)
        .map((s) => s.trim())
        .filter(Boolean);

      const body = {
        speechStyle,
        personality,
        catchphrases,
        tone,
        vocabulary,
        avoidance,
        sampleDialogues,
      };

      const res = await fetch(
        `${API_PREFIX}/voice-profiles/${encodeURIComponent(characterId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
      }

      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e) {
      setSaveStatus("error");
      setError(e instanceof Error ? e.message : String(e));
      setTimeout(() => setSaveStatus("idle"), 3000);
    } finally {
      setSaving(false);
    }
  }, [characterId, speechStyle, personality, catchphrases, tone, vocabulary, avoidance, sampleDialoguesText]);

  // ── Keyboard shortcut ──

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      void handleSave();
    }
  }, [handleSave]);

  // ── Speech Style Options ──

  const SPEECH_STYLE_OPTIONS = [
    "现代口语",
    "文绉绉",
    "江湖豪迈",
    "典雅高贵",
    "俏皮可爱",
    "沉稳老练",
    "犀利尖锐",
    "温柔细腻",
    "冷峻简洁",
  ];

  // ── Loading State ──

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">加载声线档案…</span>
        </div>
      </div>
    );
  }

  // ── Render ──

  const displayName = characterName ?? characterId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onKeyDown={handleKeyDown}
    >
      {/* Overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Panel */}
      <div
        className={cn(
          "relative w-full max-w-lg max-h-[85vh] flex flex-col",
          "bg-card border border-border/60 rounded-2xl shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-200",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-lg shadow-sm">
              <span role="img" aria-label="voice">🎙️</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">角色声线档案</h2>
              <p className="text-[11px] text-muted-foreground/60">{displayName}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-secondary/50 transition-colors"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Preset Selector ── */}
        <div className="px-6 pt-4 pb-2">
          <label className="block text-xs font-medium text-foreground/70 mb-2">
            快速套用预设
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_BUTTONS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => void loadPreset(preset.id)}
                disabled={loadingPreset !== null}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  preset.color,
                  loadingPreset === preset.id && "opacity-60",
                )}
              >
                {loadingPreset === preset.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Speech Style */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground/70">语言风格</label>
            <select
              value={speechStyle}
              onChange={(e) => setSpeechStyle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border/40 bg-background/50 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
            >
              {SPEECH_STYLE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Tone */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground/70">语气 / 语调</label>
            <input
              type="text"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="例: 温和、豪迈、沉稳"
              className="w-full px-3 py-2 rounded-lg border border-border/40 bg-background/50 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
            />
          </div>

          {/* Personality Tags */}
          <TagEditor
            label="性格特征"
            tags={personality}
            onChange={setPersonality}
            placeholder="输入性格特征后按 Enter"
          />

          {/* Catchphrases Tags */}
          <TagEditor
            label="口头禅 / 习惯用语"
            tags={catchphrases}
            onChange={setCatchphrases}
            placeholder="输入口头禅后按 Enter"
          />

          {/* Vocabulary Tags */}
          <TagEditor
            label="常用词汇"
            tags={vocabulary}
            onChange={setVocabulary}
            placeholder="输入常用词汇后按 Enter"
          />

          {/* Avoidance Tags */}
          <TagEditor
            label="避讳 / 不常用词汇"
            tags={avoidance}
            onChange={setAvoidance}
            placeholder="输入避讳词汇后按 Enter"
          />

          {/* Sample Dialogues */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground/70">示例对话</label>
            <p className="text-[10px] text-muted-foreground/50">多条对话请用 "---" 分隔</p>
            <textarea
              value={sampleDialoguesText}
              onChange={(e) => setSampleDialoguesText(e.target.value)}
              placeholder="每条示例对话一行，多条请用 --- 分隔"
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-border/40 bg-background/50 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors resize-y"
            />
          </div>

          {/* Error Message */}
          {saveStatus === "error" && error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle size={14} className="text-destructive shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border/30">
          <div className="flex items-center gap-2">
            {saveStatus === "success" && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 size={14} />
                已保存
              </span>
            )}
            {saveStatus === "error" && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle size={14} />
                保存失败
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              "bg-primary text-primary-foreground hover:opacity-90 shadow-sm",
              saving && "opacity-70",
            )}
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            <span>{saving ? "保存中…" : "保存"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
