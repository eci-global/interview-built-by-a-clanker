import { apiBaseUrl } from "./env.js";
import { getSession, type SessionUser } from "./session.js";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type Persona = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  specialty: string;
  capabilities: string[];
  price: number;
  rating: number;
  reviewCount: number;
  tier: string;
};

export type CartItem = {
  id: string;
  personaId: string;
  persona: Persona;
  quantity: number;
};

export type Cart = {
  items: CartItem[];
  total: number;
};

export type Order = {
  id: string;
  items: CartItem[];
  total: number;
  customerName: string;
  customerEmail: string;
  createdAt: string;
};

export type AuthResult = {
  token: string;
  user: SessionUser;
};

type PersonaFilters = {
  q?: string;
  specialty?: string;
  tier?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
};

function errorMessage(body: unknown, status: number) {
  if (status === 401) {
    return "Unauthorized. Sign in again. Accounts live in the API process, so restarting the API clears them.";
  }

  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error: unknown }).error;
    if (typeof error === "string") return error;
    return JSON.stringify(error);
  }

  return `Request failed (${status})`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (options.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const token = getSession()?.token;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      0,
      `Cannot reach the API at ${apiBaseUrl()}. Start it with pnpm dev.`,
    );
  }

  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(body, response.status));
  }

  return body as T;
}

export const api = {
  searchPersonas(filters: PersonaFilters = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    return request<Persona[]>(`/personas${qs ? `?${qs}` : ""}`);
  },

  getPersona(id: string) {
    return request<Persona>(`/personas/${encodeURIComponent(id)}`);
  },

  register(input: { username: string; email: string; password: string }) {
    return request<AuthResult>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  login(input: { email: string; password: string }) {
    return request<AuthResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  me() {
    return request<SessionUser>("/auth/me");
  },

  favorites() {
    return request<{ favorites: Persona[] }>("/favorites");
  },

  addFavorite(personaId: string) {
    return request<{ success: boolean }>("/favorites", {
      method: "POST",
      body: JSON.stringify({ personaId }),
    });
  },

  removeFavorite(personaId: string) {
    return request<{ success: boolean }>(
      `/favorites/${encodeURIComponent(personaId)}`,
      { method: "DELETE" },
    );
  },

  cart() {
    return request<Cart>("/cart");
  },

  addToCart(personaId: string, quantity: number) {
    return request<Cart>("/cart", {
      method: "POST",
      body: JSON.stringify({ personaId, quantity }),
    });
  },

  updateCartItem(itemId: string, quantity: number) {
    return request<Cart>(`/cart/${encodeURIComponent(itemId)}`, {
      method: "PUT",
      body: JSON.stringify({ quantity }),
    });
  },

  removeCartItem(itemId: string) {
    return request<Cart>(`/cart/${encodeURIComponent(itemId)}`, {
      method: "DELETE",
    });
  },

  checkout(input: { name: string; email: string }) {
    return request<Order>("/checkout", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};
