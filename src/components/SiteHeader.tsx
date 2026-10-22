import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { dashboardRouteFor, useIsAdmin, useUser } from "@/lib/auth";

const navigation = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/services", label: "Services" },
  { to: "/pricing", label: "Pricing" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader({ overlay = true }: { overlay?: boolean }) {
  const { user } = useUser();
  const { data: isAdmin, isLoading: adminLoading, isError: adminStateError } = useIsAdmin(user?.id);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header
      className={
        overlay ? "absolute inset-x-0 top-0 z-20" : "relative z-20 bg-hero text-ink-foreground"
      }
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo light />
        <nav className="hidden items-center gap-7 text-sm text-ink-foreground/80 md:flex">
          {navigation.map((item) => (
            <Link key={item.to} to={item.to} className="hover:text-ink-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            adminLoading || adminStateError ? (
              <Button
                variant="hero"
                size="sm"
                disabled
                title={
                  adminStateError
                    ? "Could not verify administrator access. Refresh to try again."
                    : undefined
                }
              >
                {adminStateError ? "Dashboard unavailable" : "Loading dashboard…"}
              </Button>
            ) : (
              <Button asChild variant="hero" size="sm">
                <Link to={dashboardRouteFor(isAdmin === true)}>
                  {isAdmin ? "Admin dashboard" : "My dashboard"}
                </Link>
              </Button>
            )
          ) : (
            <>
              <Button asChild variant="heroOutline" size="sm" className="hidden sm:inline-flex">
                <Link to="/auth" search={{ mode: "login" }}>
                  Student login
                </Link>
              </Button>
              <Button asChild variant="hero" size="sm">
                <Link to="/auth" search={{ mode: "register" }}>
                  Register
                </Link>
              </Button>
            </>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-2 text-ink-foreground hover:bg-white/10 md:hidden"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="grid gap-1 border-t border-white/10 bg-[#17263c] px-5 py-3 text-sm text-white md:hidden">
          {navigation.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-2 hover:bg-white/10"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
