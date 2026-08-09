import { Link, useRouterState } from "@tanstack/react-router";
import {
  Briefcase,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

export const NAV_ITEMS = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, exact: true },
  { title: "Candidates", url: "/candidates", icon: Users },
  { title: "Jobs", url: "/jobs", icon: Briefcase },
  { title: "Analysis History", url: "/analyses", icon: ClipboardList },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, logout } = useAuth();

  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(`${url}/`);

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-sidebar-primary text-[11px] font-bold text-sidebar-primary-foreground">
          CS
        </span>
        <span className="truncate text-sm font-semibold text-sidebar-foreground">
          Candidate AI Scout
        </span>
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2.5">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.url}
            to={item.url}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors duration-150",
              isActive(item.url, "exact" in item ? item.exact : false)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="truncate">{item.title}</span>
          </Link>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {user?.full_name ?? "—"}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Log out"
            className="size-8 shrink-0"
            onClick={logout}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}