import { createFileRoute } from "@tanstack/react-router";
import { AdminGate } from "@/components/AdminGate";
import { LibraryManager } from "@/components/admin/LibraryManager";

export const Route = createFileRoute("/_authenticated/admin/resources/articles")({
  head: () => ({ meta: [{ title: "Articles — Library management — ScholarDesk" }] }),
  component: ArticlesRoute,
});

function ArticlesRoute() {
  const { isAdmin } = Route.useRouteContext();
  return (
    <AdminGate isAdmin={isAdmin}>
      <LibraryManager category="article" />
    </AdminGate>
  );
}
