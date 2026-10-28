import { createFileRoute } from "@tanstack/react-router";
import { AdminGate } from "@/components/AdminGate";
import { ProfileSettings } from "./profile";

export const Route = createFileRoute("/_authenticated/admin/profile")({
  head: () => ({ meta: [{ title: "Admin account — ScholarDesk" }] }),
  component: AdminProfileRoute,
});

function AdminProfileRoute() {
  const { isAdmin, user } = Route.useRouteContext();
  return (
    <AdminGate isAdmin={isAdmin}>
      <ProfileSettings userId={user.id} isAdmin />
    </AdminGate>
  );
}
