# T503 — packaged-artifacts validator (signed/unsigned modes) (worklog)

## What was done
Refactored scripts/validate-packaged-artifacts.ts to read ROX_RC_MODE env var: signed mode (default) preserves all v1.0.x strict checks including embedded code signature; unsigned mode accepts unsigned Mac+Win artifacts while enforcing file presence, structure (blockmaps, latest-mac.yml, latest.yml), size sanity (>=50 MB installers, >=1 MB blockmaps). Added scripts/__tests__/validate-packaged-artifacts.test.ts — 13 bun:test cases covering both modes and edge conditions (0-byte files, missing artifacts, no unsigned-beta leak in signed mode).

## Why
v1.0.0-rc.2 ships unsigned Mac + Windows beta. packaged-artifacts preflight gate must accept those artifacts to turn green for RC2 tag. Signed mode remains strict for v1.0.x when secrets configured.

## Verification
- bun run typecheck:all exit 0
- bun test scripts/__tests__/validate-packaged-artifacts.test.ts → 13 passed
- Manual ROX_RC_MODE=unsigned + empty release/ → exits 1 with "missing required artifact"
