// ── AI Persona Generation Hooks (Per-7) ──
// Provides React hooks for AI-assisted persona generation.

import { useState, useCallback } from "react";
import { postApi } from "./use-api";
import type { PersonaConfig, AgentRole } from "@actalk/inkos-core/models/persona-config.js";

// ── Types ──

export interface GenError {
  readonly role: string;
  readonly message: string;
}

export interface AIGenResponse {
  readonly recommendations: Partial<Record<AgentRole, PersonaConfig>>;
  readonly validCount: number;
  readonly totalRoles: number;
  readonly errors?: ReadonlyArray<GenError>;
}

export interface AIGenState {
  readonly recommendations: Partial<Record<AgentRole, PersonaConfig>> | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly genErrors: ReadonlyArray<GenError> | null;
  readonly raw?: string;
}

export function usePersonaAIGen() {
  const [state, setState] = useState<AIGenState>({
    recommendations: null,
    loading: false,
    error: null,
    genErrors: null,
  });

  const generate = useCallback(async (description: string): Promise<AIGenResponse | null> => {
    setState((s) => ({ ...s, loading: true, error: null, genErrors: null }));

    try {
      const data = await postApi<{
        readonly recommendations: Partial<Record<AgentRole, PersonaConfig>>;
        readonly validCount: number;
        readonly totalRoles: number;
        readonly errors?: ReadonlyArray<GenError>;
        readonly raw?: string;
      }>("/project/ai-gen/persona", { description });

      const result: AIGenState = {
        recommendations: data.recommendations,
        loading: false,
        error: null,
        genErrors: data.errors ?? null,
        raw: data.raw,
      };
      setState(result);

      return {
        recommendations: data.recommendations,
        validCount: data.validCount,
        totalRoles: data.totalRoles,
        errors: data.errors,
      };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setState((s) => ({ ...s, loading: false, error: errorMsg }));
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      recommendations: null,
      loading: false,
      error: null,
      genErrors: null,
    });
  }, []);

  return { ...state, generate, reset };
}
