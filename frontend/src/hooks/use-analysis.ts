import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Analysis } from "@/lib/api-types";

function toList(payload: unknown): Analysis[] {
  if (Array.isArray(payload)) return payload as Analysis[];
  if (payload && typeof payload === "object") {
    const items = (payload as { items?: unknown }).items;
    if (Array.isArray(items)) return items as Analysis[];
  }
  return [];
}

export function useAnalysisHistory(candidateId?: string) {
  return useQuery({
    queryKey: ["analyses", candidateId],
    queryFn: async () => toList(await api.get<unknown>(`/analyses/candidate/${candidateId}`)),
    enabled: Boolean(candidateId),
    retry: false,
  });
}

export function useAnalysis(analysisId?: string) {
  return useQuery({
    queryKey: ["analysis", analysisId],
    queryFn: () => api.get<Analysis>(`/analyses/${analysisId}`),
    enabled: Boolean(analysisId),
    retry: false,
  });
}