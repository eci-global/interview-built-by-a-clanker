import type { FastifyInstance } from "fastify";
import { db } from "../db.js";

export async function personaRoutes(app: FastifyInstance) {
  app.get("/personas", async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const filters = {
      q: query.q,
      specialty: query.specialty,
      tier: query.tier,
      minPrice: query.minPrice ? Number(query.minPrice) : undefined,
      maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
      sort: query.sort,
    };

    return db.personas.search(filters);
  });

  app.get<{ Params: { id: string } }>("/personas/:id", async (request, reply) => {
    const persona = db.personas.getById(request.params.id);
    if (!persona) {
      return reply.status(404).send({ error: "Persona not found" });
    }
    return persona;
  });
}
