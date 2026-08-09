import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { ExtractedEntities, ResumeUploadResponse } from "@/lib/api-types";

export function useUploadResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ candidateId, file }: { candidateId: string; file: File }) => {
      const formData = new FormData();
      formData.append("candidate_id", candidateId);
      formData.append("file", file);
      // Content-Type is intentionally not set: the browser adds the boundary.
      return api.upload<ResumeUploadResponse>("/resume/upload", formData);
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ["candidate", vars.candidateId] });
      void qc.invalidateQueries({ queryKey: ["candidates"] });
    },
  });
}

export function useResumeEntities(resumeId?: string, enabled = false) {
  return useQuery({
    queryKey: ["resume-entities", resumeId],
    queryFn: () => api.get<ExtractedEntities>(`/resume/${resumeId}/entities`),
    enabled: Boolean(resumeId) && enabled,
    retry: false,
  });
}