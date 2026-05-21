# T541-agent-answer-package-message-replay

Status: DONE

## Objective

Persist the validated `AgentAnswerPackage` envelope on the assistant message that completed the turn so live AAP dispatch has a durable replay reference after session reload.

## Requirements

- Preserve existing chat rendering and session JSONL format compatibility.
- Do not add a dependency from `@rox-one/core` to `@rox-one/agent-contract`.
- Store only the JSON-compatible AAP envelope on the message.
- Keep AAP emit failures non-fatal for normal chat completion.
- Prove message mapper round-trip and `SessionManager` text-complete integration.

## Acceptance Criteria

- [x] `Message` and `StoredMessage` can carry a persisted AAP envelope.
- [x] `messageToStored` / `storedToMessage` preserve the envelope.
- [x] `SessionManager.processEvent(text_complete)` attaches the emitted package to the assistant message.
- [x] Existing AAP rate-limit and dispatch tests still pass.
- [x] Core and server-core typechecks pass.

## Verification

- `bun test apps/electron/src/main/__tests__/session-message-parity.test.ts`
- `bun test packages/server-core/src/sessions/__tests__/agent-answer-emitter.test.ts`
- `cd packages/core && bun run tsc --noEmit`
- `cd packages/server-core && bun run tsc --noEmit`
