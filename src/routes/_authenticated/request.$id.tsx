import { createFileRoute, Link } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
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
        r.status !== "cancelled" &&
        r.status !== "declined" && (
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-accent bg-accent/15 p-5">
            <Wallet className="h-6 w-6 text-primary" />
            <div className="flex-1">
              <p className="font-semibold">Your quote is ready: {money(r.price, r.currency)}</p>
              <p className="text-sm text-muted-foreground">
                Payment is arranged directly with our team. Please wait for payment instructions
                before sending any money.
              </p>
            </div>
          </div>
        )}
      <RequestSummary data={data} />
    </div>
  );
}
