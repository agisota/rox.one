# T287 - Rebrand env-var docs update

Status: IN_PROGRESS
Phase: R.6
Ticket: docs/tickets/T287-rebrand-env-var-docs-update.md

## 1. Task summary

Rewrite operator-facing surfaces to name the canonical 16 env vars as
`ROX_*` first. Add a deprecation note where useful.

## 2. Repo context discovered

Operator surfaces in scope:

- `README.md` (developer + operator docs)
- `Dockerfile.server` (image build / runtime env)
- `.env.example` (the canonical env scaffolding)
- Root `package.json` scripts that inline `CRAFT_*` values

Legal-preserve files (`LICENSE`, `NOTICE`, `TRADEMARK.md`, the
`org.opencontainers.image.source` label in `Dockerfile.server`,
`apps/electron/resources/release-notes/*.md`, and any
`docs/worklog/T<id>-*.md` with `Status: DONE`) are out of scope.

## 3. Files inspected

- `README.md`
- `Dockerfile.server`
- `.env.example`
- `package.json` (root)
- the `docs/release/rebrand-mapping-2026-05-13.md` (if present)

## 4. Tests added first

The rebrand validator and roadmap validator stand in for tests on doc-only
changes. A reduction in `CRAFT_` findings (with no new findings introduced)
is the acceptance signal.

## 5. Expected failing test output

Pre-update baseline (from `bun run validate:rebrand`):

```
rebrand validation failed: 1485 forbidden token findings outside the allowlist
Findings by token:
  CRAFT_: 849
  craft-agent: 377
  craft-cli: 75
  @craft-agent: 57
  ...
```

The `CRAFT_` count is what T287 reduces.

## 6. Implementation changes

For each in-scope file, replace canonical `CRAFT_<name>` tokens with
`ROX_<name>`. Add a single "Deprecation" sentence where operators encounter
the shim.

## 7. Validation commands run

- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run lint`
- `bun run typecheck`

## 8. Passing test output summary

To be filled at green.

## 9. Build output summary

No build needed for docs/config changes.

## 10. Remaining risks

- `Dockerfile.server` defines a runtime user/group; the `ENV CRAFT_*`
  lines are independent of the user/group block. Renames are safe.
- The pre-existing `CRAFT_*` findings on `.env.example` from R.7+ work
  remain — R.6 only owns the 16 canonical names.

## 11. Acceptance criteria matrix

Filled at green.
