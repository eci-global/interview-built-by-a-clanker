import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

function enforceAuth(): boolean {
  return process.env.ENFORCE_AUTH === "true";
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const hasBearer = request.headers.authorization?.startsWith("Bearer ");

  if (hasBearer) {
    try {
      await request.jwtVerify();
      return;
    } catch {
      if (enforceAuth()) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      return;
    }
  }

  if (enforceAuth()) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
}

export function registerAuthHook(app: FastifyInstance) {
  app.decorate("authenticate", authenticate);
}
