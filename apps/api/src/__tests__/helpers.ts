import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { personaRoutes } from "../routes/personas.js";
import { authRoutes } from "../routes/auth.js";
import { cartRoutes } from "../routes/cart.js";
import { favoriteRoutes } from "../routes/favorites.js";
import { checkoutRoutes } from "../routes/checkout.js";

export async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(jwt, { secret: "test-secret" });
  await app.register(personaRoutes);
  await app.register(authRoutes);
  await app.register(cartRoutes);
  await app.register(favoriteRoutes);
  await app.register(checkoutRoutes);
  return app;
}

export async function registerAndLogin(
  app: ReturnType<typeof Fastify>,
  user = { username: "testuser", email: "test@example.com", password: "password123" },
) {
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: user,
  });
  return JSON.parse(res.payload) as { token: string; user: { id: string; username: string; email: string } };
}
