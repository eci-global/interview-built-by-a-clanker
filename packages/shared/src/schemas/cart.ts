import { z } from "zod";
import { personaSchema } from "./persona.js";

export const cartItemSchema = z.object({
  id: z.string(),
  personaId: z.string(),
  persona: personaSchema,
  quantity: z.number().int().min(1),
});

export type CartItem = z.infer<typeof cartItemSchema>;

export const addToCartSchema = z.object({
  personaId: z.string(),
  quantity: z.number().int().min(1).default(1),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1),
});

export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

export interface Cart {
  items: CartItem[];
  total: number;
}
