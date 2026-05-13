import type { FastifyInstance } from "fastify";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { registerSchema, loginSchema, type AuthResponse } from "@acme/shared";
import { db } from "../db.js";
import { authenticate } from "../middleware/auth.js";

let userCounter = 0;
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { username, email, password } = parsed.data;

    if (db.users.getByEmail(email)) {
      return reply.status(409).send({ error: "Email already registered" });
    }

    const id = `user-${++userCounter}`;
    const user = db.users.create({
      id,
      username,
      email,
      passwordHash: await hashPassword(password),
    });

    const token = app.jwt.sign({ id: user.id, email: user.email });
    const response: AuthResponse = {
      token,
      user: { id: user.id, username: user.username, email: user.email },
    };

    return reply.status(201).send(response);
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;
    const user = db.users.getByEmail(email);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const token = app.jwt.sign({ id: user.id, email: user.email });
    const response = {
      token,
      user: { id: user.id, username: user.username, email: user.email },
    };

    return response;
  });

  app.get(
    "/auth/me",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const payload = request.user as { id: string; email: string };
      const user = db.users.getById(payload.id);
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }
      return { id: user.id, username: user.username, email: user.email };
    }
  );
}
