import { useState, useEffect, useCallback } from "react";
import { useApi, fetchJson, postApi } from "../hooks/use-api";
import type {
  WorldConfig,
  WorldConfigUpdate,
  WorldSettingEntry,
  WorldRole,
  WorldRelation,
  WorldRegion,
  WorldInstitution,
  WorldHistoryEvent,
  WorldRule,
  WorldDimensionKey,
} from "@actalk/inkos-core";
import {
  WORLD_DIMENSION_KEYS,
  WorldConfigSchema,
  WorldConfigUpdateSchema,
} from "@actalk/inkos-core";
import { ArrowLeft, Save, Trash2, Plus, BookPlus, X, Globe } from "lucide-react";
import { cn } from "../lib/utils";

// ── Dimension metadata ──

const DIMENSION_META: Record<string, { label: string; description: string; color: string }> = {
  settings: { label: "世界观设定", description: "物理规则、魔法体系、科技水平、社会结构、文化习俗", color: "#4A90D9" },
  roles: { label: "世界角色", description: "主角、配角、反派、中立角色", color: "#22C55E" },
  relations: { label: "世界关系", description: "角色间的关联与交互", color: "#8B5CF6" },
  regions: { label: "地理区域", description: "大陆、国家、城市、地点", color: "#E88D3A" },
  institutions: { label: "组织势力", description: "宗门、国家、组织、家族", color: "#EC4899" },
  history: { label: "历史事件", description: "重要历史事件与时间线", color: "#F59E0B" },
  rules: { label: "世界规则", description: "物理、魔法、社会、叙事规则", color: "#EF4444" },
};

// ── Helper: generate short IDs ──

let _idCounter = 0;
function genId(): string {
  _idCounter += 1;
  return `_${Date.now().toString(36)}_${_idCounter}`;
}

// ── Props ──

interface WorldDetailProps {
  readonly worldId?: string; // undefined = create mode
  readonly nav?: { toWorlds: () => void; toBook: (bookId: string) => void; toWorldGeoViz?: (worldId: string) => void };
}

// ── Entry form state type (mutable during editing) ──

interface WorldDraft {
  name: string;
  description: string;
  settings: WorldSettingEntry[];
  roles: WorldRole[];
  relations: WorldRelation[];
  regions: WorldRegion[];
  institutions: WorldInstitution[];
  history: WorldHistoryEvent[];
  rules: WorldRule[];
  [key: string]: unknown;
}

function emptyDraft(): WorldDraft {
  return {
    name: "",
    description: "",
    settings: [],
    roles: [],
    relations: [],
    regions: [],
    institutions: [],
    history: [],
    rules: [],
  };
}

function worldToDraft(world: WorldConfig): WorldDraft {
  return {
    name: world.name,
    description: world.description,
    settings: world.settings,
    roles: world.roles,
    relations: world.relations,
    regions: world.regions,
    institutions: world.institutions,
    history: world.history,
    rules: world.rules,
  };
}

// ── Dimension sub-editors ──

function SettingsEditor({ entries, onChange }: {
  entries: WorldSettingEntry[];
  onChange: (v: WorldSettingEntry[]) => void;
}) {
  const update = (i: number, patch: Partial<WorldSettingEntry>) => {
    const next = entries.map((e, idx) => idx === i ? { ...e, ...patch } : e);
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {entries.map((e, i) => (
        <div key={e.id} className="rounded-lg border border-border/40 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input value={e.name} onChange={(ev) => update(i, { name: ev.target.value })}
              className="flex-1 rounded-md border border-border/40 bg-background px-2 py-1 text-sm" placeholder="名称" />
            <select value={e.type} onChange={(ev) => update(i, { type: ev.target.value as any })}
              className="rounded-md border border-border/40 bg-background px-2 py-1 text-sm">
              <option value="物理规则">物理规则</option>
              <option value="魔法体系">魔法体系</option>
              <option value="科技水平">科技水平</option>
              <option value="社会结构">社会结构</option>
              <option value="文化习俗">文化习俗</option>
            </select>
            <button type="button" onClick={() => onChange(entries.filter((_, j) => j !== i))}
              className="text-muted-foreground/40 hover:text-destructive transition-colors"><X size={14} /></button>
          </div>
          <textarea value={e.description} onChange={(ev) => update(i, { description: ev.target.value })}
            className="w-full rounded-md border border-border/40 bg-background px-2 py-1 text-xs min-h-[60px]" placeholder="描述" />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...entries, { id: genId(), name: "", type: "物理规则", description: "", constraints: [] }])}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"><Plus size={12} /> 添加设定</button>
    </div>
  );
}

function RolesEditor({ entries, onChange }: {
  entries: WorldRole[];
  onChange: (v: WorldRole[]) => void;
}) {
  const update = (i: number, patch: Partial<WorldRole>) => {
    const next = entries.map((e, idx) => idx === i ? { ...e, ...patch } : e);
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {entries.map((e, i) => (
        <div key={e.id} className="rounded-lg border border-border/40 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input value={e.name} onChange={(ev) => update(i, { name: ev.target.value })}
              className="flex-1 rounded-md border border-border/40 bg-background px-2 py-1 text-sm" placeholder="角色名" />
            <select value={e.role} onChange={(ev) => update(i, { role: ev.target.value as any })}
              className="rounded-md border border-border/40 bg-background px-2 py-1 text-sm">
              <option value="主角">主角</option><option value="配角">配角</option><option value="反派">反派</option><option value="中立">中立</option>
            </select>
            <input type="number" min={1} max={5} value={e.significance} onChange={(ev) => update(i, { significance: parseInt(ev.target.value) || 3 })}
              className="w-16 rounded-md border border-border/40 bg-background px-2 py-1 text-xs text-center" title="重要性(1-5)" />
            <button type="button" onClick={() => onChange(entries.filter((_, j) => j !== i))}
              className="text-muted-foreground/40 hover:text-destructive"><X size={14} /></button>
          </div>
          <textarea value={e.description} onChange={(ev) => update(i, { description: ev.target.value })}
            className="w-full rounded-md border border-border/40 bg-background px-2 py-1 text-xs min-h-[60px]" placeholder="描述" />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...entries, { id: genId(), name: "", role: "配角", description: "", significance: 3 }])}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Plus size={12} /> 添加角色</button>
    </div>
  );
}

function RelationsEditor({ entries, allRoles, onChange }: {
  entries: WorldRelation[];
  allRoles: WorldRole[];
  onChange: (v: WorldRelation[]) => void;
}) {
  const update = (i: number, patch: Partial<WorldRelation>) => {
    const next = entries.map((e, idx) => idx === i ? { ...e, ...patch } : e);
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground/60 py-4 text-center">暂无关系定义。请先添加角色，再定义角色间的关系。</p>
      )}
      {entries.map((e, i) => (
        <div key={e.id} className="rounded-lg border border-border/40 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <select value={e.sourceId} onChange={(ev) => update(i, { sourceId: ev.target.value })}
              className="flex-1 rounded-md border border-border/40 bg-background px-2 py-1 text-sm">
              <option value="">选择源角色</option>
              {allRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <span className="text-xs text-muted-foreground/60">→</span>
            <select value={e.targetId} onChange={(ev) => update(i, { targetId: ev.target.value })}
              className="flex-1 rounded-md border border-border/40 bg-background px-2 py-1 text-sm">
              <option value="">选择目标角色</option>
              {allRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button type="button" onClick={() => onChange(entries.filter((_, j) => j !== i))}
              className="text-muted-foreground/40 hover:text-destructive"><X size={14} /></button>
          </div>
          <div className="flex items-center gap-2">
            <input value={e.type} onChange={(ev) => update(i, { type: ev.target.value })}
              className="flex-1 rounded-md border border-border/40 bg-background px-2 py-1 text-sm" placeholder="关系类型（如：师徒、敌对）" />
          </div>
          <textarea value={e.description} onChange={(ev) => update(i, { description: ev.target.value })}
            className="w-full rounded-md border border-border/40 bg-background px-2 py-1 text-xs min-h-[60px]" placeholder="关系描述" />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...entries, { id: genId(), sourceId: "", targetId: "", type: "", description: "" }])}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Plus size={12} /> 添加关系</button>
    </div>
  );
}

function RegionsEditor({ entries, onChange }: {
  entries: WorldRegion[];
  onChange: (v: WorldRegion[]) => void;
}) {
  const update = (i: number, patch: Partial<WorldRegion>) => {
    const next = entries.map((e, idx) => idx === i ? { ...e, ...patch } : e);
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {entries.map((e, i) => (
        <div key={e.id} className="rounded-lg border border-border/40 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input value={e.name} onChange={(ev) => update(i, { name: ev.target.value })}
              className="flex-1 rounded-md border border-border/40 bg-background px-2 py-1 text-sm" placeholder="区域名" />
            <select value={e.type} onChange={(ev) => update(i, { type: ev.target.value as any })}
              className="rounded-md border border-border/40 bg-background px-2 py-1 text-sm">
              <option value="大陆">大陆</option><option value="国家">国家</option><option value="城市">城市</option><option value="地点">地点</option>
            </select>
            <select value={e.parentId ?? ""} onChange={(ev) => update(i, { parentId: ev.target.value || null })}
              className="rounded-md border border-border/40 bg-background px-2 py-1 text-sm">
              <option value="">无父区域</option>
              {entries.filter((r) => r.id !== e.id).map((r) => <option key={r.id} value={r.id}>{r.name || "(未命名)"}</option>)}
            </select>
            <button type="button" onClick={() => onChange(entries.filter((_, j) => j !== i))}
              className="text-muted-foreground/40 hover:text-destructive"><X size={14} /></button>
          </div>
          <textarea value={e.description} onChange={(ev) => update(i, { description: ev.target.value })}
            className="w-full rounded-md border border-border/40 bg-background px-2 py-1 text-xs min-h-[60px]" placeholder="区域描述" />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...entries, { id: genId(), name: "", type: "地点", parentId: null, description: "" }])}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Plus size={12} /> 添加区域</button>
    </div>
  );
}

function InstitutionsEditor({ entries, allRoles, onChange }: {
  entries: WorldInstitution[];
  allRoles: WorldRole[];
  onChange: (v: WorldInstitution[]) => void;
}) {
  const update = (i: number, patch: Partial<WorldInstitution>) => {
    const next = entries.map((e, idx) => idx === i ? { ...e, ...patch } : e);
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {entries.map((e, i) => (
        <div key={e.id} className="rounded-lg border border-border/40 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input value={e.name} onChange={(ev) => update(i, { name: ev.target.value })}
              className="flex-1 rounded-md border border-border/40 bg-background px-2 py-1 text-sm" placeholder="组织名" />
            <select value={e.type} onChange={(ev) => update(i, { type: ev.target.value as any })}
              className="rounded-md border border-border/40 bg-background px-2 py-1 text-sm">
              <option value="宗门">宗门</option><option value="国家">国家</option><option value="组织">组织</option><option value="家族">家族</option>
            </select>
            <button type="button" onClick={() => onChange(entries.filter((_, j) => j !== i))}
              className="text-muted-foreground/40 hover:text-destructive"><X size={14} /></button>
          </div>
          <div className="flex items-center gap-2">
            <select value={e.leaderId ?? ""} onChange={(ev) => update(i, { leaderId: ev.target.value || null })}
              className="flex-1 rounded-md border border-border/40 bg-background px-2 py-1 text-sm">
              <option value="">选择领袖</option>
              {allRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <span className="text-xs text-muted-foreground/60 shrink-0">成员: {e.members.length}</span>
          </div>
          <textarea value={e.description} onChange={(ev) => update(i, { description: ev.target.value })}
            className="w-full rounded-md border border-border/40 bg-background px-2 py-1 text-xs min-h-[60px]" placeholder="描述" />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...entries, { id: genId(), name: "", type: "组织", leaderId: null, members: [], description: "" }])}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Plus size={12} /> 添加组织</button>
    </div>
  );
}

function HistoryEditor({ entries, onChange }: {
  entries: WorldHistoryEvent[];
  onChange: (v: WorldHistoryEvent[]) => void;
}) {
  const update = (i: number, patch: Partial<WorldHistoryEvent>) => {
    const next = entries.map((e, idx) => idx === i ? { ...e, ...patch } : e);
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {entries.map((e, i) => (
        <div key={e.id} className="rounded-lg border border-border/40 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input value={e.title} onChange={(ev) => update(i, { title: ev.target.value })}
              className="flex-1 rounded-md border border-border/40 bg-background px-2 py-1 text-sm" placeholder="事件标题" />
            <input value={e.timestamp} onChange={(ev) => update(i, { timestamp: ev.target.value })}
              className="w-28 rounded-md border border-border/40 bg-background px-2 py-1 text-sm" placeholder="时间" />
            <input type="number" min={1} max={5} value={e.significance} onChange={(ev) => update(i, { significance: parseInt(ev.target.value) || 3 })}
              className="w-16 rounded-md border border-border/40 bg-background px-2 py-1 text-xs text-center" title="重要性(1-5)" />
            <button type="button" onClick={() => onChange(entries.filter((_, j) => j !== i))}
              className="text-muted-foreground/40 hover:text-destructive"><X size={14} /></button>
          </div>
          <textarea value={e.description} onChange={(ev) => update(i, { description: ev.target.value })}
            className="w-full rounded-md border border-border/40 bg-background px-2 py-1 text-xs min-h-[60px]" placeholder="事件描述" />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...entries, { id: genId(), title: "", timestamp: "", description: "", affectedRegions: [], significance: 3 }])}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Plus size={12} /> 添加历史事件</button>
    </div>
  );
}

function RulesEditor({ entries, onChange }: {
  entries: WorldRule[];
  onChange: (v: WorldRule[]) => void;
}) {
  const update = (i: number, patch: Partial<WorldRule>) => {
    const next = entries.map((e, idx) => idx === i ? { ...e, ...patch } : e);
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {entries.map((e, i) => (
        <div key={e.id} className="rounded-lg border border-border/40 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input value={e.name} onChange={(ev) => update(i, { name: ev.target.value })}
              className="flex-1 rounded-md border border-border/40 bg-background px-2 py-1 text-sm" placeholder="规则名" />
            <select value={e.type} onChange={(ev) => update(i, { type: ev.target.value as any })}
              className="rounded-md border border-border/40 bg-background px-2 py-1 text-sm">
              <option value="物理">物理</option><option value="魔法">魔法</option><option value="社会">社会</option><option value="叙事">叙事</option>
            </select>
            <button type="button" onClick={() => onChange(entries.filter((_, j) => j !== i))}
              className="text-muted-foreground/40 hover:text-destructive"><X size={14} /></button>
          </div>
          <textarea value={e.description} onChange={(ev) => update(i, { description: ev.target.value })}
            className="w-full rounded-md border border-border/40 bg-background px-2 py-1 text-xs min-h-[60px]" placeholder="规则描述" />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...entries, { id: genId(), name: "", type: "叙事", description: "", constraints: [] }])}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Plus size={12} /> 添加规则</button>
    </div>
  );
}

// ── Read-only dimension display ──

function ReadonlyDimension({ dimension, entries, allRoles }: {
  dimension: string;
  entries: unknown[];
  allRoles: WorldRole[];
}) {
  const meta = DIMENSION_META[dimension];
  if (!entries || entries.length === 0) {
    return <p className="text-xs text-muted-foreground/50 py-8 text-center italic">暂无{meta?.label ?? dimension}数据</p>;
  }

  if (dimension === "settings") {
    const items = entries as WorldSettingEntry[];
    return <div className="space-y-2">{
      items.map((e) => (
        <div key={e.id} className="rounded-lg border border-border/40 p-3">
          <div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{e.name}</span><span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{e.type}</span></div>
          <p className="text-xs text-muted-foreground">{e.description || "无描述"}</p>
        </div>
      ))
    }</div>;
  }

  if (dimension === "roles") {
    const items = entries as WorldRole[];
    return <div className="space-y-2">{
      items.map((e) => (
        <div key={e.id} className="rounded-lg border border-border/40 p-3">
          <div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{e.name}</span><span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{e.role}</span><span className="text-[10px] text-muted-foreground/60">重要性: {e.significance}/5</span></div>
          <p className="text-xs text-muted-foreground">{e.description || "无描述"}</p>
        </div>
      ))
    }</div>;
  }

  if (dimension === "relations") {
    const roleMap = new Map(allRoles.map((r) => [r.id, r.name]));
    const items = entries as WorldRelation[];
    return <div className="space-y-2">{
      items.map((e) => (
        <div key={e.id} className="rounded-lg border border-border/40 p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{roleMap.get(e.sourceId) || e.sourceId}</span>
            <span className="text-[10px] text-muted-foreground/60">→ {e.type || "关联"} →</span>
            <span className="font-medium text-sm">{roleMap.get(e.targetId) || e.targetId}</span>
          </div>
          <p className="text-xs text-muted-foreground">{e.description || "无描述"}</p>
        </div>
      ))
    }</div>;
  }

  if (dimension === "regions") {
    const regionMap = new Map((entries as WorldRegion[]).map((r) => [r.id, r.name]));
    const items = entries as WorldRegion[];
    return <div className="space-y-2">{
      items.map((e) => (
        <div key={e.id} className="rounded-lg border border-border/40 p-3">
          <div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{e.name}</span><span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{e.type}</span>{e.parentId && <span className="text-[10px] text-muted-foreground/60">属于: {regionMap.get(e.parentId) || "?"}</span>}</div>
          <p className="text-xs text-muted-foreground">{e.description || "无描述"}</p>
        </div>
      ))
    }</div>;
  }

  if (dimension === "institutions") {
    const roleMap = new Map(allRoles.map((r) => [r.id, r.name]));
    const items = entries as WorldInstitution[];
    return <div className="space-y-2">{
      items.map((e) => (
        <div key={e.id} className="rounded-lg border border-border/40 p-3">
          <div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{e.name}</span><span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{e.type}</span>{e.leaderId && <span className="text-[10px] text-muted-foreground/60">领袖: {roleMap.get(e.leaderId) || "?"}</span>}</div>
          <p className="text-xs text-muted-foreground">{e.description || "无描述"}</p>
        </div>
      ))
    }</div>;
  }

  if (dimension === "history") {
    const items = entries as WorldHistoryEvent[];
    return <div className="space-y-2">{
      items.map((e) => (
        <div key={e.id} className="rounded-lg border border-border/40 p-3">
          <div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{e.title}</span><span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">时间: {e.timestamp}</span><span className="text-[10px] text-muted-foreground/60">重要性: {e.significance}/5</span></div>
          <p className="text-xs text-muted-foreground">{e.description || "无描述"}</p>
        </div>
      ))
    }</div>;
  }

  // rules
  const items = entries as WorldRule[];
  return <div className="space-y-2">{
    items.map((e) => (
      <div key={e.id} className="rounded-lg border border-border/40 p-3">
        <div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{e.name}</span><span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{e.type}</span></div>
        <p className="text-xs text-muted-foreground">{e.description || "无描述"}</p>
      </div>
    ))
  }</div>;
}

// ── Create Book Dialog (Issue #83) ──

function CreateBookDialog({ world, onClose, nav }: {
  world: WorldDraft;
  onClose: () => void;
  nav?: { toBook: (bookId: string) => void };
}) {
  const [bookTitle, setBookTitle] = useState(world.name || "新小说");
  const [mode, setMode] = useState<"full" | "projection">("full");
  const [selectedDimensions, setSelectedDimensions] = useState<Set<string>>(new Set(WORLD_DIMENSION_KEYS));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDimension = (key: string) => {
    setSelectedDimensions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const platform = "qidian";
      const genre = "xuanhuan";
      const bookId = `book-${Date.now()}`;
      const now = new Date().toISOString();

      // Create the book
      const bookBody = {
        id: bookId,
        title: bookTitle,
        platform,
        genre,
        status: "incubating",
        targetChapters: 200,
        chapterWordCount: 3000,
        createdAt: now,
        updatedAt: now,
        worldId: world.name ? bookId.replace("book-", "world-") : undefined,
      };

      await postApi(`/books/${encodeURIComponent(bookId)}`, bookBody);

      // If full mode or projection mode with selected dimensions, save world context
      if (mode === "full" || selectedDimensions.size > 0) {
        const dims = mode === "full" ? WORLD_DIMENSION_KEYS : Array.from(selectedDimensions);
        const contextData: Record<string, unknown> = {};
        for (const key of dims) {
          contextData[key] = (world as Record<string, unknown>)[key] ?? [];
        }
        // Save the world dimensions to book's context
        await postApi(`/books/${encodeURIComponent(bookId)}/writing`, {
          worldContext: contextData,
        });
      }

      onClose();
      if (nav?.toBook) nav.toBook(bookId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border/60 shadow-xl p-6 w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">从世界创建小说</h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">小说名称</label>
            <input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)}
              className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm" placeholder="输入小说名称" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-2">继承模式</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setMode("full")}
                className={cn("flex-1 rounded-lg border p-3 text-left transition-all",
                  mode === "full" ? "border-primary bg-primary/5" : "border-border/40 hover:border-border")}>
                <span className="text-sm font-medium">全部继承</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">继承全部 7 维度数据</p>
              </button>
              <button type="button" onClick={() => setMode("projection")}
                className={cn("flex-1 rounded-lg border p-3 text-left transition-all",
                  mode === "projection" ? "border-primary bg-primary/5" : "border-border/40 hover:border-border")}>
                <span className="text-sm font-medium">投影模式</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">选择部分维度继承</p>
              </button>
            </div>
          </div>

          {mode === "projection" && (
            <div>
              <label className="text-xs text-muted-foreground block mb-2">选择要继承的维度</label>
              <div className="flex flex-wrap gap-2">
                {WORLD_DIMENSION_KEYS.map((key) => (
                  <button key={key} type="button" onClick={() => toggleDimension(key)}
                    className={cn("px-3 py-1.5 rounded-lg border text-xs transition-all",
                      selectedDimensions.has(key)
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border/40 text-muted-foreground hover:border-border")}>
                    {DIMENSION_META[key]?.label ?? key}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">取消</button>
            <button type="button" onClick={handleCreate} disabled={creating || !bookTitle.trim()}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-30">
              {creating ? "创建中…" : "创建小说"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──

export function WorldDetailPage({ worldId, nav }: WorldDetailProps) {
  const isCreateMode = !worldId;
  const { data, loading, error, refetch } = useApi<{ world: WorldConfig } | undefined>(
    isCreateMode ? undefined : `/api/worlds/${encodeURIComponent(worldId)}`
  );

  const [draft, setDraft] = useState<WorldDraft>(emptyDraft);
  const [activeTab, setActiveTab] = useState<string>(WORLD_DIMENSION_KEYS[0]);
  const [isEditing, setIsEditing] = useState(isCreateMode);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showCreateBook, setShowCreateBook] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Initialize draft from loaded data
  useEffect(() => {
    if (data?.world && !isCreateMode) {
      setDraft(worldToDraft(data.world));
    }
  }, [data, isCreateMode]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if (isCreateMode) {
        const now = new Date().toISOString();
        const worldId = draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || `world-${Date.now()}`;
        const fullWorld: WorldConfig = {
          id: worldId,
          name: draft.name,
          description: draft.description,
          createdAt: now,
          updatedAt: now,
          settings: draft.settings,
          roles: draft.roles,
          relations: draft.relations,
          regions: draft.regions,
          institutions: draft.institutions,
          history: draft.history,
          rules: draft.rules,
        };
        await fetchJson("/api/worlds", {
          method: "POST",
          body: JSON.stringify(fullWorld),
        });
        if (nav?.toWorlds) nav.toWorlds();
      } else {
        const update: WorldConfigUpdate = {
          name: draft.name,
          description: draft.description,
          settings: draft.settings,
          roles: draft.roles,
          relations: draft.relations,
          regions: draft.regions,
          institutions: draft.institutions,
          history: draft.history,
          rules: draft.rules,
        };
        await fetchJson(`/api/worlds/${encodeURIComponent(worldId!)}`, {
          method: "PUT",
          body: JSON.stringify(update),
        });
        setIsEditing(false);
        await refetch();
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [draft, isCreateMode, worldId, nav, refetch]);

  const handleDelete = useCallback(async () => {
    if (!worldId) return;
    try {
      await fetchJson(`/api/worlds/${encodeURIComponent(worldId)}`, { method: "DELETE" });
      if (nav?.toWorlds) nav.toWorlds();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "删除失败");
    }
  }, [worldId, nav]);

  // ── Loading / Error states ──

  if (!isCreateMode && loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-4 w-64 bg-muted rounded" />
        <div className="flex gap-2"><div className="h-8 w-20 bg-muted rounded" /><div className="h-8 w-20 bg-muted rounded" /></div>
      </div>
    );
  }

  if (!isCreateMode && error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        加载失败：{error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => { if (nav?.toWorlds) nav.toWorlds(); else window.location.hash = "#/worlds"; }}
            className="text-muted-foreground/60 hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-serif font-semibold text-foreground">
              {isCreateMode ? "新建世界" : draft.name || "未命名世界"}
            </h1>
            {!isCreateMode && draft.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{draft.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isCreateMode && (
            <>
              <button type="button" onClick={() => setShowCreateBook(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors">
                <BookPlus size={14} />
                从该世界创建小说
              </button>
              {!isEditing ? (
                <button type="button" onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity">
                  编辑
                </button>
              ) : null}
              <button type="button" onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/5 transition-colors">
                <Trash2 size={14} />
                删除
              </button>
            </>
          )}
        </div>
      </div>

      {/* Save error */}
      {saveError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {saveError}
        </div>
      )}

      {/* Create Mode: Basic Info */}
      {isEditing && (
        <div className="space-y-3 rounded-xl border border-border/40 bg-card p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground block mb-1">世界名称</label>
              <input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm" placeholder="输入世界名称" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">描述</label>
            <textarea value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm min-h-[60px]" placeholder="简短的总体描述" />
          </div>
        </div>
      )}

      {/* View Mode: Basic Info */}
      {!isEditing && !isCreateMode && (
        <div className="rounded-xl border border-border/40 bg-card p-4">
          <p className="text-sm text-muted-foreground">{draft.description || "无描述"}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border/40 pb-2">
        {WORLD_DIMENSION_KEYS.map((key) => {
          const meta = DIMENSION_META[key];
          const count = Array.isArray((draft as Record<string, unknown>)[key])
            ? ((draft as Record<string, unknown[]>)[key]?.length ?? 0) : 0;
          return (
            <button key={key} type="button" onClick={() => setActiveTab(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs transition-all",
                activeTab === key
                  ? "bg-card text-foreground font-medium border border-b-0 border-border/40 -mb-[2px]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
              style={activeTab === key ? { borderBottomColor: "var(--card)", color: meta?.color } : {}}
            >
              {meta?.label ?? key}
              <span className="text-[10px] text-muted-foreground/50">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {/* GeoViz button for regions tab (view & edit mode) */}
        {activeTab === "regions" && !isCreateMode && worldId && draft.regions.length > 0 && (
          <div className="flex items-center justify-end mb-3">
            <button
              type="button"
              onClick={() => { if (nav?.toWorldGeoViz) nav.toWorldGeoViz(worldId); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
            >
              <Globe size={14} />
              地理可视化
            </button>
          </div>
        )}
        {isEditing ? (
          <>
            {activeTab === "settings" && <SettingsEditor entries={draft.settings} onChange={(v) => setDraft((prev) => ({ ...prev, settings: v }))} />}
            {activeTab === "roles" && <RolesEditor entries={draft.roles} onChange={(v) => setDraft((prev) => ({ ...prev, roles: v }))} />}
            {activeTab === "relations" && <RelationsEditor entries={draft.relations} allRoles={draft.roles} onChange={(v) => setDraft((prev) => ({ ...prev, relations: v }))} />}
            {activeTab === "regions" && <RegionsEditor entries={draft.regions} onChange={(v) => setDraft((prev) => ({ ...prev, regions: v }))} />}
            {activeTab === "institutions" && <InstitutionsEditor entries={draft.institutions} allRoles={draft.roles} onChange={(v) => setDraft((prev) => ({ ...prev, institutions: v }))} />}
            {activeTab === "history" && <HistoryEditor entries={draft.history} onChange={(v) => setDraft((prev) => ({ ...prev, history: v }))} />}
            {activeTab === "rules" && <RulesEditor entries={draft.rules} onChange={(v) => setDraft((prev) => ({ ...prev, rules: v }))} />}
          </>
        ) : (
          <ReadonlyDimension dimension={activeTab}
            entries={(draft as Record<string, unknown[]>)[activeTab] ?? []}
            allRoles={draft.roles} />
        )}
      </div>

      {/* Save/Cancel (edit mode) */}
      {isEditing && (
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/40">
          {!isCreateMode && (
            <button type="button" onClick={() => { setIsEditing(false); if (data?.world) setDraft(worldToDraft(data.world)); }}
              className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
              取消
            </button>
          )}
          <button type="button" onClick={handleSave} disabled={saving || !draft.name.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-30">
            <Save size={14} />
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-card rounded-xl border border-border/60 shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-2">确认删除</h3>
            <p className="text-sm text-muted-foreground mb-4">确定要删除"{draft.name}"吗？此操作不可撤销。</p>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">取消</button>
              <button type="button" onClick={handleDelete}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-destructive text-destructive-foreground hover:opacity-90">确认删除</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Book Dialog (#83) */}
      {showCreateBook && (
        <CreateBookDialog world={draft} onClose={() => setShowCreateBook(false)} nav={nav} />
      )}
    </div>
  );
}
