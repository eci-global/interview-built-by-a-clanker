interface SearchParams {
  q?: string;
  specialty?: string;
  tier?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
}

export function buildPersonaQueryString(search: SearchParams): string {
  const queryString = new URLSearchParams();
  if (search.q) queryString.set("q", search.q);
  if (search.specialty) queryString.set("specialty", search.specialty);
  if (search.tier) queryString.set("tier", search.tier);
  if (search.minPrice !== undefined) {
    queryString.set("minPrice", String(search.minPrice));
  }
  if (search.maxPrice !== undefined) {
    queryString.set("maxPrice", String(search.maxPrice));
  }
  if (search.sort) queryString.set("sort", search.sort);
  return queryString.toString();
}

export function personaQueryKey(queryString: string) {
  return ["personas", queryString] as const;
}
