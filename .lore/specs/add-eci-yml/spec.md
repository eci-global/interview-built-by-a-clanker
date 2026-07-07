# Spec: Add eci.yml

_Generated: 2026-07-07T22:21:54.291Z_

---

# Add `eci.yml` Repository Metadata File

## Overview
This change introduces a repository-level metadata manifest (`eci.yml`) that declares the repository's owning product. The `product` field will be set to `demos`. This gives tooling and internal platform services a reliable, machine-readable way to associate this repository with its product for cataloging, ownership, and automation purposes.

## Goals
- Establish a canonical `eci.yml` metadata file for this repository.
- Explicitly associate the repository with the `demos` product.
- Provide a stable anchor for future metadata fields without further structural changes.

## Current State
The repository currently has no `eci.yml` file and no machine-readable declaration of its owning product. As a result, the repo is flagged as having an unresolved product association (missing product metadata).

## Requirements

### Functional
- The repository must contain an `eci.yml` metadata file at the repository root.
- The file must declare a `product` value of `demos`.
- The file must be valid, well-formed YAML that can be parsed by standard tooling.

### Non-Functional
- The file should be minimal and human-readable so it can be maintained by hand.
- The structure should follow the organization's expected metadata conventions so it is recognized by downstream tooling.

## Key Decisions
- **Product value = `demos`**: The repository is being categorized under the `demos` product per the user's direction.
- **Root placement**: The manifest lives at the repository root, the conventional and discoverable location for repo-level metadata.
- **Scope kept to product only**: Only the `product` field is required for this change; no additional metadata fields are introduced.

## Scope Boundaries

**In scope**
- Creating the `eci.yml` file.
- Setting `product` to `demos`.

**Out of scope**
- Adding other metadata fields (ownership, tags, environments, etc.).
- Wiring up or modifying any tooling that consumes the file.
- Changes to application code, build, or CI configuration.