import type { FastifyInstance } from "fastify";
import type { Persona } from "@acme/shared";
import { db } from "../db.js";
import { authenticate } from "../middleware/auth.js";

export async function favoriteRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/favorites", async (request) => {
    const { id: userId } = request.user as { id: string };
    const personaIds = db.favorites.getByUserId(userId);
    const personas: Persona[] = [];

    for (const pid of personaIds) {
      const persona = db.personas.getById(pid);
      if (persona) personas.push(persona);
    }

    return { favorites: personas };
  });

  app.post("/favorites", async (request, reply) => {
    const { id: userId } = request.user as { id: string };
    const { personaId } = request.body as { personaId: string };

    if (!personaId) {
      return reply.status(400).send({ error: "personaId is required" });
    }

    const persona = db.personas.getById(personaId);
    if (!persona) {
      return reply.status(404).send({ error: "Persona not found" });
    }

    db.favorites.add(userId, personaId);
    return { success: true };
  });

  app.delete<{ Params: { personaId: string } }>(
    "/favorites/:personaId",
    async (request, reply) => {
      const { id: userId } = request.user as { id: string };
      const removed = db.favorites.remove(userId, request.params.personaId);
      if (!removed) {
        return reply.status(404).send({ error: "Favorite not found" });
      }
      return { success: true };
    }
  );
}
