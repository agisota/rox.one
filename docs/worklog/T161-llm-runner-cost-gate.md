# T161 - --max-llm-calls cost gate in llm-runner

## 1. Task summary

Add a hard cap on the number of Anthropic API calls `createLLMRunner` will make per
run, so operators cannot accidentally spend $20-50 on a multi-surface audit. The cap
is configurable via `--max-llm-calls=N` in the CLI (default 100) and via `maxCalls`
in the factory input. A DI seam (`client?: Anthropic`) is added so unit tests can
mock the SDK without a live API key.

## 2. Repo context discovered

- `createLLMRunner` in `llm-runner.ts` had no call tracking; every probe invocation
  hit the Anthropic API unconditionally.
- `cli.ts` already parses `--worker-cap`, `--top-k`, `--out` with the same `parseInt`
  + `Math.max` guard pattern; `--max-llm-calls` follows the same form.
- Existing tests used a hand-rolled `LLMClient` mock (not Anthropic SDK shape). The
  new DI seam accepts an `Anthropic`-shaped object so tests can stub `messages.create`.

## 3. Files inspected

- `packages/audit/src/runners/llm-runner.ts` — full current implementation.
- `packages/audit/src/cli.ts` — arg parsing patterns.
- `packages/audit/tests/runners/llm-runner.test.ts` — existing 2 tests.

## 4. Implementation changes

**`packages/audit/src/runners/llm-runner.ts`**
- `CreateLLMRunnerInput` gains `maxCalls?: number` and `client?: Anthropic`.
- Factory initialises `const maxCalls = input.maxCalls ?? 100` and `let callCount = 0`.
- If `input.client` is provided it is used directly; otherwise constructs `new Anthropic({ apiKey })` as before.
- `analyzeScreenshot` checks `callCount >= maxCalls` before incrementing and calling the API. Throws:
  `LLM cost gate: exceeded --max-llm-calls=${maxCalls}. Increase the cap or scope the run more narrowly.`

**`packages/audit/src/cli.ts`**
- HELP text gains `--max-llm-calls=N` description and an example line.
- `parseArgs` return type and implementation add `maxLlmCalls: number` (default 100).
- `createLLMRunner({ maxCalls: parsed.maxLlmCalls })` passes the cap through.

**`packages/audit/tests/runners/llm-runner.test.ts`**
- Added `import Anthropic from "@anthropic-ai/sdk"` for the mock type cast.
- New test "cost gate throws after maxCalls limit is reached": creates a mock client
  that counts `messages.create` calls, runs `maxCalls: 2`, calls 2× (both succeed),
  then asserts the 3rd call rejects with the gate message and the mock was NOT called a
  third time.
- New test "cost gate default is 100": constructs runner with mock client and no
  `maxCalls`, asserts the runner has `analyzeScreenshot` (smoke test for the default path).

## 5. Commits

- `8a2bef8` feat(audit): --max-llm-calls cost gate in llm-runner [T161]

## 6. Validation commands run

```bash
cd packages/audit && ~/.bun/bin/bun test
cd packages/audit && ~/.bun/bin/bun run typecheck
```

## 7. Passing test output

```
bun test v1.3.13 (bf2e2cec)

 80 pass
 0 fail
 167 expect() calls
Ran 80 tests across 18 files. [7.54s]
```

`tsc --noEmit`: no output, exit 0.

## 8. Acceptance criteria matrix

| Criterion | Status |
|---|---|
| `maxCalls` and `client` in `CreateLLMRunnerInput` | ✅ |
| Counter increments per call | ✅ |
| Throws with `--max-llm-calls=N` in message | ✅ |
| Throw before API call | ✅ |
| CLI parses `--max-llm-calls=N` | ✅ |
| Help text updated | ✅ |
| Cost gate test passes | ✅ |
| typecheck exits 0 | ✅ |
