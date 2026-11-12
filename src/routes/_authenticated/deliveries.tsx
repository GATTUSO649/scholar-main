import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CalendarDays, Download, FileCheck2, PackageCheck } from "lucide-react";
import { getMyDeliveriesFn } from "@/lib/backend";
import { openFile } from "@/lib/requests";
import { fmtDate } from "@/lib/requests";

export const Route = createFileRoute("/_authenticated/deliveries")({
  head: () => ({
    meta: [
      { title: "My deliveries — ScholarDesk" },
      { name: "description", content: "Download completed work for your requests." },
    ],
  }),
  component: Deliveries,
});

function Deliveries() {
  const { user } = Route.useRouteContext();
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["my-deliveries", user.id],
    queryFn: () => getMyDeliveriesFn(),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
  const fileCount = data.reduce((total, delivery) => total + delivery.files.length, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header className="border-b border-[#dce7e1] pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-[#287260]">Student workspace</p>
            <h1 className="mt-2 text-3xl font-semibold text-[#173c33]">My deliveries</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#687b72]">
              Completed work for your requests, organized by service and ready to download.
            </p>
          </div>
          {!isLoading && !isError && (
            <div className="flex items-center gap-2 text-sm text-[#587167]">
              <FileCheck2 className="h-4 w-4 text-[#287260]" />
              {fileCount} {fileCount === 1 ? "file" : "files"}
            </div>
          )}
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-4" aria-label="Loading deliveries">
          <div className="h-36 animate-pulse rounded-lg bg-white" />
          <div className="h-36 animate-pulse rounded-lg bg-white" />
        </div>
      ) : isError ? (
        <div className="border border-[#ead8d4] bg-[#fff9f8] px-5 py-6 text-sm text-[#8d4b42]">
          Could not load your deliveries. Refresh the page and try again.
        </div>
      ) : data.length === 0 ? (
        <div className="border border-dashed border-[#cbdcd3] bg-white px-6 py-12 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#e8f2ec] text-[#287260]">
            <PackageCheck className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-[#173c33]">No completed deliveries yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#718078]">
            Your completed, paid services and their files will appear here.
          </p>
          <Link
            to="/requests"
            className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#185c4b] hover:underline"
          >
            View my requests <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {data.map(({ request, files }) => (
            <section
              key={request.id}
              className="overflow-hidden rounded-lg border border-[#dce7e1] bg-white"
            >
              <header className="flex flex-col justify-between gap-3 border-b border-[#e8efeb] bg-[#f7faf8] px-5 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-[#e5f1eb] px-2 py-1 font-bold text-[#155b4c]">
                      {request.ref}
                    </span>
                    <span className="text-[#75877e]">
                      {request.services?.name ?? "Academic support"}
                    </span>
                  </div>
                  <h2 className="mt-2 truncate text-lg font-semibold text-[#173c33]">
                    {request.title}
                  </h2>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-xs text-[#687b72]">
                  <CalendarDays className="h-4 w-4" />
                  Completed {fmtDate(request.updated_at)}
                </div>
              </header>
              <ul className="divide-y divide-[#edf2ef] px-5">
                {files.map((file) => (
                  <li key={file.id} className="flex min-w-0 items-center gap-3 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-[#e8f2ec] text-[#287260]">
                      <FileCheck2 className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[#31574b]">
                        {file.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-[#84928b]">
                        Added {fmtDate(file.created_at)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void openFile(file.path)}
                      aria-label={`Download ${file.name}`}
                      title="Download file"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[#185c4b] transition-colors hover:bg-[#edf5f0]"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <footer className="border-t border-[#edf2ef] px-5 py-3">
                <Link
                  to="/request/$id"
                  params={{ id: request.id }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#557368] hover:text-[#185c4b]"
                >
                  View request <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </footer>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}