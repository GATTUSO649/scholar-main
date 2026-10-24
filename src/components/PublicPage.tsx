import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo, BRAND } from "@/components/Logo";
import { SiteHeader } from "@/components/SiteHeader";

export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader overlay={false} />
      <main className="flex-1">{children}</main>
      <footer className="bg-hero text-ink-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-6 text-sm text-ink-foreground/60 sm:flex-row">
          <Logo light />
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
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
            <Link to="/contact" className="hover:text-white">
              Contact
            </Link>
          </div>
          <p>
            © {new Date().getFullYear()} {BRAND}
          </p>
        </div>
      </footer>
    </div>
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
