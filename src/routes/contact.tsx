import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPage, PublicPageHeading } from "@/components/PublicPage";

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
            <a
              href="mailto:support@scholardesk.app"
              className="mt-6 flex items-center gap-3 text-sm font-medium hover:text-primary"
            >
              <Mail className="h-5 w-5 text-accent" />
              support@scholardesk.app
            </a>
            <a
              href="tel:+254700000000"
              className="mt-4 flex items-center gap-3 text-sm font-medium hover:text-primary"
            >
              <Phone className="h-5 w-5 text-accent" />
              +254 700 000 000
            </a>
            <p className="mt-4 text-sm text-muted-foreground">Mon–Sat, 8:00–20:00 EAT</p>
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
