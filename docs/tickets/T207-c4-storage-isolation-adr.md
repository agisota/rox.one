# T207 - C4 storage isolation ADR

## Context

We are building a white-label fork of Craft Agents OSS into Agent Workbench Suite.

Relevant product goals:

- managed web/cloud app
- user/team workspaces
- validation gates
- TDD-first implementation

## Goal

Write ADR 0007 for the C4 multi-tenant storage isolation contract and update ADR 0005 to point its previously deferred tenancy concerns at ADR 0007.

## Required UI

None.

## Required Data/API

- New ADR: `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`.
- Update `docs/decision-records/audit-harness/0005-storage-tenancy-contract.md`.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

No runtime test is required for this documentation ticket. The verification is file existence, link/reference accuracy, and final C4 validation gates.

## Implementation Requirements

ADR 0007 must document:

- branded scope minting contract
- single-user flat layout preservation
- opt-in `ROX_MULTI_TENANT=1` tenant path behavior
- audit events on forgery and scope mismatch
- demo RPC caller status
- out-of-scope follow-up slices

## Validation Commands

- `test -f docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`
- `rg -n "ADR 0007|multi-tenant runtime|workspace-id forgery|scope leakage|audit logging" docs/decision-records/audit-harness/0005-storage-tenancy-contract.md docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`

## Acceptance Criteria

- [x] ADR 0007 exists and documents the implemented contract.
- [x] ADR 0005 out-of-scope section references ADR 0007 for implemented forgery, leakage, and audit logging concerns.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T207-c4-storage-isolation-adr.md`.
