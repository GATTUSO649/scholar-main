import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, BookOpen, Check, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import {
  getAdminStateFn,
  getCurrentUserFn,
  loginFn,
  registerFn,
  requestPasswordResetFn,
} from "@/lib/backend";
import { dashboardRouteFor } from "@/lib/auth";

type Mode = "login" | "register" | "forgot";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode } => ({
    mode: s["mode"] === "register" || s["mode"] === "forgot" ? (s["mode"] as Mode) : "login",
  }),
  head: () => ({
    meta: [
      { title: "Sign in or register — ScholarDesk" },
      {
        name: "description",
        content: "Log in to your student portal or create a ScholarDesk account.",
      },
      { property: "og:title", content: "Sign in — ScholarDesk" },
      { property: "og:description", content: "Access your ScholarDesk student portal." },
    ],
  }),
  component: AuthPage,
});

const password = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[0-9]/, "Include a number")
  .regex(/[^A-Za-z0-9]/, "Include a symbol");

const registerSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your full name").max(100),
    email: z.string().trim().email("Enter a valid email").max(255),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ]{9,16}$/, "Enter a valid phone number, e.g. +254712345678"),
    country: z.string().trim().min(2, "Enter your country").max(60),
    password,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

const FIELDS: [keyof z.infer<typeof registerSchema>, string, string?][] = [
  ["full_name", "Full name"],
  ["email", "Email", "email"],
  ["phone", "Phone number", "tel"],
  ["country", "Country"],
  ["password", "Password", "password"],
  ["confirm", "Confirm password", "password"],
];

function AuthPage() {
  const { mode = "login" } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [turnDirection, setTurnDirection] = useState<"forward" | "back">("forward");

  useEffect(() => {
    getCurrentUserFn()
      .then(async (user) => {
        if (!user) return;
        const isAdmin = await getAdminStateFn();
        queryClient.setQueryData(["is-admin", user.id], isAdmin);
        await navigate({ to: dashboardRouteFor(isAdmin), replace: true });
      })
      .catch((error: unknown) =>
        console.error("Could not check the current sign-in session.", error),
      );
  }, [navigate, queryClient]);

  const setMode = (m: Mode) => {
    setTurnDirection(m === "login" ? "back" : "forward");
    setErrors({});
    setFormError(null);
    setSent(null);
    navigate({ to: "/auth", search: { mode: m }, replace: true });
  };

  async function onRegister(fd: FormData) {
    const parsed = registerSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(parsed.error.issues.map((i) => [i.path[0] as string, i.message])),
      );
      return;
    }
    setErrors({});
    const { confirm: _confirm, ...input } = parsed.data;
    const user = await registerFn({ data: input });
    queryClient.setQueryData(["current-user"], user);
    queryClient.setQueryData(["is-admin", user.id], false);
    toast.success("Account created");
    await navigate({ to: "/dashboard", replace: true });
  }

  async function onLogin(fd: FormData) {
    const user = await loginFn({
      data: {
        email: String(fd.get("email")),
        password: String(fd.get("password")),
      },
    });
    queryClient.setQueryData(["current-user"], user);
    const isAdmin = await getAdminStateFn();
    queryClient.setQueryData(["is-admin", user.id], isAdmin);
    await navigate({ to: dashboardRouteFor(isAdmin), replace: true });
  }

  async function onForgot(fd: FormData) {
    const email = String(fd.get("email"));
    await requestPasswordResetFn({ data: { email } });
    setSent(`If an account exists for ${email}, a reset link is on its way.`);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    try {
      if (mode === "register") await onRegister(fd);
      else if (mode === "forgot") await onForgot(fd);
      else await onLogin(fd);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const safeMessages = new Set([
        "An account with this email already exists. Try logging in or resetting your password.",
        "Could not create your account. Please try again.",
        "Email or password is incorrect.",
        "Too many sign-in attempts. Please wait 15 minutes and try again.",
        "Sign-in is temporarily unavailable. Please try again.",
        "Password reset email is not configured. Set SMTP_HOST and SMTP_FROM in the server environment.",
        "APP_URL must be configured in production before password reset emails can be sent.",
      ]);
      setFormError(
        safeMessages.has(message)
          ? message
          : "We couldn't complete your request. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[0.92fr_1.08fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-hero p-10 text-ink-foreground xl:p-14 lg:flex">
        <div className="pointer-events-none absolute -right-24 top-1/4 h-80 w-80 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-12 top-[30%] h-56 w-56 rounded-full border border-accent/20" />
        <Logo light />
        <div className="relative max-w-xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-ink-foreground/80">
            <Sparkles className="h-4 w-4 text-accent" />
            Your academic support, in one place
          </div>
          <h2 className="font-display text-5xl font-semibold leading-[1.12] tracking-tight">
            Make room for your <span className="text-gradient-gold">next big idea.</span>
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-ink-foreground/70">
            Organise your requests, get clear updates, and find helpful resources throughout your
            academic journey.
          </p>
          <div className="mt-9 grid max-w-md gap-3">
            {[
              "Follow each request from submission to completion",
              "Keep your academic support in one secure portal",
              "Explore practical resources in the ScholarDesk library",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-ink-foreground/80">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-ink-foreground/55">
          <ShieldCheck className="h-4 w-4" />
          Private account · Secure sign-in
        </div>
      </aside>
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top_right,oklch(0.95_0.03_75/0.48),transparent_55%)] px-4 py-8 sm:px-8 sm:py-12">
        <div className="w-full max-w-xl">
          <div className="mb-7 flex items-center justify-between xl:hidden">
            <Logo />
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Secure portal
            </span>
          </div>
          <section
            key={mode}
            className={`auth-book-page auth-book-page-${turnDirection} relative overflow-hidden rounded-[1.75rem] border bg-card p-6 shadow-[0_24px_80px_-32px_rgba(23,38,60,0.3)] sm:p-10`}
          >
            <div className="mb-8 hidden items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground xl:flex">
              <BookOpen className="h-4 w-4 text-accent" />
              Student portal
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {mode === "register"
                ? "Create your student account"
                : mode === "forgot"
                  ? "Reset your password"
                  : "Welcome back"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {mode === "register"
                ? "It takes about a minute."
                : mode === "forgot"
                  ? "We'll email you a reset link."
                  : "Log in to your student portal."}
            </p>
            {formError && (
              <Alert variant="destructive" className="mt-6">
                <AlertTitle>Request not completed</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            {sent ? (
              <div className="mt-8 rounded-xl border bg-success/10 p-5 text-sm">{sent}</div>
            ) : (
              <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
                {mode === "register" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {FIELDS.map(([name, label, type]) => (
                      <div
                        key={name}
                        className={name === "full_name" || name === "email" ? "sm:col-span-2" : ""}
                      >
                        <Label htmlFor={name}>{label}</Label>
                        <Input id={name} name={name} type={type ?? "text"} className="mt-1.5" />
                        {errors[name] && (
                          <p className="mt-1 text-xs text-destructive">{errors[name]}</p>
                        )}
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      Password: 8+ characters with uppercase, lowercase, a number and a symbol.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" name="email" type="email" required className="mt-1.5" />
                    </div>
                    {mode === "login" && (
                      <div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password">Password</Label>
                          <button
                            type="button"
                            onClick={() => setMode("forgot")}
                            className="text-xs text-primary hover:underline"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <Input
                          id="password"
                          name="password"
                          type="password"
                          required
                          className="mt-1.5"
                        />
                      </div>
                    )}
                  </>
                )}
                <Button type="submit" className="mt-1 w-full rounded-xl" size="lg" disabled={busy}>
                  {busy
                    ? "Please wait…"
                    : mode === "register"
                      ? "Create account"
                      : mode === "forgot"
                        ? "Send reset link"
                        : "Log in"}
                </Button>
              </form>
            )}

            <p className="mt-7 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>
                  New here?{" "}
                  <button
                    onClick={() => setMode("register")}
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    Create an account
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  Already registered?{" "}
                  <button
                    onClick={() => setMode("login")}
                    className="font-semibold text-primary hover:underline"
                  >
                    Log in
                  </button>
                </>
              )}
            </p>
            <p className="mt-2 text-center text-xs">
              <Link to="/" className="text-muted-foreground hover:underline">
                ← Back to home
              </Link>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
