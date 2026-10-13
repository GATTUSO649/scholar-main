import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getAdminRequestsFn, getPublicDataFn, setPublicPricesFn } from "@/lib/backend";
import { AdminGate } from "@/components/AdminGate";
import { RequestTable, type Row } from "@/components/RequestTable";
import { ACTIVE, STATUS_LABEL, STATUS_ORDER, type RequestStatus } from "@/lib/status";
import { money } from "@/lib/requests";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — ScholarDesk" },
      { name: "description", content: "Manage all requests." },
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

function PriceToggle() {
  const qc = useQueryClient();
  const { data: show = true } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => (await getPublicDataFn()).showPrices,
  });
  async function change(v: boolean) {
    try {
      await setPublicPricesFn({ data: { showPrices: v } });
      qc.setQueryData(["site-settings"], v);
      toast.success(
        v
          ? "Prices are now visible to visitors"
          : "Prices hidden — students see 'Price on request'",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update price visibility.");
    }
  }
  return (
    <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border bg-card p-4 shadow-soft">
      <div>
        <p className="font-semibold">Show service prices on homepage</p>
        <p className="text-xs text-muted-foreground">
          When off, visitors see "Price on request" and get a price only in their quote.
        </p>
      </div>
      <Switch checked={show} onCheckedChange={change} aria-label="Show prices" />
    </div>
  );
}

function Admin() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<RequestStatus | "all">("all");
  const { data = [] } = useQuery({
    queryKey: ["admin-requests"],
    queryFn: () => getAdminRequestsFn(),
  });

  const rows = data.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      `${r.title} ${r.ref} ${r.profiles?.full_name ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );
  const revenue = data
    .filter((r) => r.payment_status === "paid")
    .reduce((s, r) => s + Number(r.price ?? 0), 0);
  const cards = [
    ["New", data.filter((r) => r.status === "submitted").length],
    ["Active", data.filter((r) => ACTIVE.includes(r.status)).length],
    ["Completed", data.filter((r) => r.status === "completed").length],
    [
      "Overdue",
      data.filter(
        (r) => r.deadline && new Date(r.deadline) < new Date() && ACTIVE.includes(r.status),
      ).length,
    ],
    ["Paid revenue", money(revenue)],
  ];

  return (
    <div>
      <h1 className="text-3xl font-semibold">All requests</h1>
      <PriceToggle />
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        {cards.map(([k, v]) => (
          <div key={k as string} className="rounded-2xl border bg-card p-5 shadow-soft">
            <p className="font-display text-2xl font-semibold">{v}</p>
            <p className="text-xs text-muted-foreground">{k}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Input
          placeholder="Search title, reference or student…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as RequestStatus | "all")}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All statuses</option>
          {[...STATUS_ORDER, "cancelled" as const].map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-6">
        <RequestTable rows={rows as Row[]} admin />
      </div>
    </div>
  );
}
