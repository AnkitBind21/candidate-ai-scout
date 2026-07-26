import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { ScoreRing } from "./ScoreRing";
import { motion } from "motion/react";
import {
  Mail,
  Phone,
  GraduationCap,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Download,
  ZoomIn,
  ZoomOut,
  FileText,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Minus,
} from "lucide-react";
import type { Candidate } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function CandidateDrawer({
  candidate,
  open,
  onOpenChange,
}: {
  candidate: Candidate | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  if (!candidate) return null;

  const recMap = {
    Hire: { icon: ThumbsUp, cls: "bg-success/15 text-success border-success/30" },
    Maybe: { icon: Minus, cls: "bg-warning/15 text-warning border-warning/30" },
    Reject: { icon: ThumbsDown, cls: "bg-destructive/15 text-destructive border-destructive/30" },
  } as const;
  const Rec = recMap[candidate.recommendation];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl bg-background border-l border-border p-0 overflow-y-auto scrollbar-thin">
        <SheetHeader className="p-0">
          <SheetTitle className="sr-only">{candidate.name} details</SheetTitle>
        </SheetHeader>
        <div className="relative">
          <div className="h-32 bg-gradient-to-br from-primary/40 via-primary/20 to-transparent" />
          <div className="px-6 -mt-14 flex items-end gap-4">
            <Avatar className="size-24 border-4 border-background shadow-xl">
              <AvatarImage src={candidate.avatar} />
              <AvatarFallback>{candidate.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="pb-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-semibold truncate">{candidate.name}</h2>
                <StatusBadge status={candidate.status} />
              </div>
              <p className="text-sm text-muted-foreground">{candidate.position}</p>
            </div>
          </div>

          <div className="px-6 mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <InfoTile icon={Mail} label="Email" value={candidate.email} />
            <InfoTile icon={Phone} label="Phone" value={candidate.phone} />
            <InfoTile icon={Briefcase} label="Experience" value={`${candidate.experience} yrs`} />
            <InfoTile icon={GraduationCap} label="Education" value={candidate.education} />
          </div>
        </div>

        <div className="p-6">
          <Tabs defaultValue="overview">
            <TabsList className="bg-card/60 border border-border">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="ai">AI Analysis</TabsTrigger>
              <TabsTrigger value="resume">Resume</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-5 space-y-5">
              <Section title="Summary">
                <p className="text-sm text-muted-foreground leading-relaxed">{candidate.summary}</p>
              </Section>
              <Section title="Skills">
                <div className="flex flex-wrap gap-2">
                  {candidate.skills.map((s) => (
                    <Badge key={s} variant="secondary" className="bg-primary/10 border border-primary/30 text-primary rounded-full">{s}</Badge>
                  ))}
                </div>
              </Section>
              <Section title="Work History">
                <div className="space-y-3">
                  {candidate.workHistory.map((w, i) => (
                    <div key={i} className="rounded-xl border border-border bg-card/50 p-4">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{w.role}</div>
                        <div className="text-xs text-muted-foreground">{w.period}</div>
                      </div>
                      <div className="text-sm text-primary">{w.company}</div>
                      <p className="text-sm text-muted-foreground mt-1">{w.description}</p>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="Projects">
                <div className="grid sm:grid-cols-2 gap-3">
                  {candidate.projects.map((p) => (
                    <div key={p.name} className="rounded-xl border border-border bg-card/50 p-4">
                      <div className="font-medium text-sm">{p.name}</div>
                      <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="Certifications">
                <div className="flex flex-wrap gap-2">
                  {candidate.certifications.map((c) => (
                    <Badge key={c} variant="outline" className="rounded-full">{c}</Badge>
                  ))}
                </div>
              </Section>
            </TabsContent>

            <TabsContent value="ai" className="mt-5 space-y-5">
              <div className="rounded-2xl border border-border bg-card/60 p-6 flex flex-col sm:flex-row items-center gap-6">
                <ScoreRing score={candidate.score} />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">AI Recommendation</div>
                  <div className={cn("inline-flex items-center gap-2 mt-2 rounded-full border px-3 py-1 text-sm font-semibold", Rec.cls)}>
                    <Rec.icon className="size-4" />
                    {candidate.recommendation}
                  </div>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{candidate.reasoning}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Section title="Strengths" icon={<CheckCircle2 className="size-4 text-success" />}>
                  <div className="space-y-2">
                    {candidate.strengths.map((s, i) => (
                      <motion.div
                        key={s}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm"
                      >
                        {s}
                      </motion.div>
                    ))}
                  </div>
                </Section>
                <Section title="Weaknesses" icon={<AlertTriangle className="size-4 text-destructive" />}>
                  <div className="space-y-2">
                    {candidate.weaknesses.map((w, i) => (
                      <motion.div
                        key={w}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm"
                      >
                        {w}
                      </motion.div>
                    ))}
                  </div>
                </Section>
              </div>

              <Section title="Missing Skills" icon={<Sparkles className="size-4 text-warning" />}>
                <div className="flex flex-wrap gap-2">
                  {candidate.missingSkills.map((s) => (
                    <Badge key={s} className="bg-warning/15 border border-warning/30 text-warning rounded-full">{s}</Badge>
                  ))}
                </div>
              </Section>
            </TabsContent>

            <TabsContent value="resume" className="mt-5">
              <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="size-4" />
                    {candidate.name.replace(" ", "_")}_Resume.pdf
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost"><ZoomOut className="size-4" /></Button>
                    <Button size="icon" variant="ghost"><ZoomIn className="size-4" /></Button>
                    <Button size="sm" variant="outline"><Download className="size-4 mr-1" /> Download</Button>
                  </div>
                </div>
                <div className="aspect-[1/1.35] bg-gradient-to-br from-muted/40 to-background grid place-items-center p-8">
                  <div className="w-full max-w-md bg-background border border-border rounded-xl p-8 shadow-lg space-y-3">
                    <div className="h-5 w-1/2 bg-primary/30 rounded" />
                    <div className="h-3 w-1/3 bg-muted rounded" />
                    <div className="h-px bg-border my-3" />
                    <div className="h-3 w-full bg-muted/70 rounded" />
                    <div className="h-3 w-11/12 bg-muted/70 rounded" />
                    <div className="h-3 w-4/5 bg-muted/70 rounded" />
                    <div className="h-3 w-3/5 bg-muted/70 rounded" />
                    <div className="h-4 w-1/4 bg-primary/25 rounded mt-4" />
                    <div className="h-3 w-full bg-muted/70 rounded" />
                    <div className="h-3 w-11/12 bg-muted/70 rounded" />
                    <div className="h-3 w-2/3 bg-muted/70 rounded" />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="mt-5">
              <div className="relative pl-6">
                <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
                {candidate.timeline.map((t, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="relative pb-6 last:pb-0"
                  >
                    <div className="absolute -left-[18px] top-1 size-3 rounded-full bg-primary shadow-[0_0_0_4px_var(--background),0_0_0_5px_var(--border)]" />
                    <div className="text-sm font-medium">{t.event}</div>
                    <div className="text-xs text-muted-foreground">{t.date}</div>
                  </motion.div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider">
        <Icon className="size-3" /> {label}
      </div>
      <div className="mt-1 text-sm font-medium truncate">{value}</div>
    </div>
  );
}
