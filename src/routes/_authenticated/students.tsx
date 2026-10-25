import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Building2, Download, GraduationCap, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getAdminStudentsFn } from "@/lib/backend";
import { AdminGate } from "@/components/AdminGate";
import { fmtDate } from "@/lib/requests";
import { downloadCsv } from "@/lib/csv";

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
  const { isAdmin } = Route.useRouteContext();
  return (
    <AdminGate isAdmin={isAdmin}>
      <Students />
    </AdminGate>
  );
}

function Students() {
  const [query, setQuery] = useState("");
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-students"],
    queryFn: () => getAdminStudentsFn(),
  });
  const students = data ?? [];
  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data ?? []).filter((student) =>
      [
        student.full_name,
        student.email,
        student.phone,
        student.reg_number,
        student.institution,
        student.course,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [data, query]);
  const institutions = new Set(students.map((student) => student.institution).filter(Boolean));
  const recentlyJoined = students.filter(
    (student) => Date.now() - new Date(student.created_at).getTime() < 30 * 24 * 60 * 60 * 1000,
  ).length;

  function exportStudents() {
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `scholardesk-students-${date}.csv`,
      [
        "Name",
        "Email",
        "Phone",
        "Institution",
        "Registration number",
        "Course",
        "Year of study",
        "Joined",
      ],
      rows.map((student) => [
        student.full_name,
        student.email ?? "",
        student.phone ?? "",
        student.institution ?? "",
        student.reg_number ?? "",
        student.course ?? "",
        student.year_of_study ?? "",
        student.created_at,
      ]),
    );
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#687b93]">
            Community
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Student directory
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Browse student profiles and find the right contact in seconds.
          </p>
        </div>
        <div className="inline-flex h-10 items-center gap-2 self-start rounded-xl border bg-white px-4 text-sm font-semibold shadow-sm sm:self-auto">
          <Users className="h-4 w-4 text-[#4b607b]" />
          {isLoading ? "Loading…" : `${students.length} students`}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Total students"
          value={isLoading ? "—" : students.length}
          icon={Users}
          tone="blue"
        />
        <SummaryCard
          label="Institutions"
          value={isLoading ? "—" : institutions.size}
          icon={Building2}
          tone="violet"
        />
        <SummaryCard
          label="Joined in the last 30 days"
          value={isLoading ? "—" : recentlyJoined}
          icon={GraduationCap}
          tone="green"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)]">
        <div className="flex flex-col justify-between gap-4 border-b px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="text-lg font-semibold">All students</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading
                ? "Loading student records…"
                : `${rows.length} result${rows.length === 1 ? "" : "s"}${query ? ` for “${query}”` : ""}`}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Name, email, course…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 rounded-xl border-[#e1e6ee] bg-[#fafbfd] pl-9"
              />
            </div>
            <button
              type="button"
              onClick={exportStudents}
              disabled={isLoading || isError || rows.length === 0}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#dce7e3] bg-white px-3 text-sm font-semibold text-[#254e46] transition-colors hover:bg-[#f4f8f6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Export view
            </button>
          </div>
        </div>
        {isLoading ? (
          <div className="space-y-3 p-6" aria-label="Loading students">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-xl bg-[#f3f5f8]" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-9 text-center">
            <p className="font-semibold">Could not load students</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Refresh to try again."}
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <Users className="h-5 w-5" />
            </span>
            <p className="mt-4 font-semibold">
              {query ? "No matching students" : "No students yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {query
                ? "Try a different name, email, or course."
                : "Student registrations will appear here."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b bg-[#f8fafc] text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-4">Student</th>
                  <th className="px-4 py-4">Institution</th>
                  <th className="px-4 py-4">Course</th>
                  <th className="px-4 py-4">Phone</th>
                  <th className="px-4 py-4">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {rows.map((student) => (
                  <tr key={student.id} className="transition-colors hover:bg-[#fafbfd]">
                    <td className="px-5 py-4">
                      <div className="flex min-w-[240px] items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf1f6] text-xs font-bold uppercase text-[#354e6d]">
                          {student.full_name
                            .split(/\s+/)
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{student.full_name}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {student.email || "No email"}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="block max-w-[190px] truncate font-medium">
                        {student.institution || "—"}
                      </span>
                      {student.reg_number && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          ID {student.reg_number}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="block max-w-[180px] truncate">{student.course || "—"}</span>
                      {student.year_of_study && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Year {student.year_of_study}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">
                      {student.phone || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">
                      {fmtDate(student.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
  tone: "blue" | "violet" | "green";
}) {
  const tones = {
    blue: "bg-sky-50 text-sky-700",
    violet: "bg-violet-50 text-violet-700",
    green: "bg-emerald-50 text-emerald-700",
  };
  return (
    <article className="flex items-center justify-between rounded-2xl border bg-white p-5 shadow-[0_8px_32px_-24px_rgba(23,38,60,0.35)]">
      <div>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
      </div>
      <span className={`grid h-11 w-11 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
    </article>
  );
}
