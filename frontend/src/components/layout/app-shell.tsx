import { useState, type ReactNode } from "react";
import { Menu, Moon, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@tanstack/react-router";
import { SidebarNav } from "./app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border lg:block">
        <div className="fixed inset-y-0 left-0 w-60 border-r border-sidebar-border">
          <SidebarNav />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[17rem] p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarNav onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">{title}</h1>
            {description ? (
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                {description}
              </p>
            ) : null}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label="Toggle theme"
            className="shrink-0"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0" aria-label="User menu">
                <User className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">
                {user?.full_name ?? "Account"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout}>Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {actions ? (
            <div className="mb-5 flex flex-wrap items-center justify-end gap-2">{actions}</div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}