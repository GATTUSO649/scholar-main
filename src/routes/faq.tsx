import { createFileRoute } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PublicPage, PublicPageHeading } from "@/components/PublicPage";

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

const questions = [
  [
    "What kind of support do you offer?",
    "Assignment typing, proofreading, plagiarism checks, project tasks, research guidance and draft reviews. You choose only what you need.",
  ],
  [
    "How is the price calculated?",
    "Each service has a base rate. Urgent deadlines and complexity may adjust the final quote, which you approve before paying.",
  ],
  [
    "Which payment methods are accepted?",
    "M-Pesa for students in Kenya, plus Visa, Mastercard and other international methods in KES, USD, GBP and EUR.",
  ],
  [
    "Are my files private?",
    "Files are stored privately and only you and our support team can access them.",
  ],
  [
    "Can I track my request?",
    "Every request has a live status timeline in your dashboard, from submission to completion.",
  ],
];

function FAQPage() {
  return (
    <PublicPage>
      <section className="bg-secondary px-5 py-20 sm:py-24">
        <PublicPageHeading eyebrow="FAQ" title="Frequently asked questions" />
        <div className="mx-auto mt-10 max-w-3xl rounded-2xl border bg-card px-6">
          <Accordion type="single" collapsible>
            {questions.map(([question, answer]) => (
              <AccordionItem key={question} value={question!}>
                <AccordionTrigger className="text-left text-base">{question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </PublicPage>
  );
}
