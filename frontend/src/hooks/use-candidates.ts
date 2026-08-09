import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Candidate, CandidateListResponse, CandidatePayload } from "@/lib/api-types";

export interface CandidatesParams {
  skip?: number;
  limit?: number;
  search?: string;
  job_id?: string;
}

function query(params: CandidatesParams) {
  const sp = new URLSearchParams();
  sp.set("skip", String(params.skip ?? 0));
  sp.set("limit", String(params.limit ?? 20));
  if (params.search) sp.set("search", params.search);
  if (params.job_id) sp.set("job_id", params.job_id);
  return sp.toString();
}

export function useCandidates(params: CandidatesParams = {}) {
  return useQuery({
    queryKey: ["candidates", params],
    queryFn: () => api.get<CandidateListResponse>(`/candidate?${query(params)}`),
  });
}

export function useCandidate(candidateId?: string) {
  return useQuery({
    queryKey: ["candidate", candidateId],
    queryFn: () => api.get<Candidate>(`/candidate/${candidateId}`),
    enabled: Boolean(candidateId),
  });
}

export function useCreateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CandidatePayload) => api.post<Candidate>("/candidate", payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["candidates"] }),
  });
}