# Agentic Personas Storefront — Architecture Overview

## High-Level Overview

This is an **"Agentic Personas Storefront"** — a full-stack e-commerce app for browsing and purchasing fictional AI agent personas. It's built as a **Turborepo monorepo** with three packages:

---

## End-to-End Architecture Diagram

```mermaid
flowchart TB
    subgraph SHARED["📦 @acme/shared — Shared Package"]
        direction TB
        S1["persona.ts\nPersona types, tiers,\nspecialties & Zod schemas"]
        S2["auth.ts\nLogin/Register schemas,\nUser & AuthResponse types"]
        S3["cart.ts\nCartItem, AddToCart,\nUpdateCartItem schemas"]
        S4["order.ts\nCheckout & Order\nschemas"]
    end

    subgraph API["⚙️ @acme/api — Fastify Backend (port 3001)"]
        direction TB
        IDX["index.ts\nBootstraps Fastify,\nregisters CORS, JWT & routes"]
        DB["db.ts\nIn-memory Maps for\npersonas, users, cart,\nfavorites, orders\n+ seed data (15 personas)"]
        MW["middleware/auth.ts\nJWT verification\npreHandler hook"]
        R1["routes/personas.ts\nGET /personas\nGET /personas/:id"]
        R2["routes/auth.ts\nPOST /auth/register\nPOST /auth/login\nGET /auth/me"]
        R3["routes/cart.ts\nGET /cart\nPOST /cart\nPUT /cart/:itemId\nDELETE /cart/:itemId"]
        R4["routes/favorites.ts\nGET /favorites\nPOST /favorites\nDELETE /favorites/:personaId"]
        R5["routes/checkout.ts\nPOST /checkout"]
        IDX --> DB
        IDX --> MW
        IDX --> R1
        IDX --> R2
        IDX --> R3
        IDX --> R4
        IDX --> R5
        R1 --> DB
        R2 --> DB
        R3 --> DB
        R4 --> DB
        R5 --> DB
        R2 --> MW
        R3 --> MW
        R4 --> MW
        R5 --> MW
    end

    subgraph WEB["🖥️ @acme/web — React SPA (port 5173)"]
        direction TB
        MAIN["main.tsx\nMounts React,\nQueryClient, AuthProvider,\nRouter"]
        APICL["lib/api.ts\nHTTP client wrapper\n(fetch + JWT token)"]
        AUTH["lib/auth.tsx\nAuthContext &\nAuthProvider\n(login/logout state)"]
        QC["lib/queryClient.ts\nTanStack Query\nclient config"]

        ROOT["routes/__root.tsx\nNavbar, cart badge,\nuser menu, Outlet"]
        PG1["routes/index.tsx\nBrowse page — search,\nfilter & persona grid"]
        PG2["routes/personas/\n$personaId.tsx\nPersona detail — add\nto cart, toggle favorite"]
        PG3["routes/login.tsx\nLogin form"]
        PG4["routes/register.tsx\nRegistration form"]
        PG5["routes/cart.tsx\nCart page — quantities,\nremove, checkout link"]
        PG6["routes/checkout.tsx\nCheckout form &\norder confirmation"]
        PG7["routes/favorites.tsx\nFavorites grid"]

        C1["components/PersonaCard.tsx\nCard UI for persona listing"]
        C2["components/SearchBar.tsx\nDebounced search input"]
        C3["components/FilterPanel.tsx\nSpecialty/Tier/Sort filters"]
        C4["components/CartItem.tsx\nSingle cart row + controls"]
        C5["components/StarRating.tsx\nStar rating display"]

        MAIN --> AUTH
        MAIN --> QC
        MAIN --> ROOT
        ROOT --> PG1
        ROOT --> PG2
        ROOT --> PG3
        ROOT --> PG4
        ROOT --> PG5
        ROOT --> PG6
        ROOT --> PG7
        PG1 --> C1
        PG1 --> C2
        PG1 --> C3
        PG5 --> C4
        C1 --> C5
        PG2 --> C5
        PG1 --> APICL
        PG2 --> APICL
        PG3 --> APICL
        PG4 --> APICL
        PG5 --> APICL
        PG6 --> APICL
        PG7 --> APICL
    end

    SHARED -.->|"types & schemas"| API
    SHARED -.->|"types"| WEB
    APICL -->|"HTTP REST"| IDX
```

---

## Module-by-Module ELI5

### `@acme/shared` — The Shared Dictionary

> *"The rulebook everyone agrees on."*

| File | What it does (ELI5) |
|---|---|
| **persona.ts** | Defines what an AI persona looks like (name, price, tier, specialty, rating) and what filters you can use to search them. Like a product spec sheet. |
| **auth.ts** | Defines the shape of login/register forms and what a "user" looks like. The bouncer's checklist. |
| **cart.ts** | Defines what a shopping cart item looks like and what info you need to add/update one. |
| **order.ts** | Defines what a completed order looks like after checkout. The receipt format. |

### `@acme/api` — The Backend (Fastify, port 3001)

> *"The shop's warehouse and cash register."*

| File | What it does (ELI5) |
|---|---|
| **index.ts** | Starts the server, enables CORS for the frontend, sets up JWT auth, and plugs in all the route handlers. The "open for business" switch. |
| **db.ts** | An in-memory fake database using JavaScript Maps. Pre-loads 15 seed personas. Provides CRUD helpers for personas, users, cart, favorites, and orders. Think of it as a spreadsheet in RAM. |
| **middleware/auth.ts** | Checks if a user's JWT token is valid before letting them hit protected routes. The security guard at the door. |
| **routes/personas.ts** | Lets anyone browse personas with search/filter/sort, or view a single persona by ID. The product catalog. |
| **routes/auth.ts** | Handles sign-up, login (returns a JWT token), and "who am I?" checks. The front desk / ID counter. |
| **routes/cart.ts** | Lets logged-in users add personas to their cart, change quantities, or remove items. The shopping basket handler. |
| **routes/favorites.ts** | Lets users save/unsave personas they like. The wishlist manager. |
| **routes/checkout.ts** | Takes the cart, creates an order record, and returns a confirmation. The cashier. |

### `@acme/web` — The Frontend (React SPA, port 5173)

> *"The storefront window and shopping experience."*

| File | What it does (ELI5) |
|---|---|
| **main.tsx** | Wires everything together — React, the query cache, auth state, and the router. The "turn on the lights" file. |
| **lib/api.ts** | A small HTTP helper that attaches the user's JWT token to every request. The messenger between frontend and backend. |
| **lib/auth.tsx** | Keeps track of whether you're logged in and who you are, using React Context. The "remember me" system. |
| **lib/queryClient.ts** | Configures TanStack Query (data caching, retries, staleness). The smart cache layer. |
| **routes/__root.tsx** | The persistent navbar with logo, Browse/Favorites links, cart badge with item count, and sign-in/sign-out buttons. The top bar you always see. |
| **routes/index.tsx** | The main browse page — search bar, specialty/tier/sort filters, and a grid of persona cards. The shop floor. |
| **routes/personas/$personaId.tsx** | Detailed view of a single persona — description, capabilities, add-to-cart, and favorite toggle. The product page. |
| **routes/login.tsx** / **register.tsx** | Login and registration forms. The sign-in / sign-up doors. |
| **routes/cart.tsx** | Shows cart items with quantity controls, per-item pricing, total, and a "Proceed to Checkout" button. The shopping cart view. |
| **routes/checkout.tsx** | Collects name/email, shows order summary, places the order, and shows confirmation. The checkout counter. |
| **routes/favorites.tsx** | Grid of favorited personas with remove buttons. Your wishlist page. |
| **components/** | Reusable UI pieces: `PersonaCard` (product tile), `SearchBar` (debounced input), `FilterPanel` (sidebar filters), `CartItem` (cart row), `StarRating` (star display). |

---

## End-to-End User Flow

1. **Browse** → User lands on `/`, frontend fetches `GET /personas` with optional query params
2. **View Detail** → Click a card → `/personas/:id`, fetches `GET /personas/:id`
3. **Register/Login** → `/register` or `/login` → `POST /auth/register` or `POST /auth/login` → receives JWT token stored in `localStorage`
4. **Add to Cart** → On detail page, click "Add to Cart" → `POST /cart` (JWT required)
5. **Favorite** → Toggle heart button → `POST /favorites` or `DELETE /favorites/:id`
6. **Review Cart** → `/cart` → `GET /cart` → adjust quantities (`PUT /cart/:itemId`) or remove (`DELETE /cart/:itemId`)
7. **Checkout** → `/checkout` → `POST /checkout` with name + email → order created, cart cleared, confirmation shown
