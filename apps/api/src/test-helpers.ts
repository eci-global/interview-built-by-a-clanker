import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";

/**
 * Build an app instance and register a fresh user, returning the instance plus
 * a bearer token and the user id. Shared by route tests so each test can act as
 * an authenticated user without repeating the register/login dance.
 *
 * Note: the DB (db.ts) is a module-level singleton, so within a single test
 * file state accumulates — tests use unique emails to stay independent.
 */
export async function buildAppWithUser(
  email = `user-${Math.random().toString(36).slice(2)}@test.com`,
  username = "tester",
  password = "password1",
): Promise<{ app: FastifyInstance; token: string; userId: string }> {
  const app = await buildApp();
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { username, email, password },
  });
  const body = res.json();
  return { app, token: body.token as string, userId: body.user.id as string };
}

/** Authorization header helper. */
export function auth(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}
