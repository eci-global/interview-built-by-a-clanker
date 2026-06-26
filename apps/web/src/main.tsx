import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { AuthProvider } from "~/lib/auth";
import { queryClient, STALE_TIME } from "~/lib/queryClient";
import { routeTree } from "./routeTree.gen";
import "./app.css";

const router = createRouter({
  routeTree,
  context: { queryClient },
  // Match the query layer's stale time so route preloads and queries agree on
  // freshness (see STALE_TIME).
  defaultPreloadStaleTime: STALE_TIME,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
