import type { Persona } from "@acme/shared";
import { api } from "./api";

export interface FavoritesResponse {
  favorites: Persona[];
}

/**
 * The single canonical react-query definition for "this user's favorites".
 *
 * Both the favorites page and the persona detail page need this data. They
 * previously each declared their own `["favorites"]` query but returned
 * DIFFERENT shapes — the list page `{ favorites: Persona[] }` and the detail
 * page a mapped `string[]` of ids. Same key + different shapes means whichever
 * populates the cache first dictates what the other reads, so visiting a detail
 * page poisoned the list page (it then rendered "no favorites"). Sharing one
 * query definition guarantees a single key AND a single shape.
 */
export function favoritesQuery() {
  return {
    queryKey: ["favorites"] as const,
    queryFn: () => api.get<FavoritesResponse>("/favorites"),
  };
}

/** Whether a given persona id is in the favorites response. */
export function isPersonaFavorited(
  data: FavoritesResponse | undefined,
  personaId: string,
): boolean {
  return data?.favorites.some((p) => p.id === personaId) ?? false;
}

/**
 * Perform the correct favorite toggle request.
 *
 * Direction matters and was previously inverted: when a persona is NOT yet
 * favorited the user wants to ADD it (POST), and when it IS favorited they want
 * to REMOVE it (DELETE). The old code had these swapped, so the heart button
 * could never add a new favorite (it sent DELETE → 404) and could never remove
 * one (it sent POST → re-added).
 */
export function toggleFavoriteRequest(isFavorited: boolean, personaId: string) {
  return isFavorited
    ? api.delete(`/favorites/${personaId}`)
    : api.post("/favorites", { personaId });
}
