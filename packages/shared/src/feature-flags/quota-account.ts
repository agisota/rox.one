/**
 * QuotaAccount — usage counter for entitled resources. Owned by WT-07.
 *
 * Each account is scoped to a (tenant | user | workspace), tracks `used`
 * against a `limit`, and resets `used` to 0 when the current period elapses
 * (except `lifetime`, which never resets).
 *
 * `tryConsume` is the only mutator; it returns a new account on success or
 * `{ ok: false, retryAfter }` on overflow. Audit emission is interface-only
 * here (real emit lives in WT-08); callers pass an optional `audit` sink.
 *
 * Spec: docs/superpowers/specs/2026-05-21-wt-07-entitlement-flags-design.md
 */

import { z } from 'zod';

export const QUOTA_RESOURCES = [
  'storage_bytes',
  'agent_runs_per_day',
  'mcp_connections',
  'mailbox_addresses',
  'team_members',
  'skill_installs',
] as const;
export const QuotaResourceSchema = z.enum(QUOTA_RESOURCES);
export type QuotaResource = z.infer<typeof QuotaResourceSchema>;

export const QUOTA_PERIODS = ['minute', 'hour', 'day', 'month', 'lifetime'] as const;
export const QuotaPeriodSchema = z.enum(QUOTA_PERIODS);
export type QuotaPeriod = z.infer<typeof QuotaPeriodSchema>;

// Accepts both naive UTC ("YYYY-MM-DDTHH:mm:ss[.sss]") and `Z`-suffixed ISO
// strings. `Date.prototype.toISOString()` emits the `Z` form, so leaving the
// timezone optional avoids round-trip mismatches.
const TimestampSchema = z.iso.datetime({ local: true });

const QuotaScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('tenant'), tenantId: z.string().uuid() }),
  z.object({ kind: z.literal('user'), userId: z.string().uuid() }),
  z.object({ kind: z.literal('workspace'), workspaceId: z.string().uuid() }),
]);
export type QuotaScope = z.infer<typeof QuotaScopeSchema>;

export const QuotaAccountSchema = z.object({
  id: z.string().uuid(),
  scope: QuotaScopeSchema,
  resource: QuotaResourceSchema,
  used: z.number().int().min(0),
  limit: z.number().int().min(0),
  period: QuotaPeriodSchema,
  periodStart: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type QuotaAccount = z.infer<typeof QuotaAccountSchema>;

/**
 * Shape of the audit event emitted on every consume/release/reset. WT-08 owns
 * the real emit interface; this struct keeps the contract stable.
 */
export interface QuotaAuditEvent {
  accountId: string;
  scope: QuotaScope;
  resource: QuotaResource;
  action: 'consume' | 'consume-denied' | 'release' | 'period-reset';
  amount: number;
  usedBefore: number;
  usedAfter: number;
  at: string;
}

export type QuotaAuditSink = (event: QuotaAuditEvent) => void;

export interface QuotaOptions {
  now: Date;
  audit?: QuotaAuditSink;
}

export type TryConsumeResult =
  | { ok: true; account: QuotaAccount }
  | { ok: false; retryAfter: number };

const PERIOD_MS: Record<Exclude<QuotaPeriod, 'lifetime'>, number> = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  // Approximation: 30 days. Calendar-aware monthly reset is out of scope for
  // WT-07; consumers needing strict calendar-month semantics should re-seed
  // the account on month boundaries (see WT-24).
  month: 30 * 24 * 60 * 60 * 1000,
};

/** Parses a naive UTC timestamp ("YYYY-MM-DDTHH:mm:ss[.sss]") as UTC millis. */
function parseUtc(timestamp: string): number {
  const ms = Date.parse(`${timestamp}Z`);
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }
  return ms;
}

/** Formats a Date as a naive UTC ISO string matching `TimestampSchema`. */
function formatUtc(date: Date): string {
  return date.toISOString().replace(/Z$/, '');
}

/**
 * Returns the account after applying period auto-reset rules. Pure function:
 * does not call the audit sink. Callers that want to record a reset must do
 * so explicitly.
 */
function applyPeriodReset(
  account: QuotaAccount,
  now: Date,
): { account: QuotaAccount; reset: boolean } {
  if (account.period === 'lifetime') return { account, reset: false };
  const periodMs = PERIOD_MS[account.period];
  const start = parseUtc(account.periodStart);
  if (now.getTime() < start + periodMs) return { account, reset: false };
  return {
    account: {
      ...account,
      used: 0,
      periodStart: formatUtc(now),
      updatedAt: formatUtc(now),
    },
    reset: true,
  };
}

function ensurePositiveAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    throw new Error(`Quota amount must be a positive integer; got ${amount}`);
  }
}

/**
 * Attempts to consume `amount` from the account. On success returns the
 * updated account; on overflow returns `{ ok: false, retryAfter }` where
 * `retryAfter` is millis until the next period boundary (0 for `lifetime`).
 */
export function tryConsume(
  account: QuotaAccount,
  amount: number,
  options: QuotaOptions,
): TryConsumeResult {
  ensurePositiveAmount(amount);
  const { now, audit } = options;
  const { account: reset, reset: didReset } = applyPeriodReset(account, now);

  if (didReset && audit !== undefined) {
    audit({
      accountId: reset.id,
      scope: reset.scope,
      resource: reset.resource,
      action: 'period-reset',
      amount: 0,
      usedBefore: account.used,
      usedAfter: 0,
      at: formatUtc(now),
    });
  }

  if (reset.used + amount > reset.limit) {
    if (audit !== undefined) {
      audit({
        accountId: reset.id,
        scope: reset.scope,
        resource: reset.resource,
        action: 'consume-denied',
        amount,
        usedBefore: reset.used,
        usedAfter: reset.used,
        at: formatUtc(now),
      });
    }
    return { ok: false, retryAfter: retryAfterMs(reset, now) };
  }

  const updated: QuotaAccount = {
    ...reset,
    used: reset.used + amount,
    updatedAt: formatUtc(now),
  };
  if (audit !== undefined) {
    audit({
      accountId: updated.id,
      scope: updated.scope,
      resource: updated.resource,
      action: 'consume',
      amount,
      usedBefore: reset.used,
      usedAfter: updated.used,
      at: formatUtc(now),
    });
  }
  return { ok: true, account: updated };
}

/**
 * Releases `amount` previously consumed. Clamps at zero so callers do not
 * need to track whether a prior consume actually applied.
 */
export function release(
  account: QuotaAccount,
  amount: number,
  options: QuotaOptions,
): QuotaAccount {
  ensurePositiveAmount(amount);
  const { now, audit } = options;
  const usedAfter = Math.max(0, account.used - amount);
  const updated: QuotaAccount = {
    ...account,
    used: usedAfter,
    updatedAt: formatUtc(now),
  };
  if (audit !== undefined) {
    audit({
      accountId: updated.id,
      scope: updated.scope,
      resource: updated.resource,
      action: 'release',
      amount,
      usedBefore: account.used,
      usedAfter,
      at: formatUtc(now),
    });
  }
  return updated;
}

export interface QuotaPeekView {
  used: number;
  limit: number;
  remaining: number;
  /** Naive-UTC ISO string for when `used` will next be auto-reset; null for lifetime. */
  resetAt: string | null;
}

/**
 * Returns a read-only view of the account, applying period reset semantics.
 * Does not mutate or emit audit events.
 */
export function peek(account: QuotaAccount, options: QuotaOptions): QuotaPeekView {
  const { account: reset } = applyPeriodReset(account, options.now);
  return {
    used: reset.used,
    limit: reset.limit,
    remaining: Math.max(0, reset.limit - reset.used),
    resetAt: reset.period === 'lifetime' ? null : computeResetAt(reset),
  };
}

function computeResetAt(account: QuotaAccount): string | null {
  if (account.period === 'lifetime') return null;
  const periodMs = PERIOD_MS[account.period];
  const start = parseUtc(account.periodStart);
  return formatUtc(new Date(start + periodMs));
}

function retryAfterMs(account: QuotaAccount, now: Date): number {
  if (account.period === 'lifetime') return 0;
  const periodMs = PERIOD_MS[account.period];
  const start = parseUtc(account.periodStart);
  return Math.max(0, start + periodMs - now.getTime());
}
