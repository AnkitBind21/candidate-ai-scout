import type { ReactNode } from "react";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2">
      <div className="flex min-w-0 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              CS
            </span>
            <span className="text-sm font-semibold">Candidate AI Scout</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p> : null}
          <div className="mt-7">{children}</div>
          {footer ? (
            <p className="mt-6 text-sm text-muted-foreground">{footer}</p>
          ) : null}
        </div>
      </div>

      <div className="hidden border-l border-border bg-secondary/50 p-12 lg:flex lg:flex-col lg:justify-center">
        <blockquote className="max-w-md">
          <p className="text-lg font-medium leading-relaxed">
            Structured screening from job description to shortlist — job parsing, resume
            extraction and candidate matching in one workspace.
          </p>
          <footer className="mt-6 text-sm text-muted-foreground">
            Candidate AI Scout · Recruitment operations
          </footer>
        </blockquote>
        <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-border pt-6">
          {[
            ["Jobs", "Create & parse"],
            ["Resumes", "Parse & extract"],
            ["Matching", "Score & review"],
          ].map(([term, desc]) => (
            <div key={term} className="min-w-0">
              <dt className="truncate text-sm font-semibold">{term}</dt>
              <dd className="truncate text-xs text-muted-foreground">{desc}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}