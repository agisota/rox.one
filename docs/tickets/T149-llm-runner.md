# T149 - LLM runner with Anthropic SDK + prompt caching + DI

Status: complete

## Context

Phase A.3 of the audit harness. Bootstrap an LLM client wrapper around the Anthropic SDK so the upcoming `taste-llm` probe (T150) can be written and unit-tested without real API calls. Use prompt caching on the system prompt to keep re-run cost low and `temperature: 0` for determinism.

## Summary

Implement `packages/audit/src/runners/llm-runner.ts` exporting `LLMClient`, `LLMTasteFinding`, `AnalyzeInput`, `AnalyzeOutput` interfaces, and a `createLLMRunner({apiKey?, model?})` factory. The factory falls back to `process.env.ANTHROPIC_API_KEY` when no key is provided and throws if neither is set. The default model is `claude-sonnet-4-6`. Each call to `analyzeScreenshot` sends a base64 PNG plus a short surface/route caption to Sonnet with the system prompt cached via `cache_control: { type: "ephemeral" }`. Responses are parsed as a JSON array of findings; malformed JSON returns `[]` (safer than crashing). Add `@anthropic-ai/sdk@0.81.0` as a direct dep on `packages/audit/`.

## Acceptance Criteria

- [x] `packages/audit/package.json` declares `"@anthropic-ai/sdk": "0.81.0"` in `dependencies`; `bun.lock` updated.
- [x] `packages/audit/src/runners/llm-runner.ts` exports `LLMTasteFinding`, `AnalyzeInput`, `AnalyzeOutput`, `LLMClient`, `CreateLLMRunnerInput`, and `createLLMRunner` factory.
- [x] Factory throws `Error("LLM runner: ANTHROPIC_API_KEY not set")` when no key is supplied and env var is unset.
- [x] Default model `claude-sonnet-4-6`; overridable via `model` field.
- [x] `analyzeScreenshot` sets `temperature: 0` and `max_tokens: 2048`.
- [x] System prompt sent as a `text` block with `cache_control: { type: "ephemeral" }` (prompt caching).
- [x] Image sent as base64 PNG content block with `media_type: "image/png"`.
- [x] Malformed JSON in response → returns `{ findings: [] }` (graceful fallback).
- [x] `packages/audit/tests/runners/llm-runner.test.ts` — 2 tests pass (interface shape, mock client DI).
- [x] `cd packages/audit && bun run typecheck` exits 0.
- [x] Worklog `docs/worklog/T149-llm-runner.md` complete.
- [x] Commit created.

## Files Affected

| File | Action |
|---|---|
| `packages/audit/package.json` | Modify (add dep) |
| `bun.lock` | Modify (refresh) |
| `packages/audit/src/runners/llm-runner.ts` | Create |
| `packages/audit/tests/runners/llm-runner.test.ts` | Create |

## Validation Commands

```bash
cd packages/audit && ~/.bun/bin/bun install
cd packages/audit && ~/.bun/bin/bun test tests/runners/llm-runner.test.ts
cd packages/audit && ~/.bun/bin/bun run typecheck
```

## Worklog

`docs/worklog/T149-llm-runner.md`
