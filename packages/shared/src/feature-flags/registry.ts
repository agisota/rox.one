/**
 * Centralized FeatureFlag registry — owned by WT-07.
 *
 * Every Wave 0/1 worktree merges behind a feature flag that defaults to OFF.
 * The compile-time `FEATURE_FLAGS` table is the source of truth; downstream
 * WTs MUST NOT mutate it. They may register additional flags dynamically via
 * `registerFlag(key, default, owner_wt)` — useful for plugins / spike work
 * that has not yet earned a slot in the compile-time table.
 *
 * Resolve precedence (lowest to highest):
 *   default → plan-pack → tenant-override → admin-grant.
 *
 * See `entitlement.ts` for per-tenant overrides and `quota-account.ts` for
 * usage tracking.
 *
 * Spec: docs/superpowers/specs/2026-05-21-wt-07-entitlement-flags-design.md
 */

/** Value space supported by feature flags / entitlements. */
export type FeatureFlagValue = boolean | number | string;

/** A registry row describing a single flag. */
export interface FeatureFlagDescriptor {
  readonly default: FeatureFlagValue;
  readonly owner_wt: string;
}

/**
 * Compile-time table of known feature flags. Keys reserved here are stable
 * contract surface for sibling WTs.
 *
 * Naming convention:
 *   `rox.feature.<area>[.v<n>]` — area is the WT topic, `v<n>` distinguishes
 *   contract revisions. Contract-shape flags use `contracts.<entity>-v1`.
 *
 * Sibling-WT scaffold flags (registered here so downstream worktrees can
 * import the key without owning the registry file):
 *   - `rox.feature.contracts.user-v1`       → WT-04 (User + Identity)
 *   - `rox.feature.contracts.tenant-v1`     → WT-05 (Tenant / Organization)
 *   - `rox.feature.contracts.workspace-v1`  → WT-06 (Workspace / Team)
 *   - `rox.feature.contracts.audit-v1`      → WT-08 (Audit + Telemetry)
 */
export const FEATURE_FLAGS = {
  // ── Contract-shape flags (WT-04..WT-08) ───────────────────────────────
  'rox.feature.contracts.user-v1': { default: false, owner_wt: 'WT-04' },
  'rox.feature.contracts.tenant-v1': { default: false, owner_wt: 'WT-05' },
  'rox.feature.contracts.tenant-org.v1': { default: false, owner_wt: 'WT-05' },
  'rox.feature.contracts.workspace-v1': { default: false, owner_wt: 'WT-06' },
  'rox.feature.contracts.workspace-team.v1': { default: false, owner_wt: 'WT-06' },
  'rox.feature.contracts.audit-v1': { default: false, owner_wt: 'WT-08' },
  'rox.feature.entitlements.v1': { default: false, owner_wt: 'WT-07' },

  // ── Auth / RBAC (WT-10..WT-17) ────────────────────────────────────────
  'rox.feature.access-jwt': { default: false, owner_wt: 'WT-10' },
  'rox.feature.scim': { default: false, owner_wt: 'WT-11' },
  'rox.feature.account-linking': { default: false, owner_wt: 'WT-12' },
  'rox.feature.username-claim': { default: false, owner_wt: 'WT-13' },
  'rox.feature.rbac.v1': { default: false, owner_wt: 'WT-14' },
  'rox.feature.membership-invite': { default: false, owner_wt: 'WT-15' },
  'rox.feature.tenant-isolation': { default: false, owner_wt: 'WT-16' },
  'rox.feature.rbac-admin-ui': { default: false, owner_wt: 'WT-17' },

  // ── Storage / Drive (WT-18..WT-27) ────────────────────────────────────
  'rox.feature.audit-log-query': { default: false, owner_wt: 'WT-18' },
  'rox.feature.email-provider': { default: false, owner_wt: 'WT-19' },
  'rox.feature.email-templates-i18n': { default: false, owner_wt: 'WT-20' },
  'rox.feature.notif-prefs-ui': { default: false, owner_wt: 'WT-21' },
  'rox.feature.mailbox-domain': { default: false, owner_wt: 'WT-22' },
  'rox.feature.drive.v1': { default: false, owner_wt: 'WT-23' },
  'rox.feature.quota-engine': { default: false, owner_wt: 'WT-24' },
  'rox.feature.dedup-engine': { default: false, owner_wt: 'WT-25' },
  'rox.feature.backup-restore': { default: false, owner_wt: 'WT-26' },
  'rox.feature.soft-delete-versioning': { default: false, owner_wt: 'WT-27' },

  // ── Agent fabric / orchestration (WT-28..WT-32) ───────────────────────
  'rox.feature.agent-fabric.v1': { default: false, owner_wt: 'WT-28' },
  'rox.feature.task-dag-runner': { default: false, owner_wt: 'WT-29' },
  'rox.feature.queue-fanout': { default: false, owner_wt: 'WT-30' },
  'rox.feature.realtime-ws': { default: false, owner_wt: 'WT-31' },
  'rox.feature.evidence-store': { default: false, owner_wt: 'WT-32' },

  // ── Product surface (WT-33..WT-39) ────────────────────────────────────
  'rox.feature.prompt-v2': { default: false, owner_wt: 'WT-33' },
  'rox.feature.agent-run-ui': { default: false, owner_wt: 'WT-34' },
  'rox.feature.notes-mvp': { default: false, owner_wt: 'WT-35' },
  'rox.feature.day-tracking-mvp': { default: false, owner_wt: 'WT-36' },
  'rox.feature.onboarding-hints': { default: false, owner_wt: 'WT-37' },
  'rox.feature.source-registry-contract': { default: false, owner_wt: 'WT-38' },
  'rox.feature.mcp-connector-packs': { default: false, owner_wt: 'WT-39' },
} as const satisfies Record<string, FeatureFlagDescriptor>;

/** Union of all compile-time-known flag keys. */
export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

/**
 * Thrown when a caller attempts to register a flag whose key already exists
 * with a *different* default value. Idempotent re-registration with the same
 * default is permitted so plugins can call `registerFlag` defensively.
 */
export class DuplicateFlagError extends Error {
  constructor(
    public readonly key: string,
    public readonly existingDefault: FeatureFlagValue,
    public readonly attemptedDefault: FeatureFlagValue,
  ) {
    super(
      `Flag "${key}" already registered with default=${String(existingDefault)}; ` +
        `cannot re-register with default=${String(attemptedDefault)}`,
    );
    this.name = 'DuplicateFlagError';
  }
}

const dynamicRegistry = new Map<string, FeatureFlagDescriptor>();

/**
 * Register a flag at runtime. Idempotent if (default, owner) match a previous
 * call; throws {@link DuplicateFlagError} on conflict. Compile-time flags
 * cannot be shadowed with a different default.
 */
export function registerFlag(
  key: string,
  defaultValue: FeatureFlagValue,
  ownerWt: string,
): void {
  const compileTime = (FEATURE_FLAGS as Record<string, FeatureFlagDescriptor>)[key];
  if (compileTime !== undefined) {
    if (compileTime.default !== defaultValue) {
      throw new DuplicateFlagError(key, compileTime.default, defaultValue);
    }
    return;
  }
  const existing = dynamicRegistry.get(key);
  if (existing !== undefined) {
    if (existing.default !== defaultValue) {
      throw new DuplicateFlagError(key, existing.default, defaultValue);
    }
    return;
  }
  dynamicRegistry.set(key, { default: defaultValue, owner_wt: ownerWt });
}

/**
 * Returns the compile-time default value for a flag key. Falls back to
 * dynamically-registered defaults. Throws for unknown keys so callers cannot
 * silently rely on `false`.
 */
export function getDefaultValue(key: string): FeatureFlagValue {
  const compileTime = (FEATURE_FLAGS as Record<string, FeatureFlagDescriptor>)[key];
  if (compileTime !== undefined) return compileTime.default;
  const dynamic = dynamicRegistry.get(key);
  if (dynamic !== undefined) return dynamic.default;
  throw new Error(`Unknown feature flag: ${key}`);
}

/** Test-only: clears the dynamic registry. Has no effect on compile-time flags. */
export function resetDynamicRegistry(): void {
  dynamicRegistry.clear();
}

/** Returns true if `key` is part of the compile-time table. */
export function isCompileTimeFlag(key: string): key is FeatureFlagKey {
  return Object.prototype.hasOwnProperty.call(FEATURE_FLAGS, key);
}

/**
 * Snapshot of every known flag (compile-time + dynamically registered).
 * Used by the pre-merge gate to cross-reference `release-cuts.yaml`.
 */
export function listAllFlags(): Array<{ key: string; descriptor: FeatureFlagDescriptor }> {
  const compile = Object.entries(FEATURE_FLAGS).map(([key, descriptor]) => ({
    key,
    descriptor: descriptor as FeatureFlagDescriptor,
  }));
  const dynamic = Array.from(dynamicRegistry.entries()).map(([key, descriptor]) => ({
    key,
    descriptor,
  }));
  return [...compile, ...dynamic];
}
