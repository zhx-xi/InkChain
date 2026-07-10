// ── Map AI Generation Hooks (Issue #269 — P3-2) ──
// Provides React hooks for AI-assisted map region generation.

import { useState, useCallback } from "react";
import { postApi } from "./use-api";
import type { MapRegionCandidate } from "@actalk/inkchain-core";

// ── Types ──

export interface MapGenerateResponse {
  readonly candidates: ReadonlyArray<MapRegionCandidate>;
  readonly worldId: string;
  readonly worldName: string;
  readonly raw?: string;
}

export interface MapConfirmResult {
  readonly saved: number;
  readonly items: ReadonlyArray<{
    id: string;
    name: string;
    type: string;
    x: number | null;
    y: number | null;
  }>;
}

export interface MapGenerateState {
  readonly candidates: ReadonlyArray<MapRegionCandidate> | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly saved: boolean;
}

// ── Hook ──

export function useMapAIGen(worldId: string) {
  const [state, setState] = useState<MapGenerateState>({
    candidates: null,
    loading: false,
    error: null,
    saved: false,
  });

  const generate = useCallback(async (): Promise<MapGenerateResponse | null> => {
    setState((s) => ({ ...s, loading: true, error: null, saved: false }));

    try {
      const data = await postApi<MapGenerateResponse>(`/api/worlds/${worldId}/map/generate`, {
        creativity: 5,
      });

      setState({
        candidates: data.candidates,
        loading: false,
        error: null,
        saved: false,
      });

      return data;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setState((s) => ({ ...s, loading: false, error: errorMsg }));
      return null;
    }
  }, [worldId]);

  const confirm = useCallback(async (
    regions: ReadonlyArray<MapRegionCandidate>,
  ): Promise<MapConfirmResult | null> => {
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const data = await postApi<MapConfirmResult>(`/api/worlds/${worldId}/map/confirm`, {
        regions,
      });
      setState((s) => ({ ...s, loading: false, saved: true }));
      return data;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setState((s) => ({ ...s, loading: false, error: errorMsg }));
      return null;
    }
  }, [worldId]);

  const analyzeImage = useCallback(async (
    description: string,
  ): Promise<MapGenerateResponse | null> => {
    setState((s) => ({ ...s, loading: true, error: null, saved: false }));

    try {
      const data = await postApi<MapGenerateResponse>(`/api/worlds/${worldId}/map/image-analyze`, {
        description,
      });

      setState({
        candidates: data.candidates,
        loading: false,
        error: null,
        saved: false,
      });

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
      saved: false,
    });
  }, []);

  return { ...state, generate, confirm, analyzeImage, reset };
}
