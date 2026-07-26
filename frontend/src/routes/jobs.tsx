import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Plus, X, Save, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Job Descriptions — AI Resume Screening" },
      { name: "description", content: "Craft AI-optimized job descriptions and match them to your candidate pool." },
      { property: "og:title", content: "Job Descriptions — AI Resume Screening" },
      { property: "og:description", content: "AI-optimized JDs matched to your candidate pool." },
    ],
  }),
  component: JobsPage,
});

const suggestions = [
  "Add measurable outcomes (e.g. 'ship 3 features/quarter')",
  "Mention team size to attract collaborative candidates",
  "Include remote/hybrid policy for wider reach",
];

function JobsPage() {
  const [jd, setJd] = useState(`We're hiring a Senior Frontend Engineer to lead the redesign of our core product surface.

You'll partner with Design and Product to ship polished, accessible interfaces used by 200k+ users daily. You should love craft, care about performance, and enjoy mentoring.

Responsibilities
• Own significant frontend architecture decisions
• Ship interfaces with Motion, Tailwind and React 19
• Raise the bar for testing, a11y and developer experience`);

  const [required, setRequired] = useState<string[]>(["React", "TypeScript", "Tailwind"]);
  const [preferred, setPreferred] = useState<string[]>(["Motion", "Next.js"]);
  const [exp, setExp] = useState<number[]>([5]);
  const [edu, setEdu] = useState("bachelors");

  return (
    <div>
      <PageHeader
        eyebrow="Job Descriptions"
        title="Craft a JD that hires itself"
        description="Write the role. Our AI extracts the skills, seniority and signals, then matches candidates."
        actions={
          <>
            <Button variant="outline" onClick={() => toast.success("Draft saved to your library")}>
              <Save className="size-4 mr-2" /> Save JD
            </Button>
            <Button className="bg-gradient-to-r from-primary to-primary-glow" onClick={() => toast.success("Analyzing 24 candidates against this JD…")}>
              <Wand2 className="size-4 mr-2" /> Analyze Candidates
            </Button>
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card/60 backdrop-blur p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Job Description</h3>
            <span className="text-xs text-muted-foreground">{jd.length} / 5000 characters</span>
          </div>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            className="w-full min-h-[420px] rounded-xl bg-background/60 border border-border p-4 text-sm leading-relaxed outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 resize-y scrollbar-thin"
          />
        </div>

        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card/60 to-card/30 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold mb-3">
              <Sparkles className="size-4 text-primary" /> AI Suggestions
            </div>
            <ul className="space-y-2">
              {suggestions.map((s) => (
                <li key={s} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 size-1.5 rounded-full bg-primary shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <TagField label="Required Skills" tags={required} setTags={setRequired} tone="primary" />
          <TagField label="Preferred Skills" tags={preferred} setTags={setPreferred} tone="warning" />

          <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Experience</h3>
              <span className="text-xs text-primary font-semibold">{exp[0]}+ years</span>
            </div>
            <Slider value={exp} onValueChange={setExp} min={0} max={15} step={1} />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
              <span>Junior</span><span>Mid</span><span>Senior</span><span>Staff+</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-5">
            <h3 className="text-sm font-semibold mb-3">Education</h3>
            <Select value={edu} onValueChange={setEdu}>
              <SelectTrigger className="w-full h-10 rounded-xl bg-background/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="bachelors">Bachelor's or equivalent</SelectItem>
                <SelectItem value="masters">Master's preferred</SelectItem>
                <SelectItem value="phd">Ph.D.</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

function TagField({
  label,
  tags,
  setTags,
  tone,
}: {
  label: string;
  tags: string[];
  setTags: (t: string[]) => void;
  tone: "primary" | "warning";
}) {
  const [val, setVal] = useState("");
  const toneCls = tone === "primary"
    ? "bg-primary/15 text-primary border-primary/30"
    : "bg-warning/15 text-warning border-warning/30";
  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-5">
      <h3 className="text-sm font-semibold mb-3">{label}</h3>
      <div className="flex flex-wrap gap-2 mb-3">
        {tags.map((t) => (
          <span key={t} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${toneCls}`}>
            {t}
            <button onClick={() => setTags(tags.filter((x) => x !== t))} className="opacity-70 hover:opacity-100">
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && val.trim()) {
              setTags([...tags, val.trim()]);
              setVal("");
            }
          }}
          placeholder="Add a skill and press Enter"
          className="flex-1 h-9 px-3 rounded-lg bg-background/60 border border-border text-sm outline-none focus:border-primary/60"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (val.trim()) { setTags([...tags, val.trim()]); setVal(""); }
          }}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
