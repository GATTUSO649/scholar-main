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
import {
  LayoutDashboard,
  FilePlus2,
  FolderOpen,
  User,
  LifeBuoy,
  LogOut,
  Shield,
  Users,
  Menu,
  X,
} from "lucide-react";
import { getCurrentUserFn, logoutFn } from "@/lib/backend";
import { useIsAdmin, useProfile } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getCurrentUserFn();
    if (!user) throw redirect({ to: "/auth", search: { mode: "login" } });
    return { user };
  },
  component: Shell,
});

const studentNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/submit", label: "Submit request", icon: FilePlus2 },
  { to: "/requests", label: "My requests", icon: FolderOpen },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/support", label: "Help & support", icon: LifeBuoy },
] as const;

const adminNav = [
  { to: "/admin/dashboard", label: "Admin dashboard", icon: LayoutDashboard },
  { to: "/admin", label: "All requests", icon: Shield },
  { to: "/students", label: "Students", icon: Users },
] as const;

function Shell() {
  const { user } = Route.useRouteContext();
  const { data: profile } = useProfile(user.id);
  const { data: isAdmin } = useIsAdmin(user.id);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await logoutFn();
    qc.setQueryData(["current-user"], null);
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }

  const NavLinks = () => (
    <nav className="flex flex-1 flex-col gap-1">
      {studentNav.map((n) => (
        <NavItem
          key={n.to}
          {...n}
          active={path === n.to || (n.to !== "/dashboard" && path.startsWith(n.to))}
          onClick={() => setOpen(false)}
        />
      ))}
      {isAdmin && (
        <>
          <p className="mt-6 px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
            Admin
          </p>
          {adminNav.map((n) => (
            <NavItem
              key={n.to}
              {...n}
              active={
                n.to === "/admin"
                  ? path === "/admin" || path.startsWith("/manage")
                  : path.startsWith(n.to)
              }
              onClick={() => setOpen(false)}
            />
          ))}
        </>
      )}
      <button
        onClick={signOut}
        className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent"
      >
        <LogOut className="h-4 w-4" /> Logout
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-8 bg-sidebar p-5 text-sidebar-foreground lg:flex">
        <Logo light />
        <NavLinks />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 lg:hidden">
        <Logo light />
        <button
          onClick={() => setOpen(!open)}
          className="text-sidebar-foreground"
          aria-label="Menu"
        >
          {open ? <X /> : <Menu />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 top-14 z-20 flex flex-col bg-sidebar p-5 text-sidebar-foreground lg:hidden">
          <NavLinks />
        </div>
      )}

      <main className="min-w-0">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
          <p className="mb-1 text-sm text-muted-foreground">{profile?.email}</p>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  to: string;
  label: string;
  icon: typeof User;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
        active
          ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}
