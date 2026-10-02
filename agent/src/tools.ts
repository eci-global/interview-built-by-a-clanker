import { tool } from "ai";
import { z } from "zod";
import { ApiError, api, type Cart, type Persona } from "./api.js";
import { clearSession, getSession, setSession } from "./session.js";

const specialty = z.enum([
  "Engineering",
  "Design",
  "Data",
  "Security",
  "DevOps",
  "Product",
]);

const tier = z.enum(["Starter", "Pro", "Enterprise"]);

const sort = z.enum(["price-asc", "price-desc", "rating-desc", "name-asc"]);

function fail(error: unknown) {
  if (error instanceof ApiError) return { ok: false as const, error: error.message };
  if (error instanceof Error) return { ok: false as const, error: error.message };
  return { ok: false as const, error: "Something went wrong" };
}

function summarizePersona(persona: Persona) {
  return {
    id: persona.id,
    name: persona.name,
    tagline: persona.tagline,
    specialty: persona.specialty,
    tier: persona.tier,
    pricePerMonth: persona.price,
    rating: persona.rating,
    reviewCount: persona.reviewCount,
  };
}

function summarizeCart(cart: Cart) {
  return {
    items: cart.items.map((item) => ({
      cartItemId: item.id,
      personaId: item.personaId,
      name: item.persona.name,
      quantity: item.quantity,
      unitPrice: item.persona.price,
      lineTotal: Math.round(item.persona.price * item.quantity * 100) / 100,
    })),
    total: cart.total,
  };
}

function signedOut() {
  return {
    ok: false as const,
    error: "Not signed in. Register or log in before using favorites, cart, or checkout.",
  };
}

export const storefrontTools = {
  whoami: tool({
    description: "Return the signed-in account, or report that nobody is signed in.",
    inputSchema: z.object({}),
    execute: async () => {
      const session = getSession();
      if (!session) return { ok: true as const, signedIn: false };

      try {
        const user = await api.me();
        setSession({ token: session.token, user });
        return { ok: true as const, signedIn: true, user };
      } catch (error) {
        clearSession();
        return fail(error);
      }
    },
  }),

  register: tool({
    description:
      "Create an account and sign in. Username is 3-30 characters. Password must be at least 6 characters.",
    inputSchema: z.object({
      username: z.string().min(3).max(30),
      email: z.string().email(),
      password: z.string().min(6),
    }),
    execute: async (input) => {
      try {
        const result = await api.register(input);
        setSession(result);
        return { ok: true as const, user: result.user };
      } catch (error) {
        return fail(error);
      }
    },
  }),

  login: tool({
    description: "Sign in with email and password.",
    inputSchema: z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }),
    execute: async (input) => {
      try {
        const result = await api.login(input);
        setSession(result);
        return { ok: true as const, user: result.user };
      } catch (error) {
        return fail(error);
      }
    },
  }),

  logout: tool({
    description: "Sign out and forget the saved session on this machine.",
    inputSchema: z.object({}),
    execute: async () => {
      clearSession();
      return { ok: true as const, signedIn: false };
    },
  }),

  searchPersonas: tool({
    description:
      "Browse the persona catalog. Filters match the website: text query, specialty, tier, price range, and sort.",
    inputSchema: z.object({
      q: z.string().optional().describe("Search name, tagline, and description"),
      specialty: specialty.optional(),
      tier: tier.optional(),
      minPrice: z.number().optional().describe("Minimum monthly price in USD"),
      maxPrice: z.number().optional().describe("Maximum monthly price in USD"),
      sort: sort
        .optional()
        .describe(
          "price-asc, price-desc, rating-desc (top rated), or name-asc",
        ),
    }),
    execute: async (filters) => {
      try {
        const personas = await api.searchPersonas(filters);
        return {
          ok: true as const,
          count: personas.length,
          personas: personas.map(summarizePersona),
        };
      } catch (error) {
        return fail(error);
      }
    },
  }),

  getPersona: tool({
    description:
      "Get one persona, including description and capabilities. Use the catalog id, such as p-001.",
    inputSchema: z.object({
      personaId: z.string(),
    }),
    execute: async ({ personaId }) => {
      try {
        const persona = await api.getPersona(personaId);
        return {
          ok: true as const,
          persona: {
            ...summarizePersona(persona),
            description: persona.description,
            capabilities: persona.capabilities,
          },
        };
      } catch (error) {
        return fail(error);
      }
    },
  }),

  listFavorites: tool({
    description: "List the signed-in user's favorite personas.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!getSession()) return signedOut();
      try {
        const { favorites } = await api.favorites();
        return {
          ok: true as const,
          favorites: favorites.map(summarizePersona),
        };
      } catch (error) {
        return fail(error);
      }
    },
  }),

  addFavorite: tool({
    description: "Save a persona to favorites. Requires a persona id from search.",
    inputSchema: z.object({
      personaId: z.string(),
    }),
    execute: async ({ personaId }) => {
      if (!getSession()) return signedOut();
      try {
        await api.addFavorite(personaId);
        const { favorites } = await api.favorites();
        return {
          ok: true as const,
          favorites: favorites.map(summarizePersona),
        };
      } catch (error) {
        return fail(error);
      }
    },
  }),

  removeFavorite: tool({
    description: "Remove a persona from favorites by persona id.",
    inputSchema: z.object({
      personaId: z.string(),
    }),
    execute: async ({ personaId }) => {
      if (!getSession()) return signedOut();
      try {
        await api.removeFavorite(personaId);
        const { favorites } = await api.favorites();
        return {
          ok: true as const,
          favorites: favorites.map(summarizePersona),
        };
      } catch (error) {
        return fail(error);
      }
    },
  }),

  getCart: tool({
    description:
      "Show the cart. Each line includes cartItemId, which is required to change quantity or remove the line.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!getSession()) return signedOut();
      try {
        return { ok: true as const, cart: summarizeCart(await api.cart()) };
      } catch (error) {
        return fail(error);
      }
    },
  }),

  addToCart: tool({
    description:
      "Add a persona to the cart. Quantity defaults to 1. Adding the same persona again increases its quantity.",
    inputSchema: z.object({
      personaId: z.string(),
      quantity: z.number().int().min(1).optional(),
    }),
    execute: async ({ personaId, quantity }) => {
      if (!getSession()) return signedOut();
      try {
        const cart = await api.addToCart(personaId, quantity ?? 1);
        return { ok: true as const, cart: summarizeCart(cart) };
      } catch (error) {
        return fail(error);
      }
    },
  }),

  updateCartItem: tool({
    description: "Set a cart line's quantity. Use cartItemId from getCart, not the persona id.",
    inputSchema: z.object({
      cartItemId: z.string(),
      quantity: z.number().int().min(1),
    }),
    execute: async ({ cartItemId, quantity }) => {
      if (!getSession()) return signedOut();
      try {
        const cart = await api.updateCartItem(cartItemId, quantity);
        return { ok: true as const, cart: summarizeCart(cart) };
      } catch (error) {
        return fail(error);
      }
    },
  }),

  removeCartItem: tool({
    description: "Remove a line from the cart using cartItemId from getCart.",
    inputSchema: z.object({
      cartItemId: z.string(),
    }),
    execute: async ({ cartItemId }) => {
      if (!getSession()) return signedOut();
      try {
        const cart = await api.removeCartItem(cartItemId);
        return { ok: true as const, cart: summarizeCart(cart) };
      } catch (error) {
        return fail(error);
      }
    },
  }),

  checkout: tool({
    description:
      "Place the order for the current cart. Requires the customer's full name and email. The cart is cleared after a successful order.",
    inputSchema: z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }),
    execute: async (input) => {
      if (!getSession()) return signedOut();
      try {
        const order = await api.checkout(input);
        return {
          ok: true as const,
          order: {
            id: order.id,
            total: order.total,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            createdAt: order.createdAt,
            items: order.items.map((item) => ({
              name: item.persona.name,
              quantity: item.quantity,
              lineTotal:
                Math.round(item.persona.price * item.quantity * 100) / 100,
            })),
          },
        };
      } catch (error) {
        return fail(error);
      }
    },
  }),
};
