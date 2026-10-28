import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPage, PublicPageHeading } from "@/components/PublicPage";
import { getPublicSiteContentFn } from "@/lib/backend";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact ScholarDesk" },
      {
        name: "description",
        content: "Contact ScholarDesk support for help with services and requests.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { data } = useQuery({
    queryKey: ["public-site-content"],
    queryFn: () => getPublicSiteContentFn(),
  });
  const email = data?.contactEmail ?? "support@scholardesk.app";
  const phone = data?.contactPhone ?? "+254 700 000 000";
  const phoneHref = phone.replace(/[^\d+]/g, "");
  const whatsapp = data?.contactWhatsapp ?? "";
  const whatsappHref = whatsapp.replace(/\D/g, "");

  return (
    <PublicPage>
      <section className="bg-secondary px-5 py-20 sm:py-24">
        <PublicPageHeading eyebrow="Contact" title="We’re here to help" />
        <div className="mx-auto mt-12 grid max-w-4xl gap-8 rounded-3xl border bg-card p-7 shadow-soft sm:grid-cols-2 sm:p-10">
          <div>
            <h2 className="text-xl font-semibold">Contact support</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Have a question about a service or an existing request? Reach out to our support team.
            </p>
            {email && (
              <a
                href={`mailto:${email}`}
                className="mt-6 flex items-center gap-3 break-all text-sm font-medium hover:text-primary"
              >
                <Mail className="h-5 w-5 shrink-0 text-accent" />
                {email}
              </a>
            )}
            {phone && phoneHref && (
              <a
                href={`tel:${phoneHref}`}
                className="mt-4 flex items-center gap-3 text-sm font-medium hover:text-primary"
              >
                <Phone className="h-5 w-5 shrink-0 text-accent" />
                {phone}
              </a>
            )}
            {whatsapp && whatsappHref && (
              <a
                href={`https://wa.me/${whatsappHref}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex items-center gap-3 text-sm font-medium hover:text-primary"
              >
                <MessageCircle className="h-5 w-5 shrink-0 text-accent" />
                WhatsApp support
              </a>
            )}
            {data?.supportHours && (
              <p className="mt-4 text-sm text-muted-foreground">{data.supportHours}</p>
            )}
          </div>
          <div className="flex flex-col items-start justify-center rounded-2xl bg-secondary p-6">
            <h2 className="text-xl font-semibold">Ready to get started?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create an account and submit your first request in minutes.
            </p>
            <Button asChild className="mt-6">
              <Link to="/auth" search={{ mode: "register" }}>
                Create my account
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
