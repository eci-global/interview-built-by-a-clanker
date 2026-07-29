import type { FastifyInstance } from "fastify";
import { personaFilterSchema } from "@acme/shared";
import { db } from "../db.js";

export async function personaRoutes(app: FastifyInstance) {
  app.get("/personas", async (request, reply) => {
    const parsed = personaFilterSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }

    return db.personas.search(parsed.data);
  });

  app.get<{ Params: { id: string } }>("/personas/:id", async (request, reply) => {
    const persona = db.personas.getById(request.params.id);
    if (!persona) {
      return reply.status(404).send({ error: "Persona not found" });
    }
    return persona;
  });
}
