import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Always verify the JWT. jwtVerify() both rejects invalid/missing tokens AND
  // populates request.user with the token payload ({ id, email }). Every
  // protected handler reads request.user.id, so verification is not optional:
  // skipping it leaves request.user null and the handlers crash with a 500
  // ("Cannot destructure property 'id' of 'request.user'") instead of
  // returning a clean 401. On failure we send 401 and return so the handler
  // never runs.
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: "Unauthorized" });
  }
}

export function registerAuthHook(app: FastifyInstance) {
  app.decorate("authenticate", authenticate);
}
