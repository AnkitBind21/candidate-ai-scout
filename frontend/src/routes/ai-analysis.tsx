import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UploadCloud, FileText, X, Sparkles, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ai-analysis")({
  head: () => ({
    meta: [
      { title: "AI Analysis — Upload Resumes" },
      { name: "description", content: "Drop resumes and let AI parse, score and match them to open roles in seconds." },
      { property: "og:title", content: "AI Analysis — AI Resume Screening" },
      { property: "og:description", content: "AI resume parsing, scoring and matching in seconds." },
    ],
  }),
  component: AIAnalysisPage,
});

interface Item {
  id: string;
  name: string;
  size: string;
  progress: number;
  status: "uploading" | "done";
}

const sampleFiles: Item[] = [
  { id: "f1", name: "Sarah_Williams_Resume.pdf", size: "412 KB", progress: 100, status: "done" },
  { id: "f2", name: "Michael_Brown_CV.docx", size: "289 KB", progress: 100, status: "done" },
];

function AIAnalysisPage() {
  const [items, setItems] = useState<Item[]>(sampleFiles);
  const [drag, setDrag] = useState(false);

  const addFakeFile = useCallback(() => {
    const id = String(Date.now());
    const name = `Resume_${Math.floor(Math.random() * 900 + 100)}.pdf`;
    setItems((prev) => [{ id, name, size: `${Math.floor(200 + Math.random() * 400)} KB`, progress: 0, status: "uploading" }, ...prev]);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.floor(8 + Math.random() * 16);
      setItems((prev) => prev.map((f) => f.id === id ? { ...f, progress: Math.min(100, p) } : f));
      if (p >= 100) {
        clearInterval(iv);
        setItems((prev) => prev.map((f) => f.id === id ? { ...f, progress: 100, status: "done" } : f));
      }
    }, 220);
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="AI Analysis"
        title="Upload & analyze resumes"
        description="Drop PDF or DOCX files. Our AI parses them, extracts skills, and ranks candidates against your open roles."
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); addFakeFile(); }}
          onClick={addFakeFile}
          className={cn(
            "lg:col-span-2 relative overflow-hidden rounded-2xl border-2 border-dashed p-10 min-h-[360px] cursor-pointer transition-all",
            drag
              ? "border-primary bg-primary/10 scale-[1.01]"
              : "border-border bg-card/40 hover:border-primary/60 hover:bg-card/60",
          )}
        >
          <div className="absolute inset-0 [background:var(--gradient-glow)] opacity-40 pointer-events-none" />
          <div className="relative flex flex-col items-center text-center gap-4">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              className="size-16 rounded-2xl bg-gradient-to-br from-primary to-primary-glow grid place-items-center shadow-[var(--shadow-glow)]"
            >
              <UploadCloud className="size-8 text-white" />
            </motion.div>
            <div>
              <h3 className="text-lg font-semibold">Drop resumes here or click to upload</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Supports PDF, DOCX up to 10MB each. Batch uploads welcome.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full border border-border bg-background/50 px-3 py-1 text-xs">PDF</span>
              <span className="rounded-full border border-border bg-background/50 px-3 py-1 text-xs">DOCX</span>
            </div>
          </div>
        </motion.div>

        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Sparkles className="size-4 text-primary" /> Analysis Preview
          </h3>
          <p className="text-sm text-muted-foreground">
            Once uploaded, each resume is parsed into structured JSON: skills, experience, education, projects, and a 0–100 match score.
          </p>
          <div className="mt-4 space-y-2">
            {["Parsing PDF text", "Extracting skills", "Matching to JD", "Scoring candidate"].map((s, i) => (
              <div key={s} className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-success" /> {s}
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            <Button className="flex-1 bg-gradient-to-r from-primary to-primary-glow" onClick={() => toast.success("Analyzing resumes with AI…")}>
              <Sparkles className="size-4 mr-2" /> Analyze
            </Button>
            <Button variant="outline" onClick={() => setItems([])}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card/60 backdrop-blur">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold">Uploaded files</h3>
          <span className="text-xs text-muted-foreground">{items.length} file{items.length === 1 ? "" : "s"}</span>
        </div>
        <div className="divide-y divide-border">
          <AnimatePresence initial={false}>
            {items.map((f) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-4 px-5 py-4"
              >
                <div className="size-10 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center shrink-0">
                  <FileText className="size-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-sm truncate">{f.name}</div>
                    <div className="text-xs text-muted-foreground shrink-0">{f.size}</div>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <motion.div
                        animate={{ width: `${f.progress}%` }}
                        transition={{ duration: 0.3 }}
                        className={cn("h-full rounded-full", f.status === "done" ? "bg-success" : "bg-gradient-to-r from-primary to-primary-glow")}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground w-16 text-right">
                      {f.status === "done" ? "Ready" : `${f.progress}%`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {f.status === "uploading" ? (
                    <Loader2 className="size-4 text-primary animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4 text-success" />
                  )}
                  <button
                    onClick={() => setItems((prev) => prev.filter((x) => x.id !== f.id))}
                    className="size-8 grid place-items-center rounded-lg hover:bg-muted/40 text-muted-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {items.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No files yet. Drop resumes above to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
