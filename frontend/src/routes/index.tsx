import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Users, CheckCircle2, XCircle, Clock, Sparkles, Upload, Plus, Activity } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { stats, scoreDistribution, pipelineData, recentActivity } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — AI Resume Screening" },
      { name: "description", content: "Overview of candidate pipeline, AI scores and hiring analytics." },
      { property: "og:title", content: "AI Resume Screening — Dashboard" },
      { property: "og:description", content: "Overview of candidate pipeline, AI scores and hiring analytics." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/20 via-card/60 to-card/30 p-8 lg:p-10"
      >
        <div className="absolute inset-0 [background:var(--gradient-glow)] opacity-70 pointer-events-none" />
        <div className="absolute -right-20 -top-20 size-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
            <Sparkles className="size-3" /> AI Engine v2.4 — Live
          </div>
          <h1 className="text-3xl lg:text-5xl font-semibold tracking-tight">
            AI Resume <span className="gradient-text">Screening System</span>
          </h1>
          <p className="text-muted-foreground mt-3 text-base lg:text-lg max-w-xl">
            Screen and rank candidates using AI-powered analysis. Move faster from resume to hire with confidence.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Button size="lg" className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 shadow-[var(--shadow-glow)]">
              <Upload className="size-4 mr-2" /> Upload Resume
            </Button>
            <Button size="lg" variant="outline" className="border-border bg-card/40 hover:bg-card/70">
              <Plus className="size-4 mr-2" /> Create Job
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Candidates" value={stats.total} icon={Users} trend={{ value: "+12%", up: true }} accent="primary" delay={0.05} />
        <StatCard label="Shortlisted" value={stats.shortlisted} icon={CheckCircle2} trend={{ value: "+4%", up: true }} accent="success" delay={0.1} />
        <StatCard label="Rejected" value={stats.rejected} icon={XCircle} trend={{ value: "-2%", up: false }} accent="destructive" delay={0.15} />
        <StatCard label="Pending Review" value={stats.pending} icon={Clock} trend={{ value: "+7%", up: true }} accent="warning" delay={0.2} />
        <StatCard label="Avg AI Score" value={stats.avgScore} icon={Sparkles} trend={{ value: "+3.1", up: true }} accent="primary" delay={0.25} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        <ChartCard title="Resume Score Distribution" subtitle="Candidates by AI score bucket" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={scoreDistribution}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="range" stroke="var(--muted-foreground)" fontSize={12} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
              <Bar dataKey="count" fill="url(#barGrad)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Hiring Pipeline" subtitle="Candidates by stage">
          <div className="space-y-3 mt-2">
            {pipelineData.map((p, i) => {
              const max = pipelineData[0].value;
              const pct = (p.value / max) * 100;
              return (
                <motion.div
                  key={p.stage}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{p.stage}</span>
                    <span className="font-semibold">{p.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 * i }}
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow"
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ChartCard>
      </div>

      {/* Activity */}
      <ChartCard title="Recent Activity" subtitle="Live feed from your hiring workflow" icon={<Activity className="size-4" />}>
        <div className="divide-y divide-border">
          {recentActivity.map((a, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "size-2 rounded-full shrink-0",
                    a.type === "success" && "bg-success",
                    a.type === "info" && "bg-primary",
                    a.type === "danger" && "bg-destructive",
                  )}
                />
                <div className="text-sm truncate">
                  <span className="font-medium">{a.who}</span>{" "}
                  <span className="text-muted-foreground">{a.what}</span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{a.when}</span>
            </motion.div>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--foreground)",
  boxShadow: "var(--shadow-elegant)",
};

export function ChartCard({
  title,
  subtitle,
  className,
  children,
  icon,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-2xl border border-border bg-card/60 backdrop-blur p-5", className)}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">{icon}{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

// Keep Line/Cell references so tree-shaking doesn't complain if unused later
void Line; void Cell; void LineChart;
