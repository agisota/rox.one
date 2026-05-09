# T163 - Log raw response on malformed JSON in llm-runner

Status: complete

## Context

Architect follow-up for A.3. When Sonnet returns text that is not valid JSON, the catch
block silently returns `{ findings: [] }`. This makes it impossible to diagnose model
compliance drift (e.g. Sonnet adding preamble prose before the JSON array).

## Summary

Write a `[taste-llm] malformed JSON ignored:` line to stderr containing the first 200
characters of the raw response text when `JSON.parse` throws. This is sufficient for
debugging without introducing filesystem state. No `debugSinkPath` option needed.

## Acceptance Criteria

- [x] On JSON parse failure, `process.stderr.write` is called with a line containing `[taste-llm] malformed JSON ignored:`.
- [x] The logged text includes up to 200 chars of the raw response.
- [x] Return value remains `{ findings: [] }` (no crash).
- [x] Unit test intercepts `process.stderr.write` and asserts the log line appears.
- [x] `bun run typecheck` exits 0.

## Files Affected

| File | Action |
|---|---|
| `packages/audit/src/runners/llm-runner.ts` | Modify |
| `packages/audit/tests/runners/llm-runner.test.ts` | Modify |

## Validation Commands

```bash
cd packages/audit && ~/.bun/bin/bun test tests/runners/llm-runner.test.ts
cd packages/audit && ~/.bun/bin/bun run typecheck
```

## Worklog

`docs/worklog/T163-malformed-json-debug-log.md`
