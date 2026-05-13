# Decision 0010: Shiki Highlighter Adapter

- Status: accepted
- Date: 2026-05-13
- Implements: Phase 11 of the Agent Workbench Suite master roadmap

## Context

The F.1 Shiki research pass documented three migration options for reducing
syntax-highlighting bundle cost. The renderer and UI package have legacy
callers that use the high-level `shiki` entry. That entry pulls in the
Oniguruma WASM path and broad language/theme metadata even when callers only
need common code-block highlighting.

PR #85 landed the first shared adapter code under
`packages/shared/src/highlight/`, but the ADR and ticket metadata were missing
from that merge. This decision record restores the required Phase 11 contract
before any renderer or UI call site migrates.

## Decision

Adopt research Option A for the shared adapter:

- build on `@shikijs/core` and `@shikijs/engine-javascript`;
- do not use the Oniguruma WASM engine for the adapter;
- preload a curated common-language set matching the existing code-block
  defaults;
- preload only themes represented by the shipped theme presets;
- expose an engine-agnostic `Highlighter` interface from
  `@rox-one/shared/highlight`;
- keep unsupported languages graceful by falling back to plain text.

The already-merged adapter remains opt-in. Renderer and UI call-site migration
stays in follow-up work so each surface can carry focused tests and visual
smoke evidence.

## Consequences

- The adapter is opt-in until call sites move to `@rox-one/shared/highlight`.
- Bundle policy can ratchet the adapter surface independently of the legacy
  UI highlighter.
- The curated language set intentionally shrinks the future picker surface.
  Any additional language must be justified with usage or release evidence.
- JS-regex highlighting may differ from Oniguruma for edge-case grammar
  constructs; the corpus test owns the supported baseline.

## Rejected Options

- Option B, dynamic full-language loading: preserves the broad picker, but
  adds async loading states and TipTap NodeView complexity before the product
  has evidence that the full language list is required.
- Option C, WASM-only removal while keeping full metadata: lower behavioral
  risk, but it leaves most grammar/theme payload in place and does not create
  the stable adapter boundary required by Phase 11.

## Follow-Up Tickets

- T242 records the migration plan and this ADR decision.
- T336 repairs the already-merged adapter slice with missing metadata and the
  corpus-test typecheck fix.
- Future call-site tickets migrate markdown, code-viewer, and TipTap surfaces
  before the legacy highlighter path is removed.

## Verification Gates

- `bun test packages/shared/src/highlight/__tests__/`
- `bun run validate:docs`
- `bun run validate:roadmap`
- `bun run validate:rebrand`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `git diff --check`
