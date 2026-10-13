import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProfileFn } from "@/lib/backend";
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
  ["reg_number", "Admission number"],
  ["phone", "Phone"],
  ["country", "Country"],
  ["institution", "Institution"],
  ["course", "Course / program"],
  ["year_of_study", "Year of study"],
] as const;

function Profile() {
  const { user } = Route.useRouteContext();
  const { data: p, isLoading } = useProfile(user.id);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (isLoading || !p) return <p className="text-muted-foreground">Loading…</p>;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const patch = Object.fromEntries(
      FIELDS.map(([k]) => [k, (fd[k] ?? "").trim().slice(0, 120)]),
    ) as Record<(typeof FIELDS)[number][0], string>;
    if (!patch["full_name"]) {
      toast.error("Name is required");
      return;
    }
    setBusy(true);
    try {
      await saveProfileFn({ data: patch });
    } catch (error) {
      setBusy(false);
      toast.error(error instanceof Error ? error.message : "Could not save profile.");
      return;
    }
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Profile saved");
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold">Profile</h1>
      <form
        onSubmit={save}
        className="mt-8 grid max-w-2xl gap-5 rounded-2xl border bg-card p-6 shadow-soft sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <Label>Email</Label>
          <Input value={p.email ?? ""} disabled className="mt-1.5" />
        </div>
        {FIELDS.map(([k, label]) => (
          <div key={k}>
            <Label htmlFor={k}>{label}</Label>
            <Input id={k} name={k} defaultValue={p[k] ?? ""} className="mt-1.5" />
          </div>
        ))}
        <div className="sm:col-span-2">
          <Button disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </div>
      </form>
    </div>
  );
}
