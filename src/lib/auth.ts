import { useQuery } from "@tanstack/react-query";
import { getCurrentUserStateFn, getProfileFn } from "@/lib/backend";

const SESSION_CHANNEL_NAME = "scholardesk-auth-session";
const SESSION_STORAGE_KEY = "scholardesk-auth-session-change";

export function getSafeReturnTo(value: unknown, fallback: string) {
  if (typeof value !== "string" || value.length > 2048) return fallback;
  const origin =
    typeof window === "undefined" ? "https://scholardesk.invalid" : window.location.origin;
  try {
    const target = new URL(value, origin);
    if (
      target.origin !== origin ||
      (value.startsWith("/") && value.startsWith("//")) ||
      target.pathname === "/auth" ||
      target.pathname === "/admin/login"
    ) {
      return fallback;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

export function broadcastAuthSessionChange() {
  if (typeof window === "undefined") return;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(SESSION_CHANNEL_NAME);
      channel.postMessage("session-changed");
      channel.close();
      return;
    }
  } catch {
    // Fall back to the storage event when BroadcastChannel is unavailable.
  }
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, `${Date.now()}-${Math.random()}`);
  } catch {
    // Storage may be disabled; the current tab still clears its own cache.
  }
}

export function subscribeToAuthSessionChanges(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(SESSION_CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<unknown>) => {
        if (event.data === "session-changed") onChange();
      };
      return () => channel.close();
    }
  } catch {
    // Fall back to the storage event when BroadcastChannel is unavailable.
  }
  const handleStorage = (event: StorageEvent) => {
    if (event.key === SESSION_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}

export function dashboardRouteFor(isAdmin: boolean) {
  return isAdmin ? "/admin/dashboard" : "/dashboard";
}

export function adminWorkspaceRedirectFor(
  isAdmin: boolean,
  pathname: string,
): "/admin/login" | "/admin/profile" | "/admin/dashboard" | null {
  const isAdminPage =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/students") ||
    pathname.startsWith("/manage");
  const isStudentPage =
    pathname === "/dashboard" ||
    pathname === "/submit" ||
    pathname === "/requests" ||
    pathname.startsWith("/request/") ||
    pathname.startsWith("/portal/") ||
    pathname === "/support";

  if (!isAdmin && isAdminPage) return "/admin/login";
  if (isAdmin && pathname === "/profile") return "/admin/profile";
  if (isAdmin && !isAdminPage && isStudentPage) return "/admin/dashboard";
  return null;
}

export function useUser() {
  const { data: state, isLoading: loading } = useCurrentUserState();
  return { user: state?.user ?? null, loading };
}

function useCurrentUserState(enabled = true) {
  return useQuery({
    queryKey: ["current-user-state"],
    queryFn: () => getCurrentUserStateFn(),
    enabled,
    staleTime: 30_000,
  });
}

export function useProfile(userId?: string) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: () => getProfileFn({ data: userId ? { userId } : {} }),
  });
}

export function useIsAdmin(userId?: string) {
  const { data, isLoading, isError } = useCurrentUserState(Boolean(userId));
  return { data: userId ? data?.isAdmin : undefined, isLoading, isError };
}
