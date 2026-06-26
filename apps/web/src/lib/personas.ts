import type { Persona } from "@acme/shared";
import { api } from "./api";

export interface PersonaSearchParams {
  q?: string;
  specialty?: string;
  tier?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
}

/**
 * Build the react-query options for the persona browse list from the current
 * search params.
 *
 * The queryKey MUST include `search`. react-query caches by key, so a constant
 * key like ["personas"] makes every filter/search/sort change reuse the first
 * cached page (the queryFn closes over an updated query string, but the cache
 * key never changes, so no refetch happens). Including `search` in the key
 * means each distinct filter combination is its own cache entry and a change
 * triggers a fetch.
 */
export function personasQuery(search: PersonaSearchParams) {
  const queryString = new URLSearchParams();
  if (search.q) queryString.set("q", search.q);
  if (search.specialty) queryString.set("specialty", search.specialty);
  if (search.tier) queryString.set("tier", search.tier);
  // Compare against undefined, not truthiness: a legitimate price of 0 is
  // falsy, so `if (search.minPrice)` silently dropped a 0 bound.
  if (search.minPrice !== undefined)
    queryString.set("minPrice", String(search.minPrice));
  if (search.maxPrice !== undefined)
    queryString.set("maxPrice", String(search.maxPrice));
  if (search.sort) queryString.set("sort", search.sort);

  const qs = queryString.toString();
  const path = `/personas${qs ? `?${qs}` : ""}`;

  return {
    queryKey: ["personas", search] as const,
    queryFn: () => api.get<Persona[]>(path),
    path,
  };
}
