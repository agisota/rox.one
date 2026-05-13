# RPC Input-Validation Audit (T303)

M.13 security hardening. Audit of `packages/server-core/src/handlers/rpc/`.

## Method

For each handler file, every `server.handle(channel, async (ctx, ...args) => …)`
was inspected for boundary input validation. A handler is **validated**
when its non-context arguments are type-narrowed at the boundary with an
explicit reject path before reaching domain logic — not merely typed in
the TS signature (TS types are erased at runtime and the RPC transport
deserializes JSON without runtime checks).

Helper files (no `server.handle`) are excluded: `account-ownership.ts`,
`index.ts`, `storage-scope.ts`.

## Findings table

| Handler file              | server.handle count | Boundary validation state                                                              | Risk  | Remediation       |
| ------------------------- | ------------------- | -------------------------------------------------------------------------------------- | ----- | ----------------- |
| `auth.ts`                 | 4                   | Mostly no payload args; one `name: string` passed only to dialog text                  | LOW   | none              |
| `automations.ts`          | 8                   | Hand-rolled validation in domain helpers                                               | MED   | T052 follow-up    |
| `files.ts`                | 11                  | Path-resolution guards exist; payload shapes typed-only                                | MED   | T052 follow-up    |
| `labels.ts`               | 3                   | **None** — `workspaceId`, `labelId`, `CreateLabelInput` accepted as-is                 | HIGH  | **hardened here** |
| `llm-connections.ts`      | 24                  | Per-call validation in `llm-connection-store`; partial coverage at boundary            | MED   | T071 follow-up    |
| `messaging.ts`            | 25                  | TS-typed payloads, registry-side validation; no boundary parse                         | MED   | T052 follow-up    |
| `oauth.ts`                | 4                   | Flow-store cross-check is the primary guard; payload not parsed                        | MED   | T052 follow-up    |
| `onboarding.ts`           | 8                   | Free-form `mcpUrl`, `authorizationCode`, `connectionSlug`; no parse                    | HIGH  | T052 follow-up    |
| `resources.ts`            | 2                   | `ResourceBundle`/`ExportResourcesOptions` are TS-typed; domain validates downstream    | MED   | T052 follow-up    |
| `roles.ts`                | 4                   | **EXCLUDED from this PR** (other agents editing); has dedicated RBAC guards            | n/a   | T303-roles        |
| `sessions.ts`             | 25                  | Domain-side validation in SessionManager                                               | MED   | T052 follow-up    |
| `settings.ts`             | 29                  | Per-key handlers with narrow signatures; partial parse                                 | MED   | T052 follow-up    |
| `server.ts`               | 6                   | Lifecycle channels; no untrusted payload                                               | LOW   | none              |
| `skills.ts`               | 5                   | **None** — `skillSlug` joined into FS paths without traversal guard                    | HIGH  | **hardened here** |
| `sources.ts`              | 9                   | Partial-typed `CreateSourceInput` with `||` fallbacks; no parse                        | MED   | T052 follow-up    |
| `statuses.ts`             | 2                   | **None** — `workspaceId`, `orderedIds: string[]` accepted as-is                        | MED   | **hardened here** |
| `system.ts`               | 14                  | Mix of narrow-typed and validated; open-URL has scheme allowlist                       | LOW   | none              |
| `transfer.ts`             | 4                   | Has dedicated transfer validators                                                      | LOW   | none              |
| `workspace.ts`            | 23                  | Per-call workspace existence checks; payload not parsed                                | MED   | T071 follow-up    |

Total handler files inspected: 19. Handlers without `server.handle` (helpers): 3.

## Risk classification

- **HIGH** — handler accepts free-form strings used in filesystem paths,
  shell commands, or auth-sensitive identifiers; OR handler accepts a
  structured payload with no runtime narrowing.
- **MED** — handler relies on downstream domain validation; a malformed
  payload reaches the domain but is rejected there. Defense-in-depth
  improvement target.
- **LOW** — handler accepts no untrusted payload, or payload is fully
  narrowed by domain validators with parity to the wire shape.

## Hardened in this PR

1. **`labels.ts`** — workspace id, label id, `CreateLabelInput` payload
   all parsed at boundary; rejects empty / malformed / unknown-shape
   payloads with `INVALID_INPUT` error code before any FS I/O.
2. **`statuses.ts`** — workspace id and ordered id array parsed at
   boundary; rejects non-array `orderedIds`, non-string elements, and
   empty workspace id.
3. **`skills.ts`** — workspace id, skill slug, working directory parsed
   at boundary; skill slug additionally rejects path-traversal tokens
   (`..`, leading `/`, NUL bytes) before being joined into a filesystem
   path.

Schemas live in `packages/server-core/src/handlers/rpc/_validators.ts`
as zero-dep hand-rolled validators that throw `Error & { code: 'INVALID_INPUT' }`
to match the existing handler error shape.

## Follow-ups

- **T052** — extend boundary parse coverage to MED-risk handlers
  (`automations`, `files`, `messaging`, `oauth`, `onboarding`,
  `resources`, `sessions`, `settings`, `sources`).
- **T071** — formal Zod schemas for handlers that already have domain
  validators (`llm-connections`, `workspace`) to align wire-shape and
  domain types.
- **T303-roles** — separate audit pass for `roles.ts` once concurrent
  RBAC work lands.
