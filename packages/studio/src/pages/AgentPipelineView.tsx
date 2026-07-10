import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useHashRoute } from "../hooks/use-hash-route";

/* ─────────── 导航类型 ─────────── */
interface Nav {
  toDashboard: () => void;
}

/* ─────────── Agent 数据 ─────────── */
interface AgentInfo {
  name: string;
  role: string;
  icon: string;
  color: string;
  desc: string;
  inputs: string[];
  outputs: string[];
  tools: string[];
  metrics: { tokens: string; time: string; calls: string };
}

type AgentId =
  | "coordinator"
  | "planner"
  | "architect"
  | "observer"
  | "writer"
  | "auditor"
  | "reviser"
  | "editor"
  | "deliverable";

const AGENT_DATA: Record<AgentId, AgentInfo> = {
  coordinator: {
    name: "协调者", role: "COORDINATOR · 团队中枢", icon: "协",
    color: "#c9803e",
    desc: "接收用户的创作请求，解析章节意图并分发任务到三个并行 Agent。维护全局上下文，确保各 Agent 输出对齐卷纲设定和角色状态。",
    inputs: ["用户创作指令", "卷纲设定 (synopsis)", "前序章节摘要", "角色当前状态"],
    outputs: ["任务分发指令", "Agent调用顺序", "上下文摘要包"],
    tools: ["ContextManager", "TaskDispatcher", "VolumeScope"],
    metrics: { tokens: "1.2K", time: "8s", calls: "1" },
  },
  planner: {
    name: "规划师", role: "PLANNER · 章节大纲", icon: "规",
    color: "#d4a743",
    desc: "根据卷纲和前序章节，生成本章的情节走向大纲。规划战斗/对话/修炼等场景的比例，确定叙事节奏和情感弧线。",
    inputs: ["卷纲设定", "前序摘要", "角色关系图"],
    outputs: ["章节大纲 (5-8个节拍)", "场景分布", "情感弧线"],
    tools: ["PlotGenerator", "BeatSheet", "PacingAnalyzer"],
    metrics: { tokens: "2.1K", time: "25s", calls: "1" },
  },
  architect: {
    name: "架构师", role: "ARCHITECT · 叙事结构", icon: "构",
    color: "#8b6db5",
    desc: "设计本章的叙事结构：开篇钩子、冲突升级、高潮转折、收束余韵。确保与前后章节的衔接不断裂，世界观设定引用准确。",
    inputs: ["章节大纲", "世界设定条目", "角色时间线"],
    outputs: ["叙事结构方案", "伏笔/回收清单", "设定引用建议"],
    tools: ["StructureDesigner", "WorldRefIndex", "ForeshadowTracker"],
    metrics: { tokens: "1.8K", time: "20s", calls: "1" },
  },
  observer: {
    name: "观察者", role: "OBSERVER · 风格监控", icon: "察",
    color: "#6ba8a0",
    desc: "持续监控写作风格和情感一致性。比对已完成的章节风格基准，检测角色语言特征是否偏离设定，标注需要修正的风格偏移。",
    inputs: ["风格基准库", "角色语言档案", "前3章风格样本"],
    outputs: ["风格一致性报告", "角色语气修正建议", "情感节奏评估"],
    tools: ["StyleComparator", "VoiceProfile", "SentimentAnalyzer"],
    metrics: { tokens: "1.5K", time: "15s", calls: "1" },
  },
  writer: {
    name: "执笔者", role: "WRITER · 正文生成", icon: "笔",
    color: "#c9803e",
    desc: "核心创作 Agent。融合大纲、叙事结构和风格建议，将构思转化为正文。自动填充配角出场描写，引用世界设定，保持角色行为一致性。Persona 驱动文风。",
    inputs: ["章节大纲", "叙事结构方案", "风格一致性报告", "角色状态快照"],
    outputs: ["章节正文 (2000-4000字)", "场景过渡标记", "角色出场记录"],
    tools: ["ProseGenerator", "PersonaEngine", "CharStateInjector", "SettingRef"],
    metrics: { tokens: "4.5K", time: "45s", calls: "1" },
  },
  auditor: {
    name: "审核者", role: "AUDITOR · 一致性检查", icon: "审",
    color: "#c4514a",
    desc: "对生成的正文进行多维度审核：角色时间线矛盾检测、关系断裂扫描、世界观设定冲突、节奏异常。不通过时触发修订回退流程。",
    inputs: ["章节正文", "角色时间线", "关系图状态", "世界设定库"],
    outputs: ["审核报告 (pass/fail)", "冲突清单", "修正建议"],
    tools: ["ConsistencyChecker", "RelationGapDetector", "WorldConflictScan"],
    metrics: { tokens: "1.2K", time: "12s", calls: "1" },
  },
  reviser: {
    name: "修订者", role: "REVISER · 回退修正", icon: "修",
    color: "#c4514a",
    desc: "当审核不通过时激活。根据审核报告的冲突清单，生成针对性修订方案。可能触发 Writer 重新生成受影响段落，或直接局部修正。最多重试 2 轮。",
    inputs: ["审核报告", "冲突清单", "原正文", "修正建议"],
    outputs: ["修订正文", "修订摘要", "重试计数"],
    tools: ["RevisionPatcher", "ConflictResolver", "RetryLimiter"],
    metrics: { tokens: "1.5K", time: "20s", calls: "0-2" },
  },
  editor: {
    name: "编辑者", role: "EDITOR · 终稿打磨", icon: "编",
    color: "#d4a743",
    desc: "审核通过后的终稿打磨。优化语句节奏，修正冗余表达，调整段落呼吸感。不改变情节内容，只提升文字质感和阅读流畅度。",
    inputs: ["审核通过正文", "风格基准", "节奏分析"],
    outputs: ["终稿正文", "修改记录", "质量评分"],
    tools: ["SentenceOptimizer", "RhythmTuner", "ReadabilityScorer"],
    metrics: { tokens: "0.8K", time: "15s", calls: "1" },
  },
  deliverable: {
    name: "章节交付", role: "DELIVERABLE · 最终产出", icon: "✦",
    color: "#6ba8a0",
    desc: "完成审核与编辑的最终章节。自动更新角色状态快照、时间线记录、关系图权重。将章节写入对应分卷，更新卷进度。",
    inputs: ["终稿正文", "质量评分", "卷归属信息"],
    outputs: ["入库章节", "更新后的角色状态", "卷进度刷新"],
    tools: ["ChapterStore", "StateUpdater", "VolumeProgress"],
    metrics: { tokens: "0.2K", time: "5s", calls: "1" },
  },
};

/* ─────────── 流水线动画序列 ─────────── */
interface PipelineStep {
  nodeId: AgentId;
  duration: number;
  lines: string[];
  parallel?: AgentId[];
  isError?: boolean;
  isConditional?: boolean;
  isRetry?: boolean;
}

const PIPELINE_SEQUENCE: PipelineStep[] = [
  { nodeId: "coordinator", duration: 1000, lines: [] },
  { nodeId: "planner", duration: 1500, lines: ["line-c-p"], parallel: ["planner", "architect", "observer"] },
  { nodeId: "architect", duration: 1500, lines: ["line-c-a"], parallel: true } as PipelineStep,
  { nodeId: "observer", duration: 1500, lines: ["line-c-o"], parallel: true } as PipelineStep,
  { nodeId: "writer", duration: 2000, lines: ["line-p-w", "line-a-w", "line-o-w"] },
  { nodeId: "auditor", duration: 1200, lines: ["line-w-aud"] },
  { nodeId: "reviser", duration: 1000, lines: ["line-aud-r"], isError: true, isConditional: true },
  { nodeId: "writer", duration: 1500, lines: ["line-r-w"], isError: true, isConditional: true, isRetry: true },
  { nodeId: "auditor", duration: 1000, lines: ["line-w-aud"], isRetry: true },
  { nodeId: "editor", duration: 1500, lines: ["line-aud-e"] },
  { nodeId: "deliverable", duration: 1000, lines: ["line-e-d"] },
];

/* ─────────── 预设数据 ─────────── */
interface PresetStats {
  time: string;
  token: string;
  score: string;
}
const PRESETS: Record<string, PresetStats> = {
  xianxia: { time: "~3.5", token: "12.8K", score: "4.2" },
  urban: { time: "~2.8", token: "10.2K", score: "4.0" },
  scifi: { time: "~4.2", token: "15.5K", score: "4.4" },
  custom: { time: "~3.0", token: "11.0K", score: "4.1" },
};
const PRESET_LABELS: Record<string, string> = {
  xianxia: "热血玄幻 · 预设",
  urban: "都市异能 · 预设",
  scifi: "星际科幻 · 预设",
  custom: "自定义 · 预设",
};

/* ─────────── 节点状态类型 ─────────── */
type NodeState = "idle" | "active" | "done" | "error";

/* ─────────── 主题常量（原型 Warm Dark Literary Palette） ─────────── */
const THEME = {
  bgDeep: "#1a1512",
  bgSurface: "#241e1a",
  bgElevated: "#2e2620",
  bgGlass: "rgba(46,38,32,0.72)",
  borderHairline: "rgba(201,128,62,0.12)",
  borderSubtle: "rgba(201,128,62,0.2)",
  borderStrong: "rgba(201,128,62,0.4)",
  accentAmber: "#c9803e",
  accentAmberGlow: "rgba(201,128,62,0.25)",
  accentSage: "#6ba8a0",
  accentRose: "#c4514a",
  accentGold: "#d4a743",
  accentViolet: "#8b6db5",
  accentBronze: "#a0703e",
  textPrimary: "#f5ede6",
  textSecondary: "#b8a89c",
  textMuted: "#7a6e66",
  textDim: "#5a504a",
};

/* ─────────── 节点定义（位置 & 尺寸） ─────────── */
interface NodeDef {
  id: AgentId;
  x: number;
  y: number;
  width: number;
  height: number;
}

const NODES: NodeDef[] = [
  { id: "coordinator", x: 120, y: 320, width: 120, height: 60 },
  { id: "planner", x: 445, y: 160, width: 130, height: 60 },
  { id: "architect", x: 445, y: 320, width: 130, height: 60 },
  { id: "observer", x: 445, y: 480, width: 130, height: 60 },
  { id: "writer", x: 785, y: 300, width: 130, height: 60 },
  { id: "auditor", x: 1050, y: 300, width: 120, height: 60 },
  { id: "reviser", x: 785, y: 380, width: 110, height: 48 },
  { id: "editor", x: 855, y: 100, width: 130, height: 60 },
  { id: "deliverable", x: 490, y: 100, width: 140, height: 60 },
];

/* ─────────── 动画间隔行 ID（用于并行分支管理） ─────────── */
const PARALLEL_LINE_IDS = ["line-c-p", "line-c-a", "line-c-o"];

/* ─────────── 组件 ─────────── */
export default function AgentPipelineView({ nav }: { nav: Nav }) {
  const { setRoute } = useHashRoute();

  // ── 状态 ──
  const [nodeStates, setNodeStates] = useState<Record<string, NodeState>>({});
  const [lineClasses, setLineClasses] = useState<Record<string, string>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [playBtnLabel, setPlayBtnLabel] = useState("播放流水线");
  const [selectedNode, setSelectedNode] = useState<AgentId | null>("coordinator");
  const [currentPreset, setCurrentPreset] = useState("xianxia");

  const stepRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 初始化显示协调者详情 ──
  useEffect(() => {
    const t = setTimeout(() => setSelectedNode("coordinator"), 500);
    return () => clearTimeout(t);
  }, []);

  // ── 节点点击 ──
  const handleNodeClick = useCallback((nodeId: AgentId) => {
    setSelectedNode(nodeId);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // ── 重置所有节点/连线状态 ──
  const resetAll = useCallback(() => {
    const idleStates: Record<string, NodeState> = {};
    NODES.forEach((n) => { idleStates[n.id] = "idle"; });
    setNodeStates(idleStates);
    setLineClasses({});
  }, []);

  // ── 播放动画 ──
  const startAnimation = useCallback(() => {
    resetAll();
    setIsPlaying(true);
    setPlayBtnLabel("执行中…");
    stepRef.current = 0;

    // 立即执行第一步
    tick();
  }, [resetAll]);

  const stopAnimation = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPlaying(false);
    setPlayBtnLabel("播放流水线");
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stopAnimation();
    } else {
      startAnimation();
    }
  }, [isPlaying, startAnimation, stopAnimation]);

  const tick = useCallback(() => {
    const step = PIPELINE_SEQUENCE[stepRef.current];
    if (!step) {
      // 动画结束
      setIsPlaying(false);
      setPlayBtnLabel("重新播放");
      return;
    }

    setNodeStates((prev) => {
      const next = { ...prev };

      if (step.parallel && Array.isArray(step.parallel)) {
        // 并行分支：所有并行节点同时激活
        step.parallel.forEach((pid) => { next[pid] = "active"; });
      } else {
        if (step.isError) {
          next[step.nodeId] = "error";
        } else {
          next[step.nodeId] = "active";
        }
      }
      return next;
    });

    // 激活连线
    if (step.lines && step.lines.length > 0) {
      const cls = step.isError ? "error flow-anim" : "active flow-anim";
      setLineClasses((prev) => {
        const next = { ...prev };
        step.lines!.forEach((lid) => { next[lid] = cls; });
        return next;
      });
    }

    // 如果并行分支，同时激活三条起始线
    if (step.parallel && Array.isArray(step.parallel)) {
      setLineClasses((prev) => {
        const next = { ...prev };
        PARALLEL_LINE_IDS.forEach((lid) => { next[lid] = "active flow-anim"; });
        return next;
      });
    }

    // 延迟后标记完成并进入下一步
    timerRef.current = setTimeout(() => {
      setNodeStates((prev) => {
        const next = { ...prev };
        if (step.parallel && Array.isArray(step.parallel)) {
          step.parallel!.forEach((pid) => { next[pid] = "done"; });
        } else if (node && !step.isConditional) {
          next[step.nodeId] = step.isError ? "error" : "done";
        }

        // 如果是并行步骤，也要把 coordinator 标记为 done（如果还没）
        if (step.parallel && Array.isArray(step.parallel)) {
          next["coordinator"] = "done";
        }
        return next;
      });

      setLineClasses((prev) => {
        const next = { ...prev };
        // 完成相应的连线
        const lineIds = step.parallel && Array.isArray(step.parallel)
          ? PARALLEL_LINE_IDS
          : step.lines || [];

        lineIds.forEach((lid) => {
          if (!step.isError) {
            next[lid] = "done";
          } else {
            next[lid] = "error";
          }
        });
        return next;
      });

      stepRef.current++;
      tick();
    }, step.duration);
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // ── 预设切换 ──
  const handlePresetChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentPreset(e.target.value);
  }, []);

  // ── 选中节点详情 ──
  const selectedAgentData = selectedNode ? AGENT_DATA[selectedNode] : null;

  // ── 当前预设统计 ──
  const statData = PRESETS[currentPreset] || PRESETS.xianxia;

  // ── 渲染 ──
  return (
    <div style={styles.wrapper}>
      {/* 注入自定义样式 */}
      <style>{STYLES}</style>

      {/* ═══ Top Bar ═══ */}
      <header style={styles.topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            type="button"
            onClick={() => setRoute({ page: "project-settings" })}
            style={{ background: "none", border: "none", color: THEME.textMuted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <ArrowLeft size={16} />
            <span>返回设置</span>
          </button>
          <div style={styles.brandMark}>
            <span style={{ fontFamily: "Georgia,serif", fontSize: 14, color: THEME.bgDeep, fontWeight: "bold" }}>墨</span>
          </div>
          <div>
            <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontStyle: "italic", color: THEME.textPrimary, letterSpacing: 0.5, fontWeight: 500 }}>
              InkChain Agent Pipeline
            </div>
            <div style={{ fontSize: 10, color: THEME.textMuted, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'SF Mono','Fira Code','Consolas',monospace" }}>
              小说创作 · 多智能体协作可视化
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <select
            value={currentPreset}
            onChange={handlePresetChange}
            style={styles.presetSelect}
          >
            {Object.entries(PRESET_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={togglePlay}
            disabled={isPlaying}
            style={{
              ...styles.playBtn,
              opacity: isPlaying ? 0.4 : 1,
              cursor: isPlaying ? "not-allowed" : "pointer",
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: "currentColor" }}>
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>{playBtnLabel}</span>
          </button>
        </div>
      </header>

      {/* ═══ Canvas Area ═══ */}
      <div style={styles.canvasArea}>
        <svg viewBox="0 0 1200 640" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }}>
          <defs>
            <marker id="arrow-idle" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill="rgba(201,128,62,0.2)" />
            </marker>
            <marker id="arrow-active" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill="#c9803e" />
            </marker>
            <marker id="arrow-done" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill="#6ba8a0" />
            </marker>
            <marker id="arrow-error" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill="#c4514a" />
            </marker>
          </defs>

          {/* 背景网格（极淡） */}
          <g opacity={0.03} stroke="#c9803e" strokeWidth={0.5}>
            {[80, 160, 240, 320, 400, 480, 560].map((y) => (
              <line key={y} x1={0} y1={y} x2={1200} y2={y} />
            ))}
          </g>

          {/* ═══ 连线 ═══ */}
          {/* Coordinator → Planner */}
          <path className={`flow-line ${getLineClass(lineClasses, "line-c-p")}`}
            d="M180,320 C280,320 300,160 380,160"
            markerEnd={getArrowRef(lineClasses, "line-c-p")} />
          {/* Coordinator → Architect */}
          <path className={`flow-line ${getLineClass(lineClasses, "line-c-a")}`}
            d="M180,320 C280,320 300,320 380,320"
            markerEnd={getArrowRef(lineClasses, "line-c-a")} />
          {/* Coordinator → Observer */}
          <path className={`flow-line ${getLineClass(lineClasses, "line-c-o")}`}
            d="M180,320 C280,320 300,480 380,480"
            markerEnd={getArrowRef(lineClasses, "line-c-o")} />

          {/* Planner → Writer */}
          <path className={`flow-line ${getLineClass(lineClasses, "line-p-w")}`}
            d="M510,160 C610,160 630,280 720,280"
            markerEnd={getArrowRef(lineClasses, "line-p-w")} />
          {/* Architect → Writer */}
          <path className={`flow-line ${getLineClass(lineClasses, "line-a-w")}`}
            d="M510,320 C610,320 630,300 720,300"
            markerEnd={getArrowRef(lineClasses, "line-a-w")} />
          {/* Observer → Writer */}
          <path className={`flow-line ${getLineClass(lineClasses, "line-o-w")}`}
            d="M510,480 C610,480 630,320 720,320"
            markerEnd={getArrowRef(lineClasses, "line-o-w")} />

          {/* Writer → Auditor */}
          <path className={`flow-line ${getLineClass(lineClasses, "line-w-aud")}`}
            d="M850,300 C920,300 940,300 990,300"
            markerEnd={getArrowRef(lineClasses, "line-w-aud")} />

          {/* Auditor → Reviser (错误路径) */}
          <path className={`flow-line ${getLineClass(lineClasses, "line-aud-r")}`}
            d="M1050,340 C1050,440 880,440 780,340"
            markerEnd={getArrowRef(lineClasses, "line-aud-r")} />
          {/* Reviser → Writer (回路) */}
          <path className={`flow-line ${getLineClass(lineClasses, "line-r-w")}`}
            d="M720,340 C680,340 660,320 720,320"
            markerEnd={getArrowRef(lineClasses, "line-r-w")} />

          {/* Auditor → Editor (成功路径) */}
          <path className={`flow-line ${getLineClass(lineClasses, "line-aud-e")}`}
            d="M1050,260 C1050,200 1000,140 920,100"
            markerEnd={getArrowRef(lineClasses, "line-aud-e")} />

          {/* Editor → Deliverable */}
          <path className={`flow-line ${getLineClass(lineClasses, "line-e-d")}`}
            d="M790,100 C700,100 620,100 560,100"
            markerEnd={getArrowRef(lineClasses, "line-e-d")} />

          {/* 并行分支标签 */}
          <text x={300} y={120} style={{ fontFamily: "'SF Mono','Fira Code','Consolas',monospace", fontSize: 8, letterSpacing: 1, fill: THEME.textDim, textTransform: "uppercase" }}>
            ⟂ 并行分支
          </text>
          <line x1={290} y1={125} x2={560} y2={125} stroke="rgba(201,128,62,0.1)" strokeWidth={0.5} strokeDasharray="3,3" />

          {/* ═══ 节点 ═══ */}
          {NODES.map((n) => {
            const data = AGENT_DATA[n.id];
            const state: NodeState = nodeStates[n.id] || "idle";
            const isSelected = selectedNode === n.id;
            return (
              <g
                key={n.id}
                className="node-group"
                data-state={state}
                onClick={() => handleNodeClick(n.id)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  className="node-bg"
                  x={-n.width / 2}
                  y={-n.height / 2}
                  width={n.width}
                  height={n.height}
                  rx={8}
                  style={{
                    fill: getNodeFill(state, n.id === "reviser"),
                    stroke: isSelected ? data.color : getNodeStroke(state),
                    strokeWidth: isSelected ? 2.5 : 1.5,
                    filter: state === "active" || isSelected
                      ? `drop-shadow(0 0 8px ${state === "active" ? THEME.accentAmberGlow : data.color + "44"})`
                      : "none",
                    transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
                  }}
                />
                <text
                  className="node-icon"
                  x={0}
                  y={-2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{
                    fontFamily: "Georgia,serif",
                    fontSize: n.id === "deliverable" ? 18 : n.id === "reviser" ? 13 : 16,
                    fontWeight: "bold",
                    fill: getNodeIconColor(state, data.color),
                    pointerEvents: "none",
                    transition: "fill 0.4s",
                  }}
                >
                  {data.icon}
                </text>
                <text
                  className="node-label"
                  x={0}
                  y={12}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{
                    fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
                    fontSize: n.id === "reviser" ? 9 : 10,
                    fontWeight: 600,
                    fill: getNodeLabelColor(state),
                    pointerEvents: "none",
                    transition: "fill 0.4s",
                  }}
                >
                  {n.id === "reviser" ? "修订者" : data.name}
                </text>
                <text
                  className="node-sublabel"
                  x={0}
                  y={n.id === "reviser" ? 18 : 22}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{
                    fontFamily: "'SF Mono','Fira Code','Consolas',monospace",
                    fontSize: n.id === "reviser" ? 6 : 7,
                    letterSpacing: 1.2,
                    fill: getNodeSublabelColor(state),
                    textTransform: "uppercase",
                    pointerEvents: "none",
                    transition: "fill 0.4s",
                  }}
                >
                  {n.id === "reviser" ? "REVISER · 回退路径" : data.role.split(" · ")[0]}
                </text>
              </g>
            );
          })}
        </svg>

        {/* ═══ Detail Panel ═══ */}
        <aside
          style={{
            ...styles.detailPanel,
            right: selectedAgentData ? 0 : -420,
          }}
        >
          {selectedAgentData && (
            <>
              <div style={styles.detailHeader}>
                <button type="button" onClick={handleClosePanel} style={styles.detailClose}>✕</button>
                <div
                  style={{
                    ...styles.detailIcon,
                    background: selectedAgentData.color + "22",
                    color: selectedAgentData.color,
                  }}
                >
                  {selectedAgentData.icon}
                </div>
                <div style={styles.detailName}>{selectedAgentData.name}</div>
                <div style={{ ...styles.detailRole, color: selectedAgentData.color }}>
                  {selectedAgentData.role}
                </div>
              </div>
              <div style={styles.detailBody}>
                <div style={styles.detailSection}>
                  <div style={styles.detailSectionTitle}>角色描述</div>
                  <p style={styles.detailDesc}>{selectedAgentData.desc}</p>
                </div>
                <div style={styles.detailSection}>
                  <div style={styles.detailSectionTitle}>输入 / 输出</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                      <div style={{ flexShrink: 0, width: 36, fontFamily: "'SF Mono','Fira Code','Consolas',monospace", fontSize: 10, color: THEME.textMuted, letterSpacing: 0.5 }}>
                        IN
                      </div>
                      <div style={{ color: THEME.textSecondary, lineHeight: 1.6 }}>
                        {selectedAgentData.inputs.map((i) => `· ${i}`).join("\n")}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                      <div style={{ flexShrink: 0, width: 36, fontFamily: "'SF Mono','Fira Code','Consolas',monospace", fontSize: 10, color: THEME.textMuted, letterSpacing: 0.5 }}>
                        OUT
                      </div>
                      <div style={{ color: THEME.textSecondary, lineHeight: 1.6 }}>
                        {selectedAgentData.outputs.map((o) => `· ${o}`).join("\n")}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={styles.detailSection}>
                  <div style={styles.detailSectionTitle}>工具列表</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {selectedAgentData.tools.map((t) => (
                      <span key={t} style={styles.toolTag}>{t}</span>
                    ))}
                  </div>
                </div>
                <div style={styles.detailSection}>
                  <div style={styles.detailSectionTitle}>运行指标</div>
                  <div style={styles.metricRow}>
                    <span style={styles.metricLabel}>TOKEN 用量</span>
                    <span style={styles.metricValue}>{selectedAgentData.metrics.tokens}</span>
                  </div>
                  <div style={styles.metricRow}>
                    <span style={styles.metricLabel}>执行耗时</span>
                    <span style={styles.metricValue}>{selectedAgentData.metrics.time}</span>
                  </div>
                  <div style={styles.metricRow}>
                    <span style={styles.metricLabel}>调用次数</span>
                    <span style={styles.metricValue}>{selectedAgentData.metrics.calls}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ═══ Stats Bar ═══ */}
      <footer style={styles.statsBar}>
        <div style={styles.statItem}>
          <div style={{ ...styles.statIcon, background: "rgba(201,128,62,0.15)" }}>●</div>
          <div>
            <div style={styles.statLabel}>节点数</div>
            <div style={styles.statValue}>8<span style={styles.statUnit}>agents</span></div>
          </div>
        </div>
        <div style={styles.statItem}>
          <div style={{ ...styles.statIcon, background: "rgba(139,109,181,0.15)" }}>⟂</div>
          <div>
            <div style={styles.statLabel}>并行分支</div>
            <div style={styles.statValue}>3<span style={styles.statUnit}>branches</span></div>
          </div>
        </div>
        <div style={styles.statItem}>
          <div style={{ ...styles.statIcon, background: "rgba(212,167,67,0.15)" }}>⏱</div>
          <div>
            <div style={styles.statLabel}>预估耗时</div>
            <div style={styles.statValue}>{statData.time}<span style={styles.statUnit}>min</span></div>
          </div>
        </div>
        <div style={styles.statItem}>
          <div style={{ ...styles.statIcon, background: "rgba(107,168,160,0.15)" }}>⬡</div>
          <div>
            <div style={styles.statLabel}>Token 用量</div>
            <div style={styles.statValue}>~{statData.token}<span style={styles.statUnit}>tokens</span></div>
          </div>
        </div>
        <div style={{ ...styles.statItem, borderRight: "none", marginLeft: "auto" }}>
          <div style={styles.qualityBadge}>
            <div style={styles.qualityDot}></div>
            <div>
              <div style={styles.statLabel}>质量评分</div>
              <div style={styles.statValue}>{statData.score}<span style={styles.statUnit}>/5.0</span></div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─────────── 辅助函数 ─────────── */

function getLineClass(lineClasses: Record<string, string>, id: string): string {
  return lineClasses[id] || "";
}

function getArrowRef(lineClasses: Record<string, string>, id: string): string {
  const cls = lineClasses[id] || "";
  if (cls.includes("error")) return "url(#arrow-error)";
  if (cls.includes("active")) return "url(#arrow-active)";
  if (cls.includes("done")) return "url(#arrow-done)";
  return "url(#arrow-idle)";
}

function getNodeFill(state: NodeState, isReviser: boolean): string {
  if (isReviser && state === "idle") return THEME.bgElevated;
  if (state === "active") return THEME.bgElevated;
  if (state === "done") return "rgba(107,168,160,0.08)";
  if (state === "error") return "rgba(196,81,74,0.08)";
  return THEME.bgElevated;
}

function getNodeStroke(state: NodeState): string {
  if (state === "active") return THEME.accentAmber;
  if (state === "done") return THEME.accentSage;
  if (state === "error") return THEME.accentRose;
  return THEME.borderSubtle;
}

function getNodeLabelColor(state: NodeState): string {
  if (state === "active" || state === "done") return THEME.textPrimary;
  if (state === "error") return THEME.accentRose;
  return THEME.textMuted;
}

function getNodeSublabelColor(state: NodeState): string {
  if (state === "active") return THEME.accentAmber;
  if (state === "done") return THEME.accentSage;
  if (state === "error") return THEME.accentRose;
  return THEME.textDim;
}

function getNodeIconColor(state: NodeState, color: string): string {
  if (state === "active") return THEME.accentAmber;
  if (state === "done") return THEME.accentSage;
  if (state === "error") return THEME.accentRose;
  return THEME.textDim;
}

/* ─────────── 注入的 CSS 动画 ─────────── */
const ANIM_CSS = `
  @keyframes flowDash { to { stroke-dashoffset: -22; } }
  .flow-line.active { stroke: #c9803e; stroke-width: 2; }
  .flow-line.done { stroke: #6ba8a0; stroke-width: 1.5; opacity: 0.6; }
  .flow-line.error { stroke: #c4514a; stroke-width: 2; stroke-dasharray: 6,4; }
  .flow-line.flow-anim { stroke-dasharray: 6,5; animation: flowDash 1.2s linear infinite; }
  .node-group:hover rect { stroke-width: 2.5 !important; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(201,128,62,0.2); border-radius: 2px; }
`;

const STYLES = ANIM_CSS;

/* ─────────── 样式对象 ─────────── */
const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: THEME.bgDeep,
    color: THEME.textPrimary,
    fontFamily: "'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif",
    fontSize: 14,
    lineHeight: 1.6,
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 28px",
    background: THEME.bgSurface,
    borderBottom: `1px solid ${THEME.borderHairline}`,
    flexShrink: 0,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: `radial-gradient(circle at 35% 35%, ${THEME.accentGold}, ${THEME.accentBronze})`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  presetSelect: {
    background: THEME.bgElevated,
    border: `1px solid ${THEME.borderSubtle}`,
    color: THEME.textSecondary,
    fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
    fontSize: 12,
    padding: "7px 14px",
    borderRadius: 4,
    cursor: "pointer",
    outline: "none",
  },
  playBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: THEME.accentAmber,
    color: THEME.bgDeep,
    border: "none",
    padding: "8px 20px",
    borderRadius: 4,
    fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
  },
  canvasArea: {
    flex: 1,
    position: "relative" as const,
    overflow: "hidden",
    background: `radial-gradient(ellipse 80% 50% at 50% 0%, rgba(201,128,62,0.04), transparent), ${THEME.bgDeep}`,
  },
  detailPanel: {
    position: "absolute" as const,
    top: 0,
    width: 400,
    height: "100%",
    background: THEME.bgGlass,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderLeft: `1px solid ${THEME.borderHairline}`,
    transition: "right 0.5s cubic-bezier(0.16,1,0.3,1)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    zIndex: 10,
  },
  detailHeader: {
    padding: "24px 28px 16px",
    borderBottom: `1px solid ${THEME.borderHairline}`,
    position: "relative" as const,
    flexShrink: 0,
  },
  detailClose: {
    position: "absolute" as const,
    top: 20,
    right: 20,
    background: "none",
    border: "none",
    color: THEME.textMuted,
    fontSize: 18,
    cursor: "pointer",
  },
  detailIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Georgia,serif",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 12,
  },
  detailName: {
    fontFamily: "Georgia,serif",
    fontSize: 20,
    fontStyle: "italic",
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  detailRole: {
    fontFamily: "'SF Mono','Fira Code','Consolas',monospace",
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    marginBottom: 14,
  },
  detailBody: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "20px 28px 28px",
  },
  detailSection: {
    marginBottom: 22,
  },
  detailSectionTitle: {
    fontFamily: "'SF Mono','Fira Code','Consolas',monospace",
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: THEME.textMuted,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: `1px solid ${THEME.borderHairline}`,
  },
  detailDesc: {
    fontSize: 13,
    lineHeight: 1.7,
    color: THEME.textSecondary,
    whiteSpace: "pre-wrap" as const,
  },
  toolTag: {
    fontFamily: "'SF Mono','Fira Code','Consolas',monospace",
    fontSize: 10,
    padding: "4px 10px",
    borderRadius: 4,
    background: THEME.bgElevated,
    color: THEME.textSecondary,
    border: `1px solid ${THEME.borderHairline}`,
  },
  metricRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 12,
    padding: "6px 0",
  },
  metricLabel: {
    color: THEME.textMuted,
    fontFamily: "'SF Mono','Fira Code','Consolas',monospace",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  metricValue: {
    color: THEME.textPrimary,
    fontFamily: "'SF Mono','Fira Code','Consolas',monospace",
    fontWeight: 600,
  },
  statsBar: {
    display: "flex",
    alignItems: "center",
    gap: 0,
    padding: "0 28px",
    height: 56,
    flexShrink: 0,
    background: THEME.bgSurface,
    borderTop: `1px solid ${THEME.borderHairline}`,
  },
  statItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 24px",
    borderRight: `1px solid ${THEME.borderHairline}`,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    flexShrink: 0,
  },
  statLabel: {
    fontFamily: "'SF Mono','Fira Code','Consolas',monospace",
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    color: THEME.textMuted,
  },
  statValue: {
    fontFamily: "'SF Mono','Fira Code','Consolas',monospace",
    fontSize: 15,
    fontWeight: 700,
    color: THEME.textPrimary,
  },
  statUnit: {
    fontSize: 10,
    color: THEME.textMuted,
    fontWeight: 400,
    marginLeft: 3,
  },
  qualityBadge: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 14px",
    borderRadius: 4,
    background: "rgba(107,168,160,0.1)",
    border: "1px solid rgba(107,168,160,0.3)",
  },
  qualityDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: THEME.accentSage,
    boxShadow: `0 0 6px ${THEME.accentSage}`,
  },
};
