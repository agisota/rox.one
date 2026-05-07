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
| Security | RC-hardened | T086 + prior T071 tests | External audit and dependency risk register |
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
| Docs validation | Pass | `bun run validate:docs` passed in the current pass and in prior RC evidence |
| Agent contract validation | Pass | `bun run validate:agent-contract` passed; 11 skills, 92 tickets, 7 required docs |
| Typecheck | Pass | `bun run typecheck:all` passed |
| Tests | Pass | Full `bun test` is green in the current verified release-hardening state: 4721 pass, 13 skip, 0 fail, 1 snapshot |
| Lint | Pass | `bun run lint` passed with 0 errors and 3 existing React hook warnings |
| Electron build | Pass | `bun run electron:build` passed; Vite chunk warnings only; packaged arm64 evidence audited in T091 |
| CI parity | Historical/full-pass evidence | Full release-hardening state includes green `bun test`, `typecheck:all`, docs, lint, build, smoke, packaged smoke, and packaged arm64 build evidence; `validate:ci` itself was not the command rerun in T091 |
| E2E core | Pass | `validate:e2e-core-scenarios` and `e2e:core` passed |
| Electron smoke | Pass | `bun run electron:smoke` passed; app initialized successfully |
| Mac ARM workflow contract | Pass | `bun run validate:mac-arm-build-workflow` passed; packaged artifact set and manifest references additionally verified in T091 |
| Whitespace | Pass | `git diff --check` passed |

## 4. Production Decision

Private RC: yes, with T088/T089/T090 complete, full test/typecheck/docs/lint/build/smoke evidence green in the current verified state, and T091 adding explicit packaged-artifact audit evidence. Public-production blockers remain separate.

Public production: no. Public launch remains blocked by real provider
integration, hosted persistence, public share infrastructure, signed release,
observability, dependency audit, and external security review.
