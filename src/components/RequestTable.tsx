import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CalendarDays, FolderOpen } from "lucide-react";
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
      <div className="overflow-hidden border-y border-[#e0e8e3] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-210 text-left text-sm">
            <thead className="border-b border-[#e4ebe6] bg-[#f7f9f7] text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">
              <tr>
                <th className="px-5 py-4">Request</th>
                <th className="px-4 py-4">Student</th>
                <th className="px-4 py-4">Deadline</th>
                <th className="px-4 py-4">Quote</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Payment</th>
                <th className="px-4 py-4">
                  <span className="sr-only">Open request</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8eeea]">
              {rows.map((row) => (
                <tr key={row.id} className="group transition-colors hover:bg-[#f7faf7]">
                  <td className="px-5 py-4">
                    <Link
                      to="/manage/$id"
                      params={{ id: row.id }}
                      className="block max-w-75 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="block truncate font-semibold text-[#24473b] group-hover:text-[#17634f]">
                        {row.title}
                      </span>
                      <span className="mt-1 block truncate text-xs text-[#77847e]">
                        {row.ref} <span className="px-1">·</span>{" "}
                        {row.services?.name ?? "General service"}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <span className="block max-w-40 truncate font-medium text-[#52645c]">
                      {row.profiles?.full_name ?? "—"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-xs text-[#718078]">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {fmtDate(row.deadline)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 font-semibold text-[#31574b]">
                    {money(row.price, row.currency)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <PayBadge status={row.payment_status} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      to="/manage/$id"
                      params={{ id: row.id }}
                      aria-label={`Manage ${row.title}`}
                      className="inline-grid h-8 w-8 place-items-center rounded-md text-[#718078] transition-colors hover:bg-[#e5f1eb] hover:text-[#155b4c]"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-soft">
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              to="/request/$id"
              params={{ id: r.id }}
              className="grid gap-2 px-5 py-4 transition-colors hover:bg-muted sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-6"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  {r.ref} · {r.services?.name ?? "General"}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Due {fmtDate(r.deadline)}</p>
              <p className="text-sm font-medium">{money(r.price, r.currency)}</p>
              <div className="flex gap-2">
                <StatusBadge status={r.status} />
                <PayBadge status={r.payment_status} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
