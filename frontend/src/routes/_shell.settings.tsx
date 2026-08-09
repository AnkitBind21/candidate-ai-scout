import { createFileRoute } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { API_BASE_URL, formatDate } from "@/lib/api-client";

export const Route = createFileRoute("/_shell/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Candidate AI Scout" },
      { name: "description", content: "Account details, appearance and API connection settings." },
      { property: "og:title", content: "Settings — Candidate AI Scout" },
      {
        property: "og:description",
        content: "Account details, appearance and API connection settings.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <AppShell title="Settings" description="Account and workspace preferences">
      <div className="grid max-w-3xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Account</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {[
              ["Name", user?.full_name ?? "—"],
              ["Email", user?.email ?? "—"],
              ["Member since", formatDate(user?.created_at)],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="truncate text-sm">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Appearance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <p className="min-w-0 text-sm text-muted-foreground">
              Currently using the {theme} theme.
            </p>
            <Button variant="outline" onClick={toggle} className="shrink-0">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              Switch to {theme === "dark" ? "light" : "dark"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">API connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="break-all text-sm">{API_BASE_URL}</p>
            <p className="text-xs text-muted-foreground">
              Configured with VITE_API_BASE_URL. Requests are sent with your bearer token.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Session</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={logout}>
              Log out
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}