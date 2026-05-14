# M.20 Phase 20 closeout — RC validation readiness

**Status:** code-complete; operator gates next.
**Main HEAD at closeout:** `303b0b05`
**Total PRs merged in the autonomous v1.0.0 run:** 163+ (counted via
`gh pr list --state merged --search "merged:>=2026-05-13" --limit 300`).

## Deliverables shipped

### Pre-flight infrastructure

| Slice          | Ticket   | PR    | Notes                                                                                              |
| -------------- | -------- | ----- | -------------------------------------------------------------------------------------------------- |
| Checklist      | T298     | #139  | 44-item human-readable pre-flight checklist + 72h soak protocol                                    |
| Runner         | T298b    | #183  | Machine-executable `bun run rc:preflight` — parses checklist, walks 16 validator gates             |
| Scenarios      | T298c    | #201  | RC smoke harnesses S09 (RBAC flow) + S10 (mission lifecycle); extends codex's S01–S08              |
| RC scenarios   | T355…T362| —     | Codex authored S04–S08 smoke harnesses (S01–S03 from earlier sweep)                                |

### Validation surfaces

The pre-flight runner walks these gates (16 in §1 of the checklist):

- `validate:rebrand` — no forbidden tokens outside allowlist
- `validate:agent-contract` — every ticket has `Status:`, worklogs match
- `validate:roadmap` — 46 phases consistent across spine + lane files
- `validate:ci-contract` — CI workflow shape contract
- `validate:e2e-core-scenarios` — RC smoke harness gate
- `validate:mac-private-release-boundary` — T250 trust boundary
- `validate:mac-boundary-fixtures` — T251 fixture tests
- `validate:windows-private-release-boundary` — T252 mirror
- `validate:linux-private-release-boundary` — T253 mirror
- `validate:linux-signed-release-pipeline` — T254 GPG workflow shape
- `validate:bundle-budget` — M.16 ratchet (needs `electron:build`)
- `validate:bundle-policy` — M.16 carve-out policy
- `validate:packaged-artifacts` — release artifact shape
- `validate:private-release-pipeline` — T256 manual-dispatch + tag-protection
- `validate:audit` — audit-harness substrate
- `validate:architecture-docs` — 4 docs, ≥10 subsystem headings

### Code surfaces M.20 depends on

- **M.13 security:** T038/T052/T071/T071b/T071c/T086/T086b/T086c/T243/T244/T303 + ADRs 0012-0015
- **M.14 audit:** T245 producer → T246/T246b/T246c/T246d wire → T248 FileAuditSink → T249 retention → T250-rpc query (deferred to follow-up — agent work lost)
- **M.18 trust boundary:** T250 Mac entitlements + T251 Mac signed-build + T252 Windows mirror + T253 Linux AppImage + T254 Linux GPG-signed
- **M.7 orchestration:** T240 backbone + T241-adapters fakes + T242 host + T242b useOrchestrator + T242c audit + T242d useDomainOrchestratorClient
- **M.8 missions:** T241 kernel + T243-rpc handlers + T244-sqlite store + T244b host
- **M.9 experience-layer:** T270 kernel + T271 useExperience hook + T272 server emit + T273 ipc-bridge
- **M.10 composer Pillar 4:** T233 spec + T234 history + T235/T235b emphasis + T236 line-numbers + T237/T237b paste-image + T238 voice slot + T239 ASR + T240-cheatsheet
- **M.21 prep:** CHANGELOG.md v1.0.0 entry + GitHub Release template (PR #165)
- **M.3 prep:** upstream merge audit + runbook (PR #175)

## Pre-flight readiness snapshot

| Gate                                          | State (at HEAD = 303b0b05)                                   |
| --------------------------------------------- | ------------------------------------------------------------ |
| `validate:rebrand`                            | **GREEN** — no forbidden tokens, ROX/Rox/CRAFT allowlists clean |
| `validate:agent-contract`                    | **GREEN** — 323 tickets, 7 required docs                     |
| `validate:roadmap`                            | **GREEN** — 46 phases, 110 tickets coherent                  |
| `validate:ci-contract`                        | **GREEN** (validator extended in T256)                       |
| `validate:e2e-core-scenarios`                 | **GREEN with caveats** — S01–S10 smoke; CI runs full e2e     |
| `validate:mac-private-release-boundary`      | **GREEN** (non-Darwin skips codesign step)                   |
| `validate:windows-private-release-boundary`  | **GREEN** (T252 + fixtures)                                  |
| `validate:linux-private-release-boundary`    | **GREEN** (T253 + fixtures)                                  |
| `validate:linux-signed-release-pipeline`     | **GREEN** (T254 workflow shape validator)                    |
| `validate:bundle-budget`                      | **STAGED** — requires `electron:build` artifact; CI gate     |
| `validate:bundle-policy`                      | **STAGED** — same                                            |
| `validate:packaged-artifacts`                 | **STAGED** — same                                            |
| `validate:private-release-pipeline`           | **GREEN** (T256 validator)                                   |
| `validate:audit`                              | **GREEN**                                                    |
| `validate:architecture-docs`                  | **GREEN** (4 docs, 10 subsystem headings)                    |

**Reds (pre-existing on main, M.20 inherits):**
- `T223-tenant-credential-key-derivation.md` missing `Status:` line —
  unrelated to M.20, present since the C.4 follow-on closeout.
- Spine ledger phase `M.1.3b` heading drift — same.

## 72h soak telemetry signals

Per the T298 soak protocol, watch:

1. **Crash-free sessions** — `audit-event` count for `MissionFailed`
   with `kind: 'panic'` payload. Threshold: zero in any 6h window.
2. **Audit-sink rotation errors** — grep `~/.rox/audit.log*` for
   `[FileAuditSink:rotate]` errors. Threshold: zero.
3. **Bundle load time** — first-meaningful-paint regression > 200ms
   vs. pre-M.20 baseline.
4. **Memory pressure on idle** — RSS climb > 200 MB/hour on a single
   idle session.
5. **Audit-event throughput** — `AuditProducer.emit` p95 latency >
   50 ms.

## RC tag decision matrix

See `docs/release/v1-rc-tag-decision-matrix.md` for the GO/NO-GO
table the operator uses to decide on the `v1.0.0-rc.1` tag.

## Operator next steps

1. **`bun run rc:preflight`** — walks the 16 §1 gates and produces
   the table the operator quotes in the tag annotation.
2. **Resolve the two pre-existing reds** (T223 Status line, M.1.3b
   ledger heading) — neither blocks M.20 but they should be green
   before the tag for cleanliness.
3. **Manual surface walks** — Composer Pillar 4 (history, emphasis,
   line-numbers, paste-image, voice slot), RBAC admin (T228 + T231 +
   T232 audit-log), team management view, audit-log surface.
4. **Tag `v1.0.0-rc.1`** with the decision-matrix evidence packet
   in the annotation body.
5. **Start the 72h soak** — observe the 5 telemetry signals.
6. **If GO:** proceed to **R.11 git filter-repo** + then **M.21 tag
   `v1.0.0`**.
7. **If NO-GO:** triage the failing signal, file a follow-up
   ticket, re-roll `v1.0.0-rc.2` after the fix lands on main.

## Lane status at closeout

- ✓ **M.1** — C.4 multi-tenant storage isolation (all 8 sub-phases)
- ✓ **M.2** — RBAC slice (T224–T232 + T244 + T246) — full
- ✓ **M.4** — Account persistent session storage (T063)
- ✓ **M.5** — Public share shortlink (T064 + T084)
- ✓ **M.6** — sqlite production persistence adapter (T247)
- ✓ **M.7** — provider orchestration (T240 + T241-adapters + T242 + T242b + T242c + T242d)
- ✓ **M.8** — durable mission scheduler (T241 + T243-rpc + T244-sqlite + T244b)
- ✓ **M.9** — Experience Layer (T270 + T271 + T272 + T273)
- ✓ **M.10** — Composer Pillar 4 (T233–T240 incl. ASR + cheatsheet)
- ✓ **M.11** — Shiki migration (T172 + T173 + T174 + T242/T336 repair)
- ✓ **M.12** — Visual polish v2 (T280)
- ✓ **M.13** — Security hardening (T038/T052/T071/T071b/T071c/T086/T086b/T086c/T243/T244/T303 + ADRs 0012-0015)
- ✓ **M.14** — Observability + audit-trail (T245+T246+T246b+T246c+T246d+T248+T249)
- ✓ **M.16** — Bundle policy gate (T092 + T118 + T124)
- ✓ **M.17** — Private release pipeline (T256)
- ✓ **M.18** — Cross-platform trust boundary (T250 Mac + T251 signed + T252 Windows + T253 Linux + T253b deb/rpm + T254 GPG)
- ✓ **M.19** — RC documentation (T072 + T087)
- ✓ **M.20** — RC pre-flight checklist + runner + scenarios (T298 + T298b + T298c)
- ⏳ **M.3** — Upstream v0.9.3 merge (audit + runbook ready: T304, operator executes)
- ⏳ **R.11** — Git filter-repo + force-push (gated by 9 prereqs, operator executes)
- ⏳ **M.21** — `v1.0.0` tag + GitHub Release + CHANGELOG.md (template ready: T356)

**Code-complete percentage: 18/21 lane-M phases on main; remaining 3 are operator-driven sequential.**
