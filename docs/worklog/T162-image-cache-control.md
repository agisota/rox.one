# T162 - cache_control on image blocks (cuts re-run cost ~10x)

## 1. Task summary

The system prompt was cached via `cache_control: { type: "ephemeral" }` (~150 tokens),
but image tokens (~1000-2000 tokens per screenshot) were re-billed on every call.
Adding `cache_control` to the image block allows the Anthropic prompt cache to serve
cached image tokens on re-runs, cutting the per-call cost of repeated runs by ~10x.

## 2. Repo context discovered

- `@anthropic-ai/sdk@0.81.0` types `ImageBlockParam` with `cache_control?: CacheControlEphemeral | null`.
  Verified by inspecting `node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts`.
- The stop condition in the spec ("if SDK doesn't accept `cache_control` on image blocks,
  ship Fix 1 + Fix 3 only") does not apply — the field is present in this SDK version.

## 3. Files inspected

- `node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts` — `ImageBlockParam`
  interface confirms `cache_control?: CacheControlEphemeral | null`.

## 4. Implementation changes

**`packages/audit/src/runners/llm-runner.ts`**

Image content block changed from:
```typescript
{ type: "image", source: { type: "base64", media_type: "image/png", data: base64 } }
```
to:
```typescript
{
  type: "image",
  source: { type: "base64", media_type: "image/png", data: base64 },
  cache_control: { type: "ephemeral" }, // cache image tokens (~1000-2000 tokens per screenshot)
}
```

## 5. Commits

- `56743d1` feat(audit): cache_control on image blocks (cuts re-run cost ~10x) [T162]

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
Ran 80 tests across 18 files.
```

`tsc --noEmit`: no output, exit 0.

## 8. Acceptance criteria matrix

| Criterion | Status |
|---|---|
| `cache_control: { type: "ephemeral" }` on image block | ✅ |
| SDK types accept the field | ✅ (verified in messages.d.ts) |
| typecheck exits 0 | ✅ |
| No tests broken | ✅ |
