import { cn } from "@/lib/utils";
import { toPercent } from "@/lib/api-client";

function tone(pct: number | null) {
  if (pct === null) return "text-muted-foreground";
  if (pct >= 75) return "text-success";
  if (pct >= 50) return "text-warning";
  return "text-destructive";
}

function barTone(pct: number | null) {
  if (pct === null) return "bg-muted-foreground/30";
  if (pct >= 75) return "bg-success";
  if (pct >= 50) return "bg-warning";
  return "bg-destructive";
}

export function ScoreRing({
  value,
  size = 116,
  label = "Overall score",
}: {
  value: number | null | undefined;
  size?: number;
  label?: string;
}) {
  const pct = toPercent(value);
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * ((pct ?? 0) / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={label}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          className="stroke-muted"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className={cn("fill-none transition-[stroke-dasharray] duration-200", tone(pct))}
          stroke="currentColor"
        />
      </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div>
            <span className={cn("text-2xl font-semibold tabular-nums", tone(pct))}>
              {pct === null ? "—" : pct}
            </span>
            <span className="text-sm text-muted-foreground">{pct === null ? "" : "%"}</span>
          </div>
        </div>
      </div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

export function ScoreBar({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  const pct = toPercent(value);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium tabular-nums">{pct === null ? "—" : `${pct}%`}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width] duration-200", barTone(pct))}
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
    </div>
  );
}

export function SkillChips({
  items,
  variant = "neutral",
  emptyLabel = "None",
}: {
  items?: string[] | null | undefined;
  variant?: "matched" | "missing" | "extra" | "neutral";
  emptyLabel?: string;
}) {
  const styles: Record<string, string> = {
    matched: "border-success/30 bg-success/10 text-success",
    missing: "border-destructive/30 bg-destructive/10 text-destructive",
    extra: "border-border bg-muted text-muted-foreground",
    neutral: "border-border bg-secondary text-secondary-foreground",
  };
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className={cn(
            "inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-xs font-medium",
            styles[variant],
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function RecommendationBadge({ value }: { value?: string | null | undefined }) {
  if (!value) return <span className="text-sm text-muted-foreground">—</span>;
  const key = value.toLowerCase();
  const style = key.includes("strong")
    ? "border-success/30 bg-success/10 text-success"
    : key.includes("not") || key.includes("reject")
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : key.includes("maybe") || key.includes("consider")
        ? "border-warning/40 bg-warning/10 text-warning"
        : "border-border bg-secondary text-secondary-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
        style,
      )}
    >
      {value.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}