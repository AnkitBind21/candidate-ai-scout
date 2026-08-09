import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ExternalLink, FileText, RefreshCw, Target, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { RecommendationBadge, SkillChips } from "@/components/common/score";
import { AnalysisDetail } from "@/components/analysis/analysis-detail";
import { MatchDialog } from "@/components/analysis/match-dialog";
import { UploadResumeDialog } from "@/components/resumes/upload-resume-dialog";
import { useCandidate } from "@/hooks/use-candidates";
import { useJob } from "@/hooks/use-jobs";
import { useResumeEntities } from "@/hooks/use-resume";
import { useAnalysisHistory } from "@/hooks/use-analysis";
import { formatDate, toPercent } from "@/lib/api-client";
import type {
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  ProjectEntry,
} from "@/lib/api-types";

export const Route = createFileRoute("/_shell/candidates/$candidateId")({
  head: () => ({
    meta: [
      { title: "Candidate profile — Candidate AI Scout" },
      {
        name: "description",
        content: "Candidate profile with resume parsing, extracted entities and match history.",
      },
      { property: "og:title", content: "Candidate profile — Candidate AI Scout" },
      {
        property: "og:description",
        content: "Candidate profile with resume parsing, extracted entities and match history.",
      },
    ],
  }),
  component: CandidateDetailPage,
});

function EmptyList({ label }: { label: string }) {
  return <p className="text-sm text-muted-foreground">{label}</p>;
}

function EducationList({ items }: { items?: EducationEntry[] | null }) {
  if (!items?.length) return <EmptyList label="No education listed" />;
  return (
    <div className="space-y-2">
      {items.map((entry, i) => {
        const subtitle = [entry.degree, entry.field_of_study].filter(Boolean).join(" · ");
        const years =
          entry.start_year || entry.end_year
            ? `${entry.start_year ?? "—"} – ${entry.end_year ?? "Present"}`
            : null;
        return (
          <div key={i} className="rounded-md border border-border p-3">
            <p className="text-sm font-medium">{entry.institution}</p>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
            {years || entry.gpa ? (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {years ? <span>{years}</span> : null}
                {entry.gpa ? <span>GPA: {entry.gpa}</span> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ExperienceList({ items }: { items?: ExperienceEntry[] | null }) {
  if (!items?.length) return <EmptyList label="No experience listed" />;
  return (
    <div className="space-y-2">
      {items.map((entry, i) => {
        const heading = entry.title ? `${entry.title} · ${entry.company}` : entry.company;
        const dateRange =
          entry.start_date || entry.end_date
            ? `${entry.start_date ?? "—"} – ${entry.is_current ? "Present" : (entry.end_date ?? "—")}`
            : null;
        return (
          <div key={i} className="rounded-md border border-border p-3">
            <p className="text-sm font-medium">{heading}</p>
            {dateRange ? <p className="text-xs text-muted-foreground">{dateRange}</p> : null}
            {entry.responsibilities?.length ? (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                {entry.responsibilities.slice(0, 4).map((r, ri) => (
                  <li key={ri} className="break-words">
                    {r}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ProjectList({ items }: { items?: ProjectEntry[] | null }) {
  if (!items?.length) return <EmptyList label="No projects listed" />;
  return (
    <div className="space-y-2">
      {items.map((entry, i) => (
        <div key={i} className="rounded-md border border-border p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">{entry.name}</p>
            {entry.url ? (
              <a
                href={entry.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="size-3" /> View
              </a>
            ) : null}
          </div>
          {entry.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>
          ) : null}
          {entry.technologies?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {entry.technologies.map((tech) => (
                <Badge key={tech} variant="secondary" className="font-normal">
                  {tech}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function CertificationList({ items }: { items?: CertificationEntry[] | null }) {
  if (!items?.length) return <EmptyList label="No certifications listed" />;
  return (
    <div className="space-y-2">
      {items.map((entry, i) => {
        const subtitle = [entry.issuer, entry.date].filter(Boolean).join(" · ");
        return (
          <div key={i} className="rounded-md border border-border p-3">
            <p className="text-sm font-medium">{entry.name}</p>
            {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

function ResumeEntities({ resumeId }: { resumeId: string }) {
  const [enabled, setEnabled] = useState(false);
  const entities = useResumeEntities(resumeId, enabled);

  if (!enabled) {
    return (
      <Button variant="outline" size="sm" onClick={() => setEnabled(true)}>
        <RefreshCw className="size-4" /> Extract entities
      </Button>
    );
  }
  if (entities.isLoading) return <Skeleton className="h-16 w-full" />;
  if (entities.isError)
    return <ErrorState error={entities.error} onRetry={() => void entities.refetch()} />;

  const data = entities.data;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-sm font-semibold">Skills</h4>
        <SkillChips items={data?.skills} emptyLabel="No skills detected" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <h4 className="mb-1 text-sm font-semibold">Education</h4>
          <EducationList items={data?.education} />
        </div>
        <div className="min-w-0">
          <h4 className="mb-1 text-sm font-semibold">Experience</h4>
          <ExperienceList items={data?.experience} />
        </div>
        <div className="min-w-0">
          <h4 className="mb-1 text-sm font-semibold">Projects</h4>
          <ProjectList items={data?.projects} />
        </div>
        <div className="min-w-0">
          <h4 className="mb-1 text-sm font-semibold">Certifications</h4>
          <CertificationList items={data?.certifications} />
        </div>
      </div>
    </div>
  );
}

function CandidateDetailPage() {
  const { candidateId } = Route.useParams();
  const candidate = useCandidate(candidateId);
  const job = useJob(candidate.data?.job_id);
  const analyses = useAnalysisHistory(candidateId);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [openAnalysis, setOpenAnalysis] = useState<string | null>(null);

  const resumes = candidate.data?.resumes ?? [];

  return (
    <AppShell
      title={candidate.data?.full_name ?? "Candidate"}
      description={candidate.data?.email ?? undefined}
      actions={
        <>
          <Button asChild variant="ghost">
            <Link to="/candidates">
              <ArrowLeft className="size-4" /> Back
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setUploadOpen(true)}>
            <UploadCloud className="size-4" /> Upload resume
          </Button>
          <Button onClick={() => setMatchOpen(true)}>
            <Target className="size-4" /> Run match
          </Button>
        </>
      }
    >
      {candidate.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : candidate.isError ? (
        <ErrorState error={candidate.error} onRetry={() => void candidate.refetch()} />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-4">
              {[
                ["Email", candidate.data?.email || "—"],
                ["Phone", candidate.data?.phone || "—"],
                ["Applied for", job.data?.title ?? "—"],
                ["Added", formatDate(candidate.data?.created_at)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="truncate text-sm">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Tabs defaultValue="resumes">
            <TabsList>
              <TabsTrigger value="resumes">Resumes</TabsTrigger>
              <TabsTrigger value="history">Analysis history</TabsTrigger>
            </TabsList>

            <TabsContent value="resumes" className="mt-4 space-y-4">
              {resumes.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={<FileText className="size-5" />}
                    title="No resumes uploaded"
                    description="Upload a PDF, DOC, DOCX or TXT resume to parse it."
                    action={
                      <Button onClick={() => setUploadOpen(true)}>
                        <UploadCloud className="size-4" /> Upload resume
                      </Button>
                    }
                  />
                </Card>
              ) : (
                resumes.map((resume) => (
                  <Card key={resume.id}>
                    <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-sm">
                          {resume.original_filename}
                        </CardTitle>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDate(resume.created_at)}
                          {resume.file_size ? ` · ${(resume.file_size / 1024).toFixed(0)} KB` : ""}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 uppercase">
                        {resume.file_type || "file"}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <ResumeEntities resumeId={resume.id} />
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card className="overflow-hidden p-0">
                {analyses.isLoading ? (
                  <TableSkeleton cols={4} />
                ) : analyses.isError ? (
                  <ErrorState error={analyses.error} onRetry={() => void analyses.refetch()} />
                ) : (analyses.data ?? []).length === 0 ? (
                  <EmptyState
                    icon={<Target className="size-5" />}
                    title="No analyses yet"
                    description="Run a match to score this candidate against a job."
                    action={
                      <Button onClick={() => setMatchOpen(true)}>
                        <Target className="size-4" /> Run match
                      </Button>
                    }
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {(analyses.data ?? []).map((analysis, index) => {
                      const id = analysis.id ?? String(index);
                      const expanded = openAnalysis === id;
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => setOpenAnalysis(expanded ? null : id)}
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
            </TabsContent>
          </Tabs>
        </div>
      )}

      <UploadResumeDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        candidateId={candidateId}
      />
      <MatchDialog
        open={matchOpen}
        onOpenChange={setMatchOpen}
        candidateId={candidateId}
        {...(candidate.data?.job_id ? { jobId: candidate.data.job_id } : {})}
      />
    </AppShell>
  );
}