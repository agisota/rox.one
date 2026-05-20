/**
 * IntegrationManifest — declarative descriptor for every ROX integration.
 *
 * The manifest is the foundational primitive of the integration framework
 * (PZD-78). Every future integration (Rox Design, T271 artifacts, the
 * Browser-as-tool surface, etc.) ships a manifest and is registered through
 * the `IntegrationRegistry` (./registry).
 *
 * Two integration shapes are supported, distinguished by the `kind`
 * discriminator:
 *
 * - `'in-process'`           — logic runs inside the existing renderer / main
 *                              process bundle. No additional WebContentsView,
 *                              no preload, no separate origin.
 * - `'web-contents-view'`    — logic loads in a sandboxed Electron
 *                              `WebContentsView` with a preload script and a
 *                              strict trusted-origins allow-list.
 *
 * Security baseline (non-overridable)
 * -----------------------------------
 *
 * For `web-contents-view` manifests the security baseline is encoded in the
 * TypeScript type itself:
 *
 * - `sandbox`          — optional, must be exactly `true` if present.
 * - `contextIsolation` — optional, must be exactly `true` if present.
 * - `nodeIntegration`  — optional, must be exactly `false` if present.
 * - `webviewTag`       — optional, must be exactly `false` if present.
 *
 * A manifest authored in a future PR that tries `sandbox: false` (or any of
 * the unsafe inversions) fails `tsc --noEmit`. The Zod schema enforces the
 * same constraint at runtime so manifests loaded from JSON / RPC cannot
 * weaken the baseline either.
 *
 * In-process manifests do not own a WebContentsView and therefore reject a
 * `preloadPath` outright; web-contents-view manifests require one.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Reusable sub-schemas
// ---------------------------------------------------------------------------

/**
 * Lifecycle hook *names* — string identifiers the main process resolves to
 * actual handlers at runtime. We intentionally keep them as strings (rather
 * than function references) so manifests are JSON-serialisable.
 */
export const LifecycleSchema = z.object({
  onActivate: z.string().min(1, 'lifecycle.onActivate must be a non-empty string'),
  onDeactivate: z.string().min(1, 'lifecycle.onDeactivate must be a non-empty string'),
  onMessage: z.string().min(1).optional(),
});

/** Visual skin overrides applied to a WebContentsView. */
export const SkinSchema = z
  .object({
    backgroundColor: z.string().min(1).optional(),
    titleBarOverlay: z.boolean().optional(),
  })
  .strict();

/** Navigation policy for a WebContentsView. */
export const NavigationSchema = z
  .object({
    initialUrl: z.string().min(1),
    allowedHostPatterns: z.array(z.string().min(1)).default([]),
  })
  .strict();

/** Telemetry opt-in plus optional event-name prefix. */
export const TelemetrySchema = z
  .object({
    enabled: z.boolean(),
    eventPrefix: z.string().min(1).optional(),
  })
  .strict();

/** Capability flags consumed by the runtime to gate permission prompts. */
export const CapabilitiesSchema = z
  .object({
    requiresNetwork: z.boolean(),
    requiresCamera: z.boolean(),
    requiresMicrophone: z.boolean().optional(),
    requiresFileSystem: z.boolean().optional(),
  })
  .strict();

/** Performance budget enforced by CI guards (Week 6+). */
export const BudgetSchema = z
  .object({
    rendererGzipBytes: z.number().int().nonnegative(),
    mainStartupMs: z.number().int().nonnegative(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Security baseline literals — declared once so the in-process and
// web-contents-view branches share an identical surface.
// ---------------------------------------------------------------------------

/**
 * Security baseline applied to every WebContentsView-backed integration.
 *
 * Every field is OPTIONAL because the runtime defaults are already secure;
 * a manifest only needs to mention these when documenting intent.
 *
 * Crucially, the literal types here mean that the *only* assignable values
 * are the safe ones. A future PR attempting `sandbox: false` will fail
 * `tsc --noEmit`.
 */
const sandboxLiteral = z.literal(true).optional();
const contextIsolationLiteral = z.literal(true).optional();
const nodeIntegrationLiteral = z.literal(false).optional();
const webviewTagLiteral = z.literal(false).optional();

// ---------------------------------------------------------------------------
// Branch: in-process
// ---------------------------------------------------------------------------

/**
 * In-process integration manifest.
 *
 * Carries no WebContentsView, no preload, no `skin`, no `navigation`.
 * `.strict()` ensures attempting to add those fields at runtime fails.
 */
export const InProcessIntegrationManifestSchema = z
  .object({
    id: z.string().min(1, 'id must be a non-empty string'),
    kind: z.literal('in-process'),
    displayName: z.string().min(1, 'displayName must be a non-empty string'),
    trustedOrigins: z.array(z.string().min(1)),
    ipcChannels: z.array(z.string().min(1)),
    lifecycle: LifecycleSchema,
    telemetry: TelemetrySchema,
    capabilities: CapabilitiesSchema,
    budget: BudgetSchema,
  })
  .strict();

export type InProcessIntegrationManifest = z.infer<
  typeof InProcessIntegrationManifestSchema
>;

// ---------------------------------------------------------------------------
// Branch: web-contents-view
// ---------------------------------------------------------------------------

/**
 * WebContentsView-backed integration manifest.
 *
 * `.strict()` rejects unknown keys. Note that the security baseline keys
 * (`sandbox`, `contextIsolation`, `nodeIntegration`, `webviewTag`) ARE
 * recognised — but only with their safe literal values.
 */
export const WebContentsViewIntegrationManifestSchema = z
  .object({
    id: z.string().min(1, 'id must be a non-empty string'),
    kind: z.literal('web-contents-view'),
    displayName: z.string().min(1, 'displayName must be a non-empty string'),
    preloadPath: z
      .string()
      .min(1, 'preloadPath must be a non-empty string for web-contents-view manifests'),
    trustedOrigins: z.array(z.string().min(1)),
    ipcChannels: z.array(z.string().min(1)),
    lifecycle: LifecycleSchema,
    skin: SkinSchema.optional(),
    navigation: NavigationSchema.optional(),
    telemetry: TelemetrySchema,
    capabilities: CapabilitiesSchema,
    budget: BudgetSchema,
    // Security baseline — non-overridable via literal types.
    sandbox: sandboxLiteral,
    contextIsolation: contextIsolationLiteral,
    nodeIntegration: nodeIntegrationLiteral,
    webviewTag: webviewTagLiteral,
  })
  .strict();

export type WebContentsViewIntegrationManifest = z.infer<
  typeof WebContentsViewIntegrationManifestSchema
>;

// ---------------------------------------------------------------------------
// Discriminated union — the public surface.
// ---------------------------------------------------------------------------

/**
 * Discriminated union of every supported integration manifest shape.
 * Narrow on `kind` to access branch-specific fields.
 */
export const IntegrationManifestSchema = z.discriminatedUnion('kind', [
  InProcessIntegrationManifestSchema,
  WebContentsViewIntegrationManifestSchema,
]);

export type IntegrationManifest = z.infer<typeof IntegrationManifestSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Throwing parse — convenience for call sites that prefer exceptions to a
 * `safeParse` result. Throws a `ZodError` on failure; returns the parsed
 * manifest on success.
 */
export function parseIntegrationManifest(value: unknown): IntegrationManifest {
  return IntegrationManifestSchema.parse(value);
}

/**
 * Non-throwing parse. Returns a discriminated `Result` object.
 */
export type IntegrationManifestParseResult =
  | { ok: true; manifest: IntegrationManifest }
  | { ok: false; error: z.ZodError };

export function safeParseIntegrationManifest(
  value: unknown,
): IntegrationManifestParseResult {
  const result = IntegrationManifestSchema.safeParse(value);
  if (result.success) return { ok: true, manifest: result.data };
  return { ok: false, error: result.error };
}
