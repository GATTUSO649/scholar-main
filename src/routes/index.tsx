import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Upload,
  FileSearch,
  CreditCard,
  PackageCheck,
  ShieldCheck,
  Clock,
  Lock,
  MessageSquare,
  PenLine,
  Search,
  FileText,
  ClipboardList,
  Smartphone,
  Globe,
  Mail,
  Phone,
  Keyboard,
  ScanText,
  LayoutDashboard,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SiteHeader } from "@/components/SiteHeader";
import { Logo, BRAND } from "@/components/Logo";
import { getPublicDataFn } from "@/lib/backend";
import hero from "@/assets/hero.jpg";

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  base_price: number | string;
  currency: string;
  unit: string;
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ScholarDesk — Submit, Get Support, Track Everything" },
      {
        name: "description",
        content:
          "Upload your assignment, request typing, proofreading, plagiarism removal, project help and more, pay securely, and track every request.",
      },
      { property: "og:title", content: "ScholarDesk — Student Assignment Support" },
      {
        property: "og:description",
        content:
          "Expert, permitted academic support with secure payments and live request tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const ICONS = [PenLine, Search, FileText, Keyboard, ScanText, ClipboardList];

const steps = [
  {
    icon: Upload,
    t: "Submit your request",
    d: "Describe your task, set a deadline and upload your files.",
  },
  {
    icon: FileSearch,
    t: "Get a quote",
    d: "Our team reviews your request and sends a clear price.",
  },
  { icon: CreditCard, t: "Pay securely", d: "Pay by M-Pesa, card or other supported methods." },
  {
    icon: PackageCheck,
    t: "Track & receive",
    d: "Follow progress live and download your feedback.",
  },
];

const faqs = [
  [
    "What kind of support do you offer?",
    "Assignment typing, proofreading, plagiarism check and removal, project tasks, research guidance and draft reviews. You choose only what you need.",
  ],
  [
    "How is the price calculated?",
    "Each service has a base rate (per page, hour or slide). Urgent deadlines and complexity may adjust the final quote, which you approve before paying.",
  ],
  [
    "Which payment methods are accepted?",
    "M-Pesa for students in Kenya, plus Visa, Mastercard and other international methods in KES, USD, GBP and EUR.",
  ],
  [
    "Are my files private?",
    "Yes. Files are stored privately and only you and our support team can access them.",
  ],
  [
    "Can I track my request?",
    "Every request has a live status timeline in your dashboard, from submission to completion.",
  ],
];

function Home() {
  const [selected, setSelected] = useState<ServiceRow | null>(null);
  const { data: showPrices = true } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => (await getPublicDataFn()).showPrices,
  });
  const { data: services = [] } = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await getPublicDataFn()).services,
  });
  const SelectedIcon = selected
    ? ICONS[services.findIndex((s) => s.id === selected.id) % ICONS.length]!
    : null;

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-hero text-ink-foreground">
        <div className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-accent/25 blur-3xl animate-blob" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-[28rem] w-[28rem] rounded-full bg-info/25 blur-3xl animate-blob [animation-delay:-6s]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-24 pt-32 md:grid-cols-[1.05fr_1fr] md:pb-32 md:pt-40">
          <div className="animate-rise">
            <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-ink-foreground/90">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Tutors online now · Replies in under 1 hour
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-[4.2rem]">
              Submit Your Assignment. Get Expert Academic Support.{" "}
              <span className="text-gradient-gold italic">Track Everything.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base text-ink-foreground/75 sm:text-lg">
              Upload your assignment, request typing, proofreading, plagiarism removal, project help
              and more, make secure payments, and track your request from anywhere.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button
                asChild
                variant="hero"
                size="lg"
                className="h-12 px-7 text-base transition-transform hover:-translate-y-0.5"
              >
                <Link to="/submit">Submit a request →</Link>
              </Button>
              <Button asChild variant="heroOutline" size="lg" className="h-12 px-7 text-base">
                <Link to="/auth" search={{ mode: "register" }}>
                  Create free account
                </Link>
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-4">
              <div className="flex -space-x-2">
                {["AM", "KO", "JN", "WR"].map((n, i) => (
                  <span
                    key={n}
                    className={`grid h-9 w-9 place-items-center rounded-full border-2 border-ink text-[11px] font-bold ${["bg-accent text-accent-foreground", "bg-info text-info-foreground", "bg-success text-success-foreground", "bg-ink-foreground text-ink"][i]}`}
                  >
                    {n}
                  </span>
                ))}
              </div>
              <div className="text-sm">
                <p className="text-accent">
                  ★★★★★ <span className="text-ink-foreground">4.9/5</span>
                </p>
                <p className="text-ink-foreground/60">from 1,200+ students</p>
              </div>
            </div>
          </div>
          <div className="relative animate-rise [animation-delay:.15s]">
            <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-tr from-accent/50 via-transparent to-info/40 blur-xl" />
            <img
              src={hero}
              alt="Student studying at a desk in the evening"
              width={1280}
              height={1024}
              className="relative aspect-[5/4] w-full rounded-3xl object-cover shadow-2xl ring-1 ring-ink-foreground/10"
            />
            <div className="absolute -bottom-7 -left-4 rounded-2xl bg-card p-4 text-card-foreground shadow-soft animate-float sm:-left-10">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-9 w-9 text-success" />
                <div>
                  <p className="text-xs text-muted-foreground">REQ-8F21A0</p>
                  <p className="text-sm font-semibold">Proofreading completed</p>
                </div>
              </div>
            </div>
            <div className="glass absolute -right-3 -top-6 rounded-2xl p-4 animate-float [animation-delay:-3s] sm:-right-8">
              <p className="text-xs text-ink-foreground/70">Paid via M-Pesa</p>
              <p className="font-display text-2xl font-semibold text-ink-foreground">KES 1,850</p>
              <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-ink-foreground/15">
                <div className="h-full w-3/4 rounded-full bg-accent" />
              </div>
              <p className="mt-1 text-[11px] text-ink-foreground/60">In progress · 75%</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="relative border-t border-ink-foreground/10">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-8 md:grid-cols-4">
            {[
              ["12k+", "Requests completed"],
              ["98%", "On-time delivery"],
              ["40+", "Subjects covered"],
              ["24/7", "Request tracking"],
            ].map(([v, l]) => (
              <div key={l}>
                <p className="font-display text-3xl font-semibold text-gradient-gold sm:text-4xl">
                  {v}
                </p>
                <p className="text-sm text-ink-foreground/60">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subjects marquee */}
      <div className="overflow-hidden border-b bg-card py-5">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-display text-xl text-muted-foreground">
          {[...Array(2)].flatMap((_, k) =>
            [
              "Nursing",
              "Business",
              "Computer Science",
              "Economics",
              "Law",
              "Engineering",
              "Psychology",
              "Accounting",
              "Education",
              "Statistics",
              "Literature",
              "Public Health",
            ].map((s) => (
              <span key={s + k} className="flex items-center gap-10">
                {s}
                <span className="text-accent">✦</span>
              </span>
            )),
          )}
        </div>
      </div>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-24">
        <SectionTitle eyebrow="How it works" title="From upload to feedback in four steps" />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div
              key={s.t}
              className="group relative rounded-3xl border bg-card p-7 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-accent hover:shadow-glow"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="font-display text-4xl text-accent/60">0{i + 1}</span>
              </div>
              <h3 className="mt-6 text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services + pricing */}
      <section id="services" className="bg-secondary py-20">
        <div className="mx-auto max-w-6xl px-5">
          <SectionTitle eyebrow="Services" title="Support that helps you learn" />
          <div id="pricing" className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s, i) => {
              const Icon = ICONS[i % ICONS.length]!;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s)}
                  aria-label={`View details for ${s.name}`}
                  className="group flex cursor-pointer flex-col rounded-3xl border bg-card p-7 text-left shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-accent hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Icon className="h-6 w-6 text-accent" />
                  <h3 className="mt-4 text-xl font-semibold">{s.name}</h3>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{s.description}</p>
                  {showPrices && Number(s.base_price) > 0 ? (
                    <p className="mt-6 text-sm text-muted-foreground">
                      {s.unit.startsWith("for ") ? "" : "From "}
                      <span className="font-display text-2xl font-semibold text-foreground">
                        {s.currency === "KES" ? "KSh " : "$"}
                        {Number(s.base_price).toFixed(0)}
                      </span>{" "}
                      {s.unit}
                    </p>
                  ) : (
                    <p className="mt-6 text-sm font-medium text-accent">
                      Price on request — get a free quote
                    </p>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">
                    View details{" "}
                    <span className="transition-transform duration-300 group-hover:translate-x-1">
                      →
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Final prices depend on deadline and complexity. You approve every quote before paying.
          </p>
        </div>
      </section>

      {/* Service detail popup */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-md rounded-3xl border-accent/40 p-0 overflow-hidden">
          {selected && SelectedIcon && (
            <div>
              <div className="bg-hero px-7 pb-7 pt-9 text-ink-foreground">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-glow">
                  <SelectedIcon className="h-7 w-7" />
                </div>
                <DialogHeader className="mt-5 space-y-2 text-left">
                  <DialogTitle className="text-2xl font-semibold text-ink-foreground">
                    {selected.name}
                  </DialogTitle>
                  <DialogDescription className="text-sm leading-relaxed text-ink-foreground/75">
                    {selected.description}
                  </DialogDescription>
                </DialogHeader>
                {showPrices && Number(selected.base_price) > 0 && (
                  <p className="mt-4 text-sm text-ink-foreground/85">
                    {selected.unit.startsWith("for ") ? "" : "From "}
                    <span className="font-display text-3xl font-semibold text-gradient-gold">
                      {selected.currency === "KES" ? "KSh " : "$"}
                      {Number(selected.base_price).toFixed(0)}
                    </span>{" "}
                    {selected.unit}
                  </p>
                )}
              </div>
              <div className="px-7 py-6">
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {[
                    "Submit your task with a clear deadline",
                    "We review it and send you a free quote",
                    "You approve the quote, then pay securely",
                    "Track progress live and download the finished work",
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {line}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-6 w-full h-11 text-base">
                  <Link to="/submit" search={{ service: selected.id }}>
                    Request this service →
                  </Link>
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  No payment needed to get a quote.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Why + payments + dashboard */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <SectionTitle eyebrow="Why choose us" title="Built for students, everywhere" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Clock,
              t: "On-time delivery",
              d: "Set your deadline and preferred completion date — we plan around it.",
            },
            {
              icon: Lock,
              t: "Private & secure",
              d: "Your files and details are visible only to you and our support team.",
            },
            {
              icon: MessageSquare,
              t: "Real people",
              d: "Qualified tutors and editors review every request.",
            },
            {
              icon: Smartphone,
              t: "M-Pesa payments",
              d: "Pay directly from your phone with an STK push.",
            },
            {
              icon: Globe,
              t: "International cards",
              d: "Visa, Mastercard and more in KES, USD, GBP and EUR.",
            },
            {
              icon: LayoutDashboard,
              t: "Student dashboard",
              d: "See every request, payment and update in one place.",
            },
          ].map((f) => (
            <div key={f.t} className="flex gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/20">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{f.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative overflow-hidden bg-hero py-24 text-ink-foreground">
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-accent/20 blur-3xl animate-blob" />
        <div className="relative mx-auto max-w-6xl px-5">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Student stories
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Loved by students who hate stress
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              [
                "The tracking is amazing — I always knew exactly where my request was. Feedback came a day early.",
                "Amina M.",
                "Nursing, Year 3",
              ],
              [
                "Paid with M-Pesa in seconds. The proofreading made my report so much clearer.",
                "Kevin O.",
                "Business, Year 2",
              ],
              [
                "My tutor explained statistics better than any lecture. Worth every shilling.",
                "Joy N.",
                "Economics, Year 4",
              ],
            ].map(([q, n, c], i) => (
              <figure
                key={n}
                className={`glass rounded-3xl p-7 transition-transform duration-300 hover:-translate-y-1 ${i === 1 ? "md:-translate-y-4" : ""}`}
              >
                <p className="text-accent">★★★★★</p>
                <blockquote className="mt-4 font-display text-lg leading-relaxed">“{q}”</blockquote>
                <figcaption className="mt-6 text-sm">
                  <span className="font-semibold">{n}</span>
                  <span className="text-ink-foreground/60"> · {c}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-secondary py-20">
        <div className="mx-auto max-w-3xl px-5">
          <SectionTitle eyebrow="FAQ" title="Frequently asked questions" />
          <Accordion type="single" collapsible className="mt-10">
            {faqs.map(([q, a]) => (
              <AccordionItem key={q} value={q!}>
                <AccordionTrigger className="text-left text-base">{q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Contact / CTA */}
      <section id="contact" className="bg-hero text-ink-foreground">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold sm:text-4xl">Ready to get started?</h2>
            <p className="mt-4 text-ink-foreground/75">
              Create a free account and submit your first request in minutes.
            </p>
            <Button asChild variant="hero" size="lg" className="mt-8">
              <Link to="/auth" search={{ mode: "register" }}>
                Create my account
              </Link>
            </Button>
          </div>
          <div className="space-y-4 text-ink-foreground/85">
            <h3 className="text-xl font-semibold text-ink-foreground">Contact support</h3>
            <p className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-accent" /> support@scholardesk.app
            </p>
            <p className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-accent" /> +254 700 000 000
            </p>
            <p className="text-sm text-ink-foreground/60">Mon–Sat, 8:00–20:00 EAT</p>
          </div>
        </div>
        <div className="border-t border-ink-foreground/10">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 text-sm text-ink-foreground/60 sm:flex-row">
            <Logo light />
            <p>
              © {new Date().getFullYear()} {BRAND}. Academic support within integrity guidelines.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">{title}</h2>
    </div>
  );
}
