import { useQuery } from "@tanstack/react-query";
import { getAdminStateFn, getCurrentUserFn, getProfileFn } from "@/lib/backend";

export function dashboardRouteFor(isAdmin: boolean) {
  return isAdmin ? "/admin/dashboard" : "/dashboard";
}

export function useUser() {
  const { data: user, isLoading: loading } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => getCurrentUserFn(),
    staleTime: 30_000,
  });
  return { user: user ?? null, loading };
}

export function useProfile(userId?: string) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: () => getProfileFn({ data: userId ? { userId } : {} }),
  });
}

export function useIsAdmin(userId?: string) {
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: () => getAdminStateFn(),
  });
}
