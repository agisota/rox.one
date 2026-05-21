# T541 - AgentAnswerPackage Message Replay

## 1. Task summary

Persist the validated `AgentAnswerPackage` envelope on assistant messages after `text_complete` so future replay/session reload work can read the package from session JSONL instead of relying only on live IPC dispatch.

## 2. Repo context discovered

- `packages/server-core/src/sessions/agent-answer-emitter.ts` already validates, dispatches, and rate-limits AAPs at 3 packages/sec per session.
- `packages/server-core/src/sessions/SessionManager.ts` calls `answerEmitter.emit()` after creating the assistant message but discarded the returned package.
- `packages/core/src/types/message.ts` is the source of truth for runtime and stored message fields.
- `packages/core/src/types/message-mapper.ts` pass-through maps message fields except transient `isStreaming` and `isPending`.
- `apps/electron/src/main/__tests__/session-message-parity.test.ts` is the parity alarm for persisted message fields.

## 3. Files inspected

- `packages/server-core/src/sessions/agent-answer-emitter.ts`
- `packages/server-core/src/sessions/SessionManager.ts`
- `packages/server-core/src/sessions/__tests__/agent-answer-emitter.test.ts`
- `packages/core/src/types/message.ts`
- `packages/core/src/types/message-mapper.ts`
- `packages/core/src/types/index.ts`
- `apps/electron/src/main/__tests__/session-message-parity.test.ts`

## 4. Tests added first

- Extended the session message parity test to include `agentAnswerPackage` in the full message and expected persisted key list.
- Extended the `SessionManager` AAP integration test to assert the assistant message receives the emitted package.

## 5. Expected failing test output

Before implementation, `bun test packages/server-core/src/sessions/__tests__/agent-answer-emitter.test.ts` failed with:

```text
error: expect(received).toMatchObject(expected)
Matcher error: received value must be a non-null object
```

That proved the emitted package was not attached to the assistant message.

## 6. Implementation changes

- Added `MessageAgentAnswerPackage` as a core-local durable envelope type without importing `@rox-one/agent-contract`.
- Added optional `agentAnswerPackage` to runtime `Message` and persisted `StoredMessage`.
- Exported `MessageAgentAnswerPackage` from `@rox-one/core/types`.
- Assigned the resolved `answerEmitter.emit()` result onto `assistantMessage.agentAnswerPackage` in `SessionManager` before session persistence.

## 7. Validation commands run

- `bun test apps/electron/src/main/__tests__/session-message-parity.test.ts`
- `bun test packages/server-core/src/sessions/__tests__/agent-answer-emitter.test.ts`
- `cd packages/core && bun run tsc --noEmit`
- `cd packages/server-core && bun run tsc --noEmit`

## 8. Passing test output summary

- Session message parity: 12 pass, 0 fail, 98 assertions.
- AAP emitter/session integration: 10 pass, 0 fail, 23 assertions.
- Core typecheck: pass.
- Server-core typecheck: pass.

## 9. Build output summary

No app build was run. This change is limited to shared types and server-core session message persistence.

## 10. Remaining risks

- AAP envelopes are now persisted on messages, but no UI replay selector consumes them yet.
- Backpressure is existing behavior and remains hardcoded at 3/sec per session.
- Full packaged e2e for deterministic design/mixed AAP output remains a later PZD-18 slice.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Runtime and stored messages carry AAP envelope | PASS | `packages/core/src/types/message.ts` |
| Persistence mapper preserves the field | PASS | `session-message-parity.test.ts` |
| `SessionManager` attaches emitted package | PASS | `agent-answer-emitter.test.ts` |
| AAP dispatch/rate-limit tests still pass | PASS | `agent-answer-emitter.test.ts` |
| Typechecks pass | PASS | core + server-core `tsc --noEmit` |
