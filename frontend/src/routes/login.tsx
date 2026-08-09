import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/components/common/states";
import { AuthLayout } from "@/components/auth/auth-layout";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Candidate AI Scout" },
      { name: "description", content: "Sign in to your Candidate AI Scout recruiter account." },
      { property: "og:title", content: "Sign in — Candidate AI Scout" },
      {
        property: "og:description",
        content: "Sign in to your Candidate AI Scout recruiter account.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, token, ready } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (ready && token) void navigate({ to: "/", replace: true });
  }, [ready, token, navigate]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email.trim(), password, remember);
      await navigate({ to: "/", replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Access your recruitment workspace."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={remember}
              onCheckedChange={(v) => setRemember(v === true)}
              aria-label="Remember me"
            />
            Remember me
          </label>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() =>
              setError(
                "Password reset isn't available yet — the backend does not expose a reset endpoint. Contact your administrator.",
              )
            }
          >
            Forgot password?
          </button>
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}