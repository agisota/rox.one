/**
 * IntegrationRegistry — central lookup for every registered integration.
 *
 * Lifecycle:
 *
 * 1. Startup wiring registers every known manifest via `register(manifest)`.
 * 2. `register()` runs the Zod schema against the manifest and detects
 *    duplicate ids — both checks throw with a message that includes the
 *    manifest id so operators can find the bad input fast.
 * 3. Downstream code resolves manifests via `get(id)` (for routing) or
 *    `list()` (for menus and audit views).
 * 4. `validateAll()` re-runs validation across every registered manifest;
 *    useful for boot-time guards that snapshot the registry once it is fully
 *    populated.
 */

import { z } from 'zod';
import {
  IntegrationManifestSchema,
  type IntegrationManifest,
} from './manifest.ts';

/** Result returned by `validateAll()`. */
export type ValidateAllResult =
  | { ok: true }
  | {
      ok: false;
      failures: ReadonlyArray<{ id: string; error: z.ZodError }>;
    };

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length === 0 ? '<root>' : issue.path.join('.');
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

/**
 * Registry of `IntegrationManifest` keyed by manifest `id`. Instances are
 * lightweight — most apps register everything into a single global registry
 * during startup, but tests can spin up isolated registries freely.
 */
export class IntegrationRegistry {
  private readonly manifests = new Map<string, IntegrationManifest>();

  /**
   * Register a manifest. Throws if:
   *
   * - the manifest fails Zod validation (e.g. missing required field,
   *   security-baseline weakening, discriminator mismatch); or
   * - an existing manifest with the same `id` is already registered.
   *
   * On Zod failure the error message includes the manifest id (best-effort —
   * read from the raw input even if validation otherwise fails) AND the
   * underlying issue list so logs are actionable without follow-up grep.
   */
  register(manifest: IntegrationManifest): void {
    const candidateId =
      typeof (manifest as { id?: unknown })?.id === 'string'
        ? ((manifest as { id: string }).id || '<unknown-id>')
        : '<unknown-id>';

    const parsed = IntegrationManifestSchema.safeParse(manifest);
    if (!parsed.success) {
      throw new Error(
        `IntegrationRegistry: manifest "${candidateId}" failed validation — ${formatZodError(parsed.error)}`,
      );
    }

    const validated = parsed.data;
    if (this.manifests.has(validated.id)) {
      throw new Error(
        `IntegrationRegistry: duplicate manifest id "${validated.id}"`,
      );
    }

    this.manifests.set(validated.id, validated);
  }

  /** Retrieve a manifest by id, or `undefined` if not registered. */
  get(id: string): IntegrationManifest | undefined {
    return this.manifests.get(id);
  }

  /** All registered manifests, in insertion order. */
  list(): ReadonlyArray<IntegrationManifest> {
    return Array.from(this.manifests.values());
  }

  /**
   * Re-validate every registered manifest. Useful as a boot-time guard:
   * registration already validates at insertion time, but operators may want
   * a single explicit pass that captures every failure into one report.
   */
  validateAll(): ValidateAllResult {
    const failures: Array<{ id: string; error: z.ZodError }> = [];
    for (const manifest of this.manifests.values()) {
      const result = IntegrationManifestSchema.safeParse(manifest);
      if (!result.success) {
        failures.push({ id: manifest.id, error: result.error });
      }
    }
    if (failures.length === 0) return { ok: true };
    return { ok: false, failures };
  }

  /** Number of registered manifests. */
  size(): number {
    return this.manifests.size;
  }

  /** Remove all registered manifests. Test-only convenience. */
  clear(): void {
    this.manifests.clear();
  }
}
