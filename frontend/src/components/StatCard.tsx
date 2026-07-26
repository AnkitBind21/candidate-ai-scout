import { motion } from "motion/react";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  accent = "primary",
  delay = 0,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; up: boolean };
  accent?: "primary" | "success" | "warning" | "destructive";
  delay?: number;
}) {
  const accents: Record<string, string> = {
    primary: "from-primary/25 to-primary/0 text-primary",
    success: "from-success/25 to-success/0 text-success",
    warning: "from-warning/25 to-warning/0 text-warning",
    destructive: "from-destructive/25 to-destructive/0 text-destructive",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur p-5 hover-lift"
    >
      <div className={cn("absolute -top-10 -right-10 size-40 rounded-full bg-gradient-to-br blur-2xl opacity-70", accents[accent])} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-semibold mt-2">{value}</p>
          {trend && (
            <div className={cn("mt-2 inline-flex items-center gap-1 text-xs font-medium", trend.up ? "text-success" : "text-destructive")}>
              {trend.up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {trend.value}
              <span className="text-muted-foreground font-normal">vs last week</span>
            </div>
          )}
        </div>
        <div className={cn("size-10 grid place-items-center rounded-xl border border-border bg-background/40", accents[accent])}>
          <Icon className="size-5" />
        </div>
      </div>
    </motion.div>
  );
}
