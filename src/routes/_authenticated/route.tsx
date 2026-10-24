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
  Shield,
  Users,
  BookOpen,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { getAdminStateFn, getCurrentUserFn, logoutFn } from "@/lib/backend";
import { useIsAdmin, useProfile } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUserFn();
    if (!user) throw redirect({ to: "/auth", search: { mode: "login" } });
    const isAdmin = await getAdminStateFn();
    const isAdminPage =
      location.pathname.startsWith("/admin") ||
      location.pathname.startsWith("/students") ||
      location.pathname.startsWith("/manage");
    if (isAdmin && !isAdminPage && location.pathname !== "/profile") {
      throw redirect({ to: "/admin/dashboard" });
    }
    return { user, isAdmin };
  },
  component: Shell,
});

const studentNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/submit", label: "Submit request", icon: FilePlus2 },
  { to: "/requests", label: "My requests", icon: FolderOpen },
  { to: "/library", label: "Library", icon: BookOpen },
  { to: "/profile", label: "Account & profile", icon: User },
  { to: "/support", label: "Help & support", icon: LifeBuoy },
] as const;

const adminNav = [
  { to: "/admin/dashboard", label: "Admin dashboard", icon: LayoutDashboard },
  { to: "/admin", label: "All requests", icon: Shield },
  { to: "/admin/resources", label: "Library", icon: BookOpen },
  { to: "/students", label: "Students", icon: Users },
] as const;

function Shell() {
  const { user } = Route.useRouteContext();
  const { data: profile } = useProfile(user.id);
  const { data: isAdmin } = useIsAdmin(user.id);
  const [open, setOpen] = useState(false);
  const [leavingPortal, setLeavingPortal] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const inAdminArea =
    !!isAdmin &&
    (path.startsWith("/admin") || path.startsWith("/students") || path.startsWith("/manage"));
  const pageTitle = path.startsWith("/admin/dashboard")
    ? "Dashboard"
    : path.startsWith("/admin/resources")
      ? "Library"
      : path.startsWith("/students")
        ? "Students"
        : path.startsWith("/manage")
          ? "Request workspace"
          : "All requests";

  async function leavePortal(to: "/" | "/library" | "/auth") {
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

  function handlePublicNavigation(
    event: React.MouseEvent<HTMLAnchorElement>,
    to: "/" | "/library",
  ) {
    setOpen(false);
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    void leavePortal(to);
  }

  const NavLinks = ({ admin = false }: { admin?: boolean }) => (
    <nav className="flex flex-1 flex-col gap-1">
      {!admin &&
        studentNav.map((n) => (
          <NavItem
            key={n.to}
            {...n}
            active={path === n.to || (n.to !== "/dashboard" && path.startsWith(n.to))}
            onClick={(event) => {
              if (n.to === "/library") handlePublicNavigation(event, "/library");
              else setOpen(false);
            }}
          />
        ))}
      {admin && (
        <>
          <p className="mb-2 mt-7 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
            Workspace
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
                      ? path.startsWith("/admin/resources")
                      : path.startsWith(n.to)
              }
              onClick={() => setOpen(false)}
              admin
            />
          ))}
        </>
      )}
      <button
        onClick={() => void leavePortal("/auth")}
        disabled={leavingPortal}
        className={cn(
          "mt-auto flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors disabled:cursor-wait disabled:opacity-60",
          admin
            ? "text-white/65 hover:bg-white/10 hover:text-white"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
        )}
      >
        <LogOut className="h-4 w-4" /> Logout
      </button>
    </nav>
  );

  if (inAdminArea) {
    const adminLinks = (
      <div className="flex h-full flex-col">
        <div className="border-b border-white/10 px-6 py-6">
          <Logo light onClick={(event) => handlePublicNavigation(event, "/")} />
          <div className="mt-7 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-xs font-bold text-accent-foreground">
              {profile?.full_name
                ?.split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase() ?? "AD"}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">
                {profile?.full_name || "Administrator"}
              </span>
              <span className="block truncate text-xs text-white/45">Admin workspace</span>
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col px-4 py-3">
          <NavLinks admin />
          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> System operational
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-white/40">
              Your private operations console.
            </p>
          </div>
        </div>
      </div>
    );
    return (
      <div className="min-h-screen bg-[#f5f7fa] lg:grid lg:grid-cols-[264px_1fr]">
        <aside className="sticky top-0 hidden h-screen flex-col bg-[#17263c] text-white lg:flex">
          {adminLinks}
        </aside>
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#17263c] px-4 py-3 text-white lg:hidden">
          <Logo light onClick={(event) => handlePublicNavigation(event, "/")} />
          <div className="flex items-center gap-1 text-white">
            <NotificationBell />
            <ProfileShortcut name={profile?.full_name} className="text-white hover:bg-white/10" />
            <button
              onClick={() => setOpen(!open)}
              className="rounded-lg p-2 text-white hover:bg-white/10"
              aria-label={open ? "Close menu" : "Open menu"}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>
        {open && (
          <div className="fixed inset-0 top-[57px] z-20 bg-[#17263c] p-4 text-white lg:hidden">
            {adminLinks}
          </div>
        )}
        <main className="min-w-0">
          <div className="sticky top-0 z-10 hidden h-[72px] items-center justify-between border-b border-white/10 bg-[#17263c] px-8 text-white lg:flex">
            <div className="flex items-center gap-2 text-sm text-white/65">
              <span>ScholarDesk</span>
              <ChevronRight className="h-4 w-4" />
              <span className="font-semibold text-white">{pageTitle}</span>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <ProfileShortcut name={profile?.full_name} className="text-white hover:bg-white/10" />
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70">
                <ShieldCheck className="h-3.5 w-3.5" /> Private workspace
              </span>
            </div>
          </div>
          <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-7 sm:py-8 xl:px-10">
            <Outlet />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-8 bg-sidebar p-5 text-sidebar-foreground lg:flex">
        <Logo light onClick={(event) => handlePublicNavigation(event, "/")} />
        <NavLinks />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 lg:hidden">
        <Logo light />
        <div className="flex items-center gap-1 text-sidebar-foreground">
          <NotificationBell />
          <ProfileShortcut
            name={profile?.full_name}
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
        <div className="sticky top-0 z-10 hidden h-[72px] items-center justify-between border-b bg-white/95 px-8 backdrop-blur lg:flex">
          <div className="text-sm text-muted-foreground">
            Welcome back,{" "}
            <span className="font-semibold text-foreground">{profile?.full_name}</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ProfileShortcut name={profile?.full_name} className="text-foreground hover:bg-muted" />
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
          <p className="mb-1 text-sm text-muted-foreground">{profile?.email}</p>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function ProfileShortcut({
  name,
  className,
}: {
  name?: string | null | undefined;
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
      to="/profile"
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
        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors",
        active
          ? admin
            ? "bg-accent font-semibold text-accent-foreground shadow-sm"
            : "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
          : admin
            ? "text-white/65 hover:bg-white/[0.07] hover:text-white"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}
