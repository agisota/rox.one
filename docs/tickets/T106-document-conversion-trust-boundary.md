# T106 - Document Conversion Trust Boundary

Status: DONE

## Context

T104 records critical/high dependency risk in document conversion paths
(`markitdown-js`, `xmldom`, `xlsx`, `node-tesseract-ocr`, and
`exiftool-vendored`). The current RC keeps these paths private/local, but the
runtime seam does not make the local-only trust boundary explicit.

## Goal

Add a narrow server-core trust-boundary guard so Office/document conversion
cannot be silently reused for untrusted public ingestion without an explicit
rejected path.

## Required UI

No UI change.

## Required Data/API

- Keep current local, user-initiated attachment conversion working.
- Reject `public-untrusted` document conversion before invoking the converter.
- Keep failure messages actionable and avoid logging document content.
- Do not change dependency versions or dependency manifests.

## Required Automations

- Add a focused unit regression for the rejected public/untrusted conversion
  path.
- Keep existing local conversion adapter tests green.

## Required Subagents

No subagent required: this is a bounded server-core trust-boundary slice.

## TDD Requirements

Before implementation:

1. Update the office-document adapter test to cover `public-untrusted`
   conversion.
2. Run the focused adapter test and confirm it fails for the expected missing
   guard.

## Implementation Requirements

- Add an explicit conversion trust input to the adapter.
- Default existing call sites to the current local/private behavior.
- Pass the local trust value from the attachment storage handler.
- Do not add new dependencies.

## Validation Commands

- `bun test packages/server-core/src/services/office-document-adapter.test.ts`
- `bun test packages/server-core/src/handlers/rpc/files.test.ts`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Public/untrusted conversion test fails before guard and passes after | DONE |
| Public/untrusted conversion rejects before invoking converter | DONE |
| Existing local Office conversion behavior remains green | DONE |
| Dependency manifests and lockfiles remain unchanged | DONE |
| Docs validation passes | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T106-document-conversion-trust-boundary.md`.
