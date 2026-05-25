/**
 * `@rox-one/shared/core` — foundation data contracts.
 *
 * Public TS API for User + Identity + UUID v7. See spec:
 * docs/superpowers/specs/2026-05-21-wt-04-contract-user-identity-design.md
 *
 * Feature flag: `rox.feature.contracts.user-v1` (default OFF).
 * The OFF state gates *repository registration*, not type exports —
 * downstream WTs may always `import` the schemas.
 */

export {
  DEFAULT_TENANT_ID,
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
