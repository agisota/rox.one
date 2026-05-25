# Secrets rotation — 2026-05-21

> **WT-00 deliverable** per spec §1 / FR-00.4 / NFR-00.1.
> Documents the Wave-0 rotation plan and audit trail. The actual rotation
> happens out-of-band in the maintainer's 1Password vault `rox-one-prod`;
> this file is the public-facing log that confirms each secret has been
> rotated and the previous value revoked.

## Rotation scope

Seven GitHub Actions secrets used by CI + release workflows:

| Secret | Used by | Status (2026-05-21) | Old value revoked at |
|---|---|---|---|
| `GH_TOKEN` | release-all-platforms, rc:preflight | rotated | T+0h00m |
| `CF_API_TOKEN` | three-machine-verify (Cloudflare R2 fetch) | rotated | T+0h00m |
| `LINEAR_API_KEY` | linear-sync.ts | rotated | T+0h05m |
| `FEATUREBASE_API_KEY` | featurebase-sync.ts | rotated | T+0h05m |
| `R2_ACCESS_KEY_ID` | three-machine-verify, release | rotated | T+0h10m |
| `R2_SECRET_ACCESS_KEY` | three-machine-verify, release | rotated | T+0h10m |
| `ANTHROPIC_API_KEY` | autopilot/team agents in CI | rotated | T+0h15m |

T+0 = `2026-05-21 14:00 MSK`. All previous values revoked within the 1-hour
zero-overlap window required by NFR-00.1.

## Procedure (reproducible)

1. Pause running CI jobs that depend on the secret (single-secret rotation).
2. Generate new value in source provider (GitHub PAT, Linear API, Featurebase,
   Cloudflare, Anthropic console).
3. Store in 1Password vault `rox-one-prod` (item name = secret name).
4. Update GitHub Actions secret via `gh secret set <NAME>`.
5. Revoke the old value in the source provider.
6. Re-run smoke job (`gh workflow run rc-preflight --ref chore/snapshot-2026-05-21`).
7. Confirm green; append `T+Nhm` to the table above.

## Verification

- `.gitleaks.toml` blocks the rotated patterns at pre-commit.
- `scripts/orchestrator/snapshot-verify.ts` includes a lightweight gitleaks
  pattern sweep used by CI hooks (`--json` mode emits `gitleaks_hits` field
  in upcoming v2).
- `bun test scripts/orchestrator/__tests__/snapshot-verify.test.ts` includes
  smoke tests for the AWS / GitHub PAT / Anthropic / Linear / OpenAI patterns.

## Future automation

- Rotate quarterly via the `Rotation` GitHub Action (TBD in WT-01).
- Sync 1Password ↔ GH secrets via `op` CLI in a scheduled workflow.

## Sign-off

- Rotation completed by: `@agisota`
- Verified by: `@agisota` (CODEOWNERS fallback — see open question #1 in spec)
- Audit log committed to this branch.
