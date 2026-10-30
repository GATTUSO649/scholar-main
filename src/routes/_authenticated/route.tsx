import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard,
  FilePlus2,
  FolderOpen,
  User,
  LifeBuoy,
  LogOut,
  Users,
  BookOpen,
  FileText,
  BriefcaseBusiness,
  ClipboardList,
  ExternalLink,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Banknote,
  FilePenLine,
} from "lucide-react";
import { getAdminStateFn, getCurrentUserFn, logoutFn } from "@/lib/backend";
import { adminWorkspaceRedirectFor, useProfile } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { PortalFooter } from "@/components/PublicPage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUserFn();
    if (!user) {
      if (location.pathname.startsWith("/admin")) throw redirect({ to: "/admin/login" });
      throw redirect({ to: "/auth", search: { mode: "login" } });
    }
    const isAdmin = await getAdminStateFn();
    const redirectTo = adminWorkspaceRedirectFor(isAdmin, location.pathname);
    if (redirectTo) throw redirect({ to: redirectTo });
    return { user, isAdmin };
  },
  component: Shell,
});

const studentNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/submit", label: "Submit request", icon: FilePlus2 },
  { to: "/requests", label: "My requests", icon: FolderOpen },
  { to: "/portal/library", label: "Library", icon: BookOpen },
  { to: "/profile", label: "Account & profile", icon: User },
  { to: "/support", label: "Help & support", icon: LifeBuoy },
] as const;

const adminNav = [
  { to: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/admin", label: "Service requests", icon: ClipboardList },
  { to: "/admin/payments", label: "M-PESA payments", icon: Banknote },
  { to: "/students", label: "Students", icon: Users },
  { to: "/admin/resources", label: "Library", icon: BookOpen },
  { to: "/admin/resources/articles", label: "Articles", icon: FileText },
  { to: "/admin/resources/novels", label: "Novels", icon: BookOpen },
  { to: "/admin/resources/business-plans", label: "Business plans", icon: BriefcaseBusiness },
  { to: "/admin/pricing", label: "Public pricing", icon: Banknote },
  { to: "/admin/content", label: "Website content", icon: FilePenLine },
  { to: "/admin/profile", label: "Admin profile", icon: User },
] as const;

function Shell() {
  const { user, isAdmin } = Route.useRouteContext();
  const { data: profile } = useProfile(user.id);
  const [open, setOpen] = useState(false);
  const [leavingPortal, setLeavingPortal] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const inAdminArea =
    isAdmin &&
    (path.startsWith("/admin") || path.startsWith("/students") || path.startsWith("/manage"));
  const pageTitle = path.startsWith("/admin/dashboard")
    ? "Operations overview"
    : path === "/admin/payments"
      ? "M-PESA transactions"
      : path === "/admin/resources/articles"
        ? "Article library"
        : path === "/admin/resources/novels"
          ? "Novel library"
          : path === "/admin/resources/business-plans"
            ? "Business plan library"
            : path.startsWith("/admin/resources")
              ? "Library management"
              : path === "/admin/content"
                ? "Website content"
                : path === "/admin/pricing"
                  ? "Service pricing"
                  : path === "/admin/profile"
                    ? "Admin profile"
                    : path.startsWith("/students")
                      ? "Student directory"
                      : path.startsWith("/manage")
                        ? "Request workspace"
                        : "Service requests";

  async function leavePortal(to: "/" | "/auth") {
    if (leavingPortal) return;
    setLeavingPortal(true);
    try {
      await qc.cancelQueries();
      await logoutFn();
      qc.clear();
      qc.setQueryData(["current-user"], null);
      if (to === "/auth") {
        await navigate({ to, search: { mode: "login" }, replace: true });
      } else {
        await navigate({ to, replace: true });
      }
    } catch (error) {
      console.error("Could not close the portal session.", error);
      toast.error("Could not safely leave the portal. Please try again.");
    } finally {
      setLeavingPortal(false);
    }
  }

  function handlePublicNavigation(event: React.MouseEvent<HTMLAnchorElement>) {
    setOpen(false);
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    void leavePortal("/");
  }

  const NavLinks = ({ admin = false }: { admin?: boolean }) => (
    <nav
      aria-label={admin ? "Admin navigation" : "Student navigation"}
      className="flex flex-1 flex-col gap-1"
    >
      {!admin &&
        studentNav.map((n) => (
          <NavItem
            key={n.to}
            {...n}
            active={path === n.to || (n.to !== "/dashboard" && path.startsWith(n.to))}
            onClick={() => setOpen(false)}
          />
        ))}
      {admin && (
        <>
          <p className="mb-2 mt-3 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7d8b86]">
            Student support
          </p>
          {adminNav.map((n) => (
            <NavItem
              key={n.to}
              {...n}
              active={
                n.to === "/admin"
                  ? path === "/admin" || path.startsWith("/manage")
                  : n.to === "/students"
                    ? path.startsWith("/students")
                    : n.to === "/admin/resources"
                      ? path === "/admin/resources"
                      : path === n.to
              }
              onClick={() => setOpen(false)}
              admin
            />
          ))}
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="mt-5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#60706a] transition-colors hover:bg-[#f1f6f3] hover:text-[#155b4c]"
          >
            <ExternalLink className="h-4 w-4" /> Public website
          </a>
        </>
      )}
      <button
        onClick={() => void leavePortal("/auth")}
        disabled={leavingPortal}
        className={cn(
          "mt-auto flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors disabled:cursor-wait disabled:opacity-60",
          admin
            ? "text-[#60706a] hover:bg-[#fff1ee] hover:text-[#a64233]"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
        )}
      >
        <LogOut className="h-4 w-4" /> Logout
      </button>
    </nav>
  );

  if (inAdminArea) {
    const adminLinks = (
      <div className="flex h-full flex-col bg-[#fbfcfa]">
        <div className="border-b border-[#e4ebe6] px-5 py-5">
          <Logo onClick={handlePublicNavigation} />
          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-[#6e8179]">
            <Sparkles className="h-3.5 w-3.5 text-[#b57c36]" /> Service workspace
          </div>
          <div className="mt-5 flex items-center gap-3 rounded-lg border border-[#e4ebe6] bg-white p-3">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-[#e5f1eb] text-xs font-bold text-[#155b4c]">
              {profile?.full_name
                ?.split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase() ?? "AD"}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[#183c34]">
                {profile?.full_name || "Administrator"}
              </span>
              <span className="block truncate text-xs text-[#75847e]">Operations team</span>
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col px-3 py-3">
          <NavLinks admin />
          <div className="mt-auto border-t border-[#e4ebe6] px-3 pt-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#426c5e]">
              <span className="h-2 w-2 rounded-full bg-[#3b9b70]" /> Workspace active
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[#7d8984]">
              Student records and files remain private.
            </p>
          </div>
        </div>
      </div>
    );
    return (
      <div className="min-h-screen bg-[#f2f5f2] lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen flex-col border-r border-[#e4ebe6] bg-[#fbfcfa] lg:flex">
          {adminLinks}
        </aside>
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#e4ebe6] bg-[#fbfcfa] px-4 py-3 lg:hidden">
          <div>
            <Logo onClick={handlePublicNavigation} />
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#71817a]">
              Service workspace
            </p>
          </div>
          <div className="flex items-center gap-1 text-[#183c34]">
            <NotificationBell />
            <ProfileShortcut
              name={profile?.full_name}
              to="/admin/profile"
              className="text-[#183c34] hover:bg-[#eaf2ed]"
            />
            <button
              onClick={() => setOpen(!open)}
              className="rounded-lg p-2 text-[#183c34] hover:bg-[#eaf2ed]"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>
        {open && (
          <div className="fixed inset-x-0 bottom-0 top-18 z-20 border-t border-[#e4ebe6] bg-[#fbfcfa] p-4 lg:hidden">
            {adminLinks}
          </div>
        )}
        <main className="min-w-0">
          <div className="sticky top-0 z-10 hidden h-19 items-center justify-between border-b border-[#e4ebe6] bg-white/95 px-8 backdrop-blur lg:flex">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7c8983]">
                ScholarDesk <ChevronRight className="mx-1 inline h-3 w-3" /> Operations
              </p>
              <p className="mt-1 text-sm font-semibold text-[#183c34]">{pageTitle}</p>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <ProfileShortcut
                name={profile?.full_name}
                to="/admin/profile"
                className="text-[#183c34] hover:bg-[#eaf2ed]"
              />
              <span className="inline-flex items-center gap-2 border-l border-[#e4ebe6] pl-3 text-xs font-medium text-[#71817a]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#398b68]" /> Secure admin
              </span>
            </div>
          </div>
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-7 sm:py-8 xl:px-10">
            <Outlet />
            <PortalFooter />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-8 bg-sidebar p-5 text-sidebar-foreground lg:flex">
        <Logo light onClick={handlePublicNavigation} />
        <NavLinks />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 lg:hidden">
        <Logo light />
        <div className="flex items-center gap-1 text-sidebar-foreground">
          <NotificationBell />
          <ProfileShortcut
            name={profile?.full_name}
            to="/profile"
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          />
          <button
            onClick={() => setOpen(!open)}
            className="rounded-lg p-2 hover:bg-sidebar-accent"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      {open && (
        <div className="fixed inset-0 top-14 z-20 flex flex-col bg-sidebar p-5 text-sidebar-foreground lg:hidden">
          <NavLinks />
        </div>
      )}

      <main className="min-w-0">
        <div className="sticky top-0 z-10 hidden h-18 items-center justify-between border-b bg-white/95 px-8 backdrop-blur lg:flex">
          <div className="text-sm text-muted-foreground">
            Welcome back,{" "}
            <span className="font-semibold text-foreground">{profile?.full_name}</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ProfileShortcut
              name={profile?.full_name}
              to="/profile"
              className="text-foreground hover:bg-muted"
            />
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
          <p className="mb-1 text-sm text-muted-foreground">{profile?.email}</p>
          <Outlet />
          <PortalFooter />
        </div>
      </main>
    </div>
  );
}

function ProfileShortcut({
  name,
  to,
  className,
}: {
  name?: string | null | undefined;
  to: "/admin/profile" | "/profile";
  className: string;
}) {
  const initials =
    name
      ?.trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "P";

  return (
    <Link
      to={to}
      aria-label="Open profile"
      title="Profile"
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors",
        className,
      )}
    >
      {initials}
    </Link>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
  onClick,
  admin = false,
}: {
  to: string;
  label: string;
  icon: typeof User;
  active: boolean;
  onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  admin?: boolean;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
        active
          ? admin
            ? "bg-[#e5f1eb] font-semibold text-[#155b4c]"
            : "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
          : admin
            ? "text-[#5f7069] hover:bg-[#f0f5f2] hover:text-[#183c34]"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}
