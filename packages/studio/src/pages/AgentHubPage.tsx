import { AgentTeamPanel } from "./AgentTeamPanel";
import { ErrorBoundary } from "../components/ErrorBoundary";

// ── Props ──

interface Nav {
  toDashboard: () => void;
}

interface AgentHubPageProps {
  readonly nav: Nav;
}

// ── Component ──
// Hosts the AgentTeamPanel which internally manages [团队配置] [流程编辑] tabs.
// Wrapped in ErrorBoundary to prevent blank-page crashes when child components
// throw during render (e.g. when API data is unavailable or unexpected).

export function AgentHubPage({ nav }: AgentHubPageProps) {
  return (
    <div className="flex flex-col h-full pt-12 fade-in" data-testid="ag-agent-hub">
      <ErrorBoundary>
        <AgentTeamPanel nav={nav} />
      </ErrorBoundary>
    </div>
  );
}
