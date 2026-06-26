import type { FastifyInstance } from "fastify";
import { personaFilterSchema } from "@acme/shared";
import { db } from "../db.js";

export async function personaRoutes(app: FastifyInstance) {
  app.get("/personas", async (request, reply) => {
    // Validate/coerce query params with the shared personaFilterSchema instead
    // of hand-rolling Number() coercion. The schema enforces the specialty/tier/
    // sort enums (so a bad value is a clean 400 rather than silently returning
    // an empty list) and coerces minPrice/maxPrice from their string form.
    const parsed = personaFilterSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
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
