import { QueryClient } from "@tanstack/react-query";

// Single stale-time constant shared by the query client (below) and the
// router's defaultPreloadStaleTime (main.tsx). Previously the router used 0
// (preloads always considered stale → always refetch) while queries used 60s,
// which is contradictory; route preloads would refetch data the query layer
// still considered fresh.
export const STALE_TIME = 1000 * 60;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
