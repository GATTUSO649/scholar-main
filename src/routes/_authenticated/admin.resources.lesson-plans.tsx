import { createFileRoute } from "@tanstack/react-router";
import { AdminGate } from "@/components/AdminGate";
import { LibraryManager } from "@/components/admin/LibraryManager";

export const Route = createFileRoute("/_authenticated/admin/resources/lesson-plans")({
  head: () => ({ meta: [{ title: "Lesson plans — Library management — ScholarDesk" }] }),
  component: LessonPlansRoute,
});

function LessonPlansRoute() {
  const { isAdmin } = Route.useRouteContext();
  return (
    <AdminGate isAdmin={isAdmin}>
      <LibraryManager category="lesson_plan" />
    </AdminGate>
  );
}
