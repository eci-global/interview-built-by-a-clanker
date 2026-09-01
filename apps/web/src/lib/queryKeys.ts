export const CART_QUERY_KEY = ["cart"] as const;

export const FAVORITES_LIST_QUERY_KEY = ["favorites", "list"] as const;
export const FAVORITES_IDS_QUERY_KEY = ["favorites", "ids"] as const;

export const AUTHENTICATED_QUERY_KEYS = [
  CART_QUERY_KEY,
  FAVORITES_LIST_QUERY_KEY,
  FAVORITES_IDS_QUERY_KEY,
] as const;

export interface PersonasSearch {
  q?: string;
  specialty?: string;
  tier?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
}

export function personasQueryKey(search: PersonasSearch) {
  return ["personas", search] as const;
}

export function buildPersonasQueryPath(search: PersonasSearch): string {
  const queryString = new URLSearchParams();
  if (search.q) queryString.set("q", search.q);
  if (search.specialty) queryString.set("specialty", search.specialty);
  if (search.tier) queryString.set("tier", search.tier);
  if (search.minPrice) queryString.set("minPrice", String(search.minPrice));
  if (search.maxPrice) queryString.set("maxPrice", String(search.maxPrice));
  if (search.sort) queryString.set("sort", search.sort);

  const qs = queryString.toString();
  return `/personas${qs ? `?${qs}` : ""}`;
}
