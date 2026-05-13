export function favoriteToggleRequest(isFavorited: boolean, personaId: string) {
  return isFavorited
    ? { method: "DELETE" as const, path: `/favorites/${personaId}` }
    : {
        method: "POST" as const,
        path: "/favorites",
        body: { personaId },
      };
}
