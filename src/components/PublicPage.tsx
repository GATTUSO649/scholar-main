import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock3, Mail, Phone } from "lucide-react";
import { Logo, BRAND } from "@/components/Logo";
import { SiteHeader } from "@/components/SiteHeader";
import { getPublicSiteContentFn } from "@/lib/backend";

const defaultFooterContent = {
  contactEmail: "support@scholardesk.app",
  contactPhone: "+254 700 000 000",
  contactWhatsapp: "",
  supportHours: "Mon-Sat, 8:00-20:00 EAT",
  footerMessage: "Thoughtful academic support, from first draft to final submission.",
  faqTitle: "Frequently asked questions",
  faqIntro: "Answers to common questions about ScholarDesk services, payments and privacy.",
  faqs: [],
};

export function PublicPage({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: ["public-site-content"],
    queryFn: () => getPublicSiteContentFn(),
  });
  const content = data ?? defaultFooterContent;
  const phoneHref = content.contactPhone.replace(/[^\d+]/g, "");
  const whatsappHref = content.contactWhatsapp.replace(/\D/g, "");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader overlay={false} />
      <main className="flex-1">{children}</main>
      <footer className="bg-[#0b1f3a] text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:grid-cols-2 sm:py-14 lg:grid-cols-[1.4fr_0.8fr_1fr]">
          <div>
            <Logo light />
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">{content.footerMessage}</p>
          </div>
          <nav aria-label="Footer navigation">
            <h2 className="text-xs font-semibold uppercase text-white/50">Explore</h2>
            <div className="mt-4 grid gap-3 text-sm text-white/75">
              <Link to="/how-it-works" className="hover:text-white">
                How it works
              </Link>
              <Link to="/services" className="hover:text-white">
                Services
              </Link>
              <Link to="/library" className="hover:text-white">
                Library
              </Link>
              <Link to="/pricing" className="hover:text-white">
                Pricing
              </Link>
              <Link to="/faq" className="hover:text-white">
                FAQ
              </Link>
            </div>
          </nav>
          <div>
            <h2 className="text-xs font-semibold uppercase text-white/50">Talk to our team</h2>
            <div className="mt-4 grid gap-3 text-sm text-white/75">
              {content.contactEmail && (
                <a
                  href={`mailto:${content.contactEmail}`}
                  className="flex min-w-0 items-center gap-2 hover:text-white"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="break-all">{content.contactEmail}</span>
                </a>
              )}
              {content.contactPhone && phoneHref && (
                <a href={`tel:${phoneHref}`} className="flex items-center gap-2 hover:text-white">
                  <Phone className="h-4 w-4 shrink-0" /> {content.contactPhone}
                </a>
              )}
              {content.contactWhatsapp && whatsappHref && (
                <a
                  href={`https://wa.me/${whatsappHref}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-white"
                >
                  <Phone className="h-4 w-4 shrink-0" /> WhatsApp support
                </a>
              )}
              {content.supportHours && (
                <p className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 shrink-0" /> {content.supportHours}
                </p>
              )}
              <Link to="/contact" className="mt-1 font-semibold text-white hover:underline">
                Contact support
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/15">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-4 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} {BRAND}
            </p>
            <p>Clear communication. Private support. Work you can trust.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function PortalFooter() {
  const { data } = useQuery({
    queryKey: ["public-site-content"],
    queryFn: () => getPublicSiteContentFn(),
  });
  const content = data ?? defaultFooterContent;
  const phoneHref = content.contactPhone.replace(/[^\d+]/g, "");

  return (
    <footer className="mt-10 border-t border-[#e4ebe6] py-5 text-xs text-[#71817a]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>{content.footerMessage}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {content.contactEmail && (
            <a href={`mailto:${content.contactEmail}`} className="hover:text-[#155b4c]">
              {content.contactEmail}
            </a>
          )}
          {content.contactPhone && phoneHref && (
            <a href={`tel:${phoneHref}`} className="hover:text-[#155b4c]">
              {content.contactPhone}
            </a>
          )}
          <Link to="/faq" className="hover:text-[#155b4c]">
            Help & FAQs
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function PublicPageHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{title}</h1>
    </div>
  );
}
