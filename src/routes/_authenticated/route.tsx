import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard,
  FilePlus2,
  FolderOpen,
  PackageCheck,
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
  Sparkles,
  Banknote,
  FilePenLine,
  Building2,
} from "lucide-react";
import { getCurrentUserStateFn, logoutFn, refreshSessionActivityFn } from "@/lib/backend";
import {
  adminWorkspaceRedirectFor,
  broadcastAuthSessionChange,
  getSafeReturnTo,
  subscribeToAuthSessionChanges,
  useProfile,
} from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { PortalFooter } from "@/components/PublicPage";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  staleTime: 15_000,
  beforeLoad: async ({ location }) => {
    const { user, isAdmin, expiresAt } = await getCurrentUserStateFn();
    const returnTo = getSafeReturnTo(location.href, location.pathname);
    if (!user) {
      if (location.pathname.startsWith("/admin")) {
        throw redirect({ to: "/admin/login", search: { mode: "login", returnTo } });
      }
      throw redirect({ to: "/auth", search: { mode: "login", returnTo } });
    }
    const redirectTo = adminWorkspaceRedirectFor(isAdmin, location.pathname);
    if (redirectTo) throw redirect({ to: redirectTo });
    return { user, isAdmin, sessionExpiresAt: expiresAt };
  },
  component: Shell,
});

const studentNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/submit", label: "Submit request", icon: FilePlus2 },
  { to: "/requests", label: "My requests", icon: FolderOpen },
  { to: "/deliveries", label: "Deliveries", icon: PackageCheck },
  { to: "/portal/library", label: "Library", icon: BookOpen },
  { to: "/portal/services", label: "Services", icon: BriefcaseBusiness },
  { to: "/profile", label: "Account & profile", icon: User },
  { to: "/support", label: "Help & support", icon: LifeBuoy },
] as const;

const adminNavGroups = [
  {
    label: "Operations",
    items: [
      { to: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
      { to: "/admin", label: "Service requests", icon: ClipboardList },
      { to: "/admin/payments", label: "M-PESA payments", icon: Banknote },
      { to: "/students", label: "Students", icon: Users },
    ],
  },
  {
    label: "Library",
    items: [
      { to: "/admin/resources", label: "All resources", icon: BookOpen },
      { to: "/admin/resources/articles", label: "Articles", icon: FileText },
      { to: "/admin/resources/novels", label: "Novels", icon: BookOpen },
      { to: "/admin/resources/business-plans", label: "Business plans", icon: BriefcaseBusiness },
      { to: "/admin/resources/lesson-plans", label: "Lesson plans", icon: FileText },
      { to: "/admin/resources/working-schemes", label: "Schemes of work", icon: ClipboardList },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/admin/pricing", label: "Services & offers", icon: Banknote },
      { to: "/admin/content", label: "Website content", icon: FilePenLine },
      { to: "/admin/legal-documents", label: "Legal documents", icon: FileText },
      { to: "/admin/business-settings", label: "Business settings", icon: Building2 },
      { to: "/admin/profile", label: "Admin profile", icon: User },
    ],
  },
] as const;

const STUDENT_IDLE_TIMEOUT_MS = 20 * 60 * 1000;
const SESSION_ACTIVITY_HEARTBEAT_MS = 60 * 1000;
const STUDENT_ACTIVITY_CHANNEL = "scholardesk-student-activity";
const STUDENT_ACTIVITY_STORAGE_KEY = "scholardesk-student-activity";

function Shell() {
  const { user, isAdmin, sessionExpiresAt } = Route.useRouteContext();
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
            : path === "/admin/resources/lesson-plans"
              ? "Lesson plan library"
              : path === "/admin/resources/working-schemes"
                ? "Schemes of work library"
                : path.startsWith("/admin/resources")
                  ? "Library management"
                  : path === "/admin/content"
                    ? "Website content"
                    : path === "/admin/legal-documents"
                      ? "Legal documents"
                      : path === "/admin/pricing"
                        ? "Service pricing"
                        : path === "/admin/profile"
                          ? "Admin profile"
                          : path === "/admin/business-settings"
                            ? "Business settings"
                            : path.startsWith("/students")
                              ? "Student directory"
                              : path.startsWith("/manage")
                                ? "Request workspace"
                                : "Service requests";

  useEffect(
    () =>
      subscribeToAuthSessionChanges(() => {
        qc.clear();
        window.location.reload();
      }),
    [qc],
  );

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  useEffect(() => setOpen(false), [path]);

  async function leavePortal(to: "/" | "/auth") {
    if (leavingPortal) return;
    setLeavingPortal(true);
    try {
      await qc.cancelQueries();
      await logoutFn();
      qc.clear();
      broadcastAuthSessionChange();
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

  useEffect(() => {
    if (!sessionExpiresAt || !isAdmin) return;
    const expiresAt = Date.parse(sessionExpiresAt);
    if (!Number.isFinite(expiresAt)) return;
    let signedOut = false;
    const signOutAtExpiry = async () => {
      if (signedOut || Date.now() < expiresAt) return;
      signedOut = true;
      try {
        await qc.cancelQueries();
        await logoutFn();
      } catch {
        // The server also rejects this session after its stored expiration.
      } finally {
        qc.clear();
        broadcastAuthSessionChange();
        const returnTo = getSafeReturnTo(
          window.location.href,
          isAdmin ? "/admin/dashboard" : "/dashboard",
        );
        if (isAdmin) {
          await navigate({
            to: "/admin/login",
            search: { mode: "login", returnTo },
            replace: true,
          });
        } else {
          await navigate({ to: "/auth", search: { mode: "login", returnTo }, replace: true });
        }
        toast.info("Your session expired. Sign in again to continue.");
      }
    };
    const warningDelay = Math.max(0, expiresAt - Date.now() - 5 * 60 * 1000);
    const expiryDelay = Math.max(0, expiresAt - Date.now());
    const warningTimer = window.setTimeout(() => {
      if (Date.now() < expiresAt) {
        toast.warning(
          "Your session expires in five minutes. Save any work before signing in again.",
        );
      } else {
        void signOutAtExpiry();
      }
    }, warningDelay);
    const expiryTimer = window.setTimeout(() => void signOutAtExpiry(), expiryDelay);
    const checkOnFocus = () => {
      if (document.visibilityState === "visible") void signOutAtExpiry();
    };
    document.addEventListener("visibilitychange", checkOnFocus);
    return () => {
      window.clearTimeout(warningTimer);
      window.clearTimeout(expiryTimer);
      document.removeEventListener("visibilitychange", checkOnFocus);
    };
  }, [isAdmin, navigate, qc, sessionExpiresAt]);

  useEffect(() => {
    if (isAdmin) return;

    let idleTimer: number;
    let warningTimer: number;
    let lastHeartbeatAt = Date.now();
    let signedOut = false;
    let activityChannel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        activityChannel = new BroadcastChannel(STUDENT_ACTIVITY_CHANNEL);
      }
    } catch {
      activityChannel = null;
    }

    const signOutForInactivity = async () => {
      if (signedOut) return;
      signedOut = true;
      try {
        await qc.cancelQueries();
        await logoutFn();
      } catch {
        // Server-side idle expiry still rejects the session if logout cannot reach the server.
      } finally {
        qc.clear();
        broadcastAuthSessionChange();
        const returnTo = getSafeReturnTo(window.location.href, "/dashboard");
        await navigate({ to: "/auth", search: { mode: "login", returnTo }, replace: true });
        toast.info("You were signed out after 20 minutes of inactivity.");
      }
    };

    const resetIdleTimers = () => {
      window.clearTimeout(idleTimer);
      window.clearTimeout(warningTimer);
      toast.dismiss("student-idle-warning");
      warningTimer = window.setTimeout(
        () => {
          toast.warning("You’ll be signed out in one minute due to inactivity.", {
            id: "student-idle-warning",
          });
        },
        STUDENT_IDLE_TIMEOUT_MS - 60 * 1000,
      );
      idleTimer = window.setTimeout(() => void signOutForInactivity(), STUDENT_IDLE_TIMEOUT_MS);
    };

    const handleLocalActivity = () => {
      if (signedOut) return;
      resetIdleTimers();
      if (activityChannel) {
        activityChannel.postMessage(Date.now());
      } else {
        try {
          window.localStorage.setItem(STUDENT_ACTIVITY_STORAGE_KEY, String(Date.now()));
        } catch {
          // Cross-tab activity sync is optional when browser storage is unavailable.
        }
      }

      const now = Date.now();
      if (now - lastHeartbeatAt >= SESSION_ACTIVITY_HEARTBEAT_MS) {
        lastHeartbeatAt = now;
        void refreshSessionActivityFn().catch((error: unknown) => {
          if (error instanceof Error && /signed in|session|expired/i.test(error.message)) {
            void signOutForInactivity();
          }
        });
      }
    };

    const handleRemoteActivity = (event: MessageEvent<unknown>) => {
      if (!signedOut && typeof event.data === "number") resetIdleTimers();
    };
    const handleStorageActivity = (event: StorageEvent) => {
      if (event.key === STUDENT_ACTIVITY_STORAGE_KEY && event.newValue) resetIdleTimers();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") handleLocalActivity();
    };

    activityChannel?.addEventListener("message", handleRemoteActivity);
    window.addEventListener("storage", handleStorageActivity);
    document.addEventListener("pointerdown", handleLocalActivity, { passive: true });
    document.addEventListener("keydown", handleLocalActivity);
    document.addEventListener("touchstart", handleLocalActivity, { passive: true });
    document.addEventListener("scroll", handleLocalActivity, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    resetIdleTimers();

    return () => {
      window.clearTimeout(idleTimer);
      window.clearTimeout(warningTimer);
      toast.dismiss("student-idle-warning");
      activityChannel?.removeEventListener("message", handleRemoteActivity);
      activityChannel?.close();
      window.removeEventListener("storage", handleStorageActivity);
      document.removeEventListener("pointerdown", handleLocalActivity);
      document.removeEventListener("keydown", handleLocalActivity);
      document.removeEventListener("touchstart", handleLocalActivity);
      document.removeEventListener("scroll", handleLocalActivity);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isAdmin, navigate, qc]);

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
      className={cn(
        "flex flex-1 flex-col gap-1",
        admin && "min-h-0 overflow-y-auto overscroll-contain pr-1",
      )}
    >
      {!admin &&
        studentNav.map((item) => (
          <NavItem
            key={item.to}
            {...item}
            active={path === item.to || (item.to !== "/dashboard" && path.startsWith(item.to))}
            onClick={() => setOpen(false)}
          />
        ))}
      {admin && (
        <>
          {adminNavGroups.map((group) => (
            <div key={group.label} className="mb-3 space-y-1">
              <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a6c4b7]">
                {group.label}
              </p>
              {group.items.map((item) => (
                <NavItem
                  key={item.to}
                  {...item}
                  active={
                    item.to === "/admin"
                      ? path === "/admin" || path.startsWith("/manage")
                      : item.to === "/students"
                        ? path.startsWith("/students")
                        : path === item.to
                  }
                  onClick={() => setOpen(false)}
                  admin
                />
              ))}
            </div>
          ))}
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[#d0e0d9] transition-colors hover:bg-white/10 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" /> Public website
          </a>
        </>
      )}
      <button
        onClick={() => void leavePortal("/auth")}
        disabled={leavingPortal}
        className={cn(
          "mt-auto flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors disabled:cursor-wait disabled:opacity-60",
          admin
            ? "text-[#d0e0d9] hover:bg-[#793d49]/50 hover:text-white"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
        )}
      >
        <LogOut className="h-4 w-4" /> Logout
      </button>
    </nav>
  );

  if (inAdminArea) {
    const adminLinks = (
      <div className="flex h-full min-h-0 flex-col bg-[#17263c]">
        <div className="shrink-0 border-b border-white/10 px-5 py-5">
          <Logo light onClick={handlePublicNavigation} />
          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-[#b9c7d7]">
            <Sparkles className="h-3.5 w-3.5 text-[#b57c36]" /> Service workspace
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
          <NavLinks admin />
        </div>
      </div>
    );
    return (
      <div className="admin-workspace-shell min-h-screen bg-[#f2f6f3] lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen min-h-0 flex-col overflow-hidden border-r border-[#263f5e] bg-[#17263c] lg:flex">
          {adminLinks}
        </aside>
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#263f5e] bg-[#17263c] px-4 py-3 text-white lg:hidden">
          <div>
            <Logo light onClick={handlePublicNavigation} />
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#b9d1c5]">
              Service workspace
            </p>
            <p className="mt-1 text-xs font-medium text-white/90">{pageTitle}</p>
          </div>
          <div className="flex items-center gap-1 text-white">
            <NotificationBell />
            <ProfileShortcut
              name={profile?.full_name}
              to="/admin/profile"
              className="text-white hover:bg-white/10"
              onLogout={() => void leavePortal("/auth")}
              disabled={leavingPortal}
            />
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="rounded-lg p-2 text-white hover:bg-white/10"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-admin-navigation"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>
        {open && (
          <>
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/45 lg:hidden"
            />
            <div
              id="mobile-admin-navigation"
              role="dialog"
              aria-modal="true"
              aria-label="Admin navigation"
              className="fixed inset-y-0 left-0 z-50 h-dvh w-[min(22rem,50vw)] overflow-hidden border-r border-[#263f5e] bg-[#17263c] shadow-2xl lg:hidden"
            >
              <div className="flex h-full flex-col">
                <div className="flex shrink-0 justify-end border-b border-white/10 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close menu"
                    className="rounded-md p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="min-h-0 flex-1">{adminLinks}</div>
              </div>
            </div>
          </>
        )}
        <main className="admin-workspace-main flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-10 hidden h-17 items-center justify-between border-b border-[#263f5e] bg-[#17263c] px-8 text-white lg:flex">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
                ScholarDesk <ChevronRight className="mx-1 inline h-3 w-3" /> Admin workspace
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{pageTitle}</p>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <ProfileShortcut
                name={profile?.full_name}
                to="/admin/profile"
                className="text-white hover:bg-white/10"
                onLogout={() => void leavePortal("/auth")}
                disabled={leavingPortal}
              />
            </div>
          </div>
          <div className="admin-page-wrap mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-7 sm:py-8 xl:px-10">
            <Outlet />
            <PortalFooter />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-8 bg-sidebar p-5 text-sidebar-foreground lg:flex">
        <Logo light onClick={handlePublicNavigation} />
        <NavLinks />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#17263c] px-4 py-3 text-white lg:hidden">
        <Logo light />
        <div className="flex items-center gap-1 text-white">
          <NotificationBell />
          <ProfileShortcut
            name={profile?.full_name}
            to="/profile"
            className="text-white hover:bg-white/10"
            onLogout={() => void leavePortal("/auth")}
            disabled={leavingPortal}
          />
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="rounded-lg p-2 text-white hover:bg-white/10"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-student-navigation"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/45 lg:hidden"
          />
          <div
            id="mobile-student-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Student navigation"
            className="fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(22rem,50vw)] flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground shadow-2xl lg:hidden"
          >
            <div className="mb-5 flex shrink-0 items-center justify-between border-b border-sidebar-border pb-4">
              <Logo light onClick={handlePublicNavigation} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-md p-2 transition-colors hover:bg-sidebar-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks />
            <div className="mt-5 flex shrink-0 items-center gap-3 border-t border-sidebar-border pt-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sidebar-accent text-sm font-semibold">
                {profile?.full_name
                  ?.trim()
                  .split(/\s+/)
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() ?? "S"}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {profile?.full_name || "Student account"}
                </span>
                <span className="block truncate text-xs text-sidebar-foreground/70">
                  {profile?.email}
                </span>
              </span>
            </div>
          </div>
        </>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-10 hidden h-18 items-center justify-between border-b border-[#263f5e] bg-[#17263c] px-8 text-white lg:flex">
          <div className="text-sm text-white/70">
            Welcome back, <span className="font-semibold text-white">{profile?.full_name}</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ProfileShortcut
              name={profile?.full_name}
              to="/profile"
              className="text-white hover:bg-white/10"
              onLogout={() => void leavePortal("/auth")}
              disabled={leavingPortal}
            />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-10">
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
  onLogout,
  disabled,
}: {
  name?: string | null | undefined;
  to: "/admin/profile" | "/profile";
  className: string;
  onLogout: () => void;
  disabled: boolean;
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open profile menu"
          title="Profile and logout"
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors",
            className,
          )}
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link to={to}>
            <User className="h-4 w-4" /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onLogout} disabled={disabled}>
          <LogOut className="h-4 w-4" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? admin
            ? "bg-[#1b5849] font-semibold text-white shadow-[inset_3px_0_0_#e3bd70]"
            : "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
          : admin
            ? "text-[#d0e0d9] hover:bg-white/10 hover:text-white"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}
