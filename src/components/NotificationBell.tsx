import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getMyNotificationsFn,
  markAllNotificationsReadFn,
  markNotificationReadFn,
} from "@/lib/backend";

const notificationQueryKey = ["notifications"];

export function NotificationBell() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: notificationQueryKey,
    queryFn: () => getMyNotificationsFn(),
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });
  const notificationIds = data?.items.map((item) => item.id).join(",") ?? "";
  const hasNotificationData = data !== undefined;
  const previousNotificationIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!hasNotificationData) return;
    const currentIds = new Set(notificationIds ? notificationIds.split(",") : []);
    const previousIds = previousNotificationIds.current;
    previousNotificationIds.current = currentIds;
    if (previousIds && [...currentIds].some((id) => !previousIds.has(id))) {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["my-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["request"] }),
      ]);
    }
  }, [hasNotificationData, notificationIds, queryClient]);
  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationReadFn({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationQueryKey }),
  });
  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsReadFn(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationQueryKey }),
  });
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Notifications</h2>
            <p className="text-xs text-muted-foreground">
              {unreadCount ? `${unreadCount} unread` : "You’re all caught up"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!unreadCount || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
            aria-label="Mark all notifications as read"
          >
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <div className="max-h-[min(28rem,70vh)] overflow-y-auto">
          {isLoading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Loading notifications…</p>
          ) : isError ? (
            <p className="p-6 text-center text-sm text-destructive">
              Could not load notifications. Try again shortly.
            </p>
          ) : !data ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Notifications are unavailable.
            </p>
          ) : data.items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Updates about requests will appear here.
            </p>
          ) : (
            data.items.map((notification) => {
              const isRead = notification.read_at !== null;
              return (
                <a
                  key={notification.id}
                  href={notification.href}
                  onClick={() => {
                    if (!isRead) markRead.mutate(notification.id);
                  }}
                  className={`block border-b px-4 py-3 transition-colors last:border-0 hover:bg-muted/60 ${
                    isRead ? "" : "bg-primary/[0.04]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        isRead ? "bg-transparent" : "bg-primary"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{notification.title}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {notification.message}
                      </span>
                      <span className="mt-1.5 block text-[11px] text-muted-foreground/80">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </span>
                  </div>
                </a>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
