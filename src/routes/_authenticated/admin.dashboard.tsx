import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Shield,
  Users,
  FilePlus2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  ArrowRight,
  FolderOpen,
} from "lucide-react";
import { getAdminRequestsFn, getAdminStudentCountFn } from "@/lib/backend";
import { AdminGate } from "@/components/AdminGate";
import { RequestTable, type Row } from "@/components/RequestTable";
import { ACTIVE } from "@/lib/status";
import { money } from "@/lib/requests";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — ScholarDesk" },
      { name: "description", content: "Overview of requests, students and revenue." },
    ],
  }),
  component: AdminDashboardRoute,
});

function AdminDashboardRoute() {
  const { user } = Route.useRouteContext();
  return (
    <AdminGate userId={user.id}>
      <AdminDashboard />
    </AdminGate>
  );
}

function AdminDashboard() {
  const { data: reqs = [] } = useQuery({
    queryKey: ["admin-requests"],
    queryFn: () => getAdminRequestsFn(),
  });
  const { data: studentCount = 0 } = useQuery({
    queryKey: ["admin-student-count"],
    queryFn: () => getAdminStudentCountFn(),
  });

  const now = new Date();
  const newToday = reqs.filter(
    (r) => new Date(r.created_at).toDateString() === now.toDateString(),
  ).length;
  const awaitingPayment = reqs.filter(
    (r) =>
      r.status === "awaiting_payment" ||
      (r.payment_status === "pending" && ACTIVE.includes(r.status)),
  ).length;
  const overdue = reqs.filter(
    (r) => r.deadline && new Date(r.deadline) < now && ACTIVE.includes(r.status),
  ).length;
  const revenue = reqs
    .filter((r) => r.payment_status === "paid")
    .reduce((s, r) => s + Number(r.price ?? 0), 0);
  const recent = reqs.slice(0, 5);

  const cards = [
    {
      label: "New requests",
      value: reqs.filter((r) => r.status === "submitted").length,
      icon: FilePlus2,
      hint: `${newToday} today`,
    },
    {
      label: "Active",
      value: reqs.filter((r) => ACTIVE.includes(r.status)).length,
      icon: Clock,
      hint: "in the pipeline",
    },
    { label: "Awaiting payment", value: awaitingPayment, icon: Banknote, hint: "quotes sent" },
    { label: "Overdue", value: overdue, icon: AlertTriangle, hint: "past deadline" },
    {
      label: "Completed",
      value: reqs.filter((r) => r.status === "completed").length,
      icon: CheckCircle2,
      hint: "all time",
    },
    { label: "Students", value: studentCount, icon: Users, hint: "registered" },
  ];

  const links = [
    {
      to: "/admin",
      icon: Shield,
      title: "All requests",
      desc: "Search, filter, quote and grade every request.",
    },
    {
      to: "/students",
      icon: Users,
      title: "Students",
      desc: "See registered students and their details.",
    },
  ] as const;

  return (
    <div>
      <h1 className="text-3xl font-semibold">Admin dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Everything happening on ScholarDesk at a glance.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-card p-5 shadow-soft">
            <c.icon className="h-4 w-4 text-muted-foreground" />
            <p className="mt-2 font-display text-2xl font-semibold">{c.value}</p>
            <p className="text-xs text-muted-foreground">
              {c.label} · {c.hint}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border bg-card p-5 shadow-soft">
        <p className="text-xs text-muted-foreground">Paid revenue</p>
        <p className="mt-1 font-display text-3xl font-semibold">{money(revenue)}</p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="group flex items-start gap-4 rounded-2xl border bg-card p-5 shadow-soft transition-colors hover:bg-muted"
          >
            <l.icon className="mt-0.5 h-5 w-5 text-accent-foreground" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{l.title}</p>
              <p className="text-sm text-muted-foreground">{l.desc}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FolderOpen className="h-4 w-4" /> Latest requests
          </h2>
          <Link to="/admin" className="text-sm text-accent-foreground hover:underline">
            View all
          </Link>
        </div>
        <RequestTable rows={recent as Row[]} admin />
      </div>
    </div>
  );
}
