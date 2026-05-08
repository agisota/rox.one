# T123 - Release Contract Continuation Scope Sync Worklog

## 1. Task summary

Build the app and verify the release surface. The first full release validation
run exposed a stale release-current handoff contract.

Initial state:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 25]
```

## 2. Red evidence

Command:

```bash
bun run validate:release
```

Actual result:

```text
1 tests failed:
(fail) release current handoff contract > keeps release docs aligned with T098-T104 git truth

4766 pass
13 skip
1 fail
Ran 4780 tests across 408 files.
```

Failure detail:

```text
Expected to contain: "T098-T104 continuation"
Received: "... The T098-T122 continuation ..."
```

Focused contract red after the first stale-scope assertion was corrected:

```bash
bun test scripts/__tests__/release-current-handoff-contract.test.ts
```

Actual result:

```text
Expected to contain: "dependency audit risk register"
Received: "... T104 Dependency Audit Risk Register ..."
```

## 3. Root cause

T120-T122 correctly extended the release docs from the old T105 `T098-T104`
handoff scope to the current `T098-T122` continuation, but the focused
`release-current-handoff-contract` test still asserted the old snapshot text.

The final RC doc also had one stale validation-scope note claiming
`T090 through T121` were committed even though the table and snapshot already
include T122.

## 4. Implementation

- Updated `scripts/__tests__/release-current-handoff-contract.test.ts` to assert
  the current `T098-T122` continuation text.
- Updated the dependency-risk assertion to match the current T104 commit-chain
  wording in the snapshot.
- Added an assertion that the final RC validation-scope note says
  `T090 through T122 are committed`.
- Updated `docs/release/final-rc-2026-05-06.md` to match the T122 state.

## 5. Validation log

Focused contract:

```bash
bun test scripts/__tests__/release-current-handoff-contract.test.ts
```

```text
1 pass
0 fail
25 expect() calls
Ran 1 test across 1 file.
```

Full release gate:

```bash
bun run validate:release
```

```text
4767 pass
13 skip
0 fail
1 snapshots
12496 expect() calls
Ran 4780 tests across 408 files.
```

Fresh Mac ARM package build:

```bash
bun run electron:dist:dev:mac:arm64
```

```text
target=DMG arch=arm64 file=release/ROX-ONE-arm64.dmg
target=macOS zip arch=arm64 file=release/ROX-ONE-arm64.zip
building block map  blockMapFile=release/ROX-ONE-arm64.dmg.blockmap
building block map  blockMapFile=release/ROX-ONE-arm64.zip.blockmap
```

Packaged artifact validator:

```bash
bun run validate:packaged-artifacts
```

```text
[packaged-artifacts] required packaged artifacts present
[packaged-artifacts] SHA256 ROX-ONE-arm64.dmg 97196ff23c7b181a64217814dbfa4d123c33aacccc2c08a94086634a26a8ca1c
[packaged-artifacts] SHA256 ROX-ONE-arm64.zip 3b47f218dc5a3533c45dc1bbbb7e4b58bca6e039ad56064fbf35aadf41d1c6c4
[packaged-artifacts] latest-mac.yml artifact references verified
```

Private release boundary:

```bash
bun run validate:mac-private-release-boundary
```

```text
[mac-private-release-boundary] packaged app signature: adhoc, TeamIdentifier=not set
[mac-private-release-boundary] packaged app notarization: no stapled ticket
[mac-private-release-boundary] ASAR/signing/notarization boundary is documented as private/local RC only
```

Packaged smoke:

```bash
bun run electron:smoke:packaged:mac
```

```text
[packaged-smoke] ROX.ONE packaged headless startup passed
```

Diff hygiene and dependency manifests:

```bash
git diff --check
git status --short -- package.json bun.lock apps/electron/package.json
```

```text
# both commands produced no output
```

## 6. Result

Release validation, fresh Mac ARM packaging, packaged artifact verification,
private-release-boundary validation, and packaged headless startup all pass.
The stale release-current contract is now aligned with the T122 release scope
without touching package manifests or lockfiles.
