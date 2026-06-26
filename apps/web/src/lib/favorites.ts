import { api } from "./api";

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
