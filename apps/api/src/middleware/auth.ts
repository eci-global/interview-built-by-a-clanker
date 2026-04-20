import type { FastifyRequest, FastifyReply } from "fastify";

const SKIP_AUTH = process.env.SKIP_AUTH === "true";

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (SKIP_AUTH) {
    return;
  }

  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: "Unauthorized" });
  }
}
