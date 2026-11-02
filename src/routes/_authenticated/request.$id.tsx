import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequestSummary, useRequest } from "@/components/RequestDetail";
import { money } from "@/lib/requests";

export const Route = createFileRoute("/_authenticated/request/$id")({
  head: () => ({
    meta: [
      { title: "Request details — ScholarDesk" },
      { name: "description", content: "Track your request." },
    ],
  }),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const { data, isLoading } = useRequest(id);
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!data?.req)
    return (
      <p>
        Request not found.
        <Link to="/requests" className="text-primary underline">
          Back
        </Link>
      </p>
    );
  const r = data.req;
  return (
    <div className="space-y-6">
      <Link to="/requests" className="text-sm text-muted-foreground hover:underline">
        ← My requests
      </Link>
      {r.price != null &&
        r.payment_status !== "paid" &&
        (r.status === "awaiting_payment" ||
          r.status === "in_progress" ||
          r.status === "completed") && (
          <RequestPaymentPanel
            requestId={r.id}
            amount={r.price}
            currency={r.currency}
            paymentStatus={r.payment_status}
            latestPayment={data.payments[0]}
          />
        )}
      <RequestSummary data={data} />
    </div>
  );
}

type RequestPayment = {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "cancelled" | "refunded";
  receipt_number: string | null;
  failure_reason: string | null;
  created_at: string;
  paid_at: string | null;
};

function RequestPaymentPanel({
  requestId,
  amount,
  currency,
  paymentStatus,
  latestPayment,
}: {
  requestId: string;
  amount: number;
  currency: string;
  paymentStatus: string;
  latestPayment?: RequestPayment | undefined;
}) {
  const queryClient = useQueryClient();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [busy, setBusy] = useState(false);

  async function checkPayment(paymentId: string) {
    const response = await fetch("/api/request-payment", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paymentId }),
      signal: AbortSignal.timeout(60_000),
    });
    const result = (await response.json().catch(() => null)) as {
      status?: "pending" | "paid" | "failed" | "cancelled" | "not_found";
      error?: string;
      reason?: string;
    } | null;
    if (!response.ok) throw new Error(result?.error ?? "Could not check payment status.");
    return result;
  }

  async function refreshRequest() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["request", requestId] }),
      queryClient.invalidateQueries({ queryKey: ["my-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    ]);
  }

  async function reconcilePayment(paymentId: string) {
    const result = await checkPayment(paymentId);
    if (result?.status === "paid") {
      await refreshRequest();
      toast.success("Payment confirmed. Your request is moving forward.");
      return "paid";
    }
    if (result?.status === "failed" || result?.status === "cancelled") {
      await refreshRequest();
      toast.error(result.reason ?? "Payment was not completed. You can try again.");
      return result.status;
    }
    return "pending";
  }

  async function startPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/request-payment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, phoneNumber }),
      });
      const result = (await response.json().catch(() => null)) as {
        paymentId?: string;
        status?: "pending" | "paid";
        error?: string;
        message?: string;
      } | null;
      if (!response.ok) throw new Error(result?.error ?? "Could not start M-PESA payment.");
      if (result?.status === "paid") {
        await refreshRequest();
        toast.success("This request is already paid.");
        return;
      }
      if (!result?.paymentId) throw new Error("Could not create an M-PESA payment attempt.");
      toast(result.message ?? "Check your phone and complete the M-PESA prompt.");
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 3_000));
        if (Date.now() >= deadline) break;
        const status = await reconcilePayment(result.paymentId);
        if (status !== "pending") return;
      }
      await refreshRequest();
      toast("Payment is still processing. Use Check payment to reconcile it.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start M-PESA payment.");
    } finally {
      setBusy(false);
    }
  }

  async function checkLatestPayment() {
    if (!latestPayment) return;
    setBusy(true);
    try {
      const result = await reconcilePayment(latestPayment.id);
      if (result === "pending") toast("Safaricom has not confirmed this payment yet.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check payment status.");
    } finally {
      setBusy(false);
    }
  }

  const mpesaQuote = currency === "KES" && Number.isInteger(amount) && amount > 0;
  const pending = paymentStatus === "pending" && latestPayment?.status === "pending";

  return (
    <section className="rounded-xl border border-accent bg-accent/10 p-5">
      <div className="flex flex-wrap items-start gap-3">
        <Wallet className="mt-1 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Quote ready: {money(amount, currency)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pay through the M-PESA prompt. Delivery files unlock only after Safaricom confirms the
            payment.
          </p>
          {latestPayment?.receipt_number && (
            <p className="mt-2 text-xs text-muted-foreground">
              Receipt: {latestPayment.receipt_number}
            </p>
          )}
        </div>
      </div>
      {!mpesaQuote ? (
        <p className="mt-4 text-sm text-muted-foreground">
          M-PESA checkout is available for whole-KES quotes. Contact support for this quote.
        </p>
      ) : pending ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-muted-foreground">
            M-PESA payment is awaiting verification.
          </p>
          <Button type="button" variant="outline" disabled={busy} onClick={checkLatestPayment}>
            {busy ? "Checking…" : "Check payment"}
          </Button>
        </div>
      ) : (
        <form onSubmit={startPayment} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="M-PESA phone number"
            aria-label="M-PESA phone number"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            required
            className="bg-white sm:max-w-xs"
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Waiting for M-PESA…" : `Pay ${money(amount, currency)}`}
          </Button>
        </form>
      )}
    </section>
  );
}
