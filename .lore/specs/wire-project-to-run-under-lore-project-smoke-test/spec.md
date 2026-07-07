# Spec: Wire project to run under lore project-smoke-test action

_Generated: 2026-07-07T22:32:04.094Z_

---

# Wire project to run under lore project-smoke-test action

## Overview

## Intent

Enable this project to be exercised by Lore's `project-smoke-test` action so it can be automatically set up, built, verified, started, and browsed inside a sandbox as part of the agentic SDLC workflow.

## Why

The standard smoke-test action provides an automated way to validate that the application builds and runs, and to capture screenshots of key pages. Today the action's defaults are tailored to the Lore reference stack (Postgres, .NET Aspire, auth bypass, port 3000 with Lore-specific routes), which do not match this project. This project is a simpler TypeScript monorepo with an in-memory data store, a Fastify API, and a Vite frontend on different ports, so it needs its own wiring for the action to work correctly.

## Goals

- Make the smoke-test action able to install dependencies, build, verify, and launch this app end to end.
- Ensure the action targets the correct frontend base URL and navigates only to pages that render meaningfully without extra setup.
- Account for this project's differences from the Lore reference: no database daemon, no auth-bypass mechanism, and no existing test/lint suites.
- Clearly surface caveats so future runs (and any decision to screenshot authenticated pages) are informed.

## Considerations

- The app has no dev-auth bypass, so authenticated routes (cart, favorites, checkout) cannot be browsed without adding one; the smoke test should focus on public pages unless a bypass is introduced.
- There is currently no test or lint suite, so the verification signal is limited to typechecking.
- The app intentionally contains seeded bugs, so build/verify phases may legitimately fail until those are addressed.

## Acceptance criteria

- The smoke-test action can install this project's dependencies (including dev dependencies) without manual intervention.
- The build phase compiles the full monorepo and typechecks successfully when the code is healthy.
- The verification phase runs and passes using the strongest available signal (typecheck), given no test suite exists.
- The start phase launches the API and confirms it is healthy before serving the frontend, then keeps the frontend running for browsing.
- The action is configured to use the correct frontend base URL for this project rather than the default.
- The action browses only public pages that render without authentication.
- Documentation or configuration notes clearly flag the absence of an auth bypass, the lack of a test suite, and that no database or .NET setup is required.