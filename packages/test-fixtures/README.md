# @rox-one/test-fixtures

Shared test fixtures (fakes, configs, builders) that more than one test file in the monorepo consumes.

## Why this package exists

Tests across packages re-derive the same setup: a fake LLM provider, a synthetic permission context, a canonical bash-pattern table, etc. Inlining each fixture in every consumer file inflates the consumer (`mode-manager.test.ts` reached 2403 LOC) and lets fixtures drift apart silently. Hosting them here keeps consumers focused on assertions and gives every fixture exactly one source of truth.

## What belongs here

- Test data tables (regex patterns, schema fixtures, seed JSON).
- Fake/stub implementations of cross-cutting interfaces (LLM client, storage, auth context).
- Builders for complex domain objects under test.

## What does not belong here

- Production code. This package is `private` and never imported from `src/`.
- One-off fixtures that only one test file uses — keep those local.
- Real network or filesystem fakes that maintain global state — keep those colocated with the package they're testing.

## Layout

```
src/
  index.ts           # barrel
  <fixture-name>.ts  # one fixture per module
```

Add new fixtures by creating a module under `src/` and re-exporting from `src/index.ts`.
