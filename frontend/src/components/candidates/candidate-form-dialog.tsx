import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
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
import { useCreateCandidate } from "@/hooks/use-candidates";
import { useJobs } from "@/hooks/use-jobs";
import type { Candidate } from "@/lib/api-types";

export function CandidateFormDialog({
  open,
  onOpenChange,
  defaultJobId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultJobId?: string;
  onCreated?: (candidate: Candidate) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobId, setJobId] = useState(defaultJobId ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const jobs = useJobs({ limit: 100 });
  const createCandidate = useCreateCandidate();

  useEffect(() => {
    if (open) {
      setFullName("");
      setEmail("");
      setPhone("");
      setJobId(defaultJobId ?? "");
      setErrors({});
      setApiError(null);
    }
  }, [open, defaultJobId]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setApiError(null);
    const next: Record<string, string> = {};
    if (fullName.trim().length < 2) next["full_name"] = "Enter the candidate's name.";
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) next["email"] = "Invalid email.";
    if (!jobId) next["job_id"] = "Select the job this candidate applies to.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      const created = await createCandidate.mutateAsync({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        job_id: jobId,
      });
      toast.success("Candidate added.");
      onOpenChange(false);
      onCreated?.(created);
    } catch (err) {
      setApiError(errorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add candidate</DialogTitle>
          <DialogDescription>Create a candidate record, then upload a resume.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {apiError ? (
            <Alert variant="destructive">
              <AlertDescription>{apiError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="candidate_name">Full name</Label>
            <Input
              id="candidate_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            {errors["full_name"] ? (
              <p className="text-xs text-destructive">{errors["full_name"]}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="candidate_email">Email</Label>
              <Input
                id="candidate_email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {errors["email"] ? (
                <p className="text-xs text-destructive">{errors["email"]}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="candidate_phone">Phone</Label>
              <Input
                id="candidate_phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="candidate_job">Job</Label>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger id="candidate_job">
                <SelectValue placeholder={jobs.isLoading ? "Loading jobs…" : "Select a job"} />
              </SelectTrigger>
              <SelectContent>
                {(jobs.data?.items ?? []).map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors["job_id"] ? (
              <p className="text-xs text-destructive">{errors["job_id"]}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createCandidate.isPending}>
              {createCandidate.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Add candidate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}