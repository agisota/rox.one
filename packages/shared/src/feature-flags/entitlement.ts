/**
 * Per-tenant Entitlement schema and resolver — owned by WT-07.
 *
 * An `Entitlement` row overrides the compile-time default for a single
 * `(tenantId, featureKey)` pair from a specific `source`. Sources are ranked:
 *
 *   admin-grant > tenant-override > plan-pack > default
 *
 * Expired rows (`expiresAt < now()`) are ignored and the resolver falls
 * through to the next-best source. If no row applies, the registry default
 * is returned.
 *
 * Spec: docs/superpowers/specs/2026-05-21-wt-07-entitlement-flags-design.md
 */

import { z } from 'zod';

import { getDefaultValue, type FeatureFlagValue } from './registry.ts';

/** Sources of entitlement assignment, ranked low → high precedence. */
export const ENTITLEMENT_SOURCES = ['default', 'plan-pack', 'tenant-override', 'admin-grant'] as const;
export const EntitlementSourceSchema = z.enum(ENTITLEMENT_SOURCES);
export type EntitlementSource = z.infer<typeof EntitlementSourceSchema>;

/** Numeric precedence used by the resolver — higher wins. */
const SOURCE_RANK: Record<EntitlementSource, number> = {
  default: 0,
  'plan-pack': 1,
  'tenant-override': 2,
  'admin-grant': 3,
};

/**
 * ISO-8601 timestamp in UTC. Accepts the naive `"YYYY-MM-DDTHH:mm:ss"`
 * form used by sibling contracts (user, tenant, workspace) as well as the
 * explicit `Z`-suffixed form emitted by `new Date().toISOString()`, so JSON
 * wire-format stays uniform across producers.
 */
const TimestampSchema = z.iso.datetime({ local: true });

export const EntitlementValueSchema = z.union([z.boolean(), z.number(), z.string()]);

export const EntitlementSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  featureKey: z.string().min(1),
  value: EntitlementValueSchema,
  source: EntitlementSourceSchema,
  expiresAt: TimestampSchema.nullable().default(null),
  createdAt: TimestampSchema,
});

export type Entitlement = z.infer<typeof EntitlementSchema>;

export interface ResolveEntitlementInput {
  tenantId: string;
  featureKey: string;
  entitlements: readonly Entitlement[];
  /** Wall-clock for TTL evaluation. Pass an explicit value in tests. */
  now: Date;
}

export interface ResolvedEntitlement {
  value: FeatureFlagValue;
  source: EntitlementSource;
}

/**
 * Resolves the effective value of `featureKey` for `tenantId`. Iterates the
 * candidate entitlements once, keeping only the highest-ranked, non-expired,
 * tenant-matching row. Returns the registry default when nothing applies.
 */
export function resolveEntitlement(input: ResolveEntitlementInput): ResolvedEntitlement {
  const { tenantId, featureKey, entitlements, now } = input;
  const nowMs = now.getTime();

  let best: Entitlement | undefined;
  let bestRank = -1;

  for (const entitlement of entitlements) {
    if (entitlement.tenantId !== tenantId) continue;
    if (entitlement.featureKey !== featureKey) continue;
    if (entitlement.expiresAt !== null) {
      // Naive UTC strings parse as UTC when suffixed with "Z"; we add it so
      // comparisons stay consistent regardless of the host TZ.
      const expiry = Date.parse(`${entitlement.expiresAt}Z`);
      if (Number.isFinite(expiry) && expiry < nowMs) continue;
    }
    const rank = SOURCE_RANK[entitlement.source];
    if (rank > bestRank) {
      best = entitlement;
      bestRank = rank;
    }
  }

  if (best !== undefined) {
    return { value: best.value, source: best.source };
  }

  return { value: getDefaultValue(featureKey), source: 'default' };
}
