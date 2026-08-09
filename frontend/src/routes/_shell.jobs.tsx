import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Briefcase, MoreHorizontal, Pencil, Plus, Sparkles, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState, ErrorState, TableSkeleton, errorMessage } from "@/components/common/states";
import { JobFormDialog, type JobDraft } from "@/components/jobs/job-form-dialog";
import { ParseJDDialog } from "@/components/jobs/parse-jd-dialog";
import { MatchDialog } from "@/components/analysis/match-dialog";
import { useDeleteJob, useJobs } from "@/hooks/use-jobs";
import { formatDate } from "@/lib/api-client";
import type { Job } from "@/lib/api-types";

export const Route = createFileRoute("/_shell/jobs")({
  head: () => ({
    meta: [
      { title: "Jobs — Candidate AI Scout" },
      {
        name: "description",
        content: "Create, parse and manage the job requisitions used for candidate matching.",
      },
      { property: "og:title", content: "Jobs — Candidate AI Scout" },
      {
        property: "og:description",
        content: "Create, parse and manage the job requisitions used for candidate matching.",
      },
    ],
  }),
  component: JobsPage,
});

const PAGE_SIZE = 20;

function JobsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [jdOpen, setJdOpen] = useState(false);
  const [matchJob, setMatchJob] = useState<string | null>(null);
  const [editing, setEditing] = useState<Job | null>(null);
  const [draft, setDraft] = useState<JobDraft | null>(null);
  const [deleting, setDeleting] = useState<Job | null>(null);

  const jobs = useJobs({ skip: page * PAGE_SIZE, limit: PAGE_SIZE, search });
  const deleteJob = useDeleteJob();
  const items = jobs.data?.items ?? [];
  const total = jobs.data?.total ?? 0;

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteJob.mutateAsync(deleting.id);
      toast.success("Job deleted.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <AppShell
      title="Jobs"
      description="Roles and their extracted requirements"
      actions={
        <>
          <Button variant="outline" onClick={() => setJdOpen(true)}>
            <Sparkles className="size-4" /> Parse JD
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setDraft(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" /> New job
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Search jobs by title…"
          className="max-w-sm"
        />

        <Card className="overflow-hidden p-0">
          {jobs.isLoading ? (
            <TableSkeleton cols={5} />
          ) : jobs.isError ? (
            <ErrorState error={jobs.error} onRetry={() => void jobs.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="size-5" />}
              title="No jobs found"
              description="Create a job manually or parse an existing job description."
              action={
                <Button
                  onClick={() => {
                    setEditing(null);
                    setDraft(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="size-4" /> New job
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="max-w-[18rem]">
                        <span className="block truncate font-medium">{job.title}</span>
                        {job.status ? (
                          <Badge variant="secondary" className="mt-1 capitalize">
                            {job.status}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {job.department || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {job.location || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {job.min_experience != null || job.max_experience != null
                          ? `${job.min_experience ?? "?"}–${job.max_experience ?? "?"} yrs`
                          : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(job.created_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Job actions">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditing(job);
                                setDraft(null);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="size-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setMatchJob(job.id)}>
                              <Target className="size-4" /> Run match
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleting(job)}
                            >
                              <Trash2 className="size-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {total > PAGE_SIZE ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(page + 1) * PAGE_SIZE >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <JobFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        job={editing}
        draft={draft}
      />
      <ParseJDDialog
        open={jdOpen}
        onOpenChange={setJdOpen}
        onUseForJob={(next) => {
          setEditing(null);
          setDraft(next);
          setJdOpen(false);
          setFormOpen(true);
        }}
      />
      <MatchDialog
        open={matchJob !== null}
        onOpenChange={(next) => !next && setMatchJob(null)}
        {...(matchJob ? { jobId: matchJob } : {})}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.title}” will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}