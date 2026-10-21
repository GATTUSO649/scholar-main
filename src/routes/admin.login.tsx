import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { adminLoginFn, getAdminStateFn, getCurrentUserFn, registerAdminFn } from "@/lib/backend";

type Mode = "login" | "register";

export const Route = createFileRoute("/admin/login")({
  validateSearch: (search: Record<string, unknown>): { mode?: Mode } => ({
    mode: search["mode"] === "register" ? "register" : "login",
  }),
  head: () => ({
    meta: [
      { title: "Administrator sign in — ScholarDesk" },
      { name: "description", content: "Sign in or register an administrator account." },
    ],
  }),
  component: AdminLoginPage,
});

const password = z
  .string()
  .min(8, "At least 8 characters")
  .max(128, "Password is too long")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[0-9]/, "Include a number")
  .regex(/[^A-Za-z0-9]/, "Include a symbol");

const registrationSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your full name").max(100),
    email: z.string().trim().email("Enter a valid email").max(255),
    password,
    confirm: z.string(),
    signup_secret: z.string().min(1, "Enter the admin signup key").max(256),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

const registrationFields: [keyof z.infer<typeof registrationSchema>, string, string?][] = [
  ["full_name", "Full name"],
  ["email", "Email", "email"],
  ["password", "Password", "password"],
  ["confirm", "Confirm password", "password"],
  ["signup_secret", "Admin signup key", "password"],
];

function AdminLoginPage() {
  const { mode = "login" } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [signedInAsStudent, setSignedInAsStudent] = useState(false);

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

  function setMode(nextMode: Mode) {
    setErrors({});
    setFormError(null);
    navigate({ to: "/admin/login", search: { mode: nextMode }, replace: true });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setErrors({});
    const formData = new FormData(event.currentTarget);
    try {
      let user: { id: string; email: string };
      if (mode === "register") {
        const parsed = registrationSchema.safeParse(Object.fromEntries(formData));
        if (!parsed.success) {
          setErrors(
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
        "An account with this email already exists. Try logging in or resetting your password.",
        "Could not create the administrator account. Please try again.",
        "Admin signup is not available.",
        "The admin signup key is invalid.",
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
            {mode === "register" ? "Create an admin account" : "Admin sign in"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "register"
              ? "Registration requires an administrator signup key."
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
              <div className="grid gap-4 sm:grid-cols-2">
                {registrationFields.map(([name, label, type]) => (
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
              </>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? "Please wait…" : mode === "register" ? "Create admin account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                Have an admin signup key?{" "}
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="font-semibold text-primary hover:underline"
                >
                  Create admin account
                </button>
              </>
            ) : (
              <>
                Already registered?{" "}
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
