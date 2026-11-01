import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { logoutFn } from "@/lib/backend";
import { useIsAdmin, useUser } from "@/lib/auth";

const navigation = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/services", label: "Services" },
  { to: "/library", label: "Library" },
  { to: "/pricing", label: "Pricing" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader({ overlay = true }: { overlay?: boolean }) {
  const { user } = useUser();
  const { data: isAdmin, isLoading: adminLoading, isError: adminStateError } = useIsAdmin(user?.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function switchAccount() {
    if (switchingAccount) return;
    setSwitchingAccount(true);
    try {
      await queryClient.cancelQueries();
      await logoutFn();
      queryClient.clear();
      await navigate({ to: "/auth", search: { mode: "login" }, replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not switch accounts.");
    } finally {
      setSwitchingAccount(false);
    }
  }

  return (
    <header
      className={
        overlay
          ? "fixed inset-x-0 top-0 z-20 bg-[#17263c]/95 text-ink-foreground shadow-md backdrop-blur"
          : "sticky inset-x-0 top-0 z-30 bg-hero text-ink-foreground shadow-md"
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
                {adminStateError ? "Account unavailable" : "Checking account…"}
              </Button>
            ) : isAdmin ? (
              <Button
                type="button"
                variant="heroOutline"
                size="sm"
                disabled={switchingAccount}
                onClick={() => void switchAccount()}
              >
                {switchingAccount ? "Signing out…" : "Switch account"}
              </Button>
            ) : (
              <Button asChild variant="hero" size="sm">
                <Link to="/dashboard">My dashboard</Link>
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
