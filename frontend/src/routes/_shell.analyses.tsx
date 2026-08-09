import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Target } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { RecommendationBadge } from "@/components/common/score";
import { AnalysisDetail } from "@/components/analysis/analysis-detail";
import { MatchDialog } from "@/components/analysis/match-dialog";
import { useAnalysisHistory } from "@/hooks/use-analysis";
import { useCandidates } from "@/hooks/use-candidates";
import { formatDate, toPercent } from "@/lib/api-client";

export const Route = createFileRoute("/_shell/analyses")({
  head: () => ({
    meta: [
      { title: "Analysis history — Candidate AI Scout" },
      {
        name: "description",
        content: "Review past candidate-to-job match analyses, scores and recommendations.",
      },
      { property: "og:title", content: "Analysis history — Candidate AI Scout" },
      {
        property: "og:description",
        content: "Review past candidate-to-job match analyses, scores and recommendations.",
      },
    ],
  }),
  component: AnalysesPage,
});

function AnalysesPage() {
  const [candidateId, setCandidateId] = useState("");
  const [matchOpen, setMatchOpen] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const candidates = useCandidates({ limit: 100 });
  const analyses = useAnalysisHistory(candidateId || undefined);
  const rows = analyses.data ?? [];

  return (
    <AppShell
      title="Analysis history"
      description="Match results per candidate"
      actions={
        <Button onClick={() => setMatchOpen(true)}>
          <Target className="size-4" /> Run match
        </Button>
      }
    >
      <div className="space-y-4">
        <Select value={candidateId} onValueChange={setCandidateId}>
          <SelectTrigger className="w-full max-w-sm" aria-label="Select candidate">
            <SelectValue placeholder="Select a candidate to view history" />
          </SelectTrigger>
          <SelectContent>
            {(candidates.data?.items ?? []).map((candidate) => (
              <SelectItem key={candidate.id} value={candidate.id}>
                {candidate.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Card className="overflow-hidden p-0">
          {!candidateId ? (
            <EmptyState
              icon={<Target className="size-5" />}
              title="Pick a candidate"
              description="Analysis history is grouped per candidate."
            />
          ) : analyses.isLoading ? (
            <TableSkeleton cols={4} />
          ) : analyses.isError ? (
            <ErrorState error={analyses.error} onRetry={() => void analyses.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Target className="size-5" />}
              title="No analyses for this candidate"
              description="Run a match to generate the first result."
              action={
                <Button onClick={() => setMatchOpen(true)}>
                  <Target className="size-4" /> Run match
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((analysis, index) => {
                const id = analysis.id ?? String(index);
                const expanded = openRow === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setOpenRow(expanded ? null : id)}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 text-left hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {formatDate(analysis.created_at)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          Job {analysis.job_id ?? "—"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <RecommendationBadge value={analysis.recommendation} />
                        <span className="text-sm font-semibold tabular-nums">
                          {toPercent(analysis.overall_score) ?? "—"}%
                        </span>
                      </div>
                    </button>
                    {expanded ? (
                      <div className="border-t border-border bg-muted/20 px-5 py-5">
                        <AnalysisDetail result={analysis} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <MatchDialog
        open={matchOpen}
        onOpenChange={setMatchOpen}
        {...(candidateId ? { candidateId } : {})}
      />
    </AppShell>
  );
}