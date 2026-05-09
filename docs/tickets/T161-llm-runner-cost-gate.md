# T161 - --max-llm-calls cost gate in llm-runner

Status: complete

## Context

Architect follow-up for A.3. A full multi-surface audit run with the taste-llm probe can
trigger 50+ Sonnet calls, costing $20-50 unintentionally. There is no mechanism to cap
this in the current implementation.

## Summary

Add a `maxCalls` counter to `createLLMRunner`. When the counter reaches the cap, subsequent
calls throw a descriptive error: `LLM cost gate: exceeded --max-llm-calls=N. Increase the
cap or scope the run more narrowly.` Expose `--max-llm-calls=N` in `cli.ts` (default 100).
Add an optional `client?: Anthropic` DI seam to `CreateLLMRunnerInput` so tests can mock
the SDK without a real API key.

## Acceptance Criteria

- [x] `CreateLLMRunnerInput` has `maxCalls?: number` (default 100) and `client?: Anthropic`.
- [x] Internal counter increments on each `analyzeScreenshot` call.
- [x] When counter >= maxCalls, throws with message containing `--max-llm-calls=N`.
- [x] The throw happens before any API call (counter stays at limit).
- [x] `cli.ts` parses `--max-llm-calls=N` and passes it to `createLLMRunner`.
- [x] `--max-llm-calls` appears in HELP text.
- [x] Tests: cost gate enforcement, default value check.
- [x] `bun run typecheck` exits 0.

## Files Affected

| File | Action |
|---|---|
| `packages/audit/src/runners/llm-runner.ts` | Modify |
| `packages/audit/src/cli.ts` | Modify |
| `packages/audit/tests/runners/llm-runner.test.ts` | Modify |

## Validation Commands

```bash
cd packages/audit && ~/.bun/bin/bun test tests/runners/llm-runner.test.ts
cd packages/audit && ~/.bun/bin/bun run typecheck
```

## Worklog

`docs/worklog/T161-llm-runner-cost-gate.md`
