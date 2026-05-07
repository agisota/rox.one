# T092 - Bundle/Performance Chunk Budget Worklog

## 1. Task summary

Add a read-only bundle artifact report that measures the current Electron
renderer, WebUI, and Viewer JS/CSS output, records the large-chunk baseline, and
converts the existing Vite warnings into explicit release-risk evidence.

## 2. Repo context discovered

- T091 intentionally deferred Vite large chunk warnings as a follow-up release
  hardening item.
- Built outputs already exist locally for all three surfaces:
  `apps/electron/dist/renderer/assets`, `apps/webui/dist/assets`, and
  `apps/viewer/dist/assets`.
- Existing validation scripts in `scripts/` follow a small single-purpose Bun
  pattern, fail with explicit prefixed messages, and prefer read-only checks.
- WebUI currently has multiple large hashed `App-*.js` artifacts in `dist/`, so
  the baseline needs to be treated as evidence rather than a pass/fail gate.

## 3. Files inspected

- `AGENTS.md`
- `package.json`
- `scripts/validate-packaged-artifacts.ts`
- `scripts/validate-mac-arm-build-workflow.ts`
- `docs/tickets/T091-packaged-release-hardening.md`
- `docs/worklog/T091-packaged-release-hardening.md`
- `apps/electron/dist/renderer/assets`
- `apps/webui/dist/assets`
- `apps/viewer/dist/assets`

## 4. Tests added first

Validation-first approach used for this scripting task:

- Add a focused read-only reporting script contract that:
  - requires the three expected build output directories,
  - requires at least one JS/CSS asset in each,
  - prints top largest JS/CSS assets plus total JS/CSS bytes,
  - warns for assets larger than 500 KB,
  - does not exit non-zero for size warnings alone.

## 5. Expected failing test output

Initial expected baseline before implementation:

```bash
bun run report:bundle-artifacts
```

Expected result before implementation: fail because the package script and
reporting script did not yet exist.

## 6. Implementation changes

- Added `scripts/report-bundle-artifacts.ts`.
- Added package script `report:bundle-artifacts` to `package.json`.
- The reporting script:
  - inspects `apps/electron/dist/renderer/assets`, `apps/webui/dist/assets`,
    and `apps/viewer/dist/assets`;
  - filters to on-disk `.js` and `.css` files and ignores sourcemaps;
  - prints total JS bytes, total CSS bytes, and the top 10 largest JS/CSS
    assets for each target;
  - emits warnings for any JS/CSS asset larger than 500 KB;
  - fails only if expected build output is missing or if a target contains no
    JS/CSS assets.

## 7. Validation commands run

```bash
bun run report:bundle-artifacts
```

Result: PASS. Report completed successfully and emitted bundle-size warnings
without exiting non-zero.

```bash
git diff --check
```

Result: PASS.

## 8. Passing test output summary

- `bun run report:bundle-artifacts`: PASS.
- `git diff --check`: PASS.

## 9. Build output summary

No new build was required for this slice; existing built artifacts were measured
read-only.

Measured baseline from `bun run report:bundle-artifacts`:

### Electron Renderer

- JS assets: `314` files, `18,478,044` bytes (`17.62 MB`)
- CSS assets: `2` files, `243,470` bytes (`237.76 KB`)
- Largest assets:
  - `index-CAjmieQ4.js` — `5,673,260` bytes (`5.41 MB`)
  - `main-DD-Xpv_K.js` — `1,460,021` bytes (`1.39 MB`)
  - `sonner-DOfdZzFI.js` — `1,190,285` bytes (`1.14 MB`)
  - `emacs-lisp-C9XAeP06.js` — `779,902` bytes (`761.62 KB`)
  - `cpp-CofmeUqb.js` — `626,122` bytes (`611.45 KB`)
  - `wasm-CG6Dc4jp.js` — `622,378` bytes (`607.79 KB`)
  - `playground-DZGtHyGu.js` — `620,301` bytes (`605.76 KB`)
- Assets over 500 KB: `7`

### WebUI

- JS assets: `632` files, `158,242,602` bytes (`150.91 MB`)
- CSS assets: `8` files, `1,176,995` bytes (`1.12 MB`)
- Largest assets:
  - `vendor-shiki-mOeYsOYr.js` — `9,591,758` bytes (`9.15 MB`)
  - `App-CILLyj4H.js` — `6,655,281` bytes (`6.35 MB`)
  - `App-DT8Qf1pI.js` — `6,654,477` bytes (`6.35 MB`)
  - `App-CyBJ3YdR.js` — `6,651,127` bytes (`6.34 MB`)
  - `App-D7wKtEHH.js` — `6,649,841` bytes (`6.34 MB`)
  - `App-B1iGfzEc.js` — `6,649,476` bytes (`6.34 MB`)
  - `App-DF3qwKGj.js` — `6,649,474` bytes (`6.34 MB`)
  - `App-BxYdMnko.js` — `6,592,061` bytes (`6.29 MB`)
  - `App-BmBGF69E.js` — `6,592,061` bytes (`6.29 MB`)
  - `App-BUvvk1Qp.js` — `6,552,244` bytes (`6.25 MB`)
  - `App-CAsYpxj4.js` — `6,200,474` bytes (`5.91 MB`)
- Assets over 500 KB: `38`

### Viewer

- JS assets: `304` files, `14,803,145` bytes (`14.12 MB`)
- CSS assets: `1` file, `124,691` bytes (`121.77 KB`)
- Largest assets:
  - `index-GqF0Vrx9.js` — `5,368,307` bytes (`5.12 MB`)
  - `emacs-lisp-C9XAeP06.js` — `779,902` bytes (`761.62 KB`)
  - `cpp-CofmeUqb.js` — `626,122` bytes (`611.45 KB`)
  - `wasm-CG6Dc4jp.js` — `622,378` bytes (`607.79 KB`)
  - `wolfram-lXgVvXCa.js` — `262,436` bytes (`256.29 KB`)
- Assets over 500 KB: `4`

## 10. Remaining risks

- The bundle report is observational evidence only; it does not yet enforce a
  shrinking budget in CI because current Electron/WebUI/Viewer baselines already
  exceed the 500 KB threshold materially.
- WebUI appears to retain multiple large historical hashed `App-*.js` outputs in
  `dist/assets`, so totals are useful for current release evidence but may
  overstate a clean single-build footprint unless future work introduces a clean
  build-or-baseline policy.
- Electron renderer and Viewer each still contain a primary entry chunk above 5
  MB, which preserves the previously observed Vite large chunk risk.
- Viewer currently emits a small CSS asset in this local build output, which means
  future budget policy should treat CSS presence as variable across builds rather
  than assuming Viewer is JS-only.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| `docs/tickets/T092-bundle-performance-budget.md` exists and captures scope/risks | Done | This ticket |
| `docs/worklog/T092-bundle-performance-budget.md` exists in required format | Done | This worklog |
| `scripts/report-bundle-artifacts.ts` reports Electron/WebUI/Viewer JS/CSS sizes | Done | Script output from section 7 |
| Package script `report:bundle-artifacts` exists | Done | `package.json` script entry |
| Report warns for chunks over 500 KB without failing on warnings | Done | Section 7 report pass with warnings |
| Report fails when expected build output is missing or lacks JS/CSS assets | Done | Script contract in section 6 |
| Measured baseline for Electron/WebUI/Viewer is documented as release evidence | Done | Section 9 |
| Focused validation commands pass | Done | Sections 7 and 8 |
| No unrelated runtime files are touched | Done | `events.jsonl` and `.claude/` unchanged |
| Commit exists only after explicit user approval | Pending | No commit created in this session |
