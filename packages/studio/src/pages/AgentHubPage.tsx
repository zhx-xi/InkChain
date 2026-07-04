import { useState } from "react";
import { AgentTeamPanel } from "./AgentTeamPanel";
import AgentPipelineView from "./AgentPipelineView";

// ── Props ──

interface Nav {
  toDashboard: () => void;
}

interface AgentHubPageProps {
  readonly nav: Nav;
}

// ── Tab Definitions ──

const TABS = [
  { id: "team", label: "团队配置" },
  { id: "pipeline", label: "流程编辑" },
] as const;

// ── Component ──

export function AgentHubPage({ nav }: AgentHubPageProps) {
  const [activeTab, setActiveTab] = useState<string>("team");

  return (
    <div className="flex flex-col h-full pt-12 fade-in">
      {/* Tab bar */}
      <div className="flex gap-0 border-b border-border/20 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium transition-all relative ${
              activeTab === tab.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "team" && <AgentTeamPanel nav={nav} />}
      {activeTab === "pipeline" && (
        <div className="flex-1 min-h-0 w-full rounded-xl overflow-hidden border border-border/20">
          <AgentPipelineView nav={nav} />
        </div>
      )}
    </div>
  );
}
