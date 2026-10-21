import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FilePlus2,
  Users,
} from "lucide-react";
import { getAdminRequestsFn, getAdminStudentCountFn } from "@/lib/backend";
import { AdminGate } from "@/components/AdminGate";
import { RequestTable } from "@/components/RequestTable";
import { ACTIVE, STATUS_LABEL, STATUS_ORDER } from "@/lib/status";
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
  const {
    data: reqs,
    isLoading: requestsLoading,
    isError: requestsError,
    error: requestError,
  } = useQuery({
    queryKey: ["admin-requests"],
    queryFn: () => getAdminRequestsFn(),
  });
  const {
    data: studentCount,
    isLoading: studentsLoading,
    isError: studentsError,
  } = useQuery({
    queryKey: ["admin-student-count"],
    queryFn: () => getAdminStudentCountFn(),
  });
  const requests = reqs ?? [];
  const now = new Date();
  const newToday = requests.filter(
    (request) => new Date(request.created_at).toDateString() === now.toDateString(),
  ).length;
  const awaitingPayment = requests.filter(
    (request) =>
      request.status === "awaiting_payment" ||
      (request.payment_status === "pending" && ACTIVE.includes(request.status)),
  ).length;
  const overdue = requests.filter(
    (request) =>
      request.deadline && new Date(request.deadline) < now && ACTIVE.includes(request.status),
  ).length;
  const revenue = requests
    .filter((request) => request.payment_status === "paid")
    .reduce((sum, request) => sum + Number(request.price ?? 0), 0);
  const recent = requests.slice(0, 6);
  const metrics = [
    {
      label: "New requests",
      value: requests.filter((request) => request.status === "submitted").length,
      footnote: `${newToday} received today`,
      icon: FilePlus2,
      color: "text-sky-700 bg-sky-50",
    },
    {
      label: "Active work",
      value: requests.filter((request) => ACTIVE.includes(request.status)).length,
      footnote: "Moving through the queue",
      icon: Clock3,
      color: "text-indigo-700 bg-indigo-50",
    },
    {
      label: "Awaiting payment",
      value: awaitingPayment,
      footnote: "Quote sent to student",
      icon: Banknote,
      color: "text-amber-700 bg-amber-50",
    },
    {
      label: "Overdue",
      value: overdue,
      footnote: "Active past deadline",
      icon: CalendarClock,
      color: "text-rose-700 bg-rose-50",
    },
  ];
  const statusCounts = STATUS_ORDER.map((status) => ({
    status,
    count: requests.filter((request) => request.status === status).length,
  }));
  const maxStatusCount = Math.max(1, ...statusCounts.map((item) => item.count));

  return (
    <div className="space-y-7">
      <header className="relative overflow-hidden rounded-[26px] bg-[#17263c] px-6 py-7 text-white shadow-[0_18px_40px_-28px_rgba(23,38,60,0.8)] sm:px-9 sm:py-9">
        <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border-[34px] border-white/[0.04]" />
        <div className="pointer-events-none absolute right-36 top-20 h-40 w-40 rounded-full bg-[#d5ac57]/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Operations overview
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[40px]">
              Good {now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/60">
              Here’s the latest across requests, payments, and student activity.
            </p>
          </div>
          <Link
            to="/admin"
            className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground transition-transform hover:-translate-y-0.5 md:self-auto"
          >
            Open request queue <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="relative mt-8 flex flex-wrap gap-x-7 gap-y-3 border-t border-white/10 pt-5 text-xs text-white/55">
          <span>{requestsLoading ? "…" : requests.length} total requests</span>
          <span>{studentsLoading ? "…" : (studentCount ?? 0)} students</span>
          <span>
            {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </span>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-2xl border bg-white p-5 shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)]"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">{metric.label}</p>
              <span className={`grid h-9 w-9 place-items-center rounded-xl ${metric.color}`}>
                <metric.icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight">
              {requestsLoading ? "—" : metric.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{metric.footnote}</p>
          </article>
        ))}
      </section>

      {requestsError && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">Could not load request analytics</p>
          <p className="mt-1 text-muted-foreground">
            {requestError instanceof Error ? requestError.message : "Refresh to try again."}
          </p>
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.5fr]">
        <article className="rounded-2xl border bg-white p-5 shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)] sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Financial snapshot</p>
              <h2 className="mt-2 text-lg font-semibold">Paid revenue</h2>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Banknote className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-7 text-3xl font-bold tracking-tight">
            {requestsLoading ? "—" : money(revenue)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Sum of requests marked as paid</p>
          <div className="mt-6 border-t pt-4">
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#314d70] hover:underline"
            >
              Review payments <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </article>

        <article className="rounded-2xl border bg-white p-5 shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Workload</p>
              <h2 className="mt-2 text-lg font-semibold">Request pipeline</h2>
            </div>
            <span className="rounded-lg bg-[#f3f6fa] px-2.5 py-1.5 text-xs font-semibold text-[#536982]">
              {requestsLoading ? "…" : requests.length} total
            </span>
          </div>
          {requestsLoading ? (
            <div className="mt-6 space-y-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="h-7 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {statusCounts.map(({ status, count }) => (
                <div key={status} className="grid grid-cols-[112px_1fr_32px] items-center gap-3">
                  <span className="truncate text-xs font-medium text-muted-foreground">
                    {STATUS_LABEL[status]}
                  </span>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-[#f0f2f6]"
                    role="progressbar"
                    aria-label={`${STATUS_LABEL[status]} requests`}
                    aria-valuenow={count}
                    aria-valuemax={maxStatusCount}
                  >
                    <div
                      className="h-full rounded-full bg-[#385575] transition-[width]"
                      style={{ width: `${(count / maxStatusCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-right text-xs font-bold">{count}</span>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)]">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-5 sm:px-6">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Latest activity</p>
            <h2 className="mt-1 text-lg font-semibold">Recent requests</h2>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#314d70] hover:underline"
          >
            View queue <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {requestsLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-[68px] animate-pulse rounded-xl bg-[#f3f5f8]" />
            ))}
          </div>
        ) : requestsError ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Recent requests are unavailable.
          </p>
        ) : (
          <RequestTable rows={recent} admin />
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/students"
          className="group flex items-center gap-4 rounded-2xl border bg-white p-5 transition-colors hover:border-[#9aa9bd] hover:bg-[#fbfcfe]"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-700">
            <Users className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Student directory</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {studentsError
                ? "Student count unavailable"
                : `${studentsLoading ? "…" : (studentCount ?? 0)} registered students`}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>
        <Link
          to="/admin"
          className="group flex items-center gap-4 rounded-2xl border bg-white p-5 transition-colors hover:border-[#9aa9bd] hover:bg-[#fbfcfe]"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Keep work moving</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Review, quote, and update request progress
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>
      </section>
    </div>
  );
}
