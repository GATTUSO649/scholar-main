import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ClipboardList,
  Download,
  FileText,
  Keyboard,
  PenLine,
  ScanText,
  Search,
} from "lucide-react";
import { getLibraryResourcesFn, getPublicDataFn } from "@/lib/backend";
import { PublicPage, PublicPageHeading } from "@/components/PublicPage";

const serviceIcons = [PenLine, Search, FileText, Keyboard, ScanText, ClipboardList];

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services — ScholarDesk" },
      {
        name: "description",
        content: "Explore academic support services available through ScholarDesk.",
      },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["public-data"],
    queryFn: () => getPublicDataFn(),
  });
  const {
    data: resources = [],
    isLoading: resourcesLoading,
    isError: resourcesError,
  } = useQuery({
    queryKey: ["library-resources"],
    queryFn: () => getLibraryResourcesFn(),
  });
  const services = data?.services ?? [];

  return (
    <PublicPage>
      <section className="bg-secondary px-5 py-20 sm:py-24">
        <PublicPageHeading eyebrow="Services" title="Support that helps you learn" />
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Browse our services and choose the support you need. Every request is reviewed by our team
          before you approve a quote.
        </p>
        <div className="mx-auto mt-12 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading services…</p>
          ) : isError ? (
            <p className="text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : "Could not load services. Refresh to try again."}
            </p>
          ) : services.length ? (
            services.map((service, index) => {
              const Icon = serviceIcons[index % serviceIcons.length]!;
              return (
                <article
                  key={service.id}
                  className="flex flex-col rounded-3xl border bg-card p-7 shadow-soft"
                >
                  <Icon className="h-6 w-6 text-accent" />
                  <h2 className="mt-4 text-xl font-semibold">{service.name}</h2>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{service.description}</p>
                  <Link
                    to="/submit"
                    search={{ service: service.id }}
                    className="mt-6 text-sm font-semibold text-primary hover:underline"
                  >
                    Request this service →
                  </Link>
                </article>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">
              Services are being updated. Please check back soon.
            </p>
          )}
        </div>
        <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-muted-foreground">
          Need help choosing? Contact support and we’ll help you find the right service.
        </p>
        <section className="mx-auto mt-20 max-w-6xl border-t border-border/70 pt-12">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Free resources
              </p>
              <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
                Downloadable articles and resources
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Browse articles, novels, and business plans shared by our team.
              </p>
            </div>
            <Link
              to="/downloads"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              Browse the download library <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resourcesLoading ? (
              <p className="text-sm text-muted-foreground">Loading downloadable resources…</p>
            ) : resourcesError ? (
              <p className="text-sm text-destructive">Could not load downloadable resources.</p>
            ) : resources.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                New articles and resources will appear here when available.
              </p>
            ) : (
              resources.slice(0, 6).map((resource) => (
                <article
                  key={resource.id}
                  className="flex items-start gap-3 rounded-2xl border bg-card p-5 shadow-soft"
                >
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {resource.category.replace("_", " ")}
                    </p>
                    <h3 className="mt-1 font-semibold">{resource.title}</h3>
                    {resource.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {resource.description}
                      </p>
                    )}
                    <a
                      href={`/api/library?id=${encodeURIComponent(resource.id)}`}
                      className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </PublicPage>
  );
}
