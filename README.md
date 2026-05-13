# Agentic Personas Storefront - Debugging Assessment

Welcome. This is a monorepo storefront application for browsing and purchasing
AI-powered "Agentic Personas." The app was recently working, but a series of
bugs have been introduced across the stack. Your task is to find and fix them.

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend** (`apps/web`): React 19, TanStack Router, TanStack Query, Tailwind CSS v4
- **Backend** (`apps/api`): Fastify 5, JWT auth, in-memory database
- **Shared** (`packages/shared`): TypeScript types, Zod validation schemas

## Getting Started

```bash
corepack pnpm install
corepack pnpm build
corepack pnpm dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

## Verification

```bash
corepack pnpm lint
corepack pnpm test
corepack pnpm coverage
corepack pnpm typecheck
corepack pnpm build
corepack pnpm e2e
```

## Project Structure

```text
apps/
  api/           # Fastify REST API server
  web/           # React SPA
packages/
  shared/        # Shared TypeScript types and Zod schemas
```

## Persistence Model

The API uses process-local in-memory Maps for users, carts, favorites, and
orders. This is intentional for the local debugging assessment: data is reset
when the API process restarts and is not shared across multiple API instances.
A production deployment should replace this with durable storage.
