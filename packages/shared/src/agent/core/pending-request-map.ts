/**
 * PendingRequestMap — RPC pending-request bookkeeping.
 *
 * Many of our agent backends speak RPC over a subprocess JSON-RPC channel.
 * For each outbound request we open a promise, key it by request id, and wait
 * for a matching response message to settle it. The shape repeats verbatim:
 *
 *     private pendingX: Map<string, {
 *       resolve: (value: T) => void;
 *       reject: (error: Error) => void;
 *     }> = new Map();
 *
 *     // on request:
 *     await new Promise<T>((resolve, reject) => {
 *       pendingX.set(id, { resolve, reject });
 *       send({ ... });
 *     });
 *
 *     // on response:
 *     const pending = pendingX.get(id);
 *     if (pending) {
 *       pendingX.delete(id);
 *       pending.resolve(value);
 *     }
 *
 *     // on subprocess exit / fatal error:
 *     for (const [, pending] of pendingX) pending.reject(err);
 *     pendingX.clear();
 *
 * `PendingRequestMap` is the single concern: settle exactly once, drop the
 * entry on settle, support bulk-reject on shutdown. Callers can attach
 * arbitrary per-entry metadata via the `M` type parameter (e.g. `toolName`
 * for permissions) without re-implementing the map every time.
 *
 * This utility is intentionally narrow — it does not own promise creation
 * (callers wrap `register()` in `new Promise<T>(...)` to keep the request-
 * sending code legible) and it does not own timeouts (different RPC paths
 * have different timeout semantics, or none).
 */

/**
 * Internal entry shape: caller-supplied metadata plus the promise settlers.
 *
 * The metadata `M` is exposed unchanged through `entries()` so callers that
 * need contextual data (toolName, capturedAt, etc.) can read it.
 */
type PendingEntry<T, M> = M & {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

/**
 * Bookkeeping for outstanding RPC requests keyed by string request id.
 *
 * Type parameters:
 * - `T`: the value type the request resolves to.
 * - `M`: optional per-entry metadata; defaults to no extra fields.
 *
 * Lifecycle:
 * - `register(id, resolve, reject, meta?)` — record a new outstanding request.
 * - `resolve(id, value)` / `reject(id, error)` — settle and drop. No-op if
 *   the id is absent (handles late responses after `rejectAll()`).
 * - `rejectAll(error)` — settle every outstanding entry with `reject` and
 *   clear the map. Used on subprocess exit / fatal error.
 *
 * Each entry is settled exactly once: settle paths always remove the entry
 * before invoking `resolve`/`reject` so a re-entrant settle attempt no-ops.
 */
export class PendingRequestMap<T, M extends object = Record<string, never>> {
  private readonly entries_: Map<string, PendingEntry<T, M>> = new Map();

  /**
   * Record a new outstanding request.
   *
   * `register()` is typically called inside the executor of a `Promise<T>`,
   * passing in that promise's `resolve` / `reject`.
   */
  register(
    id: string,
    resolve: (value: T) => void,
    reject: (error: Error) => void,
    meta?: M
  ): void {
    const entry = {
      ...(meta ?? ({} as M)),
      resolve,
      reject,
    } as PendingEntry<T, M>;
    this.entries_.set(id, entry);
  }

  /**
   * Settle the entry with `id` to `value` and drop it.
   *
   * Returns `true` if a pending entry was found and resolved; `false` if the
   * id was unknown (response arrived after `rejectAll()` or a duplicate).
   */
  resolve(id: string, value: T): boolean {
    const pending = this.entries_.get(id);
    if (!pending) return false;
    this.entries_.delete(id);
    pending.resolve(value);
    return true;
  }

  /**
   * Settle the entry with `id` to a rejection and drop it.
   *
   * Returns `true` if a pending entry was found and rejected; `false` if the
   * id was unknown.
   */
  reject(id: string, error: Error): boolean {
    const pending = this.entries_.get(id);
    if (!pending) return false;
    this.entries_.delete(id);
    pending.reject(error);
    return true;
  }

  /**
   * Reject every outstanding entry with `error` and clear the map.
   *
   * Used on subprocess exit / fatal error / teardown so callers awaiting an
   * in-flight RPC get a meaningful failure instead of hanging.
   */
  rejectAll(error: Error): void {
    // Snapshot before clearing so re-entrant settle attempts during reject
    // see an empty map.
    const snapshot = Array.from(this.entries_.values());
    this.entries_.clear();
    for (const pending of snapshot) {
      pending.reject(error);
    }
  }

  /**
   * Look up the metadata for `id` without settling the entry.
   *
   * Returns the per-entry metadata only (no `resolve`/`reject`). Useful for
   * the rare case where a response handler needs caller-supplied context.
   */
  getMeta(id: string): M | undefined {
    const entry = this.entries_.get(id);
    if (!entry) return undefined;
    // Strip the settlers; return only the caller-supplied fields.
    const { resolve: _r, reject: _j, ...meta } = entry;
    void _r;
    void _j;
    return meta as M;
  }

  /**
   * Whether the map has any outstanding entries.
   */
  get size(): number {
    return this.entries_.size;
  }

  /**
   * Whether `id` is currently outstanding.
   */
  has(id: string): boolean {
    return this.entries_.has(id);
  }
}
