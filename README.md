# Agentic Personas Storefront

A Turborepo monorepo storefront application for browsing and purchasing AI-powered "Agentic Personas."

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend** (`apps/web`): React 19, TanStack Router, TanStack Query, Tailwind CSS v4
- **Backend** (`apps/api`): Fastify 5, JWT auth, in-memory database
- **Shared** (`packages/shared`): TypeScript types, Zod validation schemas

## Getting Started

```bash
pnpm install
pnpm build
pnpm dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

## Branches

- **`master`**: Clean, working codebase + answer key
- **`candidate-exam`**: Same codebase with 12 injected bugs for the interview assessment

## Running the Assessment

1. Have the candidate clone the repo and check out `candidate-exam`
2. They should read the README on that branch for instructions
3. See `ANSWER_KEY.md` (this branch only) for the full bug list and solutions

## Project Structure

```
apps/
  api/           # Fastify REST API server
  web/           # React SPA
packages/
  shared/        # Shared TypeScript types and Zod schemas
```
