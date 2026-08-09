import { useEffect, useState } from "react";
import { Loader2, Target } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { errorMessage } from "@/components/common/states";
import { AnalysisDetail } from "./analysis-detail";
import { useCandidates } from "@/hooks/use-candidates";
import { useJobs } from "@/hooks/use-jobs";
import { useMatchCandidate } from "@/hooks/use-matching";
import type { MatchResult } from "@/lib/api-types";

export function MatchDialog({
  open,
  onOpenChange,
  candidateId,
  jobId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId?: string;
  jobId?: string;
}) {
  const [candidate, setCandidate] = useState(candidateId ?? "");
  const [job, setJob] = useState(jobId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const candidates = useCandidates({ limit: 100 });
  const jobs = useJobs({ limit: 100 });
  const match = useMatchCandidate();

  useEffect(() => {
    if (open) {
      setCandidate(candidateId ?? "");
      setJob(jobId ?? "");
      setError(null);
      setResult(null);
    }
  }, [open, candidateId, jobId]);

  async function run() {
    setError(null);
    if (!candidate || !job) {
      setError("Select both a candidate and a job.");
      return;
    }
    try {
      const res = await match.mutateAsync({ candidate_id: candidate, job_id: job });
      setResult(res);
      toast.success("Match analysis complete.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Run match analysis</DialogTitle>
          <DialogDescription>
            Score a candidate&apos;s resume against a job&apos;s requirements.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="match_candidate">Candidate</Label>
              <Select value={candidate} onValueChange={setCandidate}>
                <SelectTrigger id="match_candidate">
                  <SelectValue placeholder="Select candidate" />
                </SelectTrigger>
                <SelectContent>
                  {(candidates.data?.items ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="match_job">Job</Label>
              <Select value={job} onValueChange={setJob}>
                <SelectTrigger id="match_job">
                  <SelectValue placeholder="Select job" />
                </SelectTrigger>
                <SelectContent>
                  {(jobs.data?.items ?? []).map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {match.isPending ? (
            <div className="flex items-center gap-2 rounded-lg border border-border p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Scoring candidate against job requirements…
            </div>
          ) : null}

          {result ? <AnalysisDetail result={result} /> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={run} disabled={match.isPending}>
            {match.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Target className="size-4" />
            )}
            {result ? "Re-run" : "Run analysis"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}