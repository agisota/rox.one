# AgentAnswerPackage wire plan (PZD-18)

**Status:** spec • **Parent:** PZD-18 • **Date:** 2026-05-20

## Discovery summary

| Component | Where it lives now | State |
|-----------|--------------------|-------|
| `AgentAnswerPackage` schema | only on closed/squashed feat branches (not on `main`) | **missing from main** |
| `DesignArtifactCard` renderer | `apps/electron/src/renderer/components/chat/` (shipped via PR #286) | **orphan — no production caller** |
| Artifact storage | `packages/design-storage/` (PR #286) — SQLite manifest + content-addressed files | shipped, idle |
| IPC `design:openWithContext` | wired in main, exposed via preload bridge | shipped, idle |
| Classifier autolaunch | wired via `useAutoLaunchDecision` (PR #287 + PR #298) | shipped, idle |

Net: the **plumbing is end-to-end**, but no agent or pipeline actually emits an `OpenDesignRequest`. The chat-side `DesignArtifactCard` lives, but never receives an attachment.

## What needs to happen

AgentAnswerPackage must become the bridge: when an agent finishes a turn that produced a design artifact, AAP packages it into the `OpenDesignRequest` shape and emits it through the existing IPC. The DesignArtifactCard then renders in chat. Loop closes.

## Wire steps (5)

### Step 1 — Define `AgentAnswerPackage` schema on main
New zod schema in `@rox-one/agent-contract` (new package or extension of `@rox-one/design-contract`):

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
In `packages/server-core/src/sessions/SessionManager.ts`, on every agent turn finish, build an AAP and dispatch.

### Step 3 — Main process subscribes + routes
Main listens for AAP. If `kind === 'design'`, calls `design:openWithContext(payload.request)`. If `mixed`, recurses parts. Other kinds pass through to existing chat-display.

### Step 4 — Renderer wires `DesignArtifactCard` to AAP attachments
Chat-display reads `messageAttachments[i].kind === 'design-artifact'` and renders the card. (Card already exists, just needs the data flow.)

### Step 5 — End-to-end smoke
Test: agent says "сделай лендинг" → classifier confidence > 0.7 → Design panel opens → user closes → AAP fires with `kind: 'design'` → card appears in chat. Add Playwright spec.

## Backwards compatibility
Sessions that produce only text/code (current 100% of traffic) get AAP with `kind: 'text'|'code'` — identical render path to today. No regression.

## Open design questions for owner
1. **AAP as a separate package or extension of design-contract?** Separate is cleaner (agents care about answers, not just design). Recommended: new `@rox-one/agent-contract` package.
2. **Mixed mode discrimination model** — one `kind: 'mixed'` with recursive parts, OR multiple `AgentAnswerPackage` events per turn? Recommended: single `mixed` for atomic delivery.
3. **AAP retention/replay** — should AAPs persist to SQLite for session replay, or be ephemeral? Recommended: persist via existing artifact-storage SQLite (manifest row), so chat replay works post-restart.
4. **Backpressure** — what happens if an agent emits 50 design artifacts in a row? Recommended: rate-limit at 3/sec per session, drop with warning.

## Sequencing
Steps 1–4 must land sequentially (each depends on prior schema). Step 5 (smoke) gates the merge of step 4 → main.

## Risks
- **Schema churn during wire** — once published, breaking AAP is painful. Mitigation: freeze v0.1 before step 2.
- **Event-loop hot path** — AAP dispatch on every turn must be cheap. Mitigation: validate shape at boundary, no zod inside loops; use lightweight type guards.
- **Test infrastructure** — Step 5 needs Playwright + display (xvfb-CI from PZD-59). Mitigation: lean on PZD-59 runner.

## Estimated effort
- Step 1: XS (1 file + tests)
- Step 2: M (touches session loop, needs careful integration testing)
- Step 3: S (IPC router)
- Step 4: S (renderer wire + chat attachment plumbing)
- Step 5: M (Playwright e2e + xvfb)

Total: ~M+ per child issue.
