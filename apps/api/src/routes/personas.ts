import type { FastifyInstance } from "fastify";
import { personaFilterSchema } from "@acme/shared";
import { db } from "../db.js";

export async function personaRoutes(app: FastifyInstance) {
  app.get("/personas", async (request, reply) => {
    const result = personaFilterSchema.safeParse(request.query);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.flatten() });
    }

    return db.personas.search(result.data);
  });

  app.get<{ Params: { id: string } }>("/personas/:id", async (request, reply) => {
    const persona = db.personas.getById(request.params.id);
    if (!persona) {
      return reply.status(404).send({ error: "Persona not found" });
    }
    return persona;
  });
}
