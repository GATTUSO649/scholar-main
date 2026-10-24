import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, Search, Settings2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getAdminRequestsFn, getPublicDataFn, setPublicPricesFn } from "@/lib/backend";
import { AdminGate } from "@/components/AdminGate";
import { RequestTable } from "@/components/RequestTable";
import { ACTIVE } from "@/lib/status";
import { money } from "@/lib/requests";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "All requests — ScholarDesk" },
      { name: "description", content: "Search and manage student requests." },
    ],
  }),
  component: AdminRoute,
});

function AdminRoute() {
  const { user } = Route.useRouteContext();
  return (
    <AdminGate userId={user.id}>
      <Admin />
    </AdminGate>
  );
}

function PriceVisibility() {
  const qc = useQueryClient();
  const {
    data: show,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => (await getPublicDataFn()).showPrices,
  });
  const [saving, setSaving] = useState(false);

  async function change(value: boolean) {
    setSaving(true);
    try {
      await setPublicPricesFn({ data: { showPrices: value } });
      qc.setQueryData(["site-settings"], value);
      toast.success(value ? "Prices are now visible to visitors" : "Prices hidden from visitors");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update price visibility.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eef2f8] text-[#334b6b]">
          <Settings2 className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold">Homepage price visibility</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {isError
              ? "Could not load the current setting. Refresh to try again."
              : "Choose whether visitors see service prices or request a quote."}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-xl bg-[#f7f9fc] px-4 py-3 sm:min-w-[220px]">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          {show ? (
            <Eye className="h-4 w-4 text-emerald-600" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
          {isLoading ? "Loading…" : show ? "Prices visible" : "Prices hidden"}
        </span>
        <Switch
          checked={show ?? true}
          onCheckedChange={change}
          disabled={isLoading || isError || saving}
          aria-label="Show service prices on homepage"
        />
      </div>
    </section>
  );
}

type QueueFilter = "all" | "new" | "active" | "completed" | "declined" | "cancelled";

function Admin() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QueueFilter>("all");
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-requests"],
    queryFn: () => getAdminRequestsFn(),
  });
  const requests = data ?? [];

  const countFor = (status: QueueFilter) => {
    if (status === "all") return requests.length;
    if (status === "new")
      return requests.filter((request) => request.status === "submitted").length;
    if (status === "active")
      return requests.filter((request) => ACTIVE.includes(request.status)).length;
    return requests.filter((request) => request.status === status).length;
  };
  const tabs: { id: QueueFilter; label: string }[] = [
    { id: "all", label: "All requests" },
    { id: "new", label: "New" },
    { id: "active", label: "In progress" },
    { id: "completed", label: "Completed" },
    { id: "declined", label: "Declined" },
    { id: "cancelled", label: "Cancelled" },
  ];
  const rows = requests.filter((request) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "new" && request.status === "submitted") ||
      (filter === "active" && ACTIVE.includes(request.status)) ||
      request.status === filter;
    const searchable =
      `${request.title} ${request.ref} ${request.profiles?.full_name ?? ""}`.toLowerCase();
    return matchesFilter && searchable.includes(query.trim().toLowerCase());
  });
  const revenueByCurrency = requests.reduce<Record<string, number>>((totals, request) => {
    if (request.payment_status === "paid") {
      totals[request.currency] = (totals[request.currency] ?? 0) + Number(request.price ?? 0);
    }
    return totals;
  }, {});
  const revenueSummary =
    Object.entries(revenueByCurrency)
      .map(([currency, amount]) => money(amount, currency))
      .join(" · ") || money(0);
  const overdue = requests.filter(
    (request) =>
      request.deadline &&
      new Date(request.deadline) < new Date() &&
      ACTIVE.includes(request.status),
  ).length;

  return (
    <div className="space-y-7">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#687b93]">
            Operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">All requests</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review incoming work, update progress, and keep every student informed.
          </p>
        </div>
        <Link
          to="/admin/dashboard"
          className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl border bg-white px-4 text-sm font-semibold shadow-sm transition-colors hover:bg-muted sm:self-auto"
        >
          Dashboard <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Total requests"
          value={isLoading ? "—" : requests.length}
          detail="Across all statuses"
        />
        <Metric
          label="Awaiting review"
          value={isLoading ? "—" : countFor("new")}
          detail="New submissions"
          tone="blue"
        />
        <Metric
          label="Past deadline"
          value={isLoading ? "—" : overdue}
          detail="Active requests"
          tone={overdue ? "rose" : "green"}
        />
        <Metric
          label="Paid totals"
          value={isLoading ? "—" : revenueSummary}
          detail="Grouped by currency"
          tone="gold"
        />
      </section>

      <PriceVisibility />

      <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)]">
        <div className="border-b px-5 pt-5 sm:px-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold">Request queue</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {isLoading
                  ? "Loading requests…"
                  : `${rows.length} matching request${rows.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search title, ref, student"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 rounded-xl border-[#e1e6ee] bg-[#fafbfd] pl-9"
              />
            </div>
          </div>
          <div className="mt-5 flex gap-5 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-0.5 pb-3 text-sm transition-colors ${
                  filter === tab.id
                    ? "border-[#17263c] font-semibold text-[#17263c]"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                    filter === tab.id
                      ? "bg-[#edf1f6] text-[#17263c]"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isLoading ? "…" : countFor(tab.id)}
                </span>
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div className="space-y-3 p-6" aria-label="Loading requests">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-[68px] animate-pulse rounded-xl bg-[#f3f5f8]" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 text-center">
            <p className="font-semibold">Could not load requests</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Please refresh and try again."}
            </p>
          </div>
        ) : (
          <RequestTable rows={rows} admin />
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  tone = "navy",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "navy" | "blue" | "rose" | "green" | "gold";
}) {
  const tones = {
    navy: "bg-[#eff2f7] text-[#263b58]",
    blue: "bg-sky-50 text-sky-700",
    rose: "bg-rose-50 text-rose-700",
    green: "bg-emerald-50 text-emerald-700",
    gold: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)]">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-3 truncate text-2xl font-bold tracking-tight">{value}</p>
      <span
        className={`mt-3 inline-flex rounded-md px-2 py-1 text-[10px] font-bold ${tones[tone]}`}
      >
        {detail}
      </span>
    </div>
  );
}
