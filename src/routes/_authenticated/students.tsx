import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { getAdminStudentsFn } from "@/lib/backend";
import { AdminGate } from "@/components/AdminGate";
import { fmtDate } from "@/lib/requests";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({
    meta: [
      { title: "Students — ScholarDesk" },
      { name: "description", content: "All registered students." },
    ],
  }),
  component: StudentsRoute,
});

function StudentsRoute() {
  const { user } = Route.useRouteContext();
  return (
    <AdminGate userId={user.id}>
      <Students />
    </AdminGate>
  );
}

function Students() {
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["admin-students"],
    queryFn: () => getAdminStudentsFn(),
  });
  const rows = data.filter((s) =>
    `${s.full_name} ${s.email} ${s.reg_number} ${s.institution}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  return (
    <div>
      <h1 className="text-3xl font-semibold">
        Students <span className="text-muted-foreground">({data.length})</span>
      </h1>
      <Input
        placeholder="Search students…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mt-6 max-w-sm"
      />
      <div className="mt-6 overflow-x-auto rounded-2xl border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              {["Name", "Email", "Phone", "Adm. no", "Institution", "Course", "Joined"].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium">{s.full_name}</td>
                <td className="px-4 py-3">{s.email}</td>
                <td className="px-4 py-3">{s.phone}</td>
                <td className="px-4 py-3">{s.reg_number}</td>
                <td className="px-4 py-3">{s.institution}</td>
                <td className="px-4 py-3">
                  {s.course} {s.year_of_study && `· Y${s.year_of_study}`}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(s.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
