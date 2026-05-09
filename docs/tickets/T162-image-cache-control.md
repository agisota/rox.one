# T162 - cache_control on image blocks (cuts re-run cost ~10x)

Status: complete

## Context

Architect follow-up for A.3. Only the system prompt (~150 tokens) had `cache_control`.
Image tokens (~1000-2000 per screenshot) dominate per-call cost and were re-billed on
every invocation, making repeated runs over the same surfaces expensive.

## Summary

Add `cache_control: { type: "ephemeral" }` to the image content block in `llm-runner.ts`.
The Anthropic SDK v0.81.0 types `ImageBlockParam.cache_control` as `CacheControlEphemeral | null`,
so the change is fully type-safe. On re-runs targeting the same surfaces, image tokens are
served from the prompt cache at ~1/10 the cost of fresh input tokens.

## Acceptance Criteria

- [x] Image content block has `cache_control: { type: "ephemeral" }`.
- [x] `bun run typecheck` exits 0 (SDK types accept the field).
- [x] No tests broken.

## Files Affected

| File | Action |
|---|---|
| `packages/audit/src/runners/llm-runner.ts` | Modify |

## Validation Commands

```bash
cd packages/audit && ~/.bun/bin/bun test
cd packages/audit && ~/.bun/bin/bun run typecheck
```

## Worklog

`docs/worklog/T162-image-cache-control.md`
