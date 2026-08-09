import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SkillChips } from "@/components/common/score";
import { errorMessage } from "@/components/common/states";
import { useUploadResume } from "@/hooks/use-resume";
import type { ResumeUploadResponse } from "@/lib/api-types";
import { cn } from "@/lib/utils";

const ACCEPTED = [".pdf", ".doc", ".docx", ".txt"];
const MAX_BYTES = 10 * 1024 * 1024;

export function UploadResumeDialog({
  open,
  onOpenChange,
  candidateId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResumeUploadResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadResume();

  useEffect(() => {
    if (open) {
      setFile(null);
      setError(null);
      setResult(null);
    }
  }, [open]);

  function pick(next: File | null | undefined) {
    if (!next) return;
    const ext = `.${next.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (!ACCEPTED.includes(ext)) {
      setError(`Unsupported file type. Accepted: ${ACCEPTED.join(", ")}`);
      return;
    }
    if (next.size > MAX_BYTES) {
      setError("File is larger than 10 MB.");
      return;
    }
    setError(null);
    setFile(next);
  }

  async function onUpload() {
    if (!file) return;
    setError(null);
    try {
      const res = await upload.mutateAsync({ candidateId, file });
      setResult(res);
      toast.success(res.message ?? "Resume uploaded.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload resume</DialogTitle>
          <DialogDescription>
            PDF, DOC, DOCX or TXT up to 10 MB. Text and entities are extracted on upload.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "rounded-lg border border-dashed p-8 text-center transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-border",
            )}
          >
            <UploadCloud className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Drag and drop a resume here</p>
            <p className="mt-1 text-xs text-muted-foreground">or</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => inputRef.current?.click()}
            >
              Browse files
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(",")}
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </div>

          {file ? (
            <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB
              </span>
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {result ? (
            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>Words: {result.parsed?.word_count ?? "—"}</span>
                <span>Scanned: {result.parsed?.is_scanned ? "yes" : "no"}</span>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Extracted skills</h4>
                <SkillChips
                  items={result.entities?.skills}
                  emptyLabel="No skills detected"
                />
              </div>
              {result.parsed?.text_preview ? (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Text preview</h4>
                  <p className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    {result.parsed.text_preview}
                  </p>
                </div>
              ) : null}
              {result.parsed?.warnings?.length ? (
                <Alert>
                  <AlertDescription>{result.parsed.warnings.join(" · ")}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {result ? "Done" : "Cancel"}
          </Button>
          <Button onClick={onUpload} disabled={!file || upload.isPending}>
            {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}