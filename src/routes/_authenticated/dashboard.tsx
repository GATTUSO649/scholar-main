import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, Wallet, Bell, Layers, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyRequestsFn, getMyUpdateCountFn } from "@/lib/backend";
import { useProfile } from "@/lib/auth";
import { ACTIVE } from "@/lib/status";
import { RequestTable } from "@/components/RequestTable";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ScholarDesk" },
      { name: "description", content: "Your student dashboard." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const { data: profile } = useProfile(user.id);
  const { data: reqs = [] } = useQuery({
    queryKey: ["my-requests", user.id],
    queryFn: () => getMyRequestsFn(),
  });
  const { data: updates = 0 } = useQuery({
    queryKey: ["my-updates-count", user.id],
    queryFn: () => getMyUpdateCountFn(),
  });

  const cards = [
    {
      label: "Active requests",
      value: reqs.filter((r) => ACTIVE.includes(r.status)).length,
      icon: Activity,
    },
    {
      label: "Completed",
      value: reqs.filter((r) => r.status === "completed").length,
      icon: CheckCircle2,
    },
    {
      label: "Pending payments",
      value: reqs.filter((r) => r.price != null && r.payment_status !== "paid").length,
      icon: Wallet,
    },
    { label: "Updates", value: updates, icon: Bell },
    { label: "Total requests", value: reqs.length, icon: Layers },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold sm:text-4xl">
          Welcome, {profile?.full_name?.split(" ")[0] || "student"}
        </h1>
        <Button asChild>
          <Link to="/submit">
            <Plus /> New request
          </Link>
        </Button>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-card p-5 shadow-soft">
            <c.icon className="h-5 w-5 text-accent" />
            <p className="mt-4 font-display text-3xl font-semibold">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-12 text-xl font-semibold">Recent requests</h2>
      <div className="mt-4">
        <RequestTable rows={reqs.slice(0, 5)} />
      </div>
    </div>
  );
}
