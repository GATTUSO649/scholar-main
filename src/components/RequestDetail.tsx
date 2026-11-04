import { useQuery } from "@tanstack/react-query";
import { Check, FileText, Download } from "lucide-react";
import { getRequestBundleFn } from "@/lib/backend";
import { StatusBadge, PayBadge } from "@/components/StatusBadge";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/status";
import { fmtDate, money, openFile } from "@/lib/requests";
import { cn } from "@/lib/utils";

export function useRequest(id: string) {
  return useQuery({
    queryKey: ["request", id],
    queryFn: () => getRequestBundleFn({ data: { id } }),
  });
}

export type RequestBundle = NonNullable<ReturnType<typeof useRequest>["data"]>;

export function RequestSummary({
  data,
  compact = false,
}: {
  data: RequestBundle;
  compact?: boolean;
}) {
  const r = data.req!;
  const idx = STATUS_ORDER.indexOf(r.status);
  return (
    <div className="space-y-6">
      {!compact && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="wrap-break-word text-sm text-muted-foreground">
              {r.ref} · {r.services?.name}
            </p>
            <h1 className="mt-1 wrap-break-word text-3xl font-semibold">{r.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={r.status} />
            <PayBadge status={r.payment_status} />
          </div>
        </div>
      )}

      {r.status !== "cancelled" && r.status !== "declined" && (
        <ol className="grid grid-cols-3 gap-2 rounded-2xl border bg-white p-4 shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)] sm:grid-cols-6">
          {STATUS_ORDER.map((s, i) => (
            <li key={s} className="flex flex-col items-center gap-2 text-center">
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full text-xs font-bold",
                  i <= idx ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {i < idx ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={cn("text-[11px]", i <= idx ? "font-semibold" : "text-muted-foreground")}
              >
                {STATUS_LABEL[s]}
              </span>
            </li>
          ))}
        </ol>
      )}
      {(r.status === "cancelled" || r.status === "declined") && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm">
          <p className="font-semibold">{STATUS_LABEL[r.status]}</p>
          <p className="mt-1 text-muted-foreground">
            {r.status === "declined"
              ? "The team has declined this request. Check the latest update or contact support if you need clarification."
              : "This request has been cancelled. Check the latest update for details."}
          </p>
        </div>
      )}

      <div className="grid min-w-0 gap-4 rounded-2xl border bg-white p-5 text-sm shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)] sm:grid-cols-3">
        {[
          ["Course / unit", r.course_unit],
          ["Lecturer", r.lecturer],
          ["Level", r.academic_level],
          ["Questions", r.num_questions],
          ["Pages", r.num_pages],
          ["Price", money(r.price, r.currency)],
          ["Deadline", fmtDate(r.deadline)],
          ["Preferred date", fmtDate(r.preferred_date)],
          ["Submitted", fmtDate(r.created_at)],
        ].map(([k, v]) => (
          <div key={k as string} className="min-w-0">
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="wrap-break-word font-medium">{v ?? "—"}</p>
          </div>
        ))}
        <div className="sm:col-span-3">
          <p className="text-xs text-muted-foreground">Description</p>
          <p className="mt-1 wrap-break-word whitespace-pre-wrap">{r.description}</p>
        </div>
      </div>

      <section className="min-w-0">
          <h2 className="text-lg font-semibold">Files & deliverables</h2>
          <ul className="mt-3 space-y-2">
            {data.files.length === 0 && (
              <li className="text-sm text-muted-foreground">No files.</li>
            )}
            {data.files.map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => openFile(f.path)}
                  className="flex min-w-0 w-full items-center gap-3 rounded-xl border bg-card px-3 py-3 text-left text-sm hover:bg-muted sm:px-4"
                >
                  {f.kind === "delivery" ? (
                    <Download className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {f.kind === "delivery" ? "Completed work" : "Your upload"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
      </section>
    </div>
  );
}
