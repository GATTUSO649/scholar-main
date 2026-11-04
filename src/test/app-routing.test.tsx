import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { createAppQueryClient } from "@/router";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("uses shared caching while keeping payment and request queries fresh", () => {
    const queryClient = createAppQueryClient();

    expect(queryClient.getDefaultOptions().queries).toMatchObject({
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    });
    expect(queryClient.getQueryDefaults(["public-site-content"]).staleTime).toBe(5 * 60_000);
    expect(queryClient.getQueryDefaults(["request"])).toMatchObject({
      staleTime: 5_000,
      refetchOnWindowFocus: true,
      retry: 0,
    });
    expect(queryClient.getQueryDefaults(["admin-service-request-payments"]).staleTime).toBe(0);
  });

  it("reuses public data but refetches payment queries", async () => {
    const queryClient = createAppQueryClient();
    const publicQuery = vi.fn().mockResolvedValue({ footerMessage: "ScholarDesk" });
    const paymentQuery = vi.fn().mockResolvedValue({ items: [] });

    await queryClient.fetchQuery({ queryKey: ["public-site-content"], queryFn: publicQuery });
    await queryClient.fetchQuery({ queryKey: ["public-site-content"], queryFn: publicQuery });
    await queryClient.fetchQuery({
      queryKey: ["admin-service-request-payments", "all", 0],
      queryFn: paymentQuery,
    });
    await queryClient.fetchQuery({
      queryKey: ["admin-service-request-payments", "all", 0],
      queryFn: paymentQuery,
    });

    expect(publicQuery).toHaveBeenCalledTimes(1);
    expect(paymentQuery).toHaveBeenCalledTimes(2);
  });

  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches the separate administrator sign-in page", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/admin/login");

    expect(matches.at(-1)?.routeId).toBe("/admin/login");
  });

  it("matches the administrator M-PESA transaction page", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/admin/payments");

    expect(matches.at(-1)?.routeId).toBe("/_authenticated/admin/payments");
  });

  it("matches the administrator business settings page", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/admin/business-settings");

    expect(matches.at(-1)?.routeId).toBe("/_authenticated/admin/business-settings");
  });

  it.each([
    ["/how-it-works", "/how-it-works"],
    ["/services", "/services"],
    ["/library", "/library"],
    ["/downloads", "/downloads"],
    ["/pricing", "/pricing"],
    ["/faq", "/faq"],
    ["/contact", "/contact"],
  ])("matches the standalone public page %s", (path, routeId) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes(path);

    expect(matches.at(-1)?.routeId).toBe(routeId);
  });
});
