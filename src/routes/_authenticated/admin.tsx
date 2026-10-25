import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Download, Eye, EyeOff, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getAdminRequestsFn, getPublicDataFn, setPublicPricesFn } from "@/lib/backend";
import { AdminGate } from "@/components/AdminGate";
import { RequestTable } from "@/components/RequestTable";
import { ACTIVE } from "@/lib/status";
import { money } from "@/lib/requests";
import { downloadCsv } from "@/lib/csv";

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
  const { isAdmin } = Route.useRouteContext();
  const path = useRouterState({ select: (state) => state.location.pathname });
  return <AdminGate isAdmin={isAdmin}>{path === "/admin" ? <Admin /> : <Outlet />}</AdminGate>;
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
    <section className="flex flex-col justify-between gap-4 border-y border-[#dfe8e3] bg-white px-4 py-3.5 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#e5f1eb] text-[#155b4c]">
          <Settings2 className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-[#24473b]">Homepage price visibility</h2>
          <p className="mt-1 max-w-xl text-xs text-[#718078]">
            {isError
              ? "Could not load the current setting. Refresh to try again."
              : "Choose whether visitors see service prices or request a quote."}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:min-w-55">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-[#718078]">
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

type QueueFilter =
  "all" | "new" | "active" | "overdue" | "payment" | "completed" | "declined" | "cancelled";

function Admin() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QueueFilter>("all");
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-requests"],
    queryFn: () => getAdminRequestsFn(),
  });
  const requests = data ?? [];
  const now = Date.now();
  const isOverdue = (request: (typeof requests)[number]) =>
    !!request.deadline &&
    new Date(request.deadline).getTime() < now &&
    ACTIVE.includes(request.status);
  const needsPaymentFollowUp = (request: (typeof requests)[number]) =>
    request.payment_status === "pending" ||
    (request.status === "awaiting_payment" && request.payment_status !== "paid");

  const countFor = (status: QueueFilter) => {
    if (status === "all") return requests.length;
    if (status === "new")
      return requests.filter((request) => request.status === "submitted").length;
    if (status === "active")
      return requests.filter((request) => ACTIVE.includes(request.status)).length;
    if (status === "overdue") return requests.filter(isOverdue).length;
    if (status === "payment") return requests.filter(needsPaymentFollowUp).length;
    return requests.filter((request) => request.status === status).length;
  };
  const tabs: { id: QueueFilter; label: string }[] = [
    { id: "all", label: "All requests" },
    { id: "new", label: "New" },
    { id: "active", label: "In progress" },
    { id: "overdue", label: "Overdue" },
    { id: "payment", label: "Payment follow-up" },
    { id: "completed", label: "Completed" },
    { id: "declined", label: "Declined" },
    { id: "cancelled", label: "Cancelled" },
  ];
  const rows = requests.filter((request) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "new" && request.status === "submitted") ||
      (filter === "active" && ACTIVE.includes(request.status)) ||
      (filter === "overdue" && isOverdue(request)) ||
      (filter === "payment" && needsPaymentFollowUp(request)) ||
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
  const overdue = requests.filter(isOverdue).length;

  function exportRequests() {
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `scholardesk-requests-${date}.csv`,
      [
        "Reference",
        "Request",
        "Student",
        "Service",
        "Deadline",
        "Status",
        "Payment",
        "Quote",
        "Currency",
      ],
      rows.map((request) => [
        request.ref,
        request.title,
        request.profiles?.full_name ?? "",
        request.services?.name ?? "General service",
        request.deadline ?? "",
        request.status,
        request.payment_status,
        request.price ?? "",
        request.currency,
      ]),
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 border-b border-[#dfe8e3] pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#708078]">
            Student service desk <span className="px-1 text-[#bd8a48]">/</span> Intake
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#173c33] sm:text-4xl">
            Service requests
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#677872]">
            Triage submissions, manage deadlines, and follow each request through delivery.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="self-start border-[#d4e1da] text-[#31574b] hover:bg-[#f2f7f3] sm:self-auto"
        >
          <Link to="/admin/resources">
            Manage library <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </header>

      <section
        aria-label="Queue summary"
        className="grid grid-cols-2 border-y border-[#dfe8e3] bg-white sm:grid-cols-4"
      >
        <QueueStat label="All requests" value={isLoading ? "—" : requests.length} />
        <QueueStat label="Need review" value={isLoading ? "—" : countFor("new")} />
        <QueueStat label="Overdue" value={isLoading ? "—" : overdue} alert={overdue > 0} />
        <QueueStat label="Paid, grouped by currency" value={isLoading ? "—" : revenueSummary} />
      </section>

      <PriceVisibility />

      <section>
        <div className="flex flex-col justify-between gap-4 border-b border-[#dfe8e3] pb-4 lg:flex-row lg:items-end">
          <div>
            <h2 className="text-lg font-semibold text-[#173c33]">Request workbench</h2>
            <p className="mt-1 text-sm text-[#718078]" aria-live="polite">
              {isLoading ? "Loading the service queue…" : `${rows.length} requests in this view`}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#788780]" />
              <Input
                type="search"
                aria-label="Search request title, reference, or student"
                placeholder="Search request or student"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 rounded-lg border-[#d7e2dc] bg-white pl-9"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={exportRequests}
              disabled={isLoading || isError || rows.length === 0}
              className="border-[#d4e1da] text-[#31574b] hover:bg-[#f2f7f3]"
            >
              <Download className="mr-2 h-4 w-4" /> Export view
            </Button>
          </div>
        </div>
        <div
          className="mt-4 flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="Filter service requests"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              aria-pressed={filter === tab.id}
              className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                filter === tab.id
                  ? "bg-[#185c4b] text-white"
                  : "bg-white text-[#667770] hover:bg-[#eaf2ed] hover:text-[#183c34]"
              }`}
            >
              {tab.label}
              <span className="text-xs tabular-nums opacity-75">
                {isLoading ? "…" : countFor(tab.id)}
              </span>
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="mt-3 space-y-2" aria-label="Loading requests" aria-busy="true">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-md bg-white" />
            ))}
          </div>
        ) : isError ? (
          <div
            className="mt-3 border-y border-[#e0e8e3] bg-white px-5 py-8 text-center"
            role="alert"
          >
            <p className="font-semibold text-[#a34737]">Could not load requests</p>
            <p className="mt-1 text-sm text-[#718078]">
              {error instanceof Error ? error.message : "Please refresh and try again."}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-3 border-y border-[#e0e8e3] bg-white px-5 py-10 text-center">
            <p className="font-semibold text-[#31574b]">
              {query ? "No matching requests" : "No requests in this view"}
            </p>
            <p className="mt-1 text-sm text-[#718078]">
              {query
                ? "Try another title, reference, or student name."
                : "New submissions will appear here."}
            </p>
            {(query || filter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
                className="mt-3 text-sm font-semibold text-[#1b634f] hover:underline"
              >
                Clear search and filters
              </button>
            )}
          </div>
        ) : (
          <div className="mt-3">
            <RequestTable rows={rows} admin />
          </div>
        )}
      </section>
    </div>
  );
}

function QueueStat({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <div className="border-b border-r border-[#e8eeea] px-4 py-3.5 last:border-r-0 sm:px-5">
      <p className="text-[11px] font-medium text-[#718078]">{label}</p>
      <p
        className={`mt-1.5 truncate text-xl font-semibold tabular-nums ${alert && Number(value) > 0 ? "text-[#a34737]" : "text-[#183c34]"}`}
      >
        {value}
      </p>
    </div>
  );
}
