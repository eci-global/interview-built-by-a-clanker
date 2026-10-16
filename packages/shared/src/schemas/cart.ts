import { z } from "zod";
import { personaSchema } from "./persona.js";

export const MAX_CART_QUANTITY = 99;

const quantityField = z
  .number()
  .int()
  .min(1, "Quantity must be at least 1")
  .max(MAX_CART_QUANTITY, `Quantity cannot exceed ${MAX_CART_QUANTITY}`);

export const cartItemSchema = z.object({
  id: z.string(),
  personaId: z.string(),
  persona: personaSchema,
  quantity: quantityField,
});

export type CartItem = z.infer<typeof cartItemSchema>;

export const addToCartSchema = z.object({
  personaId: z.string(),
  quantity: quantityField.default(1),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;

export const updateCartItemSchema = z.object({
  quantity: quantityField,
});

export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

export interface Cart {
  items: CartItem[];
  total: number;
}
