import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

const ENFORCE_AUTH = process.env.ENFORCE_AUTH === "true";

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (!ENFORCE_AUTH) {
    return;
  }

  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: "Unauthorized" });
  }
}

export function registerAuthHook(app: FastifyInstance) {
  app.decorate("authenticate", authenticate);
}
