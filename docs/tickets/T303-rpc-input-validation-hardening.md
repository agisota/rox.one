# T303-input-validation-hardening

Status: DONE

## Goal

Audit the RPC handler input surface in
`packages/server-core/src/handlers/rpc/`, ensure runtime validation at
every public boundary for the highest-risk handlers, and add tests for
malformed-input rejection.

M.13 security hardening phase. Builds on T243 (RBAC property-based
scope forgery tests) and T244 (schema reservation of `'*'`).

## Required Scope

- Document the validation state of every handler with `server.handle(…)`.
- Harden 2–3 HIGH-risk handlers that accept free-form strings used in
  filesystem paths, or that accept structured payloads without
  runtime narrowing.
- Reject at the boundary — no normalization inside handler bodies.
- Use the existing handler error shape; no new external deps.

## Hardened in this PR

| Handler        | Risk before | Hardening added                                                                                 |
| -------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `labels.ts`    | HIGH        | `parseId` on workspaceId/labelId; `parseCreateLabelInput` parses `{ name, color, parentId }`.   |
| `statuses.ts`  | MED         | `parseId` on workspaceId; `parseStringArray` on `orderedIds` (rejects non-array, ≤256 entries). |
| `skills.ts`    | HIGH        | `parseId` on workspaceId; `parseSlug` on `skillSlug` (rejects `..`, `/`, `\\`, NUL).            |

## Validators

New module `packages/server-core/src/handlers/rpc/_validators.ts`:

- `parseId(name, value)` — non-empty trimmable string, ≤256 chars, no
  control characters (NUL / ANSI escape / DEL).
- `parseSlug(name, value)` — `parseId` + rejects `..`, absolute paths,
  embedded backslashes, `*` / `.` meta tokens. Safe for `path.join`.
- `parseOptionalString(name, value)` — undefined/null pass through; any
  string runs through `parseId`.
- `parseStringArray(name, value, opts)` — array discriminator + per-item
  rules + length cap.
- `parseEnum(name, value, allowed)` — allow-list discriminator.
- `parseCreateLabelInput(value)` — narrow object schema mirroring
  `@rox-one/shared/labels::CreateLabelInput` with `color` accepting
  either a `SystemColor` string or a `CustomColor` `{ light, dark? }`
  object.

All parsers throw `Error & { code: 'INVALID_INPUT' }` to match the
existing handler error contract.

## Audit

`docs/release/rpc-input-validation-audit.md` documents every handler
file with `server.handle(…)`, its boundary-validation state, risk
classification, and remediation status. T052 and T071 are recorded as
follow-up tickets for MED-risk handlers.

## Constraints honored

- No new external deps. Zod is in `@rox-one/shared` but server-core does
  not depend on it; introducing the dep edge is out of scope for T303
  and deferred to T052/T071.
- `roles.ts` and `missions.ts` are explicitly **not touched** (other
  agents may be editing those).
- Handler logic preserved beyond the new input parse + early reject.
- LOC budgets: source 368 / 400; tests 309 / 400; audit 80 / 100.

## Required Tests

- `packages/server-core/src/handlers/rpc/__tests__/input-validation-hardening.test.ts`
- For every parser: reject empty payload, reject malformed type, reject
  unknown discriminator value where applicable, accept valid payload.

## Validation Commands

- `bun test packages/server-core/src/handlers/rpc/__tests__/`
- `bun run validate:rebrand`

## Acceptance Criteria

- [x] Audit doc lists every RPC handler file and its validation state.
- [x] HIGH-risk handlers (labels, statuses, skills) parse all
  non-context arguments at the boundary.
- [x] Path-traversal tokens (`..`, leading `/`, backslash, NUL) cannot
  reach `path.join` via the skills handler.
- [x] Control characters cannot reach domain logic or logs via any
  hardened handler.
- [x] `bun test packages/server-core/src/handlers/rpc/__tests__/`
  passes — 159 / 159 across 7 files (50 / 50 new + existing).
- [x] `bun run validate:rebrand` passes.
- [x] Pre-existing failures in `validate:agent-contract` (T223 Status
  format) and `validate:roadmap` (M.1.3b phase heading) confirmed
  unchanged from origin/main; out of scope for T303.
- [x] Worklog complete.
- [x] No new external dependencies introduced.

## Follow-ups

- **T052** — extend boundary parse to MED-risk handlers
  (`automations`, `files`, `messaging`, `oauth`, `onboarding`,
  `resources`, `sessions`, `settings`, `sources`).
- **T071** — formal Zod schemas for handlers with mature domain
  validators (`llm-connections`, `workspace`) once the dep edge is
  approved.
- **T303-roles** — separate audit pass for `roles.ts` after concurrent
  RBAC work lands.
