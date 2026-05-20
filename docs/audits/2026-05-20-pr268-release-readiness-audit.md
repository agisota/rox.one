# PR #268 (`feat/rox-design-clean`) — Independent Release-Readiness Audit

- **Audit date**: 2026-05-20
- **Audit snapshot HEAD**: `d2302b9d` (9 commits at audit time, +3637 / -42 across 30 files)
- **Branch state at synthesis time**: advanced to `bf9f4d30` via parallel follow-up work (see "Post-Audit Progress" section)
- **PR URL**: https://github.com/agisota/rox.one/pull/268 (merged as `f4fd8ac3` per `docs/release/rc8-cut-plan-2026-05-20.md`)
- **Audit method**: 4 parallel domain-specialist agents (security, packaging, runtime architecture, regression+CI) producing structured findings; central synthesis with file:line cross-verification on the most severe items.

---

## TL;DR — Release Verdict

**Conditional-go (as plumbing PR with explicit deferred follow-ups).**

The PR cleanly preserves T536 auto-update (17/17 symbols verified), passes all 24 rox-design + 174 RTL tests, typecheck, and lint. The Rox Design payload supply chain is acknowledged as macOS-source-only and explicitly deferred as post-RC8 follow-up (Goal #6 in the 2026-05-20 top-10 list), not an RC8 blocker.

The audit identified one HIGH-severity security gap that was unique to my analysis (T541: `view-show` URL origin pin), several runtime-architecture HIGHs that have since been independently addressed by parallel follow-up commits to the same branch, and a pre-existing codebase pattern (`if (sessionManager)` cleanup gate) that PR #268 follows but did not introduce — deferred to T542.

---

## Post-Audit Progress (parallel work that resolved findings)

Between audit snapshot `d2302b9d` and synthesis time `bf9f4d30`, the following follow-up commits landed on `feat/rox-design-clean`, addressing several findings independently:

| Commit | Subject | Resolves audit finding |
|--------|---------|------------------------|
| `bfd038f6` | chore(design): reproducible Rox Design payload preparation + packaging preflight (T091 recon) | B-CI-1 partially; B-REPRO-2 partially |
| `bf31bf8a` | fix(design): share in-flight start() promise across concurrent callers | C-H1 (start re-entrancy) |
| `d1ea1854` | fix(design): notify renderer of post-startup sidecar crashes | C-H2 (exit listener race) |
| `f80b888e` | fix(design): cap printPdf HTML payload at 5 MB | A-L2 (unbounded data: URL) |
| `327eff58` | fix(design): dedupe writeConfig via sha256 cache | (orthogonal optimization) |
| `d061deec` | fix(design): avoid id double-normalization in manualChunks | B-M2 (manualChunks subtle drift) |

This audit's T541 (URL origin pin) is **not duplicated by any of the above** and was implemented in this same audit session — see "Implemented in This Audit Session" below.

---

## Lane Verdict Matrix (at audit time `d2302b9d`)

| Lane | Agent | Blockers | High | Medium | Low | Nit | Verdict |
|------|-------|----------|------|--------|-----|-----|---------|
| A. Security (preload, IPC, view-policy) | `security-reviewer` | 0 | 1 | 5 | 3 | 1 | conditional-go (1 must-fix → T541 done) |
| B. Packaging (electron-builder, afterPack, prepare script, CI staging) | `code-reviewer` | 3 | 4 | 2 | 3 | 1 | no-go — recalibrated to conditional-go after BL2 deferred by project (Goal #6); BL1 partially closed by `bfd038f6` |
| C. Runtime architecture (lifecycle, races, IPC contract) | `architect` | 2¹ | 3 | 5 | 2 | 1 | conditional-go (H1/H2 closed by `bf31bf8a`/`d1ea1854`); BLOCKERs deferred to T542 |
| D. Regression + CI gates + T536 + bundle policy | `verifier` | 0 | 1 | 4 | 1 | 1 | conditional-go (T536 17/17 ✅) |

¹ Lane C's BLOCKERs are both facets of one pre-existing pattern (`sessionManager`-gated cleanup) inherited by PR #268, not introduced by it. See T542 reasoning below.

---

## Implemented in This Audit Session

### T541 — `rox-design:view-show` URL origin pin (Lane A H1) — **DONE**

**Severity**: HIGH (security) → resolved.

**Files changed**:
- `apps/electron/src/main/rox-design-view-policy.ts` — added `isRoxDesignUrlOriginAuthorized(expectedWebUrl, candidateUrl): boolean` helper (+14 lines, with rationale comment).
- `apps/electron/src/main/rox-design-view-manager.ts` — `show()` now accepts `expectedWebUrl?: string | null`; throws on origin mismatch (+8 lines).
- `apps/electron/src/main/index.ts` — IPC handler at lines 627-639 resolves `expectedWebUrl` from `runtimeManager.getStatus().webUrl` (only when `status === 'running'`); non-running runtime fails the check (+14 lines).
- `apps/electron/src/main/__tests__/rox-design-view-manager.test.ts` — new `it("pins view-show URL to the trusted runtime origin")` block covering 7 paths: same-origin, cross-port, cross-host, null-expected, non-http, javascript:, malformed-expected URL (+32 lines).

**Pre-fix evidence**:
```ts
if (!isHttpUrl(input.url)) throw new Error('Rox Design view URL must be http(s).')
// ...
await entry.webContents.loadURL(input.url)
```
Renderer-supplied URL validated only for http(s) scheme. WebContentsView inherits the privileged `rox-design-bridge:*` IPC surface (`openExternal`, `pickFolder`, `pickAndImport`, `openPath`, `printPdf`). XSS or compromise in main renderer could redirect to attacker host.

**Post-fix evidence**:
```ts
const runtimeStatus = getRoxDesignRuntimeManager().getStatus()
const expectedWebUrl = runtimeStatus.status === 'running' ? runtimeStatus.webUrl : null
return getRoxDesignViewManager().show({ ..., expectedWebUrl })
// in view-manager.ts:
if (input.expectedWebUrl !== undefined && !isRoxDesignUrlOriginAuthorized(input.expectedWebUrl, input.url)) {
  throw new Error('Rox Design view URL origin does not match the runtime endpoint.')
}
```

**Verification**:
- `bun run typecheck:shared` exit 0
- `bun run typecheck:electron` exit 0
- `bun test apps/electron/src/main/__tests__/rox-design-view-manager.test.ts` → **7 pass, 0 fail, 39 expect() calls**
- Full rox-design suite (`bun test rox-design-*.test.ts panel-stack-design route-parser-design`) → **27 pass, 0 fail**

---

## Open Findings (carried as follow-up tickets)

> **Note on ticket IDs**: Identifiers T538-T549 in this section are audit-internal labels. Project ticket numbers in this range may already be claimed by unrelated work (e.g., observed `docs/tickets/T538-deepwiki-indexed-knowledge-workflow.md` exists). Coordinate with the maintainer for canonical ticket assignment; the section anchors here remain useful for cross-referencing the audit findings regardless of final ticket numbering.

### T538 — Wire `rox-design:prepare` + `:payload:verify` into all signed-release CI workflows
**Status**: P0 → partially addressed by `bfd038f6` (preflight + verify script); RC8 runbook (`docs/release/rc8-cut-plan-2026-05-20.md`) includes `rox-design:prepare --force` as manual step 9. Full CI automation remains a separate follow-up.

### T539 — Pin Rox Design payload source to SHA-256-checksummed tarball; per-file digests in MANIFEST.json
**Status**: P0 → **explicitly deferred** by project as Goal #6 (post-RC8 follow-up, not RC8 blocker). Audit's BL2 classification was technically correct but did not reflect project priority.

### T540 — Add `mac.binaries` for nested Mach-O `node` binary; `codesign --deep --strict` + `spctl` CI assertions
**Status**: P0 → couples with T539 (depends on populated payload). Land together as supply-chain hardening PR.

### T542 — Hoist `before-quit` cleanup out of `if (sessionManager)` guard
**Severity**: P1 deferred. Reasoning (independent re-analysis of architect's BLOCKER rating):
- **Not introduced by PR #268**: same guard wraps `messagingHandle.dispose`, `oauthFlowStore.dispose`, `cleanupPowerManager`, `releaseServerLock`, and `app.exit(0)` itself. PR #268 follows the local convention.
- **Flow-impossible in normal use**: Rox Design start requires UI which requires `sessionManager`. The bug fires only when `sessionManager === null` AND Rox Design was started — circular precondition.
- **Asymmetric fix is harmful**: closing only rox-design's portion leaves 6 other dispose calls still gated, creating false confidence. Closing all of them is a refactor-grade change, not a security/correctness fix appropriate for a feature PR.
- **Regression risk in quit-path**: this is THE shutdown chain; surgical changes here have outsized blast radius. Test infrastructure for `before-quit` does not exist.

Architect's BLOCKER rating is correct in isolation but should be P1 deferred when read in context. Track as codebase-wide cleanup-orchestrator extraction PR.

### T543, T544, T545–T549
See full ticket list in original audit body (preserved below in "Original Lane Findings" appendix).

---

## Lane Findings Appendix (audit snapshot `d2302b9d`)

### Lane A — Security (1 HIGH, 5 MEDIUM, 3 LOW, 1 NIT; verdict conditional-go)
- **A-H1**: `view-show` URL pin → **T541 implemented this session**
- A-M1: `ROX_DESIGN_WEB_URL` env var has no scheme/host allowlist → T545
- A-M2: `ROX_DESIGN_RUNTIME_ROOT` env var → unvalidated path → `spawn(nodePath, ...)` (RCE class if env compromised) → T545
- A-M3: `printPdf` `data:text/html` window has no CSP → T546 (partially resolved by `f80b888e` which capped HTML at 5 MB)
- A-M4: `RoxDesignViewManager.show()` accepts `senderWebContentsId` as caller-supplied param → defense-in-depth nit
- A-M5: No CSP on embedded design page → T546
- A-L1/L2/L3 and A-N1: hardening + nits (some closed by `f80b888e`)

### Lane B — Packaging (3 BLOCKER → recalibrated, 4 HIGH, 2 MEDIUM, 3 LOW, 1 NIT)
- **B-CI-1**: signed-release workflows bypass `rox-design:payload:verify` gate → partially closed by `bfd038f6` + RC8 runbook step 9 → T538
- **B-REPRO-2**: payload sourced from host-local `/Applications/Open Design.app` → **explicitly deferred to Goal #6** → T539
- **B-SIGN-3**: nested Mach-O `node` binary without `mac.binaries`/`signIgnore` → couples with T539 → T540
- B-H1: `resources/rox-design/**/*` may collide with electron-builder's implicit `**/node_modules/**` exclusion → T548
- B-H2: `asar: false` + payload tamper resistance → T549
- B-M1: `prepare-rox-design-runtime.ts` race condition + `dereference: true` → hardening nit
- B-M2: Vite manualChunks extraction lacks snapshot test → closed by `d061deec`
- B-L1/L2/L3 and B-N1: docs/comments drift; surface T548 sub-items

### Lane C — Runtime architecture (2 BLOCKER → re-rated P1, 3 HIGH, 5 MEDIUM, 2 LOW, 1 NIT)
- **C-BL1/BL2**: `before-quit` cleanup gated on `sessionManager` → **T542 deferred** (see reasoning above)
- C-H1: `start()` re-entrancy → closed by `bf31bf8a`
- C-H2: `child.once('exit')` listener race → closed by `d1ea1854`
- C-H3: `view-show` load serialization → T543
- C-H4: `entry.skinCssKey` accumulation; listener leak in `destroyEntry` → T543
- C-M1: `embed-skin.ts` 971 LoC mixed concerns → T547
- C-M2-M5: cleanup/serialization nits + test coverage gaps → T543/T544

### Lane D — Regression + CI gates (0 BLOCKER, 1 HIGH, 4 MEDIUM, 1 LOW, 1 NIT)
- T536 auto-update preserved: **17/17 symbols verified** at file:line.
- All 24 rox-design + 174 RTL tests pass; typecheck + lint clean.
- D-H1: PR #264 × PR #268 merge conflict on `apps/electron/src/main/index.ts` → resolved by `bf9f4d30` merge commit ("resolve package.json conflict — keep rox-design:payload:verify prefix on linux builder script").
- D-M1: duplicate of B-CI-1
- D-M2: working-tree drift in `vite.config.ts` → housekeeping
- D-M3: bandwidth: rox-design runtime in every update delta → planning concern, T539-adjacent
- D-M4: duplicate of B-SIGN-3

---

## Positive Signals (what the PR did right)

- **T536 auto-update preserved end-to-end**: 17/17 symbols verified at file:line by Lane D.
- **Strong renderer-side sandboxing**: WebContentsView created with `sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false`. `setWindowOpenHandler → deny`. HMAC-signed desktop-import token with TTL + nonce.
- **Same-origin navigation gate**: `getRoxDesignNavigationDecision` correctly returns `external` for cross-origin and `deny` for non-http(s).
- **`requireRoxDesignManagedWebContents` trust gate**: every `rox-design-bridge:*` handler checks managed WebContents (gap was the URL pinning, now closed by T541).
- **Tests**: 24 rox-design unit tests, 4 RTL tests, route-parser roundtrip tests — all passing.
- **Typecheck + lint clean**.
- **IPC contract walk shows zero drift** (Lane C): all 7 methods on `RoxDesignApi` have main-process handler + preload invoke + contextBridge exposure.
- **Vite manualChunks extraction is byte-equivalent** to the prior inline implementation (Lane B verified function-by-function, further hardened by `d061deec`).
- **No `apps/marketing` resurrection** — the cherry-pick correctly avoided the stale-branch regressions called out in the PR description.
- **Project-aware scope discipline**: the macOS-only payload supply chain is explicitly tracked as Goal #6 follow-up, not silently shipped as a defect.

---

## Final Recommendation

**Conditional-go.** PR #268 has progressed past the audit snapshot through 6 follow-up commits and the audit's primary unique contribution (T541 security fix) is implemented and verified in this session. Remaining open work is captured as follow-up tickets T538-T549 with explicit P0/P1/P2 priorities.

— Audit synthesized 2026-05-20 by parallel lanes A/B/C/D + central reconciliation; T541 implementation by same session.
