# ROX ONE Agent Workbench Suite - Production Readiness Matrix 2026-05-06

Branch: `mac/rox-production-ready-rc`

## 1. Readiness Summary

| Area | RC readiness | Evidence | Production blocker |
|---|---|---|---|
| Experience runtime truth | Ready for private RC | T074, T076, T077, T080, T082, T086 tests | Production persistence hydration across full app shell |
| Deep Missions | Ready for private RC | T075 tests and worklog | Hosted scheduler/worker deployment |
| Mission Control | Ready for private RC | T076 tests | Real long-running worker and notification channel |
| Metrics/quests | Ready for private RC | T077/T082 replay tests | Production analytics persistence |
| Agent Arena/Forge | Ready for private RC | T078 trust tests | Signed package registry and review pipeline |
| Provider orchestration | Contract-ready | T079 gateway tests | Real provider adapters, credentials, observability |
| Global HUD | RC-visible | T080/T081 component tests | Full persisted runtime provider wiring |
| Visual polish | RC-ready | T081 component state tests | Screenshot regression and full visual QA |
| E2E journey | Fake-provider-ready | T082 validators | Live external provider e2e |
| ROX ID | RC-safe | T083 feedback tests | Real auth/email backend verification |
| Share/shortlink | Contract-ready | T084 provider/status tests | Public viewer/storage/shortlink service |
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
| Docs validation | Pass | `bun run validate:docs` passed |
| Agent contract validation | Pass | `bun run validate:agent-contract` passed; 11 skills, 88 tickets, 7 required docs |
| Typecheck | Pass | `bun run typecheck:all` passed |
| Tests | Pass | `bun test` passed; 4708 pass, 13 skip, 0 fail |
| Lint | Pass | `bun run lint` passed with 0 errors and 3 existing React hook warnings |
| Electron build | Pass | `bun run electron:build` passed; Vite chunk warnings only |
| CI parity | Pass | `bun run validate:ci` passed |
| E2E core | Pass | `validate:e2e-core-scenarios` and `e2e:core` passed |
| Electron smoke | Pass | `bun run electron:smoke` passed; app initialized successfully |
| Mac ARM workflow contract | Pass | `bun run validate:mac-arm-build-workflow` passed |
| Whitespace | Pass | `git diff --check` passed |

## 4. Production Decision

Private RC: yes, with final T087 validation passed locally.

Public production: no. Public launch remains blocked by real provider
integration, hosted persistence, public share infrastructure, signed release,
observability, dependency audit, and external security review.
