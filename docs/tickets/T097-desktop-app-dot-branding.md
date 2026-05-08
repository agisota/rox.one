# T097 - Desktop App Dot Branding

Status: DONE

## Goal

Make the desktop/package identity consistently use `ROX.ONE` instead of
`ROX ONE` where macOS/Windows app names, bundle names, executable paths, and
brand metadata are generated.

## Scope

- Update Electron builder product/display names and after-pack plist normalization.
- Update Electron main-process app/window title defaults.
- Update dev wrapper, packaged smoke, mac ARM workflow contract, and installer
  app-path assumptions for the `ROX.ONE.app`/`ROX.ONE` executable identity.
- Update focused brand tests that assert the legal entity display string.

## Out of scope

- Rewriting all historical docs and release notes.
- Renaming update artifact filenames such as `ROX-ONE-arm64.dmg`.
- Public production signing/notarization.
- Changing runtime data, local evidence logs, or generated build outputs in git.

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Desktop package identity resolves to `ROX.ONE` | DONE |
| Focused brand tests pass | DONE |
| Mac ARM workflow contract expects `ROX.ONE.app` | DONE |
| Typecheck/lint/docs validation pass | DONE |
| No runtime artifacts are staged | DONE |
| Scoped Lore commit exists | DONE |
