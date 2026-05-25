/**
 * `@rox-one/shared/core` — foundation data contracts.
 *
 * Public TS API for User + Identity + UUID v7 (WT-04) AND
 * Tenant + Organization (WT-05) data contracts. See specs:
 *   docs/superpowers/specs/2026-05-21-wt-04-contract-user-identity-design.md
 *
 * Feature flag: `rox.feature.contracts.user-v1` (default OFF).
 * The OFF state gates *repository registration*, not type exports —
 * downstream WTs may always `import` the schemas.
 *
 * After merge, these files become read-only for other WTs (see master
 * parallel-harness spec §2.1). Modifications require an explicit WT.
 */

export {
  UuidV7Schema,
  isUuidV7,
  uuidV7,
  uuidV7TimestampMs,
  type UuidV7,
} from './uuid-v7.ts';

export {
  EmailSchema,
  IsoUtcSchema,
  LocaleSchema,
  TimezoneSchema,
  UserSchema,
  UserStatusSchema,
  UsernameSchema,
  type User,
  type UserStatus,
} from './user.ts';

export {
  IDENTITY_CLAIMS_MAX_BYTES,
  IdentityProviderSchema,
  IdentitySchema,
  type Identity,
  type IdentityProvider,
} from './identity.ts';

export {
  Tenant,
  TenantPlan,
  TenantRegion,
  parseTenant,
  serializeTenant,
  TenantSlugConflictError,
  type TenantId,
  type TenantInput,
} from './tenant.ts';

export {
  Organization,
  OrganizationSettings,
  parseOrganization,
  serializeOrganization,
  OrganizationOrphanError,
  type OrganizationId,
  type OrganizationInput,
} from './organization.ts';

export {
  DEFAULT_TENANT_ID,
  DEFAULT_TENANT_SLUG,
  MULTI_TENANT_ENV,
  isDefaultTenant,
  resolveTenantId,
  MissingTenantContextError,
  type TenantResolverContext,
} from './tenant-defaults.ts';
