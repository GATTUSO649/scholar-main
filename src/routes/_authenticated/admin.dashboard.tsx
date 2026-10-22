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
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminGate } from "@/components/AdminGate";
import { RequestTable } from "@/components/RequestTable";
import { getAdminRequestsFn, getAdminStudentCountFn } from "@/lib/backend";
import { money } from "@/lib/requests";
import { ACTIVE, STATUS_LABEL, STATUS_ORDER, type RequestStatus } from "@/lib/status";

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
  const today = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const newRequests = requests.filter((request) => request.status === "submitted");
  const activeRequests = requests.filter((request) => ACTIVE.includes(request.status));
  const awaitingPayment = requests.filter(
    (request) =>
      request.payment_status === "pending" ||
      (request.status === "awaiting_payment" && request.payment_status !== "paid"),
  );
  const overdueRequests = requests.filter(
    (request) =>
      request.deadline && new Date(request.deadline) < now && ACTIVE.includes(request.status),
  );
  const dueSoon = requests.filter((request) => {
    if (!request.deadline || !ACTIVE.includes(request.status)) return false;
    const deadline = new Date(request.deadline).getTime();
    return deadline >= now.getTime() && deadline <= now.getTime() + 7 * 24 * 60 * 60 * 1000;
  });
  const newToday = requests.filter(
    (request) => new Date(request.created_at).toDateString() === now.toDateString(),
  ).length;
  const paidRequests = requests.filter((request) => request.payment_status === "paid");
  const paidTotal = paidRequests.reduce((total, request) => total + Number(request.price ?? 0), 0);

  const kpis: {
    label: string;
    value: string | number;
    detail: string;
    icon: typeof FilePlus2;
    to: "/admin" | "/students";
    tint: string;
  }[] = [
    {
      label: "Total requests",
      value: requestsLoading || requestsError ? "—" : requests.length,
      detail: `${newToday} received today`,
      icon: FilePlus2,
      to: "/admin",
      tint: "bg-sky-50 text-sky-700",
    },
    {
      label: "Needs review",
      value: requestsLoading || requestsError ? "—" : newRequests.length,
      detail: "New submissions",
      icon: Clock3,
      to: "/admin",
      tint: "bg-amber-50 text-amber-700",
    },
    {
      label: "Active work",
      value: requestsLoading || requestsError ? "—" : activeRequests.length,
      detail: "Open requests in progress",
      icon: CheckCircle2,
      to: "/admin",
      tint: "bg-indigo-50 text-indigo-700",
    },
    {
      label: "Students",
      value: studentsLoading || studentsError ? "—" : (studentCount ?? 0),
      detail: "Registered accounts",
      icon: Users,
      to: "/students",
      tint: "bg-violet-50 text-violet-700",
    },
  ];

  const allStatuses: RequestStatus[] = [...STATUS_ORDER, "cancelled"];
  const statusCounts = allStatuses.map((status) => ({
    label: STATUS_LABEL[status],
    count: requests.filter((request) => request.status === status).length,
  }));
  const monthKeys = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return {
      key: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
      month: month.toLocaleDateString(undefined, { month: "short" }),
    };
  });
  const monthlyCounts = new Map(monthKeys.map(({ key }) => [key, 0]));
  requests.forEach((request) => {
    const created = new Date(request.created_at);
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyCounts.has(key)) {
      monthlyCounts.set(key, (monthlyCounts.get(key) ?? 0) + 1);
    }
  });
  const requestTrend = monthKeys.map(({ key, month }) => ({
    month,
    requests: monthlyCounts.get(key) ?? 0,
  }));

  return (
    <div className="space-y-7">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#718096]">
            Admin workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#17263c] sm:text-4xl">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Monitor operations, handle urgent work, and keep student requests moving.
          </p>
          <p className="mt-2 text-xs font-medium text-[#718096]">{today}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/students"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold text-[#263b58] shadow-sm transition-colors hover:bg-[#f8fafc]"
          >
            <Users className="h-4 w-4" /> Students
          </Link>
          <Link
            to="/admin"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#17263c] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#263b58]"
          >
            View request queue <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {requestsError && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">Request data could not be loaded</p>
          <p className="mt-1 text-muted-foreground">
            {requestError instanceof Error
              ? requestError.message
              : "Refresh the page to try again."}
          </p>
        </div>
      )}

      <section aria-label="Key statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((metric) => (
          <Link
            key={metric.label}
            to={metric.to}
            className="group rounded-2xl border bg-white p-5 shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)] transition-all hover:-translate-y-0.5 hover:border-[#bdc9d8] hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-[#17263c]">
                  {metric.value}
                </p>
              </div>
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${metric.tint}`}>
                <metric.icon className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <span className="text-xs text-muted-foreground">{metric.detail}</span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(310px,0.85fr)]">
        <article className="rounded-2xl border bg-white p-5 shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Requests
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[#17263c]">Submission activity</h2>
              <p className="mt-1 text-xs text-muted-foreground">New requests received each month</p>
            </div>
            <span className="rounded-lg bg-[#f3f6fa] px-3 py-1.5 text-xs font-semibold text-[#536982]">
              Last 6 months
            </span>
          </div>
          {requestsLoading ? (
            <div className="mt-5 h-[260px] animate-pulse rounded-xl bg-muted" />
          ) : (
            <div className="mt-5 h-[260px] w-full" role="img" aria-label="Monthly request volume">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={requestTrend}
                  margin={{ top: 10, right: 12, bottom: 0, left: -18 }}
                >
                  <defs>
                    <linearGradient id="requestVolumeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#496b91" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#496b91" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e9edf2" vertical={false} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="requests"
                    name="Requests"
                    stroke="#385575"
                    strokeWidth={2.5}
                    fill="url(#requestVolumeFill)"
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="rounded-2xl border bg-white p-5 shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)] sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Action center
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#17263c]">Needs your attention</h2>
            <p className="mt-1 text-xs text-muted-foreground">Priorities for the admin team</p>
          </div>
          <div className="mt-4 divide-y">
            <AttentionLink
              label="New requests to review"
              detail="Open and assess submissions"
              count={requestsLoading || requestsError ? "—" : newRequests.length}
              icon={FilePlus2}
              tone="text-sky-700 bg-sky-50"
            />
            <AttentionLink
              label="Past deadline"
              detail="Active requests need follow-up"
              count={requestsLoading || requestsError ? "—" : overdueRequests.length}
              icon={CalendarClock}
              tone="text-rose-700 bg-rose-50"
            />
            <AttentionLink
              label="Due in 7 days"
              detail="Plan the upcoming workload"
              count={requestsLoading || requestsError ? "—" : dueSoon.length}
              icon={Clock3}
              tone="text-amber-700 bg-amber-50"
            />
            <AttentionLink
              label="Awaiting payment"
              detail="Requests with payment pending"
              count={requestsLoading || requestsError ? "—" : awaitingPayment.length}
              icon={Banknote}
              tone="text-emerald-700 bg-emerald-50"
            />
          </div>
          <Link
            to="/admin"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#314d70] hover:underline"
          >
            Open request queue <ArrowRight className="h-4 w-4" />
          </Link>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <article className="rounded-2xl border bg-white p-5 shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Workload
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[#17263c]">Requests by status</h2>
            </div>
            <span className="rounded-lg bg-[#f3f6fa] px-2.5 py-1.5 text-xs font-semibold text-[#536982]">
              {requestsLoading || requestsError ? "—" : requests.length} total
            </span>
          </div>
          {requestsLoading ? (
            <div className="mt-5 h-[245px] animate-pulse rounded-xl bg-muted" />
          ) : (
            <div className="mt-5 h-[245px] w-full" role="img" aria-label="Requests by status">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={statusCounts}
                  layout="vertical"
                  margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
                >
                  <CartesianGrid stroke="#e9edf2" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={112}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip cursor={{ fill: "#f3f6fa" }} />
                  <Bar dataKey="count" name="Requests" fill="#385575" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="rounded-2xl border bg-white p-5 shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Finance
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[#17263c]">Paid totals</h2>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Banknote className="h-5 w-5" />
            </span>
          </div>
          {requestsLoading ? (
            <div className="mt-5 h-24 animate-pulse rounded-xl bg-muted" />
          ) : paidRequests.length ? (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-[#f7f9fc] px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">KES</span>
                <span className="text-lg font-bold text-[#17263c]">{money(paidTotal, "KES")}</span>
              </div>
            </div>
          ) : (
            <p className="mt-5 rounded-xl bg-[#f7f9fc] p-4 text-sm text-muted-foreground">
              No payments have been recorded yet.
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Paid totals are displayed as KES; saved amounts are not converted.
          </p>
          <Link
            to="/admin"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#314d70] hover:underline"
          >
            Review payments <ArrowUpRight className="h-4 w-4" />
          </Link>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-5 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Work queue
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#17263c]">Latest requests</h2>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#314d70] hover:underline"
          >
            View all requests <ArrowRight className="h-4 w-4" />
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
          <RequestTable rows={requests.slice(0, 5)} admin />
        )}
      </section>
    </div>
  );
}

function AttentionLink({
  label,
  detail,
  count,
  icon: Icon,
  tone,
}: {
  label: string;
  detail: string;
  count: string | number;
  icon: typeof FilePlus2;
  tone: string;
}) {
  return (
    <Link
      to="/admin"
      className="group flex items-center gap-3 py-3 transition-colors first:pt-2 last:pb-2"
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[#263b58]">{label}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <span className="text-lg font-bold tabular-nums text-[#17263c]">{count}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
