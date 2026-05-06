# T086 - Security and Abuse Hardening Worklog

## 1. Task summary

Close the remaining Experience runtime finalization spoofing path: a mission
must not reach completed/final VDI state from arbitrary artifact or gate
reference strings.

## 2. Repo context discovered

- T071 already covers scheduler budget spoofing, branch expansion validation,
  public share redaction, account billing redaction, and existing
  tenant/RBAC/package/entitlement tests.
- T074-T084 added the runtime event store and product-wide Experience flow.
- `ExperienceRuntimeStore.finalizeMission()` currently checks that final
  artifact and gate evidence strings are present, but does not prove that the
  artifact exists, the gate result exists, the gate passed, or no blocking
  failed gate remains.
- This is narrower than the full security matrix but directly covers the RC
  target rule: no final mission pass without evidence.

## 3. Files inspected

- `docs/tickets/T071-security-abuse-hardening.md`
- `docs/worklog/T071-security-abuse-hardening.md`
- `packages/shared/src/workbench/experience-runtime-store.ts`
- `packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts`
- `packages/shared/src/workbench/experience-layer.ts`
- `packages/server-core/src/provider-gateway/__tests__/provider-gateway.test.ts`
- `packages/server-core/src/sessions/share-provider.test.ts`
- `packages/server-core/src/mission-scheduler/__tests__/durable-mission-scheduler.test.ts`

## 4. Tests added first

- Added `denies mission finalization spoofing with missing or failed evidence`
  in `packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts`.
- The test covers:
  - forged artifact/gate reference strings cannot complete a mission;
  - a stored final artifact plus blocking failed gate cannot complete a mission;
  - a stored final artifact plus passing gate can complete the mission and
    increase VDI.

## 5. Expected failing test output

Initial red command:

```bash
bun test packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts
```

Expected failure:

```text
ExperienceRuntimeStore > denies mission finalization spoofing with missing or failed evidence
Expected: "running"
Received: "completed"
```

## 6. Implementation changes

- Hardened `finalizeMission()` in
  `packages/shared/src/workbench/experience-runtime-store.ts`.
- Mission finalization now requires:
  - `finalArtifactId` points to an artifact already stored in runtime truth;
  - final artifact belongs to the finalized mission when it has a mission id;
  - at least one referenced gate result already exists and has `status:
    "pass"`;
  - passing gate belongs to the finalized mission when it has a mission id;
  - no blocking failed gate remains for the same mission.
- Invalid finalization events now produce an error notification and leave the
  mission running.

## 7. Validation commands run

```bash
bun test packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts
bun test packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts packages/shared/src/workbench/__tests__/experience-layer-security.test.ts packages/server-core/src/mission-scheduler/__tests__/durable-mission-scheduler.test.ts packages/server-core/src/provider-gateway/__tests__/provider-gateway.test.ts packages/server-core/src/sessions/share-provider.test.ts packages/server-core/src/webui/__tests__/account-cabinet.test.ts apps/electron/src/main/__tests__/account-session-store.test.ts
bun run typecheck:all
bun run validate:docs
bun run lint
git diff --check
```

## 8. Passing test output summary

- Runtime store targeted: `7 pass`, `0 fail`, `38 expect() calls`.
- Broad T086 security set: `44 pass`, `0 fail`, `151 expect() calls`.
- Typecheck: `bun run typecheck:all` passed.
- Docs validation: passed; agent contract reported `87 tickets`.
- Lint: passed with existing three React hook dependency warnings in
  `App.tsx` and `FreeFormInput.tsx`.
- `git diff --check`: passed.

## 9. Build output summary

No Electron build was required for this shared runtime security reducer change.
T084 already ran `bun run electron:build` successfully on the current branch;
T087 will run the final RC build gate.

## 10. Remaining risks

- This pass closes a focused finalization spoofing path. Broader production
  hardening still depends on T087 final release validation and remote CI.
- Production DB adapters must preserve the same invariant: final state changes
  must reference stored artifact and passing gate rows, not caller-supplied
  strings alone.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Forged final artifact/gate refs cannot complete mission | Pass | Runtime store regression |
| Failed blocking gate prevents final pass | Pass | Runtime store regression |
| Existing Experience/security tests pass | Pass | Broad T086 security set |
| Worklog complete | Pass | This file |
| Commit exists | Pass | Scoped Lore commit for T086 |
