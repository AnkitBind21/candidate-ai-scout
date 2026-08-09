import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SkillChips } from "@/components/common/score";
import { errorMessage } from "@/components/common/states";
import { useParseJD } from "@/hooks/use-jd-parser";
import type { JobEntities, ParsedJD } from "@/lib/api-types";
import type { JobDraft } from "./job-form-dialog";

function sectionList(value: ParsedJD["detected_sections"]): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === "object") return Object.keys(value);
  return [];
}

function toDraft(entities: JobEntities, description: string): JobDraft {
  return {
    title: entities.title ?? "",
    description,
    department: entities.department ?? "",
    location: entities.location ?? "",
    employment_type: entities.employment_type ?? "",
    min_experience: entities.min_experience ?? null,
    max_experience: entities.max_experience ?? null,
    required_skills: entities.required_skills ?? [],
  };
}

export function ParseJDDialog({
  open,
  onOpenChange,
  onUseForJob,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseForJob: (draft: JobDraft) => void;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ParsedJD | null>(null);
  const [error, setError] = useState<string | null>(null);
  const parse = useParseJD();

  async function onParse() {
    setError(null);
    setResult(null);
    if (text.trim().length < 30) {
      setError("Paste at least a few sentences of the job description.");
      return;
    }
    try {
      setResult(await parse.mutateAsync(text));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const entities = result?.entities;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setResult(null);
          setError(null);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Parse job description</DialogTitle>
          <DialogDescription>
            Extract structured requirements from raw JD text. Nothing is saved until you create
            the job.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the full job description here…"
          />

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {result ? (
            <div className="space-y-5 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>Words: {result.word_count ?? "—"}</span>
                <span>Structured: {result.is_structured ? "yes" : "no"}</span>
                <span>Sections: {sectionList(result.detected_sections).length}</span>
              </div>

              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  ["Title", entities?.title],
                  ["Department", entities?.department],
                  ["Location", entities?.location],
                  ["Employment type", entities?.employment_type],
                  [
                    "Experience",
                    entities?.min_experience != null || entities?.max_experience != null
                      ? `${entities?.min_experience ?? "?"}–${entities?.max_experience ?? "?"} yrs`
                      : null,
                  ],
                ].map(([label, value]) => (
                  <div key={String(label)} className="min-w-0">
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className="truncate text-sm">{value ? String(value) : "—"}</dd>
                  </div>
                ))}
              </dl>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <h4 className="mb-2 text-sm font-semibold">Required skills</h4>
                  <SkillChips items={entities?.required_skills} variant="matched" />
                </div>
                <div className="min-w-0">
                  <h4 className="mb-2 text-sm font-semibold">Preferred skills</h4>
                  <SkillChips items={entities?.preferred_skills} />
                </div>
              </div>

              {entities?.responsibilities?.length ? (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Responsibilities</h4>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {entities.responsibilities.slice(0, 8).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {result.warnings?.length ? (
                <Alert>
                  <AlertDescription>
                    <ul className="list-disc pl-4">
                      {result.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onParse} variant="secondary" disabled={parse.isPending}>
            {parse.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Parse
          </Button>
          {result ? (
            <Button onClick={() => onUseForJob(toDraft(result.entities, text))}>
              Use for new job
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}