import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_shell")({
  // Auth token lives in browser storage, so this subtree is client-rendered.
  ssr: false,
  component: ShellLayout,
});

function ShellLayout() {
  const { ready, token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !token) void navigate({ to: "/login", replace: true });
  }, [ready, token, navigate]);

  if (!ready || !token) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Outlet />;
}