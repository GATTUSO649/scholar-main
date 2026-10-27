import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, BookOpen, ShieldCheck, Sparkles } from "lucide-react";
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
  requestEmailVerificationFn,
  requestPasswordResetFn,
} from "@/lib/backend";
import { dashboardRouteFor } from "@/lib/auth";

type Mode = "login" | "register" | "forgot";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode } => ({
    mode: s["mode"] === "login" || s["mode"] === "forgot" ? (s["mode"] as Mode) : "register",
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

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
});

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
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [emailForLogin, setEmailForLogin] = useState("");
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
    setFormSuccess(null);
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
    setEmailForLogin(user.email);
    setMode("login");
    setFormSuccess("Your account is ready. Log in with your new email and password to continue.");
    toast.success("Account created. Please log in to continue.");
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
    const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) {
      setErrors({ email: parsed.error.issues[0]?.message ?? "Enter a valid email" });
      return;
    }
    setErrors({});
    await requestPasswordResetFn({ data: { email: parsed.data.email } });
    setSent(
      `If an account exists for ${parsed.data.email}, password reset instructions will arrive shortly.`,
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    setFormSuccess(null);
    const fd = new FormData(e.currentTarget);
    try {
      if (mode === "register") await onRegister(fd);
      else if (mode === "forgot") await onForgot(fd);
      else await onLogin(fd);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const safeMessages = new Set([
        "Could not create your account. If you already have an account, sign in or reset your password.",
        "Email or password is incorrect.",
        "Email verification is required before you can sign in.",
        "Too many sign-in attempts. Please wait 15 minutes and try again.",
        "Sign-in is temporarily unavailable. Please try again.",
      ]);
      if (message === "Email verification is required before you can sign in.") {
        const emailValue = String(fd.get("email") ?? "").trim();
        if (emailValue) {
          await requestEmailVerificationFn({ data: { email: emailValue } });
          setFormError(
            "Email verification is required. We sent a fresh verification link to your inbox.",
          );
        } else {
          setFormError(message);
        }
        return;
      }
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
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top_right,oklch(0.95_0.03_75/0.48),transparent_55%)] px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <Logo />
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Secure student portal
        </span>
      </div>
      <main className="flex flex-1 items-center justify-center py-8">
        <section
          className={`auth-book-spread auth-book-spread-${turnDirection} grid w-full max-w-5xl overflow-hidden rounded-[1.75rem] border bg-card shadow-[0_24px_80px_-32px_rgba(23,38,60,0.3)] md:grid-cols-2`}
        >
          <aside className="auth-book-story relative flex min-h-64 flex-col justify-between overflow-hidden bg-hero p-7 text-ink-foreground sm:p-10 md:min-h-[580px] md:p-9 lg:min-h-[620px] lg:p-12">
            <div className="pointer-events-none absolute -right-24 top-1/4 h-80 w-80 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute -right-12 top-[30%] h-56 w-56 rounded-full border border-accent/20" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-ink-foreground/80">
                {mode === "register" ? (
                  <Sparkles className="h-4 w-4 text-accent" />
                ) : (
                  <BookOpen className="h-4 w-4 text-accent" />
                )}
                {mode === "register" ? "Start your ScholarDesk journey" : "Welcome back"}
              </div>
              <h2 className="mt-7 font-display text-3xl font-semibold leading-tight sm:text-4xl">
                {mode === "register"
                  ? "A little support can take you a long way."
                  : mode === "forgot"
                    ? "Let’s get you back to your account."
                    : "Your next step starts here."}
              </h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-ink-foreground/70 sm:text-base sm:leading-7">
                {mode === "register"
                  ? "Create your student account to organise requests, follow progress, and explore helpful resources."
                  : mode === "forgot"
                    ? "Request a secure password-reset link and continue where you left off."
                    : "Sign in to follow your requests, get updates, and keep your academic support together."}
              </p>
            </div>
            <div className="relative mt-8 border-t border-white/15 pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-foreground/55">
                {mode === "register" ? "Already have an account?" : "New to ScholarDesk?"}
              </p>
              <button
                type="button"
                onClick={() => setMode(mode === "register" ? "login" : "register")}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {mode === "register" ? "Log in" : "Create an account"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </aside>

          <div className="auth-book-form relative flex flex-col justify-center p-7 sm:p-10 lg:p-12">
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {mode === "register"
                ? "Create your account"
                : mode === "forgot"
                  ? "Reset your password"
                  : "Sign in"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {mode === "register"
                ? "Enter your details to get started."
                : mode === "forgot"
                  ? "We’ll email you a secure reset link."
                  : "Enter your student account details to continue."}
            </p>

            {formError && (
              <Alert variant="destructive" className="mt-6">
                <AlertTitle>Request not completed</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            {formSuccess && (
              <Alert className="mt-6 border-success/30 bg-success/10">
                <AlertTitle>Account created</AlertTitle>
                <AlertDescription>{formSuccess}</AlertDescription>
              </Alert>
            )}
            {sent ? (
              <div
                role="status"
                className="mt-8 rounded-xl border border-success/30 bg-success/10 p-5 text-sm"
              >
                <p>{sent}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button type="button" variant="outline" onClick={() => setMode("login")}>
                    Back to sign in
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setSent(null)}>
                    Try another email
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
                {mode === "register" ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {FIELDS.map(([name, label, type]) => (
                        <div
                          key={name}
                          className={
                            name === "full_name" || name === "email" ? "sm:col-span-2" : ""
                          }
                        >
                          <Label htmlFor={name}>{label}</Label>
                          <Input
                            id={name}
                            name={name}
                            type={type ?? "text"}
                            autoComplete={
                              name === "password" || name === "confirm"
                                ? "new-password"
                                : name === "email"
                                  ? "email"
                                  : name === "phone"
                                    ? "tel"
                                    : "name"
                            }
                            className="mt-1.5 h-11 rounded-xl"
                          />
                          {errors[name] && (
                            <p className="mt-1 text-xs text-destructive">{errors[name]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Use 8+ characters with uppercase, lowercase, a number, and a symbol.
                    </p>
                  </>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        defaultValue={emailForLogin}
                        className="mt-1.5 h-11 rounded-xl"
                      />
                      {mode === "forgot" && errors.email && (
                        <p className="mt-1 text-xs text-destructive">{errors.email}</p>
                      )}
                    </div>
                    {mode === "login" && (
                      <div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password">Password</Label>
                          <button
                            type="button"
                            onClick={() => setMode("forgot")}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <Input
                          id="password"
                          name="password"
                          type="password"
                          required
                          autoComplete="current-password"
                          className="mt-1.5 h-11 rounded-xl"
                        />
                      </div>
                    )}
                  </>
                )}
                <Button type="submit" className="mt-2 w-full rounded-xl" size="lg" disabled={busy}>
                  {busy
                    ? "Please wait…"
                    : mode === "register"
                      ? "Create account"
                      : mode === "forgot"
                        ? "Send reset link"
                        : "Log in"}
                </Button>
                {mode === "forgot" && (
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="w-full py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Back to sign in
                  </button>
                )}
              </form>
            )}

            <p className="mt-7 text-center text-xs">
              <Link to="/" className="text-muted-foreground hover:underline">
                ← Back to home
              </Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
