import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
] as const;
const KENYAN_UNIVERSITIES = [
  "Africa International University",
  "Africa Nazarene University",
  "Aga Khan University",
  "Alupe University",
  "Amref International University",
  "Catholic University of Eastern Africa",
  "Chuka University",
  "Co-operative University of Kenya",
  "Daystar University",
  "Dedan Kimathi University of Technology",
  "Egerton University",
  "Garissa University",
  "Great Lakes University of Kisumu",
  "Gretsa University",
  "Jaramogi Oginga Odinga University of Science and Technology",
  "Jomo Kenyatta University of Agriculture and Technology",
  "Kabarak University",
  "Kaimosi Friends University",
  "Karatina University",
  "KCA University",
  "Kenyatta University",
  "Kenya Highlands Evangelical University",
  "Kenya Methodist University",
  "Kirinyaga University",
  "Kiriri Women's University of Science and Technology",
  "Kisii University",
  "Laikipia University",
  "Lukenya University",
  "Maasai Mara University",
  "Machakos University",
  "Management University of Africa",
  "Maseno University",
  "Masinde Muliro University of Science and Technology",
  "Meru University of Science and Technology",
  "Moi University",
  "Mount Kenya University",
  "Multimedia University of Kenya",
  "Murang'a University of Technology",
  "Pan Africa Christian University",
  "Pioneer International University",
  "Presbyterian University of East Africa",
  "Pwani University",
  "Riara University",
  "Rongo University",
  "Scott Christian University",
  "South Eastern Kenya University",
  "St. Paul's University",
  "Strathmore University",
  "Taita Taveta University",
  "Tangaza University",
  "Technical University of Kenya",
  "Technical University of Mombasa",
  "Tharaka University",
  "The East African University",
  "Tom Mboya University",
  "Umma University",
  "United States International University-Africa",
  "University of Eldoret",
  "University of Embu",
  "University of Kabianga",
  "University of Nairobi",
  "Uzima University",
  "Zetech University",
] as const;
const STUDY_YEARS = ["1st year", "2nd year", "3rd year", "4th year", "Other"] as const;

function InstitutionCombobox({ value }: { value: string }) {
  const [open, setOpen] = useState(false);
  const [institution, setInstitution] = useState(value);
  const [query, setQuery] = useState("");
  const customInstitution = query.trim();
  const hasExactMatch = KENYAN_UNIVERSITIES.some(
    (university) => university.toLowerCase() === customInstitution.toLowerCase(),
  );

  function chooseInstitution(nextInstitution: string) {
    setInstitution(nextInstitution);
    setQuery("");
    setOpen(false);
  }

  return (
    <>
      <input type="hidden" name="institution" value={institution} />
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id="institution"
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="mt-1.5 w-full justify-between font-normal"
          >
            <span className="truncate">{institution || "Select or type institution"}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <Command>
            <CommandInput
              autoComplete="off"
              maxLength={120}
              placeholder="Search universities..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>No matching university.</CommandEmpty>
              <CommandGroup heading="Universities in Kenya">
                {KENYAN_UNIVERSITIES.map((university) => (
                  <CommandItem
                    key={university}
                    value={university}
                    onSelect={() => chooseInstitution(university)}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${institution === university ? "opacity-100" : "opacity-0"}`}
                    />
                    {university}
                  </CommandItem>
                ))}
              </CommandGroup>
              {customInstitution && !hasExactMatch && (
                <CommandGroup heading="Custom institution">
                  <CommandItem
                    value={customInstitution}
                    onSelect={() => chooseInstitution(customInstitution)}
                  >
                    Use "{customInstitution}"
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}

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
            <Label htmlFor="institution">Institution</Label>
            <InstitutionCombobox value={p.institution ?? ""} />
          </div>
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
