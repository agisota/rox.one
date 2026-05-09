# T149 - LLM runner with Anthropic SDK + prompt caching + DI

## 1. Task summary

Add a thin `LLMClient` wrapper around `@anthropic-ai/sdk` so the upcoming `taste-llm` probe (T150) can be unit-tested with a mock client and so the production probe gets prompt caching + `temperature: 0` for free. The runner exposes a single async `analyzeScreenshot({surface, route, screenshotPng})` method that returns `{ findings: LLMTasteFinding[] }`. Construction is gated behind `ANTHROPIC_API_KEY` (env or explicit input), and a missing key produces a clean error instead of an SDK-internal stack.

## 2. Repo context discovered

- `@anthropic-ai/sdk@0.81.0` is already hoisted into `node_modules` as a transitive of `@anthropic-ai/claude-agent-sdk`. Pinning `0.81.0` directly in `packages/audit/package.json` matches the resolved version in `bun.lock` and avoids a duplicate copy.
- The plan template suggested `0.31.0`; that version does not exist in this monorepo's lockfile. The instruction explicitly allows the current stable, so `0.81.0` is the chosen pin.
- `packages/audit/src/runners/` already contains `playwright-runner.ts` and `dev-server-runner.ts`; the new `llm-runner.ts` follows the same factory shape (interface + `create*` function returning a closeable handle).
- The audit tsconfig (extends repo base) is `strict`-mode; SDK types include `ImageBlockParam` with `cache_control: CacheControlEphemeral` for prompt caching on text blocks.

## 3. Files inspected

- `packages/audit/package.json` — dep list shape.
- `packages/audit/src/runners/playwright-runner.ts` — runner factory pattern.
- `packages/audit/src/runners/dev-server-runner.ts` — runner factory pattern w/ async close.
- `node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts` — confirmed `cache_control` and image block shape.
- `bun.lock` — confirmed `@anthropic-ai/sdk@0.81.0` already resolved transitively.

## 4. Tests added first

| File | Tests |
|---|---|
| `packages/audit/tests/runners/llm-runner.test.ts` | 2 |

Tests written before implementation per TDD. Names: "createLLMRunner returns a client implementing LLMClient" (interface shape with a fake API key; no real call), "respects mock client injection (DI for testing)" (mock LLMClient resolves a finding without touching SDK).

## 5. Expected failing test output

```
error: Cannot find module '../../src/runners/llm-runner.ts'
    at <anonymous> (packages/audit/tests/runners/llm-runner.test.ts:2:0)
```

Resolves once the source file exports the `LLMClient` interface and `createLLMRunner` factory.

## 6. Implementation changes

- `packages/audit/package.json`: added `"@anthropic-ai/sdk": "0.81.0"` under `dependencies`. `bun install` refreshed `bun.lock`.
- `packages/audit/src/runners/llm-runner.ts` (created):
  - `LLMTasteFinding`, `AnalyzeInput`, `AnalyzeOutput`, `LLMClient` interfaces define the surface area; the probe imports only the type-level `LLMClient` to avoid SDK pulls in test paths.
  - `SYSTEM_PROMPT` is a multi-line constant covering the six taste categories (alignment, contrast, hierarchy, typography, spacing, consistency) and instructs Sonnet to return ONLY a JSON array.
  - `createLLMRunner({apiKey?, model?})` factory:
    - Resolves API key from input, then `process.env.ANTHROPIC_API_KEY`. Throws with a clear `"LLM runner: ANTHROPIC_API_KEY not set"` error when neither is supplied.
    - Default model: `claude-sonnet-4-6` (overridable).
    - Returns an `LLMClient` whose `analyzeScreenshot` builds a `messages.create` call with `temperature: 0`, `max_tokens: 2048`, the system prompt as a `text` block with `cache_control: { type: "ephemeral" }` (prompt caching), and a user message containing a base64 PNG image block + a short caption block.
    - Concatenates all `text` content blocks from the response, parses as JSON; if parse throws or result is not an array, returns `{ findings: [] }` (graceful fallback so a malformed Sonnet response cannot crash the audit run).
    - `close()` is a no-op (Anthropic SDK has no explicit close).

Commits (T149, 1 commit):
- `e7043f8` feat(audit): llm-runner with Anthropic SDK + prompt caching + DI [T149]

## 7. Validation commands run

```bash
cd packages/audit && ~/.bun/bin/bun install
cd packages/audit && ~/.bun/bin/bun test tests/runners/llm-runner.test.ts
cd packages/audit && ~/.bun/bin/bun run typecheck
```

## 8. Passing test output summary

```
bun test v1.3.13 (bf2e2cec)

 2 pass
 0 fail
 4 expect() calls
Ran 2 tests across 1 file. [32.00ms]
```

## 9. Build output summary

`bun install`: `1 package installed [967.00ms]` (Anthropic SDK already cached transitively, just registered as a direct dep). `tsc --noEmit`: no output, exit 0.

## 10. Remaining risks

- **Cost ceiling**: a full audit run with Sonnet on ~50 routes is roughly $5–$15 the first time. The `cache_control: ephemeral` on the system prompt amortises significantly on re-runs (cache hits are ~1/10 the cost of input tokens), but the cache lifetime is bounded (~5 min). Document this in the worklog for T151 so reviewers know what to expect; do not surface it as a CI-time gate.
- **Determinism is best-effort**: `temperature: 0` plus prompt caching gives byte-identical findings on the *same* screenshot in practice, but Sonnet is not bit-deterministic across model revisions. The probe sets `confidence: 0.6` so the ranker downweights findings relative to deterministic axe-core / tsc results.
- **Malformed JSON from the model**: handled by returning `[]`. A future enhancement could log the raw text to a debug sink so operators can review when Sonnet's compliance with the JSON-only instruction drifts. Not in scope here.
- **Single-key auth**: the runner accepts only an API key. If we later need an `Authorization: Bearer` flow or a custom `baseURL`, extend `CreateLLMRunnerInput`. Acceptable for A.3.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| `@anthropic-ai/sdk` declared as direct dep | ✅ | `packages/audit/package.json` — `0.81.0` |
| Lockfile refreshed | ✅ | `bun.lock` updated by `bun install` |
| `LLMClient` interface exported | ✅ | `llm-runner.ts` lines 22–25 |
| `createLLMRunner` factory exported | ✅ | `llm-runner.ts` line 41 |
| Throws when no API key available | ✅ | `llm-runner.ts` line 43 |
| Default model `claude-sonnet-4-6` | ✅ | `llm-runner.ts` line 45 |
| `temperature: 0` for determinism | ✅ | `llm-runner.ts` line 50 |
| System prompt cached via `cache_control` | ✅ | `llm-runner.ts` lines 52–58 |
| Malformed JSON → `[]` | ✅ | `llm-runner.ts` lines 71–77 |
| Tests pass: 2/2 | ✅ | Test run output above |
| typecheck exits 0 | ✅ | No output |
