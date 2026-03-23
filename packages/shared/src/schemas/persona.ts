import { z } from "zod";

export const PersonaSpecialty = {
  Engineering: "Engineering",
  Design: "Design",
  Data: "Data",
  Security: "Security",
  DevOps: "DevOps",
  Product: "Product",
} as const;

export const PersonaTier = {
  Starter: "Starter",
  Pro: "Pro",
  Enterprise: "Enterprise",
} as const;

export const personaSchema = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string(),
  description: z.string(),
  avatarUrl: z.string(),
  specialty: z.enum([
    "Engineering",
    "Design",
    "Data",
    "Security",
    "DevOps",
    "Product",
  ]),
  capabilities: z.array(z.string()),
  price: z.number(),
  rating: z.number().min(1).max(5),
  reviewCount: z.number(),
  tier: z.enum(["Starter", "Pro", "Enterprise"]),
});

export type Persona = z.infer<typeof personaSchema>;

export const personaFilterSchema = z.object({
  q: z.string().optional(),
  specialty: z
    .enum(["Engineering", "Design", "Data", "Security", "DevOps", "Product"])
    .optional(),
  tier: z.enum(["Starter", "Pro", "Enterprise"]).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  sort: z
    .enum(["price-asc", "price-desc", "rating-desc", "name-asc"])
    .optional(),
});

export type PersonaFilter = z.infer<typeof personaFilterSchema>;
