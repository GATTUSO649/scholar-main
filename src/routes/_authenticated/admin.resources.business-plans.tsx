import { createFileRoute } from "@tanstack/react-router";
import { AdminGate } from "@/components/AdminGate";
import { LibraryManager } from "@/components/admin/LibraryManager";

export const Route = createFileRoute("/_authenticated/admin/resources/business-plans")({
  head: () => ({ meta: [{ title: "Business plans — Library management — ScholarDesk" }] }),
  component: BusinessPlansRoute,
});

function BusinessPlansRoute() {
  const { isAdmin } = Route.useRouteContext();
  return (
    <AdminGate isAdmin={isAdmin}>
      <LibraryManager category="business_plan" />
    </AdminGate>
  );
}
