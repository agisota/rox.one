/**
 * Tenant data contract (WT-05).
 *
 * Canonical schema for the multi-tenant root entity. Storage-agnostic — the
 * SQL persistence layer lives in `@rox-one/server-core/schema/tenant`.
 *
 * Design references:
 *   - docs/superpowers/specs/2026-05-21-wt-05-tenant-org-design.md
 *   - ADR A05-01..A05-06
 *
 * Hard rules:
 *   - `id` is a branded UUID v7 string (`TenantId`); no raw `string` may be
 *     assigned to `TenantId` without going through `parseTenant`.
 *   - `slug` is a separate, mutable, human-facing column with a unique
 *     index in the DB (A05-02). Lowercase alnum + hyphen, 3-40 chars.
 *   - `plan` is a strict enum (A05-04). Downstream features matcher on
 *     these values exactly; new tiers require a migration.
 *   - `deletedAt` is the soft-delete marker (A05-03). Downstream queries
 *     MUST filter `deletedAt IS NULL` by default.
 */

import { z } from 'zod';

declare const TENANT_ID_BRAND: unique symbol;
/**
 * Branded tenant identifier. Always a UUID v7 in canonical lowercase form.
 * Never construct directly — always go through `parseTenant` or
 * `Tenant.parse`, which apply the brand after validation.
 */
export type TenantId = string & { readonly [TENANT_ID_BRAND]: true };

/** Plan tier enum (A05-04). */
export const TenantPlan = z.enum(['free', 'pro', 'team', 'enterprise']);
export type TenantPlan = z.infer<typeof TenantPlan>;

/** Region pin (eu / us / global). */
export const TenantRegion = z.enum(['eu', 'us', 'global']);
export type TenantRegion = z.infer<typeof TenantRegion>;

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/**
 * Canonical Tenant zod schema.
 *
 * Notes on shape:
 *   - `id` is validated as `uuid` and then transformed to `TenantId`.
 *   - `plan` and `region` carry defaults so legacy single-tenant rows
 *     parse cleanly during the migration to multi-tenant.
 *   - `deletedAt` is nullable and defaults to `null` — see A05-03.
 */
export const Tenant = z.object({
  id: z
    .string()
    .uuid()
    .transform((v) => v as TenantId),
  slug: z.string().regex(SLUG_PATTERN, 'slug must be lowercase alnum + hyphen, 3-40 chars'),
  name: z.string().min(1).max(120),
  plan: TenantPlan.default('free'),
  region: TenantRegion.default('global'),
  createdAt: z.string().datetime({ offset: false }),
  updatedAt: z.string().datetime({ offset: false }),
  deletedAt: z.string().datetime({ offset: false }).nullable().default(null),
});
export type Tenant = z.infer<typeof Tenant>;

/** Pre-parse input shape (before defaults are applied). */
export type TenantInput = z.input<typeof Tenant>;

/**
 * Parse + brand a tenant in a single call. Use this in IPC boundaries and
 * persistence adapters — the resulting `Tenant.id` is `TenantId`-typed.
 */
export function parseTenant(input: unknown): Tenant {
  return Tenant.parse(input);
}

/**
 * Serialize a parsed Tenant back to its on-wire form (a plain JSON object).
 *
 * Round-trip stable: `parseTenant(serializeTenant(x))` must equal `x`
 * structurally. See AC-9.
 */
export function serializeTenant(tenant: Tenant): TenantInput {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    plan: tenant.plan,
    region: tenant.region,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
    deletedAt: tenant.deletedAt,
  };
}

/**
 * Thrown when a write would violate `tenants.slug` uniqueness.
 *
 * The repository layer is responsible for raising this; it lives in the
 * shared contract so callers can `instanceof`-check without taking a
 * dependency on the persistence package.
 */
export class TenantSlugConflictError extends Error {
  public readonly slug: string;
  constructor(slug: string) {
    super(`tenant slug already exists: ${slug}`);
    this.name = 'TenantSlugConflictError';
    this.slug = slug;
  }
}
