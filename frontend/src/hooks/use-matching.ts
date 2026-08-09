import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { MatchResponse, MatchResult } from "@/lib/api-types";

export function useMatchCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      candidate_id,
      job_id,
    }: {
      candidate_id: string;
      job_id: string;
    }): Promise<MatchResult> => {
      // POST /match returns { candidate_id, job_id, result, warnings } --
      // the score/recommendation/skill fields callers need live under
      // `result`, not at the top level. Unwrap here so every consumer of
      // this hook (MatchDialog, AnalysisDetail, etc.) keeps working with a
      // flat MatchResult, same as before.
      const response = await api.post<MatchResponse>("/match", { candidate_id, job_id });
      return response.result;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ["analyses", vars.candidate_id] });
    },
  });
}
