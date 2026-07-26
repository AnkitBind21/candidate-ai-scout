import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Zap, Trash2, UserPlus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — AI Resume Screening" },
      { name: "description", content: "Manage your workspace, team, AI model and notifications." },
      { property: "og:title", content: "Settings — AI Resume Screening" },
      { property: "og:description", content: "Manage workspace, team, AI model and notifications." },
    ],
  }),
  component: SettingsPage,
});

const team = [
  { name: "Alex Chen", role: "Owner", email: "alex@company.com", seed: "Alex" },
  { name: "Priya Sharma", role: "Recruiter", email: "priya@company.com", seed: "Priya" },
  { name: "David Miller", role: "Hiring Manager", email: "david@company.com", seed: "David" },
];

function SettingsPage() {
  return (
    <div>
      <PageHeader eyebrow="Workspace" title="Settings" description="Configure your workspace, AI engine and team." />

      <div className="space-y-6 max-w-4xl">
        <Section title="Company" description="How your workspace appears across the product.">
          <div className="flex items-center gap-5">
            <div className="size-20 rounded-2xl bg-gradient-to-br from-primary to-primary-glow grid place-items-center shadow-[var(--shadow-glow)]">
              <Zap className="size-9 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-xs text-muted-foreground">Company name</label>
              <input defaultValue="Northwind Talent Co." className="w-full h-10 px-3 rounded-xl bg-background/60 border border-border text-sm outline-none focus:border-primary/60" />
            </div>
            <Button variant="outline">Upload logo</Button>
          </div>
        </Section>

        <Section title="Team Members" description="Invite recruiters and hiring managers." action={
          <Button size="sm" variant="outline" onClick={() => toast.success("Invitation sent")}> <UserPlus className="size-4 mr-2" /> Invite</Button>
        }>
          <div className="divide-y divide-border">
            {team.map((m) => (
              <div key={m.email} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarImage src={`https://api.dicebear.com/9.x/notionists/svg?seed=${m.seed}&backgroundColor=4F46E5`} />
                    <AvatarFallback>{m.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{m.role}</span>
                  <Button size="sm" variant="ghost">Manage</Button>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="AI Model" description="Choose the model powering resume scoring.">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Model</label>
              <Select defaultValue="pro">
                <SelectTrigger className="w-full h-10 rounded-xl bg-background/60 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pro">Resume-AI Pro (recommended)</SelectItem>
                  <SelectItem value="fast">Resume-AI Fast</SelectItem>
                  <SelectItem value="deep">Resume-AI Deep Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Threshold for auto-shortlist</label>
              <Select defaultValue="82">
                <SelectTrigger className="w-full h-10 rounded-xl bg-background/60 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="75">75</SelectItem>
                  <SelectItem value="80">80</SelectItem>
                  <SelectItem value="82">82</SelectItem>
                  <SelectItem value="85">85</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        <Section title="Notifications" description="Where should we send hiring updates?">
          <div className="space-y-3">
            <Row label="New candidate applied" defaultChecked />
            <Row label="AI finished analysis" defaultChecked />
            <Row label="Weekly hiring digest" />
            <Row label="Team activity summary" defaultChecked />
          </div>
        </Section>

        <Section title="Email Preferences">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">From address</label>
              <input defaultValue="hiring@company.com" className="w-full h-10 px-3 rounded-xl bg-background/60 border border-border text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Reply-to</label>
              <input defaultValue="alex@company.com" className="w-full h-10 px-3 rounded-xl bg-background/60 border border-border text-sm mt-1" />
            </div>
          </div>
        </Section>

        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="size-5 text-destructive shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Permanently delete this workspace and all its data. This action cannot be undone.
              </p>
            </div>
            <Button variant="destructive" className="shrink-0">
              <Trash2 className="size-4 mr-2" /> Delete workspace
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm">{label}</span>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
