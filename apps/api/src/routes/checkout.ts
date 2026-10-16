import type { FastifyInstance } from "fastify";
import { checkoutSchema, type Order, type CartItem } from "@acme/shared";
import { db } from "../db.js";
import { authenticate } from "../middleware/auth.js";

export async function checkoutRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.post("/checkout", async (request, reply) => {
    const { id: userId } = request.user as { id: string };
    const parsed = checkoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const items: CartItem[] = [];
    let total = 0;

    for (const entry of db.cart.getByUserId(userId)) {
      const persona = db.personas.getById(entry.personaId);
      if (!persona) continue;

      items.push({
        id: entry.id,
        personaId: entry.personaId,
        persona,
        quantity: entry.quantity,
      });

      total += persona.price * entry.quantity;
    }

    if (items.length === 0) {
      return reply.status(400).send({ error: "Cart is empty" });
    }

    const order: Order = {
      id: db._nextOrderId(),
      userId,
      items,
      total: Math.round(total * 100) / 100,
      customerName: parsed.data.name,
      customerEmail: parsed.data.email,
      createdAt: new Date().toISOString(),
    };

    db.orders.create(order);
    db.cart.clearForUser(userId);

    return reply.status(201).send(order);
  });
}
