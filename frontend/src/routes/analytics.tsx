import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock, Award, Users, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { ChartCard } from "./index";
import {
  monthlyApplications,
  pipelineData,
  skillDistribution,
  missingSkillsData,
  stats,
} from "@/lib/mock-data";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — AI Resume Screening" },
      { name: "description", content: "Hiring funnel, skill distribution, and time-to-hire metrics for your team." },
      { property: "og:title", content: "Analytics — AI Resume Screening" },
      { property: "og:description", content: "Hiring funnel and skill analytics for HR teams." },
    ],
  }),
  component: AnalyticsPage,
});

const tooltipStyle: React.CSSProperties = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--foreground)",
};

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--primary-glow)"];

function AnalyticsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title="Hiring intelligence"
        description="See the full funnel, skill trends, and where AI is saving your team the most time."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Average Experience" value="6.4 yrs" icon={Users} trend={{ value: "+0.4", up: true }} accent="primary" />
        <StatCard label="Average Score" value={stats.avgScore} icon={Award} trend={{ value: "+3.1", up: true }} accent="success" />
        <StatCard label="Acceptance Rate" value="34%" icon={TrendingUp} trend={{ value: "+5%", up: true }} accent="warning" />
        <StatCard label="Time to Hire" value="12d" icon={Clock} trend={{ value: "-2d", up: true }} accent="primary" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <ChartCard title="Monthly Applications" subtitle="Volume over the last 9 months" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyApplications}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="apps" stroke="var(--primary)" strokeWidth={2.5} fill="url(#areaGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Hiring Funnel" subtitle="Stage-by-stage conversion">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={pipelineData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} axisLine={false} tickLine={false} />
              <YAxis dataKey="stage" type="category" stroke="var(--muted-foreground)" fontSize={12} axisLine={false} tickLine={false} width={70} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
              <Bar dataKey="value" fill="var(--primary)" radius={[0, 8, 8, 0]}>
                {pipelineData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Skill Distribution" subtitle="Most common candidate skills">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={skillDistribution} dataKey="value" nameKey="skill" innerRadius={60} outerRadius={95} paddingAngle={3}>
                {skillDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {skillDistribution.map((s, i) => (
              <div key={s.skill} className="flex items-center gap-2 text-xs">
                <span className="size-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-muted-foreground">{s.skill}</span>
                <span className="ml-auto font-medium">{s.value}%</span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Top Missing Skills" subtitle="Gaps across your candidate pool" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={missingSkillsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="skill" stroke="var(--muted-foreground)" fontSize={12} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
              <Bar dataKey="value" fill="var(--warning)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Recent Hiring Trend" subtitle="Offers accepted over time">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyApplications.map((m) => ({ month: m.month, hires: Math.round(m.apps * 0.09) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="hires" stroke="var(--success)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--success)" }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
