import { formatDate, safeParseNotes } from "@/lib/api-client";
import type { MatchResult } from "@/lib/api-types";
import { RecommendationBadge, ScoreBar, ScoreRing, SkillChips } from "@/components/common/score";

export function AnalysisDetail({ result }: { result: MatchResult }) {
  const notes = safeParseNotes(result.notes);
  return (
    <div className="space-y-6">
      <div className="grid gap-6 rounded-lg border border-border bg-card p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <ScoreRing value={result.overall_score} />
        <div className="min-w-0 space-y-3">
          <ScoreBar label="Skill score" value={result.skill_score} />
          <ScoreBar label="Experience score" value={result.experience_score} />
          <ScoreBar label="Education score" value={result.education_score} />
        </div>
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">Recommendation</dt>
          <dd className="mt-1">
            <RecommendationBadge value={result.recommendation} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">Status</dt>
          <dd className="mt-1 truncate text-sm capitalize">{result.status ?? "—"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">Created</dt>
          <dd className="mt-1 truncate text-sm">{formatDate(result.created_at)}</dd>
        </div>
      </dl>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="min-w-0">
          <h3 className="mb-2 text-sm font-semibold">Matched skills</h3>
          <SkillChips items={result.matched_skills} variant="matched" emptyLabel="No matches" />
        </section>
        <section className="min-w-0">
          <h3 className="mb-2 text-sm font-semibold">Missing skills</h3>
          <SkillChips items={result.missing_skills} variant="missing" emptyLabel="None missing" />
        </section>
        <section className="min-w-0">
          <h3 className="mb-2 text-sm font-semibold">Extra skills</h3>
          <SkillChips items={result.extra_skills} variant="extra" emptyLabel="None" />
        </section>
      </div>

      {notes.text || notes.json ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Notes</h3>
          {notes.text ? (
            <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {notes.text}
            </p>
          ) : (
            <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/50 p-3 text-xs">
              {JSON.stringify(notes.json, null, 2)}
            </pre>
          )}
        </section>
      ) : null}
    </div>
  );
}