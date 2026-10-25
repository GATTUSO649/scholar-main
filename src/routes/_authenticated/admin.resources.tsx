import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AdminGate } from "@/components/AdminGate";
import { LibraryManager } from "@/components/admin/LibraryManager";

export const Route = createFileRoute("/_authenticated/admin/resources")({
  head: () => ({ meta: [{ title: "Library — ScholarDesk" }] }),
  component: AllResourcesRoute,
});

function AllResourcesRoute() {
  const { isAdmin } = Route.useRouteContext();
  const path = useRouterState({ select: (state) => state.location.pathname });
  return (
    <AdminGate isAdmin={isAdmin}>
      {path === "/admin/resources" ? <LibraryManager category="all" /> : <Outlet />}
    </AdminGate>
  );
}
