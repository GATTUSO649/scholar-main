import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Mail, Phone, Save, Upload, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAdminStudentFn, updateRequestFn } from "@/lib/backend";
import { AdminGate } from "@/components/AdminGate";
import { RequestSummary, useRequest } from "@/components/RequestDetail";
import { PayBadge, StatusBadge } from "@/components/StatusBadge";
import { ALL_STATUSES, STATUS_LABEL, type PaymentStatus, type RequestStatus } from "@/lib/status";
import { fmtDate, money, uploadFiles } from "@/lib/requests";

export const Route = createFileRoute("/_authenticated/manage/$id")({
  head: () => ({
    meta: [
      { title: "Manage request — ScholarDesk" },
      { name: "description", content: "Admin request workspace." },
    ],
  }),
  component: ManageRoute,
});

function ManageRoute() {
  const { isAdmin } = Route.useRouteContext();
  return (
    <AdminGate isAdmin={isAdmin}>
      <Manage />
    </AdminGate>
  );
}

const PAYS: PaymentStatus[] = ["unpaid", "pending", "paid", "refunded"];

function Manage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useRequest(id);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const studentId = data?.req?.student_id;
  const {
    data: student,
    isLoading: studentLoading,
    isError: studentError,
  } = useQuery({
    queryKey: ["profile", studentId],
    enabled: !!studentId,
    queryFn: () => getAdminStudentFn({ data: { userId: studentId! } }),
  });

  if (isLoading)
    return (
      <div className="space-y-5">
        <div className="h-7 w-40 animate-pulse rounded bg-muted" />
        <div className="h-36 animate-pulse rounded-2xl bg-white" />
        <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
          <div className="h-120 animate-pulse rounded-lg bg-white" />
          <div className="h-120 animate-pulse rounded-lg bg-white" />
        </div>
      </div>
    );
  if (isError)
    return (
      <div className="rounded-2xl border bg-white p-8">
        <p className="font-semibold">Could not load this request</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Refresh the page and try again."}
        </p>
      </div>
    );
  if (!data?.req)
    return (
      <div className="rounded-2xl border bg-white p-8">
        <p className="font-semibold">Request not found</p>
        <Link
          to="/admin"
          className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline"
        >
          Return to request queue
        </Link>
      </div>
    );
  const r = data.req;
  const currencies = r.currency === "KES" ? ["KES"] : ["KES", r.currency];

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const status = formData.get("status") as RequestStatus;
    const payment_status = formData.get("payment_status") as PaymentStatus;
    const priceRaw = String(formData.get("price") ?? "");
    const price = priceRaw === "" ? null : Number(priceRaw);
    if (price != null && (!Number.isFinite(price) || price < 0)) {
      toast.error("Enter a valid non-negative quote.");
      return;
    }
    const note = String(formData.get("note") ?? "")
      .trim()
      .slice(0, 2000);
    const grade =
      String(formData.get("grade") ?? "")
        .trim()
        .slice(0, 20) || null;
    const admin_feedback =
      String(formData.get("admin_feedback") ?? "")
        .trim()
        .slice(0, 4000) || null;
    setBusy(true);
    try {
      const hasDeliveryFiles = files.length > 0;
      if (hasDeliveryFiles) {
        const uploaded = await uploadFiles(id, files, "delivery");
        if (!uploaded) return;
        setFiles([]);
      }
      await updateRequestFn({
        data: {
          id,
          status: hasDeliveryFiles ? "completed" : status,
          payment_status,
          price,
          currency: String(formData.get("currency")) as "USD" | "KES" | "GBP" | "EUR",
          admin_notes: String(formData.get("admin_notes") ?? ""),
          grade,
          admin_feedback,
          note: note || null,
        },
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["request", id] }),
        qc.invalidateQueries({ queryKey: ["admin-requests"] }),
      ]);
      const noteField = form.querySelector<HTMLTextAreaElement>("#note");
      if (noteField) noteField.value = "";
      toast.success("Request updated successfully.");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not update the request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7">
      <Link
        to="/admin"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#567066] transition-colors hover:text-[#155b4c]"
      >
        <ArrowLeft className="h-4 w-4" /> Service requests
      </Link>

      <header className="border-b border-[#dfe8e3] pb-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[#e5f1eb] px-2.5 py-1 text-xs font-bold text-[#155b4c]">
                {r.ref}
              </span>
              <span className="text-xs text-[#788780]">
                {r.services?.name ?? "General service"}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#173c33] sm:text-3xl">
              {r.title}
            </h1>
            <p className="mt-2 text-sm text-[#718078]">
              Submitted {fmtDate(r.created_at)}
              {r.deadline && (
                <>
                  {" "}
                  <span className="px-1">·</span> Due {fmtDate(r.deadline)}
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={r.status} />
            <PayBadge status={r.payment_status} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#e7ede9] pt-4 text-xs text-[#718078]">
          <span>
            Current quote: <strong className="text-[#24473b]">{money(r.price, r.currency)}</strong>
          </span>
          <span>Last updated: {fmtDate(r.updated_at)}</span>
        </div>
      </header>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_370px]">
        <div className="min-w-0">
          <RequestSummary data={data} compact />
        </div>
        <aside className="space-y-6 xl:sticky xl:top-23">
          <section className="border-y border-[#dfe8e3] bg-white px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-[#e5f1eb] text-[#155b4c]">
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-[#173c33]">Student contact</h2>
                <p className="text-xs text-[#788780]">Request owner</p>
              </div>
            </div>
            {studentLoading ? (
              <div className="mt-4 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
              </div>
            ) : studentError ? (
              <p className="mt-4 text-sm text-[#a34737]">Could not load the student profile.</p>
            ) : student ? (
              <div className="mt-4 border-t border-[#e7ede9] pt-4">
                <p className="font-semibold text-[#24473b]">{student.full_name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {student.email && (
                    <a
                      href={`mailto:${student.email}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#d4e1da] px-2.5 py-1.5 text-xs font-semibold text-[#31574b] hover:bg-[#f2f7f3]"
                    >
                      <Mail className="h-3.5 w-3.5" /> Email student
                    </a>
                  )}
                  {student.phone && (
                    <a
                      href={`tel:${student.phone.replace(/[^+\d]/g, "")}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#d4e1da] px-2.5 py-1.5 text-xs font-semibold text-[#31574b] hover:bg-[#f2f7f3]"
                    >
                      <Phone className="h-3.5 w-3.5" /> Call student
                    </a>
                  )}
                </div>
                <div className="mt-3 bg-[#f5f8f6] p-3 text-xs leading-relaxed text-[#718078]">
                  <p>{student.institution || "Institution not provided"}</p>
                  <p className="mt-1">
                    {[student.course, student.year_of_study && `Year ${student.year_of_study}`]
                      .filter(Boolean)
                      .join(" · ") || "Course not provided"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#718078]">Student profile unavailable.</p>
            )}
          </section>

          <form
            onSubmit={save}
            key={r.updated_at}
            className="overflow-hidden border-y border-[#dfe8e3] bg-white"
          >
            <div className="border-b border-[#e7ede9] px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#718078]">
                Service controls
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[#173c33]">Update request</h2>
            </div>
            <div className="space-y-4 px-4 py-4">
              <div>
                <Label htmlFor="status">Request status</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={r.status}
                  className="mt-1.5 h-10 w-full rounded-md border border-[#d7e2dc] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#72a78d]"
                >
                  {ALL_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-[1fr_100px] gap-3">
                <div>
                  <Label htmlFor="price">Quote amount</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={r.price ?? ""}
                    className="mt-1.5 h-10 rounded-md"
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <select
                    id="currency"
                    name="currency"
                    defaultValue={r.currency}
                    className="mt-1.5 h-10 w-full rounded-md border border-[#d7e2dc] bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-[#72a78d]"
                  >
                    {currencies.map((currency) => (
                      <option key={currency}>{currency}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    New quotes use KES. Changing this request’s currency does not convert its
                    amount.
                  </p>
                </div>
              </div>
              <div>
                <Label htmlFor="payment_status">Payment status</Label>
                <select
                  id="payment_status"
                  name="payment_status"
                  defaultValue={r.payment_status}
                  className="mt-1.5 h-10 w-full rounded-md border border-[#d7e2dc] bg-white px-3 text-sm capitalize outline-none focus:ring-2 focus:ring-[#72a78d]"
                >
                  {PAYS.map((payment) => (
                    <option key={payment} value={payment}>
                      {payment}
                    </option>
                  ))}
                </select>
              </div>
              <div className="border-t pt-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Feedback & delivery
                </p>
              </div>
              <div>
                <Label htmlFor="grade">Grade / result</Label>
                <Input
                  id="grade"
                  name="grade"
                  maxLength={20}
                  placeholder="e.g. A, 78/100"
                  defaultValue={r.grade ?? ""}
                  className="mt-1.5 h-10 rounded-md"
                />
              </div>
              <div>
                <Label htmlFor="admin_feedback">Feedback to student</Label>
                <Textarea
                  id="admin_feedback"
                  name="admin_feedback"
                  rows={3}
                  defaultValue={r.admin_feedback ?? ""}
                  className="mt-1.5 resize-y rounded-md"
                />
              </div>
              <div>
                <Label htmlFor="note">Student update message</Label>
                <Textarea
                  id="note"
                  name="note"
                  rows={2}
                  placeholder="Optional message included in the request timeline"
                  className="mt-1.5 resize-y rounded-md"
                />
              </div>
              <div>
                <Label htmlFor="admin_notes">Internal notes</Label>
                <Textarea
                  id="admin_notes"
                  name="admin_notes"
                  rows={2}
                  defaultValue={r.admin_notes ?? ""}
                  className="mt-1.5 resize-y rounded-md"
                />
              </div>
              <div>
                <Label htmlFor="delivery-files">Completed work files</Label>
                <label
                  htmlFor="delivery-files"
                  className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-[#cbdcd3] bg-[#f7faf8] px-3 py-3 text-sm transition-colors hover:bg-[#edf5f0]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white text-[#287260] shadow-sm">
                    <Upload className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {files.length ? `${files.length} file(s) selected` : "Choose delivery files"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Uploading marks the request complete and notifies the student
                    </span>
                  </span>
                  <input
                    id="delivery-files"
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                  />
                </label>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {files.map((file) => (
                      <li key={`${file.name}-${file.lastModified}`} className="truncate">
                        {file.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button
                className="h-11 w-full rounded-md bg-[#185c4b] hover:bg-[#124b3d]"
                disabled={busy}
              >
                <Save className="mr-2 h-4 w-4" />
                {busy ? "Saving changes…" : "Save request changes"}
              </Button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
