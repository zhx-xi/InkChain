// ── World AI Generation Hooks (Issue #102 — P3-1) ──
// Provides React hooks for AI-assisted World content generation.

import { useState, useCallback } from "react";
import { postApi } from "./use-api";
import type { ChapterCandidate, CharacterCandidate, EventCandidate } from "@actalk/inkos-core";

// ── Types ──

export type GenerateType = "chapter" | "character" | "event";

export interface GenerateParams {
  readonly creativity: number;
  readonly length: number;
  readonly style: string;
  readonly referenceDimensions: ReadonlyArray<string>;
}

export const DEFAULT_GENERATE_PARAMS: GenerateParams = {
  creativity: 5,
  length: 2000,
  style: "",
  referenceDimensions: ["settings", "roles", "relations", "regions", "institutions", "history", "rules"],
};

export interface GenerateResponse {
  readonly candidates: ReadonlyArray<ChapterCandidate | CharacterCandidate | EventCandidate>;
  readonly worldId: string;
  readonly worldName: string;
  readonly type: GenerateType;
  readonly raw?: string;
}

export interface GenerateState {
  readonly candidates: ReadonlyArray<ChapterCandidate | CharacterCandidate | EventCandidate> | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly worldId: string | null;
  readonly worldName: string | null;
  readonly type: GenerateType | null;
}

export interface ConfirmResult {
  readonly saved: number;
  readonly items: ReadonlyArray<Record<string, unknown>>;
  readonly message?: string;
}

// ── Hook ──

export function useWorldAIGen(worldId: string) {
  const [state, setState] = useState<GenerateState>({
    candidates: null,
    loading: false,
    error: null,
    worldId: null,
    worldName: null,
    type: null,
  });

  const generate = useCallback(async (
    type: GenerateType,
    params: GenerateParams,
  ): Promise<GenerateResponse | null> => {
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const data = await postApi<GenerateResponse>(`/api/worlds/${worldId}/generate`, {
        type,
        creativity: params.creativity,
        length: params.length,
        style: params.style,
        referenceDimensions: params.referenceDimensions,
      });

      const result: GenerateState = {
        candidates: data.candidates,
        loading: false,
        error: null,
        worldId: data.worldId,
        worldName: data.worldName,
        type: data.type,
      };
      setState(result);

      return data;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setState((s) => ({ ...s, loading: false, error: errorMsg }));
      return null;
    }
  }, [worldId]);

  const confirm = useCallback(async (
    type: GenerateType,
    confirmedItems: ReadonlyArray<Record<string, unknown>>,
  ): Promise<ConfirmResult | null> => {
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const data = await postApi<ConfirmResult>(`/api/worlds/${worldId}/generate/confirm`, {
        type,
        confirmedItems,
      });
      setState((s) => ({ ...s, loading: false }));
      return data;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setState((s) => ({ ...s, loading: false, error: errorMsg }));
      return null;
    }
  }, [worldId]);

  const reset = useCallback(() => {
    setState({
      candidates: null,
      loading: false,
      error: null,
      worldId: null,
      worldName: null,
      type: null,
    });
  }, []);

  return { ...state, generate, confirm, reset };
}
