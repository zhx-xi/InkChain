// ── Persona Preset API Hooks (Per-6) ──
// Provides React hooks for interacting with the Persona Preset API.

import { useState, useEffect, useCallback } from "react";
import { fetchJson, postApi } from "./use-api";
import type { PersonaPreset } from "@actalk/inkchain-core/models/persona-config.js";

// ── Types ──

interface PresetSummaryData {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly source: "builtin" | "project";
  readonly version: number;
}

interface PresetListResponse {
  readonly presets: ReadonlyArray<PresetSummaryData>;
}

interface PresetGetResponse {
  readonly preset: PersonaPreset;
}

interface PresetSaveResponse {
  readonly ok: boolean;
  readonly presetId: string;
}

interface PresetApplyResponse {
  readonly ok: boolean;
}

// ── Hook: Preset List ──

export function usePresetList() {
  const [presets, setPresets] = useState<ReadonlyArray<PresetSummaryData>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<PresetListResponse>("/project/presets");
      setPresets(data.presets);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { presets, loading, error, refetch };
}

// ── Hook: Preset Detail ──

export function usePresetDetail(presetId: string | null) {
  const [preset, setPreset] = useState<PersonaPreset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!presetId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<PresetGetResponse>(`/project/presets/${presetId}`);
      setPreset(data.preset);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [presetId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { preset, loading, error, refetch };
}

// ── Hook: Apply Preset ──

export function useApplyPreset() {
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(async (presetId: string): Promise<boolean> => {
    setApplying(true);
    setError(null);
    try {
      const data = await postApi<PresetApplyResponse>(`/project/presets/${presetId}/apply`, {});
      return data.ok;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setApplying(false);
    }
  }, []);

  return { apply, applying, error };
}

// ── Hook: Save Preset ──

export function useSavePreset() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async (
    name: string,
    description: string,
    personas: Record<string, unknown>,
  ): Promise<string | null> => {
    setSaving(true);
    setError(null);
    try {
      const data = await postApi<PresetSaveResponse>("/project/presets", {
        name,
        description,
        personas,
      });
      return data.presetId;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  return { save, saving, error };
}
