# T523 - Release-all-platforms unsigned Linux publish repair

## 1. Task summary

Repair PR #248's unified all-platforms release workflow so its unsigned Linux
job does not require a signed AppImage sidecar during GitHub Release publish.

## 2. Repo context discovered

- PR #248 adds `.github/workflows/release-all-platforms.yml`.
- The workflow comments and Linux package step state GPG signing is skipped for
  the RC2 unsigned baseline.
- The Linux publish step still lists `apps/electron/release/*.AppImage.sig`
  while `fail_on_unmatched_files: true` is enabled, so a normal unsigned Linux
  run would fail after building the unsigned artifacts.
- `origin/main` already contains T512 packaged artifact validator repair, so
  the PR branch was brought current with `origin/main` before this fix.

## 3. Files inspected

- `.github/workflows/release-all-platforms.yml`
- `.github/workflows/linux-signed-release.yml`
- `docs/tickets/T503-packaged-artifacts-multi-platform.md`
- `docs/worklog/T503-packaged-artifacts-multi-platform.md`
- `docs/tickets/T512-hosted-mac-blockmap-threshold.md`
- `docs/worklog/T512-hosted-mac-blockmap-threshold.md`

## 4. Tests added first

Static RED/GREEN command:

```bash
node - <<'NODE'
const fs = require('fs');
const path = '.github/workflows/release-all-platforms.yml';
const text = fs.readFileSync(path, 'utf8');
const start = text.indexOf('- name: Publish Linux x64 artifacts to GitHub Release');
const end = text.indexOf('- name: Publish Windows x64 artifacts to GitHub Release');
if (start === -1 || end === -1 || end <= start) {
  console.error('could not locate Linux publish block');
  process.exit(1);
}
const block = text.slice(start, end);
if (block.includes('*.AppImage.sig')) {
  console.error('unsigned Linux publish still requires *.AppImage.sig');
  process.exit(1);
}
NODE
```

## 5. Expected failing test output

Expected before implementation:

```text
unsigned Linux publish still requires *.AppImage.sig
```

## 6. Implementation changes

- Removed `apps/electron/release/*.AppImage.sig` from the Linux publish files
  list in `.github/workflows/release-all-platforms.yml`.
- Left `.github/workflows/linux-signed-release.yml` unchanged; it still
  publishes signed Linux AppImage sidecars in the signed workflow.
- Added this T523 ticket/worklog pair.

## 7. Validation commands run

- RED static check before implementation.
- GREEN static check after implementation.
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/release-all-platforms.yml'); puts 'workflow yaml parses'"`
- `grep -n "AppImage.sig" .github/workflows/linux-signed-release.yml && ! git diff --name-only -- .github/workflows/linux-signed-release.yml | grep .`
- `git diff --check`
- `bun run validate:rebrand`
- `bun run validate:docs`

## 8. Passing test output summary

- RED before implementation failed with:
  `unsigned Linux publish still requires *.AppImage.sig`
- GREEN after implementation printed:
  `unsigned Linux publish does not require *.AppImage.sig`
- YAML parser printed:
  `workflow yaml parses`
- Signed Linux workflow still contains:
  `222:            apps/electron/release/*.AppImage.sig`
- `git diff --check` exited 0.
- `bun run validate:rebrand` printed:
  `rebrand validation passed: no forbidden tokens outside the allowlist`
- `bun run validate:docs` printed:
  `[agent-contract] ok: 11 skills, 479 tickets, 7 required docs`

## 9. Risks and follow-ups

- The unified workflow still does not execute locally because it needs hosted
  GitHub runners across macOS, Linux, and Windows.
- Signed Linux release behavior remains owned by
  `.github/workflows/linux-signed-release.yml`.

## 10. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| RED check fails before implementation | PASS | Static check failed with the expected `.AppImage.sig` message |
| Unsigned Linux publish no longer requires `.AppImage.sig` | PASS | Static check printed `unsigned Linux publish does not require *.AppImage.sig` |
| Signed Linux workflow unchanged | PASS | Working diff has no `linux-signed-release.yml` change and grep still finds its `.AppImage.sig` publish line |
| Rebrand validation passes | PASS | `bun run validate:rebrand` |
| Docs validation passes | PASS | `bun run validate:docs` |
| Whitespace check passes | PASS | `git diff --check` |
| Worklog complete | PASS | This 11-section worklog records RED, implementation, validation, and risk |
| Commit created | PASS | This commit lands the T523 repair |

## 11. Final notes

This is a PR #248 repair only. It does not change runtime behavior and does not
execute the destructive R.11 rebrand rewrite path.
