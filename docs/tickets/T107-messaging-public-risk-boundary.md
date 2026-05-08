# T107 - Messaging Public Risk Boundary

Status: DONE

## Context

T104 records public-production dependency risk in messaging/provider surfaces:
`@larksuiteoapi/node-sdk`, `@whiskeysockets/baileys`, `protobufjs`, `axios`,
and `music-metadata`. T106 added a local-only trust boundary for document
conversion; the messaging stack needs the same kind of explicit guard so public
server exposure cannot silently start risky external-ingress adapters.

## Goal

Add a narrow messaging dependency-risk policy that keeps Lark and WhatsApp
disabled under `public-untrusted` exposure unless a later ticket adds explicit
remediation, isolation evidence, or signed accepted-risk handling.

## Required UI

No UI change.

## Required Data/API

- Keep the existing private/local messaging bootstrap behavior unchanged.
- Reject Lark credential save/connect under `public-untrusted` before network
  credential validation or SDK startup.
- Reject WhatsApp connect under `public-untrusted` before worker startup.
- Preserve Telegram behavior; T104 does not identify Telegram's `grammy` path
  as a current dependency-audit blocker.
- Add a headless-server wiring point so public deployment can choose the strict
  policy through runtime configuration.

## Required Automations

- Add focused unit regressions for Lark and WhatsApp public-risk rejection.
- Keep existing registry tests green.

## Required Subagents

No subagent required: this is a bounded messaging lifecycle guard.

## TDD Requirements

Before implementation:

1. Add the messaging public-risk tests.
2. Run the focused registry test and confirm the expected red failure.

## Implementation Requirements

- Add an explicit messaging dependency-risk mode.
- Default existing callers to private/local behavior.
- In public-untrusted mode, fail before network or worker startup.
- Do not change dependency versions or dependency manifests.

## Validation Commands

- `bun test packages/messaging-gateway/src/__tests__/registry.test.ts`
- `cd packages/messaging-gateway && bun run typecheck`
- `cd packages/server && bun run typecheck`
- `cd packages/server-core && bun run typecheck`
- `bun test packages/server-core/src/accounts/__tests__/postgres-store.test.ts`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Lark public-untrusted rejection fails red before guard and passes after | DONE |
| WhatsApp public-untrusted rejection fails red before guard and passes after | DONE |
| Rejections happen before network/worker startup | DONE |
| Private/local messaging behavior remains green | DONE |
| Dependency manifests and lockfiles remain unchanged | DONE |
| Docs validation passes | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T107-messaging-public-risk-boundary.md`.
