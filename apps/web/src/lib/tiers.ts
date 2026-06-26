import type { Persona } from "@acme/shared";

/**
 * Tailwind badge classes per persona tier. Single source of truth — this map
 * was previously copy-pasted in both PersonaCard and the persona detail page,
 * where the two copies could drift.
 */
export const tierColors: Record<Persona["tier"], string> = {
  Starter: "bg-green-100 text-green-800",
  Pro: "bg-blue-100 text-blue-800",
  Enterprise: "bg-purple-100 text-purple-800",
};
