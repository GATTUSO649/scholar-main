import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, Check, Pencil, Plus, RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getAdminServicesFn, saveAdminServiceFn, setAdminServiceActiveFn } from "@/lib/backend";

type ServiceForm = {
  name: string;
  description: string;
  basePrice: string;
  currency: "KES" | "USD" | "GBP" | "EUR";
  unit: string;
  sort: string;
  active: boolean;
};

const emptyServiceForm: ServiceForm = {
  name: "",
  description: "",
  basePrice: "0",
  currency: "KES",
  unit: "per page",
  sort: "0",
  active: true,
};

export function PricingManager() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<ServiceForm>(emptyServiceForm);
  const [saving, setSaving] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);
  const {
    data: services = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["admin-services"],
    queryFn: () => getAdminServicesFn(),
  });
  const filteredServices = services.filter((service) =>
    `${service.name} ${service.description}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function startNewService() {
    setEditingId(null);
    setIsFormOpen(true);
    setForm({
      ...emptyServiceForm,
      sort: String(Math.max(-1, ...services.map((service) => service.sort)) + 1),
    });
  }

  function startEditing(service: (typeof services)[number]) {
    setEditingId(service.id);
    setIsFormOpen(true);
    setForm({
      name: service.name,
      description: service.description,
      basePrice: String(service.basePrice),
      currency: service.currency as ServiceForm["currency"],
      unit: service.unit,
      sort: String(service.sort),
      active: service.active,
    });
  }

  async function refreshCatalog() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-services"] }),
      queryClient.invalidateQueries({ queryKey: ["public-data"] }),
      queryClient.invalidateQueries({ queryKey: ["services"] }),
    ]);
  }

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveAdminServiceFn({
        data: {
          ...(editingId ? { id: editingId } : {}),
          name: form.name,
          description: form.description,
          base_price: Number(form.basePrice),
          currency: form.currency,
          unit: form.unit,
          sort: Number(form.sort),
          active: form.active,
        },
      });
      await refreshCatalog();
      setEditingId(null);
      setIsFormOpen(false);
      setForm(emptyServiceForm);
      toast.success(editingId ? "Service updated" : "Service added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this service.");
    } finally {
      setSaving(false);
    }
  }

  async function changeServiceState(id: string, active: boolean) {
    setChangingId(id);
    try {
      await setAdminServiceActiveFn({ data: { id, active } });
      await refreshCatalog();
      toast.success(active ? "Service restored to the public catalog" : "Service archived");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this service.");
    } finally {
      setChangingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-[#dfe8e3] pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase text-[#6b8177]">Public site</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#173c33]">Service pricing</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#677872]">
            Edit the prices and catalog shown on the public pricing page. Archive removes a service
            from new requests without changing its history.
          </p>
        </div>
        <Button type="button" onClick={startNewService}>
          <Plus className="mr-2 h-4 w-4" /> Add service
        </Button>
      </header>

      <div className="flex flex-wrap gap-x-8 gap-y-2 border-b border-[#dfe8e3] py-4 text-sm text-[#456057]">
        <span>
          <strong>{services.length}</strong> total
        </span>
        <span>
          <strong>{services.filter((service) => service.active).length}</strong> active
        </span>
        <span>
          <strong>{services.filter((service) => !service.active).length}</strong> archived
        </span>
      </div>

      {isFormOpen && (
        <form
          onSubmit={saveService}
          className="grid gap-4 border-b border-[#dfe8e3] py-6 md:grid-cols-2"
        >
          <Field label="Service name" htmlFor="service-name">
            <Input
              id="service-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              maxLength={120}
              required
            />
          </Field>
          <Field label="Price unit" htmlFor="service-unit">
            <Input
              id="service-unit"
              value={form.unit}
              onChange={(event) => setForm({ ...form, unit: event.target.value })}
              placeholder="per page, per project, etc."
              maxLength={40}
              required
            />
          </Field>
          <Field label="Description" htmlFor="service-description">
            <Textarea
              id="service-description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              maxLength={3000}
              required
              rows={3}
            />
          </Field>
          <div className="grid content-start gap-4 sm:grid-cols-2">
            <Field label="Starting price" htmlFor="service-price">
              <Input
                id="service-price"
                type="number"
                min="0"
                max="99999999.99"
                step="0.01"
                value={form.basePrice}
                onChange={(event) => setForm({ ...form, basePrice: event.target.value })}
                required
              />
            </Field>
            <Field label="Currency" htmlFor="service-currency">
              <select
                id="service-currency"
                value={form.currency}
                onChange={(event) =>
                  setForm({ ...form, currency: event.target.value as ServiceForm["currency"] })
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="KES">KES</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
              </select>
            </Field>
            <Field label="Display order" htmlFor="service-sort">
              <Input
                id="service-sort"
                type="number"
                min="0"
                max="9999"
                step="1"
                value={form.sort}
                onChange={(event) => setForm({ ...form, sort: event.target.value })}
                required
              />
            </Field>
            <div className="flex items-center justify-between gap-3 pt-6">
              <label htmlFor="service-active" className="text-sm font-medium">
                Visible publicly
              </label>
              <Switch
                id="service-active"
                checked={form.active}
                onCheckedChange={(active) => setForm({ ...form, active })}
                aria-label="Visible publicly"
              />
            </div>
          </div>
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" disabled={saving}>
              <Check className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save service"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingId(null);
                setIsFormOpen(false);
                setForm(emptyServiceForm);
              }}
            >
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="flex flex-col justify-between gap-3 border-b border-[#dfe8e3] py-4 sm:flex-row sm:items-center">
        <h2 className="font-semibold text-[#24473b]">Catalog ({filteredServices.length})</h2>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search services"
            placeholder="Search services"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="py-6 text-sm text-muted-foreground">Loading service catalog…</p>
      ) : isError ? (
        <p className="py-6 text-sm text-destructive" role="alert">
          Could not load services. Refresh to retry.
        </p>
      ) : filteredServices.length ? (
        <ul className="divide-y divide-[#e6ede8]">
          {filteredServices.map((service) => (
            <li key={service.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-[#24473b]">{service.name}</h3>
                  <span className="text-xs text-[#71817a]">#{service.sort}</span>
                  <span
                    className={`text-xs font-medium ${service.active ? "text-emerald-700" : "text-[#71817a]"}`}
                  >
                    {service.active ? "Active" : "Archived"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-[#71817a]">{service.description}</p>
                <p className="mt-1 text-sm font-medium text-[#365a4d]">
                  {service.basePrice > 0
                    ? `${service.currency} ${Number(service.basePrice).toFixed(2)} ${service.unit}`
                    : `Price on request · ${service.unit}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => startEditing(service)}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={changingId === service.id}
                  onClick={() => void changeServiceState(service.id, !service.active)}
                >
                  {service.active ? (
                    <Archive className="mr-2 h-4 w-4" />
                  ) : (
                    <RotateCcw className="mr-2 h-4 w-4" />
                  )}
                  {service.active ? "Archive" : "Restore"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-sm text-muted-foreground">
          {services.length
            ? "No services match that search."
            : "No services yet. Add the first service above."}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-[#294a3f]">
        {label}
      </label>
      {children}
    </div>
  );
}
