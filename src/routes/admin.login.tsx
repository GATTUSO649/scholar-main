import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import {
  adminLoginFn,
  getAdminSignupStateFn,
  getCurrentUserStateFn,
  registerAdminFn,
} from "@/lib/backend";
import {
  broadcastAuthSessionChange,
  getSafeReturnTo,
  subscribeToAuthSessionChanges,
} from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/login")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { mode?: "login" | "register"; returnTo?: string } => ({
    mode: search["mode"] === "register" ? "register" : "login",
    ...(typeof search["returnTo"] === "string" ? { returnTo: search["returnTo"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Administrator sign in — ScholarDesk" },
      { name: "description", content: "Sign in to your ScholarDesk administrator account." },
    ],
  }),
  component: AdminLoginPage,
});

const signupSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your full name").max(100),
    email: z.string().trim().email("Enter a valid email").max(255),
    password: z
      .string()
      .min(8, "At least 8 characters")
      .max(128, "Password is too long")
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/[0-9]/, "Include a number")
      .regex(/[^A-Za-z0-9]/, "Include a symbol"),
    confirm: z.string(),
    signup_secret: z.string().min(1, "Enter the admin signup key").max(256),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

function AdminLoginPage() {
  const { mode = "login", returnTo } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [signedInAsStudent, setSignedInAsStudent] = useState(false);
  const {
    data: signupState,
    isLoading: signupStateLoading,
    isError: signupStateError,
  } = useQuery({
    queryKey: ["admin-signup-state"],
    queryFn: () => getAdminSignupStateFn(),
  });
  const signupAvailable = signupState?.available === true;

  useEffect(
    () =>
      subscribeToAuthSessionChanges(() => {
        queryClient.clear();
        window.location.reload();
      }),
    [queryClient],
  );

  useEffect(() => {
    let active = true;
    getCurrentUserStateFn()
      .then(({ user, isAdmin }) => {
        if (!user) return;
        if (!active) return;
        if (isAdmin && mode !== "register") {
          window.location.replace(getSafeReturnTo(returnTo, "/admin/dashboard"));
        } else if (!isAdmin) {
          setSignedInAsStudent(true);
        }
      })
      .catch((error: unknown) =>
        console.error("Could not check the current administrator session.", error),
      );
    return () => {
      active = false;
    };
  }, [mode, navigate, returnTo]);

  function setMode(nextMode: "login" | "register") {
    setFormError(null);
    setFieldErrors({});
    navigate({
      to: "/admin/login",
      search: { mode: nextMode, ...(returnTo ? { returnTo } : {}) },
      replace: true,
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setFieldErrors({});
    const formData = new FormData(event.currentTarget);
    try {
      let user: { id: string; email: string };
      if (mode === "register") {
        if (!signupAvailable) {
          setFormError("Administrator signup is not configured. Contact the site owner.");
          return;
        }
        const parsed = signupSchema.safeParse(Object.fromEntries(formData));
        if (!parsed.success) {
          setFieldErrors(
            Object.fromEntries(
              parsed.error.issues.map((issue) => [issue.path[0] as string, issue.message]),
            ),
          );
          return;
        }
        const { confirm: _confirm, ...input } = parsed.data;
        user = await registerAdminFn({ data: input });
      } else {
        user = await adminLoginFn({
          data: {
            email: String(formData.get("email")),
            password: String(formData.get("password")),
          },
        });
      }
      await queryClient.cancelQueries();
      queryClient.clear();
      broadcastAuthSessionChange();
      window.location.replace(getSafeReturnTo(returnTo, "/admin/dashboard"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const safeMessages = new Set([
        "The admin signup key is incorrect.",
        "Administrator signup is not configured.",
        "Could not create the administrator account. If this email is already registered, sign in.",
        "Email or password is incorrect.",
        "Too many sign-in attempts. Please wait 15 minutes and try again.",
        "Sign-in is temporarily unavailable. Please try again.",
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
    <div className="min-h-svh bg-[#edf3ef] px-4 py-8 sm:px-6">
      <main className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <section className="rounded-xl border border-[#d6e3dc] bg-white p-6 shadow-[0_24px_70px_-42px_rgba(16,47,43,0.32)] sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#74839a]">
            Secure administrator portal
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {mode === "register" ? "Set up your admin account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {mode === "register"
              ? "Create an administrator account with the signup key provided by the site owner."
              : "Sign in to open your ScholarDesk operations workspace."}
          </p>
          {signedInAsStudent && mode !== "register" && (
            <Alert className="mt-6">
              <AlertTitle>Student session detected</AlertTitle>
              <AlertDescription>
                Sign in with an administrator account to open the admin workspace.
              </AlertDescription>
            </Alert>
          )}
          {formError && (
            <Alert variant="destructive" className="mt-6">
              <AlertTitle>Request not completed</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={submit} className="mt-6 space-y-3" noValidate>
            {mode === "register" ? (
              <>
                {signupStateLoading ? (
                  <p className="text-sm text-muted-foreground">Checking admin signup setup…</p>
                ) : signupStateError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Could not check signup setup</AlertTitle>
                    <AlertDescription>
                      Refresh the page to verify that admin signup is configured.
                    </AlertDescription>
                  </Alert>
                ) : !signupAvailable ? (
                  <Alert>
                    <AlertTitle>Admin signup is not enabled on this server</AlertTitle>
                    <AlertDescription>
                      In Render, add ADMIN_SIGNUP_SECRET under your service’s Environment settings,
                      then redeploy. Enter the same key below; it must be at least 32 characters.
                      Keep it private.
                    </AlertDescription>
                  </Alert>
                ) : null}
                {(
                  [
                    ["full_name", "Full name", "text"],
                    ["email", "Email", "email"],
                    ["password", "Password", "password"],
                    ["confirm", "Confirm password", "password"],
                    ["signup_secret", "Admin signup key", "password"],
                  ] as const
                ).map(([name, label, type]) => (
                  <div key={name}>
                    <Label htmlFor={name}>{label}</Label>
                    <Input
                      id={name}
                      name={name}
                      type={type}
                      required
                      autoComplete={
                        name === "email"
                          ? "email"
                          : name === "full_name"
                            ? "name"
                            : name === "signup_secret"
                              ? "off"
                              : "new-password"
                      }
                      className="mt-1.5 h-10 rounded-lg"
                    />
                    {fieldErrors[name] && (
                      <p className="mt-1 text-xs text-destructive">{fieldErrors[name]}</p>
                    )}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Password: 8+ characters with uppercase, lowercase, a number and a symbol.
                </p>
                <Button
                  type="submit"
                  className="mt-2 h-11 w-full rounded-xl"
                  size="lg"
                  disabled={busy || signupStateLoading || signupStateError || !signupAvailable}
                >
                  {busy ? "Please wait…" : "Create admin account"}
                </Button>
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
                    autoComplete="username"
                    className="mt-1.5 h-10 rounded-lg"
                  />
                </div>
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
                <Button type="submit" className="h-11 w-full rounded-xl" size="lg" disabled={busy}>
                  {busy ? "Please wait…" : "Sign in to admin"}
                </Button>
              </>
            )}
          </form>

          {mode === "register" ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an admin account?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="font-semibold text-primary hover:underline"
              >
                Sign in
              </button>
            </p>
          ) : (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Need an admin account?{" "}
              <button
                type="button"
                onClick={() => setMode("register")}
                className="font-semibold text-primary hover:underline"
              >
                Create admin account
              </button>
            </p>
          )}
          <p className="mt-5 border-t pt-4 text-center text-xs">
            <Link
              to="/auth"
              search={{ mode: "login" }}
              className="font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              ← Student sign in
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
