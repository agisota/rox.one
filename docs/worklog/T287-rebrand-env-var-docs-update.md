# T287 - Rebrand env-var docs update

Status: DONE
Phase: R.6
Ticket: docs/tickets/T287-rebrand-env-var-docs-update.md
R.6 merge evidence: `777ada7` (`Complete R.6 env-var rename with readEnv() shim (#66)`)

## 1. Task summary

Rewrite operator-facing surfaces to name the canonical 16 env vars as
`ROX_*` first. Add a deprecation note where useful.

## 2. Repo context discovered

Operator surfaces in scope:

- `README.md` (developer + operator docs)
- `Dockerfile.server` (image build / runtime env)
- `.env.example` (the canonical env scaffolding)
- Root `package.json` scripts that inline `ROX_*` values

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
changes. A reduction in `ROX_` findings (with no new findings introduced)
is the acceptance signal.

## 5. Expected failing test output

Pre-update baseline (from `bun run validate:rebrand`):

```
rebrand validation failed: 1485 forbidden token findings outside the allowlist
Findings by token:
  ROX_: 849
  rox-agent: 377
  rox-cli: 75
  @rox-agent: 57
  ...
```

The `ROX_` count is what T287 reduces.

## 6. Implementation changes

For each in-scope file, replace canonical `ROX_<name>` tokens with
`ROX_<name>`. Add a single "Deprecation" sentence where operators encounter
the shim.

## 7. Validation commands run

- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run lint`
- `bun run typecheck`

## 8. Passing test output summary

- Operator-surface canonical-16 audit:
  `rg -n "ROX_(SERVER_TOKEN|SERVER_URL|RPC_HOST|RPC_PORT|RPC_TLS_CERT|RPC_TLS_KEY|RPC_TLS_CA|TLS_CA|DEBUG|DEV_RUNTIME|BUNDLED_ASSETS_ROOT|WEBUI_DIR|WEBUI_PORT|MESSAGING_WA_WORKER|MESSAGING_NODE_BIN|CONFIG_DIR)" packages apps scripts Dockerfile.server .env.example README.md package.json docs --glob '!docs/worklog/T*.md' --glob '!apps/electron/resources/release-notes/*.md'`
  no longer reports canonical-16 hits in `README.md`, `.env.example`,
  `Dockerfile.server`, or root `package.json`.
- `bun run validate:rebrand`: `rebrand validation passed: no forbidden
  tokens outside the allowlist`.
- `bun run validate:roadmap`: `validate:roadmap OK -- 46 phases, 111 tickets
  across detail files`.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.

## 9. Build output summary

No build needed for docs/config changes.

## 10. Remaining risks

- `Dockerfile.server` defines a runtime user/group; the `ENV ROX_*`
  lines are independent of the user/group block. Renames are safe.
- The pre-existing `ROX_*` findings on `.env.example` from R.7+ work
  remain — R.6 only owns the 16 canonical names.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
|---|---|---|
| README primary text uses `ROX_*` everywhere | Pass | Operator-surface canonical-16 audit reports no README hits |
| `.env.example` lists only `ROX_*` names for the canonical 16 | Pass | Operator-surface canonical-16 audit reports no `.env.example` hits |
| `Dockerfile.server` `ENV` lines and `package.json` scripts use `ROX_*` | Pass | Operator-surface canonical-16 audit reports no `Dockerfile.server` or root `package.json` hits |
| Deprecation note present where operators encounter the shim | Pass | `docs/cli.md` and runtime comments document legacy `ROX_*` shim fallback |
| No legal-preserve surface modified | Pass | No legal-preserve files are changed in this repair |
