# v1.0.0-rc.1 — RC tag decision matrix

The operator runs `bun run rc:preflight` and uses this matrix to
decide GO / NO-GO / GO-with-caveats on the `v1.0.0-rc.1` tag.

## GO criteria (all must hold)

| #  | Criterion                                                                                    | Evidence                            |
| -- | -------------------------------------------------------------------------------------------- | ----------------------------------- |
| 1  | All `rc:preflight` gates green (`bun run rc:preflight` exits 0)                              | Runner output table                 |
| 2  | All M.20 deliverables on main                                                                | PR refs in m20-phase-20-closeout.md |
| 3  | Zero P0/P1 open issues tagged `release-blocker`                                              | `gh issue list --label release-blocker --state open` returns empty |
| 4  | All M.13 security tickets `Status: DONE`                                                     | T038, T052, T071, T071b, T071c, T086, T086b, T086c, T243, T244, T303 |
| 5  | M.13 ADRs 0012–0015 on main                                                                  | `docs/decision-records/audit-harness/0012-0015*.md` exist |
| 6  | Cross-platform signed-build workflow shapes validated                                        | T251 (Mac), T254 (Linux GPG), T252 Windows (validator only) |
| 7  | Audit producer + sink + retention + bootstrap fully wired                                    | T246d composition root active in `headless-start.ts` |
| 8  | RBAC admin surface end-to-end works                                                          | T228 + T229 e2e + T230 ADR + T231 team mgmt + T232 audit log |
| 9  | Composer Pillar 4 surfaces all interactive                                                   | T234–T239 in main, T240-cheatsheet shipping |
| 10 | `validate:rebrand` clean — no `CRAFT_*` or `@craft-agent/*` outside allowlist                | `bun run validate:rebrand` exits 0  |

## NO-GO criteria (any one is blocking)

| #  | Criterion                                                                                    | Mitigation                          |
| -- | -------------------------------------------------------------------------------------------- | ----------------------------------- |
| 1  | `rc:preflight` reports any red                                                               | Triage the failing gate; fix, re-run |
| 2  | Mac trust boundary validator red                                                             | T250 fixture failure → cannot sign; defer tag |
| 3  | Audit-sink rotation throws in any test environment                                           | T249 rotation logic failure; defer  |
| 4  | RBAC scope-forgery property test seed reproduces an `allow` decision on adversarial input    | T243 vulnerability; security hotfix before tag |
| 5  | Bundle budget exceeded (renderer JS > 1.5 MB gzip or M.16 carve-out broken)                  | T132 code-split + re-evaluate       |
| 6  | Open P0 issue tagged `release-blocker`                                                       | Resolve before tag                  |
| 7  | M.21 prep CHANGELOG missing v1.0.0 entry                                                    | Already shipped via #165; verify present |
| 8  | Any of the three trust-boundary validators (Mac/Win/Linux) emits a red on real bundle output | Platform-specific fix; defer tag    |

## GO-with-caveats (yellow signals + workarounds)

| #  | Signal                                                                                     | Workaround                                          |
| -- | ------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| 1  | `T223-tenant-credential-key-derivation.md` missing `Status:` line (pre-existing baseline)  | Note in tag annotation; non-blocking                |
| 2  | Spine ledger `M.1.3b` heading mismatch (pre-existing baseline)                            | Note in tag annotation; non-blocking                |
| 3  | RC smoke scenarios S07/S08 not yet on main (codex parallel work)                          | RC tag can still ship; smoke harness extends afterwards |
| 4  | `validate:bundle-budget` / `bundle-policy` staged (require `electron:build`)              | Run via the actual signed-build CI workflow; verify post-merge |
| 5  | T250-rpc audit query handler not yet on main (Wave-v12 agent lost work)                   | Audit-log surface (T232) reads from injected source; real RPC ships post-RC as T250-rpc-b |

## Decision-time evidence packet

The operator quotes this evidence in the `v1.0.0-rc.1` tag annotation
body:

```
Pre-flight gates: 16/16 green (per bun run rc:preflight at SHA <X>)
M.20 deliverables: 100% on main (per docs/release/m20-phase-20-closeout.md)
M.13 ADRs: 0012-0015 present
Audit producer: wired in headless-start.ts (T246d)
Cross-platform trust boundaries: Mac/Win/Linux validators all green (non-platform skips documented)
Open release blockers: zero
SHA: <main HEAD at tag time>
Validators run: <list of validator names>
```

Plus the SHA-256 of the rendered `docs/release/m20-phase-20-closeout.md`
and `docs/release/v1-rc-72h-soak-protocol.md` for tamper-evidence.

## Post-RC: 72h soak

See `docs/release/v1-rc-72h-soak-protocol.md` for the soak rules.
If the soak passes, proceed to:

1. **R.11** — git filter-repo (destructive force-push; gated by 9
   prereqs; runbook at `docs/release/m3-merge-runbook.md` for
   M.3-style preconditions; R.11 has its own checklist in the
   rebrand goal doc).
2. **M.21** — tag `v1.0.0`, update CHANGELOG.md date, publish
   GitHub Release using `docs/release/v1-github-release-template.md`.

## Rollback

If a P0 surfaces post-tag:

1. `git tag -d v1.0.0-rc.1` locally
2. `git push --delete origin v1.0.0-rc.1`
3. File `T??-rc.1-rollback-<reason>.md` ticket
4. Fix lands on main as a separate PR
5. Re-roll `v1.0.0-rc.2` from the new main HEAD
6. Re-run the 72h soak from zero
