// ── Persona API Hooks ──
// Provides React hooks for interacting with the Persona CRUD API.

import { useState, useEffect, useCallback } from "react";
import { fetchJson, putApi, postApi } from "./use-api";
import type { PersonaConfig, AgentRole, PersonaSummary } from "@actalk/inkos-core/models/persona-config.js";

// ── Types ──

interface PersonaListResponse {
  readonly personas: ReadonlyArray<PersonaSummary>;
}

interface PersonaGetResponse {
  readonly config: PersonaConfig;
  readonly body: string;
}

interface PersonaSaveResponse {
  readonly ok: boolean;
  readonly config: PersonaConfig;
}

// ── Load a single persona ──

export function usePersona(agentRole: AgentRole | null) {
  const [config, setConfig] = useState<PersonaConfig | null>(null);
  const [body, setBody] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!agentRole) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<PersonaGetResponse>(`/project/personas/${agentRole}`);
      setConfig(data.config);
      setBody(data.body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [agentRole]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const save = useCallback(async (newConfig: PersonaConfig, newBody: string): Promise<boolean> => {
    if (!agentRole) return false;
    try {
      const result = await putApi<PersonaSaveResponse>(`/project/personas/${agentRole}`, {
        config: newConfig,
        body: newBody,
      });
      if (result.ok) {
        setConfig(result.config);
        setBody(newBody);
        return true;
      }
      return false;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, [agentRole]);

  const resetToDefault = useCallback(async (): Promise<boolean> => {
    if (!agentRole) return false;
    try {
      await fetchJson<void>(`/project/personas/${agentRole}`, { method: "DELETE" });
      void refetch();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, [agentRole, refetch]);

  return { config, body, loading, error, setConfig, setBody, save, resetToDefault, refetch };
}

// ── List all personas ──

export function usePersonaList() {
  const [personas, setPersonas] = useState<ReadonlyArray<PersonaSummary>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<PersonaListResponse>("/project/personas");
      setPersonas(data.personas);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { personas, loading, error, refetch };
}
