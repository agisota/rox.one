/**
 * Organization data contract (WT-05).
 *
 * Organization is opt-in within a Tenant (A05-05). On Free plan, a tenant
 * maps to a single organization; Pro / Team / Enterprise may have several.
 *
 * Storage-agnostic; the SQL schema lives in
 * `@rox-one/server-core/schema/tenant` (same migration that creates the
 * tenants table).
 *
 * Hard rules:
 *   - `tenantId` is required; orphan organizations are invalid (AC-8).
 *   - `ownerUserId` is required; ownership transfer is an explicit
 *     downstream operation, not a schema concern.
 *   - `settings` carries the small bag of org-level toggles
 *     (`defaultLocale`, `enforceMfa`, `ssoOnly`). New keys require an
 *     audit-event-bearing migration.
 *   - `deletedAt` is the soft-delete marker (A05-03).
 */

import { z } from 'zod';

declare const ORGANIZATION_ID_BRAND: unique symbol;
/**
 * Branded organization identifier. Always a UUID v7 in canonical lowercase
 * form. Construct only via `parseOrganization` / `Organization.parse`.
 */
export type OrganizationId = string & { readonly [ORGANIZATION_ID_BRAND]: true };

/**
 * Organization-level settings. Kept narrow: each key is a single
 * boolean / scalar with a typed default so org rows from older databases
 * upgrade cleanly. Add new keys with a migration + audit event only.
 */
export const OrganizationSettings = z.object({
  defaultLocale: z.string().min(2).max(35).default('en'),
  enforceMfa: z.boolean().default(false),
  ssoOnly: z.boolean().default(false),
});
export type OrganizationSettings = z.infer<typeof OrganizationSettings>;

/** Canonical Organization zod schema. */
export const Organization = z.object({
  id: z
    .string()
    .uuid()
    .transform((v) => v as OrganizationId),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(120),
  ownerUserId: z.string().uuid(),
  // Zod v4: a bare `.default({})` skips the nested defaults — we resolve
  // them eagerly so callers always get a fully-populated settings object.
  settings: OrganizationSettings.default(() => OrganizationSettings.parse({})),
  createdAt: z.string().datetime({ offset: false }),
  deletedAt: z.string().datetime({ offset: false }).nullable().default(null),
});
export type Organization = z.infer<typeof Organization>;

/** Pre-parse input shape (before defaults are applied). */
export type OrganizationInput = z.input<typeof Organization>;

/** Parse + brand an Organization in a single call. */
export function parseOrganization(input: unknown): Organization {
  return Organization.parse(input);
}

/**
 * Round-trip-stable serializer.
 * `parseOrganization(serializeOrganization(x))` must equal `x` structurally.
 */
export function serializeOrganization(org: Organization): OrganizationInput {
  return {
    id: org.id,
    tenantId: org.tenantId,
    name: org.name,
    ownerUserId: org.ownerUserId,
    settings: { ...org.settings },
    createdAt: org.createdAt,
    deletedAt: org.deletedAt,
  };
}

/**
 * Thrown when an Organization references a tenantId that does not exist
 * (or is soft-deleted). Repository-layer concern; lives here for shared
 * `instanceof` checks.
 */
export class OrganizationOrphanError extends Error {
  public readonly tenantId: string;
  constructor(tenantId: string) {
    super(`organization references unknown tenant: ${tenantId}`);
    this.name = 'OrganizationOrphanError';
    this.tenantId = tenantId;
  }
}
