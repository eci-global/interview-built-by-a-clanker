import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "path";

export default defineConfig({
  plugins: [TanStackRouterVite({ quoteStyle: "double" }), react(), tailwindcss()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0", // bind explicit IPv4 so localhost/127.0.0.1 is reachable over IPv4 (host: true resolves to an IPv6 :: bind)
    port: 5173,
    strictPort: true, // fail fast if 5173 is taken rather than silently using another port
    allowedHosts: true, // Vite 6 host-check: allow any Host header (localhost + sandbox network hostnames/IPs) so the smoke-test health poll on http://localhost:5173/ is not 403-blocked
  },
  preview: {
    // `vite preview` serves the built apps/web/dist/ and is the authoritative smoke target
    // matching baseUrl http://localhost:5173/ in lore.yml.
    host: "0.0.0.0", // bind explicit IPv4 so the health poll on http://localhost:5173/ reaches the loopback (host: true binds IPv6 ::)
    port: 5173,
    strictPort: true,
    allowedHosts: true, // parity with dev server: don't 403-block host-checked requests
  },
});
