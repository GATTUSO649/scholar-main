import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminMpesaPurchasesFn } from "@/lib/backend";
import { money } from "@/lib/requests";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({ meta: [{ title: "M-PESA transactions — ScholarDesk" }] }),
  component: AdminPaymentsPage,
});

const PAGE_SIZE = 50;
const statusLabels = {
  all: "All transactions",
  pending: "Pending",
  paid: "Successful",
  failed: "Failed",
  cancelled: "Cancelled",
} as const;

function formatDate(value: Date | string | null) {
  return value ? new Date(value).toLocaleString() : "Not confirmed";
}

function AdminPaymentsPage() {
  const [queryInput, setQueryInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<keyof typeof statusLabels>("all");
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-mpesa-payments", search, status, offset],
    queryFn: () => getAdminMpesaPurchasesFn({ data: { search, status, offset } }),
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function applySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(queryInput.trim());
    setOffset(0);
  }

  function changeStatus(value: keyof typeof statusLabels) {
    setStatus(value);
    setOffset(0);
  }

  return (
    <div className="space-y-7">
      <header className="border-b border-[#dfe8e3] pb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b8177]">
          Student service desk <span className="px-1 text-[#bd8a48]">/</span> Finance
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173c33]">M-PESA transactions</h1>
        <p className="mt-2 text-sm text-[#677872]">
          Library purchases reconciled against Safaricom STK Query results.
        </p>
      </header>

      {isError ? (
        <section
          className="flex flex-col justify-between gap-3 border border-[#ecc9c0] bg-[#fff7f4] px-4 py-3 sm:flex-row sm:items-center"
          role="alert"
        >
          <p className="text-sm text-[#9a4536]">Transaction data is unavailable.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="border-y border-[#dfe8e3] bg-white px-4 py-3">
          <p className="text-xs font-medium text-[#718078]">Matching transactions</p>
          <p className="mt-1 text-2xl font-semibold text-[#173c33]">{isLoading ? "—" : total}</p>
        </div>
        <div className="border-y border-[#dfe8e3] bg-white px-4 py-3">
          <p className="text-xs font-medium text-[#718078]">Confirmed M-PESA revenue</p>
          <p className="mt-1 text-2xl font-semibold text-[#173c33]">
            {isLoading ? "—" : money(data?.verifiedRevenue ?? 0, "KES")}
          </p>
        </div>
      </section>

      <section>
        <div className="flex flex-col justify-between gap-3 border-b border-[#dfe8e3] pb-4 lg:flex-row lg:items-end">
          <div>
            <h2 className="text-lg font-semibold text-[#173c33]">Payment ledger</h2>
            <p className="mt-1 text-sm text-[#718078]">
              Search receipt, customer phone, or order reference.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <form onSubmit={applySearch} className="flex gap-2">
              <div className="relative min-w-0 flex-1 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#788780]" />
                <Input
                  type="search"
                  aria-label="Search receipt, phone, or order reference"
                  placeholder="Receipt, phone, order reference"
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  className="h-10 border-[#d7e2dc] bg-white pl-9"
                />
              </div>
              <Button type="submit" variant="outline" className="border-[#d4e1da]">
                Search
              </Button>
            </form>
            <select
              aria-label="Filter transactions by status"
              value={status}
              onChange={(event) => changeStatus(event.target.value as keyof typeof statusLabels)}
              className="h-10 rounded-md border border-[#d7e2dc] bg-white px-3 text-sm text-[#31574b]"
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <p
            className="border-b border-[#e0e8e3] bg-white px-4 py-8 text-sm text-[#718078]"
            aria-live="polite"
          >
            Loading transactions…
          </p>
        ) : items.length ? (
          <div className="mt-4 overflow-x-auto border-y border-[#e0e8e3] bg-white">
            <table className="w-full min-w-245 text-left text-sm">
              <thead className="bg-[#f5f8f5] text-xs font-semibold text-[#61746a]">
                <tr>
                  <th className="px-4 py-3">Order reference</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Library item</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">M-PESA receipt</th>
                  <th className="px-4 py-3">Transaction time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8eee9]">
                {items.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3">
                      <span className="block font-semibold text-[#24473b]">
                        {payment.accountReference ?? payment.id}
                      </span>
                      <span className="mt-1 block max-w-48 truncate text-xs text-[#788780]">
                        {payment.checkoutRequestId ?? "STK request not assigned"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-[#31574b]">
                        {payment.studentName ?? "Student"}
                      </span>
                      <span className="mt-1 block text-xs text-[#788780]">
                        {payment.phoneNumber}
                      </span>
                    </td>
                    <td className="max-w-56 truncate px-4 py-3 text-[#31574b]">
                      {payment.resourceTitle}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#24473b]">
                      {money(Number(payment.amount), payment.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${
                          payment.status === "paid"
                            ? "bg-[#e6f4eb] text-[#236044]"
                            : payment.status === "pending"
                              ? "bg-[#fff4df] text-[#855a1d]"
                              : "bg-[#fff0ec] text-[#a34737]"
                        }`}
                      >
                        {payment.status === "paid" ? "Successful" : statusLabels[payment.status]}
                      </span>
                      {payment.failureReason ? (
                        <span className="mt-1 block max-w-40 truncate text-xs text-[#8b554a]">
                          {payment.failureReason}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#31574b]">
                      {payment.receiptNumber ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#61746a]">
                      {formatDate(
                        payment.transactionTimestamp ?? payment.paidAt ?? payment.createdAt,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="border-y border-[#e0e8e3] bg-white px-4 py-8 text-sm text-[#718078]">
            No transactions match this search.
          </p>
        )}

        <footer className="flex items-center justify-between gap-3 pt-3 text-sm text-[#718078]">
          <span>
            {total
              ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}`
              : "0 transactions"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous transaction page"
              disabled={offset === 0 || isLoading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-16 text-center text-xs">
              Page {page} of {pages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next transaction page"
              disabled={offset + PAGE_SIZE >= total || isLoading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}
