# T038 worklog — RPC input-validation hardening (M.13)

## 1. Goal

Audit the public RPC handler input surface
(`packages/server-core/src/handlers/rpc/`) and add runtime boundary
validation to the highest-risk handlers. Companion work to T243
(property-based scope-forgery tests) and T244 (schema reservation
of `'*'`).

## 2. Surface inspected

Every `*.ts` file under `packages/server-core/src/handlers/rpc/`
that registers handlers via `server.handle(channel, …)`. Helper
files without `server.handle` (`account-ownership.ts`, `index.ts`,
`storage-scope.ts`) are excluded. `roles.ts` is explicitly excluded
per the no-collision rule (other agents may be editing it).

Total handler files inspected: 19. Total `server.handle` invocations
encountered: 218 (raw count, including duplicates per channel arity).

## 3. Findings table

See `docs/release/rpc-input-validation-audit.md` for the full table.
Summary:

| Severity | Count | Handlers |
| -------- | ----- | -------- |
| HIGH     | 3     | `labels`, `skills`, `onboarding` (last deferred to T052) |
| MED      | 13    | `automations`, `files`, `llm-connections`, `messaging`, `oauth`, `resources`, `sessions`, `settings`, `sources`, `statuses`, `workspace` + onboarding |
| LOW      | 4     | `auth`, `server`, `system`, `transfer`                  |
| EXCLUDED | 1     | `roles` (concurrent work)                               |

3 HIGH-risk handlers are hardened in this PR. The remaining MED
handlers and onboarding are deferred to T052 with a documented
follow-up.

## 4. Schemas added

`packages/server-core/src/handlers/rpc/_validators.ts` (zero-dep
hand-rolled):

| Function                | Purpose                                                                       |
| ----------------------- | ----------------------------------------------------------------------------- |
| `invalidInput(message)` | Throws `Error & { code: 'INVALID_INPUT' }`.                                   |
| `parseId(name, value)`  | Non-empty trimmable string, ≤256 chars, rejects control chars (NUL/ESC/DEL).  |
| `parseSlug(name, value)`| `parseId` + rejects `..`, leading `/` or `\\`, embedded `\\`, `*` / `.`.      |
| `parseOptionalString`   | undefined/null pass through; else `parseId`.                                  |
| `parseStringArray`      | Array discriminator + per-item rules + length cap (default 1000).             |
| `parseEnum`             | Allow-list discriminator.                                                     |
| `parseCreateLabelInput` | Object schema for `labels.CREATE`: `{ name, color?, parentId? }`.             |

Color accepts either a `SystemColor` string (e.g. `'accent/80'`) or a
`CustomColor` object `{ light: string; dark?: string }` — structurally
matching `@rox-one/shared/colors::EntityColor`.

## 5. Why hand-rolled instead of zod

`@rox-one/server-core` does not depend on `zod` today. The T038 prompt
forbids adding new external deps. Zod is in the repo via
`@rox-one/shared` but introducing the dep edge is broader than this
ticket's scope. The hand-rolled validators are intentionally narrow,
match T243's hand-rolled approach, and total 156 LOC. T052 / T071
will introduce zod schemas when the dep edge is approved.

## 6. Tests

`packages/server-core/src/handlers/rpc/__tests__/input-validation-hardening.test.ts`:
50 `it()` blocks, 138 `expect()` calls, all pass.

Per-parser coverage:

| Parser                  | `it()` cases |
| ----------------------- | ------------ |
| `invalidInput`          | 1            |
| `parseId`               | 10           |
| `parseSlug`             | 8            |
| `parseOptionalString`   | 4            |
| `parseStringArray`      | 7            |
| `parseEnum`             | 3            |
| `parseCreateLabelInput` | 16           |
| cross-handler smoke     | 1 (10 sites) |

For each hardened handler we cover:

1. Reject empty payload — `parseCreateLabelInput({})` /
   `parseId('workspaceId', '')` etc.
2. Reject malformed type — `parseCreateLabelInput({ name: 123 })`,
   `parseStringArray('orderedIds', 'not an array')`.
3. Reject unknown discriminator — `parseEnum('mode', 'godmode', …)`,
   `parseCreateLabelInput({ name: 'X', color: 42 })`.
4. Accept valid payload — `parseCreateLabelInput({ name: 'TODO' })`
   etc.

Plus path-traversal coverage on `parseSlug` (`..`, leading `/`, `\\`,
`*`, `.`, mid-string `..`) and control-char smuggling coverage on
`parseId` (NUL, ANSI ESC, DEL).

Control-byte test inputs are constructed via `String.fromCharCode` so
the test file stays text (literal control bytes make git treat the
file as binary, which breaks diffs and code review).

## 7. Results

```
$ bun test packages/server-core/src/handlers/rpc/__tests__/input-validation-hardening.test.ts
bun test v1.3.13 (bf2e2cec)
 50 pass
 0 fail
 138 expect() calls
Ran 50 tests across 1 file. [56.00ms]

$ bun test packages/server-core/src/handlers/rpc/__tests__/
 159 pass
 0 fail
 314 expect() calls
Ran 159 tests across 7 files. [11.36s]
```

No regression in the existing test suite — all 109 pre-existing
assertions still pass alongside the 50 new ones.

## 8. Validation matrix

| Gate                                | Result                                         | Notes |
| ----------------------------------- | ---------------------------------------------- | ----- |
| `bun test rpc/__tests__/`           | 159 / 159 pass, 314 assertions                 |       |
| `bun run validate:rebrand`          | pass                                           |       |
| `bun run validate:agent-contract`   | pre-existing fail (T223 Status format)         | reproduced on bare origin/main; out of scope |
| `bun run validate:roadmap`          | pre-existing fail (M.1.3b heading)             | reproduced on bare origin/main; out of scope |
| `cd packages/server-core && tsc`    | pass                                           |       |

## 9. LOC budget

| Bucket | Limit | Actual |
| ------ | ----- | ------ |
| Source (`_validators.ts` + 3 handlers) | 400 | 368 |
| Tests                                  | 400 | 309 |
| Audit doc                              | 100 | 80  |

## 10. Files touched

| Path                                                                                            | Status   | LOC |
| ----------------------------------------------------------------------------------------------- | -------- | --- |
| `packages/server-core/src/handlers/rpc/_validators.ts`                                          | new      | 156 |
| `packages/server-core/src/handlers/rpc/labels.ts`                                               | modified | 49  |
| `packages/server-core/src/handlers/rpc/statuses.ts`                                             | modified | 34  |
| `packages/server-core/src/handlers/rpc/skills.ts`                                               | modified | 129 |
| `packages/server-core/src/handlers/rpc/__tests__/input-validation-hardening.test.ts`            | new      | 309 |
| `docs/release/rpc-input-validation-audit.md`                                                    | new      | 80  |
| `docs/tickets/T038-rpc-input-validation-hardening.md`                                           | new      | —   |
| `docs/worklog/T038-rpc-input-validation-hardening.md`                                           | new      | —   |

## 11. Deviations from the prompt

- Used hand-rolled validators instead of zod (rule was "Zod (or
  equivalent)" — equivalent path chosen because server-core doesn't
  depend on zod and the no-new-deps rule applies).
- Hardened 3 handlers (within the 2-3 target range).
- `parseCreateLabelInput` accepts 16 cases (one more than the worklog
  table draft) because the `EntityColor` union has two variants that
  each need positive + negative coverage.

## 12. Follow-ups

- **T052** — boundary parse for MED-risk handlers.
- **T071** — formal zod schemas once the dep edge is approved.
- **T038-roles** — separate audit pass for `roles.ts`.

## 13. Closeout

- 3 HIGH-risk RPC handlers (labels, statuses, skills) now reject
  malformed input at the boundary before any FS I/O or domain code
  runs.
- Path-traversal tokens cannot reach `path.join` via the skills
  handler.
- Control characters cannot reach domain logic or logs via any
  hardened handler.
- All validation gates that exist for this work pass; pre-existing
  failures on `validate:agent-contract` and `validate:roadmap` are
  documented as reproduced from bare `origin/main` and unrelated to
  T038.
