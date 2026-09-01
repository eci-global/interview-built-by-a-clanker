export type FavoriteToggleAction =
  | { method: "POST"; path: "/favorites"; body: { personaId: string } }
  | { method: "DELETE"; path: string };

export function getFavoriteToggleAction(
  isFavorited: boolean,
  personaId: string,
): FavoriteToggleAction {
  return isFavorited
    ? { method: "DELETE", path: `/favorites/${personaId}` }
    : { method: "POST", path: "/favorites", body: { personaId } };
}
