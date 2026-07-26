import { cn } from "@/lib/utils";
import type { Status } from "@/lib/mock-data";

export function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    Shortlisted: "bg-success/15 text-success border-success/30",
    Pending: "bg-warning/15 text-warning border-warning/30",
    Rejected: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium", map[status])}>
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
