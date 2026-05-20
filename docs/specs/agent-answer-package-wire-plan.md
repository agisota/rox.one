# AgentAnswerPackage wire plan (PZD-18)

**Status:** landed through step 4 • **Parent:** PZD-18 • **Date:** 2026-05-20

## Discovery summary

| Component | Where it lives now | State |
|-----------|--------------------|-------|
| `AgentAnswerPackage` schema | `packages/agent-contract/src/agent-answer-package.ts` | **landed on main** |
| Shared structured workbench package | `packages/shared/src/workbench/answer-package.ts` | **landed on main** |
| Server turn emitter | `packages/server-core/src/sessions/agent-answer-emitter.ts`, `packages/server-core/src/sessions/SessionManager.ts` | **landed on main** |
| Main-process router | `apps/electron/src/main/agent-answer-router.ts` | **landed on main** |
| Preload bridge | `apps/electron/src/preload/bootstrap.ts` | **landed on main** |
| Renderer stream hook | `apps/electron/src/renderer/hooks/useAgentAnswerStream.ts` | **landed on main** |
| Artifact panel surface | `apps/electron/src/renderer/components/artifacts/ArtifactPanel.tsx`, `ArtifactRail.tsx` | **landed on main through PR #301** |
| Hosted package smoke | `Cross Platform Launch Smoke`, `Rox Design xvfb Packaged Smoke` | **green before PR #301 merge** |

Net: the AAP schema and runtime path are no longer future-only planning items. They are present on `main` after PRs #341, #345, #347, #348, and #301. The remaining work is hardening, replay/persistence semantics, and broader end-to-end product tests.

## What needs to happen

AgentAnswerPackage is now the bridge for agent output packages. When an agent finishes a turn, server-core can build and validate an AAP, Electron main can route it by kind, preload can expose the callback, and the renderer can consume package events.

The next work should avoid re-implementing the bridge. Instead, focus on:

1. Persist/replay policy for AAPs and generated artifacts.
2. Backpressure and rate limits for high-volume artifact output.
3. End-to-end UI proof for design and mixed packages.
4. Migration notes for sessions created before AAP support.

## Wire steps (5)

### Step 1 — Define `AgentAnswerPackage` schema on main

Status: **landed** in `packages/agent-contract/src/agent-answer-package.ts`.

The planning shape was:

```ts
const AgentAnswerPackageSchema = z.object({
  agentId: z.string(),
  sessionId: z.string(),
  turnId: z.string(),
  kind: z.enum(['text', 'code', 'design', 'mixed']),
  payload: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('text'), text: z.string() }),
    z.object({ kind: z.literal('code'), language: z.string(), text: z.string() }),
    z.object({ kind: z.literal('design'), request: OpenDesignRequestSchema }),
    z.object({ kind: z.literal('mixed'), parts: z.array(/* recursive */) }),
  ]),
  createdAt: z.string().datetime(),
})
```

### Step 2 — Server-core emits AgentAnswerPackage on turn completion

Status: **landed** in `packages/server-core/src/sessions/agent-answer-emitter.ts` and `packages/server-core/src/sessions/SessionManager.ts`.

### Step 3 — Main process subscribes + routes

Status: **landed** in `apps/electron/src/main/agent-answer-router.ts`.

### Step 4 — Renderer wires `DesignArtifactCard` to AAP attachments

Status: **landed** through the renderer stream hook and artifact panel surface.

### Step 5 — End-to-end smoke

Status: **remaining**. Add a product-level smoke once the scripted agent fixture can deterministically emit a design or mixed AAP in a packaged app.

## Backwards compatibility
Sessions that produce only text/code get AAP with `kind: 'text'|'code'`; renderer behavior must stay compatible with existing chat display. New package kinds should degrade to text or a reviewable artifact card rather than breaking the turn.

## Open design questions for owner
1. **AAP retention/replay** — should complete packages persist with session history, or should only extracted artifacts persist? Recommended: persist a compact AAP envelope and artifact refs, not duplicate large payload bodies.
2. **Backpressure** — what happens if an agent emits 50 design artifacts in a row? Recommended: rate-limit by session and surface overflow as a review event.
3. **Mixed-package UX** — should mixed output render as one grouped artifact set or multiple cards? Recommended: group by turn and preserve part order.
4. **Verification trace** — should verifier output attach to the AAP audit block or a separate artifact? Recommended: attach a verifier result ref to avoid rewriting immutable answer packages.

## Sequencing
Steps 1–4 are landed. Next slices should be:

1. Persist/replay AAP envelope and artifact refs.
2. Add a deterministic packaged smoke fixture for design and mixed output.
3. Add backpressure/rate-limit policy and tests.
4. Add verifier trace refs.

## Risks
- **Schema churn after landing** — breaking AAP is now a migration problem. Mitigation: version the envelope before incompatible changes.
- **Event-loop hot path** — AAP dispatch on every turn must stay cheap. Mitigation: validate shape at the boundary and avoid repeated heavy parsing in loops.
- **Replay gaps** — packages may be visible during live runs but absent after restart. Mitigation: persist compact envelope refs before adding more package kinds.
- **Test infrastructure** — product smoke still needs deterministic design/mixed output in packaged launch. Mitigation: lean on PZD-59 xvfb runner.

## Estimated effort
- Replay/persistence slice: M
- Backpressure/rate-limit slice: S
- Packaged e2e fixture: M
- Verifier trace refs: S
