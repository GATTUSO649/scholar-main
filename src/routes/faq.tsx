import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PublicPage, PublicPageHeading } from "@/components/PublicPage";
import { getPublicSiteContentFn } from "@/lib/backend";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Frequently asked questions — ScholarDesk" },
      {
        name: "description",
        content: "Answers to common questions about ScholarDesk services, payments and privacy.",
      },
    ],
  }),
  component: FAQPage,
});

function FAQPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-site-content"],
    queryFn: () => getPublicSiteContentFn(),
  });

  return (
    <PublicPage>
      <section className="bg-secondary px-5 py-20 sm:py-24">
        <PublicPageHeading eyebrow="FAQ" title={data?.faqTitle ?? "Frequently asked questions"} />
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          {data?.faqIntro ??
            "Answers to common questions about ScholarDesk services, payments and privacy."}
        </p>
        <div className="mx-auto mt-10 max-w-3xl rounded-2xl border bg-card px-6">
          {isLoading ? (
            <p className="py-6 text-sm text-muted-foreground">Loading answers…</p>
          ) : isError ? (
            <p className="py-6 text-sm text-destructive">
              Could not load answers. Refresh to retry.
            </p>
          ) : data?.faqs.length ? (
            <Accordion type="single" collapsible>
              {data.faqs.map((entry) => (
                <AccordionItem key={entry.id} value={entry.id}>
                  <AccordionTrigger className="text-left text-base">
                    {entry.question}
                  </AccordionTrigger>
                  <AccordionContent className="whitespace-pre-line text-muted-foreground">
                    {entry.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="py-6 text-sm text-muted-foreground">
              No answers have been published yet. Contact support if you need help.
            </p>
          )}
        </div>
      </section>
    </PublicPage>
  );
}
