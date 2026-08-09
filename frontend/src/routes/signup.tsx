import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/components/common/states";
import { AuthLayout } from "@/components/auth/auth-layout";

export const Route = createFileRoute("/signup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create account — Candidate AI Scout" },
      {
        name: "description",
        content: "Create a recruiter account on Candidate AI Scout.",
      },
      { property: "og:title", content: "Create account — Candidate AI Scout" },
      { property: "og:description", content: "Create a recruiter account on Candidate AI Scout." },
    ],
  }),
  component: SignupPage,
});

function validate(fullName: string, email: string, password: string, confirm: string) {
  const errors: Record<string, string> = {};
  if (fullName.trim().length < 2) errors["full_name"] = "Enter at least 2 characters.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors["email"] = "Enter a valid email address.";
  if (password.length < 8) errors["password"] = "Must be at least 8 characters.";
  else if (!/[A-Z]/.test(password) || !/\d/.test(password))
    errors["password"] = "Include at least one uppercase letter and one digit.";
  if (confirm !== password) errors["confirm"] = "Passwords do not match.";
  return errors;
}

function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setApiError(null);
    const next = validate(fullName, email, password, confirm);
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    try {
      const message = await signup(fullName.trim(), email.trim(), password);
      toast.success(message);
      await navigate({ to: "/login" });
    } catch (err) {
      setApiError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up your recruiter workspace in a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {apiError ? (
          <Alert variant="destructive">
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <Input
            id="full_name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
          />
          {errors["full_name"] ? (
            <p className="text-xs text-destructive">{errors["full_name"]}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@company.com"
          />
          {errors["email"] ? <p className="text-xs text-destructive">{errors["email"]}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors["password"] ? (
            <p className="text-xs text-destructive">{errors["password"]}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Min. 8 characters, one uppercase letter and one digit.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          {errors["confirm"] ? (
            <p className="text-xs text-destructive">{errors["confirm"]}</p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}