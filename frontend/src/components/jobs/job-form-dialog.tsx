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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { errorMessage } from "@/components/common/states";
import { useCreateJob, useUpdateJob } from "@/hooks/use-jobs";
import type { Job, JobPayload } from "@/lib/api-types";

export interface JobDraft {
  title?: string;
  description?: string;
  department?: string;
  location?: string;
  employment_type?: string;
  min_experience?: number | null;
  max_experience?: number | null;
  required_skills?: string[];
}

const EMPLOYMENT_TYPES = ["full-time", "part-time", "contract", "internship", "temporary"];

function emptyForm() {
  return {
    title: "",
    description: "",
    department: "",
    location: "",
    employment_type: "",
    min_experience: "",
    max_experience: "",
    required_skills: "",
  };
}

function fromDraft(draft?: JobDraft | Job | null) {
  const base = emptyForm();
  if (!draft) return base;
  return {
    title: draft.title ?? "",
    description: draft.description ?? "",
    department: draft.department ?? "",
    location: draft.location ?? "",
    employment_type: draft.employment_type ?? "",
    min_experience: draft.min_experience == null ? "" : String(draft.min_experience),
    max_experience: draft.max_experience == null ? "" : String(draft.max_experience),
    required_skills: (draft.required_skills ?? []).join(", "),
  };
}

export function JobFormDialog({
  open,
  onOpenChange,
  job,
  draft,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job?: Job | null;
  draft?: JobDraft | null;
  onSaved?: (job: Job) => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const pending = createJob.isPending || updateJob.isPending;

  useEffect(() => {
    if (open) {
      setForm(fromDraft(job ?? draft));
      setErrors({});
      setApiError(null);
    }
  }, [open, job, draft]);

  function set(key: keyof ReturnType<typeof emptyForm>, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setApiError(null);
    const next: Record<string, string> = {};
    if (form.title.trim().length < 2) next["title"] = "Job title is required.";
    const min = form.min_experience === "" ? null : Number(form.min_experience);
    const max = form.max_experience === "" ? null : Number(form.max_experience);
    if (min !== null && (Number.isNaN(min) || min < 0)) next["min_experience"] = "Invalid number.";
    if (max !== null && (Number.isNaN(max) || max < 0)) next["max_experience"] = "Invalid number.";
    if (min !== null && max !== null && max < min)
      next["max_experience"] = "Must be greater than min.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const payload: JobPayload = {
      title: form.title.trim(),
      description: form.description.trim(),
      department: form.department.trim(),
      location: form.location.trim(),
      employment_type: form.employment_type,
      min_experience: min,
      max_experience: max,
      required_skills: form.required_skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      const saved = job
        ? await updateJob.mutateAsync({ id: job.id, payload })
        : await createJob.mutateAsync(payload);
      toast.success(job ? "Job updated." : "Job created.");
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      setApiError(errorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{job ? "Edit job" : "Create job"}</DialogTitle>
          <DialogDescription>
            Define the role requirements used for candidate matching.
          </DialogDescription>
        </DialogHeader>

        <form id="job-form" onSubmit={onSubmit} className="space-y-4" noValidate>
          {apiError ? (
            <Alert variant="destructive">
              <AlertDescription>{apiError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="title">Job title</Label>
            <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} />
            {errors["title"] ? (
              <p className="text-xs text-destructive">{errors["title"]}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="employment_type">Employment type</Label>
              <Select
                value={form.employment_type}
                onValueChange={(v) => set("employment_type", v)}
              >
                <SelectTrigger id="employment_type">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="capitalize">
                      {type.replace("-", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min_experience">Min experience (yrs)</Label>
              <Input
                id="min_experience"
                inputMode="numeric"
                value={form.min_experience}
                onChange={(e) => set("min_experience", e.target.value)}
              />
              {errors["min_experience"] ? (
                <p className="text-xs text-destructive">{errors["min_experience"]}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max_experience">Max experience (yrs)</Label>
              <Input
                id="max_experience"
                inputMode="numeric"
                value={form.max_experience}
                onChange={(e) => set("max_experience", e.target.value)}
              />
              {errors["max_experience"] ? (
                <p className="text-xs text-destructive">{errors["max_experience"]}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="required_skills">Required skills</Label>
            <Input
              id="required_skills"
              value={form.required_skills}
              onChange={(e) => set("required_skills", e.target.value)}
              placeholder="python, sql, aws"
            />
            <p className="text-xs text-muted-foreground">Comma separated.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={7}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="job-form" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {job ? "Save changes" : "Create job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}