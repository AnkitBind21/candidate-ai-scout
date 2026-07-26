import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  FileText,
  FolderKanban,
  Sparkles,
  BarChart3,
  Settings,
  ChevronLeft,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/candidates", label: "Candidates", icon: FileText },
  { to: "/jobs", label: "Job Descriptions", icon: FolderKanban },
  { to: "/ai-analysis", label: "AI Analysis", icon: Sparkles },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <motion.aside
      animate={{ width: collapsed ? 76 : 260 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="sticky top-0 h-screen shrink-0 border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl flex flex-col z-30"
    >
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-primary-glow grid place-items-center shadow-[var(--shadow-glow)] shrink-0">
          <Zap className="size-5 text-white" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight overflow-hidden">
            <span className="text-sm font-semibold">AI Resume</span>
            <span className="text-[11px] text-muted-foreground">Screening Suite</span>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 scrollbar-thin overflow-y-auto">
        {items.map((it) => {
          const active = pathname === it.to || (it.to !== "/" && pathname.startsWith(it.to));
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60",
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className="size-[18px] relative z-10 shrink-0" />
              {!collapsed && <span className="relative z-10 truncate">{it.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-3 space-y-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition-colors"
        >
          <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && <span>Collapse</span>}
        </button>
        <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-2.5">
          <Avatar className="size-8">
            <AvatarImage src="https://api.dicebear.com/9.x/notionists/svg?seed=Alex&backgroundColor=4F46E5" />
            <AvatarFallback>AC</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-xs font-semibold truncate">Alex Chen</span>
              <span className="text-[10px] text-muted-foreground truncate">Head of Talent</span>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
