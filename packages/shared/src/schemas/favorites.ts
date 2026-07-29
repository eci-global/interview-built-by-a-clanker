import { z } from "zod";
import { personaSchema } from "./persona.js";

export const addFavoriteSchema = z.object({
  personaId: z.string().min(1),
});

export type AddFavoriteInput = z.infer<typeof addFavoriteSchema>;

export const favoritesResponseSchema = z.object({
  favorites: z.array(personaSchema),
});

export type FavoritesResponse = z.infer<typeof favoritesResponseSchema>;
