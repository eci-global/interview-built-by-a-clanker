import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { personaRoutes } from "./routes/personas.js";
import { authRoutes } from "./routes/auth.js";
import { cartRoutes } from "./routes/cart.js";
import { favoriteRoutes } from "./routes/favorites.js";
import { checkoutRoutes } from "./routes/checkout.js";

export interface BuildAppOptions {
  /** Enable request logging. Off by default so tests stay quiet. */
  logger?: boolean;
}

/**
 * Build a fully-configured Fastify instance WITHOUT starting to listen.
 *
 * Extracted from index.ts so tests can drive the API in-process via
 * `app.inject(...)` (no open port, no cross-test interference). The process
 * entrypoint (index.ts) calls this and then `app.listen(...)`.
 */
export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });

  await app.register(cors, {
    origin: "http://localhost:5173",
    credentials: true,
    // DELETE is used by cart-item and favorite removal; it must be in the
    // allow-list or the browser's preflight blocks those requests cross-origin.
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });
  // Read the signing secret from the environment so production isn't pinned to
  // a public, source-committed value (anyone who has it can forge tokens). The
  // literal is kept only as a local-dev fallback.
  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? "agentic-personas-dev-secret",
  });

  await app.register(personaRoutes);
  await app.register(authRoutes);
  await app.register(cartRoutes);
  await app.register(favoriteRoutes);
  await app.register(checkoutRoutes);

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
