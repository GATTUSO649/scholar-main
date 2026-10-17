import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { getCurrentUserFn, loginFn, registerFn, requestPasswordResetFn } from "@/lib/backend";

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

  useEffect(() => {
    getCurrentUserFn()
      .then((user) => {
        if (user) navigate({ to: "/dashboard", replace: true });
      })
      .catch((error: unknown) =>
        console.error("Could not check the current sign-in session.", error),
      );
  }, [navigate]);

  const setMode = (m: Mode) => {
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
    await navigate({ to: "/dashboard" });
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
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.2fr]">
      <aside className="hidden flex-col justify-between bg-hero p-10 text-ink-foreground lg:flex">
        <Logo light />
        <div>
          <h2 className="text-4xl font-semibold leading-tight">
            Your academic work, organised and supported.
          </h2>
          <p className="mt-4 text-ink-foreground/70">
            Submit requests, pay securely and follow every step from one dashboard.
          </p>
        </div>
        <p className="text-sm text-ink-foreground/50">Secure sign-in · Private files</p>
      </aside>
      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-3xl font-semibold">
            {mode === "register"
              ? "Create your student account"
              : mode === "forgot"
                ? "Reset your password"
                : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
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
            <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
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
              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : mode === "register"
                    ? "Create account"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Log in"}
              </Button>
              {mode !== "forgot" && <></>}
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                New here?{" "}
                <button
                  onClick={() => setMode("register")}
                  className="font-semibold text-primary hover:underline"
                >
                  Create an account
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
        </div>
      </main>
    </div>
  );
}
