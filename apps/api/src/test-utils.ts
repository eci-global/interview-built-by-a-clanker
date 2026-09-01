import Fastify, { type FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";
import { authRoutes } from "./routes/auth.js";
import { cartRoutes } from "./routes/cart.js";
import { favoriteRoutes } from "./routes/favorites.js";
import { personaRoutes } from "./routes/personas.js";

const JWT_SECRET = "agentic-personas-dev-secret";

export async function buildAuthTestApp() {
  const app = Fastify({ logger: false });
  await app.register(jwt, { secret: JWT_SECRET });
  await app.register(authRoutes);
  await app.ready();
  return app;
}

export async function buildApiTestApp() {
  const app = Fastify({ logger: false });
  await app.register(jwt, { secret: JWT_SECRET });
  await app.register(personaRoutes);
  await app.register(authRoutes);
  await app.register(cartRoutes);
  await app.register(favoriteRoutes);
  await app.ready();
  return app;
}

export async function registerTestUser(app: FastifyInstance) {
  const email = `test-${Date.now()}-${Math.random()}@example.com`;
  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      username: "test-user",
      email,
      password: "password123",
    },
  });

  if (response.statusCode !== 201) {
    throw new Error(`Failed to register test user: ${response.body}`);
  }

  const body = response.json<{ token: string; user: { id: string } }>();
  return { token: body.token, userId: body.user.id, email };
}

export function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}
