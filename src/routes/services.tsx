import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, FileText, Keyboard, PenLine, ScanText, Search } from "lucide-react";
import { getPublicDataFn } from "@/lib/backend";
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
      </section>
    </PublicPage>
  );
}
