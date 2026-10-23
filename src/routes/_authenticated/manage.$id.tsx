import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Save, Upload, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAdminStudentFn, updateRequestFn } from "@/lib/backend";
import { AdminGate } from "@/components/AdminGate";
import { RequestSummary, useRequest } from "@/components/RequestDetail";
import { PayBadge, StatusBadge } from "@/components/StatusBadge";
import { STATUS_LABEL, STATUS_ORDER, type PaymentStatus, type RequestStatus } from "@/lib/status";
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
  const { user } = Route.useRouteContext();
  return (
    <AdminGate userId={user.id}>
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
          <div className="h-[480px] animate-pulse rounded-2xl bg-white" />
          <div className="h-[480px] animate-pulse rounded-2xl bg-white" />
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
    <div className="space-y-6">
      <Link
        to="/admin"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to request queue
      </Link>

      <header className="rounded-2xl border bg-white p-5 shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)] sm:p-7">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-[#eef2f7] px-2.5 py-1 text-xs font-bold text-[#324b6a]">
                {r.ref}
              </span>
              <span className="text-xs text-muted-foreground">
                {r.services?.name ?? "General service"}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{r.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
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
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-xs text-muted-foreground">
          <span>
            Current quote: <strong className="text-foreground">{money(r.price, r.currency)}</strong>
          </span>
          <span>Last updated: {fmtDate(r.updated_at)}</span>
        </div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0">
          <RequestSummary data={data} compact />
        </div>
        <aside className="space-y-5 xl:sticky xl:top-[92px]">
          <section className="rounded-2xl border bg-white p-5 shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef2f7] text-[#334b6b]">
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold">Student profile</h2>
                <p className="text-xs text-muted-foreground">Request owner</p>
              </div>
            </div>
            {studentLoading ? (
              <div className="mt-4 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
              </div>
            ) : studentError ? (
              <p className="mt-4 text-sm text-destructive">Could not load the student profile.</p>
            ) : student ? (
              <div className="mt-4 border-t pt-4">
                <p className="font-semibold">{student.full_name}</p>
                <p className="mt-1 break-all text-sm text-muted-foreground">{student.email}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {student.phone || "No phone number"}
                </p>
                <div className="mt-3 rounded-xl bg-[#f7f9fc] p-3 text-xs leading-relaxed text-muted-foreground">
                  <p>{student.institution || "Institution not provided"}</p>
                  <p className="mt-1">
                    {[student.course, student.year_of_study && `Year ${student.year_of_study}`]
                      .filter(Boolean)
                      .join(" · ") || "Course not provided"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Student profile unavailable.</p>
            )}
          </section>

          <form
            onSubmit={save}
            key={r.updated_at}
            className="overflow-hidden rounded-2xl border bg-white shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)]"
          >
            <div className="border-b px-5 py-4">
              <p className="text-xs font-semibold text-muted-foreground">WORKSPACE</p>
              <h2 className="mt-1 text-lg font-semibold">Update request</h2>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <Label htmlFor="status">Request status</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={r.status}
                  className="mt-1.5 h-10 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  {[...STATUS_ORDER, "cancelled" as const].map((status) => (
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
                    className="mt-1.5 h-10 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <select
                    id="currency"
                    name="currency"
                    defaultValue={r.currency}
                    className="mt-1.5 h-10 w-full rounded-xl border border-input bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
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
                  className="mt-1.5 h-10 w-full rounded-xl border border-input bg-white px-3 text-sm capitalize outline-none focus:ring-2 focus:ring-ring"
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
                  className="mt-1.5 h-10 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="admin_feedback">Feedback to student</Label>
                <Textarea
                  id="admin_feedback"
                  name="admin_feedback"
                  rows={3}
                  defaultValue={r.admin_feedback ?? ""}
                  className="mt-1.5 resize-y rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="note">Student update message</Label>
                <Textarea
                  id="note"
                  name="note"
                  rows={2}
                  placeholder="Optional message included in the request timeline"
                  className="mt-1.5 resize-y rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="admin_notes">Internal notes</Label>
                <Textarea
                  id="admin_notes"
                  name="admin_notes"
                  rows={2}
                  defaultValue={r.admin_notes ?? ""}
                  className="mt-1.5 resize-y rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="delivery-files">Completed work files</Label>
                <label
                  htmlFor="delivery-files"
                  className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-[#fafbfd] px-3 py-3 text-sm transition-colors hover:bg-muted"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#405a7a] shadow-sm">
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
              <Button className="h-11 w-full rounded-xl" disabled={busy}>
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
