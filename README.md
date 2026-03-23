# Agentic Personas Storefront — Debugging Assessment

Welcome! This is a monorepo storefront application for browsing and purchasing AI-powered "Agentic Personas." The app was recently working, but a series of bugs have been introduced across the stack. Your task is to find and fix them.

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

## Your Task

There are bugs scattered throughout the frontend, backend, and shared packages. Some will be immediately obvious (build failures, runtime crashes), while others are more subtle (incorrect behavior, broken features).

Work through the application and fix as many issues as you can. We're evaluating:

- **Debugging approach** — How you identify and isolate problems
- **Code comprehension** — How quickly you orient yourself in an unfamiliar codebase
- **Quality of fixes** — Whether your solutions are correct and clean

Feel free to use any tools or techniques you'd normally use on the job.

## Project Structure

```
apps/
  api/           # Fastify REST API server
  web/           # React SPA
packages/
  shared/        # Shared TypeScript types and Zod schemas
```
