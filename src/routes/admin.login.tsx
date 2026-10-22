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
  registerAdminFn,
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
        if (isAdmin && mode !== "register") {
          await navigate({ to: "/admin/dashboard", replace: true });
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
  }, [mode, navigate]);

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
      queryClient.setQueryData(["current-user"], user);
      await navigate({ to: "/admin/dashboard", replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const safeMessages = new Set([
        "The admin signup key is incorrect.",
        "Administrator signup is not configured.",
        "An account with this email already exists. Sign in or use a different email address.",
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
    <div className="grid min-h-screen bg-[#f5f7fa] lg:grid-cols-[0.92fr_1.08fr]">
      <aside className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-[#17263c] p-10 text-white lg:flex xl:p-14">
        <div className="pointer-events-none absolute -right-24 top-1/4 h-80 w-80 rounded-full border-[38px] border-white/[0.04]" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-[#d5ac57]/10 blur-3xl" />
        <Logo light />
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Private operations
          </span>
          <h2 className="mt-6 text-4xl font-semibold leading-tight xl:text-5xl">
            A clearer view of the work that matters.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-white/55">
            Manage requests, support students, and keep your service moving from one secure
            workspace.
          </p>
        </div>
        <p className="relative text-xs text-white/40">
          SCHOLARDESK <span className="px-2">·</span> ADMIN ACCESS
        </p>
      </aside>
      <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[480px]">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <section className="rounded-[26px] border bg-white p-6 shadow-[0_24px_70px_-42px_rgba(23,38,60,0.3)] sm:p-9">
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

            <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
              {mode === "register" ? (
                signupStateLoading ? (
                  <p className="text-sm text-muted-foreground">Checking admin signup setup…</p>
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
                        <Input
                          id={name}
                          name={name}
                          type={type}
                          required
                          className="mt-1.5 h-11 rounded-xl"
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
                      disabled={busy}
                    >
                      {busy ? "Please wait…" : "Create admin account"}
                    </Button>
                  </>
                ) : (
                  <p className="rounded-xl bg-[#f6f8fb] p-4 text-sm text-muted-foreground">
                    Administrator signup is not configured. Contact the site owner.
                  </p>
                )
              ) : (
                <>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      className="mt-1.5 h-11 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      className="mt-1.5 h-11 rounded-xl"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="h-11 w-full rounded-xl"
                    size="lg"
                    disabled={busy}
                  >
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
              !signupStateLoading &&
              !signupStateError &&
              signupAvailable && (
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
              )
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
        </div>
      </main>
    </div>
  );
}
