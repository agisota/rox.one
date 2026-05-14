# T253b — Linux .deb + .rpm package mirror
Status: DONE
Phase: M.18

## Context

T253 shipped the Linux AppImage trust-boundary mirror completing the
cross-platform private-release set (Mac + Windows + Linux). T253b extends
the Linux packaging surface by adding `.deb` (Debian/Ubuntu) and `.rpm`
(Fedora/RHEL/openSUSE) targets alongside the existing AppImage so users
on mainstream Linux distributions can install via their native package
manager.

## Scope

1. **`apps/electron/electron-builder.yml`** — extended `linux.target` array
   with `deb` and `rpm` entries (both `x64`). Added `synopsis` and
   `description` fields to the shared `linux:` block. Added top-level
   `deb:` and `rpm:` config blocks with canonical `depends` and
   `packageCategory` settings:
   - `deb.depends`: gconf2, gconf-service, libnotify4, libappindicator1,
     libxtst6, libnss3, libsecret-1-0
   - `rpm.depends`: libnotify, libxtst, nss, libsecret

2. **`scripts/validate-linux-deb-rpm.ts`** — cross-platform validator that
   asserts:
   - `deb` and `rpm` are listed in `linux.target`
   - `AppImage` still present (T253 regression guard)
   - `category`, `synopsis`, `maintainer` are non-empty strings
   - Top-level `deb:` and `rpm:` config blocks exist
   - `libnss3` and `libnotify` appear in the depends lists
   - `validate:linux-deb-rpm` is wired in `package.json` scripts

3. **`scripts/__fixtures__/linux-deb-rpm/good-config/electron-builder.yml`**
   — minimal valid fixture with all required fields + both targets.

4. **`scripts/__fixtures__/linux-deb-rpm/bad-config-missing-deb/electron-builder.yml`**
   — fixture missing the `deb` target; validator must exit 1 citing deb.

5. **`scripts/__fixtures__/linux-deb-rpm/bad-config-missing-synopsis/electron-builder.yml`**
   — fixture missing `synopsis`; validator must exit 1 citing synopsis.

6. **`package.json`** — `validate:linux-deb-rpm` script entry added.

7. **`scripts/validate-linux-signed-release-pipeline.ts`** — umbrella
   pipeline validator updated to assert `validate:linux-deb-rpm` is wired
   in `package.json`, keeping it consistent with sibling entries.

## Rules followed

- No secrets added. No gpg invocation. No live build required.
- Validator is pure text/shape checks: cross-platform, deterministic.
- AppImage target preserved (T253 regression guard built into validator).
- T253/T254/T255 surfaces untouched except:
  - `electron-builder.yml` linux: block extended (non-breaking addition)
  - `validate-linux-signed-release-pipeline.ts` required-scripts list
    extended by one entry

## Validation gates

- `bun run validate:linux-deb-rpm` — passes against current config.
- Validator exits 1 against bad-config-missing-deb fixture with clear
  "deb is not listed in linux.target" error.
- Validator exits 1 against bad-config-missing-synopsis fixture with clear
  "linux synopsis field" error.
- `bun run validate:agent-contract` — passes with T253b `Status: DONE`.
