// ── Error Boundary ──
// Catches rendering crashes and displays a fallback UI instead of unmounting the
// entire React tree.  Used by AgentHubPage to prevent blank-page crashes when
// child components (e.g. AgentFlowEditor, AgentTeamPanel) throw during render.

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

// ── Props ──

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
  readonly onError?: (error: Error, errorInfo: ErrorInfo) => void;
  readonly testId?: string;
}

// ── State ──

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly error: Error | null;
}

// ── Component ──

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }

      return (
        <div
          data-testid={this.props.testId ?? "ag-error-boundary"}
          className="flex flex-col items-center justify-center min-h-[400px] gap-4"
          style={{ backgroundColor: "var(--background)" }}
        >
          <AlertTriangle size={28} style={{ color: "#dc2626" }} />
          <div className="flex flex-col items-center gap-1">
            <span className="text-sm font-medium" style={{ color: "#3a2a1a" }}>
              渲染出现异常
            </span>
            <span className="text-xs" style={{ color: "#8a7a6a" }}>
              {this.state.error?.message ?? "未知错误"}
            </span>
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium border transition-colors"
            style={{
              borderColor: "hsl(var(--border))",
              color: "#3a2a1a",
              backgroundColor: "var(--card)",
            }}
          >
            <RefreshCw size={14} />
            <span>重试</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
