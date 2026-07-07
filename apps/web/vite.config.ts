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
    host: true, // bind 0.0.0.0 so the sandbox/action can reach the dev server
    port: 5173,
    strictPort: true, // fail fast if 5173 is taken rather than silently using another port
    allowedHosts: true, // Vite 6 host-check: allow any Host header (localhost + sandbox network hostnames/IPs) so the smoke-test health poll on http://localhost:5173/ is not 403-blocked
  },
  preview: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true, // parity with dev server: don't 403-block host-checked requests
  },
});
