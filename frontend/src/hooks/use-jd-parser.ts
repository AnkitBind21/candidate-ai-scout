import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { ParsedJD } from "@/lib/api-types";

export function useParseJD() {
  return useMutation({
    mutationFn: (text: string) => api.post<ParsedJD>("/jobs/parse-jd", { text }),
  });
}