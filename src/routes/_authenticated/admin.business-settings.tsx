import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Building2, Landmark, Save, ShieldCheck } from "lucide-react";
import { AdminGate } from "@/components/AdminGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAdminBusinessSettingsFn, saveAdminBusinessSettingsFn } from "@/lib/backend";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/business-settings")({
  head: () => ({ meta: [{ title: "Business settings — ScholarDesk" }] }),
  component: BusinessSettingsRoute,
});

type BusinessSettings = { businessName: string; mpesaTillNumber: string };

function BusinessSettingsRoute() {
  const { isAdmin } = Route.useRouteContext();
  return (
    <AdminGate isAdmin={isAdmin}>
      <BusinessSettingsPage />
    </AdminGate>
  );
}

function BusinessSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-business-settings"],
    queryFn: () => getAdminBusinessSettingsFn(),
  });
  const [draft, setDraft] = useState<BusinessSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const values = draft ?? data ?? { businessName: "ScholarDesk", mpesaTillNumber: "" };

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveAdminBusinessSettingsFn({ data: values });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-business-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["public-payment-details"] }),
      ]);
      setDraft(null);
      toast.success("Business payment details saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save business settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-7">
      <header className="border-b border-[#dfe8e3] pb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b8177]">
          Student service desk <span className="px-1 text-[#bd8a48]">/</span> Configuration
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173c33]">Business settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#677872]">
          Set the merchant details students see before checkout and the Till used for new M-PESA
          payments.
        </p>
      </header>

      {isLoading ? (
        <p className="py-8 text-sm text-muted-foreground" aria-live="polite">
          Loading business settings…
        </p>
      ) : isError ? (
        <div className="flex items-center justify-between border border-[#ecc9c0] bg-[#fff7f4] px-4 py-3">
          <p className="text-sm text-[#9a4536]" role="alert">
            Business settings could not be loaded.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <form onSubmit={saveSettings} className="max-w-3xl space-y-6">
          <section className="space-y-5 border-y border-[#dfe8e3] bg-white px-4 py-5 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e5f1eb] text-[#155b4c]">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-[#173c33]">Merchant identity</h2>
                <p className="text-sm text-[#71817a]">Shown on the student payment details card.</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="business-name">Business name</Label>
                <Input
                  id="business-name"
                  value={values.businessName}
                  onChange={(event) => setDraft({ ...values, businessName: event.target.value })}
                  maxLength={120}
                  minLength={2}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mpesa-till">Registered M-PESA Till Number</Label>
                <div className="relative">
                  <Landmark className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71817a]" />
                  <Input
                    id="mpesa-till"
                    inputMode="numeric"
                    pattern="[0-9]{5,7}"
                    value={values.mpesaTillNumber}
                    onChange={(event) =>
                      setDraft({ ...values, mpesaTillNumber: event.target.value })
                    }
                    className="pl-9"
                    minLength={5}
                    maxLength={7}
                    placeholder="Enter registered Till number"
                    required
                  />
                </div>
                <p className="text-xs text-[#71817a]">
                  Digits only. This Till is used as both BusinessShortCode and PartyB.
                </p>
              </div>
            </div>
          </section>

          <section className="flex items-start gap-3 border border-[#dce8df] bg-[#f5faf6] px-4 py-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#297351]" />
            <div>
              <h2 className="text-sm font-semibold text-[#24473b]">Credential security</h2>
              <p className="mt-1 text-sm leading-6 text-[#61746a]">
                Daraja consumer key, consumer secret, and passkey remain in the hosting provider's
                environment variables. The passkey and production app must be provisioned for this
                Till. New checkouts use this setting; existing transactions retain their original
                Till for verification.
              </p>
            </div>
          </section>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving…" : "Save business settings"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
