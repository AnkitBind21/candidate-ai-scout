import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { CandidateFormDialog } from "@/components/candidates/candidate-form-dialog";
import { useCandidates } from "@/hooks/use-candidates";
import { useJobs } from "@/hooks/use-jobs";
import { formatDate } from "@/lib/api-client";

export const Route = createFileRoute("/_shell/candidates/")({
  head: () => ({
    meta: [
      { title: "Candidates — Candidate AI Scout" },
      {
        name: "description",
        content: "Browse your candidate pipeline, resumes and match analyses.",
      },
      { property: "og:title", content: "Candidates — Candidate AI Scout" },
      {
        property: "og:description",
        content: "Browse your candidate pipeline, resumes and match analyses.",
      },
    ],
  }),
  component: CandidatesPage,
});

const PAGE_SIZE = 20;
const ALL = "all";

function CandidatesPage() {
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState(ALL);
  const [page, setPage] = useState(0);
  const [addOpen, setAddOpen] = useState(false);

  const jobs = useJobs({ limit: 100 });
  const candidates = useCandidates({
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
    search,
    ...(jobFilter === ALL ? {} : { job_id: jobFilter }),
  });

  const items = candidates.data?.items ?? [];
  const total = candidates.data?.total ?? 0;
  const jobTitle = (id: string) =>
    (jobs.data?.items ?? []).find((job) => job.id === id)?.title ?? "—";

  return (
    <AppShell
      title="Candidates"
      description="Applicants, resumes and screening status"
      actions={
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> Add candidate
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search by name or email…"
            className="max-w-sm"
          />
          <Select
            value={jobFilter}
            onValueChange={(value) => {
              setJobFilter(value);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-56" aria-label="Filter by job">
              <SelectValue placeholder="All jobs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All jobs</SelectItem>
              {(jobs.data?.items ?? []).map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="overflow-hidden p-0">
          {candidates.isLoading ? (
            <TableSkeleton cols={5} />
          ) : candidates.isError ? (
            <ErrorState error={candidates.error} onRetry={() => void candidates.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Users className="size-5" />}
              title="No candidates found"
              description="Add a candidate and upload their resume to start screening."
              action={
                <Button onClick={() => setAddOpen(true)}>
                  <Plus className="size-4" /> Add candidate
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead>Resumes</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((candidate) => (
                    <TableRow key={candidate.id}>
                      <TableCell className="max-w-[16rem]">
                        <Link
                          to="/candidates/$candidateId"
                          params={{ candidateId: candidate.id }}
                          className="block truncate font-medium hover:underline"
                        >
                          {candidate.full_name}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[16rem] text-muted-foreground">
                        <span className="block truncate">{candidate.email || "—"}</span>
                        <span className="block truncate text-xs">{candidate.phone || ""}</span>
                      </TableCell>
                      <TableCell className="max-w-[14rem] truncate text-muted-foreground">
                        {jobTitle(candidate.job_id)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{candidate.resumes?.length ?? 0}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(candidate.created_at)}
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

      <CandidateFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        {...(jobFilter === ALL ? {} : { defaultJobId: jobFilter })}
      />
    </AppShell>
  );
}