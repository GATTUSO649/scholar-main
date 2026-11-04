import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function createAppQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
    },
  });

  queryClient.setQueryDefaults(["public-site-content"], { staleTime: 5 * 60_000 });
  queryClient.setQueryDefaults(["public-data"], { staleTime: 60_000 });
  queryClient.setQueryDefaults(["library-resources"], { staleTime: 60_000 });
  queryClient.setQueryDefaults(["my-requests"], { staleTime: 15_000 });
  queryClient.setQueryDefaults(["admin-requests"], { staleTime: 15_000 });
  queryClient.setQueryDefaults(["admin-students"], { staleTime: 60_000 });
  queryClient.setQueryDefaults(["request"], {
    staleTime: 5_000,
    refetchOnWindowFocus: true,
    retry: 0,
  });
  queryClient.setQueryDefaults(["admin-mpesa-payments"], {
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 0,
  });
  queryClient.setQueryDefaults(["admin-service-request-payments"], {
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 0,
  });
  queryClient.setQueryDefaults(["notifications"], {
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 0,
  });

  return queryClient;
}

export const getRouter = () => {
  const queryClient = createAppQueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
