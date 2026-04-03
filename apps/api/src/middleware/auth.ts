import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

const ENFORCE_AUTH = process.env.ENFORCE_AUTH === "true";

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const hasBearer =
    typeof request.headers.authorization === "string" &&
    request.headers.authorization.startsWith("Bearer ");

  if (hasBearer) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    return;
  }

  if (ENFORCE_AUTH) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
}

export function registerAuthHook(app: FastifyInstance) {
  app.decorate("authenticate", authenticate);
}
