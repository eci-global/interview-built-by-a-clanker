# PR: Add Comprehensive End-to-End (E2E) Playwright Test Suite

## Summary

This PR introduces a full-featured Playwright E2E test suite for the application, covering all major user workflows from authentication to checkout and favorites. It adds dedicated test files for each workflow, a shared test helper module, and a Playwright configuration file. These changes ensure robust automated testing of the application's core user journeys.

---

## New End-to-End Test Workflows

| Area | File | Details |
|------|------|---------|
| **Authentication & Registration** | `e2e/01-auth.spec.ts` | Tests user registration, login, logout, session persistence, and error handling for invalid credentials or duplicate emails. |
| **Browsing, Search & Filter** | `e2e/02-browse-search-filter.spec.ts` | Verifies persona listing, search, specialty and tier filters, sorting, and empty state handling. |
| **Persona Detail & Access Control** | `e2e/03-persona-detail.spec.ts` | Ensures persona details display correctly and Add to Cart/favorite buttons are shown or hidden based on authentication state. |
| **Cart Management & Checkout** | `e2e/04-cart.spec.ts`, `e2e/05-checkout.spec.ts` | Tests adding/removing items, quantity changes, cart summary, checkout process, order confirmation, and cart emptying. |
| **Favorites & E2E Purchase** | `e2e/06-favorites.spec.ts`, `e2e/07-e2e-purchase.spec.ts` | Covers favoriting/unfavoriting personas and a full guest-to-purchase workflow, from browsing as a guest to registering, adding to cart, and completing checkout. |

---

## Test Infrastructure

| Addition | File | Details |
|----------|------|---------|
| **Test Helpers** | `e2e/helpers.ts` | Provides utility functions for common actions (register, login, add to cart, unique email generation) to DRY up test code. |
| **Playwright Config** | `playwright.config.ts` | Defines test directory, server startup, browser settings, and environment for Playwright tests. |

---

## How to verify

```bash
pnpm install
pnpm run build
pnpm exec playwright test
```

All E2E tests should pass, validating the application's critical user flows.
