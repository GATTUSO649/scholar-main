import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FilePlus2,
  Users,
} from "lucide-react";
import { AdminGate } from "@/components/AdminGate";
import { RequestTable } from "@/components/RequestTable";
import { Button } from "@/components/ui/button";
import { getAdminRequestsFn, getAdminStudentCountFn } from "@/lib/backend";
import { fmtDate, money } from "@/lib/requests";
import { ACTIVE, STATUS_LABEL } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Operations overview — ScholarDesk" },
      { name: "description", content: "Prioritize service requests and support students." },
    ],
  }),
  component: AdminDashboardRoute,
});

function AdminDashboardRoute() {
  const { isAdmin } = Route.useRouteContext();
  return (
    <AdminGate isAdmin={isAdmin}>
      <AdminOperations />
    </AdminGate>
  );
}

function AdminOperations() {
  const {
    data: requests = [],
    isLoading: requestsLoading,
    isError: requestsError,
    error: requestError,
    refetch: refetchRequests,
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

  const now = Date.now();
  const newRequests = requests.filter((request) => request.status === "submitted");
  const activeRequests = requests.filter((request) => ACTIVE.includes(request.status));
  const paymentFollowUp = requests.filter(
    (request) =>
      request.payment_status === "pending" ||
      (request.status === "awaiting_payment" && request.payment_status !== "paid"),
  );
  const isOverdue = (request: (typeof requests)[number]) =>
    !!request.deadline &&
    new Date(request.deadline).getTime() < now &&
    ACTIVE.includes(request.status);
  const isDueSoon = (request: (typeof requests)[number]) => {
    if (!request.deadline || !ACTIVE.includes(request.status)) return false;
    const deadline = new Date(request.deadline).getTime();
    return deadline >= now && deadline <= now + 7 * 24 * 60 * 60 * 1000;
  };
  const overdueRequests = requests.filter(isOverdue);
  const dueSoonRequests = requests.filter(isDueSoon);
  const priorityRequests = [...requests]
    .filter((request) => isOverdue(request) || isDueSoon(request))
    .sort((left, right) => {
      const leftDeadline = left.deadline ? new Date(left.deadline).getTime() : Infinity;
      const rightDeadline = right.deadline ? new Date(right.deadline).getTime() : Infinity;
      return leftDeadline - rightDeadline;
    })
    .slice(0, 6);
  const paidTotals = requests.reduce<Record<string, number>>((totals, request) => {
    if (request.payment_status === "paid") {
      totals[request.currency] = (totals[request.currency] ?? 0) + Number(request.price ?? 0);
    }
    return totals;
  }, {});
  const paidByCurrency = Object.entries(paidTotals).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const todayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 border-b border-[#dfe8e3] pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b8177]">
            Student service desk <span className="px-1 text-[#bd8a48]">/</span> {todayLabel}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#173c33] sm:text-4xl">
            Operations overview
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#677872]">
            Start with urgent work, follow up on payment, and keep every student request moving.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/students"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d4e1da] bg-white px-3.5 text-sm font-semibold text-[#31574b] transition-colors hover:bg-[#f2f7f3]"
          >
            <Users className="h-4 w-4" /> Students
          </Link>
          <Link
            to="/admin"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#185c4b] px-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#124b3d]"
          >
            <FilePlus2 className="h-4 w-4" /> Open request queue
          </Link>
        </div>
      </header>

      {requestsError && (
        <section
          className="flex flex-col justify-between gap-3 rounded-lg border border-[#ecc9c0] bg-[#fff7f4] px-4 py-3 sm:flex-row sm:items-center"
          role="alert"
        >
          <div>
            <p className="text-sm font-semibold text-[#9a4536]">Request data is unavailable</p>
            <p className="mt-0.5 text-sm text-[#775c56]">
              {requestError instanceof Error
                ? requestError.message
                : "Retry to reconnect to the queue."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetchRequests()}>
            Retry
          </Button>
        </section>
      )}

      <section aria-label="Service workload" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <WorkloadMetric
          label="New submissions"
          value={requestsLoading || requestsError ? "—" : newRequests.length}
          note="Awaiting first review"
          icon={FilePlus2}
          tone="amber"
        />
        <WorkloadMetric
          label="Active requests"
          value={requestsLoading || requestsError ? "—" : activeRequests.length}
          note="Currently in service"
          icon={CheckCircle2}
          tone="green"
        />
        <WorkloadMetric
          label="Deadline attention"
          value={requestsLoading || requestsError ? "—" : overdueRequests.length}
          note={`${dueSoonRequests.length} due within 7 days`}
          icon={CalendarClock}
          tone={overdueRequests.length ? "rose" : "green"}
        />
        <WorkloadMetric
          label="Students supported"
          value={studentsLoading || studentsError ? "—" : (studentCount ?? 0)}
          note="Registered student accounts"
          icon={Users}
          tone="forest"
        />
      </section>

      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(290px,0.75fr)]">
        <div className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#71827b]">
                Priority list
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[#173c33]">Deadlines to manage</h2>
            </div>
            <span className="text-xs text-[#71827b]">Overdue and due this week</span>
          </div>
          {requestsLoading ? (
            <div className="space-y-2" aria-label="Loading priorities" aria-busy="true">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-lg bg-white" />
              ))}
            </div>
          ) : priorityRequests.length ? (
            <ul className="divide-y divide-[#e6ede8] border-y border-[#e0e8e3] bg-white">
              {priorityRequests.map((request) => {
                const overdue = isOverdue(request);
                return (
                  <li key={request.id}>
                    <Link
                      to="/manage/$id"
                      params={{ id: request.id }}
                      className="group grid gap-3 px-4 py-3.5 transition-colors hover:bg-[#f7faf7] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[#223d34] group-hover:text-[#17634f]">
                          {request.title}
                        </span>
                        <span className="mt-1 block truncate text-xs text-[#75827d]">
                          {request.ref} <span className="px-1">·</span>
                          {request.profiles?.full_name ?? "Student"}
                        </span>
                      </span>
                      <span
                        className={`inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${
                          overdue ? "bg-[#fff0ec] text-[#a34737]" : "bg-[#fff7e9] text-[#946226]"
                        }`}
                      >
                        {overdue ? (
                          <Clock3 className="h-3 w-3" />
                        ) : (
                          <CalendarClock className="h-3 w-3" />
                        )}
                        {overdue
                          ? `Overdue · ${fmtDate(request.deadline)}`
                          : `Due ${fmtDate(request.deadline)}`}
                      </span>
                      <ArrowUpRight className="hidden h-4 w-4 text-[#788780] group-hover:text-[#17634f] sm:block" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : requestsError ? (
            <p className="border-y border-[#e0e8e3] bg-white px-4 py-8 text-sm text-[#71827b]">
              Priority items will appear when request data is available.
            </p>
          ) : (
            <div className="border-y border-[#e0e8e3] bg-white px-4 py-8">
              <p className="text-sm font-semibold text-[#31574b]">No deadline follow-ups</p>
              <p className="mt-1 text-sm text-[#71827b]">
                All active requests are on track for now.
              </p>
            </div>
          )}
          <Link
            to="/admin"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1b634f] hover:underline"
          >
            View the full queue <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <aside className="border-y border-[#e0e8e3] bg-white">
          <div className="border-b border-[#e6ede8] px-4 py-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#71827b]">
              Follow-up desk
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#173c33]">Needs action</h2>
          </div>
          <FollowUpLink
            to="/admin"
            icon={FilePlus2}
            label="Review new requests"
            count={requestsLoading || requestsError ? "—" : newRequests.length}
            tone="amber"
          />
          <FollowUpLink
            to="/admin"
            icon={Banknote}
            label="Payment follow-up"
            count={requestsLoading || requestsError ? "—" : paymentFollowUp.length}
            tone="blue"
          />
          <FollowUpLink
            to="/students"
            icon={Users}
            label="Student directory"
            count={studentsLoading || studentsError ? "—" : (studentCount ?? 0)}
            tone="green"
          />
          <FollowUpLink
            to="/admin/resources"
            icon={BookOpen}
            label="Public library"
            count="Manage"
            tone="forest"
          />
          <div className="border-t border-[#e6ede8] px-4 py-3">
            <p className="text-[11px] leading-relaxed text-[#788780]">
              Student submissions, updates, and delivery files are managed from their request
              workspace.
            </p>
          </div>
        </aside>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#71827b]">
              Latest activity
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#173c33]">Recent student requests</h2>
          </div>
          <Link to="/admin" className="text-sm font-semibold text-[#1b634f] hover:underline">
            Open service queue
          </Link>
        </div>
        {requestsLoading ? (
          <div className="h-48 animate-pulse rounded-lg bg-white" />
        ) : requestsError ? (
          <p className="border-y border-[#e0e8e3] bg-white px-4 py-8 text-center text-sm text-[#71827b]">
            Recent requests could not be loaded. Retry the request queue to reconnect.
          </p>
        ) : (
          <RequestTable rows={requests.slice(0, 8)} admin />
        )}
      </section>

      {paidByCurrency.length > 0 && (
        <section className="flex flex-col gap-4 border-t border-[#dfe8e3] pt-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#71827b]">
              Recorded payments
            </p>
            <h2 className="mt-1 text-sm font-semibold text-[#173c33]">Paid totals by currency</h2>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {paidByCurrency.map(([currency, amount]) => (
              <div key={currency} className="flex items-center gap-2">
                <span className="text-xs font-medium text-[#71827b]">{currency}</span>
                <span className="text-sm font-semibold text-[#244a3d]">
                  {money(amount, currency)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function WorkloadMetric({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: typeof FilePlus2;
  tone: "amber" | "green" | "rose" | "forest";
}) {
  const tones = {
    amber: "text-[#98652b] bg-[#fff5e7]",
    green: "text-[#347554] bg-[#e9f4ec]",
    rose: "text-[#a34737] bg-[#fff0ec]",
    forest: "text-[#226657] bg-[#e6f2ed]",
  };
  return (
    <div className="flex items-start justify-between gap-4 border-y border-[#e0e8e3] bg-white px-4 py-4">
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#71827b]">{label}</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-[#173c33]">{value}</p>
        <p className="mt-1 truncate text-[11px] text-[#7d8984]">{note}</p>
      </div>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
    </div>
  );
}

function FollowUpLink({
  to,
  icon: Icon,
  label,
  count,
  tone,
}: {
  to: "/admin" | "/students" | "/admin/resources";
  icon: typeof FilePlus2;
  label: string;
  count: string | number;
  tone: "amber" | "blue" | "green" | "forest";
}) {
  const tones = {
    amber: "bg-[#fff5e7] text-[#98652b]",
    blue: "bg-[#eaf1f8] text-[#476b86]",
    green: "bg-[#e9f4ec] text-[#347554]",
    forest: "bg-[#e6f2ed] text-[#226657]",
  };
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 border-b border-[#edf1ee] px-4 py-3 transition-colors last:border-b-0 hover:bg-[#f7faf7]"
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#38564a]">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-[#183c34]">{count}</span>
      <ArrowRight className="h-4 w-4 text-[#829087] transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
