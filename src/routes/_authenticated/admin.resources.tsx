import { createFileRoute } from "@tanstack/react-router";
import { AdminGate } from "@/components/AdminGate";
import { LibraryManager } from "@/components/admin/LibraryManager";

export const Route = createFileRoute("/_authenticated/admin/resources")({
  head: () => ({ meta: [{ title: "Library — ScholarDesk" }] }),
  component: AllResourcesRoute,
});

function AllResourcesRoute() {
  const { isAdmin } = Route.useRouteContext();
  return (
    <AdminGate isAdmin={isAdmin}>
      <LibraryManager category="all" />
    </AdminGate>
  );
}
