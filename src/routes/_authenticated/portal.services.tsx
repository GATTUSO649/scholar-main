import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BriefcaseBusiness } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicDataFn } from "@/lib/backend";

export const Route = createFileRoute("/_authenticated/portal/services")({
  head: () => ({ meta: [{ title: "Services — ScholarDesk" }] }),
  component: PortalServices,
});

function PortalServices() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-data"],
    queryFn: () => getPublicDataFn(),
  });
  const services = data?.services ?? [];

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Services</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Browse available academic support and start a request from your portal.
        </p>
      </header>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading services…</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load services. Refresh to try again.
        </p>
      ) : services.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => (
            <article key={service.id} className="flex flex-col rounded-lg border bg-card p-5">
              <BriefcaseBusiness className="h-5 w-5 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">{service.name}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                {service.description}
              </p>
              <Button asChild className="mt-5 w-full justify-between">
                <Link to="/submit" search={{ service: service.id }}>
                  Request this service <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Services are being updated. Check back soon.
        </p>
      )}
    </section>
  );
}
