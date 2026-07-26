import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Search, SlidersHorizontal, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { CandidateDrawer } from "@/components/CandidateDrawer";
import { candidates, type Candidate, type Status } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/candidates")({
  head: () => ({
    meta: [
      { title: "Candidates — AI Resume Screening" },
      { name: "description", content: "Browse, filter and review AI-scored candidates across your open roles." },
      { property: "og:title", content: "Candidates — AI Resume Screening" },
      { property: "og:description", content: "AI-scored candidates across your open roles." },
    ],
  }),
  component: CandidatesPage,
});

function CandidatesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | Status>("all");
  const [sort, setSort] = useState<"score" | "name" | "experience">("score");
  const [page, setPage] = useState(1);
  const perPage = 8;
  const [selected, setSelected] = useState<Candidate | null>(null);

  const filtered = useMemo(() => {
    let list = candidates.filter(
      (c) =>
        (status === "all" || c.status === status) &&
        (q === "" ||
          c.name.toLowerCase().includes(q.toLowerCase()) ||
          c.position.toLowerCase().includes(q.toLowerCase())),
    );
    list = [...list].sort((a, b) => {
      if (sort === "score") return b.score - a.score;
      if (sort === "experience") return b.experience - a.experience;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [q, status, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div>
      <PageHeader
        eyebrow="Talent Pool"
        title="Candidates"
        description="Every applicant, ranked by AI. Click any row to open the full profile."
      />

      <div className="rounded-2xl border border-border bg-card/60 backdrop-blur">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 p-4 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search by name or role…"
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-background/60 border border-border text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Select value={status} onValueChange={(v: any) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-full md:w-44 h-10 rounded-xl bg-background/60">
              <SlidersHorizontal className="size-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="Shortlisted">Shortlisted</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v: any) => setSort(v)}>
            <SelectTrigger className="w-full md:w-44 h-10 rounded-xl bg-background/60">
              <ArrowUpDown className="size-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Sort by AI Score</SelectItem>
              <SelectItem value="name">Sort by Name</SelectItem>
              <SelectItem value="experience">Sort by Experience</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-medium">Candidate</th>
                <th className="px-5 py-3 font-medium">Position</th>
                <th className="px-5 py-3 font-medium">Experience</th>
                <th className="px-5 py-3 font-medium">AI Score</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((c, i) => (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => setSelected(c)}
                  className="border-t border-border hover:bg-primary/5 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarImage src={c.avatar} />
                        <AvatarFallback>{c.name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">{c.position}</td>
                  <td className="px-5 py-4">{c.experience} yrs</td>
                  <td className="px-5 py-4">
                    <ScorePill score={c.score} />
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={c.status} /></td>
                  <td className="px-5 py-4 text-muted-foreground">{c.lastUpdated}</td>
                </motion.tr>
              ))}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    No candidates match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <div className="text-xs text-muted-foreground">
            Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length}
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <Button
                key={i}
                size="sm"
                variant={page === i + 1 ? "default" : "ghost"}
                className={cn("w-9", page === i + 1 && "bg-primary hover:bg-primary/90")}
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </Button>
            ))}
            <Button size="icon" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <CandidateDrawer candidate={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const tone = score >= 82 ? "success" : score >= 70 ? "warning" : "destructive";
  const cls = {
    success: "bg-success/15 text-success border-success/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    destructive: "bg-destructive/15 text-destructive border-destructive/30",
  }[tone];
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "success" && "bg-success",
            tone === "warning" && "bg-warning",
            tone === "destructive" && "bg-destructive",
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-semibold", cls)}>{score}</span>
    </div>
  );
}
