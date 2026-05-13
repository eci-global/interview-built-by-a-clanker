import { z } from "zod";

export const favoriteMutationSchema = z.object({
  personaId: z.string().min(1),
});

export type FavoriteMutationInput = z.infer<typeof favoriteMutationSchema>;
