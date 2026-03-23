import { z } from "zod";
import { cartItemSchema } from "./cart.js";

export const checkoutSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const orderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  items: z.array(cartItemSchema),
  total: z.number(),
  customerName: z.string(),
  customerEmail: z.string(),
  createdAt: z.string(),
});

export type Order = z.infer<typeof orderSchema>;
