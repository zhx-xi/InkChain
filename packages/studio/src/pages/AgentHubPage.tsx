import { AgentTeamPanel } from "./AgentTeamPanel";

// ── Props ──

interface Nav {
  toDashboard: () => void;
}

interface AgentHubPageProps {
  readonly nav: Nav;
}

// ── Component ──
// Hosts the AgentTeamPanel which internally manages [团队配置] [流程编辑] tabs.

export function AgentHubPage({ nav }: AgentHubPageProps) {
  return (
    <div className="flex flex-col h-full pt-12 fade-in">
      <AgentTeamPanel nav={nav} />
    </div>
  );
}
