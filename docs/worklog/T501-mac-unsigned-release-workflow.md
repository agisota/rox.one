# T501 — Mac unsigned-release workflow

Status: DONE
Phase: M.18
Ticket: docs/tickets/T501-mac-unsigned-release-workflow.md

## 1. Task summary

Add a new GitHub Actions workflow `mac-unsigned-release.yml` for unsigned Mac builds
(no Apple signing/notarization). Mirrors `mac-signed-release.yml` but strips all
signing steps to unblock v1.0.0-rc.2 distribution before an Apple Developer cert is procured.

## 2. Repo context discovered

- `mac-signed-release.yml` exists in `.github/workflows/` as the reference workflow.
- Signing secrets (`APPLE_DEVELOPER_ID_APPLICATION_CERT`, etc.) are not yet configured.
- Unsigned DMG artifacts (`ROX-ONE-arm64.dmg`) are sufficient for beta distribution.

## 3. Files inspected

- `.github/workflows/mac-signed-release.yml`
- `docs/tickets/T501-mac-unsigned-release-workflow.md`

## 4. Tests added first

Workflow-only change. No unit/integration tests applicable. RED check:

```bash
test ! -f .github/workflows/mac-unsigned-release.yml
```

Exited 0 before implementation.

## 5. Expected failing test output

Workflow file absent before implementation.

## 6. Implementation changes

- Added `.github/workflows/mac-unsigned-release.yml` — unsigned Mac release workflow.
- Added `docs/tickets/T501-mac-unsigned-release-workflow.md`.

## 7. Validation commands run

```bash
bun run validate:docs
```

## 8. Passing test output summary

```text
[agent-contract] ok
```

## 9. Build output summary

Workflow-only change; no local build required.

## 10. Remaining risks

When Apple Developer cert is procured, configure secrets per `mac-signed-release.yml`
and deprecate this unsigned variant.

## 11. Acceptance criteria matrix

| Criterion | Status |
|---|---|
| Unsigned workflow file created | PASS |
| Workflow mirrors signed variant without signing steps | PASS |
| `validate:docs` passes | PASS |
