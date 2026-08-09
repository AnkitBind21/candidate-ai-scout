import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Job, JobListResponse, JobPayload } from "@/lib/api-types";

export interface JobsParams {
  skip?: number;
  limit?: number;
  search?: string;
  status?: string;
}

function query(params: JobsParams) {
  const sp = new URLSearchParams();
  sp.set("skip", String(params.skip ?? 0));
  sp.set("limit", String(params.limit ?? 20));
  if (params.search) sp.set("search", params.search);
  if (params.status) sp.set("status", params.status);
  return sp.toString();
}

export function useJobs(params: JobsParams = {}) {
  return useQuery({
    queryKey: ["jobs", params],
    queryFn: () => api.get<JobListResponse>(`/jobs?${query(params)}`),
  });
}

export function useJob(jobId?: string) {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: () => api.get<Job>(`/jobs/${jobId}`),
    enabled: Boolean(jobId),
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: JobPayload) => api.post<Job>("/jobs", payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<JobPayload> }) =>
      api.put<Job>(`/jobs/${id}`, payload),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["job", vars.id] });
    },
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/jobs/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}