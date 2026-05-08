# T104 - Dependency Audit Risk Register Worklog

## 1. Task summary

Create an evidence-backed dependency audit risk register for the private RC
handoff without changing dependency versions or weakening the public-production
blocked status.

Initial clean tracked state before T104:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 6]
```

Ignored local runtime artifacts remain on disk and outside git tracking after
T103.

## 2. Red evidence

Focused release-contract test added first:

```bash
bun test scripts/__tests__/dependency-risk-register-contract.test.ts
```

Expected red result:

```text
0 pass
1 fail
Expected: true
Received: false
```

The failure confirmed that
`docs/release/dependency-risk-register-2026-05-08.md` did not exist yet.

## 3. Test added first

Added `scripts/__tests__/dependency-risk-register-contract.test.ts`.

The test asserts:

- `docs/release/dependency-risk-register-2026-05-08.md` exists;
- the register contains the required operational sections;
- the production readiness matrix links the register;
- public-production blocked status remains explicit;
- dependency manifests and lockfiles are not changed by this slice.

## 4. Live audit evidence

Command:

```bash
bun audit
```

Result: FAIL, as expected for the current dependency graph.

```text
32 vulnerabilities (3 critical, 13 high, 15 moderate, 1 low)
```

Critical examples from the live output:

- `protobufjs <7.5.5` through `@larksuiteoapi/node-sdk`,
  `@whiskeysockets/baileys`, and `@mariozechner/pi-ai`.
- `xmldom <=0.6.0` through `markitdown-js`.
- `node-tesseract-ocr <=2.2.1` through `markitdown-js`.

High examples from the live output:

- `music-metadata <=11.12.1` through `@whiskeysockets/baileys`.
- `xlsx <0.19.3` through `markitdown-js`.
- `axios >=1.0.0 <1.15.0` through provider/messaging/document paths.
- `exiftool-vendored <=35.18.0` through `markitdown-js`.

## 5. Implementation changes

- Added `docs/release/dependency-risk-register-2026-05-08.md`.
- Linked the risk register from the security row of the production readiness
  matrix.
- Kept public production explicitly blocked until remediation or signed
  accepted-risk approval plus external review.
- Did not edit `package.json`, `bun.lock`, `apps/electron/package.json`, or any
  dependency versions.

## 6. Validation commands

| Command | Result | Evidence |
|---|---|---|
| `bun test scripts/__tests__/dependency-risk-register-contract.test.ts` | RED, expected | missing risk-register file |
| `bun audit` | FAIL, expected | `32 vulnerabilities (3 critical, 13 high, 15 moderate, 1 low)` |
| `bun test scripts/__tests__/dependency-risk-register-contract.test.ts` | PASS | 1 pass, 0 fail, 13 expects |
| `git status --short -- package.json bun.lock apps/electron/package.json` | PASS | no output; dependency manifests and lockfile unchanged |
| `bun run validate:docs` | PASS | `11 skills`, `105 tickets`, `7 required docs` |
| `git diff --check` | PASS | no whitespace errors |

## 7. Remaining risks

- T104 records and classifies current dependency risk; it does not remediate
  vulnerable packages.
- Public production remains blocked until dependency remediation or signed
  accepted-risk approval is paired with external security review and production
  isolation evidence.
- The audit result is time-sensitive and should be rerun before any public
  release decision.

## 8. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Risk-register contract test fails before the doc/linkage and passes after | Done | Focused test red, then pass |
| Live dependency audit result is recorded | Done | `bun audit` fail with 32 vulnerabilities |
| Release matrix links to the dependency risk register | Done | `docs/release/production-readiness-matrix-2026-05-06.md` |
| Public-production blocked status remains explicit | Done | Matrix and risk register keep public production blocked |
| No dependency manifests or lockfiles are changed | Done | `git status --short -- package.json bun.lock apps/electron/package.json` |
| Docs validation passes | Done | `bun run validate:docs` |
| Worklog complete | Done | This file |
| Scoped Lore commit exists | Done | This scoped T104 commit |
