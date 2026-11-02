import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CalendarDays, FolderOpen, Wallet } from "lucide-react";
import { StatusBadge, PayBadge } from "@/components/StatusBadge";
import { fmtDate, money } from "@/lib/requests";
import type { RequestStatus, PaymentStatus } from "@/lib/status";

export type Row = {
  id: string;
  ref: string;
  title: string;
  status: RequestStatus;
  payment_status: PaymentStatus;
  deadline: string | null;
  price: number | null;
  currency: string;
  services: { name: string } | null;
  profiles?: { full_name: string } | null;
};

export function RequestTable({ rows, admin = false }: { rows: Row[]; admin?: boolean }) {
  if (!rows.length && admin)
    return (
      <div className="border-y border-[#e0e8e3] bg-white px-6 py-12 text-center">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-md bg-[#e5f1eb] text-[#155b4c]">
          <FolderOpen className="h-5 w-5" />
        </span>
        <p className="mt-3 font-semibold text-[#31574b]">No requests in this view</p>
        <p className="mt-1 text-sm text-[#718078]">
          New or matching student requests will appear here.
        </p>
      </div>
    );
  if (!rows.length)
    return (
      <div className="rounded-2xl border border-dashed bg-white px-6 py-14 text-center text-muted-foreground">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <FolderOpen className="h-5 w-5" />
        </span>
        <p className="mt-4 font-semibold text-foreground">No requests found</p>
        <p className="mt-1 text-sm">Requests matching this view will appear here.</p>
      </div>
    );
  if (admin)
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((row) => (
          <article
            key={row.id}
            className="min-w-0 rounded-lg border border-[#dfe8e3] bg-white p-4 transition-colors hover:border-[#bfd2c8]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[#718078]">
                  {row.ref} <span className="px-1">·</span>
                  {row.services?.name ?? "General service"}
                </p>
                <Link
                  to="/manage/$id"
                  params={{ id: row.id }}
                  className="mt-1 block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <h3 className="line-clamp-2 font-semibold leading-snug text-[#24473b] hover:text-[#17634f]">
                    {row.title}
                  </h3>
                </Link>
              </div>
              <Link
                to="/manage/$id"
                params={{ id: row.id }}
                aria-label={`Open ${row.title}`}
                className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-[#718078] transition-colors hover:bg-[#e5f1eb] hover:text-[#155b4c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status={row.status} />
              <PayBadge status={row.payment_status} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[#e8eeea] pt-3">
              <div className="min-w-0">
                <dt className="text-[11px] text-[#788780]">Student</dt>
                <dd className="mt-0.5 truncate text-sm font-medium text-[#334c42]">
                  {row.profiles?.full_name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#788780]">Deadline</dt>
                <dd className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium text-[#334c42]">
                  <CalendarDays className="h-3.5 w-3.5 text-[#718078]" />
                  {fmtDate(row.deadline)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-[#788780]">Quote</dt>
                <dd className="mt-0.5 text-sm font-semibold text-[#31574b]">
                  {money(row.price, row.currency)}
                </dd>
              </div>
              <div className="flex items-end justify-end">
                <Link
                  to="/manage/$id"
                  params={{ id: row.id }}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[#d4e1da] px-3 text-xs font-semibold text-[#31574b] transition-colors hover:bg-[#f2f7f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Open workspace <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </dl>
          </article>
        ))}
      </div>
    );
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-soft">
      <ul className="divide-y">
        {rows.map((r) => {
          const canPay =
            r.price != null &&
            r.payment_status !== "paid" &&
            (r.status === "awaiting_payment" ||
              r.status === "in_progress" ||
              r.status === "completed");
          return (
            <li key={r.id}>
              <div className="grid gap-2 px-5 py-4 transition-colors hover:bg-muted sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] sm:items-center sm:gap-6">
                <Link to="/request/$id" params={{ id: r.id }} className="min-w-0">
                  <p className="truncate font-semibold">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.ref} · {r.services?.name ?? "General"}
                  </p>
                </Link>
                <p className="text-xs text-muted-foreground">Due {fmtDate(r.deadline)}</p>
                <p className="text-sm font-medium">{money(r.price, r.currency)}</p>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={r.status} />
                  <PayBadge status={r.payment_status} />
                </div>
                {canPay && (
                  <Link
                    to="/request/$id"
                    params={{ id: r.id }}
                    aria-label={`${r.payment_status === "pending" ? "Check payment for" : "Pay for"} ${r.title}`}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Wallet className="h-4 w-4" />
                    {r.payment_status === "pending" ? "Check payment" : "Pay"}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
