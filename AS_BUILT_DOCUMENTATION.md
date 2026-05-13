# Agentic Personas Storefront - As-Built Documentation

## 1. System Overview

Agentic Personas Storefront is a local-development monorepo application for browsing, favoriting, carting, and checking out AI-powered "Agentic Personas." It is implemented as a React single-page application backed by a Fastify REST API and a shared TypeScript/Zod package for domain types and request validation.

The application is intentionally lightweight: all backend state is stored in memory, the product catalog is seeded at server startup, authentication uses JWTs with a hard-coded development secret, and the frontend stores the token in browser `localStorage`.

## 2. Repository Layout

```text
apps/
  api/       Fastify REST API server
  web/       React SPA served by Vite
packages/
  shared/    Shared TypeScript types and Zod schemas
```

Root-level tooling:

- `package.json`: monorepo scripts delegated to Turborepo.
- `pnpm-workspace.yaml`: includes `apps/*` and `packages/*`.
- `turbo.json`: defines `build`, `dev`, `typecheck`, `lint`, and `clean` task graph.
- `tsconfig.base.json`: shared strict TypeScript compiler settings.

## 3. Technology Stack

### Frontend

- React 19
- Vite 6
- TanStack Router 1.92 file-based routing
- TanStack Query 5 for server-state caching
- Tailwind CSS 4 through the Vite plugin

### Backend

- Fastify 5
- `@fastify/cors`
- `@fastify/jwt`
- In-memory data store

### Shared Package

- TypeScript
- Zod validation schemas
- Workspace package name: `@acme/shared`

## 4. Runtime Topology

```text
Browser SPA
  |
  | HTTP JSON requests, Authorization: Bearer <token> when present
  v
Fastify API on http://localhost:3001
  |
  v
In-memory Maps seeded at process startup
```

Default local ports:

- Web: `http://localhost:5173`
- API: `http://localhost:3001`

CORS is configured on the API to allow `http://localhost:5173` with credentials and methods `GET`, `POST`, `PUT`, and `OPTIONS`.

## 5. Build and Run

Expected commands from the README:

```bash
pnpm install
pnpm build
pnpm dev
```

Root scripts:

- `pnpm build`: runs `turbo build`.
- `pnpm dev`: runs `turbo dev`.
- `pnpm typecheck`: runs `turbo typecheck`.
- `pnpm lint`: runs `turbo lint`.
- `pnpm clean`: runs `turbo clean`.

Verification note: this environment could not run the scripts because `pnpm` is not installed or not on PATH.

## 6. Shared Domain Model

The shared package exports Zod schemas and inferred TypeScript types from `packages/shared/src/index.ts`.

### Persona

Defined in `packages/shared/src/schemas/persona.ts`.

Fields:

- `id`: string
- `name`: string
- `tagline`: string
- `description`: string
- `avatarUrl`: string
- `specialty`: one of `Engineering`, `Design`, `Data`, `Security`, `DevOps`, `Product`
- `capabilities`: string array
- `price`: number
- `rating`: number from 1 to 5
- `reviewCount`: number
- `tier`: one of `Starter`, `Pro`, `Enterprise`

Supported persona filters:

- `q`: full-text search across name, tagline, description, and capabilities
- `specialty`
- `tier`
- `minPrice`
- `maxPrice`
- `sort`: `price-asc`, `price-desc`, `rating-desc`, or `name-asc`

### Auth

Register input:

- `username`: 3 to 30 chars
- `email`: valid email
- `password`: minimum 6 chars

Login input:

- `email`: valid email
- `password`: string

User:

- `id`
- `username`
- `email`

Auth response:

- `token`
- `user`

### Cart

Cart item:

- `id`
- `personaId`
- `persona`
- `quantity`: integer >= 1

Add-to-cart input:

- `personaId`
- `quantity`: integer >= 1, default 1

Update-cart input:

- `quantity`: integer >= 1

Cart response:

- `items`
- `total`

### Order

Checkout input:

- `name`: non-empty string
- `email`: valid email

Order:

- `id`
- `userId`
- `items`
- `total`
- `customerName`
- `customerEmail`
- `createdAt`

## 7. Backend Implementation

### Server Entrypoint

`apps/api/src/index.ts` creates a Fastify app with logging enabled, registers CORS and JWT plugins, then mounts route groups:

- Personas
- Auth
- Cart
- Favorites
- Checkout

It also exposes `GET /health`, returning:

```json
{ "status": "ok" }
```

The API listens on port `3001` and host `0.0.0.0`.

### In-Memory Database

`apps/api/src/db.ts` owns all persisted application state:

- `personas`: `Map<string, Persona>`
- `users`: `Map<string, StoredUser>`
- `cartItems`: `Map<string, CartEntry>`
- `favorites`: `Map<string, Set<string>>`
- `orders`: `Map<string, Order>`

The catalog is seeded at module load with 15 personas. State is lost whenever the API process restarts.

ID generation is process-local:

- Cart items: `cart-1`, `cart-2`, ...
- Orders: `order-1`, `order-2`, ...
- Users: `user-1`, `user-2`, ... from the auth route module

### Authentication

`apps/api/src/routes/auth.ts` implements registration, login, and current-user lookup.

Passwords are stored using a simple non-cryptographic hash function. This is suitable only for a debugging/local assessment and must not be treated as production security.

JWT payload:

```json
{
  "id": "user-1",
  "email": "user@example.com"
}
```

JWT secret:

```text
agentic-personas-dev-secret
```

Auth middleware in `apps/api/src/middleware/auth.ts` only verifies JWTs when `ENFORCE_AUTH=true`. Without that environment variable, the middleware returns without calling `request.jwtVerify()`.

Important as-built implication: protected route handlers assume `request.user.id` exists. If `ENFORCE_AUTH` is not true, authenticated API routes can fail at runtime because `request.user` may be undefined.

### API Endpoints

#### Health

`GET /health`

Returns API health status.

#### Personas

`GET /personas`

Returns an array of personas. Supports query parameters:

- `q`
- `specialty`
- `tier`
- `minPrice`
- `maxPrice`
- `sort`

`GET /personas/:id`

Returns one persona or `404`:

```json
{ "error": "Persona not found" }
```

#### Auth

`POST /auth/register`

Request:

```json
{
  "username": "janedoe",
  "email": "jane@example.com",
  "password": "secret123"
}
```

Responses:

- `201` with `{ token, user }`
- `400` for validation errors
- `409` when the email already exists

`POST /auth/login`

Request:

```json
{
  "email": "jane@example.com",
  "password": "secret123"
}
```

Responses:

- `200` with auth response
- `400` for validation errors
- `401` for invalid credentials

As built, the login response omits `username` from `user`, even though the shared `AuthResponse` type expects it.

`GET /auth/me`

Intended to return the authenticated user. Requires a valid JWT when auth enforcement is enabled.

#### Cart

All cart routes register the auth pre-handler.

`GET /cart`

Returns:

```json
{
  "items": [],
  "total": 0
}
```

`POST /cart`

Request:

```json
{
  "personaId": "p-001",
  "quantity": 1
}
```

Behavior:

- Validates input.
- Verifies the persona exists.
- Adds a new cart item or increments quantity for an existing persona.
- Returns the enriched cart.

`PUT /cart/:itemId`

Request:

```json
{ "quantity": 2 }
```

Behavior:

- Validates quantity.
- Requires the item to belong to the current user.
- Updates and returns the enriched cart.

`DELETE /cart/:itemId`

Behavior:

- Removes a cart item.
- Returns the enriched cart.

As built, delete verifies that the item exists but does not verify it belongs to the current user before deleting it.

#### Favorites

All favorite routes register the auth pre-handler.

`GET /favorites`

Returns:

```json
{
  "favorites": [/* Persona[] */]
}
```

`POST /favorites`

Request:

```json
{ "personaId": "p-001" }
```

Adds the persona ID to the current user's favorite set.

`DELETE /favorites/:personaId`

Removes a favorite for the current user.

#### Checkout

`POST /checkout`

Request:

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

Behavior:

- Validates contact info.
- Reads current user's cart.
- Rejects empty cart with `400`.
- Builds an order with enriched cart items and rounded total.
- Stores the order.
- Returns `201` with the created order.

As built, checkout does not clear the user's cart after order creation, even though the frontend invalidates cart queries afterward.

## 8. Frontend Implementation

### Entrypoint

`apps/web/src/main.tsx` renders the app into `#root`, wrapping it with:

- `QueryClientProvider`
- `AuthProvider`
- `RouterProvider`

The router is created from generated `routeTree.gen.ts`.

### API Client

`apps/web/src/lib/api.ts` centralizes HTTP calls.

Behavior:

- Base URL is hard-coded to `http://localhost:3001`.
- Sends `Content-Type: application/json`.
- Reads `auth_token` from `localStorage`.
- Adds `Authorization: Bearer <token>` when a token exists.
- Throws `ApiError` for non-2xx responses.

### Auth State

`apps/web/src/lib/auth.tsx` provides:

- `user`
- `token`
- `isLoading`
- `login(response)`
- `logout()`

On startup, the provider reads `auth_token` from `localStorage` and calls `GET /auth/me` when a token exists.

As built, `logout()` clears React state but does not remove `auth_token` from `localStorage`, so a browser refresh can restore the old token.

### Query Client

`apps/web/src/lib/queryClient.ts` configures TanStack Query:

- `staleTime`: 60 seconds
- `retry`: 1
- `refetchOnWindowFocus`: false

### Routes and Screens

#### Root Layout

`apps/web/src/routes/__root.tsx`

Provides the global shell:

- Sticky top navigation
- Browse link
- Favorites link for signed-in users
- Cart icon and count for signed-in users
- Sign-in/sign-up links for anonymous users
- Outlet for route content

Cart count is fetched from `GET /cart` using query key `["cart-count"]`.

#### Browse

`apps/web/src/routes/index.tsx`

Path: `/`

Responsibilities:

- Parse URL search parameters.
- Build persona search query string.
- Fetch `GET /personas`.
- Render search bar, filter panel, loading skeletons, empty state, or persona cards.

Search parameters:

- `q`
- `specialty`
- `tier`
- `minPrice`
- `maxPrice`
- `sort`

As built, the persona list query key is always `["personas"]`, so changes to search/filter parameters may not trigger a refetch as intended.

#### Persona Detail

`apps/web/src/routes/personas/$personaId.tsx`

Path: `/personas/:personaId`

Responsibilities:

- Fetch persona details.
- Fetch favorites.
- Show metadata, capabilities, rating, and price.
- Let signed-in users add to cart.
- Let signed-in users toggle favorites.

As built, the favorites query is enabled even for anonymous users, which can call a protected endpoint before sign-in.

As built, favorite toggle logic is inverted: when `isFavorited` is false it calls delete, and when true it calls post.

As built, add-to-cart invalidates `["cart"]`, but the nav cart count uses `["cart-count"]`, so the nav badge can remain stale.

#### Cart

`apps/web/src/routes/cart.tsx`

Path: `/cart`

Responsibilities:

- Require a signed-in user at UI level.
- Fetch cart.
- Update quantities.
- Remove items.
- Show order summary.
- Navigate to checkout.

As built, the minus button can send quantity `0`; the backend rejects this because quantity must be at least 1. The button has disabled styling but no `disabled` prop.

#### Checkout

`apps/web/src/routes/checkout.tsx`

Path: `/checkout`

Responsibilities:

- Require a signed-in user at UI level.
- Fetch current cart.
- Collect customer name and email.
- Submit checkout.
- Show order confirmation.

As built, successful checkout invalidates the cart query, but the backend does not clear cart state.

#### Favorites

`apps/web/src/routes/favorites.tsx`

Path: `/favorites`

Responsibilities:

- Require a signed-in user at UI level.
- Fetch favorites.
- Render favorited persona cards.
- Remove favorites.

#### Login

`apps/web/src/routes/login.tsx`

Path: `/login`

Responsibilities:

- Collect email and password.
- Submit `POST /auth/login`.
- Store auth response through `AuthProvider.login`.
- Navigate to browse page.

As built, because API login omits `username`, the nav username can render blank after login until `/auth/me` refreshes user state.

#### Register

`apps/web/src/routes/register.tsx`

Path: `/register`

Responsibilities:

- Collect username, email, and password.
- Submit `POST /auth/register`.
- Store auth response through `AuthProvider.login`.
- Navigate to browse page.

### Components

`PersonaCard`

- Links to a persona detail route.
- Displays avatar, name, tier, tagline, capabilities, rating, review count, and price.
- As built, card price is displayed as `persona.price * 100`, inflating visible prices by 100x.

`SearchBar`

- Local controlled input with 300 ms debounce.
- Syncs local state when URL-derived value changes.
- Calls `onChange` with the search string.

`FilterPanel`

- Renders specialty, tier, and sort controls.
- Toggles active filters by passing `undefined` when the active option is clicked again.

`CartItem`

- Displays item information, quantity controls, subtotal, and remove button.
- Quantity decrement does not prevent values below 1 at the UI layer.

`StarRating`

- Renders five SVG stars with full/partial fill behavior.
- Uses a repeated `id="half"` gradient, which can cause duplicate SVG ID behavior when multiple stars/components are rendered.

## 9. Data Flows

### Anonymous Browsing

1. Browser loads `/`.
2. Browse route parses URL search parameters.
3. TanStack Query calls `GET /personas`.
4. API searches the seeded in-memory persona map.
5. Persona cards link to detail pages.

### Registration

1. User submits register form.
2. Frontend posts to `/auth/register`.
3. API validates request with Zod.
4. API checks duplicate email.
5. API creates a user in memory with a simple password hash.
6. API signs JWT.
7. Frontend stores token in `localStorage` and auth context.

### Login

1. User submits login form.
2. Frontend posts to `/auth/login`.
3. API validates credentials against the in-memory user map.
4. API signs JWT.
5. Frontend stores token in `localStorage` and auth context.

### Cart Add/Update/Remove

1. Signed-in user clicks add-to-cart or uses cart controls.
2. Frontend sends bearer token.
3. API auth middleware is intended to verify token.
4. API mutates `cartItems` map.
5. API returns enriched cart with persona records and total.
6. Frontend invalidates cart-related queries.

### Favorites

1. Signed-in user favorites a persona.
2. API stores persona ID in a `Set` keyed by user ID.
3. Favorites page fetches IDs and returns full persona objects.

### Checkout

1. Signed-in user submits checkout contact info.
2. API validates checkout input.
3. API reads the user's cart entries.
4. API creates an order with current item snapshots.
5. API stores the order in memory and returns it.
6. Frontend displays an order confirmation.

## 10. Security and Operational Characteristics

This codebase is built for local assessment, not production.

Notable characteristics:

- JWT secret is hard-coded.
- Password hashing is non-cryptographic.
- Data is in-memory and non-durable.
- Auth enforcement depends on `ENFORCE_AUTH=true`.
- Frontend route protection is UI-only; backend enforcement must be correct for real protection.
- API base URL and CORS origin are hard-coded to localhost.
- No rate limiting, CSRF strategy, secure cookies, refresh tokens, or production session management.

## 11. Observed Defects and Risks

The README states that bugs were intentionally introduced. The following issues were identified during static evaluation:

1. `pnpm` was unavailable in the current shell, so build/typecheck could not be executed here.
2. Auth middleware skips JWT verification unless `ENFORCE_AUTH=true`, but protected handlers assume `request.user` exists.
3. API login response omits `username`, violating the shared `AuthResponse` shape.
4. Frontend logout does not remove `auth_token` from `localStorage`.
5. Browse page uses a static query key `["personas"]`, so filter/search changes may reuse stale cached results.
6. Persona card displays `persona.price * 100`, making prices 100 times too high.
7. Persona detail favorites query runs even when anonymous.
8. Persona detail favorite toggle is inverted.
9. Add-to-cart invalidates `["cart"]`, while nav cart count reads `["cart-count"]`.
10. Cart decrement can submit quantity `0`.
11. Cart delete does not check item ownership before removal.
12. Checkout creates an order but does not clear the cart.
13. `db.personas.search` applies `minPrice` as `price <= minPrice`; conventional minimum-price filtering should be `price >= minPrice`.
14. `StarRating` reuses the same SVG gradient ID for partial stars.
15. Several display strings in source files show mojibake characters, suggesting encoding issues in existing text.

## 12. Current Functional Specification

### Persona Catalog

The system shall provide a browsable list of seeded personas. Users can search by text, filter by specialty and tier, and sort by rating, price, or name.

### Account Management

The system shall allow users to register with username, email, and password. The system shall allow users to log in with email and password. On successful auth, the system shall issue a JWT and the frontend shall persist it locally.

### Persona Details

The system shall provide a detail view for each persona, including profile information, price, rating, tier, specialty, and capabilities.

### Favorites

Signed-in users shall be able to add personas to favorites, view their favorites, and remove favorites.

### Cart

Signed-in users shall be able to add personas to a cart, increment/decrement quantities, remove items, view totals, and proceed to checkout.

### Checkout

Signed-in users with non-empty carts shall be able to submit contact information and create an order. The system shall return an order confirmation with ID, total, and customer email.

## 13. Non-Functional Specification

### Availability

The app is intended to run locally with both API and web dev servers active. No external database is required.

### Persistence

No durable persistence exists. Users, carts, favorites, and orders reset on API restart.

### Performance

The seeded dataset contains only 15 personas. Search and filters run synchronously in process over in-memory arrays.

### Validation

Request validation is implemented with Zod for auth, cart, checkout, and shared domain schemas. Some route query parsing is manual rather than schema-driven.

### Generated Code

`apps/web/src/routeTree.gen.ts` is generated by TanStack Router and should not be manually edited.

