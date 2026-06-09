# Answer Key - 12 Bugs + 1 Security Issue + 1 Code Quality Issue

> **DO NOT share this file with candidates.** This file lives on the `answer-key` branch only. Candidates work on `master`.

---

## Bug 1: Cart DELETE endpoint missing user ownership check (Security)

**File**: `apps/api/src/routes/cart.ts`
**Category**: API Logic Error
**Severity**: Critical

**Problem**: The DELETE `/cart/:itemId` route checks if the item exists but does NOT verify that `item.userId === userId`. Any authenticated user can delete any other user's cart items.

**Fix**: Add `item.userId !== userId` back to the guard condition:
```typescript
if (!item || item.userId !== userId) {
```

---

## Bug 2: Search minPrice filter is inverted

**File**: `apps/api/src/db.ts`
**Category**: API Logic Error
**Severity**: Medium

**Problem**: The `minPrice` filter uses `<=` instead of `>=`, so it returns personas that cost LESS than the minimum price rather than MORE.

**Fix**: Change `p.price <= filters.minPrice!` to `p.price >= filters.minPrice!`

---

## Bug 3: Checkout does not clear the cart

**File**: `apps/api/src/routes/checkout.ts`
**Category**: API Logic Error
**Severity**: High

**Problem**: After creating an order, the checkout route does not call `db.cart.clearForUser(userId)`. The cart remains full after a successful checkout, so the user could place the same order repeatedly.

**Fix**: Add `db.cart.clearForUser(userId);` after `db.orders.create(order);`

---

## Bug 4: CORS configuration blocks DELETE requests

**File**: `apps/api/src/index.ts`
**Category**: API Logic Error
**Severity**: High

**Problem**: The CORS `methods` array is explicitly set to `["GET", "POST", "PUT", "OPTIONS"]` and omits `"DELETE"`. Any DELETE request from the frontend (remove cart item, remove favorite) will be blocked by the browser's CORS preflight.

**Fix**: Either add `"DELETE"` to the methods array, or remove the `methods` option entirely to allow all methods (the default).

---

## Bug 5: Cart badge in nav uses wrong query key (stale count)

**File**: `apps/web/src/routes/__root.tsx`
**Category**: TanStack Query Issue
**Severity**: Medium

**Problem**: The root layout queries the cart with `queryKey: ["cart-count"]`, but every mutation in the app invalidates `queryKey: ["cart"]`. Since the keys don't match, the cart badge in the nav bar never updates when items are added or removed.

**Fix**: Change `queryKey: ["cart-count"]` to `queryKey: ["cart"]`

---

## Bug 6: Favorites query fires without authentication

**File**: `apps/web/src/routes/personas/$personaId.tsx`
**Category**: TanStack Query Issue
**Severity**: Medium

**Problem**: The favorites query on the persona detail page is missing `enabled: !!user`. When a user is NOT logged in, the query still fires, hits the `/favorites` endpoint, and gets a 401 error. This causes a console error and potentially a retry loop.

**Fix**: Add `enabled: !!user` to the favorites useQuery options.

---

## Bug 7: Persona card shows price in cents (100x too high)

**File**: `apps/web/src/components/PersonaCard.tsx`
**Category**: UI / Frontend Logic
**Severity**: High

**Problem**: The price display multiplies `persona.price` by 100: `${(persona.price * 100).toFixed(2)}`. A $49.99 persona displays as $4,999.00.

**Fix**: Remove the `* 100` multiplier: `${persona.price.toFixed(2)}`

---

## Bug 8: Cart quantity can go to zero or negative

**File**: `apps/web/src/components/CartItem.tsx`
**Category**: UI / Frontend Logic
**Severity**: Medium

**Problem**: The decrement button has no `disabled` guard. When quantity is 1, clicking "-" calls `onUpdateQuantity(0)`, which sends `quantity: 0` to the API. The API's Zod schema requires `min(1)`, so this returns a 400 error. If the schema were more lenient, it would allow zero or negative quantities.

**Fix**: Add `disabled={item.quantity <= 1}` to the decrement button.

---

## Bug 9: Favorite toggle logic is inverted

**File**: `apps/web/src/routes/personas/$personaId.tsx`
**Category**: UI / Frontend Logic
**Severity**: Medium

**Problem**: The toggle mutation has `!isFavorited` instead of `isFavorited` as the condition. This means clicking the heart when a persona is NOT favorited sends a DELETE (which 404s), and clicking when it IS favorited sends a POST (which duplicates). The behavior is completely backwards.

**Fix**: Change `!isFavorited` to `isFavorited`:
```typescript
isFavorited
  ? api.delete(`/favorites/${personaId}`)
  : api.post("/favorites", { personaId })
```

---

## Bug 10: Logout does not clear the JWT token from localStorage

**File**: `apps/web/src/lib/auth.tsx`
**Category**: Auth / Session
**Severity**: High

**Problem**: The `logout` callback sets state to null but does NOT call `localStorage.removeItem("auth_token")`. On the next page reload, the stale token is read from localStorage, and the app tries to authenticate with it. If the server is still running (in-memory), this succeeds and the user is "logged back in" without intending to be.

**Fix**: Add `localStorage.removeItem("auth_token");` to the logout callback, before the state updates.

---

## Bug 11: Browse page query doesn't refetch when filters change

**File**: `apps/web/src/routes/index.tsx`
**Category**: UI / Frontend Logic
**Severity**: High

**Problem**: The TanStack Query key is `["personas"]` without including the search filters. When the user changes a filter (specialty, tier, sort, search text), the URL updates but the query key stays the same. TanStack Query returns the cached result and never refetches with the new filters.

**Fix**: Change `queryKey: ["personas"]` to `queryKey: ["personas", search]`

---

## Bug 12: Login response omits username

**File**: `apps/api/src/routes/auth.ts`
**Category**: Data Contract
**Severity**: Medium

**Problem**: The login route returns `{ id, email }` in the user object, omitting `username`. The frontend `AuthResponse` type expects `username` to be present. After login, the nav bar shows `undefined` instead of the user's name. (Registration works correctly because that route includes `username`.)

**Fix**: Add `username: user.username` to the login response user object:
```typescript
user: { id: user.id, username: user.username, email: user.email }
```

---

## Issue 13: Duplicated DB queries inlined into route handlers (Code Quality)

**Files**: `apps/api/src/routes/favorites.ts`, `apps/api/src/routes/checkout.ts`
**Category**: Code Quality
**Severity**: Medium

**Problem**: Two route files import the raw Maps (`personas`, `cartItems`, `favorites`) directly from `db.ts` and duplicate query logic that already exists in the `db` access layer. The favorites GET handler manually iterates `favoritesStore.get(userId)` and `personasStore.get(pid)` instead of using `db.favorites.getByUserId()` and `db.personas.getById()`. The checkout handler manually does `Array.from(cartItemsStore.values()).filter(...)` instead of using `db.cart.getByUserId()`. This means:

- Any change to the data access logic (e.g., adding caching, validation, or switching storage) must be made in multiple places.
- The duplicated code can silently diverge from the canonical `db` layer.
- The raw Map exports (`personas`, `cartItems`, `favorites`) leak internal storage details that should be encapsulated.

**Fix**: Remove the raw Map imports and use the `db` object's methods instead:

In `favorites.ts`:
```typescript
import { db } from "../db.js";
// ...
app.get("/favorites", async (request) => {
  const { id: userId } = request.user as { id: string };
  const personaIds = db.favorites.getByUserId(userId);
  const personas: Persona[] = [];
  for (const pid of personaIds) {
    const persona = db.personas.getById(pid);
    if (persona) personas.push(persona);
  }
  return { favorites: personas };
});
```

In `checkout.ts`:
```typescript
import { db } from "../db.js";
// ...
const cartEntries = db.cart.getByUserId(userId);
// ...
const persona = db.personas.getById(entry.personaId);
```

Also remove the `export` keyword from the raw Maps in `db.ts` (`personas`, `cartItems`, `favorites`) to re-encapsulate them.

---

## Issue 14: Auth middleware defaults to disabled when ENFORCE_AUTH is unset (Security Design)

**File**: `apps/api/src/middleware/auth.ts`
**Category**: Security Design
**Severity**: Critical

**Problem**: The `authenticate` middleware reads `process.env.ENFORCE_AUTH` and only enforces JWT verification when it equals `"true"`. If the env var is missing, misspelled, or set to any other value, **authentication is completely bypassed** -- every protected route (cart, favorites, checkout) becomes publicly accessible with no identity check.

This is a textbook "fail-open" security anti-pattern. The safe default should be the opposite: auth is always enforced unless explicitly disabled (fail-closed). In the current codebase there is no `.env` file and no documentation about this variable, so every fresh checkout runs with auth disabled.

```typescript
// DANGEROUS: defaults to auth OFF
const ENFORCE_AUTH = process.env.ENFORCE_AUTH === "true";

if (!ENFORCE_AUTH) {
  return; // skips all JWT verification
}
```

**Fix**: Invert the logic so auth is always on by default. If a developer needs to disable it locally, they must explicitly opt out:

```typescript
const SKIP_AUTH = process.env.SKIP_AUTH === "true";

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (SKIP_AUTH) {
    return;
  }

  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: "Unauthorized" });
  }
}
```

Or, better yet, remove the env-var escape hatch entirely since this is a small app with a proper auth flow:

```typescript
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: "Unauthorized" });
  }
}
```

## ONE-SHOT
```
@README.md Start the app, then launch app using agent-browser. 
Navigate and use the sites features, signup, signin, use chart, checkout, etc.
Identify and remediate found issues. 
```
