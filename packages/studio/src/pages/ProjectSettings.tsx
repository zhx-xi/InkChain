import { useEffect, useState } from "react";
import { Bell, Bot, Radar, Settings2, Plus, Trash2, Info, BookOpen, Users, Globe, Download } from "lucide-react";
import { fetchJson, postApi, putApi, useApi } from "../hooks/use-api";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import {
  buildDetectionConfig,
  buildNotifyChannel,
  DEFAULT_DETECTION,
  detectionDraftFromConfig,
  notifyDraftFromChannel,
  NOTIFY_TYPES,
  type DetectionDraft,
  type NotifyChannelDraft,
  type NotifyType,
  type OverrideRow,
} from "./project-settings-model";
import {
  createEmptySkillDraft,
  skillDraftFromSkill,
  skillDraftToPayload,
  type SkillDraft,
  type StudioSkill,
} from "./skill-ui-state";

interface Nav {
  toDashboard: () => void;
  toServices: () => void;
}

type NoticeTone = "success" | "error" | "info";

interface SkillsResponse {
  readonly skills: ReadonlyArray<StudioSkill>;
  readonly diagnostics?: ReadonlyArray<{ readonly path?: string; readonly message?: string }>;
}

type SettingsSection = "project-info" | "chapters" | "characters" | "worldview" | "agent" | "export";

interface SidebarItem {
  key: SettingsSection;
  icon: React.ReactNode;
  label: string;
}

interface AgentCardInfo {
  label: string;
  initials: string;
  avatarClass: string;
  persona: string;
}

const AGENT_CARD_INFO: Record<string, AgentCardInfo> = {
  writer:     { label: "Writer",     initials: "WR", avatarClass: "bg-[#8B3A3A]",     persona: "Persona: 热血战斗流" },
  editor:     { label: "Editor",     initials: "ED", avatarClass: "bg-[#6B8BAA]",     persona: "Persona: 古文修辞润色" },
  architect:  { label: "Architect",  initials: "AR", avatarClass: "bg-[#D4A855]",     persona: "Persona: 玄幻世界观" },
  planner:    { label: "Planner",    initials: "PL", avatarClass: "bg-[#5D8A5D]",     persona: "Persona: 节拍规划" },
  reviewer:   { label: "Reviewer",   initials: "RV", avatarClass: "bg-[#A09888]",     persona: "Persona: 一致性检查" },
  observer:   { label: "Observer",   initials: "OB", avatarClass: "bg-[#7A6A5A]",     persona: "Persona: 节奏监控" },
  reviser:    { label: "Reviser",    initials: "RE", avatarClass: "bg-[#723030]",     persona: "Persona: 文风统一" },
  auditor:    { label: "Auditor",    initials: "AU", avatarClass: "bg-[#6B8BAA]",     persona: "Persona: 质量审核" },
};

// Smooth open/close via grid-template-rows (same trick as the sidebar).
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

function SettingsCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary">{icon}</div>
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

const fieldClass = "w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm outline-none focus:border-primary/50";

export function ProjectSettings({ nav, theme, t }: { nav: Nav; theme: Theme; t: TFunction }) {
  const c = useColors(theme);
  const isZh = t("nav.connected") === "\u5DF2\u8FDE\u63A5";
  const { data: overridesData, refetch: refetchOverrides } = useApi<{ overrides: Record<string, unknown> }>("/project/model-overrides");
  const { data: defaultModelData, refetch: refetchDefaultModel } = useApi<{ service: string | null; defaultModel: string | null }>("/project/default-model");
  const { data: notifyData, refetch: refetchNotify } = useApi<{ channels: unknown[] }>("/project/notify");
  const { data: modeData, refetch: refetchMode } = useApi<{ mode: "legacy" | "v2" }>("/project/input-governance-mode");
  const { data: detectionData, refetch: refetchDetection } = useApi<{ detection: unknown | null }>("/project/detection");
  const { data: skillsData, refetch: refetchSkills } = useApi<SkillsResponse>("/skills");
  const [mode, setMode] = useState<"legacy" | "v2">("v2");
  const [defaultService, setDefaultService] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [overrideRows, setOverrideRows] = useState<OverrideRow[]>([]);
  const [notifyChannels, setNotifyChannels] = useState<NotifyChannelDraft[]>([]);
  const [det, setDet] = useState<DetectionDraft>({ ...DEFAULT_DETECTION });
  const [skillDraft, setSkillDraft] = useState<SkillDraft>(() => createEmptySkillDraft());
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>("agent");
  const [agentTeamAgents, setAgentTeamAgents] = useState<Array<{ role: string; enabled: boolean }>>(
    ["writer", "architect", "planner", "editor", "auditor", "observer", "reviser"].map((r) => ({ role: r, enabled: true })),
  );
  const [agentTeamDefaultModel, setAgentTeamDefaultModel] = useState("");
  const [agentTeamCollabMode, setAgentTeamCollabMode] = useState<"sequential" | "parallel" | "hybrid">("sequential");
  const skills = skillsData?.skills ?? [];

  useEffect(() => {
    if (modeData?.mode) setMode(modeData.mode);
  }, [modeData]);

  useEffect(() => {
    if (!overridesData) return;
    setOverrideRows(Object.entries(overridesData.overrides ?? {}).map(([agent, val]) => {
      if (typeof val === "string") return { agent, model: val };
      const { model, ...rest } = (val ?? {}) as { model?: string };
      return { agent, model: model ?? "", rest };
    }));
  }, [overridesData]);

  useEffect(() => {
    if (!defaultModelData) return;
    setDefaultService(defaultModelData.service ?? "");
    setDefaultModel(defaultModelData.defaultModel ?? "");
  }, [defaultModelData]);

  useEffect(() => {
    if (!notifyData) return;
    setNotifyChannels((notifyData.channels ?? []).map(notifyDraftFromChannel));
  }, [notifyData]);

  useEffect(() => {
    if (!detectionData) return;
    setDet(detectionDraftFromConfig(detectionData.detection));
  }, [detectionData]);

  useEffect(() => {
    fetchJson<{ config: { agents: Array<{ role: string; enabled: boolean }>; defaultModel?: string; collaborationMode?: "sequential" | "parallel" | "hybrid" } }>("/project/agent-team")
      .then((data) => {
        const config = data.config;
        if (config.agents && config.agents.length > 0) {
          setAgentTeamAgents(config.agents.map((a) => ({ role: a.role, enabled: a.enabled !== false })));
        }
        if (config.defaultModel) setAgentTeamDefaultModel(config.defaultModel);
        if (config.collaborationMode) setAgentTeamCollabMode(config.collaborationMode);
      })
      .catch(() => {
        // Fall back to defaults if no config exists
      });
  }, []);

  const runSave = async (key: string, work: () => Promise<void>, success: string) => {
    setSaving(key);
    setNotice(null);
    try {
      await work();
      setNotice({ tone: "success", message: success });
    } catch (e) {
      setNotice({ tone: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(null);
    }
  };

  const updateChannel = (index: number, patch: Partial<NotifyChannelDraft>) => {
    setNotifyChannels((prev) => prev.map((ch, i) => (i === index ? { ...ch, ...patch } : ch)));
  };

  const sidebarSections: SidebarItem[] = [
    { key: "project-info", icon: <Info size={16} />, label: isZh ? "项目信息" : "Project Info" },
    { key: "chapters",     icon: <BookOpen size={16} />, label: isZh ? "章节管理" : "Chapters" },
    { key: "characters",   icon: <Users size={16} />, label: isZh ? "角色" : "Characters" },
    { key: "worldview",    icon: <Globe size={16} />, label: isZh ? "世界观" : "Worldview" },
    { key: "agent",        icon: <Bot size={16} />, label: isZh ? "Agent 配置" : "Agent Config" },
    { key: "export",       icon: <Download size={16} />, label: isZh ? "导出" : "Export" },
  ];

  return (
    <div className="flex flex-col min-h-0">
      {/* Breadcrumb + page header */}
      <div className="flex-shrink-0 space-y-2 pb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={nav.toDashboard} className={c.link}>{t("bread.home")}</button>
          <span className="text-border">/</span>
          <span>{t("settings.title")}</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-3xl flex items-center gap-3">
            <Settings2 size={28} className="text-primary" />
            {t("settings.title")}
          </h1>
        </div>
      </div>

      {notice && (
        <div
          className={`flex-shrink-0 rounded-xl px-4 py-3 text-sm mb-4 ${
            notice.tone === "error"
              ? "bg-destructive/10 text-destructive"
              : notice.tone === "info"
                ? "bg-secondary text-muted-foreground"
                : "bg-emerald-500/10 text-emerald-600"
          }`}
        >
          {notice.message}
        </div>
      )}

      <div className="flex flex-1 gap-0 min-h-0">
        {/* Sidebar */}
        <nav
          className="w-[236px] flex-shrink-0 bg-white border-r border-[#E8E0D8] overflow-y-auto"
          aria-label={isZh ? "项目设置导航" : "Project settings navigation"}
        >
          <div className="px-5 pt-2 pb-1">
            <div className="text-[0.65rem] font-semibold uppercase tracking-widest text-[#A09888]">
              {isZh ? "项目设置" : "Settings"}
            </div>
          </div>
          {sidebarSections.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={`w-full flex items-center gap-2.5 px-5 py-2 text-sm text-left transition-all duration-150 border-l-3 ${
                activeSection === item.key
                  ? "bg-[#F5E0E0] text-[#8B3A3A] border-l-[#8B3A3A] font-medium"
                  : "text-[#7A6A5A] border-l-transparent hover:bg-[#F5E0E0] hover:text-[#2C1810]"
              }`}
            >
              <span className="w-5 flex-shrink-0 flex justify-center">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto px-6 py-2 space-y-6">
          {activeSection === "project-info" && (
            <>
              <div className="space-y-1 mb-6">
                <h2 className="font-serif text-xl italic text-[#2C1810] font-semibold">
                  {isZh ? "项目信息" : "Project Info"}
                </h2>
                <p className="text-sm text-[#7A6A5A]">
                  {isZh ? "管理项目的基本设置和运行配置。" : "Manage basic project settings and runtime configuration."}
                </p>
              </div>

              <SettingsCard title={t("settings.inputGovernance")} description={t("settings.inputGovernanceHint")} icon={<Radar size={18} />}>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value === "legacy" ? "legacy" : "v2")}
                    className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm outline-none"
                  >
                    <option value="v2">v2</option>
                    <option value="legacy">legacy</option>
                  </select>
                  <button
                    onClick={() => runSave("mode", async () => {
                      await putApi("/project/input-governance-mode", { mode });
                      await refetchMode();
                    }, t("settings.saved"))}
                    disabled={saving === "mode"}
                    className={`rounded-lg px-4 py-2 text-sm font-bold ${c.btnPrimary} disabled:opacity-40`}
                  >
                    {saving === "mode" ? t("config.saving") : t("config.save")}
                  </button>
                </div>
              </SettingsCard>

              <SettingsCard
                title={isZh ? "运行时 Skill" : "Runtime skills"}
                description={isZh ? "把可复用的专业能力保存到项目，Chat 可以自主使用，也可以在输入框用 + 号强制启用。" : "Save reusable expertise in the project. Chat can choose skills automatically, or you can force one from the + menu."}
                icon={<Bot size={18} />}
              >
                <div className="space-y-3">
                  {skills.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">{isZh ? "还没有 Skill。" : "No skills yet."}</p>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      {skills.map((skill) => (
                        <div key={skill.id} className="rounded-xl border border-border/60 bg-secondary/20 p-3">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="truncate text-sm font-semibold">{skill.name}</div>
                                <span className="rounded-full bg-background px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                  {skill.source ?? "skill"}
                                </span>
                              </div>
                              <div className="mt-0.5 font-mono text-[11px] text-muted-foreground/70">@{skill.id}</div>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">{skill.whenToUse || skill.description || (isZh ? "无说明" : "No description")}</p>
                            </div>
                            {skill.editable ? (
                              <div className="flex shrink-0 gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSkillId(skill.id);
                                    setSkillDraft(skillDraftFromSkill(skill));
                                  }}
                                  className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                >
                                  {isZh ? "编辑" : "Edit"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => runSave(`delete-skill:${skill.id}`, async () => {
                                    await fetchJson(`/skills/${encodeURIComponent(skill.id)}`, { method: "DELETE" });
                                    if (editingSkillId === skill.id) {
                                      setEditingSkillId(null);
                                      setSkillDraft(createEmptySkillDraft());
                                    }
                                    await refetchSkills();
                                  }, isZh ? "Skill 已删除" : "Skill deleted")}
                                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                  aria-label={isZh ? `删除 ${skill.name}` : `Delete ${skill.name}`}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="rounded-xl border border-border/60 bg-secondary/20 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">
                          {editingSkillId ? (isZh ? "编辑项目 Skill" : "Edit project skill") : (isZh ? "新增项目 Skill" : "Add project skill")}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isZh ? "这些文件会保存到 .inkos/skills/<id>/SKILL.md。" : "Saved to .inkos/skills/<id>/SKILL.md."}
                        </p>
                      </div>
                      {editingSkillId ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSkillId(null);
                            setSkillDraft(createEmptySkillDraft());
                          }}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                        >
                          {isZh ? "取消编辑" : "Cancel"}
                        </button>
                      ) : null}
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <input
                        value={skillDraft.id}
                        onChange={(e) => setSkillDraft((draft) => ({ ...draft, id: e.target.value }))}
                        disabled={Boolean(editingSkillId)}
                        placeholder="skill-id"
                        className={`${fieldClass} font-mono disabled:opacity-50`}
                      />
                      <input
                        value={skillDraft.name}
                        onChange={(e) => setSkillDraft((draft) => ({ ...draft, name: e.target.value }))}
                        placeholder={isZh ? "Skill 名称" : "Skill name"}
                        className={fieldClass}
                      />
                      <input
                        value={skillDraft.whenToUse}
                        onChange={(e) => setSkillDraft((draft) => ({ ...draft, whenToUse: e.target.value }))}
                        placeholder={isZh ? "什么时候使用" : "When to use"}
                        className={`${fieldClass} md:col-span-2`}
                      />
                      <input
                        value={skillDraft.triggers}
                        onChange={(e) => setSkillDraft((draft) => ({ ...draft, triggers: e.target.value }))}
                        placeholder={isZh ? "触发词，用逗号分隔" : "Triggers, comma separated"}
                        className={fieldClass}
                      />
                      <input
                        value={skillDraft.sessionKinds}
                        onChange={(e) => setSkillDraft((draft) => ({ ...draft, sessionKinds: e.target.value }))}
                        placeholder="chat,book,short,play"
                        className={fieldClass}
                      />
                      <textarea
                        value={skillDraft.body}
                        onChange={(e) => setSkillDraft((draft) => ({ ...draft, body: e.target.value }))}
                        placeholder={isZh ? "写给模型的专业能力说明..." : "Instructions for the model..."}
                        rows={5}
                        className={`${fieldClass} leading-6 md:col-span-2`}
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => runSave("skill", async () => {
                          const payload = skillDraftToPayload(skillDraft, !editingSkillId);
                          if (editingSkillId) {
                            await putApi(`/skills/${encodeURIComponent(editingSkillId)}`, payload);
                          } else {
                            await postApi("/skills", payload);
                          }
                          await refetchSkills();
                          setEditingSkillId(null);
                          setSkillDraft(createEmptySkillDraft());
                        }, isZh ? "Skill 已保存" : "Skill saved")}
                        disabled={saving === "skill" || !skillDraft.body.trim() || !skillDraftToPayload(skillDraft).id}
                        className={`rounded-lg px-4 py-2 text-sm font-bold ${c.btnPrimary} disabled:opacity-40`}
                      >
                        {saving === "skill" ? t("config.saving") : t("config.save")}
                      </button>
                    </div>
                  </div>
                </div>
              </SettingsCard>

              {/* Model routing — per-agent model overrides */}
              <SettingsCard title={t("settings.modelOverrides")} description={t("settings.modelOverridesHint")} icon={<Bot size={18} />}>
                <div className="rounded-xl border border-border/60 bg-secondary/20 p-3 space-y-2">
                  <div>
                    <div className="text-sm font-semibold">{t("settings.globalDefaultModel")}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{t("settings.globalDefaultModelHint")}</p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]">
                    <input
                      value={defaultService}
                      onChange={(e) => setDefaultService(e.target.value)}
                      placeholder={t("settings.serviceId")}
                      className={`${fieldClass} font-mono`}
                    />
                    <input
                      value={defaultModel}
                      onChange={(e) => setDefaultModel(e.target.value)}
                      placeholder={t("settings.modelId")}
                      className={`${fieldClass} font-mono`}
                    />
                    <button
                      onClick={() => runSave("default-model", async () => {
                        await putApi("/project/default-model", {
                          service: defaultService.trim() || undefined,
                          defaultModel: defaultModel.trim(),
                        });
                        await refetchDefaultModel();
                      }, t("settings.saved"))}
                      disabled={saving === "default-model" || !defaultModel.trim()}
                      className={`rounded-lg px-4 py-2 text-sm font-bold ${c.btnPrimary} disabled:opacity-40`}
                    >
                      {saving === "default-model" ? t("config.saving") : t("config.save")}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {overrideRows.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">{t("settings.noOverrides")}</p>
                  )}
                  {overrideRows.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={row.agent}
                        onChange={(e) => setOverrideRows((prev) => prev.map((r, j) => (j === i ? { ...r, agent: e.target.value } : r)))}
                        placeholder={t("settings.agentName")}
                        className={`${fieldClass} flex-1`}
                      />
                      <span className="text-muted-foreground">→</span>
                      <input
                        value={row.model}
                        onChange={(e) => setOverrideRows((prev) => prev.map((r, j) => (j === i ? { ...r, model: e.target.value } : r)))}
                        placeholder={t("settings.modelId")}
                        className={`${fieldClass} flex-1 font-mono`}
                      />
                      <button
                        onClick={() => setOverrideRows((prev) => prev.filter((_, j) => j !== i))}
                        className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        aria-label="remove"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setOverrideRows((prev) => [...prev, { agent: "", model: "" }])}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${c.btnSecondary}`}
                  >
                    <Plus size={14} /> {t("settings.addOverride")}
                  </button>
                  <button
                    onClick={() => runSave("overrides", async () => {
                      const overrides: Record<string, unknown> = {};
                      for (const r of overrideRows) {
                        const agent = r.agent.trim();
                        const model = r.model.trim();
                        if (!agent || !model) continue;
                        overrides[agent] = r.rest && Object.keys(r.rest).length > 0 ? { ...r.rest, model } : model;
                      }
                      await putApi("/project/model-overrides", { overrides });
                      await refetchOverrides();
                    }, t("settings.saved"))}
                    disabled={saving === "overrides"}
                    className={`rounded-lg px-4 py-2 text-sm font-bold ${c.btnPrimary} disabled:opacity-40`}
                  >
                    {saving === "overrides" ? t("config.saving") : t("config.save")}
                  </button>
                  <button onClick={nav.toServices} className={`rounded-lg px-4 py-2 text-sm font-bold ${c.btnSecondary}`}>
                    {t("settings.openModelConfig")}
                  </button>
                </div>
              </SettingsCard>

              {/* Notification channels */}
              <SettingsCard title={t("settings.notify")} description={t("settings.notifyHint")} icon={<Bell size={18} />}>
                <div className="space-y-3">
                  {notifyChannels.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">{t("settings.noChannels")}</p>
                  )}
                  {notifyChannels.map((ch, i) => (
                    <div key={i} className="rounded-xl border border-border/60 bg-secondary/20 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={ch.type}
                          onChange={(e) => updateChannel(i, { type: e.target.value as NotifyType })}
                          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none"
                        >
                          {NOTIFY_TYPES.map((nt) => <option key={nt.value} value={nt.value}>{nt.label}</option>)}
                        </select>
                        <div className="flex-1" />
                        <button
                          onClick={() => setNotifyChannels((prev) => prev.filter((_, j) => j !== i))}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          aria-label="remove"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      {ch.type === "telegram" && (
                        <div className="grid grid-cols-2 gap-2">
                          <input value={ch.botToken ?? ""} onChange={(e) => updateChannel(i, { botToken: e.target.value })} placeholder="botToken" className={`${fieldClass} font-mono`} />
                          <input value={ch.chatId ?? ""} onChange={(e) => updateChannel(i, { chatId: e.target.value })} placeholder="chatId" className={`${fieldClass} font-mono`} />
                        </div>
                      )}
                      {(ch.type === "feishu" || ch.type === "wechat-work") && (
                        <input value={ch.webhookUrl ?? ""} onChange={(e) => updateChannel(i, { webhookUrl: e.target.value })} placeholder="webhookUrl" className={`${fieldClass} font-mono`} />
                      )}
                      {ch.type === "webhook" && (
                        <div className="grid grid-cols-2 gap-2">
                          <input value={ch.url ?? ""} onChange={(e) => updateChannel(i, { url: e.target.value })} placeholder="url" className={`${fieldClass} font-mono`} />
                          <input value={ch.secret ?? ""} onChange={(e) => updateChannel(i, { secret: e.target.value })} placeholder="secret (可选)" className={`${fieldClass} font-mono`} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNotifyChannels((prev) => [...prev, { type: "feishu" }])}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${c.btnSecondary}`}
                  >
                    <Plus size={14} /> {t("settings.addChannel")}
                  </button>
                  <button
                    onClick={() => runSave("notify", async () => {
                      await putApi("/project/notify", { channels: notifyChannels.map(buildNotifyChannel) });
                      await refetchNotify();
                    }, t("settings.saved"))}
                    disabled={saving === "notify"}
                    className={`rounded-lg px-4 py-2 text-sm font-bold ${c.btnPrimary} disabled:opacity-40`}
                  >
                    {saving === "notify" ? t("config.saving") : t("config.save")}
                  </button>
                </div>
              </SettingsCard>

              {/* AIGC detection */}
              <SettingsCard title={t("settings.detection")} description={t("settings.detectionHint")} icon={<Radar size={18} />}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={det.enabled} onChange={(e) => setDet((d) => ({ ...d, enabled: e.target.checked }))} />
                  {t("settings.detectionEnable")}
                </label>
                <Collapse open={det.enabled}>
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-muted-foreground space-y-1">
                        <span>{t("settings.detectionProvider")}</span>
                        <select value={det.provider} onChange={(e) => setDet((d) => ({ ...d, provider: e.target.value }))} className={fieldClass}>
                          <option value="custom">custom</option>
                          <option value="gptzero">gptzero</option>
                          <option value="originality">originality</option>
                        </select>
                      </label>
                      <label className="text-xs text-muted-foreground space-y-1">
                        <span>{t("settings.detectionApiKeyEnv")}</span>
                        <input value={det.apiKeyEnv} onChange={(e) => setDet((d) => ({ ...d, apiKeyEnv: e.target.value }))} placeholder="DETECTOR_API_KEY" className={`${fieldClass} font-mono`} />
                      </label>
                    </div>
                    <label className="text-xs text-muted-foreground space-y-1 block">
                      <span>{t("settings.detectionApiUrl")}</span>
                      <input value={det.apiUrl} onChange={(e) => setDet((d) => ({ ...d, apiUrl: e.target.value }))} placeholder="https://..." className={`${fieldClass} font-mono`} />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-muted-foreground space-y-1">
                        <span>{t("settings.detectionThreshold")} (0–1)</span>
                        <input type="number" min={0} max={1} step={0.05} value={det.threshold} onChange={(e) => setDet((d) => ({ ...d, threshold: Number(e.target.value) }))} className={fieldClass} />
                      </label>
                      <label className="text-xs text-muted-foreground space-y-1">
                        <span>{t("settings.detectionMaxRetries")} (1–10)</span>
                        <input type="number" min={1} max={10} step={1} value={det.maxRetries} onChange={(e) => setDet((d) => ({ ...d, maxRetries: Number(e.target.value) }))} className={fieldClass} />
                      </label>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={det.autoRewrite} onChange={(e) => setDet((d) => ({ ...d, autoRewrite: e.target.checked }))} />
                      {t("settings.detectionAutoRewrite")}
                    </label>
                  </div>
                </Collapse>
                <button
                  onClick={() => runSave("detection", async () => {
                    const payload = { detection: buildDetectionConfig(det) };
                    await fetchJson("/project/detection", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    });
                    await refetchDetection();
                  }, t("settings.saved"))}
                  disabled={saving === "detection"}
                  className={`rounded-lg px-4 py-2 text-sm font-bold ${c.btnPrimary} disabled:opacity-40`}
                >
                  {saving === "detection" ? t("config.saving") : t("config.save")}
                </button>
              </SettingsCard>
            </>
          )}

          {activeSection === "chapters" && (
            <div className="flex flex-col items-center justify-center py-20 text-[#A09888]">
              <BookOpen size={48} className="mb-4 opacity-40" />
              <p className="text-base font-medium">{isZh ? "章节管理" : "Chapters"}</p>
              <p className="text-sm mt-1">{isZh ? "功能开发中，敬请期待。" : "Coming soon."}</p>
            </div>
          )}

          {activeSection === "characters" && (
            <div className="flex flex-col items-center justify-center py-20 text-[#A09888]">
              <Users size={48} className="mb-4 opacity-40" />
              <p className="text-base font-medium">{isZh ? "角色" : "Characters"}</p>
              <p className="text-sm mt-1">{isZh ? "功能开发中，敬请期待。" : "Coming soon."}</p>
            </div>
          )}

          {activeSection === "worldview" && (
            <div className="flex flex-col items-center justify-center py-20 text-[#A09888]">
              <Globe size={48} className="mb-4 opacity-40" />
              <p className="text-base font-medium">{isZh ? "世界观" : "Worldview"}</p>
              <p className="text-sm mt-1">{isZh ? "功能开发中，敬请期待。" : "Coming soon."}</p>
            </div>
          )}

          {activeSection === "agent" && (
            <>
              <div className="space-y-1 mb-6">
                <h2 className="font-serif text-xl italic text-[#2C1810] font-semibold">
                  {isZh ? "Agent 配置" : "Agent Config"}
                </h2>
                <p className="text-sm text-[#7A6A5A]">
                  {isZh ? "管理创作团队的 Agent 角色与行为配置。点击卡片查看详情，或切换预设方案快速调整团队组合。" : "Manage your writing team's agent roles and behavior. Click a card for details or switch presets."}
                </p>
              </div>

              {/* Agent Card Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
                {agentTeamAgents.map((agentCfg) => {
                  const info = AGENT_CARD_INFO[agentCfg.role];
                  if (!info) return null;
                  return (
                    <div
                      key={agentCfg.role}
                      className="bg-white border border-[#E8E0D8] rounded-xl p-5 cursor-pointer transition-all duration-200 shadow-[0_2px_8px_rgba(44,24,16,0.08)] hover:border-[#F5E0E0] hover:shadow-[0_4px_16px_rgba(44,24,16,0.12)] hover:-translate-y-0.5 flex flex-col gap-3"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-serif font-bold text-sm text-white flex-shrink-0 tracking-wider ${info.avatarClass}`}>
                          {info.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[0.95rem] font-semibold text-[#2C1810] leading-tight">{info.label}</div>
                          <div className="text-[0.8rem] text-[#7A6A5A] mt-0.5 truncate">{info.persona}</div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`w-2 h-2 rounded-full ${agentCfg.enabled ? "bg-[#5D8A5D] shadow-[0_0_0_2px_rgba(93,138,93,0.2)]" : "bg-[#A09888]"}`} />
                          <span className="text-[0.72rem] text-[#A09888]">
                            {agentCfg.enabled ? (isZh ? "激活" : "Active") : (isZh ? "未激活" : "Inactive")}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-3 pt-3 border-t border-[#E8E0D8]">
                        {[
                          { label: isZh ? "编辑 Persona" : "Persona", className: "" },
                          { label: isZh ? "编辑" : "Edit", className: "" },
                          { label: isZh ? "配置 Skill" : "Skill", className: "bg-[#8B3A3A] border-[#8B3A3A] text-white hover:bg-[#723030] hover:border-[#723030]" },
                        ].map((btn) => (
                          <button
                            key={btn.label}
                            onClick={(e) => e.stopPropagation()}
                            className={`flex-1 px-3 py-1.5 text-[0.78rem] border border-[#E8E0D8] rounded-lg bg-transparent text-[#7A6A5A] cursor-pointer transition-all duration-150 leading-normal text-center font-sans ${btn.className} hover:bg-[#F5E0E0] hover:border-[#F5E0E0] hover:text-[#8B3A3A]`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Preset Section */}
              <section className="bg-white border border-[#E8E0D8] rounded-xl p-6 shadow-[0_2px_8px_rgba(44,24,16,0.08)]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-serif text-base italic text-[#2C1810] font-medium">
                      {isZh ? "预设方案" : "Presets"}
                    </div>
                    <div className="text-[0.82rem] text-[#A09888]">
                      {isZh ? "一键切换整套 Agent 人格配置组合" : "Switch agent personality presets with one click."}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 max-sm:flex-col max-sm:items-stretch">
                  <div className="relative flex-1 max-w-[340px] max-sm:max-w-none">
                    <select
                      className="w-full appearance-none px-3.5 py-2.5 text-sm font-sans text-[#2C1810] bg-[#FDF6F0] border border-[#E8E0D8] rounded-lg cursor-pointer transition-colors duration-150 hover:border-[#8B3A3A] focus:border-[#8B3A3A] focus:outline-none"
                    >
                      <option value="xuanhuan">{isZh ? "玄幻流 — 宏大世界观 + 热血叙事" : "Fantasy — Grand world + Epic narrative"}</option>
                      <option value="rexue">{isZh ? "热血战斗流 — 快节奏动作 + 激昂对白" : "Action — Fast-paced + Passionate dialogue"}</option>
                      <option value="xuanyi">{isZh ? "悬疑推理流 — 层层递进 + 逻辑推演" : "Mystery — Layered progression + Logic"}</option>
                      {isZh && <option value="qingxiaoshuo">轻小说风 — 轻松日常 + 角色主导</option>}
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-[#A09888] pointer-events-none" />
                  </div>
                  <button className="px-6 py-2.5 text-sm font-medium bg-[#8B3A3A] text-white rounded-lg cursor-pointer transition-colors duration-150 hover:bg-[#723030] whitespace-nowrap border-none font-sans">
                    {isZh ? "应用预设" : "Apply Preset"}
                  </button>
                </div>

                <div className="mt-5 p-4 bg-[#F8EFE0] rounded-lg flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#D4A855] flex items-center justify-center flex-shrink-0 text-sm text-white">
                    {isZh ? "玄" : "F"}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[#2C1810]">
                      {isZh ? "当前预设：玄幻流" : "Current: Fantasy"}
                    </div>
                    <div className="text-xs text-[#7A6A5A] mt-0.5">
                      {isZh ? "Writer · 热血战斗流 ／ Editor · 古文修辞润色 ／ Architect · 玄幻世界观" : "Writer · Action / Editor · Classical / Architect · Fantasy"}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white border border-[#E8E0D8] rounded-full text-[0.72rem] text-[#7A6A5A]">
                    3 {isZh ? "个 Agent" : "Agents"}
                  </span>
                </div>
              </section>

              {/* Agent team config below cards */}
              <SettingsCard
                title={isZh ? "团队配置" : "Team Config"}
                description={isZh ? "设置 Agent 协作模式和默认模型。" : "Set agent collaboration mode and default model."}
                icon={<Bot size={18} />}
              >
                <div className="space-y-3">
                  {/* Default model */}
                  <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto] items-end">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{isZh ? "默认模型" : "Default model"}</label>
                      <input
                        value={agentTeamDefaultModel}
                        onChange={(e) => setAgentTeamDefaultModel(e.target.value)}
                        placeholder={isZh ? "模型 ID（可选）" : "Model ID (optional)"}
                        className={`${fieldClass} font-mono`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{isZh ? "协作模式" : "Collaboration mode"}</label>
                      <select
                        value={agentTeamCollabMode}
                        onChange={(e) => setAgentTeamCollabMode(e.target.value as "sequential" | "parallel" | "hybrid")}
                        className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm outline-none"
                      >
                        <option value="sequential">{isZh ? "顺序 (sequential)" : "Sequential"}</option>
                        <option value="parallel">{isZh ? "并行 (parallel)" : "Parallel"}</option>
                        <option value="hybrid">{isZh ? "混合 (hybrid)" : "Hybrid"}</option>
                      </select>
                    </div>
                    <button
                      onClick={() => runSave("agent-team", async () => {
                        const payload = {
                          schemaVersion: "1",
                          agents: agentTeamAgents.map((a) => ({ role: a.role, enabled: a.enabled })),
                          defaultModel: agentTeamDefaultModel.trim() || undefined,
                          collaborationMode: agentTeamCollabMode,
                        };
                        await putApi("/project/agent-team", payload);
                      }, isZh ? "Agent 配置已保存" : "Agent config saved")}
                      disabled={saving === "agent-team"}
                      className={`rounded-lg px-4 py-2 text-sm font-bold ${c.btnPrimary} disabled:opacity-40`}
                    >
                      {saving === "agent-team" ? t("config.saving") : t("config.save")}
                    </button>
                  </div>
                </div>
              </SettingsCard>
            </>
          )}

          {activeSection === "export" && (
            <div className="flex flex-col items-center justify-center py-20 text-[#A09888]">
              <Download size={48} className="mb-4 opacity-40" />
              <p className="text-base font-medium">{isZh ? "导出" : "Export"}</p>
              <p className="text-sm mt-1">{isZh ? "功能开发中，敬请期待。" : "Coming soon."}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
