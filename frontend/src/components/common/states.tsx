import type { ReactNode } from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api-client";

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const status = error instanceof ApiError ? error.status : undefined;
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="size-5" />
      </div>
      <p className="text-sm font-semibold text-foreground">
        {status ? `Request failed (${status})` : "Couldn't load this data"}
      </p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="size-4" /> Try again
        </Button>
      ) : null}
    </div>
  );
}