# ROX ONE Agent Workbench Suite - Production Readiness Matrix 2026-05-06

Branch: `mac/rox-production-ready-rc`

## 1. Readiness Summary

| Area | RC readiness | Evidence | Production blocker |
|---|---|---|---|
| Experience runtime truth | Ready for private RC | T074, T076, T077, T080, T082, T086, T088, T089 tests | Production persistence hydration across full app shell |
| Deep Missions | Ready for private RC | T075 tests and worklog | Hosted scheduler/worker deployment |
| Mission Control | Ready for private RC | T076, T088, T089 tests | Real long-running worker and notification channel |
| Metrics/quests | Ready for private RC | T077, T082, T089 replay/projection tests | Production analytics persistence |
| Agent Arena/Forge | Ready for private RC | T078 trust tests | Signed package registry and review pipeline |
| Provider orchestration | Contract-ready | T079 gateway tests | Real provider adapters, credentials, observability |
| Global HUD | RC-visible | T080/T081 component tests | Full persisted runtime provider wiring |
| Visual polish | RC-ready | T081 component state tests | Screenshot regression and full visual QA |
| E2E journey | Fake-provider-ready | T082 validators | Live external provider e2e |
| ROX ID | RC-safe | T083 feedback tests | Real auth/email backend verification |
| Share/shortlink | Contract-ready | T084, T089 provider/status tests | Public viewer/storage/shortlink service |
| Private CI | Ready | T085 validators | Remote private CI run on protected branch |
| Security | RC-hardened | T086 + prior T071 tests; T104 dependency risk-register [dependency-risk-register-2026-05-08.md](dependency-risk-register-2026-05-08.md) records the current `bun audit` blocker | External audit and dependency remediation or signed accepted-risk approval |
| Electron build | Local-ready | T087 final build gate | Signed/notarized artifact |

## 2. Product Architecture Diagram

```text
ROX ONE App
  -> Renderer screens
  -> ExperienceRuntimeStore
  -> selectors and HUD
  -> IPC/DTO contracts
  -> server-core services
  -> provider/scheduler/share/persistence seams
  -> fake providers in tests
  -> future production adapters
```

## 3. Gate Status

| Gate | Status | Notes |
|---|---|---|
| Docs validation | Pass | `bun run validate:docs` passed in the current handoff pass; T095/T096 keep ticket/worklog metadata aligned with git truth |
| Agent contract validation | Pass | `bun run validate:agent-contract` passed through `validate:docs`; 11 skills, 97 tickets, 7 required docs after T096 |
| Typecheck | Pass | `bun run typecheck:all` passed |
| Tests | Pass | Full `bun test` is green in the current verified release-hardening state: 4722 pass, 13 skip, 0 fail, 1 snapshot |
| Lint | Pass | `bun run lint` passed with 0 errors and 0 warnings after T093 cleared the remaining React hook dependency warnings |
| Electron build | Pass | `bun run electron:build` passed; Vite chunk warnings only; packaged arm64 evidence audited in T091 |
| CI parity | Historical/full-pass evidence | Full release-hardening state includes green `bun test`, `typecheck:all`, docs, lint, build, smoke, packaged smoke, and packaged arm64 build evidence; `validate:ci` itself was not the command rerun in T091 |
| E2E core | Pass | Current handoff reran `validate:e2e-core-scenarios`; historical `e2e:core` pass remains recorded in T087 evidence |
| Electron smoke | Pass | `bun run electron:smoke` passed on a GUI-capable non-sandbox launch surface; app initialized successfully |
| Mac ARM workflow contract | Pass | `bun run validate:mac-arm-build-workflow` passed; packaged artifact set and manifest references additionally verified in T091 |
| Packaged artifacts | Pass | `bun run validate:packaged-artifacts` verified DMG/ZIP/blockmap/latest metadata and SHA256 hashes |
| Bundle artifact report | Pass with warnings | `bun run report:bundle-artifacts` passed; size warnings remain non-fatal T092 follow-up scope |
| Desktop app identity | Pass | T097 focused validation keeps Electron package/dev/workflow naming on `ROX.ONE` |
| Whitespace | Pass | `git diff --check` passed |

## 4. Production Decision

Private RC: yes, with T088/T089/T090 complete, full test/typecheck/docs/lint/build/smoke evidence green in the current verified state, T091 adding explicit packaged-artifact audit evidence, T092 documenting bundle-size risk, T093 restoring zero-warning aggregate lint, T095 reconciling release-state metadata against git truth, T096 closing local verification blockers, and T097 normalizing desktop app identity to `ROX.ONE`. Public-production blockers remain separate.

Public production: no. Public launch remains blocked by real provider
integration, hosted persistence, public share infrastructure, ROX ID email
verification, payments/billing reconciliation, signed/notarized release,
observability, dependency audit remediation or signed accepted-risk approval,
and external security review.
