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
  getAdminStateFn,
  getCurrentUserFn,
  registerInitialAdminFn,
} from "@/lib/backend";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/login")({
  validateSearch: (search: Record<string, unknown>): { mode?: "login" | "register" } => ({
    mode: search["mode"] === "register" ? "register" : "login",
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
  const { mode = "login" } = Route.useSearch();
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

  useEffect(() => {
    let active = true;
    getCurrentUserFn()
      .then(async (user) => {
        if (!user) return;
        const isAdmin = await getAdminStateFn();
        if (!active) return;
        if (isAdmin) await navigate({ to: "/admin/dashboard", replace: true });
        else setSignedInAsStudent(true);
      })
      .catch((error: unknown) =>
        console.error("Could not check the current administrator session.", error),
      );
    return () => {
      active = false;
    };
  }, [navigate]);

  function setMode(nextMode: "login" | "register") {
    setFormError(null);
    setFieldErrors({});
    navigate({ to: "/admin/login", search: { mode: nextMode }, replace: true });
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
          setFormError("Initial admin signup is no longer available. Sign in instead.");
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
        user = await registerInitialAdminFn({ data: input });
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
      queryClient.setQueryData(["current-user"], user);
      await navigate({ to: "/admin/dashboard", replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const safeMessages = new Set([
        "The admin signup key is incorrect.",
        "Initial admin signup is not configured.",
        "Initial admin signup is closed. Sign in with the existing administrator account.",
        "An account with this email already exists. Try signing in or resetting your password.",
        "Could not create the administrator account. Please try again.",
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
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.2fr]">
      <aside className="hidden flex-col justify-between bg-hero p-10 text-ink-foreground lg:flex">
        <Logo light />
        <div>
          <h2 className="text-4xl font-semibold leading-tight">ScholarDesk administration.</h2>
          <p className="mt-4 text-ink-foreground/70">
            Manage student requests and oversee the service securely.
          </p>
        </div>
        <p className="text-sm text-ink-foreground/50">Administrator access · Private workspace</p>
      </aside>
      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-3xl font-semibold">
            {mode === "register" ? "Create the initial admin account" : "Admin sign in"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "register"
              ? "Initial setup is available once. Enter the signup key configured by the site owner."
              : "Use your administrator credentials to continue."}
          </p>
          {signedInAsStudent && (
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

          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            {mode === "register" ? (
              signupStateLoading ? (
                <p className="text-sm text-muted-foreground">Checking initial admin setup…</p>
              ) : signupStateError ? (
                <p className="text-sm text-destructive">
                  Could not check admin setup. Refresh the page and try again.
                </p>
              ) : signupAvailable ? (
                <>
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
                      <Input id={name} name={name} type={type} required className="mt-1.5" />
                      {fieldErrors[name] && (
                        <p className="mt-1 text-xs text-destructive">{fieldErrors[name]}</p>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Password: 8+ characters with uppercase, lowercase, a number and a symbol.
                  </p>
                  <Button type="submit" className="w-full" size="lg" disabled={busy}>
                    {busy ? "Please wait…" : "Create initial admin account"}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {signupState?.reason === "already_created"
                    ? "The initial admin account has already been created. Sign in to continue."
                    : "Initial admin signup is not configured. Contact the site owner."}
                </p>
              )
            ) : (
              <>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="mt-1.5"
                  />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={busy}>
                  {busy ? "Please wait…" : "Sign in"}
                </Button>
              </>
            )}
          </form>

          {!signupStateLoading && !signupStateError && signupAvailable && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>
                  First-time setup?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    className="font-semibold text-primary hover:underline"
                  >
                    Create the initial admin account
                  </button>
                </>
              ) : (
                <>
                  Already set up?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="font-semibold text-primary hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          )}
          <p className="mt-2 text-center text-xs">
            <Link
              to="/auth"
              search={{ mode: "login" }}
              className="text-muted-foreground hover:underline"
            >
              ← Student sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
