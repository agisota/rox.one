# T091 - Packaged Release Hardening

Status: DONE

## Goal

Make the packaged mac arm64 release artifact more trustworthy and auditable by
turning the current packaged-build state into explicit validation evidence and
small deterministic checks, without attempting a full signing/notarization
program in this slice.

## Scope

- Inspect packaged release scripts/configuration and current release artifacts.
- Add or improve a deterministic packaged-artifact validation script.
- Verify the expected packaged mac arm64 artifact set exists.
- Generate or document exact artifact sizes and SHA256 checksums.
- Verify `latest-mac.yml` references the expected arm64 packaged artifacts if
  that can be done cheaply with existing dependencies.
- Record packaged smoke evidence and classify known packaging warnings/risks in
  release docs/worklog.

## Out of scope

- Enabling ASAR in this run.
- Reworking Electron/WebUI/Viewer chunking.
- Real signing identity setup.
- Apple notarization.
- Upload/distribution automation.
- Cross-platform packaging cleanup beyond classifying expected optional
  dependency warnings.

## Constraints

- Do not touch `events.jsonl`, `.claude/`, secrets, or signing credentials.
- Do not mutate packaged artifacts.
- Do not add production dependencies.
- Preserve current Craft/ROX packaging behavior unless a validation gap requires
  a small safe script/config improvement.
- Prefer the smallest useful release-hardening slice.

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Packaged mac arm64 artifacts are identified with exact paths | DONE |
| Artifact sizes and SHA256 checksums are generated or documented | DONE |
| Packaged smoke command and result are documented | DONE |
| ASAR disabled warning is classified as accepted risk or follow-up blocker | DONE |
| Ad-hoc signing / notarization skipped state is explicitly documented | DONE |
| Stale `Assets.car` / icon fallback is documented with next action | DONE |
| Missing optional dependencies are classified as expected or investigated | DONE |
| Focused validation command passes | DONE |
| Worklog is complete | DONE |
| No unrelated runtime artifacts are touched | DONE |
| Commit exists after approved hardening pass | DONE |
