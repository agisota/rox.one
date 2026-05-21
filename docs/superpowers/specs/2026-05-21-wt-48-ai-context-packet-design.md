# WT-48: AIContextPacket builder (permission-filtered)

**Branch:** `feat/ai-context-packet`
**Base SHA:** `7c12d14ed6fd`
**Wave:** 1
**Priority:** P0
**Feature flag:** `rox.feature.ai-context-packet-v1` (default OFF)
**Parent epic:** PZD-115 (E04 Skills/permissions) — AI features
**Featurebase board:** Compounding (`6a0db1b591b619c8111329f2`)

## 1. Objective

Permission-filtered AI context builder. Любой AI action получает только те объекты, на которые user имеет explicit `read` permission. **AI не должен видеть объекты вне permission scope.**

## 2. User goal

Когда пользователь спрашивает AI "summarize my workspace", AI получает packet с references на cards/notes которые пользователь видит, со citations возможностью; объекты других tenants/недоступные workspaces АВТОМАТИЧЕСКИ исключены.

## 3. Files allowed

- `packages/shared/src/ai/context-packet.ts`
- `packages/shared/src/ai/permission-filter.ts`
- `packages/shared/src/ai/citation-builder.ts`
- `packages/shared/src/ai/__tests__/context-packet.test.ts`
- `packages/shared/src/ai/__tests__/permission-filter.test.ts`

## 4. Files forbidden

- `packages/shared/src/core/content-object.ts` (WT-46), `relation.ts` (WT-47)
- `packages/shared/src/rbac/*` (WT-14)
- root `package.json`, `tsconfig.json`

## 5. Depends on

- WT-46 (ContentObject)
- WT-47 (RelationService — citation traversal)
- WT-14 (Roles engine — permission check)

## 6. Blocks

- WT-34 (Agent Run UI — uses AI context)
- WT-51..58 (Heptabase modules with AI assist)

## 7. Functional requirements

- **FR-1**: `AIContextPacket` schema: `{id, tenantId, userId, scope, objectRefs[], redactedFields[], builtAt, expiresAt, citations[]}`.
- **FR-2**: Scopes: `'session' | 'workspace' | 'selection' | 'whiteboard' | 'card'`.
- **FR-3**: `buildPacket(userId, scope, scopeId?)` — recursively traverses RelationService + permission-filters every object.
- **FR-4**: Redaction policy: strip `metadata.private`, `tokens`, `secrets`, `passwords` fields BEFORE inclusion.
- **FR-5**: Citation tracking: every objectRef + block referenced gets Citation entry with `objectId, blockId?, range?`.
- **FR-6**: TTL: packet expires (default 15 min); rebuild on access после expiry.
- **FR-7**: Fail-closed: if permission check throws, exclude object (don't include with denied flag).
- **FR-8**: Cap: max 100 objects per packet; over-cap truncates with `truncated: true` flag.

## 8. Non-functional requirements

- **NFR-1 perf**: build 50-object packet < 200ms.
- **NFR-2 fail-closed**: ZERO objects without explicit read permission visible.
- **NFR-3 audit**: every packet build → WT-49 emit `ai_context.built`.

## 9. Data model

```typescript
type ContextScope = 'session' | 'workspace' | 'selection' | 'whiteboard' | 'card';

interface ObjectRef {
  objectId: string;
  type: ContentObjectType;
  title: string;
  preview: string;       // truncated 200 chars, redacted
}

interface Citation {
  objectId: string;
  blockId?: string;
  range?: { start: number; end: number };
  text: string;
}

interface AIContextPacket {
  id: string;
  tenantId: string;
  userId: string;
  scope: ContextScope;
  scopeId?: string;
  objectRefs: ObjectRef[];
  redactedFields: string[];
  builtAt: string;
  expiresAt: string;
  citations: Citation[];
  truncated: boolean;
}
```

## 10. API / IPC

- `aiContext:build(userId, scope, scopeId?)` → AIContextPacket
- `aiContext:invalidate(packetId)` → void
- `aiContext:expand(packetId, relations)` → AIContextPacket (включает related objects via WT-47)

## 11. UI/UX

No UI in this WT. Agent Run UI (WT-34) consumes packets and shows citations.

## 12. Security / RBAC

- KEY INVARIANT: каждый objectRef в packet passed WT-14 `canRead(userId, objectId)` check.
- Denied objects silently excluded (no leak via error message).
- Redaction enforced via field-level whitelist (НЕ blacklist).
- Audit: WT-49 `ai_context.built` event with `objectCount, deniedCount, redactedFieldCount`.

## 13. TDD test list

- T-1: `buildPacket includes only objects with explicit read permission`
- T-2: `denied object silently excluded (no leak via error)`
- T-3: `redactedFields strips 'private'/'tokens'/'secrets'/'passwords' before include`
- T-4: `citations track objectId + blockId + range`
- T-5: `TTL expiry rebuilds on access`
- T-6: `cross-tenant object query returns empty packet`
- T-7: `cap 100 objects → 101st truncated:true`
- T-8: `expand traverses relations + re-applies permission filter`
- T-9: `permission check failure → object excluded (fail-closed)`
- T-10: `audit emit on every build`

## 14. Acceptance criteria

- AC-1: 10 TDD pass.
- AC-2: Fuzz test: 100 random user/scope combinations — zero leaked objects.
- AC-3: Perf: 50-object packet < 200ms.
- AC-4: Audit log shows every packet build.
- AC-5: typecheck + lint exit 0.

## 15. 14+8-role plan

| Phase | Roles |
|---|---|
| Discovery | brainstormer, requirements-keeper, scope-analyzer, critic |
| Design | erd-writer, prompt-writer, architect |
| Impl | test-writer (opus), implementer, super-coder, reviewer |
| Verify | verifier, critic, integrator |
| Optimize | optimizer |

## 16. Verification protocol

- 3-machine tests + fuzz test harness.
- Audit log validation: every build emits event.

## 17. Feature flag

`rox.feature.ai-context-packet-v1`, default OFF. Release cut: `agent`.

## 18. Linear mapping

- Parent: PZD-115
- Child stories: "Packet schema + Zod", "Permission filter + fail-closed", "Citation builder + range tracking", "TTL + invalidation", "Audit emit"

## 19. Featurebase mapping

- Board: Compounding
- Post alias: `wt-48-ai-context-packet`

## 20. Inspiration repos (5)

- https://github.com/Agenta-AI/agenta — `reference_only` — LLM context management patterns.
- https://github.com/hegelai/prompttools — `reference_only` — prompt context tracking.
- https://github.com/elder-plinius/L1B3RT4S — `reference_only` — jailbreak prevention (negative learning).
- https://github.com/openai/symphony — `reference_only` — multi-agent context coordination.
- https://github.com/safishamsi/graphify — `concept` — knowledge graph as context source.

## 21. Definition of done

- [ ] 10 TDD pass
- [ ] Fuzz test 100 combinations zero leaks
- [ ] Perf < 200ms verified
- [ ] Audit emit on every build
- [ ] typecheck + lint exit 0
- [ ] Linear sub-issue Done, FB post Shipped

## 22. Open questions

- Q1: Citation block range — character offset or block-id only? **Character offset within block for v1; future v2 considers block-id only.**
- Q2: Packet caching — Redis vs in-memory LRU? **In-memory LRU per-user, 100 max; Redis в v1.5 для cross-process sharing.**

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** ask-ai-about-workspace, summarize-selected-cards
- **UI surfaces affected:** N/A (consumed by Agent Run UI WT-34)
- **Entities touched:** AIContextPacket (NEW), references ContentObject (WT-46), Relation (WT-47)
- **Relations touched (WT-47):** Used for citation traversal
- **Events emitted (WT-49):** `ai_context.built`, `ai_context.invalidated`, `ai_context.expanded`
- **AI context implications:** Foundational AI privacy boundary
- **Search index implications (WT-50):** Reads index for objectRef preview text
- **12-gate artifacts required:** cjm/ask-ai-workspace.md, erd/packet.mmd, sequence/build-packet.mmd, contracts/context-packet.ts, evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** AI Tutor/Chat with citations
- **Risk axes:** data, security
