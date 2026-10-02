import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { afterAll, beforeAll } from "vitest";
import { personaRoutes } from "../../apps/api/src/routes/personas.js";
import { authRoutes } from "../../apps/api/src/routes/auth.js";
import { cartRoutes } from "../../apps/api/src/routes/cart.js";
import { favoriteRoutes } from "../../apps/api/src/routes/favorites.js";
import { checkoutRoutes } from "../../apps/api/src/routes/checkout.js";

export async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(cors, {
    origin: "http://localhost:5173",
    credentials: true,
  });
  await app.register(jwt, { secret: "agentic-personas-dev-secret" });
  await app.register(personaRoutes);
  await app.register(authRoutes);
  await app.register(cartRoutes);
  await app.register(favoriteRoutes);
  await app.register(checkoutRoutes);
  return app;
}

export function useApp() {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  return () => app;
}

export function bearer(token: string) {
  return { authorization: `Bearer ${token}` };
}

export async function registerUser(
  app: FastifyInstance,
  overrides: { username?: string; email?: string; password?: string } = {},
) {
  const username = overrides.username ?? "ada";
  const email = overrides.email ?? `ada-${randomUUID()}@example.com`;
  const password = overrides.password ?? "secret12";
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { username, email, password },
  });

  return {
    res,
    email,
    password,
    username,
    body: res.json() as {
      token: string;
      user: { id: string; username?: string; email: string };
    },
  };
}
