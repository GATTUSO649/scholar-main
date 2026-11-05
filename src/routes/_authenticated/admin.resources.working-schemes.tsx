import { createFileRoute } from "@tanstack/react-router";
import { AdminGate } from "@/components/AdminGate";
import { LibraryManager } from "@/components/admin/LibraryManager";

export const Route = createFileRoute("/_authenticated/admin/resources/working-schemes")({
  head: () => ({ meta: [{ title: "Working schemes — Library management — ScholarDesk" }] }),
  component: WorkingSchemesRoute,
});

function WorkingSchemesRoute() {
  const { isAdmin } = Route.useRouteContext();
  return (
    <AdminGate isAdmin={isAdmin}>
      <LibraryManager category="working_scheme" />
    </AdminGate>
  );
}
