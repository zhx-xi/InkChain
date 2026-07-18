// @vitest-environment jsdom
// ── ErrorBoundary Unit Tests ──
// Tests that ErrorBoundary:
//  - renders children normally when no error occurs
//  - catches rendering errors and shows fallback UI
//  - recovers via the retry button

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ErrorBoundary } from "../ErrorBoundary";

// ── Helper: a component that throws on render ──

function ThrowingComponent({ shouldThrow = false }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error("Intentional render error");
  }
  return <div data-testid="normal-child">Normal Content</div>;
}

// ── Tests ──

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => { /* suppress */ });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Hello</div>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("child")).toBeDefined();
    expect(screen.getByText("Hello")).toBeDefined();
  });

  it("renders fallback UI when a child component throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow />
      </ErrorBoundary>,
    );

    // Should not render the normal child
    expect(screen.queryByTestId("normal-child")).toBeNull();

    // Should render error fallback
    expect(screen.getByTestId("ag-error-boundary")).toBeDefined();
    expect(screen.getByText("渲染出现异常")).toBeDefined();
    expect(screen.getByText("Intentional render error")).toBeDefined();
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom Error</div>}>
        <ThrowingComponent shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("custom-fallback")).toBeDefined();
    expect(screen.getByText("Custom Error")).toBeDefined();
  });

  it("recovers children after retry button click", async () => {
    let throwFlag = true;
    function ConditionalThrower() {
      if (throwFlag) {
        throw new Error("Temporary error");
      }
      return <div data-testid="recovered">Recovered</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>,
    );

    // Initially shows error state
    expect(screen.getByTestId("ag-error-boundary")).toBeDefined();

    // Toggle the flag so the component won't throw on next render
    throwFlag = false;

    // Click retry to reset error boundary state
    fireEvent.click(screen.getByText("重试"));

    // Wait for React to re-render the recovered children
    await waitFor(() => {
      expect(screen.getByTestId("recovered")).toBeDefined();
      expect(screen.getByText("Recovered")).toBeDefined();
    });
  });

  it("calls onError handler when an error is caught", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent shouldThrow />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Intentional render error" }),
      expect.anything(),
    );
  });

  it("accepts custom testId", () => {
    render(
      <ErrorBoundary testId="custom-boundary">
        <ThrowingComponent shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("custom-boundary")).toBeDefined();
  });
});
