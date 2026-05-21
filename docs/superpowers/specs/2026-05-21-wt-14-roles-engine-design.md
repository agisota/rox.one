# WT-14 — Roles engine (owner/admin/editor/commenter/viewer) — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for implementation (TDD-first)
**Ветка:** `feat/roles-engine`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-14-roles-engine/`
**Wave:** 1
**Priority:** P0
**Depends on:** WT-06 (workspace/team contract)
**Blocks:** WT-15 (membership-invite), WT-16 (tenant isolation tests), WT-17 (RBAC admin UI)
**Parent epic:** PZD-113 (E02 Auth/RBAC)
**FB board:** Enterprise B2B (`6a0db1dabaed70b5d8d3f898`)
**Feature flag:** `rox.feature.rbac.roles-engine` (default OFF, release cut "Auth")

---

## 1. Контекст

ROX.ONE имеет два user-tier: owner и member. Этого недостаточно для enterprise multi-tenant сценариев:
- Команда хочет, чтобы junior-инженеры могли только смотреть (`viewer`) или комментировать (`commenter`), а не редактировать промпты.
- Workspace owner делегирует `admin` доверенному менеджеру (билинг, invite).
- В team-hierarchy роли наследуются (роль в parent team → роль в child workspace).
- Per-object override: на конкретном prompt-pack `viewer` тимы повышен до `editor` для специфической истории.

Этот WT реализует чистую RBAC-engine — pure-function evaluation. CRUD ролей/membership (assign role to user) — WT-15. Этот WT отвечает за:
- Role enum + permission matrix.
- Policy evaluator (`canUser(userId, action, resource) → boolean`).
- Role inheritance в team hierarchy.
- Per-object role override.
- Audit emit на каждую отказную/одобренную проверку (для compliance trail; sample-rate-able).

## 2. Цели и нецели

### 2.1 In scope

- `Role` enum: `owner | admin | editor | commenter | viewer`.
- `Permission` enum (≥30 actions: `prompt.read`, `prompt.write`, `member.invite`, `billing.read`, etc.).
- `RolePermissionMatrix` — статическая таблица role → permissions[].
- `PolicyEvaluator.canUser(userId, action, resource) → Result<boolean, EvalError>`.
- Role inheritance в team-hierarchy (child inherits parent unless override).
- Per-object override через `object_role_grants` (resource_id, user_id, role).
- Audit emit `rbac.evaluate.{allowed,denied}` с reason chain.
- Feature flag gated.

### 2.2 Out of scope

- Role CRUD (assign role to user) — WT-15 (membership).
- HTTP API для policy admin → WT-17.
- Custom-role definitions → defer (v2).
- Attribute-based access control (ABAC) → defer.
- Membership.ts / tenant_members table CRUD — owned by WT-15.

## 3. Архитектура

```
┌───────────────────────────────────────────────────────────────┐
│  caller (IPC handler) → policyEval.canUser(userId, 'prompt.   │
│   write', { type:'prompt', id:'p123', team:'t-eng' })         │
│                                                               │
│       ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  PolicyEvaluator  (packages/shared/rbac/policy-eval.ts) │  │
│  │   1. fetchEffectiveRole(userId, resource)               │  │
│  │      ├─ check object_role_grants (highest priority)     │  │
│  │      ├─ check direct workspace membership role          │  │
│  │      ├─ walk team hierarchy → inherited role            │  │
│  │      └─ fallback: deny                                  │  │
│  │   2. check RolePermissionMatrix[role].includes(action)  │  │
│  │   3. emit audit (sampled) + return Result               │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  RolesEngine (packages/shared/rbac/roles-engine.ts)           │
│   ├─ Role enum                                                │
│   ├─ Permission enum                                          │
│   ├─ RolePermissionMatrix (frozen, exhaustive)                │
│   ├─ roleRank(role) → number   (для compare/escalation)       │
│   └─ inheritFrom(parentRole, childRole) → effectiveRole       │
└───────────────────────────────────────────────────────────────┘
```

### 3.1 Permission matrix (high-level)

| Permission | owner | admin | editor | commenter | viewer |
|---|---|---|---|---|---|
| billing.* | ✓ | ✓ | ✗ | ✗ | ✗ |
| member.invite | ✓ | ✓ | ✗ | ✗ | ✗ |
| member.remove | ✓ | ✓ | ✗ | ✗ | ✗ |
| workspace.delete | ✓ | ✗ | ✗ | ✗ | ✗ |
| workspace.settings.write | ✓ | ✓ | ✗ | ✗ | ✗ |
| prompt.write | ✓ | ✓ | ✓ | ✗ | ✗ |
| prompt.delete | ✓ | ✓ | ✓ | ✗ | ✗ |
| prompt.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| comment.write | ✓ | ✓ | ✓ | ✓ | ✗ |
| comment.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| audit.read | ✓ | ✓ | ✗ | ✗ | ✗ |

Полная матрица в `packages/shared/rbac/permission-matrix.ts` (frozen const ≥30 actions).

### 3.2 Files allowed

- `packages/shared/src/rbac/roles-engine.ts`
- `packages/shared/src/rbac/policy-eval.ts`
- `packages/shared/src/rbac/permission-matrix.ts`
- `packages/shared/src/rbac/role-inheritance.ts`
- `packages/shared/src/rbac/types.ts`
- `packages/shared/src/rbac/index.ts`
- `apps/electron/src/main/rbac/object-grant-store.ts` — read-only lookup для object_role_grants
- `apps/electron/src/main/rbac/index.ts`
- `tests/unit/rbac/**`
- `tests/integration/rbac/**`

### 3.3 Files forbidden

- `apps/electron/src/main/rbac/membership.ts` — owned by WT-15 (CRUD).
- `apps/electron/src/main/rbac/membership-store.ts` — WT-15.
- `packages/shared/src/core/workspace.ts` — owned by WT-06 (read-only).
- `package.json`, `tsconfig*.json`, `bun.lock`.

### 3.4 Scaffold-extension requests

- None new (uses existing core contracts).

## 4. TDD план

| # | Test name | What it asserts |
|---|---|---|
| T1 | `role enum has 5 entries owner/admin/editor/commenter/viewer` | `Object.values(Role).length === 5`. |
| T2 | `owner has all permissions` | `every Permission → matrix[owner].includes`. |
| T3 | `viewer.write actions all denied` | `prompt.write`, `prompt.delete`, `comment.write` → false. |
| T4 | `permission matrix is exhaustive (no missing role-permission combo)` | TS exhaustive check via `satisfies`. |
| T5 | `policyEval allows editor to prompt.write in own workspace` | Returns `Result.ok(true)`. |
| T6 | `policyEval denies commenter prompt.write` | `Result.ok(false)`; audit `rbac.evaluate.denied` emit (sampled). |
| T7 | `team hierarchy inheritance: parent admin → child workspace admin` | User admin в team T → admin в workspace W (W.team=T). |
| T8 | `per-object override raises viewer to editor on specific prompt` | `object_role_grants` row: user=U, resource=prompt:p1, role=editor → allows `prompt.write` на p1 only. |
| T9 | `per-object override does not affect other prompts` | Other prompt p2 → role still viewer → deny. |
| T10 | `roleRank ordering: owner>admin>editor>commenter>viewer` | numeric ordering used for "highest wins" semantics. |
| T11 | `inheritFrom uses max-of-rank when both present` | parent=editor, child=admin → effective=admin (rank higher). |
| T12 | `feature flag OFF: canUser returns false-deny с audit` | All evaluations deny; audit `rbac.disabled.evaluation_skipped`. |

## 5. Acceptance Criteria

1. **AC-1:** `Role` & `Permission` enums frozen const; TS exhaustive check via `as const`.
2. **AC-2:** `RolePermissionMatrix` exhaustive — все role × permission pairs explicit; no `any`.
3. **AC-3:** `PolicyEvaluator.canUser` returns `Result<boolean, EvalError>` — never throws.
4. **AC-4:** Team-hierarchy traversal максимум 5 уровней; глубже → `EvalError({code:'HIERARCHY_TOO_DEEP'})`.
5. **AC-5:** Per-object override priority highest; затем direct role; затем inherited.
6. **AC-6:** Pure-function: `roles-engine.ts` без IO; `policy-eval.ts` принимает store-функции как parameters (injectable).
7. **AC-7:** Audit emit на ALL denies (no sampling); samples 1% allows (configurable).
8. **AC-8:** Feature flag OFF: все policy checks return false (fail-closed); audit emit `rbac.disabled`.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Privilege escalation через inheritance bug | Exhaustive tests на all 5 levels × 5 roles × 30 permissions. |
| Per-object override leak across users | Override scope: (user_id, resource_id) tuple; UNIQUE index. |
| Performance: policy eval на каждый IPC call | LRU cache 1k entries TTL=60s, key=(user,action,resource). |
| Audit flood on hot path | Sample 1% allows; ALL denies; per-tenant rate cap 1000 events/min. |
| Permission matrix drift (forget новое action) | Lint rule: каждое новое action в codebase должно появиться в matrix (custom ESLint). |
| Team hierarchy cycle | Detect cycle: visited-set during traversal; cycle → `EvalError`. |

## 7. Inspiration repos

1. `casbin/node-casbin` — generic RBAC/ABAC patterns (`reference_only`, Apache-2.0).
2. `permitio/permit-node` — policy abstraction (`reference_only`).
3. `oso-cloud/oso` — Oso policy language inspiration (`reference_only`).
4. `tailscale/hallpass` — accessbot grant/revoke patterns (`reference_only`).
5. `Agent-Field/agentfield` — agent identity + RBAC + audit (`reference_only`).

## 8. Verification protocol

- **Unit:** ≥12 tests above; pure-function tests run fastest (no IO).
- **Integration:** in-memory team hierarchy fixture (5-level deep) + override matrix.
- **Property-based:** fast-check на permission matrix invariants (owner ⊇ admin ⊇ editor, etc.).
- **3-machine:** typecheck + tests на all 3 OS.

## 9. Definition of Done

- [x] Tests-first commit precedes impl.
- [x] `bun run typecheck` + `bun run lint` clean.
- [x] ≥12 unit + ≥3 integration + ≥1 property-based test.
- [x] Permission matrix exhaustive (compile-time TS check).
- [x] Audit emit verified (deny=100%, allow=sampled).
- [x] LRU cache benchmark <50µs/eval (warm).
- [x] Feature flag OFF: fail-closed verified.
- [x] Linear PZD sub-issue → "Ready for Merge".

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** N/A
- **UI surfaces affected:** N/A
- **Entities touched (WT-46 references):** Role, PolicyRule
- **Events emitted (WT-49 ActivityEvent):** role.assigned
- **AI context implications (WT-48):** N/A
- **Search index implications (WT-50):** N/A
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** N/A
- **Risk axes:** security
