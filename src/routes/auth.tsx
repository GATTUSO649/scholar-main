import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import {
  getCurrentUserStateFn,
  getPublicLegalDocumentsFn,
  loginFn,
  registerFn,
  requestEmailVerificationFn,
  requestPasswordResetFn,
} from "@/lib/backend";
import {
  broadcastAuthSessionChange,
  dashboardRouteFor,
  getSafeReturnTo,
  subscribeToAuthSessionChanges,
} from "@/lib/auth";

type Mode = "login" | "register" | "forgot";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode; returnTo?: string } => ({
    mode: s["mode"] === "login" || s["mode"] === "forgot" ? (s["mode"] as Mode) : "register",
    ...(typeof s["returnTo"] === "string" ? { returnTo: s["returnTo"] } : {}),
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
  ["password", "Password", "password"],
  ["confirm", "Confirm password", "password"],
];

function AuthPage() {
  const { mode = "login", returnTo } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: legalDocuments = [] } = useQuery({
    queryKey: ["public-legal-documents"],
    queryFn: () => getPublicLegalDocumentsFn(),
  });
  const termsDocument = legalDocuments.find(
    (document) => document.slug === "terms-and-conditions" || /\bterms?\b/i.test(document.title),
  );
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [emailForLogin, setEmailForLogin] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const passwordIsValid = password.safeParse(passwordValue).success;

  useEffect(
    () =>
      subscribeToAuthSessionChanges(() => {
        queryClient.clear();
        window.location.reload();
      }),
    [queryClient],
  );

  useEffect(() => {
    getCurrentUserStateFn()
      .then(({ user, isAdmin }) => {
        if (!user) return;
        window.location.replace(getSafeReturnTo(returnTo, dashboardRouteFor(isAdmin)));
      })
      .catch((error: unknown) =>
        console.error("Could not check the current sign-in session.", error),
      );
  }, [returnTo]);

  const setMode = (m: Mode) => {
    setErrors({});
    setFormError(null);
    setFormSuccess(null);
    setSent(null);
    setPasswordValue("");
    navigate({
      to: "/auth",
      search: { mode: m, ...(returnTo ? { returnTo } : {}) },
      replace: true,
    });
  };

  async function onRegister(fd: FormData) {
    if (termsDocument && fd.get("termsAccepted") !== "on") {
      setErrors({ termsAccepted: "You must accept the Terms and Conditions to register." });
      return;
    }
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
    await loginFn({
      data: {
        email: String(fd.get("email")),
        password: String(fd.get("password")),
      },
    });
    await queryClient.cancelQueries();
    queryClient.clear();
    const { isAdmin } = await getCurrentUserStateFn();
    broadcastAuthSessionChange();
    window.location.replace(getSafeReturnTo(returnTo, dashboardRouteFor(isAdmin)));
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
    <div className="min-h-svh bg-[#edf3ef] px-4 py-8 sm:px-6">
      <main className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <section className="overflow-hidden rounded-xl border border-[#d6e3dc] bg-white shadow-[0_24px_70px_-42px_rgba(16,47,43,0.32)]">
          <div className="border-b border-[#e3ebe6] bg-[#fbfcfb] px-5 py-5 sm:px-8 sm:py-6">
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#183c34]">
              {mode === "register"
                ? "Create your account"
                : mode === "forgot"
                  ? "Reset your password"
                  : "Welcome back"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {mode === "register"
                ? "Create an account to manage your requests and documents."
                : mode === "forgot"
                  ? "We’ll email you a password reset link."
                  : "Sign in to manage your requests and continue your work."}
            </p>
          </div>

          <div className="p-5 sm:p-8">
            {formError && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Request not completed</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            {formSuccess && (
              <Alert className="mb-4 border-success/30 bg-success/10">
                <AlertTitle>Account created</AlertTitle>
                <AlertDescription>{formSuccess}</AlertDescription>
              </Alert>
            )}
            {sent ? (
              <div
                role="status"
                className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm"
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
              <form onSubmit={submit} className="space-y-4" noValidate>
                {mode === "register" ? (
                  <>
                    <div className="space-y-3">
                      {FIELDS.map(([name, label, type]) => (
                        <div key={name}>
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
                            className="mt-1.5 h-10 rounded-lg"
                            onChange={
                              name === "password"
                                ? (event) => setPasswordValue(event.target.value)
                                : undefined
                            }
                          />
                          {errors[name] && (
                            <p className="mt-1 text-xs text-destructive">{errors[name]}</p>
                          )}
                          {name === "password" && !passwordIsValid && (
                            <p
                              aria-live="polite"
                              className="mt-1 text-xs leading-5 text-muted-foreground"
                            >
                              Use 8+ characters with uppercase, lowercase, a number, and a symbol.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    {legalDocuments.length > 0 && (
                      <p className="text-xs leading-5 text-muted-foreground">
                        Please review our{" "}
                        {legalDocuments.map((document, index) => (
                          <span key={document.slug}>
                            {index > 0
                              ? index === legalDocuments.length - 1
                                ? " and "
                                : ", "
                              : ""}
                            <Link
                              to="/legal/$slug"
                              params={{ slug: document.slug }}
                              className="font-medium text-primary underline underline-offset-2"
                            >
                              {document.title}
                            </Link>
                          </span>
                        ))}
                        .
                      </p>
                    )}
                    {termsDocument && (
                      <div>
                        <div className="flex items-start gap-2 text-sm">
                          <input
                            id="termsAccepted"
                            name="termsAccepted"
                            type="checkbox"
                            aria-invalid={Boolean(errors["termsAccepted"])}
                            aria-describedby={errors["termsAccepted"] ? "terms-error" : undefined}
                            className="mt-1 h-4 w-4 shrink-0 accent-primary"
                          />
                          <label
                            htmlFor="termsAccepted"
                            className="leading-5 text-muted-foreground"
                          >
                            I agree to the{" "}
                            <Link
                              to="/legal/$slug"
                              params={{ slug: termsDocument.slug }}
                              className="font-medium text-primary underline underline-offset-2"
                            >
                              {termsDocument.title}
                            </Link>
                            .
                          </label>
                        </div>
                        {errors["termsAccepted"] && (
                          <p id="terms-error" className="mt-1 text-xs text-destructive">
                            {errors["termsAccepted"]}
                          </p>
                        )}
                      </div>
                    )}
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
                        className="mt-1.5 h-10 rounded-lg"
                      />
                      {mode === "forgot" && errors["email"] && (
                        <p className="mt-1 text-xs text-destructive">{errors["email"]}</p>
                      )}
                    </div>
                    {mode === "login" && (
                      <div>
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          name="password"
                          type="password"
                          required
                          autoComplete="current-password"
                          className="mt-1.5 h-10 rounded-lg"
                        />
                      </div>
                    )}
                  </>
                )}
                <Button type="submit" className="mt-2 h-11 w-full rounded-xl" disabled={busy}>
                  {busy
                    ? "Please wait…"
                    : mode === "register"
                      ? "Create account"
                      : mode === "forgot"
                        ? "Send reset link"
                        : "Log in"}
                </Button>
                <div className="flex flex-col items-center gap-2 border-t border-[#e6ece8] pt-4 text-sm">
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                  {mode === "forgot" ? (
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="font-medium text-primary hover:underline"
                    >
                      Back to sign in
                    </button>
                  ) : (
                    <p className="text-center text-muted-foreground">
                      {mode === "register" ? "Already have an account?" : "New to ScholarDesk?"}{" "}
                      <button
                        type="button"
                        onClick={() => setMode(mode === "register" ? "login" : "register")}
                        className="font-semibold text-primary hover:underline"
                      >
                        {mode === "register" ? "Sign in" : "Create account"}
                      </button>
                    </p>
                  )}
                </div>
              </form>
            )}

            <p className="mt-5 border-t border-[#e6ece8] pt-4 text-center text-xs">
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
