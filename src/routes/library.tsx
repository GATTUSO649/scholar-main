import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download, FileText, Search, BriefcaseBusiness } from "lucide-react";
import { useMemo, useState } from "react";
import { PublicPage, PublicPageHeading } from "@/components/PublicPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLibraryResourcesFn } from "@/lib/backend";

type LibraryCategory = "all" | "novel" | "business_plan" | "article";

const categories: { id: LibraryCategory; label: string }[] = [
  { id: "all", label: "All resources" },
  { id: "article", label: "Articles" },
  { id: "novel", label: "Novels" },
  { id: "business_plan", label: "Business plans" },
];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Library — ScholarDesk" },
      { name: "description", content: "Browse and download novels, business plans, and articles." },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const [category, setCategory] = useState<LibraryCategory>("all");
  const [search, setSearch] = useState("");
  const {
    data: resources = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["library-resources"],
    queryFn: () => getLibraryResourcesFn(),
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return resources.filter((resource) => {
      const categoryMatches = category === "all" || resource.category === category;
      const searchMatches =
        !needle ||
        `${resource.title} ${resource.description} ${resource.name} ${resource.category}`
          .toLowerCase()
          .includes(needle);
      return categoryMatches && searchMatches;
    });
  }, [category, resources, search]);

  return (
    <PublicPage>
      <section className="bg-secondary px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="overflow-hidden rounded-4xl bg-hero px-6 py-10 text-ink-foreground shadow-soft sm:px-10 sm:py-14">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
                  ScholarDesk resources
                </p>
                <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">
                  The Library
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-ink-foreground/75 sm:text-base">
                  Find and download articles, novels, and business plans curated by our team. Search
                  the collection or browse by category.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <LibraryStat
                  icon={FileText}
                  label="Articles"
                  value={resources.filter((item) => item.category === "article").length}
                />
                <LibraryStat
                  icon={BookOpen}
                  label="Novels"
                  value={resources.filter((item) => item.category === "novel").length}
                />
                <LibraryStat
                  icon={BriefcaseBusiness}
                  label="Business plans"
                  value={resources.filter((item) => item.category === "business_plan").length}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search titles, categories, or files"
                  aria-label="Search library"
                  className="h-11 rounded-xl pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
                {categories.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategory(item.id)}
                    aria-pressed={category === item.id}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      category === item.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {isLoading
                ? "Loading the library…"
                : `${filtered.length} resource${filtered.length === 1 ? "" : "s"}`}
            </p>
            {isError && (
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? "Retrying…" : "Try again"}
              </Button>
            )}
          </div>

          {isLoading ? (
            <div
              className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              aria-label="Loading library"
            >
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="h-56 animate-pulse rounded-2xl border bg-card" />
              ))}
            </div>
          ) : isError ? (
            <div className="mt-4 rounded-2xl border border-destructive/30 bg-card p-8 text-center">
              <h2 className="font-semibold">The library couldn’t load</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Check your connection and retry. Your library is unchanged.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-4 rounded-2xl border bg-card px-6 py-14 text-center shadow-soft">
              <BookOpen className="mx-auto h-9 w-9 text-accent" />
              <h2 className="mt-4 text-lg font-semibold">
                {resources.length ? "No matching resources" : "The library is being stocked"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {resources.length
                  ? "Try another search or select a different category."
                  : "New articles, novels, and business plans will appear here when they are published."}
              </p>
              {resources.length > 0 && (search || category !== "all") && (
                <Button
                  variant="outline"
                  className="mt-5"
                  onClick={() => {
                    setSearch("");
                    setCategory("all");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((resource) => (
                <article
                  key={resource.id}
                  className="group flex min-h-64 flex-col rounded-2xl border bg-card p-6 shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/20 text-primary">
                      {resource.category === "novel" ? (
                        <BookOpen className="h-5 w-5" />
                      ) : resource.category === "business_plan" ? (
                        <BriefcaseBusiness className="h-5 w-5" />
                      ) : (
                        <FileText className="h-5 w-5" />
                      )}
                    </span>
                    <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {resource.category.replace("_", " ")}
                    </span>
                  </div>
                  <h2 className="mt-5 text-xl font-semibold leading-snug">{resource.title}</h2>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">
                    {resource.description || "A resource shared by the ScholarDesk team."}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-4 text-xs text-muted-foreground">
                    <span>{resource.name.split(".").pop()?.toUpperCase() ?? "FILE"}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatBytes(resource.size)}</span>
                    <span aria-hidden="true">·</span>
                    <span>Added {formatDate(resource.created_at)}</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-foreground">
                      {resource.price > 0
                        ? `${resource.currency} ${resource.price.toLocaleString()}`
                        : "Free"}
                    </span>
                    {resource.price > 0 ? (
                      <Button asChild className="shrink-0">
                        <Link to="/auth" search={{ mode: "login" }}>
                          Sign in to purchase
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild className="shrink-0">
                        <a href={`/api/library?id=${encodeURIComponent(resource.id)}`}>
                          <Download className="mr-2 h-4 w-4" /> Download
                        </a>
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicPage>
  );
}

function LibraryStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-w-28 items-center gap-3 rounded-xl border border-white/10 bg-white/6 px-4 py-3">
      <Icon className="h-4 w-4 text-accent" />
      <div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="mt-1 text-xs text-ink-foreground/65">{label}</p>
      </div>
    </div>
  );
}
