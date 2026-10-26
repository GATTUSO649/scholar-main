import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { verifyEmailFn } from "@/lib/backend";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search["code"] === "string" ? search["code"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Verify your email — ScholarDesk" },
      { name: "description", content: "Verify your ScholarDesk email address." },
    ],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { code } = Route.useSearch();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Checking your verification link…");

  useEffect(() => {
    if (!code) {
      setStatus("error");
      setMessage("This verification link is missing a code. Please request a new one.");
      return;
    }

    verifyEmailFn({ data: { code } })
      .then(() => {
        setStatus("success");
        setMessage("Your email address has been verified successfully.");
      })
      .catch((error: unknown) => {
        setStatus("error");
        setMessage(
          error instanceof Error ? error.message : "This verification link is invalid or expired.",
        );
      });
  }, [code]);

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold">Email verification</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {status === "loading"
            ? "We’re validating your email address."
            : status === "success"
              ? "Your account is ready to use."
              : "Please try again or request a new verification email."}
        </p>
        <div className="mt-6 rounded-xl border bg-muted/30 p-4 text-sm">{message}</div>
        {status !== "loading" && (
          <div className="mt-6 flex gap-3">
            <Button asChild className="flex-1">
              <Link to="/auth" search={{ mode: "login" }}>
                {status === "success" ? "Continue to sign in" : "Go to sign in"}
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
