# T065 - Production Persistence Adapter Contracts

Status: DONE

## Goal

Create a typed persistence adapter seam for ROX ONE account, team, ledger, storage, sync, mission, quest, metric, audit, and agent package state.

## Context

The product surfaces from T041-T064 exist with deterministic fake providers and in-memory stores. T065 must not wire a production database directly. It must first make the persistence boundary explicit and contract-tested so later tickets can add durable adapters without changing domain/UI code.

## Scope

- Add a `packages/server-core/src/persistence` module.
- Aggregate existing account/team/ledger/audit/storage/sync stores behind one `AgentWorkbenchPersistenceAdapter` contract.
- Add mission run, checkpoint, scheduler event, quest progress, progression ledger, metric snapshot, and agent package repository contracts.
- Provide deterministic in-memory implementations for tests and local development.
- Preserve evidence rules for quests, XP/unlocks, metrics, and validation-backed progression.
- Preserve package visibility rules for built-in, private, team, and public packages.
- Do not connect a production database in this ticket.

## Acceptance Criteria

- [x] Contract tests cover account CRUD/session basics through the adapter.
- [x] Contract tests cover team, ledger, audit, storage, and sync through the adapter.
- [x] Contract tests cover mission runs/checkpoints/events with idempotent checkpoint tracking.
- [x] Contract tests cover quest progress and progression ledger evidence enforcement.
- [x] Contract tests cover metric snapshots and agent package visibility.
- [x] The adapter is exported from `@craft-agent/server-core/persistence`.
- [x] Existing server-core/shared tests still pass.
- [x] Worklog complete.
