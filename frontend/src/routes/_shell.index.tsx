import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Briefcase, ClipboardList, FileText, Plus, Sparkles, Target, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/states";
import { JobFormDialog, type JobDraft } from "@/components/jobs/job-form-dialog";
import { ParseJDDialog } from "@/components/jobs/parse-jd-dialog";
import { CandidateFormDialog } from "@/components/candidates/candidate-form-dialog";
import { MatchDialog } from "@/components/analysis/match-dialog";
import { useJobs } from "@/hooks/use-jobs";
import { useCandidates } from "@/hooks/use-candidates";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/api-client";

export const Route = createFileRoute("/_shell/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Candidate AI Scout" },
      {
        name: "description",
        content: "Recruitment overview: open jobs, candidate pipeline and recent match analyses.",
      },
      { property: "og:title", content: "Dashboard — Candidate AI Scout" },
      {
        property: "og:description",
        content: "Recruitment overview: open jobs, candidate pipeline and recent match analyses.",
      },
    ],
  }),
  component: DashboardPage,
});

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-14" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          )}
        </div>
        <div className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const { user } = useAuth();
  const jobs = useJobs({ limit: 5 });
  const candidates = useCandidates({ limit: 5 });
  const [jobOpen, setJobOpen] = useState(false);
  const [jdOpen, setJdOpen] = useState(false);
  const [candidateOpen, setCandidateOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [draft, setDraft] = useState<JobDraft | null>(null);

  const openJobs = (jobs.data?.items ?? []).filter(
    (j) => (j.status ?? "open").toLowerCase() === "open",
  ).length;

  return (
    <AppShell
      title="Dashboard"
      description={user ? `Welcome back, ${user.full_name}` : undefined}
    >
      <div className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total jobs"
            value={jobs.data?.total ?? 0}
            icon={Briefcase}
            loading={jobs.isLoading}
          />
          <StatCard
            label="Open roles (page)"
            value={openJobs}
            icon={ClipboardList}
            loading={jobs.isLoading}
          />
          <StatCard
            label="Total candidates"
            value={candidates.data?.total ?? 0}
            icon={Users}
            loading={candidates.isLoading}
          />
          <StatCard
            label="Resumes on file"
            value={(candidates.data?.items ?? []).reduce(
              (sum, c) => sum + (c.resumes?.length ?? 0),
              0,
            )}
            icon={FileText}
            loading={candidates.isLoading}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Quick actions</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setDraft(null);
                setJobOpen(true);
              }}
            >
              <Plus className="size-4" /> Create job
            </Button>
            <Button variant="outline" onClick={() => setJdOpen(true)}>
              <Sparkles className="size-4" /> Parse job description
            </Button>
            <Button variant="outline" onClick={() => setCandidateOpen(true)}>
              <Users className="size-4" /> Add candidate
            </Button>
            <Button variant="outline" onClick={() => setMatchOpen(true)}>
              <Target className="size-4" /> Run match
            </Button>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <CardTitle className="truncate text-sm">Recent jobs</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/jobs">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {jobs.isLoading ? (
                <div className="space-y-3 p-5">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (jobs.data?.items ?? []).length === 0 ? (
                <EmptyState title="No jobs yet" description="Create your first role to begin." />
              ) : (
                <ul className="divide-y divide-border">
                  {(jobs.data?.items ?? []).map((job) => (
                    <li key={job.id} className="px-5 py-3">
                      <p className="truncate text-sm font-medium">{job.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[job.department, job.location].filter(Boolean).join(" · ") ||
                          formatDate(job.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <CardTitle className="truncate text-sm">Recent candidates</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/candidates">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {candidates.isLoading ? (
                <div className="space-y-3 p-5">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (candidates.data?.items ?? []).length === 0 ? (
                <EmptyState
                  title="No candidates yet"
                  description="Add a candidate and upload their resume."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {(candidates.data?.items ?? []).map((candidate) => (
                    <li key={candidate.id} className="px-5 py-3">
                      <Link
                        to="/candidates/$candidateId"
                        params={{ candidateId: candidate.id }}
                        className="block min-w-0"
                      >
                        <p className="truncate text-sm font-medium hover:underline">
                          {candidate.full_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {candidate.email || formatDate(candidate.created_at)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <JobFormDialog open={jobOpen} onOpenChange={setJobOpen} draft={draft} />
      <ParseJDDialog
        open={jdOpen}
        onOpenChange={setJdOpen}
        onUseForJob={(next) => {
          setDraft(next);
          setJdOpen(false);
          setJobOpen(true);
        }}
      />
      <CandidateFormDialog open={candidateOpen} onOpenChange={setCandidateOpen} />
      <MatchDialog open={matchOpen} onOpenChange={setMatchOpen} />
    </AppShell>
  );
}