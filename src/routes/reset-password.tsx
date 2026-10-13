import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { resetPasswordFn } from "@/lib/backend";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Set a new password — ScholarDesk" },
      { name: "description", content: "Choose a new password for your ScholarDesk account." },
      { property: "og:title", content: "Reset password — ScholarDesk" },
      { property: "og:description", content: "Choose a new password for your account." },
    ],
  }),
  component: Reset,
});

const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function Reset() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pw = String(fd.get("password"));
    if (!strong.test(pw)) {
      toast.error("Use 8+ characters with upper, lower, number and symbol.");
      return;
    }
    if (pw !== fd.get("confirm")) {
      toast.error("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await resetPasswordFn({ data: { token, password: pw } });
    } catch (error) {
      setBusy(false);
      toast.error(error instanceof Error ? error.message : "Could not update password.");
      return;
    }
    setBusy(false);
    toast.success("Password updated");
    navigate({ to: "/auth", search: { mode: "login" } });
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <Logo />
        <h1 className="pt-4 text-2xl font-semibold">Set a new password</h1>
        <div>
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" name="confirm" type="password" className="mt-1.5" />
        </div>
        <Button className="w-full" disabled={busy}>
          {busy ? "Saving…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
