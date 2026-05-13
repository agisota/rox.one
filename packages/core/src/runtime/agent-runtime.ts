/**
 * AgentRuntime — core's vocabulary for the agent runtime contract.
 *
 * This module is the type-level anchor for the agent runtime concept inside
 * `@rox-one/core`. The full provider-facing contract lives in
 * `@rox-one/shared` as `AgentBackend` (see
 * `packages/shared/src/agent/backend/types.ts`). That interface is the de-facto
 * runtime contract today: every concrete agent (`ClaudeAgent`, `PiAgent`)
 * implements it via `BaseAgent`.
 *
 * Why a separate name in core?
 * --------------------------------------------------------------------
 * `AgentBackend` mixes provider-agnostic primitives (chat, dispose, isProcessing)
 * with shared-typed surface (sources, MCP servers, permissions). The
 * provider-agnostic subset is what most consumers (UI, server-core lifecycle
 * code, telemetry) actually depend on. `AgentRuntime` names that subset and
 * documents it in the type layer that everything depends on, without inverting
 * the package graph (core has no dependency on shared).
 *
 * Refinement, not competition
 * --------------------------------------------------------------------
 * `AgentBackend` (shared) is a structural superset of `AgentRuntime` (core).
 * A `BaseAgent` instance assigns to either type; the shared interface adds the
 * shared-typed members on top. This is a real refinement relationship — not
 * a parallel definition — because every member declared here has the exact
 * same name and signature as the corresponding member on `AgentBackend`.
 *
 * If you are looking for the full surface (sources, permissions, callbacks),
 * import `AgentBackend` from `@rox-one/shared/agent`. If you only need
 * the lifecycle primitives that close over `AgentEvent`, depend on this type
 * here in core.
 *
 * See: `docs/decision-records/audit-harness/0004-agentruntime-interface.md`
 */

import type { AgentEvent } from '../types/message.ts';

/**
 * The provider-agnostic core of the agent runtime contract.
 *
 * This is intentionally a *strict subset* of
 * `@rox-one/shared/agent#AgentBackend`. Every member here has an
 * identically-named member on `AgentBackend` with the same signature, so any
 * `AgentBackend` is assignable to `AgentRuntime` without a cast.
 *
 * Members are limited to those whose signatures touch only `@rox-one/core`
 * primitives (`AgentEvent`, plain strings, plain booleans). Members that
 * reference shared-only types (sources, MCP servers, permission requests,
 * thinking levels, workspace config) live exclusively on `AgentBackend`.
 */
export interface AgentRuntime {
  /**
   * Stream agent events for the current turn.
   *
   * Implementations may accept additional positional arguments (attachments,
   * options) — callers using `AgentRuntime` directly should treat those as
   * opaque and pass through `AgentBackend` if they need them.
   *
   * The yielded `AgentEvent` shape is the canonical provider-agnostic event
   * type owned by core.
   */
  chat(message: string, ...rest: unknown[]): AsyncGenerator<AgentEvent>;

  /**
   * Whether the runtime is currently processing a turn.
   *
   * Used by lifecycle code (idle-restart gating, auto-compaction triggers)
   * that must not depend on shared-typed state.
   */
  isProcessing(): boolean;

  /**
   * Run a backend-managed text completion using the runtime's auth context.
   *
   * Returns `null` when the runtime cannot service the request (no auth, no
   * mini model configured, etc.). Used for title generation, connection
   * tests, and summarization.
   */
  runMiniCompletion(prompt: string): Promise<string | null>;

  /**
   * Get the SDK session ID for resume, or `null` when no session is active.
   *
   * The string is provider-defined; core treats it as opaque.
   */
  getSessionId(): string | null;

  /**
   * Release subprocess handles, MCP connections, watchers, and timers.
   *
   * After `destroy()` returns, the runtime is unusable. Idempotent.
   */
  destroy(): void;

  /**
   * Alias for `destroy()`. Kept for callers that follow the
   * `Disposable`/`dispose()` convention.
   */
  dispose(): void;
}
