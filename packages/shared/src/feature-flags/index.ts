/**
 * Barrel for the `@rox-one/shared/feature-flags` directory.
 *
 * Note: the legacy module `packages/shared/src/feature-flags.ts` (singular
 * runtime helpers like `isDevRuntime`, `FEATURE_FLAGS` for the Electron app)
 * is intentionally kept separate. New consumers should import from
 * `@rox-one/shared/feature-flags/registry` (or this barrel via a deeper
 * subpath) to avoid colliding with that file's `FEATURE_FLAGS` const.
 *
 * Owned by WT-07. Downstream WTs only consume.
 */

export {
  DuplicateFlagError,
  FEATURE_FLAGS as FEATURE_FLAG_REGISTRY,
  getDefaultValue,
  isCompileTimeFlag,
  listAllFlags,
  registerFlag,
  resetDynamicRegistry,
  type FeatureFlagDescriptor,
  type FeatureFlagKey,
  type FeatureFlagValue,
} from './registry.ts';

export {
  ENTITLEMENT_SOURCES,
  EntitlementSchema,
  EntitlementSourceSchema,
  EntitlementValueSchema,
  resolveEntitlement,
  type Entitlement,
  type EntitlementSource,
  type ResolveEntitlementInput,
  type ResolvedEntitlement,
} from './entitlement.ts';

export {
  QUOTA_PERIODS,
  QUOTA_RESOURCES,
  QuotaAccountSchema,
  QuotaPeriodSchema,
  QuotaResourceSchema,
  peek,
  release,
  tryConsume,
  type QuotaAccount,
  type QuotaAuditEvent,
  type QuotaAuditSink,
  type QuotaOptions,
  type QuotaPeekView,
  type QuotaPeriod,
  type QuotaResource,
  type QuotaScope,
  type TryConsumeResult,
} from './quota-account.ts';
