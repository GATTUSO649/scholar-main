import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { changePasswordFn, saveProfileFn } from "@/lib/backend";
import { useProfile } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — ScholarDesk" },
      { name: "description", content: "Manage your student profile." },
    ],
  }),
  component: Profile,
});

const FIELDS = [
  ["full_name", "Full name"],
  ["phone", "Phone"],
  ["country", "Country"],
  ["institution", "Institution"],
] as const;
const STUDY_YEARS = ["1st year", "2nd year", "3rd year", "4th year", "Other"] as const;

function Profile() {
  const { user } = Route.useRouteContext();
  const { data: p, isLoading } = useProfile(user.id);
  const qc = useQueryClient();
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  if (isLoading || !p) return <p className="text-muted-foreground">Loading…</p>;
  const currentStudyYear =
    STUDY_YEARS.find((year) => year === p.year_of_study) ?? (p.year_of_study ? "Other" : undefined);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const yearOfStudy = STUDY_YEARS.find((year) => year === fd["year_of_study"]);
    if (!yearOfStudy) {
      toast.error("Select your year of study.");
      return;
    }
    const patch = {
      full_name: fd["full_name"]?.trim().slice(0, 100) ?? "",
      phone: fd["phone"]?.trim().slice(0, 40) ?? "",
      country: fd["country"]?.trim().slice(0, 60) ?? "",
      institution: fd["institution"]?.trim().slice(0, 120) ?? "",
      year_of_study: yearOfStudy,
    };
    if (!patch["full_name"]) {
      toast.error("Name is required");
      return;
    }
    setProfileBusy(true);
    try {
      await saveProfileFn({ data: patch });
    } catch (error) {
      setProfileBusy(false);
      toast.error(error instanceof Error ? error.message : "Could not save profile.");
      return;
    }
    setProfileBusy(false);
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Profile saved");
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      toast.error("Choose a new password different from your current password.");
      return;
    }

    setPasswordBusy(true);
    try {
      await changePasswordFn({ data: { currentPassword, newPassword } });
      form.reset();
      toast.success("Password changed. Other signed-in sessions have been logged out.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change your password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Account & profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your contact and study details, and keep your account secure.
        </p>
      </header>

      <section>
        <h2 className="text-xl font-semibold">Profile details</h2>
        <form
          onSubmit={save}
          className="mt-4 grid max-w-3xl gap-5 rounded-2xl border bg-card p-6 shadow-soft sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <Label htmlFor="account-email">Account email</Label>
            <Input
              id="account-email"
              type="email"
              value={p.email ?? ""}
              readOnly
              aria-describedby="email-change-help"
              className="mt-1.5"
            />
            <p id="email-change-help" className="mt-1.5 text-xs text-muted-foreground">
              To change your sign-in email, contact support so we can verify the new address.
            </p>
          </div>
          {FIELDS.map(([k, label]) => (
            <div key={k}>
              <Label htmlFor={k}>{label}</Label>
              <Input id={k} name={k} defaultValue={p[k] ?? ""} className="mt-1.5" />
            </div>
          ))}
          <div>
            <Label htmlFor="year_of_study">Year of study</Label>
            <Select name="year_of_study" defaultValue={currentStudyYear}>
              <SelectTrigger id="year_of_study" className="mt-1.5 w-full">
                <SelectValue placeholder="Select year of study" />
              </SelectTrigger>
              <SelectContent>
                {STUDY_YEARS.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Button disabled={profileBusy}>{profileBusy ? "Saving…" : "Save profile"}</Button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Change password</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your current password to set a new one. Other active sessions will be signed out.
        </p>
        <form
          onSubmit={changePassword}
          className="mt-4 grid max-w-3xl gap-5 rounded-2xl border bg-card p-6 shadow-soft sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              className="mt-1.5"
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Use at least 8 characters with uppercase, lowercase, a number and a symbol.
          </p>
          <div className="sm:col-span-2">
            <Button disabled={passwordBusy}>
              {passwordBusy ? "Updating…" : "Change password"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
