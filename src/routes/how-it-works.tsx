import { createFileRoute, Link } from "@tanstack/react-router";
import { CreditCard, FileSearch, PackageCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPage, PublicPageHeading } from "@/components/PublicPage";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — ScholarDesk" },
      {
        name: "description",
        content: "See how ScholarDesk takes your request from upload to feedback.",
      },
    ],
  }),
  component: HowItWorksPage,
});

const steps = [
  {
    icon: Upload,
    title: "Submit your request",
    description: "Describe your task, set a deadline and upload your files.",
  },
  {
    icon: FileSearch,
    title: "Get a quote",
    description: "Our team reviews your request and sends a clear price.",
  },
  {
    icon: CreditCard,
    title: "Pay securely",
    description: "Approve the quote and pay by M-Pesa, card or another supported method.",
  },
  {
    icon: PackageCheck,
    title: "Track and receive",
    description: "Follow progress in your dashboard and download your completed work.",
  },
];

function HowItWorksPage() {
  return (
    <PublicPage>
      <section className="bg-secondary px-5 py-20 sm:py-24">
        <PublicPageHeading eyebrow="How it works" title="From upload to feedback in four steps" />
        <div className="mx-auto mt-14 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-3xl border bg-card p-7 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
                  <step.icon className="h-5 w-5" />
                </span>
                <span className="font-display text-4xl text-accent/60">0{index + 1}</span>
              </div>
              <h2 className="mt-6 text-lg font-semibold">{step.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
            </article>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Button asChild size="lg">
            <Link to="/submit">Submit a request</Link>
          </Button>
        </div>
      </section>
    </PublicPage>
  );
}
