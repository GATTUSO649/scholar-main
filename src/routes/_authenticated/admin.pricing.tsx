import { createFileRoute } from "@tanstack/react-router";
import { AdminGate } from "@/components/AdminGate";
import { PricingManager } from "@/components/admin/PricingManager";

export const Route = createFileRoute("/_authenticated/admin/pricing")({
  head: () => ({ meta: [{ title: "Service pricing — ScholarDesk" }] }),
  component: AdminPricingRoute,
});

function AdminPricingRoute() {
  const { isAdmin } = Route.useRouteContext();
  return (
    <AdminGate isAdmin={isAdmin}>
      <PricingManager />
    </AdminGate>
  );
}
