import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPublicDataFn } from "@/lib/backend";
import { PublicPage, PublicPageHeading } from "@/components/PublicPage";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — ScholarDesk" },
      {
        name: "description",
        content: "View ScholarDesk starting prices and learn how quotes work.",
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["public-data"],
    queryFn: () => getPublicDataFn(),
  });
  const services = data?.services ?? [];
  const showPrices = data?.showPrices ?? true;

  return (
    <PublicPage>
      <section className="bg-secondary px-5 py-20 sm:py-24">
        <PublicPageHeading eyebrow="Pricing" title="Clear prices, no surprises" />
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Final quotes depend on the deadline and complexity. You review and approve the price
          before paying.
        </p>
        <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading prices…</p>
          ) : isError ? (
            <p className="text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : "Could not load prices. Refresh to try again."}
            </p>
          ) : services.length ? (
            services.map((service) => (
              <article key={service.id} className="rounded-2xl border bg-card p-6 shadow-soft">
                <h2 className="text-lg font-semibold">{service.name}</h2>
                {showPrices && Number(service.base_price) > 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    {service.unit.startsWith("for ") ? "" : "From "}
                    <span className="font-display text-3xl font-semibold text-foreground">
                      {service.currency === "KES" ? "KSh " : "$"}
                      {Number(service.base_price).toFixed(0)}
                    </span>{" "}
                    {service.unit}
                  </p>
                ) : (
                  <p className="mt-4 font-medium text-primary">Price on request</p>
                )}
                <Link
                  to="/submit"
                  search={{ service: service.id }}
                  className="mt-5 inline-flex text-sm font-semibold text-primary hover:underline"
                >
                  Get a free quote →
                </Link>
              </article>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Prices are being updated. Please check back soon.
            </p>
          )}
        </div>
      </section>
    </PublicPage>
  );
}
