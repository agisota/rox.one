# T163 - Log raw response on malformed JSON in llm-runner

## 1. Task summary

When `JSON.parse` failed on the LLM response the catch block silently returned
`{ findings: [] }`. This made diagnosing model compliance drift (e.g. Sonnet
adding preamble prose before the JSON array) impossible in practice. Add a
`process.stderr.write` call that logs the first 200 chars of the raw response
under a `[taste-llm]` prefix. No filesystem state introduced.

## 2. Design choice: stderr vs debugSinkPath

The spec offered two options: a `debugSinkPath?: string` option that writes to
a file, or a simpler stderr log. The simpler path was chosen because:
- It introduces no filesystem state or new options to thread through the call chain.
- Operators running the CLI already see stderr in their terminal or CI log.
- The spec explicitly notes "For minimal scope: just log to stderr" as the preferred path.

## 3. Files inspected

- `packages/audit/src/runners/llm-runner.ts` — catch block at end of `analyzeScreenshot`.
- `packages/audit/tests/runners/llm-runner.test.ts` — existing test shape.

## 4. Implementation changes

**`packages/audit/src/runners/llm-runner.ts`**

Changed the catch block from:
```typescript
} catch {
  return { findings: [] }; // malformed response → empty
}
```
to:
```typescript
} catch {
  process.stderr.write(`[taste-llm] malformed JSON ignored: ${JSON.stringify(text.slice(0, 200))}\n`);
  return { findings: [] }; // malformed response → empty (safer than crashing)
}
```

`JSON.stringify` around the text slice ensures non-printable characters and quotes are
safely escaped in the log line.

**`packages/audit/tests/runners/llm-runner.test.ts`**

Added test "malformed JSON returns empty findings and writes to stderr":
- Creates a mock `Anthropic` client whose `messages.create` returns `"NOT VALID JSON {{"`.
- Patches `process.stderr.write` to capture written chunks.
- Calls `analyzeScreenshot`, asserts `findings` is empty and stderr contains
  `[taste-llm] malformed JSON ignored:`.
- Restores `process.stderr.write` in a `finally` block.

## 5. Commits

- `216cd3c` feat(audit): log raw response on malformed JSON in llm-runner [T163]

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
| stderr.write called on parse failure | ✅ |
| Log line contains `[taste-llm] malformed JSON ignored:` | ✅ |
| First 200 chars of raw response included | ✅ |
| Return value remains `{ findings: [] }` | ✅ |
| Unit test passes with stderr interception | ✅ |
| typecheck exits 0 | ✅ |
