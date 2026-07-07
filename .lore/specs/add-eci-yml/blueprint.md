# Blueprint: Add `eci.yml` Repository Metadata File

## Overview

This change introduces a single new file, `eci.yml`, at the repository root. The file declares the repository's owning product via a single top-level `product` field set to `demos`. This is a purely additive change: no existing files are modified, no tooling is wired up, and no application, build, or CI configuration changes. The file follows the YAML conventions already established in the repository (2-space indentation, minimal and hand-maintainable structure, consistent with `pnpm-workspace.yaml`).

The implementation is intentionally minimal to satisfy the specification's strict scope: create exactly one file with exactly one field. This provides a stable, machine-readable anchor that downstream tooling and platform services can rely on for product association, while leaving room for future metadata fields without any structural rework.

## Detailed plan

### New file: `eci.yml` (repository root)

Create a new file named `eci.yml` at the absolute repository root — the same directory that contains `package.json`, `turbo.json`, `tsconfig.base.json`, and `pnpm-workspace.yaml`. Root placement is the conventional, discoverable location for repository-level metadata and is consistent with how all other repo-wide config files in this monorepo are placed.

The file contents must be exactly:

```yaml
product: demos
```

Notes on the exact form and why:

- **Field name and value.** The single top-level key is `product` and its value is the unquoted scalar `demos`. The value `demos` is a plain YAML string containing only lowercase letters — it requires no quoting and parses unambiguously as a string in any standard YAML parser. Leaving it unquoted matches the minimal, human-readable style the spec calls for and avoids unnecessary noise. (The repo's existing YAML quotes strings only when required, e.g. glob patterns like `- "apps/*"`; a bare identifier like `demos` does not need quoting.)
- **Indentation.** There is no nested structure, so no indentation is needed. If future fields are added they should use 2-space indentation to match the repo's existing YAML files, but that is out of scope here.
- **Trailing newline.** End the file with a single trailing newline, consistent with normal text-file hygiene and the other config files in the repo. No trailing whitespace on the `product: demos` line.
- **No comments, no document markers.** Do not add YAML document start markers (`---`), comments, or additional keys. The spec restricts scope to the `product` field only.

### File extension: `.yml` vs `.yaml`

Use `eci.yml` exactly as named in the specification. The spec's title, overview, and functional requirements all reference `eci.yml` explicitly. Although the repository's existing YAML files use the `.yaml` extension (`pnpm-workspace.yaml`, `pnpm-lock.yaml`), the metadata manifest's name is dictated by organizational convention and the spec, not by local file-extension style. The `.yml` extension is a valid, widely recognized YAML extension and is what downstream tooling will look for.

### Version control

No `.gitignore` change is required. The existing `.gitignore` ignores only `node_modules/`, `dist/`, `.turbo/`, `*.tsbuildinfo`, `.env*`, and `.vite/`. None of these patterns match `eci.yml`, so the new file will be tracked by Git normally. Do not add any ignore entry for it.

### No other changes

Explicitly do not touch any of the following: `package.json`, `turbo.json`, `tsconfig.base.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, any file under `apps/`, `packages/`, `.lore/`, or `.lore-agent/`. No schemas, parsers, CI steps, or tooling should be created or modified to consume the file — this is confirmed out of scope by the spec.

## Decisions

- **Quoting of the value.** Decision: use the unquoted form `product: demos`. Rationale: `demos` is a simple identifier that parses safely as a string in all standard YAML parsers, and the unquoted form is the most human-readable and matches the repo's practice of quoting only when necessary.
- **File extension.** Decision: name the file `eci.yml` (not `eci.yaml`). Rationale: the specification names the file `eci.yml` throughout, and the manifest name is an external/organizational convention rather than something governed by the repo's internal `.yaml` file naming.
- **File location.** Decision: place `eci.yml` at the repository root alongside `package.json` and `turbo.json`. Rationale: this is the conventional, discoverable location for repo-level metadata and is explicitly required by the spec.
- **Document markers and comments.** Decision: omit `---` document markers and all comments. Rationale: the spec calls for a minimal file, and no downstream requirement mandates these markers.
- **Trailing newline.** Decision: include exactly one trailing newline and no trailing whitespace. Rationale: standard text-file hygiene consistent with the repo's other files; avoids spurious diffs.
- **Scope of fields.** Decision: include only the `product` field. Rationale: the spec explicitly restricts scope to `product` and lists ownership/tags/environments as out of scope.

## Verification

1. **File existence and location.** Confirm the file exists at the repository root:
   - Run `ls eci.yml` from the repo root; it should list the file.
   - Confirm it is a sibling of `package.json` and `turbo.json`.

2. **Exact contents.** Run `cat eci.yml` and confirm the output is exactly:
   ```yaml
   product: demos
   ```
   with a trailing newline and no other lines.

3. **YAML validity.** Verify the file is well-formed YAML using any standard parser. For example, with Node.js (the repo already uses the Node/pnpm toolchain):
   - `node -e "const fs=require('fs'); console.log(fs.readFileSync('eci.yml','utf8'))"` to inspect, and if a YAML parser is available, parse it and assert `product === 'demos'`.
   - Alternatively, if Python is available: `python3 -c "import yaml,sys; d=yaml.safe_load(open('eci.yml')); assert d=={'product':'demos'}, d; print('ok')"`.

4. **No unintended changes.** Run `git status` and confirm the only change is the addition of `eci.yml`. No existing files should be modified.

5. **No build impact.** Optionally run the repo's standard install/build (`pnpm install`, `pnpm build` / `pnpm turbo build`) to confirm the new file does not affect the toolchain. This is expected to be unaffected since nothing consumes `eci.yml`.

## Risks & notes

- **Very low risk.** This is a single additive metadata file with no code, build, or CI wiring. There is no existing `eci.yml` to conflict with (confirmed via grep), so there is no merge or overwrite risk.
- **Watch the extension.** Do not accidentally create `eci.yaml`; the required name is `eci.yml`. Tooling that discovers the manifest is expected to look for the `.yml` name.
- **Avoid over-engineering.** Resist adding comments, extra fields, or document markers. The spec's scope is strict; extra content could confuse downstream tooling or violate the intended minimal convention.
- **Encoding and line endings.** Save the file as UTF-8 with Unix (LF) line endings to match the rest of the repository and avoid noisy diffs.
- **No tooling verification available in-repo.** Since nothing in the repo currently parses `eci.yml`, verification of "recognition by downstream tooling" cannot be performed locally; validity is confirmed instead via generic YAML parsing as described in Verification.

## Task List

- [ ] **1. Create eci.yml metadata file** — Add a new eci.yml file at the repository root declaring a single top-level product field set to demos, using unquoted YAML with a trailing newline, UTF-8 encoding, and LF line endings.
- [ ] **2. Verify file contents and YAML validity** — Confirm the file exists at the repo root, contains exactly 'product: demos', and parses as valid YAML resolving product to demos.
- [ ] **3. Verify no unintended changes or build impact** — Confirm via version control that eci.yml is the only added file, no existing files are modified, and the standard toolchain remains unaffected.