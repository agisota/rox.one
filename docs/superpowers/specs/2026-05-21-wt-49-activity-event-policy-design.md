# WT-49: ActivityEvent emission policy (extends WT-08 audit)

**Branch:** `feat/activity-event-policy`
**Base SHA:** `7c12d14ed6fd`
**Wave:** 0+
**Priority:** P0
**Feature flag:** `rox.feature.activity-event-v1` (default OFF)
**Parent epic:** PZD-118 (E07 Audit)
**Featurebase board:** Enterprise B2B (`6a0db1dabaed70b5d8d3f898`)

## 1. Objective

Object-lifecycle event emission policy на основе WT-08 audit infrastructure. Любая мутация ContentObject/Relation/Placement → audit event. Subscribers: undo/sync/timeline/AI context refresh/search reindex/public link republish.

## 2. User goal

Когда пользователь меняет карту, в Linear timeline появляется запись; AI context auto-refreshes; backlinks count updates; sync replicates без manual flush. Всё через **один event bus**.

## 3. Files allowed

- `packages/shared/src/activity/event-policy.ts`
- `packages/shared/src/activity/emit.ts`
- `packages/shared/src/activity/subscription.ts`
- `packages/shared/src/activity/__tests__/emit.test.ts`
- `packages/shared/src/activity/__tests__/dedup.test.ts`

## 4. Files forbidden

- `packages/shared/src/audit/*` (WT-08 base — extended via this WT, not modified)
- `packages/shared/src/core/content-object.ts` (WT-46)
- root scaffolds

## 5. Depends on

- WT-08 (Audit infrastructure)
- WT-46 (ContentObject)

## 6. Blocks

- WT-18 (Audit log query UI)
- WT-32 (Evidence store — uses events)
- WT-51..58 (All Heptabase modules emit events)

## 7. Functional requirements

- **FR-1**: `ActivityEvent` extends WT-08 `AuditEvent` (same envelope: `event_id, ts, actor, tenant_id, type, severity, payload_json, prev_hash, hash`).
- **FR-2**: Standard event types: `content_object.{created,updated,deleted,restored}`, `block.{inserted,updated,reordered,deleted}`, `relation.{created,deleted}`, `placement.{created,moved,deleted}`, `source.{imported,refreshed}`, `public_link.{created,revoked}`, `ai_context.{built,invalidated,expanded}`, `module.{registered,activated}`.
- **FR-3**: Emit policy: **deduplication window 1s** — identical events within 1s collapsed (e.g. rapid block edits).
- **FR-4**: Subscription contract: `subscribe(eventType, handler)` returns unsubscribe fn. Handlers run async, errors logged НЕ throw.
- **FR-5**: Ordering: events for same `objectId` strict ordered (per-key queue).
- **FR-6**: Replay: `replayEvents(since, filter)` returns events for undo/sync rebuild.
- **FR-7**: Payload sanitizer (inherited from WT-08): redact tokens/secrets/passwords/cookies/authorization/api-key patterns BEFORE persist.

## 8. Non-functional requirements

- **NFR-1 perf**: emit < 5ms (sync path); subscribers async.
- **NFR-2 dedup**: 100 identical events in 1s window → 1 stored.
- **NFR-3 ordering**: per-objectId strict — same object events arrive in commit order.
- **NFR-4 durability**: event log append-only, NO update/delete.

## 9. Data model

Inherits WT-08 `AuditEvent` schema (no new tables). Adds:
- Subscription registry (in-memory per-process, with key = eventType pattern wildcard).
- Dedup window: per-process LRU keyed by `(eventType, objectId, actorId)`.

## 10. API / IPC

- `activity:emit(event)` → void (returns immediately, persisted async)
- `activity:subscribe(pattern, handler)` → unsubscribe fn
- `activity:replay(since, filter)` → AsyncIterator<ActivityEvent>

## 11. UI/UX

No UI. WT-18 (Audit Log Query) consumes events для display.

## 12. Security / RBAC

- Sanitizer enforced (no leak of secrets in event payload).
- Subscriber receives ONLY events visible to its tenant context.

## 13. TDD test list

- T-1: `emit persists event with hash + prev_hash chain`
- T-2: `100 identical events in 1s window → 1 stored (dedup)`
- T-3: `subscribe receives matching events only`
- T-4: `subscriber error does not block other subscribers`
- T-5: `per-objectId ordering preserved across concurrent emits`
- T-6: `replay returns events since timestamp filtered by type`
- T-7: `sanitizer redacts tokens/secrets before persist`
- T-8: `cross-tenant subscriber receives no events`
- T-9: `dedup window 1s — 1.1s apart events both stored`
- T-10: `emit < 5ms async (perf)`

## 14. Acceptance criteria

- AC-1: 10 TDD pass.
- AC-2: Dedup works under load (1000 events/s).
- AC-3: Per-object ordering test passes under concurrency.
- AC-4: Sanitizer test covers all redaction patterns.
- AC-5: typecheck + lint exit 0.

## 15. 14+8-role plan

| Phase | Roles |
|---|---|
| Discovery | brainstormer, scope-analyzer, critic |
| Design | sequence-chart-writer, prompt-writer |
| Impl | test-writer, implementer, super-coder, reviewer |
| Verify | verifier, critic, integrator |
| Optimize | optimizer |

## 16. Verification protocol

- 3-machine + load test 1000 events/s.

## 17. Feature flag

`rox.feature.activity-event-v1`, default OFF. Release cut: `foundation`.

## 18. Linear mapping

- Parent: PZD-118
- Child stories: "Standard event types enum", "Dedup window + per-key ordering", "Subscription registry + replay", "Sanitizer extension"

## 19. Featurebase mapping

- Board: Enterprise B2B
- Post alias: `wt-49-activity-event`

## 20. Inspiration repos (5)

- https://github.com/Siddhant-K-code/agent-trace — `concept` — agent execution event tracing.
- https://github.com/inngest/deep-research-neon-durable-endpoints — `reference_only` — durable event sourcing.
- https://github.com/OneUptime/oneuptime — `reference_only` — observability event streams.
- https://github.com/Openpanel-dev/openpanel — `reference_only` — event analytics patterns.
- https://github.com/exelban/stats — `reference_only` — low-overhead event emission.

## 21. Definition of done

- [ ] 10 TDD pass
- [ ] Load test 1000 events/s passes
- [ ] Per-object ordering verified
- [ ] Sanitizer covers all patterns
- [ ] typecheck + lint exit 0

## 22. Open questions

- Q1: Cross-process subscriber model — BroadcastChannel vs Redis Pub/Sub? **BroadcastChannel в v1 (single-process renderer); Redis в v2 для cloud agents.**
- Q2: Replay throughput — pagination size? **1000 events/page for query API.**

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** N/A (infrastructure)
- **UI surfaces affected:** N/A
- **Entities touched:** ActivityEvent (extends AuditEvent from WT-08)
- **Relations touched:** N/A
- **Events emitted:** Foundational — defines event types для всей системы
- **AI context implications (WT-48):** Triggers `ai_context.invalidated` when watched objects change
- **Search index implications (WT-50):** Triggers reindex on `content_object.updated`
- **12-gate artifacts required:** erd/event.mmd, sequence/emit-with-dedup.mmd, contracts/event.ts, evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** Object history/changelog (Heptabase shows it on card detail)
- **Risk axes:** data, security, perf
