import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download, FileText } from "lucide-react";
import { PublicPage, PublicPageHeading } from "@/components/PublicPage";
import { Button } from "@/components/ui/button";
import { getLibraryResourcesFn } from "@/lib/backend";

export const Route = createFileRoute("/downloads")({
  head: () => ({
    meta: [
      { title: "Download library — ScholarDesk" },
      { name: "description", content: "Download novels, business plans, and articles." },
    ],
  }),
  component: DownloadsPage,
});

function DownloadsPage() {
  const {
    data: resources = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["library-resources"],
    queryFn: () => getLibraryResourcesFn(),
  });

  return (
    <PublicPage>
      <section className="bg-secondary px-5 py-20 sm:py-24">
        <PublicPageHeading eyebrow="Resources" title="Download library" />
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Browse novels, business plans, and articles published by ScholarDesk.
        </p>
        <div className="mx-auto mt-12 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading downloads…</p>
          ) : isError ? (
            <p className="text-sm text-destructive">
              Could not load downloads. Refresh the page to try again.
            </p>
          ) : resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              There are no downloads yet. Please check back soon.
            </p>
          ) : (
            resources.map((resource) => (
              <article
                key={resource.id}
                className="flex flex-col rounded-3xl border bg-card p-7 shadow-soft"
              >
                {resource.category === "novel" ? (
                  <BookOpen className="h-6 w-6 text-accent" />
                ) : (
                  <FileText className="h-6 w-6 text-accent" />
                )}
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {resource.category.replace("_", " ")}
                </p>
                <h2 className="mt-2 text-xl font-semibold">{resource.title}</h2>
                {resource.description && (
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">
                    {resource.description}
                  </p>
                )}
                <Button asChild className="mt-6 self-start">
                  <a href={`/api/library?id=${encodeURIComponent(resource.id)}`}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </a>
                </Button>
              </article>
            ))
          )}
        </div>
      </section>
    </PublicPage>
  );
}
