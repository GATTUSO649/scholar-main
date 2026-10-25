import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Mail, Phone, RefreshCw, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AdminGate } from "@/components/AdminGate";
import { getAdminStudentsFn } from "@/lib/backend";
import { fmtDate } from "@/lib/requests";
import { downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({
    meta: [
      { title: "Student roster — ScholarDesk" },
      { name: "description", content: "Student contact and study records for service staff." },
    ],
  }),
  component: StudentsRoute,
});

function StudentsRoute() {
  const { isAdmin } = Route.useRouteContext();
  return (
    <AdminGate isAdmin={isAdmin}>
      <StudentRoster />
    </AdminGate>
  );
}

function StudentRoster() {
  const [query, setQuery] = useState("");
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-students"],
    queryFn: () => getAdminStudentsFn(),
  });
  const students = data ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const rows = students.filter((student) =>
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
      .includes(normalizedQuery),
  );
  const institutions = new Set(students.map((student) => student.institution).filter(Boolean));
  const recentlyJoined = students.filter(
    (student) => Date.now() - new Date(student.created_at).getTime() < 30 * 24 * 60 * 60 * 1000,
  ).length;

  function exportRoster() {
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
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 border-b border-[#dfe8e3] pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#708078]">
            Student service desk <span className="px-1 text-[#bd8a48]">/</span> People
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#173c33] sm:text-4xl">
            Student roster
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#677872]">
            Find a student, review study details, and contact them about their service request.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-[#d4e1da] bg-white px-3 text-sm font-semibold text-[#31574b] transition-colors hover:bg-[#f2f7f3] disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      <section
        aria-label="Student totals"
        className="grid grid-cols-3 border-y border-[#dfe8e3] bg-white"
      >
        <RosterStat label="Students" value={isLoading || isError ? "—" : students.length} />
        <RosterStat label="Institutions" value={isLoading || isError ? "—" : institutions.size} />
        <RosterStat label="Joined this month" value={isLoading || isError ? "—" : recentlyJoined} />
      </section>

      <section>
        <div className="flex flex-col justify-between gap-4 border-b border-[#dfe8e3] pb-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-lg font-semibold text-[#173c33]">Directory</h2>
            <p className="mt-1 text-sm text-[#718078]" aria-live="polite">
              {isLoading ? "Loading student records…" : `${rows.length} students in this view`}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#788780]" />
              <Input
                type="search"
                aria-label="Search students"
                placeholder="Name, email, institution, course"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 rounded-lg border-[#d7e2dc] bg-white pl-9"
              />
            </div>
            <button
              type="button"
              onClick={exportRoster}
              disabled={isLoading || isError || rows.length === 0}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#d4e1da] bg-white px-3 text-sm font-semibold text-[#31574b] transition-colors hover:bg-[#f2f7f3] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Export roster
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2 pt-3" aria-label="Loading students" aria-busy="true">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-md bg-white" />
            ))}
          </div>
        ) : isError ? (
          <div className="border-y border-[#e0e8e3] bg-white px-5 py-9 text-center" role="alert">
            <p className="font-semibold text-[#a34737]">Could not load students</p>
            <p className="mt-1 text-sm text-[#718078]">
              {error instanceof Error ? error.message : "Refresh to try again."}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-4 rounded-md border border-[#d4e1da] px-3 py-2 text-sm font-semibold text-[#31574b] hover:bg-[#f2f7f3]"
            >
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="border-y border-[#e0e8e3] bg-white px-5 py-10 text-center">
            <Users className="mx-auto h-7 w-7 text-[#84928b]" />
            <p className="mt-3 font-semibold text-[#31574b]">
              {query ? "No matching students" : "No students yet"}
            </p>
            <p className="mt-1 text-sm text-[#718078]">
              {query
                ? "Try a different name, email, or course."
                : "Student registrations will appear here."}
            </p>
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-3 text-sm font-semibold text-[#1b634f] hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto border-y border-[#e0e8e3] bg-white">
            <table className="w-full min-w-195 text-left text-sm">
              <thead className="border-b border-[#e4ebe6] bg-[#f7f9f7] text-[10px] font-bold uppercase tracking-[0.12em] text-[#718078]">
                <tr>
                  <th className="px-5 py-3.5">Student</th>
                  <th className="px-4 py-3.5">Institution</th>
                  <th className="px-4 py-3.5">Course</th>
                  <th className="px-4 py-3.5">Joined</th>
                  <th className="px-4 py-3.5">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8eeea]">
                {rows.map((student) => (
                  <tr key={student.id} className="transition-colors hover:bg-[#f7faf7]">
                    <td className="px-5 py-3.5">
                      <div className="flex min-w-60 items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#e5f1eb] text-xs font-bold uppercase text-[#155b4c]">
                          {student.full_name
                            .split(/\s+/)
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-[#24473b]">
                            {student.full_name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-[#798680]">
                            {student.email || "No email"}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="block max-w-47.5 truncate font-medium text-[#52645c]">
                        {student.institution || "—"}
                      </span>
                      {student.reg_number && (
                        <span className="mt-0.5 block text-xs text-[#849089]">
                          ID {student.reg_number}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="block max-w-45 truncate text-[#52645c]">
                        {student.course || "—"}
                      </span>
                      {student.year_of_study && (
                        <span className="mt-0.5 block text-xs text-[#849089]">
                          Year {student.year_of_study}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-[#718078]">
                      {fmtDate(student.created_at)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {student.email && (
                          <a
                            href={`mailto:${student.email}`}
                            aria-label={`Email ${student.full_name}`}
                            title={`Email ${student.full_name}`}
                            className="inline-grid h-8 w-8 place-items-center rounded-md text-[#58756a] hover:bg-[#e5f1eb] hover:text-[#155b4c]"
                          >
                            <Mail className="h-4 w-4" />
                          </a>
                        )}
                        {student.phone && (
                          <a
                            href={`tel:${student.phone.replace(/[^+\d]/g, "")}`}
                            aria-label={`Call ${student.full_name}`}
                            title={`Call ${student.full_name}`}
                            className="inline-grid h-8 w-8 place-items-center rounded-md text-[#58756a] hover:bg-[#e5f1eb] hover:text-[#155b4c]"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                        )}
                      </div>
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

function RosterStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-r border-[#e8eeea] px-4 py-3.5 last:border-r-0 sm:px-5">
      <p className="text-[11px] font-medium text-[#718078]">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums text-[#183c34]">{value}</p>
    </div>
  );
}
