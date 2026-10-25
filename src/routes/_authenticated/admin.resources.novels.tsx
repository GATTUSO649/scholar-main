import { createFileRoute } from "@tanstack/react-router";
import { AdminGate } from "@/components/AdminGate";
import { LibraryManager } from "@/components/admin/LibraryManager";

export const Route = createFileRoute("/_authenticated/admin/resources/novels")({
  head: () => ({ meta: [{ title: "Novels — Library management — ScholarDesk" }] }),
  component: NovelsRoute,
});

function NovelsRoute() {
  const { isAdmin } = Route.useRouteContext();
  return (
    <AdminGate isAdmin={isAdmin}>
      <LibraryManager category="novel" />
    </AdminGate>
  );
}
